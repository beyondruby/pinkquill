-- Performance optimization: Server-side trending posts scoring
-- This function calculates trending scores on the server using the formula:
-- score = weighted_engagement / age_in_hours
-- Weights: admires=1, comments=1.5, relays=2

CREATE OR REPLACE FUNCTION get_trending_posts(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 20,
  p_offset INT DEFAULT 0,
  p_max_age_hours INT DEFAULT 72
)
RETURNS TABLE(
  post_id UUID,
  trending_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as post_id,
    -- Trending score = weighted engagement / age in hours
    (
      COALESCE((SELECT COUNT(*) FROM admires WHERE post_id = p.id), 0) * 1.0 +
      COALESCE((SELECT COUNT(*) FROM comments WHERE post_id = p.id), 0) * 1.5 +
      COALESCE((SELECT COUNT(*) FROM relays WHERE post_id = p.id), 0) * 2.0
    ) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) as trending_score
  FROM posts p
  WHERE
    p.status = 'published'
    AND p.visibility = 'public'
    AND p.created_at > NOW() - (p_max_age_hours || ' hours')::INTERVAL
    AND (p_user_id IS NULL OR p.author_id != p_user_id)
  ORDER BY trending_score DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;
