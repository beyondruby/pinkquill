-- Persist structured payment decline details for issuer/risk diagnostics.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS last_payment_error JSONB;

CREATE OR REPLACE FUNCTION mark_order_payment_failed(
  p_order_id UUID,
  p_provider TEXT,
  p_payment_reference TEXT,
  p_reason TEXT DEFAULT NULL,
  p_source TEXT DEFAULT 'api',
  p_error_details JSONB DEFAULT '{}'::jsonb
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
  v_error_details JSONB := COALESCE(p_error_details, '{}'::jsonb);
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

  IF p_reason IS NOT NULL THEN
    v_error_details := v_error_details || jsonb_build_object('message', p_reason);
  END IF;

  UPDATE orders
  SET
    payment_status = 'failed',
    payment_provider = v_provider,
    payment_reference = COALESCE(v_reference, payment_reference),
    payment_intent_id = CASE
      WHEN v_provider = 'stripe' THEN COALESCE(v_reference, payment_intent_id)
      ELSE payment_intent_id
    END,
    last_payment_error = CASE
      WHEN v_error_details = '{}'::jsonb THEN NULL
      ELSE v_error_details
    END,
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
      'source', p_source,
      'error_details', CASE WHEN v_error_details = '{}'::jsonb THEN NULL ELSE v_error_details END
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

GRANT EXECUTE ON FUNCTION mark_order_payment_failed(UUID, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;
