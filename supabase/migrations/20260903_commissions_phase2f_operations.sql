-- Phase 2f — Operations (2026-09-03)
-- Admin console RPCs. All are service_role-only and take the acting admin's
-- id, which is verified against platform_admins inside (the API routes verify
-- the session first). Every action writes an audit row into ops_alerts
-- (kind 'admin_action', severity 'info', resolved on insert) so the console's
-- history shows who did what. The money workers (refund executor, payout
-- worker, webhooks) are untouched: "retry" only puts a row back into the
-- state those workers pick up. Idempotent.

-- ===========================================================================
-- 1. Audit
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_log(p_admin_id UUID, p_action TEXT, p_context JSONB DEFAULT '{}'::jsonb, p_order_id UUID DEFAULT NULL)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id BIGINT;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  INSERT INTO ops_alerts (kind, severity, message, context, order_id, resolved_at, resolved_by)
  VALUES ('admin_action', 'info', p_action, COALESCE(p_context, '{}'::jsonb) || jsonb_build_object('admin_id', p_admin_id), p_order_id, NOW(), p_admin_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_alert(p_alert_id BIGINT, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  UPDATE ops_alerts SET resolved_at = NOW(), resolved_by = p_admin_id WHERE id = p_alert_id AND resolved_at IS NULL;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'already_resolved'); END IF;
  RETURN jsonb_build_object('outcome', 'resolved');
END;
$$;

-- ===========================================================================
-- 2. Payouts: retry a failed/blocked payout, unblock a seller
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_retry_payout(p_payout_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p payouts%ROWTYPE;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  SELECT * INTO v_p FROM payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_p.status NOT IN ('failed', 'blocked') THEN RAISE EXCEPTION 'Only failed or held payouts can be retried (this one is %)', v_p.status; END IF;
  IF v_p.block_reason = 'dispute_open' AND EXISTS (SELECT 1 FROM disputes d WHERE d.order_id = v_p.order_id AND d.status IN ('open', 'under_review', 'escalated')) THEN
    RAISE EXCEPTION 'A dispute is still open on this order; resolve it first';
  END IF;
  UPDATE payouts SET status = 'pending', attempts = 0, last_error = NULL, block_reason = NULL, eligible_at = NOW(), updated_at = NOW() WHERE id = p_payout_id;
  UPDATE orders SET transfer_status = NULL, updated_at = NOW() WHERE id = v_p.order_id AND transfer_status = 'pending_onboarding';
  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (v_p.order_id, p_admin_id, 'system', jsonb_build_object('action', 'payout_retried', 'payout_id', p_payout_id, 'was', v_p.status, 'message', 'Payout queued again by Pinkquill'));
  PERFORM admin_log(p_admin_id, 'payout_retried', jsonb_build_object('payout_id', p_payout_id, 'was', v_p.status, 'last_error', v_p.last_error), v_p.order_id);
  RETURN jsonb_build_object('outcome', 'pending', 'payout_id', p_payout_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unblock_seller_payouts(p_seller_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_n INTEGER;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  v_n := unblock_payouts_for_seller(p_seller_id);
  PERFORM admin_log(p_admin_id, 'seller_payouts_unblocked', jsonb_build_object('seller_id', p_seller_id, 'count', v_n));
  RETURN jsonb_build_object('outcome', 'unblocked', 'count', v_n);
END;
$$;

-- ===========================================================================
-- 3. Refunds needing review: retry (back to the executor) or cancel
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_retry_refund(p_refund_id UUID, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r refunds%ROWTYPE;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  SELECT * INTO v_r FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status NOT IN ('needs_review', 'failed') THEN RAISE EXCEPTION 'Only refunds needing review can be retried (this one is %)', v_r.status; END IF;
  UPDATE refunds SET status = 'approved', attempts = 0, last_error = NULL, updated_at = NOW() WHERE id = p_refund_id;
  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (v_r.order_id, p_admin_id, 'system', jsonb_build_object('action', 'refund_retried', 'refund_id', p_refund_id, 'message', 'Refund queued again by Pinkquill'));
  PERFORM admin_log(p_admin_id, 'refund_retried', jsonb_build_object('refund_id', p_refund_id, 'was', v_r.status, 'last_error', v_r.last_error), v_r.order_id);
  RETURN jsonb_build_object('outcome', 'approved', 'refund_id', p_refund_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_cancel_refund(p_refund_id UUID, p_admin_id UUID, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r refunds%ROWTYPE; v_o orders%ROWTYPE; v_restore TEXT;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  SELECT * INTO v_r FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  IF v_r.status NOT IN ('needs_review', 'failed', 'approved') THEN RAISE EXCEPTION 'Only unexecuted refunds can be cancelled (this one is %)', v_r.status; END IF;
  SELECT * INTO v_o FROM orders WHERE id = v_r.order_id FOR UPDATE;
  UPDATE refunds SET status = 'cancelled', note = COALESCE(p_note, note), decided_by = p_admin_id, decided_at = NOW(), updated_at = NOW() WHERE id = p_refund_id;
  -- A full refund that cancelled the order but never moved money: the order continues from where it was.
  IF v_r.kind = 'full' AND v_o.status = 'cancelled' AND v_o.payment_status = 'paid' AND v_r.previous_status IS NOT NULL THEN
    v_restore := v_r.previous_status;
    UPDATE orders SET status = v_restore, cancelled_by = NULL, cancel_reason = NULL, updated_at = NOW() WHERE id = v_o.id;
    INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
    VALUES (v_o.id, p_admin_id, 'status_change', 'cancelled', v_restore, jsonb_build_object('action', 'refund_cancelled', 'refund_id', p_refund_id, 'note', p_note));
  ELSE
    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (v_o.id, p_admin_id, 'system', jsonb_build_object('action', 'refund_cancelled', 'refund_id', p_refund_id, 'note', p_note, 'message', 'A pending refund was cancelled by Pinkquill'));
  END IF;
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_o.id, p_admin_id, 'Pinkquill cancelled a pending refund' || COALESCE(': ' || p_note, '.') || CASE WHEN v_restore IS NOT NULL THEN ' The order continues.' ELSE '' END, 'system');
  PERFORM admin_log(p_admin_id, 'refund_cancelled', jsonb_build_object('refund_id', p_refund_id, 'was', v_r.status, 'note', p_note, 'order_restored_to', v_restore), v_o.id);
  RETURN jsonb_build_object('outcome', 'cancelled', 'refund_id', p_refund_id, 'order_status', COALESCE(v_restore, v_o.status));
END;
$$;

-- ===========================================================================
-- 4. Platform settings editor (allow-listed keys, validated)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_update_setting(p_key TEXT, p_value JSONB, p_admin_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_old JSONB; v_num NUMERIC; v_txt TEXT;
BEGIN
  IF p_admin_id IS NULL OR NOT is_platform_admin(p_admin_id) THEN RAISE EXCEPTION 'Only a platform admin can do this'; END IF;
  SELECT value INTO v_old FROM platform_settings WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'Unknown setting %', p_key; END IF;

  CASE p_key
    WHEN 'platform_fee_rate', 'buyer_fee_rate', 'fx_buffer_rate' THEN
      IF jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION '% must be a number', p_key; END IF;
      v_num := (p_value #>> '{}')::NUMERIC;
      IF v_num < 0 OR v_num > 0.3 THEN RAISE EXCEPTION '% must be between 0 and 0.3 (a rate, not a percent)', p_key; END IF;
    WHEN 'buyer_fee_fixed', 'min_service_price' THEN
      IF jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION '% must be a number', p_key; END IF;
      v_num := (p_value #>> '{}')::NUMERIC;
      IF v_num < 0 OR v_num > 100 THEN RAISE EXCEPTION '% must be between 0 and 100', p_key; END IF;
    WHEN 'release_window_hours' THEN
      IF jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION '% must be a number', p_key; END IF;
      v_num := (p_value #>> '{}')::NUMERIC;
      IF v_num < 0 OR v_num > 720 THEN RAISE EXCEPTION 'release_window_hours must be between 0 and 720'; END IF;
    WHEN 'payout_batch_size', 'payout_max_attempts', 'fx_max_age_hours' THEN
      IF jsonb_typeof(p_value) <> 'number' THEN RAISE EXCEPTION '% must be a number', p_key; END IF;
      v_num := (p_value #>> '{}')::NUMERIC;
      IF v_num < 1 OR v_num > 100 OR v_num <> floor(v_num) THEN RAISE EXCEPTION '% must be a whole number between 1 and 100', p_key; END IF;
    WHEN 'settlement_currency' THEN
      v_txt := lower(p_value #>> '{}');
      IF jsonb_typeof(p_value) <> 'string' OR v_txt NOT IN ('cad', 'usd') THEN RAISE EXCEPTION 'settlement_currency must be "cad" or "usd"'; END IF;
      p_value := to_jsonb(v_txt);
    WHEN 'app_base_url' THEN
      v_txt := p_value #>> '{}';
      IF jsonb_typeof(p_value) <> 'string' OR v_txt !~ '^https://[a-z0-9.-]+$' THEN RAISE EXCEPTION 'app_base_url must be an https origin without a trailing slash'; END IF;
    WHEN 'fx_source' THEN
      IF jsonb_typeof(p_value) <> 'string' OR (p_value #>> '{}') NOT IN ('frankfurter') THEN RAISE EXCEPTION 'fx_source must be "frankfurter"'; END IF;
    WHEN 'supported_currencies' THEN
      IF jsonb_typeof(p_value) <> 'array' OR jsonb_array_length(p_value) = 0 THEN RAISE EXCEPTION 'supported_currencies must be a non-empty list'; END IF;
      IF EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_value) c WHERE c !~ '^[a-z]{3}$') THEN RAISE EXCEPTION 'currencies are three lowercase letters'; END IF;
    ELSE
      RAISE EXCEPTION 'Setting % cannot be edited from the console', p_key;
  END CASE;

  UPDATE platform_settings SET value = p_value, updated_at = NOW() WHERE key = p_key;
  PERFORM admin_log(p_admin_id, 'setting_changed', jsonb_build_object('key', p_key, 'from', v_old, 'to', p_value));
  RETURN jsonb_build_object('outcome', 'updated', 'key', p_key, 'from', v_old, 'to', p_value);
END;
$$;

-- ===========================================================================
-- 5. Orders search (one query across number, listing, buyer, seller, payment id)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_search_orders(p_q TEXT DEFAULT NULL, p_status TEXT DEFAULT NULL, p_limit INTEGER DEFAULT 50)
RETURNS JSONB
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_agg(r), '[]'::jsonb) FROM (
    SELECT o.id, o.order_number, o.status, o.payment_status, o.listing_type, o.amount, o.total_amount, o.seller_amount, o.currency,
      o.created_at, o.due_date, o.completed_at, o.payment_intent_id,
      p.title, b.username AS buyer, b.display_name AS buyer_name, s.username AS seller, s.display_name AS seller_name,
      (SELECT status FROM payouts py WHERE py.order_id = o.id) AS payout_status,
      (SELECT count(*) FROM refunds r WHERE r.order_id = o.id AND r.status IN ('requested', 'approved', 'processing', 'needs_review')) AS open_refunds,
      (SELECT count(*) FROM disputes d WHERE d.order_id = o.id AND d.status IN ('open', 'under_review', 'escalated')) AS open_disputes
    FROM orders o
    LEFT JOIN products p ON p.id = o.product_id
    LEFT JOIN profiles b ON b.id = o.buyer_id
    LEFT JOIN profiles s ON s.id = o.seller_id
    WHERE (p_status IS NULL OR p_status = '' OR o.status = p_status)
      AND (p_q IS NULL OR trim(p_q) = ''
        OR o.order_number ILIKE '%' || trim(p_q) || '%'
        OR p.title ILIKE '%' || trim(p_q) || '%'
        OR b.username ILIKE '%' || trim(p_q) || '%' OR b.display_name ILIKE '%' || trim(p_q) || '%'
        OR s.username ILIKE '%' || trim(p_q) || '%' OR s.display_name ILIKE '%' || trim(p_q) || '%'
        OR o.payment_intent_id = trim(p_q) OR o.checkout_session_id = trim(p_q) OR o.id::text = trim(p_q))
    ORDER BY o.created_at DESC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200)
  ) r;
$$;

-- ===========================================================================
-- 6. Grants (service role only; routes verify the admin session first)
-- ===========================================================================
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.admin_log(UUID, TEXT, JSONB, UUID)', 'public.admin_resolve_alert(BIGINT, UUID)',
    'public.admin_retry_payout(UUID, UUID)', 'public.admin_unblock_seller_payouts(UUID, UUID)',
    'public.admin_retry_refund(UUID, UUID)', 'public.admin_cancel_refund(UUID, UUID, TEXT)',
    'public.admin_update_setting(TEXT, JSONB, UUID)', 'public.admin_search_orders(TEXT, TEXT, INTEGER)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ===========================================================================
-- 7. Self-test (service role; always rolls back)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.admin_selftest_body(p_buyer UUID, p_seller UUID, p_product UUID, p_pricing UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_out TEXT := ''; v_r JSONB; v_o UUID; v_o2 UUID; v_admin UUID; v_pid UUID; v_rid UUID; v_n INTEGER; v_st TEXT;
BEGIN
  PERFORM set_config('pinkquill.selftest', 'on', TRUE);
  SELECT user_id INTO v_admin FROM platform_admins LIMIT 1;
  IF EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_seller) THEN
    UPDATE seller_profiles SET is_accepting_commissions = TRUE, require_approval = FALSE WHERE user_id = p_seller;
  ELSE
    INSERT INTO seller_profiles (user_id, store_name, is_accepting_commissions, require_approval, setup_completed) VALUES (p_seller, 'selftest', TRUE, FALSE, TRUE);
  END IF;
  UPDATE commission_listings SET availability = 'open', slots_total = NULL WHERE product_id = p_product;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);

  -- (a) a completed order whose payout failed → admin retry puts it back in the queue
  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'admin selftest a', '{"answers": []}'::jsonb); v_o := (v_r->>'order_id')::UUID;
  PERFORM set_order_charge(v_o, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o, 'pi_adm_a', 'ch_adm_a', 'cs_adm_a', 775, 'cad', 59, 'evt_adm_a');
  UPDATE orders SET status = 'completed', completed_at = NOW() - INTERVAL '8 days' WHERE id = v_o;
  v_n := release_eligible_payouts();
  SELECT id INTO v_pid FROM payouts WHERE order_id = v_o;
  UPDATE payouts SET status = 'failed', attempts = 3, last_error = 'selftest failure' WHERE id = v_pid;
  BEGIN
    PERFORM admin_retry_payout(v_pid, p_seller); v_out := v_out || 'a.nonadmin=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'a.nonadmin=refused';
  END;
  v_r := admin_retry_payout(v_pid, v_admin);
  SELECT status || '/' || attempts INTO v_st FROM payouts WHERE id = v_pid;
  v_out := v_out || ' retry=' || (v_r->>'outcome') || ' payout=' || v_st;
  BEGIN
    PERFORM admin_retry_payout(v_pid, v_admin); v_out := v_out || ' twice=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' twice=refused';
  END;

  -- (b) a refund stuck in review → retry → approved; a second one cancelled restores the order
  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'admin selftest b', '{"answers": []}'::jsonb); v_o2 := (v_r->>'order_id')::UUID;
  PERFORM set_order_charge(v_o2, 'cad', 775, 68, 661, 35, 67, 1.3925);
  PERFORM record_payment_succeeded(v_o2, 'pi_adm_b', 'ch_adm_b', 'cs_adm_b', 775, 'cad', 59, 'evt_adm_b');
  v_r := cancel_order(v_o2, 'selftest');
  SELECT id INTO v_rid FROM refunds WHERE order_id = v_o2 AND status = 'approved';
  PERFORM mark_refund_needs_review(v_rid, 'selftest stripe error', FALSE);
  SELECT status INTO v_st FROM refunds WHERE id = v_rid;
  v_out := v_out || ' | b.review=' || v_st;
  v_r := admin_retry_refund(v_rid, v_admin);
  SELECT status || '/' || attempts INTO v_st FROM refunds WHERE id = v_rid;
  v_out := v_out || ' retry=' || v_st;
  PERFORM mark_refund_needs_review(v_rid, 'selftest again', FALSE);
  v_r := admin_cancel_refund(v_rid, v_admin, 'card already refunded elsewhere');
  SELECT status INTO v_st FROM orders WHERE id = v_o2;
  v_out := v_out || ' cancel=' || (v_r->>'outcome') || ' order=' || v_st;

  -- (c) settings: bad values refused, good value applied
  BEGIN
    PERFORM admin_update_setting('platform_fee_rate', '5'::jsonb, v_admin); v_out := v_out || ' | c.bad_rate=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' | c.bad_rate=refused';
  END;
  BEGIN
    PERFORM admin_update_setting('nonexistent', '1'::jsonb, v_admin); v_out := v_out || ' unknown=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' unknown=refused';
  END;
  v_r := admin_update_setting('release_window_hours', '72'::jsonb, v_admin);
  v_out := v_out || ' set=' || (v_r->>'outcome') || '/' || platform_setting_numeric('release_window_hours', 0);

  -- (d) search finds the order by number and by buyer; audit rows exist
  v_r := admin_search_orders((SELECT order_number FROM orders WHERE id = v_o), NULL, 10);
  v_out := v_out || ' | d.by_number=' || jsonb_array_length(v_r);
  v_r := admin_search_orders((SELECT username FROM profiles WHERE id = p_seller), 'completed', 10);
  v_out := v_out || ' by_seller_status=' || (jsonb_array_length(v_r) >= 1);
  SELECT count(*) INTO v_n FROM ops_alerts WHERE kind = 'admin_action' AND context->>'admin_id' = v_admin::text AND created_at > NOW() - INTERVAL '1 minute';
  v_out := v_out || ' audit=' || v_n;
  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.admin_selftest_body(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_admin_selftest() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
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
    v_out := admin_selftest_body(v_buyer, v_seller, v_product.id, v_pricing.id);
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
REVOKE EXECUTE ON FUNCTION public.run_admin_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_admin_selftest() TO service_role;
