-- Commissions rebuild — Phase 1e: test harness + operations
-- (docs/commissions/02-plan.md).
--
-- 1. ops_alerts + alert_ops(): one place money-path failures land, visible to
--    admins (no Sentry in this project).
-- 2. get_ops_health(): the numbers an operator checks before/after launch.
-- 3. run_money_selftest(): the Phase 1d scenario suite as a callable, fully
--    rolled-back self-test (used by lib/__tests__/money-selftest.test.ts and
--    runnable by hand from the SQL editor). It writes nothing that survives.
-- Idempotent.

-- ===========================================================================
-- 1. Ops alerts
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ops_alerts (
  id BIGSERIAL PRIMARY KEY,
  kind TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
  message TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  order_id UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ops_alerts_open ON public.ops_alerts (created_at DESC) WHERE resolved_at IS NULL;
ALTER TABLE public.ops_alerts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ops_alerts FROM anon, authenticated;

DO $$
DECLARE v_def TEXT; v_types TEXT[];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';
  IF v_def IS NOT NULL AND v_def NOT LIKE '%ops_alert%' THEN
    SELECT array_agg(m[1]) INTO v_types FROM regexp_matches(v_def, '''([a-z_]+)''::text', 'g') AS m;
    v_types := v_types || ARRAY['ops_alert'];
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[%s]::text[]))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_types) AS t));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.alert_ops(
  p_kind TEXT, p_severity TEXT, p_message TEXT, p_context JSONB DEFAULT '{}'::jsonb, p_order_id UUID DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id BIGINT;
BEGIN
  INSERT INTO ops_alerts (kind, severity, message, context, order_id)
  VALUES (p_kind, COALESCE(p_severity, 'error'), left(p_message, 2000), COALESCE(p_context, '{}'::jsonb), p_order_id)
  RETURNING id INTO v_id;
  -- Throttle: one notification per kind per 15 minutes per admin.
  INSERT INTO notifications (user_id, actor_id, type, order_id, content)
  SELECT pa.user_id, pa.user_id, 'ops_alert', p_order_id, '[' || COALESCE(p_severity, 'error') || '] ' || p_kind || ': ' || left(p_message, 160)
  FROM platform_admins pa
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications n
    WHERE n.user_id = pa.user_id AND n.type = 'ops_alert' AND n.content LIKE '%' || p_kind || ':%' AND n.created_at > NOW() - INTERVAL '15 minutes'
  );
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.alert_ops(TEXT, TEXT, TEXT, JSONB, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alert_ops(TEXT, TEXT, TEXT, JSONB, UUID) TO service_role;

-- ===========================================================================
-- 2. Health snapshot for operators
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_ops_health() RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT jsonb_build_object(
    'checked_at', NOW(),
    'settings', (SELECT jsonb_object_agg(key, value) FROM platform_settings),
    'cron', (SELECT jsonb_object_agg(job, jsonb_build_object('last_started', started_at, 'ok', ok, 'result', result, 'error', error))
             FROM (SELECT DISTINCT ON (job) job, started_at, ok, result, error FROM cron_runs ORDER BY job, started_at DESC) c),
    'cron_jobs_scheduled', (SELECT jsonb_agg(jsonb_build_object('name', jobname, 'schedule', schedule, 'active', active)) FROM cron.job),
    'stripe_events', jsonb_build_object(
      'failed', (SELECT count(*) FROM stripe_events WHERE status = 'failed'),
      'processing_stale', (SELECT count(*) FROM stripe_events WHERE status = 'processing' AND received_at < NOW() - INTERVAL '10 minutes'),
      'last_received', (SELECT max(received_at) FROM stripe_events)),
    'payouts', jsonb_build_object(
      'pending', (SELECT count(*) FROM payouts WHERE status = 'pending'),
      'blocked', (SELECT count(*) FROM payouts WHERE status = 'blocked'),
      'failed', (SELECT count(*) FROM payouts WHERE status = 'failed'),
      'sent_last_7d', (SELECT count(*) FROM payouts WHERE status = 'sent' AND sent_at > NOW() - INTERVAL '7 days')),
    'refunds', jsonb_build_object(
      'requested', (SELECT count(*) FROM refunds WHERE status = 'requested'),
      'approved_unexecuted', (SELECT count(*) FROM refunds WHERE status = 'approved'),
      'needs_review', (SELECT count(*) FROM refunds WHERE status = 'needs_review')),
    'disputes_open', (SELECT count(*) FROM disputes WHERE status IN ('open', 'under_review', 'escalated')),
    'chargebacks_open', (SELECT count(*) FROM disputes WHERE kind = 'chargeback' AND status IN ('open', 'under_review', 'escalated')),
    'ops_alerts_open', (SELECT count(*) FROM ops_alerts WHERE resolved_at IS NULL),
    'orders_pending_payment', (SELECT count(*) FROM orders WHERE status = 'pending_payment'),
    'orders_active', (SELECT count(*) FROM orders WHERE status IN ('paid', 'in_progress', 'revision_requested', 'submitted', 'delivered')),
    'fx', (SELECT jsonb_agg(jsonb_build_object('pair', base || '/' || quote, 'rate', rate, 'age_minutes', ROUND(EXTRACT(EPOCH FROM (NOW() - fetched_at)) / 60))) FROM fx_rates),
    'ledger', (SELECT jsonb_object_agg(account, total) FROM (SELECT account, sum(amount_cents) AS total FROM ledger_entries GROUP BY account) l)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.get_ops_health() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_ops_health() TO service_role;

-- Sellers' Stripe status is refreshed at most once a minute per account.
ALTER TABLE public.seller_accounts ADD COLUMN IF NOT EXISTS status_synced_at TIMESTAMPTZ;

-- ===========================================================================
-- 3. Money self-test (rolled back by design)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.money_selftest_body(p_buyer UUID, p_seller UUID, p_product UUID, p_pricing UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_o1 UUID; v_o2 UUID; v_o3 UUID; v_o4 UUID; v_o5 UUID; v_res JSONB; v_out TEXT := ''; v_st TEXT; v_rid UUID; v_did UUID; v_n INTEGER; v_m RECORD;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::text, true);

  -- money function
  SELECT * INTO v_m FROM compute_order_money(5, 0, 0);
  v_out := concat(v_out, 'money5=', v_m.amount, '/', v_m.platform_fee, '/', v_m.seller_amount, '/', v_m.buyer_fee, '/', v_m.total_amount);
  SELECT * INTO v_m FROM compute_order_money(5, 0, 5);
  v_out := concat(v_out, ' money_free=', v_m.total_amount, '/', v_m.buyer_fee);

  -- (a) paid → buyer cancels before work → cancelled + approved full refund
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest a', '{}'::jsonb, NULL, NULL, NULL); v_o1 := (v_res->>'order_id')::uuid;
  PERFORM set_order_charge(v_o1, 'cad', 775, 68, 661, 35, 67, 1.3925);
  v_res := record_payment_succeeded(v_o1, 'pi_st_a', 'ch_st_a', 'cs_st_a', 775, 'cad', 59, 'evt_st_a');
  v_out := concat(v_out, ' | a.pay=', v_res->>'outcome', '/', v_res->>'status');
  v_res := record_payment_succeeded(v_o1, 'pi_st_a', 'ch_st_a', 'cs_st_a', 775, 'cad', 59, 'evt_st_a2');
  v_out := concat(v_out, ' replay=', v_res->>'outcome');
  v_res := get_order_actions(v_o1);
  v_out := concat(v_out, ' can_cancel=', v_res->>'can_cancel', ' mode=', v_res->>'cancel_mode');
  v_res := cancel_order(v_o1, 'selftest');
  v_out := concat(v_out, ' cancel=', v_res->>'outcome', '/', v_res->>'amount_cents');
  UPDATE refunds SET status = 'processing', stripe_refund_id = 're_st_a' WHERE order_id = v_o1;
  v_res := record_payment_refund('pi_st_a', 're_st_a', 775, 775, 'requested_by_customer', 'evt_st_a3');
  SELECT status||'/'||payment_status INTO v_st FROM orders WHERE id = v_o1;
  v_out := concat(v_out, ' refunded=', v_res->>'outcome', ' order=', v_st, ' liab=', (SELECT sum(amount_cents) FROM ledger_entries WHERE order_id = v_o1 AND account = 'seller_liability'), ' bal=', (SELECT sum(amount_cents) FROM ledger_entries WHERE order_id = v_o1 AND account = 'stripe_balance'));

  -- (b) started → cancel = request; decline; partial request; approve; partial refund
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest b', '{}'::jsonb, NULL, NULL, NULL); v_o2 := (v_res->>'order_id')::uuid;
  PERFORM set_order_charge(v_o2, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o2, 'pi_st_b', 'ch_st_b', 'cs_st_b', 775, 'cad', 59, 'evt_st_b');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::text, true);
  PERFORM update_order_as_seller(v_o2, 'in_progress', NULL, NULL, NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::text, true);
  v_res := cancel_order(v_o2, 'selftest');
  v_out := concat(v_out, ' | b.cancel=', v_res->>'outcome');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::text, true);
  SELECT id INTO v_rid FROM refunds WHERE order_id = v_o2 AND status = 'requested';
  v_res := decide_refund_request(v_rid, false, 'no');
  SELECT status INTO v_st FROM orders WHERE id = v_o2;
  v_out := concat(v_out, ' decline=', v_res->>'outcome', '/', v_st);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::text, true);
  v_res := request_order_refund(v_o2, 200, 'partial');
  v_out := concat(v_out, ' partial_req=', v_res->>'amount_cents');
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::text, true);
  SELECT id INTO v_rid FROM refunds WHERE order_id = v_o2 AND status = 'requested';
  v_res := decide_refund_request(v_rid, true, 'ok');
  UPDATE refunds SET status = 'processing', stripe_refund_id = 're_st_b' WHERE id = v_rid;
  v_res := record_payment_refund('pi_st_b', 're_st_b', 279, 775, 'requested_by_customer', 'evt_st_b2');
  SELECT status||'/'||payment_status INTO v_st FROM orders WHERE id = v_o2;
  v_out := concat(v_out, ' partial=', v_res->>'outcome', '/', v_st, ' remaining=', order_seller_share_remaining_cents(v_o2));
  BEGIN
    PERFORM issue_order_refund(v_o2, 400, 'too much');
    v_out := concat(v_out, ' overrefund=ALLOWED');
  EXCEPTION WHEN OTHERS THEN v_out := concat(v_out, ' overrefund=refused');
  END;

  -- (c) overdue → buyer unilateral cancel
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::text, true);
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest c', '{}'::jsonb, NULL, NULL, NULL); v_o3 := (v_res->>'order_id')::uuid;
  PERFORM set_order_charge(v_o3, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o3, 'pi_st_c', 'ch_st_c', 'cs_st_c', 775, 'cad', 59, 'evt_st_c');
  UPDATE orders SET status = 'in_progress', due_date = NOW() - INTERVAL '5 days' WHERE id = v_o3;
  v_res := cancel_order(v_o3, NULL);
  v_out := concat(v_out, ' | c.late_cancel=', v_res->>'outcome', '/', v_res->>'late');

  -- (d) completed → payout released → dispute → admin release_to_seller → payout sent → cancel refused
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest d', '{}'::jsonb, NULL, NULL, NULL); v_o4 := (v_res->>'order_id')::uuid;
  PERFORM set_order_charge(v_o4, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o4, 'pi_st_d', 'ch_st_d', 'cs_st_d', 775, 'cad', 59, 'evt_st_d');
  UPDATE orders SET status = 'completed', completed_at = NOW() - INTERVAL '8 days' WHERE id = v_o4;
  v_n := release_eligible_payouts();
  v_res := open_dispute(v_o4, 'quality_issue', 'selftest');
  v_did := (v_res->>'id')::uuid;
  v_out := concat(v_out, ' | d.released=', v_n, ' payout=', (SELECT status FROM payouts WHERE order_id = v_o4));
  BEGIN
    PERFORM resolve_dispute(v_did, 'release_to_seller', NULL, NULL, p_seller);
    v_out := concat(v_out, ' nonadmin=ALLOWED');
  EXCEPTION WHEN OTHERS THEN v_out := concat(v_out, ' nonadmin=refused');
  END;
  v_res := resolve_dispute(v_did, 'release_to_seller', 'selftest', NULL, (SELECT user_id FROM platform_admins LIMIT 1));
  v_out := concat(v_out, ' resolve=', v_res->>'outcome', '/', v_res->>'status', ' payout=', (SELECT status FROM payouts WHERE order_id = v_o4));
  PERFORM mark_payout_sent((SELECT id FROM payouts WHERE order_id = v_o4), 'tr_st_d', 'txn_st_d', 'acct_st');
  BEGIN
    PERFORM cancel_order(v_o4, 'x');
    v_out := concat(v_out, ' cancel_after_payout=ALLOWED');
  EXCEPTION WHEN OTHERS THEN v_out := concat(v_out, ' cancel_after_payout=refused');
  END;
  v_out := concat(v_out, ' paid_out_liab=', (SELECT sum(amount_cents) FROM ledger_entries WHERE order_id = v_o4 AND account = 'seller_liability'), ' paid=', (SELECT sum(amount_cents) FROM ledger_entries WHERE order_id = v_o4 AND account = 'seller_paid_out'));

  -- (e) chargeback lost
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest e', '{}'::jsonb, NULL, NULL, NULL); v_o5 := (v_res->>'order_id')::uuid;
  PERFORM set_order_charge(v_o5, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o5, 'pi_st_e', 'ch_st_e', 'cs_st_e', 775, 'cad', 59, 'evt_st_e');
  PERFORM record_chargeback('pi_st_e', 'dp_st_e', 'created', 'needs_response', 'fraudulent', 775, 'cad', NOW() + INTERVAL '7 days', 'evt_st_e1');
  SELECT status INTO v_st FROM orders WHERE id = v_o5;
  v_out := concat(v_out, ' | e.created=', v_st);
  PERFORM record_chargeback('pi_st_e', 'dp_st_e', 'closed', 'lost', 'fraudulent', 775, 'cad', NULL, 'evt_st_e2');
  SELECT status||'/'||payment_status INTO v_st FROM orders WHERE id = v_o5;
  v_out := concat(v_out, ' lost=', v_st);

  -- (f) expiry: stale session ignored, current session expires
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest f', '{}'::jsonb, NULL, NULL, NULL);
  UPDATE orders SET checkout_session_id = 'cs_cur' WHERE id = (v_res->>'order_id')::uuid;
  v_out := concat(v_out, ' | f.stale=', (record_checkout_expired((v_res->>'order_id')::uuid, 'cs_old', 'evt_st_f1'))->>'outcome',
                  ' current=', (record_checkout_expired((v_res->>'order_id')::uuid, 'cs_cur', 'evt_st_f2'))->>'outcome');

  -- (g) mismatch → refund leaves order awaiting payment
  v_res := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest g', '{}'::jsonb, NULL, NULL, NULL);
  PERFORM set_order_charge((v_res->>'order_id')::uuid, 'cad', 775, 68, 661, 35, 67, 1.3925);
  v_out := concat(v_out, ' | g.mismatch=', (record_payment_succeeded((v_res->>'order_id')::uuid, 'pi_st_g', 'ch_st_g', 'cs_st_g', 700, 'cad', 50, 'evt_st_g'))->>'outcome',
                  ' refund=', (record_payment_refund('pi_st_g', 're_st_g', 700, 700, 'amount_mismatch', 'evt_st_g2'))->>'outcome',
                  ' order=', (SELECT status FROM orders WHERE id = (v_res->>'order_id')::uuid));

  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.money_selftest_body(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Runs the suite and rolls every write back (the body is executed inside a
-- sub-block that always ends in an exception we catch).
CREATE OR REPLACE FUNCTION public.run_money_selftest() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_product products%ROWTYPE; v_pricing product_pricing%ROWTYPE; v_buyer UUID; v_seller UUID; v_out TEXT; v_msg TEXT;
  v_before BIGINT := (SELECT count(*) FROM orders);
BEGIN
  SELECT * INTO v_product FROM products WHERE listing_type = 'service' AND status = 'active' ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no active service listing to test with'); END IF;
  SELECT * INTO v_pricing FROM product_pricing WHERE product_id = v_product.id ORDER BY price LIMIT 1;
  v_seller := v_product.seller_id;
  SELECT user_id INTO v_buyer FROM platform_admins WHERE user_id <> v_seller LIMIT 1;
  IF v_buyer IS NULL THEN SELECT id INTO v_buyer FROM profiles WHERE id <> v_seller LIMIT 1; END IF;

  BEGIN
    v_out := money_selftest_body(v_buyer, v_seller, v_product.id, v_pricing.id);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELFTEST_ROLLBACK ' || v_out;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;

  IF v_msg LIKE 'SELFTEST_ROLLBACK %' THEN
    RETURN jsonb_build_object('ok', true, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'result', substr(v_msg, 19));
  END IF;
  RETURN jsonb_build_object('ok', false, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'error', v_msg);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_money_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_money_selftest() TO service_role;
