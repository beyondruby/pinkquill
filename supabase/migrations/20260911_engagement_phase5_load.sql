-- ============================================================================
-- Engagement Phase 5 — load, concurrency, live freshness
-- (docs/engagement/02-plan.md)
--
-- 1. Counter columns on posts/takes (reactions_count, comments_count,
--    relays_count, saves_count, reaction_counts jsonb) maintained by
--    SECURITY DEFINER triggers, backfilled, and reconciled nightly.
-- 2. Reads use the columns: list selects, the batched summaries,
--    post_/take_reaction_counts_json, get_takes_feed.
-- 3. Live freshness: a public broadcast per open post/take
--    (`content-events:<kind>:<id>`) with count deltas and comment ids.
-- 4. Dead objects: admires, take_admires, get_reaction_counts,
--    get_total_reactions, two redundant indexes; the insights RPCs stop
--    reading admires.
-- ============================================================================

-- 1. counter columns --------------------------------------------------------
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS reactions_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relays_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.takes
  ADD COLUMN IF NOT EXISTS reactions_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comments_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS relays_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS saves_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS reaction_counts jsonb NOT NULL DEFAULT '{}'::jsonb;

-- One row-level UPDATE per event; the row lock serialises concurrent writers
-- on a hot post, which is exactly what keeps the number right.
CREATE OR REPLACE FUNCTION public.engagement_bump_reaction(p_kind text, p_id uuid, p_type text, p_delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_kind = 'post' THEN
    UPDATE public.posts SET
      reactions_count = GREATEST(0, reactions_count + p_delta),
      reaction_counts = jsonb_set(COALESCE(reaction_counts, '{}'::jsonb), ARRAY[p_type],
        to_jsonb(GREATEST(0, COALESCE((reaction_counts ->> p_type)::int, 0) + p_delta)), true)
    WHERE id = p_id;
  ELSE
    UPDATE public.takes SET
      reactions_count = GREATEST(0, reactions_count + p_delta),
      reaction_counts = jsonb_set(COALESCE(reaction_counts, '{}'::jsonb), ARRAY[p_type],
        to_jsonb(GREATEST(0, COALESCE((reaction_counts ->> p_type)::int, 0) + p_delta)), true)
    WHERE id = p_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.engagement_bump_counter(p_kind text, p_id uuid, p_column text, p_delta int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_column NOT IN ('comments_count', 'relays_count', 'saves_count') THEN
    RAISE EXCEPTION 'bad counter %', p_column;
  END IF;
  EXECUTE format('UPDATE public.%I SET %I = GREATEST(0, %I + $1) WHERE id = $2',
                 CASE WHEN p_kind = 'post' THEN 'posts' ELSE 'takes' END, p_column, p_column)
  USING p_delta, p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_reactions_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.engagement_bump_reaction(v_kind, CASE WHEN v_kind = 'post' THEN NEW.post_id ELSE NEW.take_id END, NEW.reaction_type, 1);
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.engagement_bump_reaction(v_kind, CASE WHEN v_kind = 'post' THEN OLD.post_id ELSE OLD.take_id END, OLD.reaction_type, -1);
  ELSIF OLD.reaction_type IS DISTINCT FROM NEW.reaction_type THEN
    PERFORM public.engagement_bump_reaction(v_kind, CASE WHEN v_kind = 'post' THEN OLD.post_id ELSE OLD.take_id END, OLD.reaction_type, -1);
    PERFORM public.engagement_bump_reaction(v_kind, CASE WHEN v_kind = 'post' THEN NEW.post_id ELSE NEW.take_id END, NEW.reaction_type, 1);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_activity_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text := TG_ARGV[0];
  v_col text := TG_ARGV[1];
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.engagement_bump_counter(v_kind, CASE WHEN v_kind = 'post' THEN NEW.post_id ELSE NEW.take_id END, v_col, 1);
  ELSE
    PERFORM public.engagement_bump_counter(v_kind, CASE WHEN v_kind = 'post' THEN OLD.post_id ELSE OLD.take_id END, v_col, -1);
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger names start with "a_" so they run before the "z_" event triggers
-- below (same-table AFTER triggers fire in name order).
DROP TRIGGER IF EXISTS a_reactions_count ON public.reactions;
CREATE TRIGGER a_reactions_count AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_reactions_count('post');
DROP TRIGGER IF EXISTS a_take_reactions_count ON public.take_reactions;
CREATE TRIGGER a_take_reactions_count AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.take_reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_reactions_count('take');
DROP TRIGGER IF EXISTS a_comments_count ON public.comments;
CREATE TRIGGER a_comments_count AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_count('post', 'comments_count');
DROP TRIGGER IF EXISTS a_take_comments_count ON public.take_comments;
CREATE TRIGGER a_take_comments_count AFTER INSERT OR DELETE ON public.take_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_count('take', 'comments_count');
DROP TRIGGER IF EXISTS a_relays_count ON public.relays;
CREATE TRIGGER a_relays_count AFTER INSERT OR DELETE ON public.relays
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_count('post', 'relays_count');
DROP TRIGGER IF EXISTS a_take_relays_count ON public.take_relays;
CREATE TRIGGER a_take_relays_count AFTER INSERT OR DELETE ON public.take_relays
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_count('take', 'relays_count');
DROP TRIGGER IF EXISTS a_take_saves_count ON public.take_saves;
CREATE TRIGGER a_take_saves_count AFTER INSERT OR DELETE ON public.take_saves
  FOR EACH ROW EXECUTE FUNCTION public.trg_activity_count('take', 'saves_count');

-- Backfill + nightly reconciliation (returns how many rows drifted).
CREATE OR REPLACE FUNCTION public.engagement_reconcile_counts()
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_posts int := 0;
  v_takes int := 0;
BEGIN
  WITH agg AS (
    SELECT p.id,
      COALESCE((SELECT COUNT(*) FROM public.reactions r WHERE r.post_id = p.id), 0)::int AS reactions,
      COALESCE((SELECT COUNT(*) FROM public.comments c WHERE c.post_id = p.id), 0)::int AS comments,
      COALESCE((SELECT COUNT(*) FROM public.relays x WHERE x.post_id = p.id), 0)::int AS relays,
      COALESCE((SELECT jsonb_object_agg(t.reaction_type, t.n) FROM (
        SELECT reaction_type, COUNT(*) AS n FROM public.reactions r WHERE r.post_id = p.id GROUP BY reaction_type) t), '{}'::jsonb) AS per_type
    FROM public.posts p
  )
  UPDATE public.posts p SET
    reactions_count = agg.reactions, comments_count = agg.comments, relays_count = agg.relays, reaction_counts = agg.per_type
  FROM agg
  WHERE p.id = agg.id
    AND (p.reactions_count <> agg.reactions OR p.comments_count <> agg.comments OR p.relays_count <> agg.relays
         OR p.reaction_counts IS DISTINCT FROM agg.per_type);
  GET DIAGNOSTICS v_posts = ROW_COUNT;

  WITH agg AS (
    SELECT t.id,
      COALESCE((SELECT COUNT(*) FROM public.take_reactions r WHERE r.take_id = t.id), 0)::int AS reactions,
      COALESCE((SELECT COUNT(*) FROM public.take_comments c WHERE c.take_id = t.id), 0)::int AS comments,
      COALESCE((SELECT COUNT(*) FROM public.take_relays x WHERE x.take_id = t.id), 0)::int AS relays,
      COALESCE((SELECT COUNT(*) FROM public.take_saves s WHERE s.take_id = t.id), 0)::int AS saves,
      COALESCE((SELECT jsonb_object_agg(x.reaction_type, x.n) FROM (
        SELECT reaction_type, COUNT(*) AS n FROM public.take_reactions r WHERE r.take_id = t.id GROUP BY reaction_type) x), '{}'::jsonb) AS per_type
    FROM public.takes t
  )
  UPDATE public.takes t SET
    reactions_count = agg.reactions, comments_count = agg.comments, relays_count = agg.relays, saves_count = agg.saves, reaction_counts = agg.per_type
  FROM agg
  WHERE t.id = agg.id
    AND (t.reactions_count <> agg.reactions OR t.comments_count <> agg.comments OR t.relays_count <> agg.relays
         OR t.saves_count <> agg.saves OR t.reaction_counts IS DISTINCT FROM agg.per_type);
  GET DIAGNOSTICS v_takes = ROW_COUNT;
  RETURN v_posts + v_takes;
END;
$$;
REVOKE ALL ON FUNCTION public.engagement_reconcile_counts() FROM PUBLIC, anon, authenticated;
SELECT public.engagement_reconcile_counts();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'engagement-reconcile') THEN
    PERFORM cron.unschedule('engagement-reconcile');
  END IF;
  PERFORM cron.schedule('engagement-reconcile', '17 3 * * *', $c$SELECT public.engagement_reconcile_counts()$c$);
END $$;

-- 2. reads use the columns ---------------------------------------------------
CREATE OR REPLACE FUNCTION public.post_reaction_counts_json(p_post_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'admire',   COALESCE((p.reaction_counts ->> 'admire')::int, 0),
    'snap',     COALESCE((p.reaction_counts ->> 'snap')::int, 0),
    'ovation',  COALESCE((p.reaction_counts ->> 'ovation')::int, 0),
    'support',  COALESCE((p.reaction_counts ->> 'support')::int, 0),
    'inspired', COALESCE((p.reaction_counts ->> 'inspired')::int, 0),
    'applaud',  COALESCE((p.reaction_counts ->> 'applaud')::int, 0),
    'total',    p.reactions_count
  )
  FROM public.posts p WHERE p.id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION public.take_reaction_counts_json(p_take_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'admire',   COALESCE((t.reaction_counts ->> 'admire')::int, 0),
    'snap',     COALESCE((t.reaction_counts ->> 'snap')::int, 0),
    'ovation',  COALESCE((t.reaction_counts ->> 'ovation')::int, 0),
    'support',  COALESCE((t.reaction_counts ->> 'support')::int, 0),
    'inspired', COALESCE((t.reaction_counts ->> 'inspired')::int, 0),
    'applaud',  COALESCE((t.reaction_counts ->> 'applaud')::int, 0),
    'total',    t.reactions_count
  )
  FROM public.takes t WHERE t.id = p_take_id;
$$;

DROP FUNCTION IF EXISTS public.get_post_reaction_summary(uuid[]);
CREATE FUNCTION public.get_post_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int, mine text, comments int
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    x.id,
    COALESCE((p.reaction_counts ->> 'admire')::int, 0), COALESCE((p.reaction_counts ->> 'snap')::int, 0),
    COALESCE((p.reaction_counts ->> 'ovation')::int, 0), COALESCE((p.reaction_counts ->> 'support')::int, 0),
    COALESCE((p.reaction_counts ->> 'inspired')::int, 0), COALESCE((p.reaction_counts ->> 'applaud')::int, 0),
    COALESCE(p.reactions_count, 0),
    m.reaction_type,
    COALESCE(p.comments_count, 0)
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.posts p ON p.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.reactions r
    WHERE r.post_id = x.id AND r.user_id = auth.uid()
  ) m ON true;
