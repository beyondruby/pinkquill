-- Commissions rebuild — Phase 1c (part 2): settlement currency.
--
-- Facts established against Stripe (test mode, 2026-09-02):
-- - The platform account settles in CAD only. Any USD charge is converted to
--   CAD by Stripe at charge time (with Stripe's conversion fee), and transfers
--   must be in CAD because that is the only balance the platform holds.
-- - Cross-border "recipient" accounts are not available to Canadian platforms
--   for any country; full connected accounts in other Stripe countries are.
--
-- Design (money-optimal for the platform, switchable later):
-- - Listing/display currency stays USD. The buyer is CHARGED in the platform's
--   settlement currency (CAD today) at a cached mid-market rate plus a small
--   buffer, so Pinkquill never pays a conversion. The buyer's bank converts.
-- - The seller's payout is fixed in the charge currency at charge time
--   (seller USD × rate), so the platform carries no FX drift during the hold.
--   Stripe converts the CAD transfer to the seller's local currency at payout.
-- - When a USD bank account is added, set settlement_currency = "usd": rate
--   becomes 1 and every path below degrades to "no conversion".
--
-- Idempotent.

INSERT INTO public.platform_settings (key, value) VALUES
  ('settlement_currency', '"cad"'),
  ('fx_buffer_rate', '0.015'),
  ('fx_max_age_hours', '6'),
  ('fx_source', '"frankfurter"')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fx_rates (
  base TEXT NOT NULL,
  quote TEXT NOT NULL,
  rate NUMERIC(14,6) NOT NULL CHECK (rate > 0),
  source TEXT NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (base, quote)
);
ALTER TABLE public.fx_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fx_rates FROM anon, authenticated;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS charge_currency TEXT,
  ADD COLUMN IF NOT EXISTS charge_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS charge_fee_cents INTEGER,
  ADD COLUMN IF NOT EXISTS seller_amount_charge_cents INTEGER,
  ADD COLUMN IF NOT EXISTS platform_fee_charge_cents INTEGER,
  ADD COLUMN IF NOT EXISTS buyer_fee_charge_cents INTEGER,
  ADD COLUMN IF NOT EXISTS fx_rate NUMERIC(14,6),
  ADD COLUMN IF NOT EXISTS fx_rate_at TIMESTAMPTZ;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS listing_amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS listing_currency TEXT;

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_account_check;
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_account_check CHECK (account IN (
  'stripe_balance', 'stripe_fees_expense', 'buyer_fee_revenue', 'platform_fee_revenue',
  'seller_liability', 'seller_paid_out', 'refunds', 'fx_reserve'
));

-- Called by /api/checkout right before the Stripe session is created.
CREATE OR REPLACE FUNCTION public.set_order_charge(
  p_order_id UUID, p_charge_currency TEXT, p_charge_amount_cents INTEGER, p_charge_fee_cents INTEGER,
  p_seller_cents INTEGER, p_platform_cents INTEGER, p_buyer_cents INTEGER, p_fx_rate NUMERIC
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status <> 'pending_payment' THEN
    RAISE EXCEPTION 'Charge can only be set while the order awaits payment (status %)', v_order.status;
  END IF;
  IF p_fx_rate IS NULL OR p_fx_rate <= 0 THEN RAISE EXCEPTION 'Invalid fx rate'; END IF;
  IF p_charge_amount_cents < p_seller_cents + p_platform_cents + p_buyer_cents THEN
    RAISE EXCEPTION 'Charge amount % is below the converted breakdown %', p_charge_amount_cents, p_seller_cents + p_platform_cents + p_buyer_cents;
  END IF;

  UPDATE orders SET
    charge_currency = LOWER(p_charge_currency),
    charge_amount_cents = p_charge_amount_cents,
    charge_fee_cents = p_charge_fee_cents,
    seller_amount_charge_cents = p_seller_cents,
    platform_fee_charge_cents = p_platform_cents,
    buyer_fee_charge_cents = p_buyer_cents,
    fx_rate = p_fx_rate,
    fx_rate_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('order_id', p_order_id, 'charge_currency', LOWER(p_charge_currency),
                            'charge_amount_cents', p_charge_amount_cents, 'fx_rate', p_fx_rate);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.set_order_charge(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_order_charge(UUID, TEXT, INTEGER, INTEGER, INTEGER, INTEGER, INTEGER, NUMERIC) TO service_role;

-- Money facts now live in the charge currency (what Stripe actually moved).
CREATE OR REPLACE FUNCTION public.record_payment_succeeded(
  p_order_id UUID, p_payment_intent_id TEXT, p_charge_id TEXT, p_checkout_session_id TEXT,
  p_amount_cents INTEGER, p_currency TEXT, p_stripe_fee_cents INTEGER, p_event_id TEXT, p_source TEXT DEFAULT 'stripe.webhook'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_expected_cents INTEGER;
  v_expected_currency TEXT;
  v_existing payments%ROWTYPE;
  v_payment_id UUID;
  v_product_delivery TEXT;
  v_is_digital_product BOOLEAN;
  v_target_status TEXT;
  v_seller_cents BIGINT; v_platform_cents BIGINT; v_buyer_cents BIGINT; v_reserve_cents BIGINT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  SELECT * INTO v_existing FROM payments WHERE payment_intent_id = p_payment_intent_id;
  IF FOUND THEN
    RETURN jsonb_build_object('outcome', 'already_processed', 'payment_id', v_existing.id,
                              'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  v_expected_cents := COALESCE(v_order.charge_amount_cents, ROUND(v_order.total_amount * 100)::INTEGER);
  v_expected_currency := LOWER(COALESCE(v_order.charge_currency, v_order.currency));

  IF p_amount_cents <> v_expected_cents OR LOWER(p_currency) <> v_expected_currency THEN
    INSERT INTO payments (order_id, provider, payment_intent_id, charge_id, checkout_session_id, amount_cents, currency,
                          stripe_fee_cents, net_cents, status, last_event_id, metadata)
    VALUES (p_order_id, 'stripe', p_payment_intent_id, p_charge_id, p_checkout_session_id, p_amount_cents, LOWER(p_currency),
            p_stripe_fee_cents, p_amount_cents - COALESCE(p_stripe_fee_cents, 0), 'amount_mismatch', p_event_id,
            jsonb_build_object('expected_cents', v_expected_cents, 'expected_currency', v_expected_currency, 'source', p_source))
    RETURNING id INTO v_payment_id;

    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'unhonoured_payment', p_amount_cents, p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_fees_expense', 'stripe_fee', COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
    PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'stripe_fee', -COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);

    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (p_order_id, v_order.buyer_id, 'amount_mismatch',
      jsonb_build_object('charged_cents', p_amount_cents, 'expected_cents', v_expected_cents, 'currency', p_currency,
                         'expected_currency', v_expected_currency, 'payment_intent_id', p_payment_intent_id, 'stripe_event_id', p_event_id));

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
          jsonb_build_object('source', p_source, 'fx_rate', v_order.fx_rate, 'listing_currency', v_order.currency,
                             'listing_total_cents', ROUND(v_order.total_amount * 100)::INTEGER))
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

  -- Listing-currency ledger for dashboards (retired in 4c).
  INSERT INTO transactions (order_id, type, amount, currency, status, stripe_payment_intent_id, stripe_charge_id, metadata)
  VALUES
    (p_order_id, 'payment', v_order.total_amount, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'source', p_source, 'payment_id', v_payment_id, 'charged_cents', p_amount_cents, 'charge_currency', p_currency)),
    (p_order_id, 'buyer_fee', v_order.buyer_fee, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'payment_id', v_payment_id)),
    (p_order_id, 'platform_fee', v_order.platform_fee, v_order.currency, 'completed', p_payment_intent_id, p_charge_id,
     jsonb_build_object('provider', 'stripe', 'payment_id', v_payment_id)),
    (p_order_id, 'seller_payout', v_order.seller_amount, v_order.currency, 'pending', p_payment_intent_id, NULL,
     jsonb_build_object('provider', 'stripe', 'awaiting_transfer', true, 'payment_id', v_payment_id));

  v_seller_cents := COALESCE(v_order.seller_amount_charge_cents, ROUND(v_order.seller_amount * 100))::BIGINT;
  v_platform_cents := COALESCE(v_order.platform_fee_charge_cents, ROUND(v_order.platform_fee * 100))::BIGINT;
  v_buyer_cents := COALESCE(v_order.buyer_fee_charge_cents, ROUND(v_order.buyer_fee * 100))::BIGINT;
  v_reserve_cents := p_amount_cents - (v_seller_cents + v_platform_cents + v_buyer_cents);

  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'payment_received', p_amount_cents, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_balance', 'stripe_fee', -COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'stripe_fees_expense', 'stripe_fee', COALESCE(p_stripe_fee_cents, 0), p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'seller_liability', 'payment_received', v_seller_cents, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'platform_fee_revenue', 'payment_received', v_platform_cents, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'buyer_fee_revenue', 'payment_received', v_buyer_cents, p_currency, 'payment_intent', p_payment_intent_id);
  PERFORM ledger_post(p_order_id, v_payment_id, NULL, 'fx_reserve', 'payment_received', v_reserve_cents, p_currency, 'payment_intent', p_payment_intent_id);

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_order.buyer_id, 'payment', 'pending_payment', v_target_status,
    jsonb_build_object('action', 'payment_confirmed', 'provider', 'stripe', 'payment_intent_id', p_payment_intent_id,
                       'amount_cents', p_amount_cents, 'currency', p_currency, 'stripe_fee_cents', p_stripe_fee_cents,
                       'fx_rate', v_order.fx_rate, 'stripe_event_id', p_event_id, 'source', p_source));

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
  v_seller_cents BIGINT; v_platform_cents BIGINT; v_buyer_cents BIGINT; v_reserve_cents BIGINT;
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
  VALUES (v_order.id, 'refund',
    ROUND(v_delta_cents / 100.0 / COALESCE(NULLIF(v_order.fx_rate, 0), 1), 2), v_order.currency, 'completed', p_payment_intent_id,
    jsonb_build_object('provider', 'stripe', 'refund_id', p_refund_id, 'reason', p_reason, 'stripe_event_id', p_event_id,
                       'source', p_source, 'refund_type', CASE WHEN v_full THEN 'full' ELSE 'partial' END,
                       'refunded_cents', v_delta_cents, 'charge_currency', v_payment.currency));

  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'stripe_balance', 'refund', -v_delta_cents, v_payment.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));
  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'refunds', 'refund', v_delta_cents, v_payment.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));

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

    SELECT * INTO v_payout FROM payouts WHERE order_id = v_order.id FOR UPDATE;
    IF FOUND AND v_payout.status IN ('pending', 'blocked', 'failed', 'processing') THEN
      UPDATE payouts SET status = 'cancelled', last_error = 'order refunded', updated_at = NOW() WHERE id = v_payout.id;
    END IF;

    v_seller_cents := COALESCE(v_order.seller_amount_charge_cents, ROUND(v_order.seller_amount * 100))::BIGINT;
    v_platform_cents := COALESCE(v_order.platform_fee_charge_cents, ROUND(v_order.platform_fee * 100))::BIGINT;
    v_buyer_cents := COALESCE(v_order.buyer_fee_charge_cents, ROUND(v_order.buyer_fee * 100))::BIGINT;
    v_reserve_cents := v_payment.amount_cents - (v_seller_cents + v_platform_cents + v_buyer_cents);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'seller_liability', 'refund', -v_seller_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'platform_fee_revenue', 'refund', -v_platform_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'buyer_fee_revenue', 'refund', -v_buyer_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'fx_reserve', 'refund', -v_reserve_cents, v_payment.currency, 'refund', p_refund_id);
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order.id, v_order.buyer_id, 'payment', v_order.status, v_new_status,
    jsonb_build_object('action', CASE WHEN v_full THEN 'refund' ELSE 'partial_refund' END, 'refund_id', p_refund_id,
                       'refunded_cents', v_delta_cents, 'refunded_total_cents', p_refunded_cents_total, 'currency', v_payment.currency,
                       'reason', p_reason, 'stripe_event_id', p_event_id, 'source', p_source));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order.id, v_order.buyer_id,
    CASE WHEN v_full THEN 'Your payment has been refunded.' ELSE 'A partial refund has been issued for your payment.' END, 'system');

  IF NOT v_full THEN
    PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_payment.currency) || ' has been issued.');
    PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_payment.currency) || ' was processed on your order.');
  END IF;

  RETURN jsonb_build_object('outcome', CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
                            'status', v_new_status, 'refunded_cents', p_refunded_cents_total);
