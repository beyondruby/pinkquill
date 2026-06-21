-- P4/S4: get_seller_stats replaces useSellerStats' client-side aggregation, which
-- pulled ALL of a seller's orders + reviews into the browser (re-run per SellerRating
-- badge -> many full scans per marketplace page) AND was wrong for public viewers
-- (orders RLS hides other people's orders, so completion_rate/totals showed 0).
-- SECURITY DEFINER so it can aggregate a seller's reputation for any viewer, but it
-- returns ONLY aggregate numbers. Counts only revealed reviews (blind-reveal).
CREATE OR REPLACE FUNCTION public.get_seller_stats(p_seller_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH o AS (
    SELECT status, buyer_id, created_at, started_at
    FROM orders WHERE seller_id = p_seller_id
  ),
  comp AS (
    SELECT buyer_id, COUNT(*) AS c FROM o WHERE status = 'completed' GROUP BY buyer_id
  ),
  agg AS (
    SELECT
      COUNT(*) AS total_orders,
      COUNT(*) FILTER (WHERE status = 'completed') AS completed_orders,
      AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 3600.0)
        FILTER (WHERE started_at IS NOT NULL AND started_at >= created_at) AS avg_resp_hours
    FROM o
  ),
  rev AS (
    SELECT COUNT(*) AS total_reviews, AVG(quill_score) AS avg_score
    FROM order_reviews
    WHERE reviewee_id = p_seller_id AND reviewee_role = 'seller'
      AND quill_score BETWEEN 1 AND 5
      AND (revealed_at IS NOT NULL OR (reveal_deadline IS NOT NULL AND reveal_deadline <= now()))
  ),
  rep AS (
    SELECT COALESCE(SUM(c) FILTER (WHERE c > 1), 0) AS repeat_count FROM comp
  )
  SELECT jsonb_build_object(
    'user_id', p_seller_id,
    'total_orders', agg.total_orders,
    'completed_orders', agg.completed_orders,
    'completion_rate', CASE WHEN agg.total_orders > 0
      THEN round(agg.completed_orders::numeric / agg.total_orders * 100) ELSE 0 END,
    'avg_quill_score', COALESCE(round(rev.avg_score::numeric, 1), 0),
    'total_reviews', rev.total_reviews,
    'avg_response_time_hours', COALESCE(round(agg.avg_resp_hours::numeric, 1), 0),
    'repeat_buyer_rate', CASE WHEN agg.completed_orders > 0
      THEN round(rep.repeat_count::numeric / agg.completed_orders * 100) ELSE 0 END,
    'updated_at', now()
  )
  FROM agg, rev, rep;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_seller_stats(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_seller_stats(uuid) TO anon, authenticated, service_role;
