-- ============================================================================
-- Engagement Phase 4b — function hardening (docs/engagement/02-plan.md)
--
-- The Phase 3/4 helpers are SECURITY DEFINER and, by Postgres default,
-- executable by anyone through PostgREST. Two fixes:
--   * the visibility/block helpers only ever answer about the caller
--     (p_viewer / p_author / one side of a block must be auth.uid()),
--   * trigger bodies and the notification insert helper are not callable
--     from the API at all.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.engagement_blocked(p_a uuid, p_b uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_a IS NOT NULL AND p_b IS NOT NULL
     AND (p_a = auth.uid() OR p_b = auth.uid())
     AND EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = p_a AND b.blocked_id = p_b) OR (b.blocker_id = p_b AND b.blocked_id = p_a)
     );
$$;

CREATE OR REPLACE FUNCTION public.engagement_can_view_post(p_post_id uuid, p_viewer uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_viewer IS NOT DISTINCT FROM auth.uid() AND EXISTS (
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
  SELECT p_viewer IS NOT DISTINCT FROM auth.uid() AND EXISTS (
    SELECT 1 FROM public.takes t
    WHERE t.id = p_take_id
      AND (t.visibility = 'public' OR t.author_id = p_viewer)
      AND (p_viewer IS NULL OR t.author_id = p_viewer OR NOT public.engagement_blocked(p_viewer, t.author_id))
  );
$$;

CREATE OR REPLACE FUNCTION public.engagement_can_tag(p_author uuid, p_target uuid)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_author IS NOT NULL AND p_target IS NOT NULL AND p_author <> p_target
     AND p_author = auth.uid()
     AND NOT public.engagement_blocked(p_author, p_target)
     AND EXISTS (
       SELECT 1 FROM public.profiles pr
       WHERE pr.id = p_target
         AND (COALESCE(pr.is_private, false) = false
              OR EXISTS (SELECT 1 FROM public.follows f
                         WHERE f.follower_id = p_target AND f.following_id = p_author AND f.status = 'accepted'))
     );
$$;

-- Not callable through the API: trigger bodies and internal helpers.
REVOKE ALL ON FUNCTION public.engagement_notify_allowed(uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engagement_notify_insert(uuid, uuid, text, uuid, uuid, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engagement_comment_notify(text, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.engagement_rate_limit(text, int, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_reactions_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_take_reactions_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_comments_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_take_comments_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_comment_likes_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_take_comment_likes_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_post_mentions_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_take_mentions_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_post_activity_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_follows_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_post_collaborators_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_community_members_notify() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notify_notification_change() FROM PUBLIC, anon, authenticated;
