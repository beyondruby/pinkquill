-- IP-derived geolocation for audience insights.
-- profile_views gets country/region/city captured at view time so visitor
-- breakdowns work without requiring the visitor to fill in profiles.location.
-- A user_locations table caches each user's last-known geo so follower
-- breakdowns reflect where the follower actually is, not where they typed.

ALTER TABLE profile_views
  ADD COLUMN IF NOT EXISTS country TEXT,
  ADD COLUMN IF NOT EXISTS region TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT;

CREATE INDEX IF NOT EXISTS idx_profile_views_profile_country
  ON profile_views(profile_id, country)
  WHERE country IS NOT NULL;

CREATE TABLE IF NOT EXISTS user_locations (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  country TEXT,
  region TEXT,
  city TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE user_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own location" ON user_locations;
CREATE POLICY "Users can read their own location" ON user_locations
  FOR SELECT USING (user_id = auth.uid());

-- No insert/update policy: rows are written exclusively by the service role
-- from the tracking endpoint, which knows the IP and verifies the caller.

CREATE OR REPLACE FUNCTION get_audience_breakdown(
  p_profile_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_limit INTEGER DEFAULT 5
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_total_followers INTEGER := 0;
  v_verified_followers INTEGER := 0;
  v_follower_countries JSONB := '[]'::jsonb;
  v_follower_cities JSONB := '[]'::jsonb;
  v_viewer_countries JSONB := '[]'::jsonb;
  v_viewer_cities JSONB := '[]'::jsonb;
  v_located_followers INTEGER := 0;
  v_located_viewers INTEGER := 0;
  v_total_viewers INTEGER := 0;
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
  JOIN user_locations ul ON ul.user_id = f.follower_id
  WHERE f.following_id = p_profile_id
    AND f.status = 'accepted'
    AND ul.country IS NOT NULL;

  WITH country_counts AS (
    SELECT ul.country AS location, COUNT(*)::integer AS count
    FROM follows f
    JOIN user_locations ul ON ul.user_id = f.follower_id
    WHERE f.following_id = p_profile_id
      AND f.status = 'accepted'
      AND ul.country IS NOT NULL
    GROUP BY ul.country
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
  INTO v_follower_countries
  FROM country_counts;

  WITH city_counts AS (
    SELECT
      CASE
        WHEN ul.city IS NOT NULL AND ul.country IS NOT NULL
          THEN ul.city || ', ' || ul.country
        ELSE COALESCE(ul.city, ul.country)
      END AS location,
      COUNT(*)::integer AS count
    FROM follows f
    JOIN user_locations ul ON ul.user_id = f.follower_id
    WHERE f.following_id = p_profile_id
      AND f.status = 'accepted'
      AND ul.city IS NOT NULL
    GROUP BY ul.city, ul.country
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
  INTO v_follower_cities
  FROM city_counts;

  SELECT COUNT(DISTINCT COALESCE(viewer_id::text, 'session:' || session_id))
  INTO v_total_viewers
  FROM profile_views
  WHERE profile_id = p_profile_id
    AND view_date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(DISTINCT COALESCE(viewer_id::text, 'session:' || session_id))
  INTO v_located_viewers
  FROM profile_views
  WHERE profile_id = p_profile_id
    AND view_date BETWEEN p_start_date AND p_end_date
    AND country IS NOT NULL;

  WITH viewer_country_counts AS (
    SELECT country AS location,
           COUNT(DISTINCT COALESCE(viewer_id::text, 'session:' || session_id))::integer AS count
    FROM profile_views
    WHERE profile_id = p_profile_id
      AND view_date BETWEEN p_start_date AND p_end_date
      AND country IS NOT NULL
    GROUP BY country
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
  INTO v_viewer_countries
  FROM viewer_country_counts;

  WITH viewer_city_counts AS (
    SELECT
      CASE
        WHEN city IS NOT NULL AND country IS NOT NULL
          THEN city || ', ' || country
        ELSE COALESCE(city, country)
      END AS location,
      COUNT(DISTINCT COALESCE(viewer_id::text, 'session:' || session_id))::integer AS count
    FROM profile_views
    WHERE profile_id = p_profile_id
      AND view_date BETWEEN p_start_date AND p_end_date
      AND city IS NOT NULL
    GROUP BY city, country
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
  INTO v_viewer_cities
  FROM viewer_city_counts;

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
    'followerCountries', v_follower_countries,
    'followerCities', v_follower_cities,
    'viewerCountries', v_viewer_countries,
    'viewerCities', v_viewer_cities,
    'locatedFollowers', v_located_followers,
    'locatedViewers', v_located_viewers,
    'totalViewers', v_total_viewers,
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
