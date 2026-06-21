-- Phase 0 / C5: follower_history had RLS disabled (relrowsecurity=false), exposing
-- every creator's follower-growth analytics to anon. Enable RLS with an owner-only
-- SELECT. Rows are written by the SECURITY DEFINER trigger log_follower_change, which
-- bypasses RLS, so ingestion is unaffected. No client write policy is added.
ALTER TABLE public.follower_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS follower_history_owner_select ON public.follower_history;
CREATE POLICY follower_history_owner_select ON public.follower_history
  FOR SELECT
  USING (profile_id = (SELECT auth.uid()));
