-- Engagement rebuild — Phase 6 (UI/UX). docs/engagement/02-plan.md §Phase 6.
-- Applied to prod 2026-09-07.
--
-- 1. Who reacted: get_post_reactors / get_take_reactors (paged, per type,
--    with the viewer's follow status) for the Reactions sheet.
-- 2. The batched summaries carry a `top_reactor` (someone the viewer
--    follows, else the latest) for the card line "name and N others reacted".
-- 3. search_mention_candidates for the composer's @ autocomplete: people
--    you follow first, then a name search; blocked either way and private
--    accounts that do not follow you are excluded (same rule as tagging).
-- All three are SECURITY INVOKER so the Phase 4 read policies apply.

CREATE OR REPLACE FUNCTION public.get_post_reactors(
  p_post_id uuid, p_type text DEFAULT NULL, p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid, username text, display_name text, avatar_url text, is_verified boolean,
  reaction_type text, created_at timestamptz, follow_status text, is_me boolean
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT r.user_id, pr.username, pr.display_name, pr.avatar_url, COALESCE(pr.is_verified, false),
         r.reaction_type, r.created_at, f.status, (r.user_id = auth.uid())
  FROM public.reactions r
  JOIN public.profiles pr ON pr.id = r.user_id
  LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id
  WHERE r.post_id = p_post_id
    AND (p_type IS NULL OR r.reaction_type = p_type)
    AND (p_before IS NULL OR r.created_at < p_before)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
$$;

CREATE OR REPLACE FUNCTION public.get_take_reactors(
  p_take_id uuid, p_type text DEFAULT NULL, p_limit int DEFAULT 30, p_before timestamptz DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid, username text, display_name text, avatar_url text, is_verified boolean,
  reaction_type text, created_at timestamptz, follow_status text, is_me boolean
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT r.user_id, pr.username, pr.display_name, pr.avatar_url, COALESCE(pr.is_verified, false),
         r.reaction_type, r.created_at, f.status, (r.user_id = auth.uid())
  FROM public.take_reactions r
  JOIN public.profiles pr ON pr.id = r.user_id
  LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id
  WHERE r.take_id = p_take_id
    AND (p_type IS NULL OR r.reaction_type = p_type)
    AND (p_before IS NULL OR r.created_at < p_before)
  ORDER BY r.created_at DESC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 30), 1), 50);
$$;
GRANT EXECUTE ON FUNCTION public.get_post_reactors(uuid, text, int, timestamptz) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reactors(uuid, text, int, timestamptz) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.get_post_reaction_summary(uuid[]);
CREATE FUNCTION public.get_post_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int,
  mine text, comments int, top_reactor jsonb
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
    COALESCE(p.comments_count, 0),
    tr.j
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.posts p ON p.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.reactions r
    WHERE r.post_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('username', pr.username, 'display_name', pr.display_name) AS j
    FROM public.reactions r
    JOIN public.profiles pr ON pr.id = r.user_id
    LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id AND f.status = 'accepted'
    WHERE r.post_id = x.id AND r.user_id IS DISTINCT FROM auth.uid()
    ORDER BY (f.id IS NOT NULL) DESC, r.created_at DESC
    LIMIT 1
  ) tr ON true;
$$;

DROP FUNCTION IF EXISTS public.get_take_reaction_summary(uuid[]);
CREATE FUNCTION public.get_take_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int,
  mine text, comments int, top_reactor jsonb
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
    COALESCE(t.comments_count, 0),
    tr.j
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.takes t ON t.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.take_reactions r
    WHERE r.take_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_build_object('username', pr.username, 'display_name', pr.display_name) AS j
    FROM public.take_reactions r
    JOIN public.profiles pr ON pr.id = r.user_id
    LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id AND f.status = 'accepted'
    WHERE r.take_id = x.id AND r.user_id IS DISTINCT FROM auth.uid()
    ORDER BY (f.id IS NOT NULL) DESC, r.created_at DESC
    LIMIT 1
  ) tr ON true;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_summary(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reaction_summary(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.search_mention_candidates(p_query text, p_limit int DEFAULT 8)
RETURNS TABLE (
  id uuid, username text, display_name text, avatar_url text, is_verified boolean, followed boolean
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  WITH q AS (
    SELECT replace(regexp_replace(lower(COALESCE(p_query, '')), '[^a-z0-9_]', '', 'g'), '_', '\_') AS s
  )
  SELECT pr.id, pr.username, pr.display_name, pr.avatar_url, COALESCE(pr.is_verified, false),
    EXISTS (
      SELECT 1 FROM public.follows fo
      WHERE fo.follower_id = auth.uid() AND fo.following_id = pr.id AND fo.status = 'accepted'
    ) AS followed
  FROM public.profiles pr, q
  WHERE auth.uid() IS NOT NULL
    AND pr.id <> auth.uid()
    AND (q.s = '' OR lower(pr.username) LIKE q.s || '%' OR lower(COALESCE(pr.display_name, '')) LIKE '%' || q.s || '%')
    AND NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = auth.uid() AND b.blocked_id = pr.id)
         OR (b.blocker_id = pr.id AND b.blocked_id = auth.uid())
    )
    AND (
      NOT COALESCE(pr.is_private, false)
      OR EXISTS (
        SELECT 1 FROM public.follows fi
        WHERE fi.follower_id = pr.id AND fi.following_id = auth.uid() AND fi.status = 'accepted'
      )
    )
  ORDER BY followed DESC, (lower(pr.username) LIKE q.s || '%') DESC, pr.username
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 8), 1), 20);
$$;
REVOKE ALL ON FUNCTION public.search_mention_candidates(text, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_mention_candidates(text, int) TO authenticated;
