-- Phase 4 (docs/audit/02-plan.md): the analytics / tracking layer.
--
-- Before: every "view" cost the browser 2x blocks + 1x follows lookups before
-- an upsert whose anonymous conflict target pointed at a PARTIAL unique index
-- (always 42P10), into tables whose INSERT policies accepted any viewer_id
-- from anyone, and whose SELECT policies were missing (take_views: every
-- insert rejected by RLS on RETURNING) or wide open (post_views: anyone could
-- read who viewed what). Findings L3, B1, B2, S8.
--
-- After: one SECURITY DEFINER RPC per write. viewer_id comes from auth.uid(),
-- self-views and blocked pairs are skipped server-side, is_follower/is_member
-- are computed server-side, conflict targets are real unique indexes, and
-- reads are scoped to the content owner.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Non-partial session uniqueness (NULL session ids never collide, so the
--    logged-in rows are unaffected). Drop the partial duplicates.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS post_views_session_unique      ON public.post_views      (post_id, session_id, view_date);
CREATE UNIQUE INDEX IF NOT EXISTS take_views_session_unique      ON public.take_views      (take_id, session_id, view_date);
CREATE UNIQUE INDEX IF NOT EXISTS community_views_session_unique ON public.community_views (community_id, session_id, view_date);
CREATE UNIQUE INDEX IF NOT EXISTS profile_views_session_unique   ON public.profile_views   (profile_id, session_id, view_date);

DROP INDEX IF EXISTS public.idx_post_views_session_unique;
DROP INDEX IF EXISTS public.idx_take_views_session_unique;
DROP INDEX IF EXISTS public.idx_community_views_session_unique;
DROP INDEX IF EXISTS public.idx_profile_views_session_unique;
-- partial user indexes duplicate the *_user_unique constraints
DROP INDEX IF EXISTS public.idx_post_views_user_unique;
DROP INDEX IF EXISTS public.idx_take_views_user_unique;
DROP INDEX IF EXISTS public.idx_community_views_user_unique;
DROP INDEX IF EXISTS public.idx_profile_views_user_unique;

