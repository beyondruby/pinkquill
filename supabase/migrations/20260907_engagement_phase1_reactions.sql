-- ============================================================================
-- Engagement Phase 1 — one atomic reaction path (docs/engagement/02-plan.md)
--
-- Root cause fixed: reaction writes were client-side insert/update/delete
-- chosen from local state. `reactions` had no UPDATE policy, so "change
-- reaction" silently updated 0 rows; `take_reactions` had no unique key, so
-- wrong guesses inserted duplicates.
--
-- 1. reactions: add the missing UPDATE policy.
-- 2. Fold legacy `admires` into `reactions` and freeze `admires` (reads only).
-- 3. take_reactions: dedupe, CHECK, UNIQUE (take_id, user_id), FK → profiles.
-- 4. RPCs: set_/clear_post_reaction, set_/clear_take_reaction (atomic upsert
--    or delete, return the viewer's reaction + fresh per-type counts), and
--    get_post_/take_reaction_summary(uuid[]) for batched reads.
-- All functions are SECURITY INVOKER so RLS (post visibility, own-row writes)
-- still applies.
-- ============================================================================

-- 1. reactions UPDATE policy -----------------------------------------------
DROP POLICY IF EXISTS reactions_update ON public.reactions;
CREATE POLICY reactions_update ON public.reactions
  FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- 2. fold admires → reactions, then freeze admires ---------------------------
INSERT INTO public.reactions (post_id, user_id, reaction_type, created_at)
SELECT a.post_id, a.user_id, 'admire', COALESCE(a.created_at, now())
FROM public.admires a
ON CONFLICT (post_id, user_id) DO NOTHING;

DROP POLICY IF EXISTS "Users can admire posts" ON public.admires;
DROP POLICY IF EXISTS "Users can remove own admires" ON public.admires;
REVOKE INSERT, UPDATE, DELETE ON public.admires FROM anon, authenticated;

-- 3. take_reactions integrity -----------------------------------------------
-- Keep the newest row per (take, user); the client wrote duplicates.
DELETE FROM public.take_reactions older
USING public.take_reactions newer
WHERE older.take_id = newer.take_id
  AND older.user_id = newer.user_id
  AND (older.created_at < newer.created_at
       OR (older.created_at = newer.created_at AND older.id < newer.id));

-- Rows whose user has no profile cannot satisfy the new FK.
DELETE FROM public.take_reactions tr
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = tr.user_id);

ALTER TABLE public.take_reactions
  DROP CONSTRAINT IF EXISTS take_reactions_user_id_fkey;
ALTER TABLE public.take_reactions
  ADD CONSTRAINT take_reactions_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
ALTER TABLE public.take_reactions
  DROP CONSTRAINT IF EXISTS take_reactions_reaction_type_check;
ALTER TABLE public.take_reactions
  ADD CONSTRAINT take_reactions_reaction_type_check
    CHECK (reaction_type IN ('admire','snap','ovation','support','inspired','applaud'));
ALTER TABLE public.take_reactions
  DROP CONSTRAINT IF EXISTS take_reactions_take_id_user_id_key;
ALTER TABLE public.take_reactions
  ADD CONSTRAINT take_reactions_take_id_user_id_key UNIQUE (take_id, user_id);

-- 4. RPCs -------------------------------------------------------------------

-- Per-type counts for one post as jsonb {admire,…,applaud,total}.
CREATE OR REPLACE FUNCTION public.post_reaction_counts_json(p_post_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'admire',   COUNT(*) FILTER (WHERE reaction_type = 'admire'),
    'snap',     COUNT(*) FILTER (WHERE reaction_type = 'snap'),
    'ovation',  COUNT(*) FILTER (WHERE reaction_type = 'ovation'),
    'support',  COUNT(*) FILTER (WHERE reaction_type = 'support'),
    'inspired', COUNT(*) FILTER (WHERE reaction_type = 'inspired'),
    'applaud',  COUNT(*) FILTER (WHERE reaction_type = 'applaud'),
    'total',    COUNT(*)
  )
  FROM public.reactions
  WHERE post_id = p_post_id;
$$;

CREATE OR REPLACE FUNCTION public.take_reaction_counts_json(p_take_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'admire',   COUNT(*) FILTER (WHERE reaction_type = 'admire'),
    'snap',     COUNT(*) FILTER (WHERE reaction_type = 'snap'),
    'ovation',  COUNT(*) FILTER (WHERE reaction_type = 'ovation'),
    'support',  COUNT(*) FILTER (WHERE reaction_type = 'support'),
    'inspired', COUNT(*) FILTER (WHERE reaction_type = 'inspired'),
    'applaud',  COUNT(*) FILTER (WHERE reaction_type = 'applaud'),
    'total',    COUNT(*)
  )
  FROM public.take_reactions
  WHERE take_id = p_take_id;
$$;

