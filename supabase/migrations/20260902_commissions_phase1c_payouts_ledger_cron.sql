-- Commissions rebuild — Phase 1c: payout release, ledger, cron
-- (docs/commissions/02-plan.md). Decisions: D2 = 7-day hold after completion;
-- D4 = Supabase pg_cron + pg_net (no GitHub/Vercel cron); currency = USD
-- pricing/charging, platform settles in CAD for now (Stripe dashboard setting,
-- switchable to USD later with no code change); buyer fee 3.5% + $0.30.
--
-- Root causes closed: release half of RC-A2 (payout only from a verified
-- payment, through one gate), RC-A7.3 (cron on GitHub secrets), RC-A6.7
-- (currency model), RC-A8.5 (duplicate Express accounts).
--
-- 1. Settings: release window, payout batch/attempts, supported currencies,
--    buyer fee 3.5%.
-- 2. ledger_entries — append-only money log; payouts — one row per intended
--    transfer; cron_runs — job log.
-- 3. RPCs: release_eligible_payouts, claim_pending_payouts, mark_payout_sent,
--    mark_payout_failed, mark_payout_reversed, unblock_payouts_for_seller.
-- 4. record_payment_succeeded / record_payment_refund post ledger entries and
--    cancel pending payouts on full refund.
-- 5. Currency guard on orders; seller_accounts UNIQUE(user_id).
-- 6. pg_cron jobs (SQL work in-database; the Stripe transfer worker is called
--    over HTTPS via pg_net with the cron secret from Vault).
--
-- Idempotent.

-- ===========================================================================
-- 1. Settings
-- ===========================================================================
INSERT INTO public.platform_settings (key, value) VALUES
  ('release_window_hours', '168'),
  ('payout_batch_size', '25'),
  ('payout_max_attempts', '3'),
  ('supported_currencies', '["usd"]'),
  ('app_base_url', '"https://www.pinkquill.com"')
ON CONFLICT (key) DO NOTHING;

UPDATE public.platform_settings SET value = '0.035', updated_at = NOW()
WHERE key = 'buyer_fee_rate' AND value::text <> '0.035';

-- ===========================================================================
-- 2. Tables
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id BIGSERIAL PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  payout_id UUID,
  account TEXT NOT NULL CHECK (account IN (
    'stripe_balance', 'stripe_fees_expense', 'buyer_fee_revenue', 'platform_fee_revenue',
    'seller_liability', 'seller_paid_out', 'refunds'
  )),
  entry_type TEXT NOT NULL,
  amount_cents BIGINT NOT NULL,
  currency TEXT NOT NULL,
  ref_type TEXT,
  ref_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_order ON public.ledger_entries (order_id);
CREATE INDEX IF NOT EXISTS idx_ledger_account_created ON public.ledger_entries (account, created_at);
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ledger_entries FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.ledger_entries_append_only() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only';
END;
$$;
DROP TRIGGER IF EXISTS trg_ledger_append_only ON public.ledger_entries;
CREATE TRIGGER trg_ledger_append_only BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_append_only();

