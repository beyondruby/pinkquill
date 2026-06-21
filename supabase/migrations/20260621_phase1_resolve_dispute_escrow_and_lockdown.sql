-- P1 task 1 + 6: resolve_dispute
--  (1) release escrow to the seller when a dispute is resolved in their favor
--      (release_to_seller / mutual_agreement) for service orders — previously the
--      order was set to 'resolved' but escrow was never released, locking seller
--      funds forever.
--  (2) lock the RPC to service_role. It is not used by the UI and there is no
--      admin role; leaving it callable by authenticated let any user resolve any
--      dispute (e.g. award themselves a full refund). A future admin endpoint
--      should call it via the service-role client (and trigger transferToSeller).
CREATE OR REPLACE FUNCTION public.resolve_dispute(p_dispute_id uuid, p_resolution text, p_resolution_notes text DEFAULT NULL::text, p_refund_amount numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dispute disputes;
  v_order orders;
  v_new_status TEXT;
  v_caller UUID := auth.uid();
BEGIN
  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF v_dispute.status NOT IN ('open', 'under_review', 'escalated') THEN
    RAISE EXCEPTION 'Dispute is not active';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_dispute.order_id FOR UPDATE;

  CASE p_resolution
    WHEN 'full_refund' THEN v_new_status := 'refunded';
    WHEN 'partial_refund' THEN v_new_status := 'resolved';
    WHEN 'release_to_seller' THEN v_new_status := 'resolved';
    WHEN 'order_cancelled' THEN v_new_status := 'cancelled';
    WHEN 'mutual_agreement' THEN v_new_status := 'resolved';
    ELSE RAISE EXCEPTION 'Invalid resolution: %', p_resolution;
  END CASE;

  UPDATE disputes SET
    status = 'resolved',
    resolution = p_resolution,
    resolution_notes = p_resolution_notes,
    refund_amount = p_refund_amount,
    resolved_by = v_caller,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_dispute_id;

  UPDATE orders SET
    status = v_new_status,
    auto_completion_at = NULL,
    updated_at = NOW()
  WHERE id = v_dispute.order_id;

  -- Release escrow to the seller when the resolution leaves the funds with them.
  -- partial_refund is intentionally excluded (split handled by the app/refund layer).
  IF p_resolution IN ('release_to_seller', 'mutual_agreement')
     AND v_order.listing_type = 'service'
     AND NOT COALESCE(v_order.escrow_released, false)
     AND COALESCE(v_order.payment_status, '') IN ('authorized', 'paid')
  THEN
    UPDATE transactions
    SET status = 'completed'
    WHERE order_id = v_order.id AND status = 'pending';

    UPDATE orders SET
      escrow_released = true,
      escrow_released_at = COALESCE(escrow_released_at, NOW()),
      payment_status = 'paid',
      updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (v_order.id, v_caller, 'payment',
      jsonb_build_object('action', 'escrow_released', 'source', 'resolve_dispute', 'resolution', p_resolution));
    -- NOTE: the actual Stripe transfer must be triggered by the calling server
    -- route via provider.transferToSeller(order_id), mirroring the completion path.
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_dispute.order_id, v_caller, 'dispute', 'disputed', v_new_status,
    jsonb_build_object('dispute_id', p_dispute_id, 'resolution', p_resolution, 'refund_amount', p_refund_amount));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_dispute.order_id, v_caller,
    'Dispute resolved: ' ||
    CASE p_resolution
      WHEN 'full_refund' THEN 'Full refund issued'
      WHEN 'partial_refund' THEN 'Partial refund of $' || COALESCE(p_refund_amount::TEXT, '0') || ' issued'
      WHEN 'release_to_seller' THEN 'Funds released to seller'
      WHEN 'order_cancelled' THEN 'Order cancelled'
      WHEN 'mutual_agreement' THEN 'Resolved by mutual agreement'
      ELSE 'Resolved'
    END || COALESCE(' — ' || p_resolution_notes, ''),
    'system');

  PERFORM create_order_notification(v_order.buyer_id, v_caller, 'dispute_resolved', v_dispute.order_id, 'Your dispute has been resolved');
  PERFORM create_order_notification(v_order.seller_id, v_caller, 'dispute_resolved', v_dispute.order_id, 'A dispute on your order has been resolved');

  RETURN to_jsonb(v_dispute);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_dispute(uuid, text, text, numeric) TO service_role;
