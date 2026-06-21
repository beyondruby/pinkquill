-- P4/S4: replace useOrderStats / useBuyerOrderStats unbounded client-side
-- aggregation (fetch ALL of a user's orders, reduce in JS) with server aggregates.
-- Keyed to auth.uid() so a caller can only aggregate their own orders. Status
-- buckets match the prior client logic exactly.
CREATE OR REPLACE FUNCTION public.get_seller_order_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT status, seller_amount FROM orders WHERE seller_id = auth.uid()
  )
  SELECT jsonb_build_object(
    'total_orders', COUNT(*),
    'active_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['paid','in_progress','submitted','revision_requested','processing','shipped'])),
    'completed_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['completed','delivered'])),
    'cancelled_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['cancelled','refunded'])),
    'total_revenue', round(COALESCE(SUM(seller_amount) FILTER (WHERE status = ANY (ARRAY['completed','delivered'])), 0)::numeric, 2),
    'pending_revenue', round(COALESCE(SUM(seller_amount) FILTER (WHERE status = ANY (ARRAY['paid','in_progress','submitted','revision_requested','processing','shipped'])), 0)::numeric, 2)
  ) FROM o;
$function$;

CREATE OR REPLACE FUNCTION public.get_buyer_order_stats()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT status, amount FROM orders WHERE buyer_id = auth.uid()
  )
  SELECT jsonb_build_object(
    'total_orders', COUNT(*),
    'active_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['paid','in_progress','submitted','revision_requested','processing','shipped'])),
    'pending_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['pending_payment','pending_acceptance'])),
    'completed_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['completed','delivered'])),
    'cancelled_orders', COUNT(*) FILTER (WHERE status = ANY (ARRAY['cancelled','refunded','declined'])),
    'total_spent', round(COALESCE(SUM(amount) FILTER (WHERE status = ANY (ARRAY['completed','delivered','paid','in_progress','submitted','revision_requested','processing','shipped'])), 0)::numeric, 2)
  ) FROM o;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_seller_order_stats() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_buyer_order_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_order_stats() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_buyer_order_stats() TO authenticated, service_role;
