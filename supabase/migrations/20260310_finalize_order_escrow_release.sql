CREATE OR REPLACE FUNCTION finalize_order_escrow_release(
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
  v_action TEXT := CASE
    WHEN p_source = 'api.orders.auto_complete' THEN 'escrow_released_auto'
    ELSE 'escrow_released'
  END;
BEGIN
  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.listing_type <> 'service' THEN
    RAISE EXCEPTION 'Escrow release only applies to service orders';
  END IF;

  IF v_order.escrow_released THEN
    RETURN jsonb_build_object(
      'already_processed', true,
      'order_id', v_order.id,
      'status', v_order.status,
      'payment_status', v_order.payment_status,
      'escrow_released', true
    );
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Order must be completed before releasing escrow';
  END IF;

  IF COALESCE(v_order.payment_status, '') NOT IN ('authorized', 'paid') THEN
    RAISE EXCEPTION 'Cannot release escrow with payment status %', v_order.payment_status;
  END IF;

  UPDATE transactions
  SET status = 'completed'
  WHERE order_id = p_order_id
    AND status = 'pending';

  UPDATE orders
  SET
    escrow_released = true,
    escrow_released_at = COALESCE(escrow_released_at, NOW()),
    payment_status = 'paid',
    payment_provider = v_provider,
    payment_reference = COALESCE(v_reference, payment_reference),
    payment_intent_id = CASE
      WHEN v_provider = 'stripe' THEN COALESCE(v_reference, payment_intent_id)
      ELSE payment_intent_id
    END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    p_actor_id,
    'payment',
    jsonb_build_object(
      'action', v_action,
      'provider', v_provider,
      'payment_reference', v_reference,
      'source', p_source
    )
  );

  IF p_actor_id IS NOT NULL THEN
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (
      p_order_id,
      p_actor_id,
      'Escrow released and payout marked as available.',
      'system'
    );
  END IF;

  RETURN jsonb_build_object(
    'already_processed', false,
    'order_id', p_order_id,
    'status', v_order.status,
    'payment_status', 'paid',
    'escrow_released', true
  );
END;
$$;

GRANT EXECUTE ON FUNCTION finalize_order_escrow_release(UUID, TEXT, TEXT, UUID, TEXT) TO service_role;
