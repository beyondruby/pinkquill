-- Phase 6 (docs/audit/02-plan.md): half-finished behaviour and remaining
-- security edges. Findings B8, S6, S9 and the Phase-4 note about blocks.
--
-- 1. reports.take_id — take reports inserted `reported_post_id`, a column
--    that does not exist, so every take report has failed since launch.
-- 2. notifications_type_check gains 'refund_declined' (the refund route
--    labelled a declined refund as 'order_paid').
-- 3. Blocks enforced in the posts/takes SELECT policies, not just in a few
--    client-side checks.
-- 4. follows: a follow of a private account inserted by the follower is
--    forced to 'pending' regardless of what the client sent.
-- 5. profiles.email follows auth.users.email after a confirmed email change.
--
-- Idempotent.

-- 1. take reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS take_id uuid REFERENCES public.takes(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_reports_take_id ON public.reports (take_id);

-- 2. refund_declined notification type
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'admire','snap','ovation','support','inspired','applaud','comment','reply','comment_like','relay','save','mention',
  'follow','follow_request','follow_request_accepted',
  'community_invite','community_join_request','community_join_approved','community_role_change','community_muted','community_banned','community_warning',
  'collaboration_invite','collaboration_accepted','collaboration_declined','collaboration_removed',
  'order_placed','order_paid','order_started','order_delivered','order_completed','revision_requested','order_cancelled','review_received','order_message',
  'order_disputed','dispute_resolved','refund_requested','refund_declined','order_refunded','order_pending_acceptance','order_accepted','order_declined'
]));

-- 3. blocks in read policies (blocker and blocked never see each other's content)
DROP POLICY IF EXISTS "posts_select_policy" ON public.posts;
CREATE POLICY "posts_select_policy" ON public.posts
  FOR SELECT
  USING (
    (
      (visibility = 'public' AND status = 'published')
      OR author_id = (SELECT auth.uid())
      OR (
        (SELECT auth.uid()) IS NOT NULL
        AND visibility = 'followers'
        AND status = 'published'
        AND EXISTS (
          SELECT 1 FROM public.follows
          WHERE follows.follower_id = (SELECT auth.uid())
            AND follows.following_id = posts.author_id
            AND follows.status = 'accepted'
        )
      )
      OR ((SELECT auth.uid()) IS NOT NULL AND public.is_post_collaborator(id, (SELECT auth.uid())))
    )
    AND (
      (SELECT auth.uid()) IS NULL
      OR author_id = (SELECT auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = posts.author_id)
           OR (b.blocker_id = posts.author_id AND b.blocked_id = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "takes_select" ON public.takes;
CREATE POLICY "takes_select" ON public.takes
  FOR SELECT
  USING (
    (SELECT auth.uid()) IS NULL
    OR author_id = (SELECT auth.uid())
    OR NOT EXISTS (
      SELECT 1 FROM public.blocks b
      WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = takes.author_id)
         OR (b.blocker_id = takes.author_id AND b.blocked_id = (SELECT auth.uid()))
    )
  );

-- 4. private accounts: follow requests cannot be self-accepted by the client
CREATE OR REPLACE FUNCTION public.enforce_follow_request_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_private boolean;
BEGIN
  IF NEW.follower_id = NEW.following_id THEN
    RAISE EXCEPTION 'Cannot follow yourself';
  END IF;
  -- Only the follower's own insert is subject to the request flow; service
  -- role / owner code paths keep whatever they set.
  IF auth.uid() IS NOT NULL AND auth.uid() = NEW.follower_id THEN
    SELECT COALESCE(is_private, false) INTO v_private FROM profiles WHERE id = NEW.following_id;
    IF v_private THEN
      NEW.status := 'pending';
    ELSIF NEW.status IS NULL THEN
      NEW.status := 'accepted';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_follow_request_status() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_follow_request_status() TO service_role;

DROP TRIGGER IF EXISTS follows_enforce_request_status ON public.follows;
CREATE TRIGGER follows_enforce_request_status
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.enforce_follow_request_status();

-- 5. keep profiles.email in sync after a confirmed email change
CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles SET email = lower(NEW.email) WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.sync_profile_email() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_email() TO service_role;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();
