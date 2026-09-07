-- ============================================================================
-- Engagement Phase 2 — comments, likes, replies (docs/engagement/02-plan.md)
--
-- 1. comments / take_comments: `reply_to_user_id` (who a reply answers, so
--    "Replying to @name" is data not a text prefix), content length CHECK,
--    post/take author may delete any comment on their own content (D4).
-- 2. RPCs (SECURITY INVOKER, RLS applies):
--      add_post_comment / add_take_comment      → row facts + new count
--      delete_post_comment / delete_take_comment → deleted rows + new count
--      set_post_comment_like / set_take_comment_like → liked + likes_count
--    Replies are flattened server-side to one level (D3): a reply to a
--    reply is stored under the top-level comment with reply_to_user_id set.
-- 3. get_post_/take_reaction_summary gain a `comments` column so one batched
--    read seeds both reaction and comment counts.
-- ============================================================================

-- 1. columns, checks, policies -----------------------------------------------
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS reply_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.take_comments
  ADD COLUMN IF NOT EXISTS reply_to_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_comments_reply_to_user ON public.comments(reply_to_user_id);
CREATE INDEX IF NOT EXISTS idx_take_comments_reply_to_user ON public.take_comments(reply_to_user_id);
CREATE INDEX IF NOT EXISTS idx_take_comments_take_created ON public.take_comments(take_id, created_at DESC);

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_content_length;
ALTER TABLE public.comments
  ADD CONSTRAINT comments_content_length CHECK (char_length(btrim(content)) BETWEEN 1 AND 2200);
ALTER TABLE public.take_comments DROP CONSTRAINT IF EXISTS take_comments_content_length;
ALTER TABLE public.take_comments
  ADD CONSTRAINT take_comments_content_length CHECK (char_length(btrim(content)) BETWEEN 1 AND 2200);

DROP POLICY IF EXISTS comments_delete_by_post_author ON public.comments;
CREATE POLICY comments_delete_by_post_author ON public.comments
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.posts p
    WHERE p.id = comments.post_id AND p.author_id = (SELECT auth.uid())
  ));
DROP POLICY IF EXISTS take_comments_delete_by_take_author ON public.take_comments;
CREATE POLICY take_comments_delete_by_take_author ON public.take_comments
  FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.takes t
    WHERE t.id = take_comments.take_id AND t.author_id = (SELECT auth.uid())
  ));

-- Comment reports can finally point at the comment (posts and takes share it).
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS comment_id uuid;

