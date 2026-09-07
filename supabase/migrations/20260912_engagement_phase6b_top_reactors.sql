-- Phase 6b (Instagram-style reaction line): the batched summaries return
-- `top_reactors` — up to three people (the ones the viewer follows first,
-- then the latest; never the viewer) with avatars for the facepile.
-- Replaces `top_reactor`. Applied to prod 2026-09-07.

DROP FUNCTION IF EXISTS public.get_post_reaction_summary(uuid[]);
CREATE FUNCTION public.get_post_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int,
  mine text, comments int, top_reactors jsonb
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
    COALESCE(tr.j, '[]'::jsonb)
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.posts p ON p.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.reactions r
    WHERE r.post_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('username', t.username, 'display_name', t.display_name, 'avatar_url', t.avatar_url)) AS j
    FROM (
      SELECT pr.username, pr.display_name, pr.avatar_url
      FROM public.reactions r
      JOIN public.profiles pr ON pr.id = r.user_id
      LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id AND f.status = 'accepted'
      WHERE r.post_id = x.id AND r.user_id IS DISTINCT FROM auth.uid()
      ORDER BY (f.id IS NOT NULL) DESC, r.created_at DESC
      LIMIT 3
    ) t
  ) tr ON true;
$$;

DROP FUNCTION IF EXISTS public.get_take_reaction_summary(uuid[]);
CREATE FUNCTION public.get_take_reaction_summary(p_ids uuid[])
RETURNS TABLE (
  id uuid, admire int, snap int, ovation int, support int, inspired int, applaud int, total int,
  mine text, comments int, top_reactors jsonb
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
    COALESCE(tr.j, '[]'::jsonb)
  FROM (SELECT DISTINCT unnest(p_ids[1:100]) AS id) x
  LEFT JOIN public.takes t ON t.id = x.id
  LEFT JOIN LATERAL (
    SELECT r.reaction_type FROM public.take_reactions r
    WHERE r.take_id = x.id AND r.user_id = auth.uid()
  ) m ON true
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('username', s.username, 'display_name', s.display_name, 'avatar_url', s.avatar_url)) AS j
    FROM (
      SELECT pr.username, pr.display_name, pr.avatar_url
      FROM public.take_reactions r
      JOIN public.profiles pr ON pr.id = r.user_id
      LEFT JOIN public.follows f ON f.follower_id = auth.uid() AND f.following_id = r.user_id AND f.status = 'accepted'
      WHERE r.take_id = x.id AND r.user_id IS DISTINCT FROM auth.uid()
      ORDER BY (f.id IS NOT NULL) DESC, r.created_at DESC
      LIMIT 3
    ) s
  ) tr ON true;
$$;
GRANT EXECUTE ON FUNCTION public.get_post_reaction_summary(uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_take_reaction_summary(uuid[]) TO anon, authenticated;