END;
$$;

-- Payouts are in the charge currency, fixed at charge time; the listing amount is kept for display.
CREATE OR REPLACE FUNCTION public.release_eligible_payouts() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_window_hours NUMERIC := platform_setting_numeric('release_window_hours', 168);
  v_count INTEGER := 0;
  v_row RECORD;
  v_payout_id UUID;
  v_cents INTEGER;
BEGIN
  FOR v_row IN
    SELECT o.id AS order_id, o.seller_id, o.seller_amount, o.currency, o.charge_currency, o.seller_amount_charge_cents,
           p.id AS payment_id, p.charge_id, p.currency AS payment_currency
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
    v_cents := COALESCE(v_row.seller_amount_charge_cents, ROUND(v_row.seller_amount * 100)::INTEGER);
    INSERT INTO payouts (order_id, seller_id, payment_id, amount_cents, currency, listing_amount_cents, listing_currency,
                         source_charge_id, status, eligible_at)
    VALUES (v_row.order_id, v_row.seller_id, v_row.payment_id, v_cents,
            COALESCE(v_row.charge_currency, v_row.payment_currency, v_row.currency),
            ROUND(v_row.seller_amount * 100)::INTEGER, v_row.currency,
            v_row.charge_id, 'pending', NOW())
    RETURNING id INTO v_payout_id;

    INSERT INTO order_events (order_id, event_type, metadata)
    VALUES (v_row.order_id, 'payment',
      jsonb_build_object('action', 'payout_released', 'payout_id', v_payout_id, 'amount_cents', v_cents,
                         'currency', COALESCE(v_row.charge_currency, v_row.payment_currency, v_row.currency),
                         'release_window_hours', v_window_hours));
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