-- ---------------------------------------------------------------------------
-- 2. record_content_view(kind, id, session, source): the only write path
--    for post/take/community/profile views from the browser.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_content_view(
  p_kind text,
  p_target_id uuid,
  p_session_id text DEFAULT NULL,
  p_source text DEFAULT 'feed'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_session text := NULL;
  v_source text := left(COALESCE(NULLIF(btrim(p_source), ''), 'feed'), 32);
  v_owner uuid;
  v_follower boolean := false;
  v_member boolean := false;
BEGIN
  IF p_target_id IS NULL THEN
    RETURN false;
  END IF;

  IF v_viewer IS NULL THEN
    v_session := left(NULLIF(btrim(COALESCE(p_session_id, '')), ''), 64);
    IF v_session IS NULL THEN
      RETURN false;
    END IF;
  END IF;

  IF p_kind = 'post' THEN
    SELECT author_id INTO v_owner FROM posts WHERE id = p_target_id;
  ELSIF p_kind = 'take' THEN
    SELECT author_id INTO v_owner FROM takes WHERE id = p_target_id;
  ELSIF p_kind = 'profile' THEN
    SELECT id INTO v_owner FROM profiles WHERE id = p_target_id;
  ELSIF p_kind = 'community' THEN
    IF NOT EXISTS (SELECT 1 FROM communities WHERE id = p_target_id) THEN
      RETURN false;
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown view kind: %', p_kind;
  END IF;

  IF p_kind IN ('post', 'take', 'profile') THEN
    IF v_owner IS NULL THEN
      RETURN false;
    END IF;
    IF v_viewer IS NOT NULL THEN
      -- Self-views are not analytics.
      IF v_viewer = v_owner THEN
        RETURN false;
      END IF;
      -- Blocked either way: the content is hidden from this viewer; record nothing.
      IF EXISTS (
        SELECT 1 FROM blocks
        WHERE (blocker_id = v_viewer AND blocked_id = v_owner)
           OR (blocker_id = v_owner AND blocked_id = v_viewer)
      ) THEN
        RETURN false;
      END IF;
      v_follower := EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = v_viewer AND following_id = v_owner AND status = 'accepted'
      );
    END IF;
  ELSIF v_viewer IS NOT NULL THEN
    v_member := EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = p_target_id AND user_id = v_viewer AND status = 'active'
    );
  END IF;

  IF p_kind = 'post' THEN
    IF v_viewer IS NOT NULL THEN
      INSERT INTO post_views (post_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, v_viewer, NULL, v_source, v_follower)
      ON CONFLICT (post_id, viewer_id, view_date) DO NOTHING;
    ELSE
      INSERT INTO post_views (post_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, NULL, v_session, v_source, false)
      ON CONFLICT (post_id, session_id, view_date) DO NOTHING;
    END IF;
  ELSIF p_kind = 'take' THEN
    IF v_viewer IS NOT NULL THEN
      INSERT INTO take_views (take_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, v_viewer, NULL, v_source, v_follower)
      ON CONFLICT (take_id, viewer_id, view_date) DO NOTHING;
    ELSE
      INSERT INTO take_views (take_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, NULL, v_session, v_source, false)
      ON CONFLICT (take_id, session_id, view_date) DO NOTHING;
    END IF;
  ELSIF p_kind = 'community' THEN
    IF v_viewer IS NOT NULL THEN
      INSERT INTO community_views (community_id, viewer_id, session_id, is_member)
      VALUES (p_target_id, v_viewer, NULL, v_member)
      ON CONFLICT (community_id, viewer_id, view_date) DO NOTHING;
    ELSE
      INSERT INTO community_views (community_id, viewer_id, session_id, is_member)
      VALUES (p_target_id, NULL, v_session, false)
      ON CONFLICT (community_id, session_id, view_date) DO NOTHING;
    END IF;
  ELSE
    IF v_viewer IS NOT NULL THEN
      INSERT INTO profile_views (profile_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, v_viewer, NULL, v_source, v_follower)
      ON CONFLICT (profile_id, viewer_id, view_date) DO NOTHING;
    ELSE
      INSERT INTO profile_views (profile_id, viewer_id, session_id, source, is_follower)
      VALUES (p_target_id, NULL, v_session, v_source, false)
      ON CONFLICT (profile_id, session_id, view_date) DO NOTHING;
    END IF;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_content_view(text, uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_content_view(text, uuid, text, text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. update_content_view(kind, id, session, metrics): read time / watch
--    metrics for TODAY's row of the caller (or the caller's session).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_content_view(
  p_kind text,
  p_target_id uuid,
  p_session_id text DEFAULT NULL,
  p_metrics jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_viewer uuid := auth.uid();
  v_session text := NULL;
  v_read int;
  v_watch int;
  v_pct int;
  v_loops int;
  v_completed boolean;
BEGIN
  IF p_target_id IS NULL THEN RETURN; END IF;
  IF v_viewer IS NULL THEN
    v_session := left(NULLIF(btrim(COALESCE(p_session_id, '')), ''), 64);
    IF v_session IS NULL THEN RETURN; END IF;
  END IF;

  IF p_kind = 'post' THEN
    v_read := LEAST(GREATEST(COALESCE((p_metrics->>'read_time_seconds')::int, 0), 0), 86400);
    UPDATE post_views
    SET read_time_seconds = GREATEST(COALESCE(read_time_seconds, 0), v_read)
    WHERE post_id = p_target_id
      AND view_date = CURRENT_DATE
      AND ((v_viewer IS NOT NULL AND viewer_id = v_viewer)
        OR (v_viewer IS NULL AND session_id = v_session));
  ELSIF p_kind = 'take' THEN
    v_watch := LEAST(GREATEST(COALESCE((p_metrics->>'watch_time_seconds')::int, 0), 0), 86400);
    v_pct := LEAST(GREATEST(COALESCE((p_metrics->>'watch_percentage')::int, 0), 0), 100);
    v_loops := LEAST(GREATEST(COALESCE((p_metrics->>'loop_count')::int, 1), 1), 100000);
    v_completed := COALESCE((p_metrics->>'completed')::boolean, false);
    UPDATE take_views
    SET watch_time_seconds = GREATEST(COALESCE(watch_time_seconds, 0), v_watch),
        watch_percentage   = GREATEST(COALESCE(watch_percentage, 0), v_pct),
        loop_count         = GREATEST(COALESCE(loop_count, 1), v_loops),
        completed          = COALESCE(completed, false) OR v_completed
    WHERE take_id = p_target_id
      AND view_date = CURRENT_DATE
      AND ((v_viewer IS NOT NULL AND viewer_id = v_viewer)
        OR (v_viewer IS NULL AND session_id = v_session));
  ELSE
    RAISE EXCEPTION 'Unknown view kind: %', p_kind;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.update_content_view(text, uuid, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_content_view(text, uuid, text, jsonb) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. record_profile_view_admin: server route variant (it also has the geo
--    headers). Viewer is an explicit parameter, so service_role only.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.record_profile_view_admin(
  p_viewer_id uuid,
  p_profile_id uuid,
  p_session_id text,
  p_source text,
  p_country text,
  p_region text,
  p_city text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_session text := NULL;
  v_source text := left(COALESCE(NULLIF(btrim(p_source), ''), 'direct'), 32);
  v_follower boolean := false;
BEGIN
  IF p_profile_id IS NULL OR NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RETURN false;
  END IF;

  IF p_viewer_id IS NULL THEN
    v_session := left(NULLIF(btrim(COALESCE(p_session_id, '')), ''), 64);
    IF v_session IS NULL THEN RETURN false; END IF;
  ELSE
    IF p_viewer_id = p_profile_id THEN RETURN false; END IF;
    IF EXISTS (
      SELECT 1 FROM blocks
      WHERE (blocker_id = p_viewer_id AND blocked_id = p_profile_id)
         OR (blocker_id = p_profile_id AND blocked_id = p_viewer_id)
    ) THEN
      RETURN false;
    END IF;
    v_follower := EXISTS (
      SELECT 1 FROM follows
      WHERE follower_id = p_viewer_id AND following_id = p_profile_id AND status = 'accepted'
    );
  END IF;

  IF p_viewer_id IS NOT NULL THEN
    INSERT INTO profile_views (profile_id, viewer_id, session_id, source, is_follower, country, region, city)
    VALUES (p_profile_id, p_viewer_id, NULL, v_source, v_follower, p_country, p_region, p_city)
    ON CONFLICT (profile_id, viewer_id, view_date) DO NOTHING;
  ELSE
    INSERT INTO profile_views (profile_id, viewer_id, session_id, source, is_follower, country, region, city)
    VALUES (p_profile_id, NULL, v_session, v_source, false, p_country, p_region, p_city)
    ON CONFLICT (profile_id, session_id, view_date) DO NOTHING;
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.record_profile_view_admin(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_profile_view_admin(uuid, uuid, text, text, text, text, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Policies: no direct client writes to the view tables; reads scoped to
--    the content owner (insights) or community managers.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "log_post_views" ON public.post_views;
DROP POLICY IF EXISTS "Viewers can update their own post views" ON public.post_views;
DROP POLICY IF EXISTS "Anyone can read views" ON public.post_views;
DROP POLICY IF EXISTS "Authors can read their post views" ON public.post_views;
CREATE POLICY "Authors can read their post views" ON public.post_views
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_views.post_id AND p.author_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Anyone can record take views" ON public.take_views;
DROP POLICY IF EXISTS "Viewers can update their own take views" ON public.take_views;
DROP POLICY IF EXISTS "Authors can read their take views" ON public.take_views;
CREATE POLICY "Authors can read their take views" ON public.take_views
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.takes t WHERE t.id = take_views.take_id AND t.author_id = (SELECT auth.uid())));

DROP POLICY IF EXISTS "Anyone can record community views" ON public.community_views;
DROP POLICY IF EXISTS "Community managers can read community views" ON public.community_views;
CREATE POLICY "Community managers can read community views" ON public.community_views
  FOR SELECT TO authenticated
  USING (public.is_community_manager(community_id, (SELECT auth.uid())));

DROP POLICY IF EXISTS "Anyone can record profile views" ON public.profile_views;
DROP POLICY IF EXISTS "Users can read their own profile views" ON public.profile_views;
CREATE POLICY "Users can read their own profile views" ON public.profile_views
  FOR SELECT TO authenticated
  USING (profile_id = (SELECT auth.uid()));

-- Impressions stay a direct batched insert, but the viewer id must be the caller (or anonymous).
DROP POLICY IF EXISTS "Anyone can record take impressions" ON public.take_impressions;
DROP POLICY IF EXISTS "log_take_impressions" ON public.take_impressions;
CREATE POLICY "log_take_impressions" ON public.take_impressions
  FOR INSERT
  WITH CHECK (viewer_id IS NULL OR viewer_id = (SELECT auth.uid()));

-- user_locations: wrap auth.uid() (advisor auth_rls_initplan)
DROP POLICY IF EXISTS "Users can read their own location" ON public.user_locations;
CREATE POLICY "Users can read their own location" ON public.user_locations
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));