CREATE OR REPLACE FUNCTION public.ledger_post(
  p_order_id UUID, p_payment_id UUID, p_payout_id UUID, p_account TEXT, p_entry_type TEXT,
  p_amount_cents BIGINT, p_currency TEXT, p_ref_type TEXT DEFAULT NULL, p_ref_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id BIGINT;
BEGIN
  IF COALESCE(p_amount_cents, 0) = 0 THEN RETURN NULL; END IF;
  INSERT INTO ledger_entries (order_id, payment_id, payout_id, account, entry_type, amount_cents, currency, ref_type, ref_id, metadata)
  VALUES (p_order_id, p_payment_id, p_payout_id, p_account, p_entry_type, p_amount_cents, LOWER(p_currency), p_ref_type, p_ref_id, COALESCE(p_metadata, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.ledger_post(UUID, UUID, UUID, TEXT, TEXT, BIGINT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'blocked', 'reversed', 'cancelled')),
  block_reason TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  source_charge_id TEXT,
  destination_account_id TEXT,
  transfer_id TEXT UNIQUE,
  balance_transaction_id TEXT,
  reversed_cents INTEGER NOT NULL DEFAULT 0,
  eligible_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payouts_status_eligible ON public.payouts (status, eligible_at);
CREATE INDEX IF NOT EXISTS idx_payouts_seller ON public.payouts (seller_id, created_at DESC);
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Sellers can view own payouts" ON public.payouts;
CREATE POLICY "Sellers can view own payouts" ON public.payouts FOR SELECT TO authenticated
  USING (seller_id = (SELECT auth.uid()));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payouts FROM anon, authenticated;
GRANT SELECT ON public.payouts TO authenticated;

CREATE TABLE IF NOT EXISTS public.cron_runs (
  id BIGSERIAL PRIMARY KEY,
  job TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  ok BOOLEAN,
  result JSONB,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_cron_runs_job_started ON public.cron_runs (job, started_at DESC);
ALTER TABLE public.cron_runs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cron_runs FROM anon, authenticated;

-- One Stripe account per seller; createSellerAccount upserts on this.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'seller_accounts_user_id_key') THEN
    ALTER TABLE public.seller_accounts ADD CONSTRAINT seller_accounts_user_id_key UNIQUE (user_id);
  END IF;
END $$;
ALTER TABLE public.seller_accounts ADD COLUMN IF NOT EXISTS service_agreement TEXT;

-- ===========================================================================
-- 3. Currency guard: every order must be in a supported currency (USD today)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.enforce_supported_currency() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_supported JSONB;
BEGIN
  SELECT value INTO v_supported FROM platform_settings WHERE key = 'supported_currencies';
  IF v_supported IS NOT NULL AND NOT (v_supported ? LOWER(NEW.currency)) THEN
    RAISE EXCEPTION 'Currency % is not supported yet (supported: %)', NEW.currency, v_supported;
  END IF;
  NEW.currency := LOWER(NEW.currency);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_supported_currency ON public.orders;
CREATE TRIGGER trg_orders_supported_currency BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_supported_currency();

-- ===========================================================================
-- 4. Payout RPCs (service_role only)
-- ===========================================================================
-- Release gate. An order becomes payable only when ALL of:
--   status = completed, completed_at + release window has passed,
--   a succeeded payments row exists (money verified), payment not refunded,
--   no open dispute, no open chargeback, no payout row yet.
CREATE OR REPLACE FUNCTION public.release_eligible_payouts() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_window_hours NUMERIC := platform_setting_numeric('release_window_hours', 168);
  v_count INTEGER := 0;
  v_row RECORD;
  v_payout_id UUID;
BEGIN
  FOR v_row IN
    SELECT o.id AS order_id, o.seller_id, o.seller_amount, o.currency, p.id AS payment_id, p.charge_id
    FROM orders o
    JOIN payments p ON p.order_id = o.id AND p.status = 'succeeded' AND p.refunded_cents = 0
    WHERE o.status = 'completed'
      AND o.payment_status = 'paid'
      AND o.completed_at IS NOT NULL
      AND o.completed_at + make_interval(hours => v_window_hours::INTEGER) <= NOW()
      AND o.seller_amount > 0
      AND NOT EXISTS (SELECT 1 FROM payouts py WHERE py.order_id = o.id)
      AND NOT EXISTS (SELECT 1 FROM disputes d WHERE d.order_id = o.id AND d.status IN ('open', 'under_review', 'escalated'))
      AND NOT EXISTS (
        SELECT 1 FROM order_events e
        WHERE e.order_id = o.id AND e.event_type = 'dispute'
          AND e.metadata->>'action' LIKE 'chargeback_%'
          AND NOT EXISTS (
            SELECT 1 FROM order_events c
            WHERE c.order_id = o.id AND c.metadata->>'action' = 'chargeback_closed'
              AND c.metadata->>'dispute_status' = 'won' AND c.created_at >= e.created_at
          )
      )
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    INSERT INTO payouts (order_id, seller_id, payment_id, amount_cents, currency, source_charge_id, status, eligible_at)
    VALUES (v_row.order_id, v_row.seller_id, v_row.payment_id, ROUND(v_row.seller_amount * 100)::INTEGER,
            v_row.currency, v_row.charge_id, 'pending', NOW())
    RETURNING id INTO v_payout_id;

    INSERT INTO order_events (order_id, event_type, metadata)
    VALUES (v_row.order_id, 'payment',
      jsonb_build_object('action', 'payout_released', 'payout_id', v_payout_id,
                         'amount_cents', ROUND(v_row.seller_amount * 100)::INTEGER, 'release_window_hours', v_window_hours));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Worker claim: pending + eligible → processing, attempts + 1.
CREATE OR REPLACE FUNCTION public.claim_pending_payouts(p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.payouts
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE payouts SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
  WHERE id IN (
    SELECT id FROM payouts
    WHERE status = 'pending' AND eligible_at <= NOW()
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_sent(
  p_payout_id UUID, p_transfer_id TEXT, p_balance_transaction_id TEXT, p_destination_account_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p payouts%ROWTYPE; v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_p FROM payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_p.status = 'sent' THEN
    RETURN jsonb_build_object('outcome', 'already_sent', 'transfer_id', v_p.transfer_id);
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_p.order_id FOR UPDATE;

  UPDATE payouts SET status = 'sent', transfer_id = p_transfer_id, balance_transaction_id = p_balance_transaction_id,
    destination_account_id = p_destination_account_id, sent_at = NOW(), last_error = NULL, updated_at = NOW()
  WHERE id = p_payout_id;

  -- Compatibility with existing dashboards (retired in 4c).
  UPDATE orders SET transfer_id = p_transfer_id, transfer_status = 'completed', transfer_amount = v_p.amount_cents, updated_at = NOW()
  WHERE id = v_p.order_id;
  UPDATE transactions SET status = 'completed', stripe_transfer_id = p_transfer_id,
    metadata = metadata || jsonb_build_object('transfer_id', p_transfer_id, 'payout_id', p_payout_id)
  WHERE order_id = v_p.order_id AND type = 'seller_payout' AND status = 'pending';

  PERFORM ledger_post(v_p.order_id, v_p.payment_id, p_payout_id, 'stripe_balance', 'payout_sent', -v_p.amount_cents, v_p.currency, 'transfer', p_transfer_id);
  PERFORM ledger_post(v_p.order_id, v_p.payment_id, p_payout_id, 'seller_liability', 'payout_sent', -v_p.amount_cents, v_p.currency, 'transfer', p_transfer_id);
  PERFORM ledger_post(v_p.order_id, v_p.payment_id, p_payout_id, 'seller_paid_out', 'payout_sent', v_p.amount_cents, v_p.currency, 'transfer', p_transfer_id);

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (v_p.order_id, v_order.seller_id, 'payment',
    jsonb_build_object('action', 'seller_transfer_completed', 'payout_id', p_payout_id, 'transfer_id', p_transfer_id,
                       'transfer_amount', v_p.amount_cents, 'source', 'payout_worker'));

  PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'order_completed', v_p.order_id,
    'Your payout of ' || to_char(v_p.amount_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_p.currency) || ' is on its way to your Stripe balance.');

  RETURN jsonb_build_object('outcome', 'sent', 'payout_id', p_payout_id, 'transfer_id', p_transfer_id);
END;
$$;

-- p_block = true → 'blocked' with reason (seller not payable yet); otherwise
-- retry with backoff until payout_max_attempts, then 'failed' for review.
CREATE OR REPLACE FUNCTION public.mark_payout_failed(p_payout_id UUID, p_error TEXT, p_block BOOLEAN DEFAULT FALSE, p_block_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p payouts%ROWTYPE; v_max INTEGER := platform_setting_numeric('payout_max_attempts', 3)::INTEGER; v_status TEXT;
BEGIN
  SELECT * INTO v_p FROM payouts WHERE id = p_payout_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Payout not found'; END IF;
  IF v_p.status = 'sent' THEN RETURN jsonb_build_object('outcome', 'already_sent'); END IF;

  IF p_block THEN
    v_status := 'blocked';
  ELSIF v_p.attempts >= v_max THEN
    v_status := 'failed';
  ELSE
    v_status := 'pending';
  END IF;

  UPDATE payouts SET
    status = v_status,
    block_reason = CASE WHEN p_block THEN p_block_reason ELSE block_reason END,
    last_error = p_error,
    eligible_at = CASE WHEN v_status = 'pending' THEN NOW() + make_interval(hours => v_p.attempts) ELSE eligible_at END,
    updated_at = NOW()
  WHERE id = p_payout_id;

  -- Compatibility flag used by the seller dashboard.
  IF p_block THEN
    UPDATE orders SET transfer_status = 'pending_onboarding', updated_at = NOW() WHERE id = v_p.order_id;
  END IF;

  IF v_status = 'failed' THEN
    INSERT INTO order_events (order_id, event_type, metadata)
    VALUES (v_p.order_id, 'transfer_failed',
      jsonb_build_object('payout_id', p_payout_id, 'attempts', v_p.attempts, 'error', p_error));
  END IF;

  RETURN jsonb_build_object('outcome', v_status, 'attempts', v_p.attempts);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_payout_reversed(p_transfer_id TEXT, p_reversed_cents INTEGER, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_p payouts%ROWTYPE; v_delta INTEGER;
BEGIN
  SELECT * INTO v_p FROM payouts WHERE transfer_id = p_transfer_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'no_payout'); END IF;
  v_delta := p_reversed_cents - v_p.reversed_cents;
  IF v_delta <= 0 THEN RETURN jsonb_build_object('outcome', 'already_processed'); END IF;

  UPDATE payouts SET reversed_cents = p_reversed_cents,
    status = CASE WHEN p_reversed_cents >= amount_cents THEN 'reversed' ELSE status END,
    updated_at = NOW()
  WHERE id = v_p.id;
  UPDATE orders SET transfer_status = CASE WHEN p_reversed_cents >= v_p.amount_cents THEN 'reversed' ELSE transfer_status END, updated_at = NOW()
  WHERE id = v_p.order_id;

  PERFORM ledger_post(v_p.order_id, v_p.payment_id, v_p.id, 'stripe_balance', 'payout_reversed', v_delta, v_p.currency, 'transfer', p_transfer_id, jsonb_build_object('reason', p_reason));
  PERFORM ledger_post(v_p.order_id, v_p.payment_id, v_p.id, 'seller_paid_out', 'payout_reversed', -v_delta, v_p.currency, 'transfer', p_transfer_id, jsonb_build_object('reason', p_reason));

  INSERT INTO order_events (order_id, event_type, metadata)
  VALUES (v_p.order_id, 'payment', jsonb_build_object('action', 'transfer_reversed', 'payout_id', v_p.id,
    'transfer_id', p_transfer_id, 'reversed_cents', v_delta, 'reason', p_reason));
  RETURN jsonb_build_object('outcome', CASE WHEN p_reversed_cents >= v_p.amount_cents THEN 'reversed' ELSE 'partially_reversed' END);
END;
$$;

CREATE OR REPLACE FUNCTION public.unblock_payouts_for_seller(p_seller_id UUID) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_n INTEGER;
BEGIN
  UPDATE payouts SET status = 'pending', block_reason = NULL, eligible_at = NOW(), updated_at = NOW()
  WHERE seller_id = p_seller_id AND status = 'blocked';
  GET DIAGNOSTICS v_n = ROW_COUNT;
  UPDATE orders SET transfer_status = NULL, updated_at = NOW()
  WHERE seller_id = p_seller_id AND transfer_status = 'pending_onboarding';
  RETURN v_n;
END;
$$;

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.release_eligible_payouts()',
    'public.claim_pending_payouts(INTEGER)',
    'public.mark_payout_sent(UUID, TEXT, TEXT, TEXT)',
    'public.mark_payout_failed(UUID, TEXT, BOOLEAN, TEXT)',
    'public.mark_payout_reversed(TEXT, INTEGER, TEXT)',
    'public.unblock_payouts_for_seller(UUID)',
    'public.enforce_supported_currency()'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ===========================================================================
-- 5. Payment RPCs now post ledger entries; full refund cancels a pending payout
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.record_payment_succeeded(
  p_order_id UUID, p_payment_intent_id TEXT, p_charge_id TEXT, p_checkout_session_id TEXT,
  p_amount_cents INTEGER, p_currency TEXT, p_stripe_fee_cents INTEGER, p_event_id TEXT, p_source TEXT DEFAULT 'stripe.webhook'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_expected_cents INTEGER;
  v_existing payments%ROWTYPE;
  v_payment_id UUID;
  v_product_delivery TEXT;
  v_is_digital_product BOOLEAN;
  v_target_status TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO v_existing FROM payments WHERE payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    RETURN jsonb_build_object('outcome', 'already_processed', 'payment_id', v_existing.id,
                              'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  v_expected_cents := ROUND(v_order.total_amount * 100)::INTEGER;

  IF p_amount_cents <> v_expected_cents OR LOWER(p_currency) <> LOWER(v_order.currency) THEN
    INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                          stripe_fee_cents, net_cents, status, last_event_id, metadata)
    VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
            p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'amount_mismatch', p_event_id,
            jsonb_build_object('expected_cents', v_expected_cents, 'expected_currency', v_order.currency, 'source', p_source))
    RETURNING id INTO v_payment_id;

    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'unhonoured_payment', p_amount_cents, p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_fees_expense', 'stripe_fee', COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'stripe_fee', -COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);

    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (p_order_id, v_order.buyer_id, 'amount_mismatch',
      jsonb_build_object('charged_cents', p_amount_cents, 'expected_cents', v_expected_cents,
                         'currency', p_currency, 'payment_intent_id', p_payment_intent_id, 'stripe_event_id', p_event_id));

    PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_payment_failed', p_order_id,
      'Your payment did not match the order total and is being refunded automatically. Please try again.');

    RETURN jsonb_build_object('outcome', 'amount_mismatch', 'payment_id', v_payment_id,
                              'expected_cents', v_expected_cents, 'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                          stripe_fee_cents, net_cents, status, last_event_id, metadata)
    VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
            p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'unexpected_status', p_event_id,
            jsonb_build_object('order_status', v_order.status, 'source', p_source))
    RETURNING id INTO v_payment_id;

    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'unhonoured_payment', p_amount_cents, p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_fees_expense', 'stripe_fee', COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'stripe_fee', -COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);

    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (p_order_id, v_order.buyer_id, 'payment',
      jsonb_build_object('action', 'unexpected_payment', 'order_status', v_order.status,
                         'payment_intent_id', p_payment_intent_id, 'stripe_event_id', p_event_id));

    RETURN jsonb_build_object('outcome', 'unexpected_status', 'payment_id', v_payment_id,
                              'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  IF v_order.listing_type = 'product' THEN
    SELECT delivery_type::TEXT INTO v_product_delivery FROM products WHERE id = v_order.product_id;
    IF COALESCE(v_product_delivery, 'physical') <> 'digital' AND v_order.shipping_address IS NULL THEN
      RAISE EXCEPTION 'Shipping address is required before payment confirmation';
    END IF;
  END IF;
  v_is_digital_product := v_order.listing_type = 'product' AND v_product_delivery = 'digital';
  v_target_status := CASE WHEN v_is_digital_product THEN 'delivered' ELSE 'paid' END;

  INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                        stripe_fee_cents, net_cents, status, last_event_id, metadata)
  VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
          p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'succeeded', p_event_id,
          jsonb_build_object('source', p_source))
  RETURNING id INTO v_payment_id;

  UPDATE orders SET
    status = v_target_status,
    payment_status = 'paid',
    payment_provider = 'stripe',
    payment_reference = COALESCE(p_checkout_session_id, payment_reference),
    checkout_session_id = COALESCE(p_checkout_session_id, checkout_session_id),
    payment_intent_id = p_payment_intent_id,
    delivered_at = CASE WHEN v_is_digital_product THEN NOW() ELSE delivered_at END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO transactions (order_id, type, amount, currency, status, stripe_payment_intent_id, stripe_charge_id, metadata)
  VALUES
    (p_order_id, 'payment', v_order.total_amount, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'source', p_source, 'payment_id', v_payment_id)),
    (p_order_id, 'buyer_fee', v_order.buyer_fee, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'payment_id', v_payment_id)),
    (p_order_id, 'platform_fee', v_order.platform_fee, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'payment_id', v_payment_id)),
    (p_order_id, 'seller_payout', v_order.seller_amount, v_order.currency, 'pending', p_payment_intent_id, NULL,
     jsonb_build_object('provider', 'stripe', 'awaiting_transfer', true, 'payment_id', v_payment_id));

  -- Ledger: cash in, Stripe's cut out, and how the rest is owed/earned.
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'payment_received', p_amount_cents, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'stripe_fee', -COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_fees_expense', 'stripe_fee', COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'seller_liability', 'payment_received', ROUND(v_order.seller_amount * 100)::BIGINT, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'platform_fee_revenue', 'payment_received', ROUND(v_order.platform_fee * 100)::BIGINT, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'buyer_fee_revenue', 'payment_received', ROUND(v_order.buyer_fee * 100)::BIGINT, p_currency, 'payment_intent', p_payment_intent_id);

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_order.buyer_id, 'payment', 'pending_payment', v_target_status,
    jsonb_build_object('action', 'payment_confirmed', 'provider', 'stripe', 'payment_intent_id', p_payment_intent_id,
                       'amount_cents', p_amount_cents, 'stripe_fee_cents', p_stripe_fee_cents,
                       'stripe_event_id', p_event_id, 'source', p_source));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_order.buyer_id,
    CASE WHEN v_is_digital_product THEN 'Payment confirmed. Your digital order is now delivered.'
         ELSE 'Payment confirmed. The order is now active.' END, 'system');

  RETURN jsonb_build_object('outcome', 'paid', 'payment_id', v_payment_id,
                            'status', v_target_status, 'payment_status', 'paid');