-- Set (insert or change) the caller's reaction on a post. Atomic; the unique
-- key and the UPDATE policy make the result independent of what the client
-- believed. Returns {mine, previous, changed, counts}.
CREATE OR REPLACE FUNCTION public.set_post_reaction(p_post_id uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('admire','snap','ovation','support','inspired','applaud') THEN
    RAISE EXCEPTION 'INVALID_REACTION' USING ERRCODE = '22023';
  END IF;
  -- Visibility: the posts SELECT policy decides what the caller may see.
  IF NOT EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id) THEN
    RAISE EXCEPTION 'POST_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT reaction_type INTO v_prev
  FROM public.reactions
  WHERE post_id = p_post_id AND user_id = v_uid;

  INSERT INTO public.reactions (post_id, user_id, reaction_type)
  VALUES (p_post_id, v_uid, p_type)
  ON CONFLICT (post_id, user_id) DO UPDATE
    SET reaction_type = EXCLUDED.reaction_type,
        created_at = now()
    WHERE public.reactions.reaction_type IS DISTINCT FROM EXCLUDED.reaction_type;

  RETURN jsonb_build_object(
    'mine', p_type,
    'previous', v_prev,
    'changed', v_prev IS DISTINCT FROM p_type,
    'counts', public.post_reaction_counts_json(p_post_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_post_reaction(p_post_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.reactions
  WHERE post_id = p_post_id AND user_id = v_uid
  RETURNING reaction_type INTO v_prev;

  RETURN jsonb_build_object(
    'mine', NULL,
    'previous', v_prev,
    'changed', v_prev IS NOT NULL,
    'counts', public.post_reaction_counts_json(p_post_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.set_take_reaction(p_take_id uuid, p_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;
  IF p_type IS NULL OR p_type NOT IN ('admire','snap','ovation','support','inspired','applaud') THEN
    RAISE EXCEPTION 'INVALID_REACTION' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.takes WHERE id = p_take_id) THEN
    RAISE EXCEPTION 'TAKE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  SELECT reaction_type INTO v_prev
  FROM public.take_reactions
  WHERE take_id = p_take_id AND user_id = v_uid;

  INSERT INTO public.take_reactions (take_id, user_id, reaction_type)
  VALUES (p_take_id, v_uid, p_type)
  ON CONFLICT (take_id, user_id) DO UPDATE
    SET reaction_type = EXCLUDED.reaction_type,
        created_at = now()
    WHERE public.take_reactions.reaction_type IS DISTINCT FROM EXCLUDED.reaction_type;

  RETURN jsonb_build_object(
    'mine', p_type,
    'previous', v_prev,
    'changed', v_prev IS DISTINCT FROM p_type,
    'counts', public.take_reaction_counts_json(p_take_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_take_reaction(p_take_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_prev text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = '28000';
  END IF;

  DELETE FROM public.take_reactions
  WHERE take_id = p_take_id AND user_id = v_uid
  RETURNING reaction_type INTO v_prev;

  RETURN jsonb_build_object(
    'mine', NULL,
    'previous', v_prev,
    'changed', v_prev IS NOT NULL,
    'counts', public.take_reaction_counts_json(p_take_id)
  );
END;
$$;

-- Batched read: per-type counts + the caller's own reaction for up to 100
-- ids. Ids the caller cannot see (RLS) still come back with zero counts;
-- the reactions SELECT policy is `true` today, Phase 4 tightens it.
CREATE OR REPLACE FUNCTION public.get_post_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int, mine text
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    x.id,
    COALESCE(c.admire, 0)::int, COALESCE(c.snap, 0)::int, COALESCE(c.ovation, 0)::int,
    COALESCE(c.support, 0)::int, COALESCE(c.inspired, 0)::int, COALESCE(c.applaud, 0)::int,
    COALESCE(c.total, 0)::int,
    m.reaction_type
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
  ) m ON true;
$$;

CREATE OR REPLACE FUNCTION public.get_take_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int, mine text
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    x.id,
    COALESCE(c.admire, 0)::int, COALESCE(c.snap, 0)::int, COALESCE(c.ovation, 0)::int,
    COALESCE(c.support, 0)::int, COALESCE(c.inspired, 0)::int, COALESCE(c.applaud, 0)::int,
    COALESCE(c.total, 0)::int,
    m.reaction_type
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
  ) m ON true;
$$;

-- Grants: writes for signed-in users only; summaries readable by everyone
-- (mirrors the SELECT policies on the tables).
REVOKE ALL ON FUNCTION public.set_post_reaction(uuid, text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_post_reaction(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_take_reaction(uuid, text)      FROM PUBLIC;
REVOKE ALL ON FUNCTION public.clear_take_reaction(uuid)          FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_post_reaction_summary(uuid[])  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_take_reaction_summary(uuid[])  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.post_reaction_counts_json(uuid)    FROM PUBLIC;
REVOKE ALL ON FUNCTION public.take_reaction_counts_json(uuid)    FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_post_reaction(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_post_reaction(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_take_reaction(uuid, text)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.clear_take_reaction(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_summary(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reaction_summary(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.post_reaction_counts_json(uuid)   TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.take_reaction_counts_json(uuid)   TO anon, authenticated;
