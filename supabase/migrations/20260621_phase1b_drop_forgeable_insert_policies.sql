-- P1b tasks 7 & 8: order_events and disputes were directly INSERT-able by any order
-- participant via PostgREST, letting them forge audit events (e.g. a fake
-- 'escrow_released'/'payment' event) or pre-populate a dispute's resolution/
-- refund_amount. No client code inserts these tables directly — every write goes
-- through service_role (supabaseAdmin) routes or SECURITY DEFINER RPCs
-- (open_dispute), both of which bypass RLS. Drop the client INSERT policies.
DROP POLICY IF EXISTS "System can create events" ON public.order_events;
DROP POLICY IF EXISTS "Order participants can create disputes" ON public.disputes;
