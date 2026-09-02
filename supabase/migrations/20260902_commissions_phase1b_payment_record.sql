-- Commissions rebuild — Phase 1b: verified payment record + full webhook
-- (docs/commissions/02-plan.md). Decision D3 = (b): seller pays the platform
-- fee (5% of goods/service amount), buyer pays a visible processing fee
-- (3% + $0.30) on top of the order amount.
--
-- Root causes closed: RC-A4 (webhook happy-path only), record half of RC-A2
-- (money moves on a status column, not a verified payment), RC-A6.4 (fee math
-- in three places).
--
-- 1. platform_settings + compute_order_money(): the one fee function.
-- 2. orders.buyer_fee / total_amount; create/apply/remove promo use the fee fn.
-- 3. payments: one row per PaymentIntent, written only by webhook RPCs.
-- 4. stripe_events: durable per-event claim with outcome + retry.
-- 5. RPCs: claim_stripe_event, finish_stripe_event, record_payment_succeeded,
--    record_payment_failed, record_checkout_expired, record_payment_refund.
-- 6. seller_accounts requirement columns for account.updated.
-- 7. finalize_order_payment (free orders only) also writes a payments row.
--
-- Idempotent.

-- ===========================================================================
-- 1. Platform settings + fee function
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.platform_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_settings FROM anon, authenticated;

INSERT INTO public.platform_settings (key, value) VALUES
  ('platform_fee_rate', '0.05'),
  ('buyer_fee_rate', '0.03'),
  ('buyer_fee_fixed', '0.30'),
  ('min_service_price', '5.00')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.platform_setting_numeric(p_key TEXT, p_default NUMERIC)
