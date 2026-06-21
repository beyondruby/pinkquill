-- P1 task 3: request_refund must not re-open an order whose funds have already
-- been released to the seller (escrow_released). Previously a buyer could flip a
-- settled order back to 'refund_requested', nulling auto_completion_at, after the
-- seller had been paid. Also lock the order row FOR UPDATE.
CREATE OR REPLACE FUNCTION public.request_refund(p_order_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders;
  v_caller UUID := auth.uid();
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller != v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF v_order.status NOT IN ('paid', 'completed', 'delivered') THEN
    RAISE EXCEPTION 'Cannot request refund from status: %', v_order.status;
  END IF;

  IF COALESCE(v_order.escrow_released, false) THEN
    RAISE EXCEPTION 'Cannot request a refund after funds have been released to the seller';
  END IF;

  UPDATE orders SET
    status = 'refund_requested',
    cancel_reason = p_reason,
    auto_completion_at = NULL,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'status_change', v_order.status, 'refund_requested', jsonb_build_object('reason', p_reason));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller, 'Buyer requested a refund' || COALESCE(' — Reason: ' || p_reason, ''), 'system');

  PERFORM create_order_notification(v_order.seller_id, v_caller, 'refund_requested', p_order_id, 'A refund has been requested on your order');

  RETURN to_jsonb(v_order);
END;
$function$;
