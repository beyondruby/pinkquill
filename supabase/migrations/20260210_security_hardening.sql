-- Security hardening: atomic order/payment flows, API rate limiting, and storage policy tightening
-- Created: 2026-02-10

-- ============================================
-- API RATE LIMITING (DB-backed, multi-instance safe)
-- ============================================

CREATE TABLE IF NOT EXISTS api_rate_limits (
  scope TEXT NOT NULL,
  identifier TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scope, identifier)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_updated_at
  ON api_rate_limits(updated_at DESC);

CREATE OR REPLACE FUNCTION enforce_api_rate_limit(
  p_scope TEXT,
  p_identifier TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := clock_timestamp();
  v_row api_rate_limits%ROWTYPE;
  v_reset_at TIMESTAMPTZ;
BEGIN
  IF p_scope IS NULL OR btrim(p_scope) = '' THEN
    RAISE EXCEPTION 'Rate-limit scope is required';
  END IF;

  IF p_identifier IS NULL OR btrim(p_identifier) = '' THEN
    RAISE EXCEPTION 'Rate-limit identifier is required';
  END IF;

  IF p_limit IS NULL OR p_limit <= 0 THEN
    RAISE EXCEPTION 'Rate-limit limit must be positive';
  END IF;

  IF p_window_seconds IS NULL OR p_window_seconds <= 0 THEN
    RAISE EXCEPTION 'Rate-limit window must be positive';
  END IF;

  SELECT *
  INTO v_row
  FROM api_rate_limits
  WHERE scope = p_scope
    AND identifier = p_identifier
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO api_rate_limits (scope, identifier, window_start, request_count, updated_at)
    VALUES (p_scope, p_identifier, v_now, 1, v_now);

    allowed := true;
    remaining := GREATEST(p_limit - 1, 0);
    reset_at := v_now + make_interval(secs => p_window_seconds);
    RETURN NEXT;
    RETURN;
  END IF;

  v_reset_at := v_row.window_start + make_interval(secs => p_window_seconds);

  IF v_now >= v_reset_at THEN
    UPDATE api_rate_limits
    SET
      window_start = v_now,
      request_count = 1,
      updated_at = v_now
    WHERE scope = p_scope
      AND identifier = p_identifier;

    allowed := true;
    remaining := GREATEST(p_limit - 1, 0);
    reset_at := v_now + make_interval(secs => p_window_seconds);
    RETURN NEXT;
    RETURN;
  END IF;

  IF v_row.request_count >= p_limit THEN
    allowed := false;
    remaining := 0;
    reset_at := v_reset_at;
    RETURN NEXT;
    RETURN;
  END IF;

  UPDATE api_rate_limits
  SET
    request_count = v_row.request_count + 1,
    updated_at = v_now
  WHERE scope = p_scope
    AND identifier = p_identifier;

  allowed := true;
  remaining := GREATEST(p_limit - (v_row.request_count + 1), 0);
  reset_at := v_reset_at;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION enforce_api_rate_limit(TEXT, TEXT, INTEGER, INTEGER) TO service_role;

-- ============================================
-- ATOMIC ORDER CREATION (locks stock row)
-- ============================================

CREATE OR REPLACE FUNCTION create_marketplace_order(
  p_buyer_id UUID,
  p_product_id UUID,
  p_pricing_id UUID,
  p_requested_quantity INTEGER DEFAULT 1,
  p_brief TEXT DEFAULT NULL,
  p_requirements JSONB DEFAULT '{}'::jsonb,
  p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_shipping_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_pricing product_pricing%ROWTYPE;
  v_listing_type TEXT;
  v_quantity INTEGER;
  v_amount NUMERIC(10, 2);
  v_fee_rate NUMERIC(5, 4);
  v_platform_fee NUMERIC(10, 2);
  v_seller_amount NUMERIC(10, 2);
  v_currency TEXT;
  v_due_date TIMESTAMPTZ;
  v_order_id UUID;
BEGIN
  IF p_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Buyer is required';
  END IF;

  IF p_product_id IS NULL OR p_pricing_id IS NULL THEN
    RAISE EXCEPTION 'product_id and pricing_id are required';
  END IF;

  SELECT *
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.status::TEXT <> 'active' THEN
    RAISE EXCEPTION 'This listing is not available';
  END IF;

  IF v_product.seller_id = p_buyer_id THEN
    RAISE EXCEPTION 'You cannot purchase your own listing';
  END IF;

  SELECT *
  INTO v_pricing
  FROM product_pricing
  WHERE id = p_pricing_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing option not found';
  END IF;

  IF COALESCE(v_pricing.is_available, true) = false THEN
    RAISE EXCEPTION 'This pricing option is unavailable';
  END IF;

  v_listing_type := v_product.listing_type::TEXT;
  IF v_listing_type NOT IN ('product', 'service') THEN
    RAISE EXCEPTION 'Invalid listing type: %', v_listing_type;
  END IF;

  v_quantity := GREATEST(COALESCE(p_requested_quantity, 1), 1);
  IF v_listing_type = 'service' THEN
    v_quantity := 1;
  END IF;

  IF v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital' AND p_shipping_address IS NULL THEN
    RAISE EXCEPTION 'Shipping address is required for physical orders';
  END IF;

  IF v_pricing.stock IS NOT NULL THEN
    IF v_pricing.stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for this quantity';
    END IF;

    UPDATE product_pricing
    SET stock = stock - v_quantity
    WHERE id = v_pricing.id;
  END IF;

  v_amount := ROUND((v_pricing.price * v_quantity)::NUMERIC, 2);
  v_fee_rate := CASE WHEN v_listing_type = 'service' THEN 0.10 ELSE 0.08 END;
  v_platform_fee := ROUND((v_amount * v_fee_rate)::NUMERIC, 2);
  v_seller_amount := ROUND((v_amount - v_platform_fee)::NUMERIC, 2);
  v_currency := LOWER(COALESCE(v_pricing.currency, 'usd'));

  IF v_listing_type = 'service' THEN
    v_due_date := COALESCE(
      p_due_date,
      CASE
        WHEN v_pricing.delivery_days IS NOT NULL THEN NOW() + make_interval(days => v_pricing.delivery_days)
        ELSE NULL
      END
    );
  ELSE
    v_due_date := NULL;
  END IF;

  INSERT INTO orders (
    buyer_id,
    seller_id,
    product_id,
    pricing_id,
    listing_type,
    amount,
    platform_fee,
    seller_amount,
    currency,
    status,
    payment_status,
    payment_provider,
    brief,
    requirements,
    due_date,
    max_revisions,
    quantity,
    shipping_address
  )
  VALUES (
    p_buyer_id,
    v_product.seller_id,
    p_product_id,
    p_pricing_id,
    v_listing_type,
    v_amount,
    v_platform_fee,
    v_seller_amount,
    v_currency,
    'pending_payment',
    'pending',
    'placeholder',
    CASE WHEN v_listing_type = 'service' THEN p_brief ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN COALESCE(p_requirements, '{}'::jsonb) ELSE '{}'::jsonb END,
    CASE WHEN v_listing_type = 'service' THEN v_due_date ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN v_pricing.revisions ELSE NULL END,
    v_quantity,
    CASE WHEN v_listing_type = 'product' THEN p_shipping_address ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order_id, p_buyer_id, 'status_change', NULL, 'pending_payment', jsonb_build_object('source', 'create_marketplace_order'));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order_id, p_buyer_id, 'Order created and ready for payment confirmation.', 'system');

  RETURN jsonb_build_object('order_id', v_order_id);
END;
$$;

GRANT EXECUTE ON FUNCTION create_marketplace_order(UUID, UUID, UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ, JSONB) TO service_role;

-- ============================================
-- ATOMIC PAYMENT FINALIZATION
-- ============================================

CREATE OR REPLACE FUNCTION finalize_order_payment(
  p_order_id UUID,
  p_provider TEXT,
  p_payment_reference TEXT,
  p_actor_id UUID DEFAULT NULL,
  p_source TEXT DEFAULT 'api'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_provider TEXT := LOWER(COALESCE(NULLIF(p_provider, ''), 'placeholder'));
  v_reference TEXT := NULLIF(p_payment_reference, '');
  v_actor_id UUID;
  v_is_digital_product BOOLEAN;
  v_target_status TEXT;
  v_target_payment_status TEXT;
BEGIN
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object(
      'already_processed', true,
      'order_id', v_order.id,
      'status', v_order.status,
      'payment_status', v_order.payment_status
    );
  END IF;

  v_actor_id := COALESCE(p_actor_id, v_order.buyer_id);
  v_is_digital_product := v_order.listing_type = 'product' AND v_order.shipping_address IS NULL;
  v_target_status := CASE WHEN v_is_digital_product THEN 'delivered' ELSE 'paid' END;
  v_target_payment_status := CASE WHEN v_order.listing_type = 'service' THEN 'authorized' ELSE 'paid' END;

  UPDATE orders
  SET
    status = v_target_status,
    payment_status = v_target_payment_status,
    payment_provider = v_provider,
    payment_reference = COALESCE(v_reference, payment_reference),
    payment_intent_id = COALESCE(v_reference, payment_intent_id),
    delivered_at = CASE WHEN v_is_digital_product THEN NOW() ELSE delivered_at END,
    updated_at = NOW()
  WHERE id = p_order_id;

  IF v_order.listing_type = 'service' THEN
    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'payment', v_order.amount, v_order.currency, 'pending', jsonb_build_object('provider', v_provider, 'escrow', 'held')
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'payment');

    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'platform_fee', v_order.platform_fee, v_order.currency, 'pending', jsonb_build_object('provider', v_provider, 'escrow', 'held')
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'platform_fee');

    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'seller_payout', v_order.seller_amount, v_order.currency, 'pending', jsonb_build_object('provider', v_provider, 'escrow', 'held')
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'seller_payout');
  ELSE
    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'payment', v_order.amount, v_order.currency, 'completed', jsonb_build_object('provider', v_provider)
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'payment');

    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'platform_fee', v_order.platform_fee, v_order.currency, 'completed', jsonb_build_object('provider', v_provider)
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'platform_fee');

    INSERT INTO transactions (order_id, type, amount, currency, status, metadata)
    SELECT p_order_id, 'seller_payout', v_order.seller_amount, v_order.currency, 'completed', jsonb_build_object('provider', v_provider)
    WHERE NOT EXISTS (SELECT 1 FROM transactions WHERE order_id = p_order_id AND type = 'seller_payout');
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    v_actor_id,
    'payment',
    jsonb_build_object(
      'action', 'payment_confirmed',
      'provider', v_provider,
      'payment_reference', v_reference,
      'source', p_source,
      'payment_status', v_target_payment_status
    )
  );

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    v_actor_id,
    CASE
      WHEN v_is_digital_product THEN 'Payment confirmed. Your digital order is now delivered.'
      ELSE 'Payment confirmed. The order is now active.'
    END,
    'system'
  );

  RETURN jsonb_build_object(
    'already_processed', false,
    'order_id', p_order_id,
    'status', v_target_status,
    'payment_status', v_target_payment_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_order_payment(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION mark_order_payment_failed(
  p_order_id UUID,
  p_provider TEXT,
  p_payment_reference TEXT,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'api'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_provider TEXT := LOWER(COALESCE(NULLIF(p_provider, ''), 'stripe'));
  v_reference TEXT := NULLIF(p_payment_reference, '');
BEGIN
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object(
      'already_processed', true,
      'order_id', v_order.id,
      'status', v_order.status,
      'payment_status', v_order.payment_status
    );
  END IF;

  UPDATE orders
  SET
    payment_status = 'failed',
    payment_provider = v_provider,
    payment_reference = COALESCE(v_reference, payment_reference),
    payment_intent_id = COALESCE(v_reference, payment_intent_id),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    v_order.buyer_id,
    'payment',
    jsonb_build_object(
      'action', 'payment_failed',
      'provider', v_provider,
      'payment_reference', v_reference,
      'reason', p_reason,
      'source', p_source
    )
  );

  RETURN jsonb_build_object(
    'already_processed', false,
    'order_id', p_order_id,
    'status', v_order.status,
    'payment_status', 'failed'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION mark_order_payment_failed(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- ============================================
-- STORAGE POLICY TIGHTENING
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can upload product images" ON storage.objects;

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