$$;

DROP FUNCTION IF EXISTS public.get_take_reaction_summary(uuid[]);
CREATE FUNCTION public.get_take_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int, mine text, comments int
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    x.id,
    COALESCE((t.reaction_counts ->> 'admire')::int, 0), COALESCE((t.reaction_counts ->> 'snap')::int, 0),
    COALESCE((t.reaction_counts ->> 'ovation')::int, 0), COALESCE((t.reaction_counts ->> 'support')::int, 0),
    COALESCE((t.reaction_counts ->> 'inspired')::int, 0), COALESCE((t.reaction_counts ->> 'applaud')::int, 0),
    COALESCE(t.reactions_count, 0),
    m.reaction_type,
    COALESCE(t.comments_count, 0)
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.takes t ON t.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.take_reactions r
    WHERE r.take_id = x.id AND r.user_id = auth.uid()
  ) m ON true;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_summary(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reaction_summary(uuid[]) TO anon, authenticated;

-- get_takes_feed: counts from the columns (also fixes saves_count, which was
-- the viewer's own 0/1 because take_saves is owner-readable).
CREATE OR REPLACE FUNCTION public.get_takes_feed(
  p_viewer_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10, p_offset integer DEFAULT 0,
  p_community_id uuid DEFAULT NULL::uuid, p_sound_id uuid DEFAULT NULL::uuid, p_author_id uuid DEFAULT NULL::uuid,
  p_initial_take_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  id uuid, author_id uuid, video_url text, thumbnail_url text, caption text, duration integer, visibility text,
  content_warning text, sound_id uuid, view_count integer, community_id uuid, created_at timestamp with time zone,
  aspect_ratio text, effects jsonb, text_overlays jsonb, playback_speed numeric, allow_sound_use boolean,
  sound_start_time integer, original_audio_volume integer, added_sound_volume integer, author_username text,
  author_display_name text, author_avatar_url text, sound_name text, sound_artist text, sound_audio_url text,
  sound_cover_url text, sound_duration integer, sound_genre text, sound_is_original boolean,
  sound_original_take_id uuid, sound_created_by uuid, sound_use_count integer, sound_is_trending boolean,
  sound_created_at timestamp with time zone, reactions_count bigint, comments_count bigint, saves_count bigint,
  relays_count bigint, user_reaction_type text, is_saved boolean, is_relayed boolean, reaction_counts jsonb
)
LANGUAGE sql STABLE
SET search_path TO 'public', 'extensions'
AS $$
  WITH candidate_takes AS (
    SELECT t.*, 1 AS feed_priority
    FROM takes t
    WHERE t.visibility = 'public'
      AND (p_community_id IS NULL OR t.community_id = p_community_id)
      AND (p_sound_id IS NULL OR t.sound_id = p_sound_id)
      AND (p_author_id IS NULL OR t.author_id = p_author_id)
    UNION ALL
    SELECT t.*, 0 AS feed_priority
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
    SELECT candidate_takes.*,
      ROW_NUMBER() OVER (PARTITION BY candidate_takes.id ORDER BY candidate_takes.feed_priority ASC, candidate_takes.created_at DESC) AS duplicate_rank
    FROM candidate_takes
  ),
  page_takes AS (
    SELECT * FROM ranked_takes
    WHERE duplicate_rank = 1
    ORDER BY feed_priority ASC, created_at DESC
    LIMIT GREATEST(1, LEAST(p_limit, 30))
    OFFSET GREATEST(0, p_offset)
  )
  SELECT
    t.id, t.author_id, t.video_url, t.thumbnail_url, t.caption, t.duration, t.visibility, t.content_warning,
    t.sound_id, t.view_count, t.community_id, t.created_at,
    COALESCE(t.aspect_ratio, '9:16') AS aspect_ratio,
    COALESCE(t.effects, '[]'::jsonb) AS effects,
    COALESCE(t.text_overlays, '[]'::jsonb) AS text_overlays,
    COALESCE(t.playback_speed, 1.0) AS playback_speed,
    COALESCE(t.allow_sound_use, true) AS allow_sound_use,
    COALESCE(t.sound_start_time, 0) AS sound_start_time,
    COALESCE(t.original_audio_volume, 100) AS original_audio_volume,
    COALESCE(t.added_sound_volume, 100) AS added_sound_volume,
    p.username AS author_username, p.display_name AS author_display_name, p.avatar_url AS author_avatar_url,
    s.name AS sound_name, s.artist AS sound_artist, s.audio_url AS sound_audio_url, s.cover_url AS sound_cover_url,
    s.duration AS sound_duration, s.genre AS sound_genre, s.is_original AS sound_is_original,
    s.original_take_id AS sound_original_take_id, s.created_by AS sound_created_by, s.use_count AS sound_use_count,
    s.is_trending AS sound_is_trending, s.created_at AS sound_created_at,
    t.reactions_count::bigint AS reactions_count,
    t.comments_count::bigint AS comments_count,
    t.saves_count::bigint AS saves_count,
    t.relays_count::bigint AS relays_count,
    ur.reaction_type AS user_reaction_type,
    COALESCE(us.is_saved, false) AS is_saved,
    COALESCE(ul.is_relayed, false) AS is_relayed,
    jsonb_build_object(
      'admire',   COALESCE((t.reaction_counts ->> 'admire')::int, 0),
      'snap',     COALESCE((t.reaction_counts ->> 'snap')::int, 0),
      'ovation',  COALESCE((t.reaction_counts ->> 'ovation')::int, 0),
      'support',  COALESCE((t.reaction_counts ->> 'support')::int, 0),
      'inspired', COALESCE((t.reaction_counts ->> 'inspired')::int, 0),
      'applaud',  COALESCE((t.reaction_counts ->> 'applaud')::int, 0),
      'total',    t.reactions_count
    ) AS reaction_counts
  FROM page_takes t
  JOIN profiles p ON p.id = t.author_id
  LEFT JOIN sounds s ON s.id = t.sound_id
  LEFT JOIN LATERAL (
    SELECT tr.reaction_type FROM take_reactions tr
    WHERE p_viewer_id IS NOT NULL AND tr.take_id = t.id AND tr.user_id = p_viewer_id
    LIMIT 1
  ) ur ON true
  LEFT JOIN LATERAL (
    SELECT true AS is_saved FROM take_saves ts
    WHERE p_viewer_id IS NOT NULL AND ts.take_id = t.id AND ts.user_id = p_viewer_id
    LIMIT 1
  ) us ON true
  LEFT JOIN LATERAL (
    SELECT true AS is_relayed FROM take_relays trl
    WHERE p_viewer_id IS NOT NULL AND trl.take_id = t.id AND trl.user_id = p_viewer_id
    LIMIT 1
  ) ul ON true
  ORDER BY t.feed_priority ASC, t.created_at DESC;
$$;

-- 3. live content events ----------------------------------------------------
-- Public broadcast (counts only): `content-events:<kind>:<id>`. The count
-- triggers above are named a_* so the columns are already updated here.
CREATE OR REPLACE FUNCTION public.trg_content_events()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_kind text := TG_ARGV[0];   -- post | take
  v_what text := TG_ARGV[1];   -- reaction | comment
  v_id uuid;
  v_counts jsonb;
  v_comments int;
  v_payload jsonb;
BEGIN
  IF v_kind = 'post' THEN
    v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.post_id ELSE NEW.post_id END;
    SELECT public.post_reaction_counts_json(v_id), p.comments_count INTO v_counts, v_comments FROM public.posts p WHERE p.id = v_id;
  ELSE
    v_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.take_id ELSE NEW.take_id END;
    SELECT public.take_reaction_counts_json(v_id), t.comments_count INTO v_counts, v_comments FROM public.takes t WHERE t.id = v_id;
  END IF;
  IF v_counts IS NULL THEN RETURN NULL; END IF;  -- content is being deleted

  v_payload := jsonb_build_object(
    'kind', v_kind, 'id', v_id, 'what', v_what, 'op', TG_OP,
    'counts', v_counts, 'comments', v_comments,
    'actor_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END
  );
  IF v_what = 'comment' THEN
    v_payload := v_payload || jsonb_build_object(
      'comment_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
      'parent_id', CASE WHEN TG_OP = 'DELETE' THEN OLD.parent_id ELSE NEW.parent_id END
    );
  END IF;

  PERFORM realtime.send(v_payload, 'content_change', 'content-events:' || v_kind || ':' || v_id::text, false);
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.trg_content_events() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS z_reactions_events ON public.reactions;
CREATE TRIGGER z_reactions_events AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_content_events('post', 'reaction');
DROP TRIGGER IF EXISTS z_take_reactions_events ON public.take_reactions;
CREATE TRIGGER z_take_reactions_events AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.take_reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_content_events('take', 'reaction');
DROP TRIGGER IF EXISTS z_comments_events ON public.comments;
CREATE TRIGGER z_comments_events AFTER INSERT OR DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_content_events('post', 'comment');
DROP TRIGGER IF EXISTS z_take_comments_events ON public.take_comments;
CREATE TRIGGER z_take_comments_events AFTER INSERT OR DELETE ON public.take_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_content_events('take', 'comment');

-- 4. dead objects -----------------------------------------------------------
-- Insights RPCs: strip every `admires` term (the table is about to go).
DO $$
DECLARE
  src text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_creator_insights_summary';
  IF src IS NOT NULL THEN
    src := regexp_replace(src, 'post_admires AS \((.|\n)*?\),\n', '', 'g');
    src := regexp_replace(src, ' \+ COALESCE\(pa\.admires, 0\)', '', 'g');
    src := regexp_replace(src, 'post_admires pa, ', '', 'g');
    src := regexp_replace(src, '\s*UNION ALL\n\s*SELECT a\.created_at::date AS day, COUNT\(\*\) AS reactions\n\s*FROM admires a JOIN posts p ON p\.id = a\.post_id\n\s*WHERE p\.author_id = p_profile_id AND a\.created_at::date BETWEEN p_start_date AND p_end_date\n\s*GROUP BY a\.created_at::date', '', 'g');
    src := regexp_replace(src, '\s*LEFT JOIN LATERAL \(\n\s*SELECT COUNT\(\*\) AS count FROM admires a\n\s*WHERE a\.post_id = p\.id AND a\.created_at::date BETWEEN p_start_date AND p_end_date\n\s*\) admires ON true', '', 'g');
    src := regexp_replace(src, ' \+ COALESCE\(admires\.count, 0\)::integer', '', 'g');
    IF src ~* '\madmires\M' THEN RAISE EXCEPTION 'get_creator_insights_summary still references admires'; END IF;
    EXECUTE src;
  END IF;

  SELECT pg_get_functiondef(p.oid) INTO src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'get_community_insights_summary';
  IF src IS NOT NULL THEN
    src := regexp_replace(src, '\s*COALESCE\(\(SELECT COUNT\(\*\) FROM admires a JOIN posts p ON p\.id = a\.post_id WHERE p\.community_id = p_community_id AND a\.created_at::date BETWEEN p_start_date AND p_end_date\), 0\) \+', '', 'g');
    IF src ~* '\madmires\M' THEN RAISE EXCEPTION 'get_community_insights_summary still references admires'; END IF;
    EXECUTE src;
  END IF;
END $$;

DROP FUNCTION IF EXISTS public.get_reaction_counts(uuid);
DROP FUNCTION IF EXISTS public.get_total_reactions(uuid);
DROP TABLE IF EXISTS public.admires;
DROP TABLE IF EXISTS public.take_admires;
-- Redundant with reactions(post_id, user_id) / comments(post_id, created_at).
DROP INDEX IF EXISTS public.idx_reactions_post_id;
DROP INDEX IF EXISTS public.idx_comments_post_id;
