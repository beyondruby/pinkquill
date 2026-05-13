-- Restore the missing log_follower_change trigger and add audience-breakdown RPC.
-- The original definition lived in 20260510_insights_aggregate_rpcs.sql but never made
-- it into the applied migration; follower_history sat empty so growth charts and
-- gained/lost counters always read 0.

CREATE OR REPLACE FUNCTION log_follower_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id UUID;
  v_follower_count INTEGER;
  v_gained INTEGER := 0;
  v_lost INTEGER := 0;
BEGIN
  v_profile_id := COALESCE(NEW.following_id, OLD.following_id);

  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' THEN v_gained := 1; END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.status = 'accepted' THEN v_lost := 1; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF (OLD.status IS DISTINCT FROM 'accepted') AND NEW.status = 'accepted' THEN
      v_gained := 1;
    ELSIF OLD.status = 'accepted' AND (NEW.status IS DISTINCT FROM 'accepted') THEN
      v_lost := 1;
    END IF;
  END IF;

  IF v_gained = 0 AND v_lost = 0 THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COUNT(*) INTO v_follower_count
  FROM follows
  WHERE following_id = v_profile_id
    AND status = 'accepted';

  INSERT INTO follower_history (profile_id, date, follower_count, gained, lost, net_change)
  VALUES (
    v_profile_id,
    CURRENT_DATE,
    v_follower_count,
    v_gained,
    v_lost,
    v_gained - v_lost
  )
  ON CONFLICT (profile_id, date) DO UPDATE
  SET follower_count = EXCLUDED.follower_count,
      gained = follower_history.gained + EXCLUDED.gained,
      lost = follower_history.lost + EXCLUDED.lost,
      net_change = follower_history.net_change + EXCLUDED.net_change;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_follow_change ON follows;
CREATE TRIGGER on_follow_change
  AFTER INSERT OR DELETE OR UPDATE OF status ON follows
  FOR EACH ROW
  EXECUTE FUNCTION log_follower_change();

-- Backfill today's follower_count baseline so existing creators have a starting point.
INSERT INTO follower_history (profile_id, date, follower_count, gained, lost, net_change)
SELECT following_id, CURRENT_DATE, COUNT(*), 0, 0, 0
FROM follows
WHERE status = 'accepted'
GROUP BY following_id
ON CONFLICT (profile_id, date) DO UPDATE
SET follower_count = EXCLUDED.follower_count;

-- Audience breakdown RPC: top locations, verified followers, follower-vs-non-follower viewer mix.
CREATE OR REPLACE FUNCTION get_audience_breakdown(
  p_profile_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_total_followers INTEGER := 0;
  v_verified_followers INTEGER := 0;
  v_follower_locations JSONB := '[]'::jsonb;
  v_viewer_locations JSONB := '[]'::jsonb;
  v_located_followers INTEGER := 0;
  v_located_viewers INTEGER := 0;
  v_follower_views INTEGER := 0;
  v_nonfollower_views INTEGER := 0;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_total_followers
  FROM follows
  WHERE following_id = p_profile_id
    AND status = 'accepted';

  SELECT COUNT(*) INTO v_verified_followers
  FROM follows f
  JOIN profiles p ON p.id = f.follower_id
  WHERE f.following_id = p_profile_id
    AND f.status = 'accepted'
    AND p.is_verified = true;

  SELECT COUNT(*) INTO v_located_followers
  FROM follows f
  JOIN profiles p ON p.id = f.follower_id
  WHERE f.following_id = p_profile_id
    AND f.status = 'accepted'
    AND p.location IS NOT NULL
    AND TRIM(p.location) <> '';

  WITH loc AS (
    SELECT TRIM(p.location) AS location, COUNT(*)::integer AS count
    FROM follows f
    JOIN profiles p ON p.id = f.follower_id
    WHERE f.following_id = p_profile_id
      AND f.status = 'accepted'
      AND p.location IS NOT NULL
      AND TRIM(p.location) <> ''
    GROUP BY TRIM(p.location)
    ORDER BY count DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'location', location,
    'count', count,
    'percentage', CASE WHEN v_located_followers > 0
      THEN ROUND((count::numeric / v_located_followers) * 100, 1)
      ELSE 0 END
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO v_follower_locations
  FROM loc;

  SELECT COUNT(DISTINCT pv.viewer_id) INTO v_located_viewers
  FROM profile_views pv
  JOIN profiles p ON p.id = pv.viewer_id
  WHERE pv.profile_id = p_profile_id
    AND pv.view_date BETWEEN p_start_date AND p_end_date
    AND p.location IS NOT NULL
    AND TRIM(p.location) <> '';

  WITH viewer_loc AS (
    SELECT TRIM(p.location) AS location,
           COUNT(DISTINCT pv.viewer_id)::integer AS count
    FROM profile_views pv
    JOIN profiles p ON p.id = pv.viewer_id
    WHERE pv.profile_id = p_profile_id
      AND pv.view_date BETWEEN p_start_date AND p_end_date
      AND p.location IS NOT NULL
      AND TRIM(p.location) <> ''
    GROUP BY TRIM(p.location)
    ORDER BY count DESC
    LIMIT p_limit
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'location', location,
    'count', count,
    'percentage', CASE WHEN v_located_viewers > 0
      THEN ROUND((count::numeric / v_located_viewers) * 100, 1)
      ELSE 0 END
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO v_viewer_locations
  FROM viewer_loc;

  SELECT
    COUNT(*) FILTER (WHERE is_follower IS TRUE),
    COUNT(*) FILTER (WHERE is_follower IS NOT TRUE)
  INTO v_follower_views, v_nonfollower_views
  FROM profile_views
  WHERE profile_id = p_profile_id
    AND view_date BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'totalFollowers', v_total_followers,
    'verifiedFollowers', v_verified_followers,
    'followerLocations', v_follower_locations,
    'viewerLocations', v_viewer_locations,
    'locatedFollowers', v_located_followers,
    'locatedViewers', v_located_viewers,
    'viewerMix', jsonb_build_object(
      'followers', v_follower_views,
      'nonFollowers', v_nonfollower_views,
      'followerPercentage', CASE WHEN (v_follower_views + v_nonfollower_views) > 0
        THEN ROUND((v_follower_views::numeric / (v_follower_views + v_nonfollower_views)) * 100, 1)
        ELSE 0 END
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_audience_breakdown(UUID, DATE, DATE, INTEGER) TO authenticated;
