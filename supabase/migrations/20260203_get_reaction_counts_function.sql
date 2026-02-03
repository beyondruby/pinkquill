-- Performance optimization: Server-side reaction count aggregation
-- This function uses GROUP BY and SUM to aggregate counts on the server
-- instead of fetching all rows and counting client-side

DROP FUNCTION IF EXISTS get_reaction_counts(UUID);

CREATE FUNCTION get_reaction_counts(p_post_id UUID)
RETURNS TABLE(
  admire_count BIGINT,
  snap_count BIGINT,
  ovation_count BIGINT,
  support_count BIGINT,
  inspired_count BIGINT,
  applaud_count BIGINT,
  total_count BIGINT
) AS $$
SELECT
  COALESCE(SUM(CASE WHEN reaction_type = 'admire' THEN 1 ELSE 0 END), 0) as admire_count,
  COALESCE(SUM(CASE WHEN reaction_type = 'snap' THEN 1 ELSE 0 END), 0) as snap_count,
  COALESCE(SUM(CASE WHEN reaction_type = 'ovation' THEN 1 ELSE 0 END), 0) as ovation_count,
  COALESCE(SUM(CASE WHEN reaction_type = 'support' THEN 1 ELSE 0 END), 0) as support_count,
  COALESCE(SUM(CASE WHEN reaction_type = 'inspired' THEN 1 ELSE 0 END), 0) as inspired_count,
  COALESCE(SUM(CASE WHEN reaction_type = 'applaud' THEN 1 ELSE 0 END), 0) as applaud_count,
  COUNT(*) as total_count
FROM reactions
WHERE post_id = p_post_id;
$$ LANGUAGE SQL STABLE;