RETURNS NUMERIC
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COALESCE((SELECT (value #>> '{}')::NUMERIC FROM public.platform_settings WHERE key = p_key), p_default);
$$;
REVOKE EXECUTE ON FUNCTION public.platform_setting_numeric(TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.platform_setting_numeric(TEXT, NUMERIC) TO service_role;

-- amount        = goods/service + shipping − discount (what the seller's side is based on)
-- platform_fee  = rate × (amount − shipping)            (deducted from the seller)
-- seller_amount = amount − platform_fee
-- buyer_fee     = rate × amount + fixed, 0 when amount = 0 (paid by the buyer on top)
-- total_amount  = amount + buyer_fee                     (what Stripe charges)
CREATE OR REPLACE FUNCTION public.compute_order_money(
  p_item_amount NUMERIC, p_shipping NUMERIC DEFAULT 0, p_discount NUMERIC DEFAULT 0
) RETURNS TABLE (
  amount NUMERIC, platform_fee NUMERIC, seller_amount NUMERIC, buyer_fee NUMERIC, total_amount NUMERIC
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_rate NUMERIC := platform_setting_numeric('platform_fee_rate', 0.05);
  v_buyer_rate NUMERIC := platform_setting_numeric('buyer_fee_rate', 0.03);
  v_buyer_fixed NUMERIC := platform_setting_numeric('buyer_fee_fixed', 0.30);
  v_shipping NUMERIC := COALESCE(p_shipping, 0);
  v_amount NUMERIC;
  v_fee_base NUMERIC;
BEGIN
  v_amount := GREATEST(ROUND((COALESCE(p_item_amount, 0) + v_shipping - COALESCE(p_discount, 0))::NUMERIC, 2), 0);
  v_fee_base := GREATEST(v_amount - v_shipping, 0);
  amount := v_amount;
  platform_fee := ROUND((v_fee_base * v_rate)::NUMERIC, 2);
  seller_amount := ROUND((v_amount - platform_fee)::NUMERIC, 2);
  buyer_fee := CASE WHEN v_amount <= 0 THEN 0 ELSE ROUND((v_amount * v_buyer_rate + v_buyer_fixed)::NUMERIC, 2) END;
  total_amount := ROUND((v_amount + buyer_fee)::NUMERIC, 2);
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.compute_order_money(NUMERIC, NUMERIC, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.compute_order_money(NUMERIC, NUMERIC, NUMERIC) TO authenticated, service_role;

-- ===========================================================================
-- 2. orders.buyer_fee / total_amount; payment_intent_id index exists (1a)
-- ===========================================================================
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS buyer_fee NUMERIC(10,2) NOT NULL DEFAULT 0;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='orders' AND column_name='total_amount') THEN
    ALTER TABLE public.orders ADD COLUMN total_amount NUMERIC(10,2) GENERATED ALWAYS AS (amount + buyer_fee) STORED;
  END IF;
END $$;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (type = ANY (ARRAY[
  'payment', 'buyer_fee', 'platform_fee', 'seller_payout', 'refund'
]));

DO $$
DECLARE v_def TEXT; v_types TEXT[];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';
  IF v_def IS NOT NULL AND v_def NOT LIKE '%order_payment_failed%' THEN
    SELECT array_agg(m[1]) INTO v_types FROM regexp_matches(v_def, '''([a-z_]+)''::text', 'g') AS m;
    v_types := v_types || ARRAY['order_payment_failed'];
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[%s]::text[]))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_types) AS t));
  END IF;
END $$;

-- ===========================================================================
-- 3. payments — one row per PaymentIntent, webhook-written
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'stripe',
  payment_intent_id TEXT UNIQUE,
  charge_id TEXT,
  checkout_session_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  stripe_fee_cents INTEGER,
  net_cents INTEGER,
  refunded_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('succeeded', 'amount_mismatch', 'unexpected_status', 'refunded', 'partially_refunded', 'failed')),
  last_event_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments (order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments (status);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order participants can view payments" ON public.payments;
CREATE POLICY "Order participants can view payments" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = payments.order_id
          AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid())))
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.payments FROM anon, authenticated;
GRANT SELECT ON public.payments TO authenticated;

-- ===========================================================================
-- 4. stripe_events — durable claim + outcome
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  order_id UUID,
  status TEXT NOT NULL CHECK (status IN ('processing', 'processed', 'failed', 'ignored')),
  attempts INTEGER NOT NULL DEFAULT 1,
  error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON public.stripe_events (status, received_at);
CREATE INDEX IF NOT EXISTS idx_stripe_events_order ON public.stripe_events (order_id) WHERE order_id IS NOT NULL;
ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM anon, authenticated;

-- 'claimed'  → process it; 'duplicate' → already processed / being processed.
CREATE OR REPLACE FUNCTION public.claim_stripe_event(p_event_id TEXT, p_event_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_row stripe_events%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM stripe_events WHERE event_id = p_event_id FOR UPDATE;
  IF NOT FOUND THEN
    INSERT INTO stripe_events (event_id, event_type, status) VALUES (p_event_id, p_event_type, 'processing');
    RETURN 'claimed';
  END IF;
  IF v_row.status IN ('processed', 'ignored') THEN
    RETURN 'duplicate';
  END IF;
  -- 'processing' for less than 5 minutes: another delivery is on it.
  IF v_row.status = 'processing' AND v_row.received_at > NOW() - INTERVAL '5 minutes' THEN
    RETURN 'duplicate';
  END IF;
  UPDATE stripe_events SET status = 'processing', attempts = attempts + 1, received_at = NOW(), error = NULL
  WHERE event_id = p_event_id;
  RETURN 'claimed';
END;
$$;

CREATE OR REPLACE FUNCTION public.finish_stripe_event(p_event_id TEXT, p_status TEXT, p_error TEXT DEFAULT NULL, p_order_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$
  UPDATE stripe_events
  SET status = p_status, error = p_error, order_id = COALESCE(p_order_id, order_id),
      processed_at = CASE WHEN p_status IN ('processed', 'ignored') THEN NOW() ELSE processed_at END
  WHERE event_id = p_event_id;
$$;
REVOKE EXECUTE ON FUNCTION public.claim_stripe_event(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finish_stripe_event(TEXT, TEXT, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_stripe_event(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.finish_stripe_event(TEXT, TEXT, TEXT, UUID) TO service_role;

-- ===========================================================================
-- 5. Payment RPCs (service_role only; every side effect lives here)
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

  -- Wrong amount or currency: keep the money record, do not activate the order.
  -- The webhook refunds the PaymentIntent and calls record_payment_refund.
  IF p_amount_cents <> v_expected_cents OR LOWER(p_currency) <> LOWER(v_order.currency) THEN
    INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                          stripe_fee_cents, net_cents, status, last_event_id, metadata)
    VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
            p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'amount_mismatch', p_event_id,
            jsonb_build_object('expected_cents', v_expected_cents, 'expected_currency', v_order.currency, 'source', p_source))
    RETURNING id INTO v_payment_id;

    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (p_order_id, v_order.buyer_id, 'amount_mismatch',
      jsonb_build_object('charged_cents', p_amount_cents, 'expected_cents', v_expected_cents,
                         'currency', p_currency, 'payment_intent_id', p_payment_intent_id, 'stripe_event_id', p_event_id));

    PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_payment_failed', p_order_id,
      'Your payment did not match the order total and is being refunded automatically. Please try again.');

    RETURN jsonb_build_object('outcome', 'amount_mismatch', 'payment_id', v_payment_id,
                              'expected_cents', v_expected_cents, 'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  -- Money arrived for an order that is not awaiting payment (e.g. a second
  -- session paid twice). Record it; the webhook refunds it.
  IF v_order.status <> 'pending_payment' THEN
    INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                          stripe_fee_cents, net_cents, status, last_event_id, metadata)
    VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
            p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'unexpected_status', p_event_id,
            jsonb_build_object('order_status', v_order.status, 'source', p_source))
    RETURNING id INTO v_payment_id;

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
  -- Only digital PRODUCTS are delivered at payment. Commissions always start at 'paid'.
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

CREATE OR REPLACE FUNCTION public.record_payment_failed(
  p_order_id UUID, p_payment_intent_id TEXT, p_code TEXT, p_message TEXT, p_event_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('outcome', 'ignored', 'status', v_order.status);
  END IF;

  UPDATE orders SET
    payment_status = 'failed',
    last_payment_error = jsonb_build_object('code', p_code, 'message', p_message,
                                            'payment_intent_id', p_payment_intent_id, 'at', NOW(), 'stripe_event_id', p_event_id),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (p_order_id, v_order.buyer_id, 'payment',
    jsonb_build_object('action', 'payment_failed', 'code', p_code, 'message', p_message,
                       'payment_intent_id', p_payment_intent_id, 'stripe_event_id', p_event_id));

  PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_payment_failed', p_order_id,
    'Your payment was declined' || COALESCE(': ' || rtrim(p_message, '.'), '') || '. You can try again from your order.');

  RETURN jsonb_build_object('outcome', 'failed', 'status', v_order.status, 'payment_status', 'failed');
END;
$$;

-- Expire the order only when the expired session is the order's CURRENT session;
-- a stale earlier session must not kill an order with a newer open one.
CREATE OR REPLACE FUNCTION public.record_checkout_expired(p_order_id UUID, p_checkout_session_id TEXT, p_event_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('outcome', 'ignored', 'reason', 'not_pending', 'status', v_order.status);
  END IF;
  IF v_order.checkout_session_id IS NOT NULL AND v_order.checkout_session_id <> p_checkout_session_id THEN
    RETURN jsonb_build_object('outcome', 'ignored', 'reason', 'stale_session', 'status', v_order.status);
  END IF;

  UPDATE orders SET status = 'expired', payment_status = 'expired', updated_at = NOW() WHERE id = p_order_id;

  INSERT INTO order_events (order_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, 'payment', 'pending_payment', 'expired',
    jsonb_build_object('action', 'checkout_expired', 'checkout_session_id', p_checkout_session_id, 'stripe_event_id', p_event_id));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_order.buyer_id, 'Checkout expired before payment was completed.', 'system');

  RETURN jsonb_build_object('outcome', 'expired', 'status', 'expired', 'payment_status', 'expired');
END;
$$;

-- Refund recorded from Stripe (charge.refunded) or issued by the webhook for a
-- mismatched / unexpected payment. Amount-level effects only; seller payout
-- reversal is the caller's job (1d).
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

  -- A refund of a mismatched/unexpected payment leaves the order where it was
  -- (still awaiting the right payment, or already active on another payment).
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
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order.id, v_order.buyer_id, 'payment', v_order.status, v_new_status,
    jsonb_build_object('action', CASE WHEN v_full THEN 'refund' ELSE 'partial_refund' END, 'refund_id', p_refund_id,
                       'refunded_cents', v_delta_cents, 'refunded_total_cents', p_refunded_cents_total,
                       'reason', p_reason, 'stripe_event_id', p_event_id, 'source', p_source));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order.id, v_order.buyer_id,
    CASE WHEN v_full THEN 'Your payment has been refunded.' ELSE 'A partial refund has been issued for your payment.' END, 'system');

  -- Full refunds notify via the status trigger (→ refunded). Partial ones don't change status.
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

DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.record_payment_succeeded(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT, INTEGER, TEXT, TEXT)',
    'public.record_payment_failed(UUID, TEXT, TEXT, TEXT, TEXT)',
    'public.record_checkout_expired(UUID, TEXT, TEXT)',
    'public.record_payment_refund(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ===========================================================================
-- 6. seller_accounts: requirement state from account.updated
-- ===========================================================================
ALTER TABLE public.seller_accounts
  ADD COLUMN IF NOT EXISTS requirements_currently_due TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS disabled_reason TEXT,
  ADD COLUMN IF NOT EXISTS requirements_synced_at TIMESTAMPTZ;

-- ===========================================================================
-- 7. Order creation + promo use the fee function; free-order finalize writes payments
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_buyer_id UUID, p_product_id UUID, p_pricing_id UUID, p_requested_quantity INTEGER DEFAULT 1,
  p_brief TEXT DEFAULT NULL, p_requirements JSONB DEFAULT '{}'::jsonb, p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_shipping_address JSONB DEFAULT NULL, p_chosen_amount NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_pricing product_pricing%ROWTYPE;
  v_listing_type TEXT;
  v_quantity INTEGER;
  v_unit_price NUMERIC(10,2);
  v_item_amount NUMERIC(10,2);
  v_shipping_cost NUMERIC(10,2) := 0;
  v_money RECORD;
  v_currency TEXT;
  v_due_date TIMESTAMPTZ;
  v_order_id UUID;
  v_require_approval BOOLEAN := FALSE;
  v_auto_decline_hours INTEGER := 72;
  v_requires_seller_approval BOOLEAN := FALSE;
  v_initial_status TEXT := 'pending_payment';
  v_is_pwyw BOOLEAN;
BEGIN
  IF p_buyer_id IS NULL THEN RAISE EXCEPTION 'Buyer is required'; END IF;
  IF p_product_id IS NULL OR p_pricing_id IS NULL THEN RAISE EXCEPTION 'product_id and pricing_id are required'; END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_product.status::TEXT <> 'active' THEN RAISE EXCEPTION 'This listing is not available'; END IF;
  IF v_product.seller_id = p_buyer_id THEN RAISE EXCEPTION 'You cannot purchase your own listing'; END IF;

  SELECT * INTO v_pricing FROM product_pricing WHERE id = p_pricing_id AND product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pricing option not found'; END IF;
  IF COALESCE(v_pricing.is_available, true) = false THEN RAISE EXCEPTION 'This pricing option is unavailable'; END IF;

  v_listing_type := v_product.listing_type::TEXT;
  IF v_listing_type NOT IN ('product', 'service') THEN RAISE EXCEPTION 'Invalid listing type: %', v_listing_type; END IF;

  v_quantity := GREATEST(COALESCE(p_requested_quantity, 1), 1);
  IF v_listing_type = 'service' THEN v_quantity := 1; END IF;

  IF v_pricing.stock IS NOT NULL THEN
    IF v_pricing.stock < v_quantity THEN RAISE EXCEPTION 'Insufficient stock for this quantity'; END IF;
    UPDATE product_pricing SET stock = stock - v_quantity WHERE id = v_pricing.id;
  END IF;

  IF v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital' THEN
    SELECT COALESCE(ps.shipping_cost, 0) INTO v_shipping_cost FROM product_shipping ps WHERE ps.product_id = p_product_id LIMIT 1;
  END IF;

  v_is_pwyw := v_pricing.min_price < v_pricing.price;
  IF v_is_pwyw THEN
    v_unit_price := ROUND(COALESCE(p_chosen_amount, v_pricing.price)::NUMERIC, 2);
    IF v_unit_price < v_pricing.min_price THEN
      RAISE EXCEPTION 'Chosen amount % is below the minimum of %', v_unit_price, v_pricing.min_price;
    END IF;
    IF v_unit_price > 1000000 THEN RAISE EXCEPTION 'Chosen amount % exceeds the maximum allowed', v_unit_price; END IF;
  ELSE
    v_unit_price := v_pricing.price;
  END IF;

  v_item_amount := ROUND((v_unit_price * v_quantity)::NUMERIC, 2);
  SELECT * INTO v_money FROM compute_order_money(v_item_amount, v_shipping_cost, 0);
  v_currency := LOWER(COALESCE(v_pricing.currency, 'usd'));

  IF v_listing_type = 'service' THEN
    v_due_date := COALESCE(p_due_date,
      CASE WHEN v_pricing.delivery_days IS NOT NULL THEN NOW() + make_interval(days => v_pricing.delivery_days) ELSE NULL END);
  END IF;

  SELECT sp.require_approval, sp.auto_decline_hours INTO v_require_approval, v_auto_decline_hours
  FROM seller_profiles sp WHERE sp.user_id = v_product.seller_id LIMIT 1;
  v_auto_decline_hours := GREATEST(COALESCE(v_auto_decline_hours, 72), 1);

  v_requires_seller_approval := COALESCE(v_require_approval, FALSE)
    AND (v_listing_type = 'service' OR (v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital'));
  IF v_requires_seller_approval THEN v_initial_status := 'pending_acceptance'; END IF;

  INSERT INTO orders (
    buyer_id, seller_id, product_id, pricing_id, listing_type,
    amount, original_amount, discount_amount, promo_code_id,
    platform_fee, seller_amount, buyer_fee, currency,
    status, payment_status, payment_provider,
    brief, requirements, due_date, max_revisions,
    quantity, shipping_address, shipping_cost,
    seller_accepted, seller_response_deadline
  ) VALUES (
    p_buyer_id, v_product.seller_id, p_product_id, p_pricing_id, v_listing_type,
    v_money.amount, v_money.amount, 0, NULL,
    v_money.platform_fee, v_money.seller_amount, v_money.buyer_fee, v_currency,
    v_initial_status, 'pending', 'stripe',
    CASE WHEN v_listing_type = 'service' THEN p_brief ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN COALESCE(p_requirements, '{}'::jsonb) ELSE '{}'::jsonb END,
    CASE WHEN v_listing_type = 'service' THEN v_due_date ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN v_pricing.revisions ELSE NULL END,
    v_quantity,
    CASE WHEN v_listing_type = 'product' THEN p_shipping_address ELSE NULL END,
    v_shipping_cost,
    CASE WHEN v_requires_seller_approval THEN NULL ELSE TRUE END,
    CASE WHEN v_requires_seller_approval THEN NOW() + make_interval(hours => v_auto_decline_hours) ELSE NULL END
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order_id, p_buyer_id, 'status_change', NULL, v_initial_status,
    jsonb_build_object('source', 'create_marketplace_order', 'requires_approval', v_requires_seller_approval,
                       'pwyw', v_is_pwyw, 'unit_price', v_unit_price, 'buyer_fee', v_money.buyer_fee));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order_id, p_buyer_id,
    CASE WHEN v_requires_seller_approval THEN 'Order created and awaiting seller approval.'
         ELSE 'Order created and ready for payment confirmation.' END, 'system');

  RETURN jsonb_build_object('order_id', v_order_id, 'status', v_initial_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_promo_to_order(p_order_id UUID, p_promo_code_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_validation JSONB;
  v_discount NUMERIC(10,2);
  v_amount NUMERIC(10,2);
  v_money RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;
  IF v_order.buyer_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be applied before payment');
  END IF;

  SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_code_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Promo code not found'); END IF;

  v_amount := COALESCE(v_order.original_amount, v_order.amount);
  v_validation := validate_promo_code(v_promo.code, v_amount, v_order.listing_type);
  IF (v_validation->>'valid')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_validation->>'error', 'Promo code is not valid'));
  END IF;

  v_discount := LEAST(COALESCE((v_validation->>'discount_amount')::NUMERIC, 0), v_amount);
  SELECT * INTO v_money FROM compute_order_money(v_amount - COALESCE(v_order.shipping_cost, 0), COALESCE(v_order.shipping_cost, 0), v_discount);

  UPDATE orders
  SET original_amount = v_amount,
      discount_amount = v_discount,
      amount = v_money.amount,
      platform_fee = v_money.platform_fee,
      seller_amount = v_money.seller_amount,
      buyer_fee = v_money.buyer_fee,
      promo_code_id = v_promo.id,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE promo_code_redemptions
  SET promo_code_id = v_promo.id, user_id = auth.uid(), discount_amount = v_discount, created_at = NOW()
  WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    INSERT INTO promo_code_redemptions (promo_code_id, order_id, user_id, discount_amount)
    VALUES (v_promo.id, p_order_id, auth.uid(), v_discount);
  END IF;

  RETURN jsonb_build_object('success', true, 'discount_amount', v_discount, 'final_amount', v_money.amount,
                            'original_amount', v_amount, 'buyer_fee', v_money.buyer_fee, 'total_amount', v_money.total_amount);
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_promo_from_order(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_original NUMERIC(10,2);
  v_money RECORD;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Order not found'); END IF;
  IF v_order.buyer_id <> auth.uid() THEN RETURN jsonb_build_object('success', false, 'error', 'Not authorized'); END IF;
  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be removed before payment');
  END IF;

  v_original := COALESCE(v_order.original_amount, v_order.amount);
  SELECT * INTO v_money FROM compute_order_money(v_original - COALESCE(v_order.shipping_cost, 0), COALESCE(v_order.shipping_cost, 0), 0);

  UPDATE orders
  SET amount = v_money.amount,
      discount_amount = 0,
      promo_code_id = NULL,
      platform_fee = v_money.platform_fee,
      seller_amount = v_money.seller_amount,
      buyer_fee = v_money.buyer_fee,
      updated_at = NOW()
  WHERE id = p_order_id;

  DELETE FROM promo_code_redemptions WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'discount_amount', 0, 'final_amount', v_money.amount,
                            'original_amount', v_original, 'buyer_fee', v_money.buyer_fee, 'total_amount', v_money.total_amount);
END;
$$;

-- Free ($0) orders only: no money, but the same shape of records.
CREATE OR REPLACE FUNCTION public.finalize_order_payment(
  p_order_id UUID, p_provider TEXT, p_payment_reference TEXT, p_actor_id UUID DEFAULT NULL, p_source TEXT DEFAULT 'api'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_provider TEXT := LOWER(COALESCE(NULLIF(p_provider, ''), 'placeholder'));
  v_reference TEXT := NULLIF(p_payment_reference, '');
  v_actor_id UUID;
  v_product_delivery TEXT;
  v_is_digital_product BOOLEAN;
  v_target_status TEXT;
  v_payment_id UUID;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object('already_processed', true, 'order_id', v_order.id,
                              'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  IF v_order.total_amount > 0 THEN
    RAISE EXCEPTION 'finalize_order_payment is only for free orders; paid orders are recorded from the Stripe webhook';
  END IF;

  v_actor_id := COALESCE(p_actor_id, v_order.buyer_id);

  IF v_order.listing_type = 'product' THEN
    SELECT delivery_type::TEXT INTO v_product_delivery FROM products WHERE id = v_order.product_id;
    IF COALESCE(v_product_delivery, 'physical') <> 'digital' AND v_order.shipping_address IS NULL THEN
      RAISE EXCEPTION 'Shipping address is required before payment confirmation';
    END IF;
  END IF;

  v_is_digital_product := v_order.listing_type = 'product' AND v_product_delivery = 'digital';
  v_target_status := CASE WHEN v_is_digital_product THEN 'delivered' ELSE 'paid' END;

  UPDATE orders SET
    status = v_target_status,
    payment_status = 'paid',
    payment_provider = v_provider,
    payment_reference = COALESCE(v_reference, payment_reference),
    delivered_at = CASE WHEN v_is_digital_product THEN NOW() ELSE delivered_at END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO payments (order_id, provider, payment_intent_id, amount_cents, currency, stripe_fee_cents, net_cents, status, metadata)
  VALUES (p_order_id, v_provider, NULL, 0, v_order.currency, 0, 0, 'succeeded',
          jsonb_build_object('free_order', true, 'reference', v_reference, 'source', p_source))
  RETURNING id INTO v_payment_id;

  INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
  SELECT p_order_id, t.type, t.amount, v_order.currency, t.status, jsonb_build_object('provider', v_provider, 'source', p_source, 'payment_id', v_payment_id)
  FROM (VALUES ('payment', 0::NUMERIC, 'completed'), ('buyer_fee', 0::NUMERIC, 'completed'),
               ('platform_fee', v_order.platform_fee, 'completed'), ('seller_payout', v_order.seller_amount, 'pending')) AS t(type, amount, status)
  WHERE NOT EXISTS (SELECT 1 FROM transactions x WHERE x.order_id = p_order_id AND x.type = t.type);

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_actor_id, 'payment', 'pending_payment', v_target_status,
    jsonb_build_object('action', 'payment_confirmed', 'provider', v_provider, 'payment_reference', v_reference,
                       'source', p_source, 'payment_status', 'paid', 'free_order', true));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_actor_id,
    CASE WHEN v_is_digital_product THEN 'Order confirmed. Your digital order is now delivered.'
         ELSE 'Order confirmed. The order is now active.' END, 'system');

  RETURN jsonb_build_object('already_processed', false, 'order_id', p_order_id, 'status', v_target_status, 'payment_status', 'paid');
END;
$$;
