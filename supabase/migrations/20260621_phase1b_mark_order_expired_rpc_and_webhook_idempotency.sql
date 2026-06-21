-- P1b task 10a: mark_order_expired as a SECURITY DEFINER RPC with FOR UPDATE +
-- status recheck, replacing the read-then-write in lib/payments-server.ts that
-- could race a checkout.session.expired against a just-completed payment.
CREATE OR REPLACE FUNCTION public.mark_order_expired(p_order_id uuid, p_provider text, p_payment_reference text, p_source text DEFAULT 'api'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status <> 'pending_payment' THEN
    RETURN jsonb_build_object(
      'already_processed', true, 'order_id', v_order.id,
      'status', v_order.status, 'payment_status', v_order.payment_status);
  END IF;

  UPDATE orders SET status = 'expired', payment_status = 'expired', updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, event_type, metadata)
  VALUES (p_order_id, 'payment',
    jsonb_build_object('action', 'checkout_expired', 'provider', p_provider,
      'payment_reference', p_payment_reference, 'source', p_source));

  RETURN jsonb_build_object(
    'already_processed', false, 'order_id', p_order_id,
    'status', 'expired', 'payment_status', 'expired');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.mark_order_expired(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_expired(uuid, text, text, text) TO service_role;

-- P1b task 10b: durable webhook idempotency table. The webhook handler inserts the
-- event id first and skips on conflict (and rolls the marker back if processing
-- throws). Only service_role touches it (RLS on, no policies).
CREATE TABLE IF NOT EXISTS public.processed_stripe_events (
  event_id text PRIMARY KEY,
  processed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.processed_stripe_events ENABLE ROW LEVEL SECURITY;