END;
$$;

CREATE OR REPLACE FUNCTION public.record_payment_refund(
  p_payment_intent_id TEXT, p_refund_id TEXT, p_refunded_cents_total INTEGER, p_charge_cents INTEGER,
  p_reason TEXT, p_event_id TEXT, p_source TEXT DEFAULT 'stripe.webhook'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_order orders%ROWTYPE;
  v_full BOOLEAN;
  v_delta_cents INTEGER;
  v_new_status TEXT;
  v_payout payouts%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE payment_intent_id = p_payment_intent_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('outcome', 'no_payment_record');
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id FOR UPDATE;

  v_full := p_refunded_cents_total >= COALESCE(NULLIF(p_charge_cents, 0), v_payment.amount_cents);
  v_delta_cents := p_refunded_cents_total - v_payment.refunded_cents;
  IF v_delta_cents <= 0 THEN
    RETURN jsonb_build_object('outcome', 'already_processed', 'refunded_cents', v_payment.refunded_cents);
  END IF;

  UPDATE payments SET
    refunded_cents = p_refunded_cents_total,
    status = CASE
      WHEN v_payment.status IN ('amount_mismatch', 'unexpected_status') THEN v_payment.status
      WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
    last_event_id = p_event_id,
    metadata = metadata || jsonb_build_object('last_refund_id', p_refund_id, 'refund_reason', p_reason),
    updated_at = NOW()
  WHERE id = v_payment.id;

  INSERT INTO transactions (order_id, type, amount, currency, status, stripe_payment_intent_id, metadata)
  VALUES (v_order.id, 'refund', ROUND(v_delta_cents / 100.0, 2), v_order.currency, 'completed', p_payment_intent_id,
    jsonb_build_object('provider', 'stripe', 'refund_id', p_refund_id, 'reason', p_reason, 'stripe_event_id', p_event_id,
                       'source', p_source, 'refund_type', CASE WHEN v_full THEN 'full' ELSE 'partial' END));

  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'stripe_balance', 'refund', -v_delta_cents, v_order.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));
  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'refunds', 'refund', v_delta_cents, v_order.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));

  IF v_payment.status IN ('amount_mismatch', 'unexpected_status') THEN
    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (v_order.id, v_order.buyer_id, 'payment',
      jsonb_build_object('action', 'mismatched_payment_refunded', 'refund_id', p_refund_id,
                         'refunded_cents', v_delta_cents, 'stripe_event_id', p_event_id));
    RETURN jsonb_build_object('outcome', 'mismatch_refunded', 'status', v_order.status);
  END IF;

  v_new_status := CASE WHEN v_full AND v_order.status NOT IN ('cancelled', 'expired', 'declined') THEN 'refunded' ELSE v_order.status END;

  UPDATE orders SET
    payment_status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
    status = v_new_status,
    auto_completion_at = CASE WHEN v_full THEN NULL ELSE auto_completion_at END,
    updated_at = NOW()
  WHERE id = v_order.id;

  IF v_full THEN
    UPDATE transactions SET status = 'refunded'
    WHERE order_id = v_order.id AND type IN ('seller_payout') AND status = 'pending';

    -- The seller is no longer owed anything; a not-yet-sent payout is cancelled.
    SELECT * INTO v_payout FROM payouts WHERE order_id = v_order.id FOR UPDATE;
    IF FOUND AND v_payout.status IN ('pending', 'blocked', 'failed', 'processing') THEN
      UPDATE payouts SET status = 'cancelled', last_error = 'order refunded', updated_at = NOW() WHERE id = v_payout.id;
    END IF;
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'seller_liability', 'refund', -ROUND(v_order.seller_amount * 100)::BIGINT, v_order.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'platform_fee_revenue', 'refund', -ROUND(v_order.platform_fee * 100)::BIGINT, v_order.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'buyer_fee_revenue', 'refund', -ROUND(v_order.buyer_fee * 100)::BIGINT, v_order.currency, 'refund', p_refund_id);
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order.id, v_order.buyer_id, 'payment', v_order.status, v_new_status,
    jsonb_build_object('action', CASE WHEN v_full THEN 'refund' ELSE 'partial_refund' END, 'refund_id', p_refund_id,
                       'refunded_cents', v_delta_cents, 'refunded_total_cents', p_refunded_cents_total,
                       'reason', p_reason, 'stripe_event_id', p_event_id, 'source', p_source));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order.id, v_order.buyer_id,
    CASE WHEN v_full THEN 'Your payment has been refunded.' ELSE 'A partial refund has been issued for your payment.' END, 'system');

  IF NOT v_full THEN
    PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) || ' has been issued.');
    PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) || ' was processed on your order.');
  END IF;

  RETURN jsonb_build_object('outcome', CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
                            'status', v_new_status, 'refunded_cents', p_refunded_cents_total);