-- 2. RPCs -------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.add_post_comment(
  p_post_id uuid,
  p_content text,
  p_parent_id uuid DEFAULT NULL,
  p_reply_to_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'POST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  IF p_parent_id IS NOT NULL THEN
    SELECT * INTO v_parent FROM public.comments WHERE id = p_parent_id;
    IF v_parent.id IS NULL OR v_parent.post_id <> p_post_id THEN
      RAISE EXCEPTION 'PARENT_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
    -- One level of threading: replies to replies live under the top-level comment.
    v_parent_id := COALESCE(v_parent.parent_id, v_parent.id);
    v_reply_to := COALESCE(p_reply_to_user_id, v_parent.user_id);
    IF v_reply_to = v_uid THEN v_reply_to := NULL; END IF;
  END IF;

  INSERT INTO public.comments (post_id, user_id, parent_id, reply_to_user_id, content)
  VALUES (p_post_id, v_uid, v_parent_id, v_reply_to, v_content)
  RETURNING id, created_at INTO v_id, v_created;

  SELECT COUNT(*) INTO v_count FROM public.comments WHERE post_id = p_post_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'created_at', v_created,
    'parent_id', v_parent_id,
    'reply_to_user_id', v_reply_to,
    'comments_count', v_count
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.add_take_comment(
  p_take_id uuid,
  p_content text,
  p_parent_id uuid DEFAULT NULL,
  p_reply_to_user_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
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
  IF NOT EXISTS (SELECT 1 FROM public.takes WHERE id = p_take_id) THEN
    RAISE EXCEPTION 'TAKE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

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

  RETURN jsonb_build_object(
    'id', v_id,
    'created_at', v_created,
    'parent_id', v_parent_id,
    'reply_to_user_id', v_reply_to,
    'comments_count', v_count
  );
END;
$$;

-- Delete a comment (and, by FK cascade, its replies and likes). RLS decides
-- who may: the comment owner or the post author. Community moderators keep
-- using moderate_delete_comment (audited).
CREATE OR REPLACE FUNCTION public.delete_post_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_post_id uuid;
  v_replies int;
  v_deleted int;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  SELECT post_id INTO v_post_id FROM public.comments WHERE id = p_comment_id;
  IF v_post_id IS NULL THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT COUNT(*) INTO v_replies FROM public.comments WHERE parent_id = p_comment_id;

  DELETE FROM public.comments WHERE id = p_comment_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.comments WHERE post_id = v_post_id;
  RETURN jsonb_build_object('deleted', 1 + v_replies, 'comments_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_take_comment(p_comment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_take_id uuid;
  v_replies int;
  v_deleted int;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  SELECT take_id INTO v_take_id FROM public.take_comments WHERE id = p_comment_id;
  IF v_take_id IS NULL THEN RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002'; END IF;
  SELECT COUNT(*) INTO v_replies FROM public.take_comments WHERE parent_id = p_comment_id;

  DELETE FROM public.take_comments WHERE id = p_comment_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  IF v_deleted = 0 THEN RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501'; END IF;

  SELECT COUNT(*) INTO v_count FROM public.take_comments WHERE take_id = v_take_id;
  RETURN jsonb_build_object('deleted', 1 + v_replies, 'comments_count', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_post_comment_like(p_comment_id uuid, p_liked boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.comments WHERE id = p_comment_id) THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_liked THEN
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
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_count int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.take_comments WHERE id = p_comment_id) THEN
    RAISE EXCEPTION 'COMMENT_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
  IF p_liked THEN
    INSERT INTO public.take_comment_likes (comment_id, user_id) VALUES (p_comment_id, v_uid)
    ON CONFLICT (comment_id, user_id) DO NOTHING;
  ELSE
    DELETE FROM public.take_comment_likes WHERE comment_id = p_comment_id AND user_id = v_uid;
  END IF;
  SELECT COUNT(*) INTO v_count FROM public.take_comment_likes WHERE comment_id = p_comment_id;
  RETURN jsonb_build_object('liked', p_liked, 'likes_count', v_count);
END;
$$;

-- 3. summaries now carry the comment count too ------------------------------
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
    COALESCE(c.admire, 0)::int, COALESCE(c.snap, 0)::int, COALESCE(c.ovation, 0)::int,
    COALESCE(c.support, 0)::int, COALESCE(c.inspired, 0)::int, COALESCE(c.applaud, 0)::int,
    COALESCE(c.total, 0)::int,
    m.reaction_type,
    COALESCE(k.total, 0)::int
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE r.reaction_type = 'admire')   AS admire,
      COUNT(*) FILTER (WHERE r.reaction_type = 'snap')     AS snap,
      COUNT(*) FILTER (WHERE r.reaction_type = 'ovation')  AS ovation,
      COUNT(*) FILTER (WHERE r.reaction_type = 'support')  AS support,
      COUNT(*) FILTER (WHERE r.reaction_type = 'inspired') AS inspired,
      COUNT(*) FILTER (WHERE r.reaction_type = 'applaud')  AS applaud,
      COUNT(*) AS total
    FROM public.reactions r WHERE r.post_id = x.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.reactions r
    WHERE r.post_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total FROM public.comments cm WHERE cm.post_id = x.id
  ) k ON true;
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
    COALESCE(c.admire, 0)::int, COALESCE(c.snap, 0)::int, COALESCE(c.ovation, 0)::int,
    COALESCE(c.support, 0)::int, COALESCE(c.inspired, 0)::int, COALESCE(c.applaud, 0)::int,
    COALESCE(c.total, 0)::int,
    m.reaction_type,
    COALESCE(k.total, 0)::int
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN LATERAL (
    SELECT
      COUNT(*) FILTER (WHERE r.reaction_type = 'admire')   AS admire,
      COUNT(*) FILTER (WHERE r.reaction_type = 'snap')     AS snap,
      COUNT(*) FILTER (WHERE r.reaction_type = 'ovation')  AS ovation,
      COUNT(*) FILTER (WHERE r.reaction_type = 'support')  AS support,
      COUNT(*) FILTER (WHERE r.reaction_type = 'inspired') AS inspired,
      COUNT(*) FILTER (WHERE r.reaction_type = 'applaud')  AS applaud,
      COUNT(*) AS total
    FROM public.take_reactions r WHERE r.take_id = x.id
  ) c ON true
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.take_reactions r
    WHERE r.take_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) AS total FROM public.take_comments cm WHERE cm.take_id = x.id
  ) k ON true;
$$;

-- Grants --------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.add_post_comment(uuid, text, uuid, uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_take_comment(uuid, text, uuid, uuid)     FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_post_comment(uuid)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_take_comment(uuid)                    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_post_comment_like(uuid, boolean)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_take_comment_like(uuid, boolean)         FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_post_reaction_summary(uuid[])            FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_take_reaction_summary(uuid[])            FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_post_comment(uuid, text, uuid, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_take_comment(uuid, text, uuid, uuid)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_post_comment(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_take_comment(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_comment_like(uuid, boolean)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_take_comment_like(uuid, boolean)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_summary(uuid[])         TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reaction_summary(uuid[])         TO anon, authenticated;
