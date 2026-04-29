-- Optimized Takes feed payload.
-- Keeps Reels-style feed loading to one paginated call with server-side counts.

CREATE OR REPLACE FUNCTION get_takes_feed(
  p_viewer_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 10,
  p_offset INTEGER DEFAULT 0,
  p_community_id UUID DEFAULT NULL,
  p_sound_id UUID DEFAULT NULL,
  p_author_id UUID DEFAULT NULL,
  p_initial_take_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  author_id UUID,
  video_url TEXT,
  thumbnail_url TEXT,
  caption TEXT,
  duration INTEGER,
  visibility TEXT,
  content_warning TEXT,
  sound_id UUID,
  view_count INTEGER,
  community_id UUID,
  created_at TIMESTAMPTZ,
  aspect_ratio TEXT,
  effects JSONB,
  text_overlays JSONB,
  playback_speed NUMERIC,
  allow_sound_use BOOLEAN,
  sound_start_time INTEGER,
  original_audio_volume INTEGER,
  added_sound_volume INTEGER,
  author_username TEXT,
  author_display_name TEXT,
  author_avatar_url TEXT,
  sound_name TEXT,
  sound_artist TEXT,
  sound_audio_url TEXT,
  sound_cover_url TEXT,
  sound_duration INTEGER,
  sound_genre TEXT,
  sound_is_original BOOLEAN,
  sound_original_take_id UUID,
  sound_created_by UUID,
  sound_use_count INTEGER,
  sound_is_trending BOOLEAN,
  sound_created_at TIMESTAMPTZ,
  reactions_count BIGINT,
  comments_count BIGINT,
  saves_count BIGINT,
  relays_count BIGINT,
  user_reaction_type TEXT,
  is_saved BOOLEAN,
  is_relayed BOOLEAN,
  reaction_counts JSONB
)
LANGUAGE SQL
SECURITY INVOKER
STABLE
AS $$
  WITH candidate_takes AS (
    SELECT
      t.*,
      1 AS feed_priority
    FROM takes t
    WHERE t.visibility = 'public'
      AND (p_community_id IS NULL OR t.community_id = p_community_id)
      AND (p_sound_id IS NULL OR t.sound_id = p_sound_id)
      AND (p_author_id IS NULL OR t.author_id = p_author_id)

    UNION ALL

    SELECT
      t.*,
      0 AS feed_priority
    FROM takes t
    WHERE p_offset = 0
      AND p_initial_take_id IS NOT NULL
      AND t.id = p_initial_take_id
      AND t.visibility = 'public'
      AND (p_community_id IS NULL OR t.community_id = p_community_id)
      AND (p_sound_id IS NULL OR t.sound_id = p_sound_id)
      AND (p_author_id IS NULL OR t.author_id = p_author_id)
  ),
  ranked_takes AS (
    SELECT
      candidate_takes.*,
      ROW_NUMBER() OVER (
        PARTITION BY candidate_takes.id
        ORDER BY candidate_takes.feed_priority ASC, candidate_takes.created_at DESC
      ) AS duplicate_rank
    FROM candidate_takes
  ),
  page_takes AS (
    SELECT *
    FROM ranked_takes
    WHERE duplicate_rank = 1
    ORDER BY feed_priority ASC, created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 30))
    OFFSET GREATEST(0, p_offset)
  )
  SELECT
    t.id,
    t.author_id,
    t.video_url,
    t.thumbnail_url,
    t.caption,
    t.duration,
    t.visibility,
    t.content_warning,
    t.sound_id,
    t.view_count,
    t.community_id,
    t.created_at,
    COALESCE(t.aspect_ratio, '9:16') AS aspect_ratio,
    COALESCE(t.effects, '[]'::jsonb) AS effects,
    COALESCE(t.text_overlays, '[]'::jsonb) AS text_overlays,
    COALESCE(t.playback_speed, 1.0) AS playback_speed,
    COALESCE(t.allow_sound_use, true) AS allow_sound_use,
    COALESCE(t.sound_start_time, 0) AS sound_start_time,
    COALESCE(t.original_audio_volume, 100) AS original_audio_volume,
    COALESCE(t.added_sound_volume, 100) AS added_sound_volume,
    p.username AS author_username,
    p.display_name AS author_display_name,
    p.avatar_url AS author_avatar_url,
    s.name AS sound_name,
    s.artist AS sound_artist,
    s.audio_url AS sound_audio_url,
    s.cover_url AS sound_cover_url,
    s.duration AS sound_duration,
    s.genre AS sound_genre,
    s.is_original AS sound_is_original,
    s.original_take_id AS sound_original_take_id,
    s.created_by AS sound_created_by,
    s.use_count AS sound_use_count,
    s.is_trending AS sound_is_trending,
    s.created_at AS sound_created_at,
    COALESCE(r.total, 0) AS reactions_count,
    COALESCE(c.total, 0) AS comments_count,
    COALESCE(sv.total, 0) AS saves_count,
    COALESCE(rl.total, 0) AS relays_count,
    ur.reaction_type AS user_reaction_type,
    COALESCE(us.is_saved, false) AS is_saved,
    COALESCE(ul.is_relayed, false) AS is_relayed,
    jsonb_build_object(
      'admire', COALESCE(r.admire, 0),
      'snap', COALESCE(r.snap, 0),
      'ovation', COALESCE(r.ovation, 0),
      'support', COALESCE(r.support, 0),
      'inspired', COALESCE(r.inspired, 0),
      'applaud', COALESCE(r.applaud, 0),
      'total', COALESCE(r.total, 0)
    ) AS reaction_counts
  FROM page_takes t
  JOIN profiles p ON p.id = t.author_id
  LEFT JOIN sounds s ON s.id = t.sound_id
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE reaction_type = 'admire') AS admire,
      COUNT(*) FILTER (WHERE reaction_type = 'snap') AS snap,
      COUNT(*) FILTER (WHERE reaction_type = 'ovation') AS ovation,
      COUNT(*) FILTER (WHERE reaction_type = 'support') AS support,
      COUNT(*) FILTER (WHERE reaction_type = 'inspired') AS inspired,
      COUNT(*) FILTER (WHERE reaction_type = 'applaud') AS applaud
    FROM take_reactions tr
    WHERE tr.take_id = t.id
  ) r ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM take_comments tc
    WHERE tc.take_id = t.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM take_saves ts
    WHERE ts.take_id = t.id
  ) sv ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total
    FROM take_relays trl
    WHERE trl.take_id = t.id
  ) rl ON true
  LEFT JOIN LATERAL (
    SELECT tr.reaction_type
    FROM take_reactions tr
    WHERE p_viewer_id IS NOT NULL
      AND tr.take_id = t.id
      AND tr.user_id = p_viewer_id
    LIMIT 1
  ) ur ON true
  LEFT JOIN LATERAL (
    SELECT true AS is_saved
    FROM take_saves ts
    WHERE p_viewer_id IS NOT NULL
      AND ts.take_id = t.id
      AND ts.user_id = p_viewer_id
    LIMIT 1
  ) us ON true
  LEFT JOIN LATERAL (
    SELECT true AS is_relayed
    FROM take_relays trl
    WHERE p_viewer_id IS NOT NULL
      AND trl.take_id = t.id
      AND trl.user_id = p_viewer_id
    LIMIT 1
  ) ul ON true
  ORDER BY t.feed_priority ASC, t.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_takes_feed(UUID, INTEGER, INTEGER, UUID, UUID, UUID, UUID) TO anon, authenticated;