END;
$$;

-- ===========================================================================
-- 6. Cron: in-database jobs + HTTPS call to the payout worker
-- ===========================================================================
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_cron_job(p_job TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_run_id BIGINT;
  v_result JSONB := '{}'::jsonb;
  v_base_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  INSERT INTO cron_runs (job) VALUES (p_job) RETURNING id INTO v_run_id;
  BEGIN
    IF p_job = 'auto_decline' THEN
      v_result := jsonb_build_object('declined', auto_decline_expired_orders());
      DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
    ELSIF p_job = 'hourly' THEN
      v_result := jsonb_build_object('auto_completed', auto_complete_orders());
      PERFORM reveal_due_reviews();
      v_result := v_result || jsonb_build_object('payouts_released', release_eligible_payouts());
    ELSIF p_job = 'payout_worker' THEN
      IF NOT EXISTS (SELECT 1 FROM payouts WHERE status = 'pending' AND eligible_at <= NOW()) THEN
        v_result := jsonb_build_object('skipped', 'no pending payouts');
      ELSE
        SELECT value #>> '{}' INTO v_base_url FROM platform_settings WHERE key = 'app_base_url';
        SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
        IF v_base_url IS NULL OR v_secret IS NULL THEN
          RAISE EXCEPTION 'app_base_url setting or cron_secret vault entry missing';
        END IF;
        SELECT net.http_post(
          url := v_base_url || '/api/payouts/run',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
          body := jsonb_build_object('source', 'pg_cron', 'run_id', v_run_id),
          timeout_milliseconds := 60000
        ) INTO v_request_id;
        v_result := jsonb_build_object('http_request_id', v_request_id);
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown cron job %', p_job;
    END IF;
    UPDATE cron_runs SET finished_at = NOW(), ok = TRUE, result = v_result WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE cron_runs SET finished_at = NOW(), ok = FALSE, error = SQLERRM WHERE id = v_run_id;
  END;
  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_cron_job(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_cron_job(TEXT) TO service_role;

DO $$
DECLARE j RECORD;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN ('marketplace-auto-decline', 'marketplace-hourly', 'marketplace-payout-worker') LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
  PERFORM cron.schedule('marketplace-auto-decline', '*/10 * * * *', $c$SELECT public.run_cron_job('auto_decline')$c$);
  PERFORM cron.schedule('marketplace-hourly', '5 * * * *', $c$SELECT public.run_cron_job('hourly')$c$);
  PERFORM cron.schedule('marketplace-payout-worker', '*/15 * * * *', $c$SELECT public.run_cron_job('payout_worker')$c$);
END $$;
