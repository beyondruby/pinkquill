-- Profile audit phase 1b (docs/profile/02-plan.md, findings P-2 and V-24).
-- Applied to prod 2026-09-08 via the Supabase MCP (migration name
-- profile_phase1b_grants), after a rolled-back dry run of every check below.
--
-- 1. profiles.email and profiles.stripe_customer_id were readable (and
--    writable) by the anon and authenticated roles under a
--    "SELECT USING (true)" policy, so every profile view shipped every
--    user's email to the browser. is_verified is readable but no longer
--    client-writable (it was, via the table grant; RLS only checked the row). Only server code using the service
--    role reads these two columns (app/api/auth/login, app/api/notifications/
--    email, Stripe routes); the service role bypasses grants and keeps
--    working. The two auth triggers (handle_new_user,
--    on_auth_user_email_updated) run as their definer and keep writing
--    email. Client code no longer selects "*" on profiles
--    (lib/profiles/columns.ts).
--
-- 2. takes_select had no visibility clause, so anyone could read
--    followers-only and private takes; the checks lived in the browser.
--    The new policy mirrors posts_select_policy exactly: public rows for
--    everyone, 'followers' rows for accepted followers, everything for the
--    author, blocks hide rows both ways. (Neither policy has a
--    private-account clause; that is decision 10 in 02-plan.md.) get_takes_feed is
--    SECURITY INVOKER and already filters visibility = 'public', so it is
--    unaffected; engagement_can_view_take is SECURITY DEFINER and keeps
--    its own rule.

BEGIN;

-- 1. Column grants -----------------------------------------------------------
-- Both client roles held table-level ALL on profiles (Supabase default
-- ACL), and a column-level REVOKE cannot narrow a table-level grant, so the
-- table grant is replaced by explicit column lists. Consequence: a column
-- added to profiles later is invisible to the browser until it is added to
-- these GRANTs and to lib/profiles/columns.ts. DELETE / TRUNCATE / TRIGGER
-- are dropped for both roles (no client path deletes a profile; RLS never
-- allowed it). anon keeps read-only access. service_role is untouched.

REVOKE ALL ON TABLE public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, display_name, avatar_url, cover_url, bio, tagline, role,
  education, location, languages, website, is_verified, is_private,
  theme_preference, notification_preferences, email_preferences,
  feed_view_preference, created_at, updated_at
) ON public.profiles TO anon, authenticated;

GRANT INSERT (
  id, username, display_name, avatar_url, cover_url, bio, tagline, role,
  education, location, languages, website, is_verified, is_private,
  theme_preference, notification_preferences, email_preferences,
  feed_view_preference, created_at, updated_at
), UPDATE (
  username, display_name, avatar_url, cover_url, bio, tagline, role,
  education, location, languages, website, is_private,
  theme_preference, notification_preferences, email_preferences,
  feed_view_preference, updated_at
) ON public.profiles TO authenticated;

-- 2. takes visibility --------------------------------------------------------

DROP POLICY IF EXISTS takes_select ON public.takes;

CREATE POLICY takes_select ON public.takes
  FOR SELECT
  USING (
    (
      visibility = 'public'
      OR author_id = (SELECT auth.uid())
      OR (
        (SELECT auth.uid()) IS NOT NULL
        AND visibility = 'followers'
        AND EXISTS (
          SELECT 1 FROM public.follows f
          WHERE f.follower_id = (SELECT auth.uid())
            AND f.following_id = takes.author_id
            AND f.status = 'accepted'
        )
      )
    )
    AND (
      (SELECT auth.uid()) IS NULL
      OR author_id = (SELECT auth.uid())
      OR NOT EXISTS (
        SELECT 1 FROM public.blocks b
        WHERE (b.blocker_id = (SELECT auth.uid()) AND b.blocked_id = takes.author_id)
           OR (b.blocker_id = takes.author_id AND b.blocked_id = (SELECT auth.uid()))
      )
    )
  );

COMMIT;
