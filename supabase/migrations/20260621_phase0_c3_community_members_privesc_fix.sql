-- Phase 0 / C3: Close community_members privilege-escalation holes.
-- INSERT: the public self-join branch had no role/status constraint, letting any
--   user insert {role:'admin'} into any public community. Constrain self-join to
--   role='member',status='active'; admins may add any role, mods may add non-admins.
-- UPDATE: had WITH CHECK = NULL, letting any admin OR moderator rewrite any member
--   row (e.g. set role='admin', or ban a real admin). Add USING (protect admin rows
--   from mods) + WITH CHECK (only admins may grant admin/moderator).
--
-- Behavior change: changing roles and editing moderator permissions is now ADMIN-only;
-- moderators retain mute/ban over regular (non-mod/non-admin) members.

DROP POLICY IF EXISTS insert_community_members ON public.community_members;
CREATE POLICY insert_community_members ON public.community_members
  FOR INSERT
  WITH CHECK (
    (
      user_id = (SELECT auth.uid())
      AND role = 'member'
      AND status = 'active'
      AND EXISTS (
        SELECT 1 FROM public.communities c
        WHERE c.id = community_members.community_id
          AND c.privacy = 'public'
      )
    )
    OR (
      is_community_admin_or_mod(community_members.community_id, (SELECT auth.uid()))
      AND (
        role <> 'admin'
        OR is_community_admin(community_members.community_id, (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS update_community_members ON public.community_members;
CREATE POLICY update_community_members ON public.community_members
  FOR UPDATE
  USING (
    is_community_admin_or_mod(community_members.community_id, (SELECT auth.uid()))
    AND (
      role <> 'admin'
      OR is_community_admin(community_members.community_id, (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    is_community_admin_or_mod(community_members.community_id, (SELECT auth.uid()))
    AND (
      role NOT IN ('admin', 'moderator')
      OR is_community_admin(community_members.community_id, (SELECT auth.uid()))
    )
  );
