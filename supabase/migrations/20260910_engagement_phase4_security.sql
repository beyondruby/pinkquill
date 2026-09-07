-- ============================================================================
-- Engagement Phase 4 — security (docs/engagement/02-plan.md)
--
-- 1. Visibility + block rules as reusable functions; reactions/comments/likes
--    can only be read on content the viewer may see and never from someone
--    blocked either way; written only on content the actor may see.
-- 2. All engagement writes go through SECURITY DEFINER RPCs with explicit
--    checks and rate limits; direct INSERT/UPDATE/DELETE on the tables is
--    revoked from anon/authenticated.
-- 3. Tagging respects blocks and private accounts; tagged people can remove
--    themselves.
-- 4. The last client-side notification inserts (follows, collaborations,
--    community moderation) become triggers/RPCs and the open
--    `notifications` INSERT policy is dropped.
-- 5. `block_user` does the full cleanup server-side.
-- ============================================================================

-- 1. helpers ----------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.engagement_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.blocks b
    WHERE (b.blocker_id = p_a AND b.blocked_id = p_b) OR (b.blocker_id = p_b AND b.blocked_id = p_a)
  );
$$;

-- Mirrors posts_select_policy so RLS on child tables and the RPCs agree.
CREATE OR REPLACE FUNCTION public.engagement_can_view_post(p_post_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = p_post_id
      AND (
        (p.visibility = 'public' AND p.status = 'published')
        OR p.author_id = p_viewer
        OR (p_viewer IS NOT NULL AND p.visibility = 'followers' AND p.status = 'published'
            AND EXISTS (SELECT 1 FROM public.follows f
                        WHERE f.follower_id = p_viewer AND f.following_id = p.author_id AND f.status = 'accepted'))
        OR (p_viewer IS NOT NULL AND public.is_post_collaborator(p.id, p_viewer))
      )
      AND (p_viewer IS NULL OR p.author_id = p_viewer OR NOT public.engagement_blocked(p_viewer, p.author_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.engagement_can_view_take(p_take_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.takes t
    WHERE t.id = p_take_id
      AND (t.visibility = 'public' OR t.author_id = p_viewer)
      AND (p_viewer IS NULL OR t.author_id = p_viewer OR NOT public.engagement_blocked(p_viewer, t.author_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.engagement_can_engage(p_kind text, p_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_viewer IS NOT NULL AND CASE
    WHEN p_kind = 'post' THEN public.engagement_can_view_post(p_id, p_viewer)
    WHEN p_kind = 'take' THEN public.engagement_can_view_take(p_id, p_viewer)
    ELSE false END;
$$;

-- May p_author tag p_target on their content? Not themselves, not across a
-- block, and a private account only when it already follows the author.
CREATE OR REPLACE FUNCTION public.engagement_can_tag(p_author uuid, p_target uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_author IS NOT NULL AND p_target IS NOT NULL AND p_author <> p_target
     AND NOT public.engagement_blocked(p_author, p_target)
     AND EXISTS (
       SELECT 1 FROM public.profiles pr
       WHERE pr.id = p_target
         AND (COALESCE(pr.is_private, false) = false
              OR EXISTS (SELECT 1 FROM public.follows f
                         WHERE f.follower_id = p_target AND f.following_id = p_author AND f.status = 'accepted'))
     );
$$;

CREATE OR REPLACE FUNCTION public.engagement_rate_limit(p_scope text, p_limit int, p_window_seconds int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean;
BEGIN
  SELECT allowed INTO v_allowed
  FROM public.enforce_api_rate_limit(p_scope, auth.uid()::text, p_limit, p_window_seconds);
  IF NOT COALESCE(v_allowed, true) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'PQ429';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.engagement_blocked(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.engagement_can_view_post(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.engagement_can_view_take(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.engagement_can_engage(text, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.engagement_can_tag(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.engagement_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.engagement_blocked(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_can_view_post(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_can_view_take(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_can_engage(text, uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.engagement_can_tag(uuid, uuid) TO anon, authenticated;

-- 2. reactions: definer RPCs + read-only tables for clients -----------------
CREATE OR REPLACE FUNCTION public.set_post_reaction(p_post_id uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('admire','snap','ovation','support','inspired','applaud') THEN
    RAISE EXCEPTION 'INVALID_REACTION' USING ERRCODE = '22023';
  END IF;
  IF NOT public.engagement_can_engage('post', p_post_id, v_uid) THEN
    RAISE EXCEPTION 'POST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.engagement_rate_limit('reaction', 60, 60);

  SELECT reaction_type INTO v_prev FROM public.reactions WHERE post_id = p_post_id AND user_id = v_uid;
  INSERT INTO public.reactions (post_id, user_id, reaction_type)
  VALUES (p_post_id, v_uid, p_type)
  ON CONFLICT (post_id, user_id) DO UPDATE
    SET reaction_type = EXCLUDED.reaction_type, created_at = now()
    WHERE public.reactions.reaction_type IS DISTINCT FROM EXCLUDED.reaction_type;

  RETURN jsonb_build_object('mine', p_type, 'previous', v_prev, 'changed', v_prev IS DISTINCT FROM p_type,
                            'counts', public.post_reaction_counts_json(p_post_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_post_reaction(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.reactions WHERE post_id = p_post_id AND user_id = v_uid RETURNING reaction_type INTO v_prev;
  RETURN jsonb_build_object('mine', NULL, 'previous', v_prev, 'changed', v_prev IS NOT NULL,
                            'counts', public.post_reaction_counts_json(p_post_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.set_take_reaction(p_take_id uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF p_type IS NULL OR p_type NOT IN ('admire','snap','ovation','support','inspired','applaud') THEN
    RAISE EXCEPTION 'INVALID_REACTION' USING ERRCODE = '22023';
  END IF;
  IF NOT public.engagement_can_engage('take', p_take_id, v_uid) THEN
    RAISE EXCEPTION 'TAKE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.engagement_rate_limit('reaction', 60, 60);

  SELECT reaction_type INTO v_prev FROM public.take_reactions WHERE take_id = p_take_id AND user_id = v_uid;
  INSERT INTO public.take_reactions (take_id, user_id, reaction_type)
  VALUES (p_take_id, v_uid, p_type)
  ON CONFLICT (take_id, user_id) DO UPDATE
    SET reaction_type = EXCLUDED.reaction_type, created_at = now()
    WHERE public.take_reactions.reaction_type IS DISTINCT FROM EXCLUDED.reaction_type;

  RETURN jsonb_build_object('mine', p_type, 'previous', v_prev, 'changed', v_prev IS DISTINCT FROM p_type,
                            'counts', public.take_reaction_counts_json(p_take_id));
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_take_reaction(p_take_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  DELETE FROM public.take_reactions WHERE take_id = p_take_id AND user_id = v_uid RETURNING reaction_type INTO v_prev;
  RETURN jsonb_build_object('mine', NULL, 'previous', v_prev, 'changed', v_prev IS NOT NULL,
                            'counts', public.take_reaction_counts_json(p_take_id));
END;
$$;

-- Clients read reactions but never write them directly.
REVOKE INSERT, UPDATE, DELETE ON public.reactions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.take_reactions FROM anon, authenticated;
DROP POLICY IF EXISTS reactions_insert ON public.reactions;
DROP POLICY IF EXISTS reactions_update ON public.reactions;
DROP POLICY IF EXISTS reactions_delete ON public.reactions;
DROP POLICY IF EXISTS reactions_select ON public.reactions;
CREATE POLICY reactions_select ON public.reactions FOR SELECT
  USING (public.engagement_can_view_post(post_id, (SELECT auth.uid()))
         AND NOT public.engagement_blocked((SELECT auth.uid()), user_id));
DROP POLICY IF EXISTS auth_users_react_takes ON public.take_reactions;
DROP POLICY IF EXISTS take_reactions_update ON public.take_reactions;
DROP POLICY IF EXISTS take_reactions_delete ON public.take_reactions;
DROP POLICY IF EXISTS "Anyone can read reactions" ON public.take_reactions;
DROP POLICY IF EXISTS take_reactions_select ON public.take_reactions;
CREATE POLICY take_reactions_select ON public.take_reactions FOR SELECT
  USING (public.engagement_can_view_take(take_id, (SELECT auth.uid()))
         AND NOT public.engagement_blocked((SELECT auth.uid()), user_id));

-- 3. comments + likes: definer add/like RPCs, visibility-aware reads -------
CREATE OR REPLACE FUNCTION public.add_post_comment(
  p_post_id uuid, p_content text, p_parent_id uuid DEFAULT NULL, p_reply_to_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_content text := btrim(COALESCE(p_content, ''));
  v_parent public.comments%ROWTYPE;
  v_parent_id uuid := NULL;
  v_reply_to uuid := NULL;
  v_id uuid;
  v_created timestamptz;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF char_length(v_content) < 1 OR char_length(v_content) > 2200 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE = '22023';
  END IF;
  IF NOT public.engagement_can_engage('post', p_post_id, v_uid) THEN
    RAISE EXCEPTION 'POST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.engagement_rate_limit('comment', 20, 60);

  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.comments WHERE id = p_parent_id;
    IF v_parent.id IS NULL OR v_parent.post_id <> p_post_id THEN
      RAISE EXCEPTION 'PARENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    v_parent_id := COALESCE(v_parent.parent_id, v_parent.id);
    v_reply_to := COALESCE(p_reply_to_user_id, v_parent.user_id);
    IF v_reply_to = v_uid THEN v_reply_to := NULL; END IF;
  END IF;

  INSERT INTO public.comments (post_id, user_id, parent_id, reply_to_user_id, content)
  VALUES (p_post_id, v_uid, v_parent_id, v_reply_to, v_content)
  RETURNING id, created_at INTO v_id, v_created;
  SELECT COUNT(*) INTO v_count FROM public.comments WHERE post_id = p_post_id;
  RETURN jsonb_build_object('id', v_id, 'created_at', v_created, 'parent_id', v_parent_id,
                            'reply_to_user_id', v_reply_to, 'comments_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_take_comment(
  p_take_id uuid, p_content text, p_parent_id uuid DEFAULT NULL, p_reply_to_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_content text := btrim(COALESCE(p_content, ''));
  v_parent public.take_comments%ROWTYPE;
  v_parent_id uuid := NULL;
  v_reply_to uuid := NULL;
  v_id uuid;
  v_created timestamptz;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF char_length(v_content) < 1 OR char_length(v_content) > 2200 THEN
    RAISE EXCEPTION 'INVALID_CONTENT' USING ERRCODE = '22023';
  END IF;
  IF NOT public.engagement_can_engage('take', p_take_id, v_uid) THEN
    RAISE EXCEPTION 'TAKE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  PERFORM public.engagement_rate_limit('comment', 20, 60);

  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.take_comments WHERE id = p_parent_id;
    IF v_parent.id IS NULL OR v_parent.take_id <> p_take_id THEN
      RAISE EXCEPTION 'PARENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    v_parent_id := COALESCE(v_parent.parent_id, v_parent.id);
    v_reply_to := COALESCE(p_reply_to_user_id, v_parent.user_id);
    IF v_reply_to = v_uid THEN v_reply_to := NULL; END IF;
  END IF;

  INSERT INTO public.take_comments (take_id, user_id, parent_id, reply_to_user_id, content)
  VALUES (p_take_id, v_uid, v_parent_id, v_reply_to, v_content)
  RETURNING id, created_at INTO v_id, v_created;
  SELECT COUNT(*) INTO v_count FROM public.take_comments WHERE take_id = p_take_id;
  RETURN jsonb_build_object('id', v_id, 'created_at', v_created, 'parent_id', v_parent_id,
                            'reply_to_user_id', v_reply_to, 'comments_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_post_comment_like(p_comment_id uuid, p_liked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post uuid;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  SELECT post_id INTO v_post FROM public.comments WHERE id = p_comment_id;
  IF v_post IS NULL OR NOT public.engagement_can_engage('post', v_post, v_uid) THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_liked THEN
    PERFORM public.engagement_rate_limit('comment_like', 60, 60);
    INSERT INTO public.comment_likes (comment_id, user_id) VALUES (p_comment_id, v_uid)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.comment_likes WHERE comment_id = p_comment_id AND user_id = v_uid;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.comment_likes WHERE comment_id = p_comment_id;
  RETURN jsonb_build_object('liked', p_liked, 'likes_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_take_comment_like(p_comment_id uuid, p_liked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_take uuid;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  SELECT take_id INTO v_take FROM public.take_comments WHERE id = p_comment_id;
  IF v_take IS NULL OR NOT public.engagement_can_engage('take', v_take, v_uid) THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_liked THEN
    PERFORM public.engagement_rate_limit('comment_like', 60, 60);
    INSERT INTO public.take_comment_likes (comment_id, user_id) VALUES (p_comment_id, v_uid)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.take_comment_likes WHERE comment_id = p_comment_id AND user_id = v_uid;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.take_comment_likes WHERE comment_id = p_comment_id;
  RETURN jsonb_build_object('liked', p_liked, 'likes_count', v_count);
END;
$$;

REVOKE INSERT, UPDATE ON public.comments FROM anon, authenticated;
REVOKE INSERT, UPDATE ON public.take_comments FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.comment_likes FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.take_comment_likes FROM anon, authenticated;

DROP POLICY IF EXISTS "Comments are viewable by everyone" ON public.comments;
DROP POLICY IF EXISTS "Users can create comments" ON public.comments;
DROP POLICY IF EXISTS "Users can update own comments" ON public.comments;
DROP POLICY IF EXISTS comments_select ON public.comments;
CREATE POLICY comments_select ON public.comments FOR SELECT
  USING (public.engagement_can_view_post(post_id, (SELECT auth.uid()))
         AND NOT public.engagement_blocked((SELECT auth.uid()), user_id));

DROP POLICY IF EXISTS take_comments_select ON public.take_comments;
DROP POLICY IF EXISTS take_comments_insert ON public.take_comments;
DROP POLICY IF EXISTS take_comments_update ON public.take_comments;
CREATE POLICY take_comments_select ON public.take_comments FOR SELECT
  USING (public.engagement_can_view_take(take_id, (SELECT auth.uid()))
         AND NOT public.engagement_blocked((SELECT auth.uid()), user_id));

DROP POLICY IF EXISTS comment_likes_insert ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_delete ON public.comment_likes;
DROP POLICY IF EXISTS comment_likes_select ON public.comment_likes;
CREATE POLICY comment_likes_select ON public.comment_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.comments c WHERE c.id = comment_id));
DROP POLICY IF EXISTS take_comment_likes_insert ON public.take_comment_likes;
DROP POLICY IF EXISTS take_comment_likes_delete ON public.take_comment_likes;
DROP POLICY IF EXISTS take_comment_likes_select ON public.take_comment_likes;
CREATE POLICY take_comment_likes_select ON public.take_comment_likes FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.take_comments c WHERE c.id = comment_id));

-- Mentions in comments: cap at 10 per comment.
CREATE OR REPLACE FUNCTION public.engagement_comment_notify(
  p_kind text, p_comment_id uuid, p_content_id uuid, p_actor uuid,
  p_parent_id uuid, p_reply_to uuid, p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_target uuid;
  v_post_id uuid := CASE WHEN p_kind = 'post' THEN p_content_id END;
  v_take_id uuid := CASE WHEN p_kind = 'take' THEN p_content_id END;
  v_excerpt text := LEFT(p_content, 100);
  v_notified uuid[] := ARRAY[p_actor];
  v_name text;
  v_uid uuid;
  v_mentions int := 0;
BEGIN
  IF p_kind = 'post' THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = p_content_id;
  ELSE
    SELECT author_id INTO v_author FROM public.takes WHERE id = p_content_id;
  END IF;

  IF p_parent_id IS NULL THEN
    IF public.engagement_notify_allowed(v_author, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_author, p_actor, 'comment', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_author;
    END IF;
  ELSE
    IF p_reply_to IS NOT NULL THEN
      v_target := p_reply_to;
    ELSIF p_kind = 'post' THEN
      SELECT user_id INTO v_target FROM public.comments WHERE id = p_parent_id;
    ELSE
      SELECT user_id INTO v_target FROM public.take_comments WHERE id = p_parent_id;
    END IF;
    IF public.engagement_notify_allowed(v_target, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_target, p_actor, 'reply', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_target;
    END IF;
    IF v_author IS DISTINCT FROM v_target AND public.engagement_notify_allowed(v_author, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_author, p_actor, 'comment', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_author;
    END IF;
  END IF;

  FOR v_name IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(p_content, '(?:^|[^\w@.])@([A-Za-z0-9_]{2,30})', 'g') AS m
  LOOP
    EXIT WHEN v_mentions >= 10;
    SELECT id INTO v_uid FROM public.profiles WHERE lower(username) = v_name;
    IF v_uid IS NULL THEN CONTINUE; END IF;
    v_mentions := v_mentions + 1;
    IF p_kind = 'post' THEN
      INSERT INTO public.comment_mentions (comment_id, user_id) VALUES (p_comment_id, v_uid) ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.take_comment_mentions (comment_id, user_id) VALUES (p_comment_id, v_uid) ON CONFLICT DO NOTHING;
    END IF;
    IF NOT (v_uid = ANY (v_notified)) AND public.engagement_notify_allowed(v_uid, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_uid, p_actor, 'mention', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_uid;
    END IF;
  END LOOP;
END;
$$;

-- 4. tagging ----------------------------------------------------------------
-- Restrictive policies AND with the existing author checks.
DROP POLICY IF EXISTS post_mentions_tag_rules ON public.post_mentions;
CREATE POLICY post_mentions_tag_rules ON public.post_mentions AS RESTRICTIVE FOR INSERT
  WITH CHECK (public.engagement_can_tag((SELECT auth.uid()), user_id));
DROP POLICY IF EXISTS take_mentions_tag_rules ON public.take_mentions;
CREATE POLICY take_mentions_tag_rules ON public.take_mentions AS RESTRICTIVE FOR INSERT
  WITH CHECK (public.engagement_can_tag((SELECT auth.uid()), user_id));

-- The tagged person can always remove themselves.
DROP POLICY IF EXISTS post_mentions_self_remove ON public.post_mentions;
CREATE POLICY post_mentions_self_remove ON public.post_mentions FOR DELETE
  USING (user_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS take_mentions_self_remove ON public.take_mentions;
CREATE POLICY take_mentions_self_remove ON public.take_mentions FOR DELETE
  USING (user_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.remove_self_mention(p_kind text, p_content_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_n int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF p_kind = 'post' THEN
    DELETE FROM public.post_mentions WHERE post_id = p_content_id AND user_id = v_uid;
  ELSE
    DELETE FROM public.take_mentions WHERE take_id = p_content_id AND user_id = v_uid;
  END IF;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.remove_self_mention(text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_self_mention(text, uuid) TO authenticated;

-- create_post_with_relations: same tag rules on the create path.
CREATE OR REPLACE FUNCTION public.create_post_with_relations(
  p_type text, p_title text DEFAULT NULL::text, p_content text DEFAULT ''::text, p_visibility text DEFAULT 'public'::text,
  p_content_warning text DEFAULT NULL::text, p_community_id uuid DEFAULT NULL::uuid, p_flair_id uuid DEFAULT NULL::uuid,
  p_styling jsonb DEFAULT NULL::jsonb, p_post_location text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb,
  p_spotify_track jsonb DEFAULT NULL::jsonb, p_collaborators jsonb DEFAULT '[]'::jsonb, p_mentions uuid[] DEFAULT ARRAY[]::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id UUID;
  v_post_id UUID;
  v_collaborators_json JSONB := COALESCE(p_collaborators, '[]'::jsonb);
  v_collaborators_added INTEGER := 0;
  v_mentions_added INTEGER := 0;
  v_status TEXT := 'published';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_visibility NOT IN ('public', 'followers', 'private') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid visibility value');
  END IF;

  IF jsonb_typeof(v_collaborators_json) <> 'array' THEN
    RAISE EXCEPTION 'p_collaborators must be a JSON array';
  END IF;

  INSERT INTO posts (author_id, type, title, content, visibility, content_warning, community_id, flair_id, styling, post_location, metadata, spotify_track, status)
  VALUES (v_user_id, p_type, NULLIF(BTRIM(COALESCE(p_title, '')), ''), COALESCE(p_content, ''), p_visibility,
          NULLIF(BTRIM(COALESCE(p_content_warning, '')), ''), p_community_id, p_flair_id, p_styling,
          NULLIF(BTRIM(COALESCE(p_post_location, '')), ''), p_metadata, p_spotify_track, v_status)
  RETURNING id INTO v_post_id;

  WITH parsed_collaborators AS (
    SELECT DISTINCT
      (collab->>'id')::UUID AS user_id,
      NULLIF(BTRIM(COALESCE(collab->>'role', '')), '') AS role
    FROM jsonb_array_elements(v_collaborators_json) AS collab
    WHERE collab ? 'id'
      AND NULLIF(BTRIM(COALESCE(collab->>'id', '')), '') IS NOT NULL
      AND (collab->>'id')::UUID <> v_user_id
      AND NOT public.engagement_blocked(v_user_id, (collab->>'id')::UUID)
  )
  INSERT INTO post_collaborators (post_id, user_id, status, role)
  SELECT v_post_id, user_id, 'pending', role
  FROM parsed_collaborators
  ON CONFLICT (post_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_collaborators_added = ROW_COUNT;

  IF p_mentions IS NOT NULL AND array_length(p_mentions, 1) IS NOT NULL THEN
    INSERT INTO post_mentions (post_id, user_id)
    SELECT v_post_id, mention_id
    FROM (SELECT DISTINCT unnest(p_mentions) AS mention_id) mentions
    WHERE mention_id IS NOT NULL
      AND mention_id <> v_user_id
      AND public.engagement_can_tag(v_user_id, mention_id)
    ON CONFLICT (post_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_mentions_added = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object('success', true, 'post_id', v_post_id, 'status', v_status,
                            'collaborators_added', v_collaborators_added, 'mentions_added', v_mentions_added);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- 5. remaining notification flows → triggers / RPCs -------------------------

-- follows
CREATE OR REPLACE FUNCTION public.trg_follows_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type IN ('follow', 'follow_request') AND actor_id = OLD.follower_id AND user_id = OLD.following_id;
    RETURN OLD;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'accepted' AND public.engagement_notify_allowed(NEW.following_id, NEW.follower_id, 'follows') THEN
      PERFORM public.engagement_notify_insert(NEW.following_id, NEW.follower_id, 'follow', NULL, NULL, NULL, NULL, NULL);
    ELSIF NEW.status = 'pending' AND public.engagement_notify_allowed(NEW.following_id, NEW.follower_id, 'follows') THEN
      PERFORM public.engagement_notify_insert(NEW.following_id, NEW.follower_id, 'follow_request', NULL, NULL, NULL, NULL, NULL);
    END IF;
    RETURN NEW;
  END IF;
  -- UPDATE: request accepted
  IF OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    DELETE FROM public.notifications
    WHERE type = 'follow_request' AND actor_id = NEW.follower_id AND user_id = NEW.following_id;
    IF public.engagement_notify_allowed(NEW.following_id, NEW.follower_id, 'follows') THEN
      PERFORM public.engagement_notify_insert(NEW.following_id, NEW.follower_id, 'follow', NULL, NULL, NULL, NULL, NULL);
    END IF;
    IF public.engagement_notify_allowed(NEW.follower_id, NEW.following_id, 'follows') THEN
      PERFORM public.engagement_notify_insert(NEW.follower_id, NEW.following_id, 'follow_request_accepted', NULL, NULL, NULL, NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS follows_notify ON public.follows;
CREATE TRIGGER follows_notify
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.trg_follows_notify();

-- collaborations
CREATE OR REPLACE FUNCTION public.trg_post_collaborators_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'collaboration_invite' AND user_id = OLD.user_id AND post_id = OLD.post_id;
    SELECT author_id INTO v_author FROM public.posts WHERE id = OLD.post_id;
    IF auth.uid() = OLD.user_id AND OLD.status = 'accepted'
       AND public.engagement_notify_allowed(v_author, OLD.user_id, 'collaborations') THEN
      PERFORM public.engagement_notify_insert(v_author, OLD.user_id, 'collaboration_removed', OLD.post_id, NULL, NULL, NULL, NULL);
    END IF;
    RETURN OLD;
  END IF;
  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF TG_OP = 'INSERT' THEN
    IF NEW.status = 'pending' AND public.engagement_notify_allowed(NEW.user_id, v_author, 'collaborations') THEN
      PERFORM public.engagement_notify_insert(NEW.user_id, v_author, 'collaboration_invite', NEW.post_id, NULL, NULL, NULL, NULL);
    END IF;
    RETURN NEW;
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('accepted', 'declined') THEN
    UPDATE public.notifications SET read = true
    WHERE type = 'collaboration_invite' AND user_id = NEW.user_id AND post_id = NEW.post_id AND read = false;
    IF public.engagement_notify_allowed(v_author, NEW.user_id, 'collaborations') THEN
      PERFORM public.engagement_notify_insert(v_author, NEW.user_id,
        CASE WHEN NEW.status = 'accepted' THEN 'collaboration_accepted' ELSE 'collaboration_declined' END,
        NEW.post_id, NULL, NULL, NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS post_collaborators_notify ON public.post_collaborators;
CREATE TRIGGER post_collaborators_notify
  AFTER INSERT OR UPDATE OF status OR DELETE ON public.post_collaborators
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_collaborators_notify();

-- community role / mute / ban
CREATE OR REPLACE FUNCTION public.trg_community_members_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_content text;
  v_perms text;
BEGIN
  IF v_actor IS NULL OR v_actor = NEW.user_id THEN RETURN NEW; END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_content := 'Your role has been changed to ' || NEW.role;
    IF NEW.role = 'moderator' AND NEW.permissions IS NOT NULL THEN
      SELECT string_agg(replace(replace(key, 'can_', ''), '_', ' '), ', ')
      INTO v_perms
      FROM jsonb_each_text(NEW.permissions) WHERE value = 'true';
      IF v_perms IS NOT NULL THEN v_content := v_content || '. You can: ' || v_perms; END IF;
    END IF;
    IF public.engagement_notify_allowed(NEW.user_id, v_actor, 'communities') THEN
      INSERT INTO public.notifications (user_id, actor_id, type, community_id, content)
      VALUES (NEW.user_id, v_actor, 'community_role_change', NEW.community_id, v_content);
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('muted', 'banned') THEN
    IF NEW.status = 'muted' THEN
      v_content := CASE WHEN NEW.muted_until IS NOT NULL
        THEN 'You have been muted until ' || to_char(NEW.muted_until, 'Mon DD, YYYY')
        ELSE 'You have been muted indefinitely' END
        || COALESCE('. Reason: ' || NULLIF(btrim(NEW.mute_reason), ''), '');
    ELSE
      v_content := CASE WHEN NEW.banned_until IS NOT NULL
        THEN 'You have been banned until ' || to_char(NEW.banned_until, 'Mon DD, YYYY')
        ELSE 'You have been permanently banned' END
        || COALESCE('. Reason: ' || NULLIF(btrim(NEW.ban_reason), ''), '');
    END IF;
    IF public.engagement_notify_allowed(NEW.user_id, v_actor, 'communities') THEN
      INSERT INTO public.notifications (user_id, actor_id, type, community_id, content)
      VALUES (NEW.user_id, v_actor, CASE WHEN NEW.status = 'muted' THEN 'community_muted' ELSE 'community_banned' END,
              NEW.community_id, v_content);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS community_members_notify ON public.community_members;
CREATE TRIGGER community_members_notify
  AFTER UPDATE OF role, status ON public.community_members
  FOR EACH ROW EXECUTE FUNCTION public.trg_community_members_notify();

-- moderator warning
CREATE OR REPLACE FUNCTION public.send_community_warning(p_community_id uuid, p_user_id uuid, p_post_id uuid, p_note text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF NOT public.is_community_admin_or_mod(p_community_id, v_uid) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.notifications (user_id, actor_id, type, post_id, community_id, content)
  VALUES (p_user_id, v_uid, 'community_warning', p_post_id, p_community_id,
          LEFT(COALESCE(NULLIF(btrim(p_note), ''), 'Your content was reported and reviewed by a moderator. Please review the community guidelines.'), 280));
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.send_community_warning(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_community_warning(uuid, uuid, uuid, text) TO authenticated;

-- No client may insert notifications any more.
DROP POLICY IF EXISTS notifications_insert ON public.notifications;
REVOKE INSERT ON public.notifications FROM anon, authenticated;

-- 6. block_user -------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.block_user(p_blocked uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF p_blocked IS NULL OR p_blocked = v_uid THEN RAISE EXCEPTION 'INVALID_TARGET' USING ERRCODE = '22023'; END IF;

  INSERT INTO public.blocks (blocker_id, blocked_id)
  SELECT v_uid, p_blocked
  WHERE NOT EXISTS (SELECT 1 FROM public.blocks WHERE blocker_id = v_uid AND blocked_id = p_blocked);

  -- No relationship survives a block.
  DELETE FROM public.follows
  WHERE (follower_id = v_uid AND following_id = p_blocked) OR (follower_id = p_blocked AND following_id = v_uid);

  -- Their engagement on my content (and mine on theirs) goes away.
  DELETE FROM public.reactions r
  WHERE (r.user_id = p_blocked AND r.post_id IN (SELECT id FROM public.posts WHERE author_id = v_uid))
     OR (r.user_id = v_uid AND r.post_id IN (SELECT id FROM public.posts WHERE author_id = p_blocked));
  DELETE FROM public.take_reactions r
  WHERE (r.user_id = p_blocked AND r.take_id IN (SELECT id FROM public.takes WHERE author_id = v_uid))
     OR (r.user_id = v_uid AND r.take_id IN (SELECT id FROM public.takes WHERE author_id = p_blocked));
  DELETE FROM public.comment_likes l
  WHERE (l.user_id = p_blocked AND l.comment_id IN (SELECT c.id FROM public.comments c WHERE c.user_id = v_uid))
     OR (l.user_id = v_uid AND l.comment_id IN (SELECT c.id FROM public.comments c WHERE c.user_id = p_blocked));
  DELETE FROM public.take_comment_likes l
  WHERE (l.user_id = p_blocked AND l.comment_id IN (SELECT c.id FROM public.take_comments c WHERE c.user_id = v_uid))
     OR (l.user_id = v_uid AND l.comment_id IN (SELECT c.id FROM public.take_comments c WHERE c.user_id = p_blocked));
  DELETE FROM public.post_mentions m
  WHERE (m.user_id = p_blocked AND m.post_id IN (SELECT id FROM public.posts WHERE author_id = v_uid))
     OR (m.user_id = v_uid AND m.post_id IN (SELECT id FROM public.posts WHERE author_id = p_blocked));

  -- Nothing pending between us.
  DELETE FROM public.notifications
  WHERE (user_id = v_uid AND actor_id = p_blocked) OR (user_id = p_blocked AND actor_id = v_uid);

  RETURN jsonb_build_object('blocked', true);
END;
$$;
REVOKE ALL ON FUNCTION public.block_user(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_user(uuid) TO authenticated;
