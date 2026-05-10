-- Insights aggregate RPCs.
-- These keep creator dashboards from downloading raw analytics events into the browser.

CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'feed',
  is_follower BOOLEAN DEFAULT false,
  read_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT DEFAULT 'feed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS take_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id UUID NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'feed',
  is_follower BOOLEAN DEFAULT false,
  watch_time_seconds INTEGER DEFAULT 0,
  watch_percentage INTEGER DEFAULT 0,
  loop_count INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS take_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id UUID NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT DEFAULT 'feed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'direct',
  is_follower BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_member BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follower_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  follower_count INTEGER DEFAULT 0,
  gained INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  net_change INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, date)
);

CREATE TABLE IF NOT EXISTS community_member_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_count INTEGER DEFAULT 0,
  joined INTEGER DEFAULT 0,
  "left" INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, date)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_user_unique
  ON post_views(post_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_session_unique
  ON post_views(post_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_take_views_user_unique
  ON take_views(take_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_take_views_session_unique
  ON take_views(take_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_user_unique
  ON profile_views(profile_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_session_unique
  ON profile_views(profile_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_views_user_unique
  ON community_views(community_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_views_session_unique
  ON community_views(community_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_post_views_post_date_source
  ON post_views(post_id, view_date, source);
CREATE INDEX IF NOT EXISTS idx_post_impressions_post_created
  ON post_impressions(post_id, created_at);
CREATE INDEX IF NOT EXISTS idx_take_views_take_date_source
  ON take_views(take_id, view_date, source);
CREATE INDEX IF NOT EXISTS idx_take_impressions_take_created
  ON take_impressions(take_id, created_at);
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_date_source
  ON profile_views(profile_id, view_date, source);
CREATE INDEX IF NOT EXISTS idx_community_views_community_date_member
  ON community_views(community_id, view_date, is_member);

CREATE OR REPLACE FUNCTION get_creator_insights_summary(
  p_profile_id UUID,
  p_start_date DATE,
  p_end_date DATE,
  p_prev_start_date DATE,
  p_prev_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_post_count INTEGER := 0;
  v_take_count INTEGER := 0;
  v_views INTEGER := 0;
  v_impressions INTEGER := 0;
  v_reach INTEGER := 0;
  v_prev_views INTEGER := 0;
  v_prev_impressions INTEGER := 0;
  v_prev_reach INTEGER := 0;
  v_engagement INTEGER := 0;
  v_followers INTEGER := 0;
  v_growth JSONB := '{}'::jsonb;
  v_views_by_day JSONB := '[]'::jsonb;
  v_traffic JSONB := '[]'::jsonb;
  v_top_content JSONB := '[]'::jsonb;
  v_breakdown JSONB := '{}'::jsonb;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_profile_id THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_post_count
  FROM posts
  WHERE author_id = p_profile_id;

  SELECT COUNT(*) INTO v_take_count
  FROM takes
  WHERE author_id = p_profile_id;

  SELECT COUNT(*) INTO v_views
  FROM (
    SELECT pv.id
    FROM post_views pv
    JOIN posts p ON p.id = pv.post_id
    WHERE p.author_id = p_profile_id
      AND pv.view_date BETWEEN p_start_date AND p_end_date
    UNION ALL
    SELECT tv.id
    FROM take_views tv
    JOIN takes t ON t.id = tv.take_id
    WHERE t.author_id = p_profile_id
      AND tv.view_date BETWEEN p_start_date AND p_end_date
  ) scoped_views;

  SELECT COUNT(*) INTO v_impressions
  FROM (
    SELECT pi.id
    FROM post_impressions pi
    JOIN posts p ON p.id = pi.post_id
    WHERE p.author_id = p_profile_id
      AND pi.created_at::date BETWEEN p_start_date AND p_end_date
    UNION ALL
    SELECT ti.id
    FROM take_impressions ti
    JOIN takes t ON t.id = ti.take_id
    WHERE t.author_id = p_profile_id
      AND ti.created_at::date BETWEEN p_start_date AND p_end_date
  ) scoped_impressions;

  SELECT COUNT(DISTINCT viewer_key) INTO v_reach
  FROM (
    SELECT COALESCE(pv.viewer_id::text, 'session:' || pv.session_id) AS viewer_key
    FROM post_views pv
    JOIN posts p ON p.id = pv.post_id
    WHERE p.author_id = p_profile_id
      AND pv.view_date BETWEEN p_start_date AND p_end_date
    UNION ALL
    SELECT COALESCE(tv.viewer_id::text, 'session:' || tv.session_id) AS viewer_key
    FROM take_views tv
    JOIN takes t ON t.id = tv.take_id
    WHERE t.author_id = p_profile_id
      AND tv.view_date BETWEEN p_start_date AND p_end_date
  ) scoped_reach
  WHERE viewer_key IS NOT NULL;

  SELECT COUNT(*) INTO v_prev_views
  FROM (
    SELECT pv.id
    FROM post_views pv
    JOIN posts p ON p.id = pv.post_id
    WHERE p.author_id = p_profile_id
      AND pv.view_date BETWEEN p_prev_start_date AND p_prev_end_date
    UNION ALL
    SELECT tv.id
    FROM take_views tv
    JOIN takes t ON t.id = tv.take_id
    WHERE t.author_id = p_profile_id
      AND tv.view_date BETWEEN p_prev_start_date AND p_prev_end_date
  ) scoped_prev_views;

  SELECT COUNT(*) INTO v_prev_impressions
  FROM (
    SELECT pi.id
    FROM post_impressions pi
    JOIN posts p ON p.id = pi.post_id
    WHERE p.author_id = p_profile_id
      AND pi.created_at::date BETWEEN p_prev_start_date AND p_prev_end_date
    UNION ALL
    SELECT ti.id
    FROM take_impressions ti
    JOIN takes t ON t.id = ti.take_id
    WHERE t.author_id = p_profile_id
      AND ti.created_at::date BETWEEN p_prev_start_date AND p_prev_end_date
  ) scoped_prev_impressions;

  SELECT COUNT(DISTINCT viewer_key) INTO v_prev_reach
  FROM (
    SELECT COALESCE(pv.viewer_id::text, 'session:' || pv.session_id) AS viewer_key
    FROM post_views pv
    JOIN posts p ON p.id = pv.post_id
    WHERE p.author_id = p_profile_id
      AND pv.view_date BETWEEN p_prev_start_date AND p_prev_end_date
    UNION ALL
    SELECT COALESCE(tv.viewer_id::text, 'session:' || tv.session_id) AS viewer_key
    FROM take_views tv
    JOIN takes t ON t.id = tv.take_id
    WHERE t.author_id = p_profile_id
      AND tv.view_date BETWEEN p_prev_start_date AND p_prev_end_date
  ) scoped_prev_reach
  WHERE viewer_key IS NOT NULL;

  WITH post_engagement AS (
    SELECT COUNT(*)::integer AS reactions FROM reactions r JOIN posts p ON p.id = r.post_id
    WHERE p.author_id = p_profile_id AND r.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  post_admires AS (
    SELECT COUNT(*)::integer AS admires FROM admires a JOIN posts p ON p.id = a.post_id
    WHERE p.author_id = p_profile_id AND a.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  post_comments AS (
    SELECT COUNT(*)::integer AS comments FROM comments c JOIN posts p ON p.id = c.post_id
    WHERE p.author_id = p_profile_id AND c.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  post_relays AS (
    SELECT COUNT(*)::integer AS relays FROM relays r JOIN posts p ON p.id = r.post_id
    WHERE p.author_id = p_profile_id AND r.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  post_saves AS (
    SELECT COUNT(*)::integer AS saves FROM saves s JOIN posts p ON p.id = s.post_id
    WHERE p.author_id = p_profile_id AND s.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  take_reacts AS (
    SELECT COUNT(*)::integer AS reactions FROM take_reactions tr JOIN takes t ON t.id = tr.take_id
    WHERE t.author_id = p_profile_id AND tr.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  take_comments_cte AS (
    SELECT COUNT(*)::integer AS comments FROM take_comments tc JOIN takes t ON t.id = tc.take_id
    WHERE t.author_id = p_profile_id AND tc.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  take_relays_cte AS (
    SELECT COUNT(*)::integer AS relays FROM take_relays tr JOIN takes t ON t.id = tr.take_id
    WHERE t.author_id = p_profile_id AND tr.created_at::date BETWEEN p_start_date AND p_end_date
  ),
  take_saves_cte AS (
    SELECT COUNT(*)::integer AS saves FROM take_saves ts JOIN takes t ON t.id = ts.take_id
    WHERE t.author_id = p_profile_id AND ts.created_at::date BETWEEN p_start_date AND p_end_date
  )
  SELECT
    COALESCE(pe.reactions, 0) + COALESCE(pa.admires, 0) + COALESCE(pc.comments, 0) +
      COALESCE(pr.relays, 0) + COALESCE(ps.saves, 0) + COALESCE(tr.reactions, 0) +
      COALESCE(tc.comments, 0) + COALESCE(tl.relays, 0) + COALESCE(ts.saves, 0),
    jsonb_build_object(
      'reactions', COALESCE(pe.reactions, 0) + COALESCE(pa.admires, 0) + COALESCE(tr.reactions, 0),
      'comments', COALESCE(pc.comments, 0) + COALESCE(tc.comments, 0),
      'relays', COALESCE(pr.relays, 0) + COALESCE(tl.relays, 0),
      'saves', COALESCE(ps.saves, 0) + COALESCE(ts.saves, 0)
    )
  INTO v_engagement, v_breakdown
  FROM post_engagement pe, post_admires pa, post_comments pc, post_relays pr, post_saves ps,
       take_reacts tr, take_comments_cte tc, take_relays_cte tl, take_saves_cte ts;

  SELECT COUNT(*) INTO v_followers
  FROM follows
  WHERE following_id = p_profile_id;

  WITH history AS (
    SELECT date, follower_count, gained, lost, net_change
    FROM follower_history
    WHERE profile_id = p_profile_id
      AND date BETWEEN p_start_date AND p_end_date
    ORDER BY date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(gained), 0)::integer AS gained,
      COALESCE(SUM(lost), 0)::integer AS lost,
      COALESCE(SUM(net_change), 0)::integer AS net_change
    FROM history
  )
  SELECT jsonb_build_object(
    'currentCount', v_followers,
    'netChange', totals.net_change,
    'gained', totals.gained,
    'lost', totals.lost,
    'percentageChange',
      CASE WHEN v_followers - totals.net_change > 0
        THEN ROUND((totals.net_change::numeric / (v_followers - totals.net_change)) * 100, 1)
        ELSE 0
      END,
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', h.date,
        'count', COALESCE(h.follower_count, 0),
        'netChange', COALESCE(h.net_change, 0)
      ) ORDER BY h.date)
      FROM history h
    ), '[]'::jsonb)
  )
  INTO v_growth
  FROM totals;

  WITH days AS (
    SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date AS date
  ),
  view_counts AS (
    SELECT day, SUM(views)::integer AS views
    FROM (
      SELECT pv.view_date AS day, COUNT(*) AS views
      FROM post_views pv JOIN posts p ON p.id = pv.post_id
      WHERE p.author_id = p_profile_id AND pv.view_date BETWEEN p_start_date AND p_end_date
      GROUP BY pv.view_date
      UNION ALL
      SELECT tv.view_date AS day, COUNT(*) AS views
      FROM take_views tv JOIN takes t ON t.id = tv.take_id
      WHERE t.author_id = p_profile_id AND tv.view_date BETWEEN p_start_date AND p_end_date
      GROUP BY tv.view_date
    ) scoped
    GROUP BY day
  ),
  impression_counts AS (
    SELECT day, SUM(impressions)::integer AS impressions
    FROM (
      SELECT pi.created_at::date AS day, COUNT(*) AS impressions
      FROM post_impressions pi JOIN posts p ON p.id = pi.post_id
      WHERE p.author_id = p_profile_id AND pi.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY pi.created_at::date
      UNION ALL
      SELECT ti.created_at::date AS day, COUNT(*) AS impressions
      FROM take_impressions ti JOIN takes t ON t.id = ti.take_id
      WHERE t.author_id = p_profile_id AND ti.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY ti.created_at::date
    ) scoped
    GROUP BY day
  ),
  reaction_counts AS (
    SELECT day, SUM(reactions)::integer AS reactions
    FROM (
      SELECT r.created_at::date AS day, COUNT(*) AS reactions
      FROM reactions r JOIN posts p ON p.id = r.post_id
      WHERE p.author_id = p_profile_id AND r.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY r.created_at::date
      UNION ALL
      SELECT a.created_at::date AS day, COUNT(*) AS reactions
      FROM admires a JOIN posts p ON p.id = a.post_id
      WHERE p.author_id = p_profile_id AND a.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY a.created_at::date
      UNION ALL
      SELECT tr.created_at::date AS day, COUNT(*) AS reactions
      FROM take_reactions tr JOIN takes t ON t.id = tr.take_id
      WHERE t.author_id = p_profile_id AND tr.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY tr.created_at::date
    ) scoped
    GROUP BY day
  ),
  comment_counts AS (
    SELECT day, SUM(comments)::integer AS comments
    FROM (
      SELECT c.created_at::date AS day, COUNT(*) AS comments
      FROM comments c JOIN posts p ON p.id = c.post_id
      WHERE p.author_id = p_profile_id AND c.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY c.created_at::date
      UNION ALL
      SELECT tc.created_at::date AS day, COUNT(*) AS comments
      FROM take_comments tc JOIN takes t ON t.id = tc.take_id
      WHERE t.author_id = p_profile_id AND tc.created_at::date BETWEEN p_start_date AND p_end_date
      GROUP BY tc.created_at::date
    ) scoped
    GROUP BY day
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', days.date,
    'views', COALESCE(view_counts.views, 0),
    'impressions', COALESCE(impression_counts.impressions, 0),
    'reactions', COALESCE(reaction_counts.reactions, 0),
    'comments', COALESCE(comment_counts.comments, 0)
  ) ORDER BY days.date), '[]'::jsonb)
  INTO v_views_by_day
  FROM days
  LEFT JOIN view_counts ON view_counts.day = days.date
  LEFT JOIN impression_counts ON impression_counts.day = days.date
  LEFT JOIN reaction_counts ON reaction_counts.day = days.date
  LEFT JOIN comment_counts ON comment_counts.day = days.date;

  WITH sources AS (
    SELECT source, COUNT(*)::integer AS count
    FROM (
      SELECT COALESCE(pv.source, 'direct') AS source
      FROM post_views pv JOIN posts p ON p.id = pv.post_id
      WHERE p.author_id = p_profile_id AND pv.view_date BETWEEN p_start_date AND p_end_date
      UNION ALL
      SELECT COALESCE(tv.source, 'direct') AS source
      FROM take_views tv JOIN takes t ON t.id = tv.take_id
      WHERE t.author_id = p_profile_id AND tv.view_date BETWEEN p_start_date AND p_end_date
    ) scoped
    GROUP BY source
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'source', source,
    'count', count,
    'percentage', CASE WHEN v_views > 0 THEN ROUND((count::numeric / v_views) * 100, 1) ELSE 0 END
  ) ORDER BY count DESC), '[]'::jsonb)
  INTO v_traffic
  FROM sources;

  WITH post_items AS (
    SELECT
      p.id,
      'post'::text AS item_type,
      p.title,
      p.type AS post_type,
      p.created_at,
      media.media_url AS thumbnail,
      COALESCE(views.views, 0)::integer AS views,
      COALESCE(impressions.impressions, 0)::integer AS impressions,
      COALESCE(reach.reach, 0)::integer AS reach,
      COALESCE(reactions.count, 0)::integer + COALESCE(admires.count, 0)::integer +
        COALESCE(comments.count, 0)::integer + COALESCE(relays.count, 0)::integer +
        COALESCE(saves.count, 0)::integer AS engagement
    FROM posts p
    LEFT JOIN LATERAL (
      SELECT media_url FROM post_media pm
      WHERE pm.post_id = p.id AND pm.media_type = 'image'
      ORDER BY pm.position
      LIMIT 1
    ) media ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS views FROM post_views pv
      WHERE pv.post_id = p.id AND pv.view_date BETWEEN p_start_date AND p_end_date
    ) views ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS impressions FROM post_impressions pi
      WHERE pi.post_id = p.id AND pi.created_at::date BETWEEN p_start_date AND p_end_date
    ) impressions ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT COALESCE(pv.viewer_id::text, 'session:' || pv.session_id)) AS reach
      FROM post_views pv
      WHERE pv.post_id = p.id AND pv.view_date BETWEEN p_start_date AND p_end_date
    ) reach ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM reactions r
      WHERE r.post_id = p.id AND r.created_at::date BETWEEN p_start_date AND p_end_date
    ) reactions ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM admires a
      WHERE a.post_id = p.id AND a.created_at::date BETWEEN p_start_date AND p_end_date
    ) admires ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM comments c
      WHERE c.post_id = p.id AND c.created_at::date BETWEEN p_start_date AND p_end_date
    ) comments ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM relays r
      WHERE r.post_id = p.id AND r.created_at::date BETWEEN p_start_date AND p_end_date
    ) relays ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM saves s
      WHERE s.post_id = p.id AND s.created_at::date BETWEEN p_start_date AND p_end_date
    ) saves ON true
    WHERE p.author_id = p_profile_id
  ),
  take_items AS (
    SELECT
      t.id,
      'take'::text AS item_type,
      t.caption AS title,
      NULL::text AS post_type,
      t.created_at,
      t.thumbnail_url AS thumbnail,
      COALESCE(views.views, 0)::integer AS views,
      COALESCE(impressions.impressions, 0)::integer AS impressions,
      COALESCE(reach.reach, 0)::integer AS reach,
      COALESCE(reactions.count, 0)::integer + COALESCE(comments.count, 0)::integer +
        COALESCE(relays.count, 0)::integer + COALESCE(saves.count, 0)::integer AS engagement
    FROM takes t
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS views FROM take_views tv
      WHERE tv.take_id = t.id AND tv.view_date BETWEEN p_start_date AND p_end_date
    ) views ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS impressions FROM take_impressions ti
      WHERE ti.take_id = t.id AND ti.created_at::date BETWEEN p_start_date AND p_end_date
    ) impressions ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(DISTINCT COALESCE(tv.viewer_id::text, 'session:' || tv.session_id)) AS reach
      FROM take_views tv
      WHERE tv.take_id = t.id AND tv.view_date BETWEEN p_start_date AND p_end_date
    ) reach ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM take_reactions tr
      WHERE tr.take_id = t.id AND tr.created_at::date BETWEEN p_start_date AND p_end_date
    ) reactions ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM take_comments tc
      WHERE tc.take_id = t.id AND tc.created_at::date BETWEEN p_start_date AND p_end_date
    ) comments ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM take_relays tr
      WHERE tr.take_id = t.id AND tr.created_at::date BETWEEN p_start_date AND p_end_date
    ) relays ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS count FROM take_saves ts
      WHERE ts.take_id = t.id AND ts.created_at::date BETWEEN p_start_date AND p_end_date
    ) saves ON true
    WHERE t.author_id = p_profile_id
  ),
  ranked AS (
    SELECT * FROM post_items
    UNION ALL
    SELECT * FROM take_items
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id,
    'type', item_type,
    'title', title,
    'thumbnail', thumbnail,
    'postType', post_type,
    'views', views,
    'impressions', impressions,
    'reach', reach,
    'engagement', engagement,
    'engagementRate', CASE WHEN reach > 0 THEN ROUND((engagement::numeric / reach) * 100, 1) ELSE 0 END,
    'createdAt', created_at
  ) ORDER BY views DESC, engagement DESC, created_at DESC), '[]'::jsonb)
  INTO v_top_content
  FROM (
    SELECT *
    FROM ranked
    ORDER BY views DESC, engagement DESC, created_at DESC
    LIMIT 10
  ) limited;

  RETURN jsonb_build_object(
    'totalViews', v_views,
    'totalImpressions', v_impressions,
    'totalReach', v_reach,
    'engagementRate', CASE WHEN v_reach > 0 THEN ROUND((v_engagement::numeric / v_reach) * 100, 1) ELSE 0 END,
    'totalEngagement', v_engagement,
    'engagementBreakdown', v_breakdown,
    'followerGrowth', v_growth,
    'topContent', v_top_content,
    'viewsByDay', v_views_by_day,
    'trafficSources', v_traffic,
    'previousPeriod', jsonb_build_object(
      'views', v_prev_views,
      'impressions', v_prev_impressions,
      'reach', v_prev_reach
    ),
    'contentCount', jsonb_build_object(
      'posts', v_post_count,
      'takes', v_take_count,
      'total', v_post_count + v_take_count
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_community_insights_summary(
  p_community_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
  v_member_count INTEGER := 0;
  v_page_views INTEGER := 0;
  v_unique_visitors INTEGER := 0;
  v_posts_created INTEGER := 0;
  v_takes_created INTEGER := 0;
  v_total_engagement INTEGER := 0;
  v_growth JSONB := '{}'::jsonb;
  v_views_by_day JSONB := '[]'::jsonb;
  v_member_mix JSONB := '{}'::jsonb;
  v_top_contributors JSONB := '[]'::jsonb;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM community_members cm
    WHERE cm.community_id = p_community_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
      AND cm.role IN ('admin', 'moderator')
  ) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM community_members
  WHERE community_id = p_community_id
    AND status = 'active';

  SELECT COUNT(*) INTO v_page_views
  FROM community_views
  WHERE community_id = p_community_id
    AND view_date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(DISTINCT COALESCE(viewer_id::text, 'session:' || session_id)) INTO v_unique_visitors
  FROM community_views
  WHERE community_id = p_community_id
    AND view_date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*) INTO v_posts_created
  FROM posts
  WHERE community_id = p_community_id
    AND created_at::date BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*) INTO v_takes_created
  FROM takes
  WHERE community_id = p_community_id
    AND created_at::date BETWEEN p_start_date AND p_end_date;

  WITH history AS (
    SELECT date, member_count, joined, "left"
    FROM community_member_history
    WHERE community_id = p_community_id
      AND date BETWEEN p_start_date AND p_end_date
    ORDER BY date
  ),
  totals AS (
    SELECT
      COALESCE(SUM(joined), 0)::integer AS joined,
      COALESCE(SUM("left"), 0)::integer AS left_count,
      COALESCE(SUM(joined - "left"), 0)::integer AS net_change
    FROM history
  )
  SELECT jsonb_build_object(
    'currentCount', v_member_count,
    'netChange', totals.net_change,
    'joined', totals.joined,
    'left', totals.left_count,
    'percentageChange',
      CASE WHEN v_member_count - totals.net_change > 0
        THEN ROUND((totals.net_change::numeric / (v_member_count - totals.net_change)) * 100, 1)
        ELSE 0
      END,
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', h.date,
        'count', COALESCE(h.member_count, 0),
        'netChange', COALESCE(h.joined, 0) - COALESCE(h."left", 0)
      ) ORDER BY h.date)
      FROM history h
    ), '[]'::jsonb)
  )
  INTO v_growth
  FROM totals;

  WITH days AS (
    SELECT generate_series(p_start_date, p_end_date, interval '1 day')::date AS date
  ),
  counts AS (
    SELECT view_date, COUNT(*)::integer AS views
    FROM community_views
    WHERE community_id = p_community_id
      AND view_date BETWEEN p_start_date AND p_end_date
    GROUP BY view_date
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'date', days.date,
    'views', COALESCE(counts.views, 0),
    'impressions', 0,
    'reactions', 0,
    'comments', 0
  ) ORDER BY days.date), '[]'::jsonb)
  INTO v_views_by_day
  FROM days
  LEFT JOIN counts ON counts.view_date = days.date;

  SELECT jsonb_build_object(
    'members', COUNT(*) FILTER (WHERE is_member),
    'nonMembers', COUNT(*) FILTER (WHERE NOT is_member),
    'memberPercentage',
      CASE WHEN COUNT(*) > 0
        THEN ROUND((COUNT(*) FILTER (WHERE is_member))::numeric / COUNT(*) * 100, 1)
        ELSE 0
      END
  )
  INTO v_member_mix
  FROM community_views
  WHERE community_id = p_community_id
    AND view_date BETWEEN p_start_date AND p_end_date;

  WITH post_engagement AS (
    SELECT
      COALESCE((SELECT COUNT(*) FROM reactions r JOIN posts p ON p.id = r.post_id WHERE p.community_id = p_community_id AND r.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM admires a JOIN posts p ON p.id = a.post_id WHERE p.community_id = p_community_id AND a.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM comments c JOIN posts p ON p.id = c.post_id WHERE p.community_id = p_community_id AND c.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM relays r JOIN posts p ON p.id = r.post_id WHERE p.community_id = p_community_id AND r.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM saves s JOIN posts p ON p.id = s.post_id WHERE p.community_id = p_community_id AND s.created_at::date BETWEEN p_start_date AND p_end_date), 0) AS count
  ),
  take_engagement AS (
    SELECT
      COALESCE((SELECT COUNT(*) FROM take_reactions tr JOIN takes t ON t.id = tr.take_id WHERE t.community_id = p_community_id AND tr.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM take_comments tc JOIN takes t ON t.id = tc.take_id WHERE t.community_id = p_community_id AND tc.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM take_relays tr JOIN takes t ON t.id = tr.take_id WHERE t.community_id = p_community_id AND tr.created_at::date BETWEEN p_start_date AND p_end_date), 0) +
      COALESCE((SELECT COUNT(*) FROM take_saves ts JOIN takes t ON t.id = ts.take_id WHERE t.community_id = p_community_id AND ts.created_at::date BETWEEN p_start_date AND p_end_date), 0) AS count
  )
  SELECT post_engagement.count + take_engagement.count
  INTO v_total_engagement
  FROM post_engagement, take_engagement;

  WITH post_counts AS (
    SELECT author_id, COUNT(*)::integer AS posts_count
    FROM posts
    WHERE community_id = p_community_id
      AND created_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY author_id
  ),
  take_counts AS (
    SELECT author_id, COUNT(*)::integer AS takes_count
    FROM takes
    WHERE community_id = p_community_id
      AND created_at::date BETWEEN p_start_date AND p_end_date
    GROUP BY author_id
  ),
  authors AS (
    SELECT author_id FROM post_counts
    UNION
    SELECT author_id FROM take_counts
  ),
  scored AS (
    SELECT
      a.author_id,
      COALESCE(pc.posts_count, 0) AS posts_count,
      COALESCE(tc.takes_count, 0) AS takes_count,
      COALESCE(post_reactions.count, 0) + COALESCE(take_reactions_count.count, 0) AS reactions_received,
      COALESCE(post_comments.count, 0) + COALESCE(take_comments_count.count, 0) AS comments_received
    FROM authors a
    LEFT JOIN post_counts pc ON pc.author_id = a.author_id
    LEFT JOIN take_counts tc ON tc.author_id = a.author_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS count
      FROM reactions r
      JOIN posts p ON p.id = r.post_id
      WHERE p.community_id = p_community_id
        AND p.author_id = a.author_id
        AND r.created_at::date BETWEEN p_start_date AND p_end_date
    ) post_reactions ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS count
      FROM take_reactions tr
      JOIN takes t ON t.id = tr.take_id
      WHERE t.community_id = p_community_id
        AND t.author_id = a.author_id
        AND tr.created_at::date BETWEEN p_start_date AND p_end_date
    ) take_reactions_count ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS count
      FROM comments c
      JOIN posts p ON p.id = c.post_id
      WHERE p.community_id = p_community_id
        AND p.author_id = a.author_id
        AND c.created_at::date BETWEEN p_start_date AND p_end_date
    ) post_comments ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::integer AS count
      FROM take_comments tcom
      JOIN takes t ON t.id = tcom.take_id
      WHERE t.community_id = p_community_id
        AND t.author_id = a.author_id
        AND tcom.created_at::date BETWEEN p_start_date AND p_end_date
    ) take_comments_count ON true
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'userId', p.id,
    'username', p.username,
    'displayName', p.display_name,
    'avatarUrl', p.avatar_url,
    'postsCount', s.posts_count,
    'takesCount', s.takes_count,
    'reactionsReceived', s.reactions_received,
    'commentsReceived', s.comments_received
  ) ORDER BY (s.posts_count + s.takes_count) DESC, s.reactions_received DESC, s.comments_received DESC), '[]'::jsonb)
  INTO v_top_contributors
  FROM (
    SELECT *
    FROM scored
    ORDER BY (posts_count + takes_count) DESC, reactions_received DESC, comments_received DESC
    LIMIT 10
  ) s
  JOIN profiles p ON p.id = s.author_id;

  RETURN jsonb_build_object(
    'communityId', p_community_id,
    'pageViews', v_page_views,
    'uniqueVisitors', v_unique_visitors,
    'memberGrowth', v_growth,
    'postsCreated', v_posts_created,
    'takesCreated', v_takes_created,
    'totalEngagement', v_total_engagement,
    'memberVisitorMix', v_member_mix,
    'topContributors', v_top_contributors,
    'viewsByDay', v_views_by_day
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_creator_insights_summary(UUID, DATE, DATE, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_insights_summary(UUID, DATE, DATE) TO authenticated;
