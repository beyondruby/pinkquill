-- ============================================
-- Fix for Community Join Requests & Invitations RLS
-- Run this in your Supabase SQL editor
-- ============================================

-- PROBLEM:
-- 1. Users can't create join requests for private communities because they can't SELECT the community
-- 2. Users can't accept invitations because they can't INSERT themselves into community_members

-- ============================================
-- STEP 1: Create helper functions
-- ============================================

-- Check if a community is private (bypasses RLS)
CREATE OR REPLACE FUNCTION is_community_private(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id
    AND privacy = 'private'
  );
END;
$$;

-- Check if a community exists (bypasses RLS)
CREATE OR REPLACE FUNCTION community_exists(p_community_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM communities
    WHERE id = p_community_id
  );
END;
$$;

-- Check if user has a pending invitation to a community
CREATE OR REPLACE FUNCTION has_pending_invitation(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_invitations
    WHERE community_id = p_community_id
    AND invitee_id = p_user_id
    AND status = 'pending'
  );
END;
$$;

-- Check if user already has a pending join request
CREATE OR REPLACE FUNCTION has_pending_join_request(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_join_requests
    WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND status = 'pending'
  );
END;
$$;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION is_community_private TO authenticated;
GRANT EXECUTE ON FUNCTION community_exists TO authenticated;
GRANT EXECUTE ON FUNCTION has_pending_invitation TO authenticated;
GRANT EXECUTE ON FUNCTION has_pending_join_request TO authenticated;

-- ============================================
-- STEP 2: Fix community_join_requests INSERT policy
-- ============================================

-- Drop the existing policy
DROP POLICY IF EXISTS "Users can create join requests" ON community_join_requests;

-- Recreate with helper function that bypasses RLS
CREATE POLICY "Users can create join requests" ON community_join_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    status = 'pending' AND
    is_community_private(community_id) AND
    NOT is_community_member(community_id, auth.uid()) AND
    NOT has_pending_join_request(community_id, auth.uid())
  );

-- ============================================
-- STEP 3: Fix community_members INSERT for invitations
-- ============================================

-- Add policy to allow users with pending invitations to join
CREATE POLICY "Users can join via invitation" ON community_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    role = 'member' AND
    status = 'active' AND
    has_pending_invitation(community_id, auth.uid())
  );

-- ============================================
-- STEP 4: Fix communities SELECT for private communities
-- Allow users with pending invitations to view the community
-- ============================================

-- Add policy to allow invitees to see private communities
CREATE POLICY "Invitees can view private communities" ON communities
  FOR SELECT USING (
    privacy = 'private' AND
    has_pending_invitation(id, auth.uid())
  );

-- ============================================
-- STEP 5: Fix community_invitations INSERT policy
-- The old "Admins can create invitations" policy queries community_members directly
-- ============================================

-- Drop the old problematic policy
DROP POLICY IF EXISTS "Admins can create invitations" ON community_invitations;

-- Drop and recreate with helper function
DROP POLICY IF EXISTS "Members can create invitations" ON community_invitations;
CREATE POLICY "Members can create invitations" ON community_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND
    is_community_member(community_id, auth.uid())
  );

-- Ensure admins/mods can manage all invitations
DROP POLICY IF EXISTS "Admins can manage invitations" ON community_invitations;
CREATE POLICY "Admins can manage invitations" ON community_invitations
  FOR ALL USING (
    is_community_admin_or_mod(community_id, auth.uid())
  );

-- ============================================
-- DONE! Test the following scenarios:
-- 1. Request to join a private community
-- 2. Accept an invitation to a private community
-- 3. Decline an invitation
-- 4. Invite a user to a community (as admin/mod/member)
-- ============================================
