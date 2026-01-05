-- Fix for infinite recursion in community_members RLS policies
-- Run this in your Supabase SQL editor

-- Step 1: Create a SECURITY DEFINER function to check membership without triggering RLS
CREATE OR REPLACE FUNCTION is_community_member(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND status = 'active'
  );
END;
$$;

-- Helper function to check if user is admin/mod
CREATE OR REPLACE FUNCTION is_community_admin_or_mod(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND role IN ('admin', 'moderator')
    AND status = 'active'
  );
END;
$$;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_community_admin(p_community_id UUID, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND role = 'admin'
    AND status = 'active'
  );
END;
$$;

-- Step 2: Drop existing problematic policies on community_members
DROP POLICY IF EXISTS "Anyone can view public community members" ON community_members;
DROP POLICY IF EXISTS "Members can view their community members" ON community_members;
DROP POLICY IF EXISTS "Users can join public communities" ON community_members;
DROP POLICY IF EXISTS "Users can leave communities" ON community_members;
DROP POLICY IF EXISTS "Admins can manage members" ON community_members;

-- Step 3: Recreate policies using helper functions

-- Users can always view their own membership
CREATE POLICY "Users can view own membership" ON community_members
  FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view members of public communities
CREATE POLICY "Anyone can view public community members" ON community_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_members.community_id
      AND privacy = 'public'
    )
  );

-- Members can view other members of their private communities
CREATE POLICY "Members can view private community members" ON community_members
  FOR SELECT USING (
    is_community_member(community_id, auth.uid())
  );

-- Users can join public communities (insert themselves as member)
CREATE POLICY "Users can join public communities" ON community_members
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    role = 'member' AND
    status = 'active' AND
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_id
      AND privacy = 'public'
    )
  );

-- Users can leave communities (delete their own membership, except admins need special handling)
CREATE POLICY "Users can leave communities" ON community_members
  FOR DELETE USING (
    auth.uid() = user_id AND
    role != 'admin'  -- Admins can't leave directly, must transfer ownership
  );

-- Admins and mods can update members (mute, ban, change role)
CREATE POLICY "Admins can update members" ON community_members
  FOR UPDATE USING (
    is_community_admin_or_mod(community_id, auth.uid())
  );

-- Admins can insert members (for approving join requests, invites)
CREATE POLICY "Admins can insert members" ON community_members
  FOR INSERT WITH CHECK (
    is_community_admin_or_mod(community_id, auth.uid())
  );

-- Admins can delete members (ban/kick)
CREATE POLICY "Admins can delete members" ON community_members
  FOR DELETE USING (
    is_community_admin_or_mod(community_id, auth.uid()) AND
    auth.uid() != user_id  -- Can't delete yourself via this policy
  );

-- Step 4: Fix other tables that reference community_members

-- Drop and recreate community_tags policies
DROP POLICY IF EXISTS "Members can view their community tags" ON community_tags;
CREATE POLICY "Members can view their community tags" ON community_tags
  FOR SELECT USING (
    is_community_member(community_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage community tags" ON community_tags;
CREATE POLICY "Admins can manage community tags" ON community_tags
  FOR ALL USING (
    is_community_admin(community_id, auth.uid())
  );

-- Drop and recreate community_rules policies
DROP POLICY IF EXISTS "Members can view their community rules" ON community_rules;
CREATE POLICY "Members can view their community rules" ON community_rules
  FOR SELECT USING (
    is_community_member(community_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage community rules" ON community_rules;
CREATE POLICY "Admins can manage community rules" ON community_rules
  FOR ALL USING (
    is_community_admin(community_id, auth.uid())
  );

-- Drop and recreate communities policies that check community_members
DROP POLICY IF EXISTS "Members can view their private communities" ON communities;
CREATE POLICY "Members can view their private communities" ON communities
  FOR SELECT USING (
    privacy = 'private' AND
    is_community_member(id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can update communities" ON communities;
CREATE POLICY "Admins can update communities" ON communities
  FOR UPDATE USING (
    is_community_admin(id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can delete communities" ON communities;
CREATE POLICY "Admins can delete communities" ON communities
  FOR DELETE USING (
    is_community_admin(id, auth.uid())
  );

-- Drop and recreate community_join_requests policies
DROP POLICY IF EXISTS "Admins can manage join requests" ON community_join_requests;
CREATE POLICY "Admins can manage join requests" ON community_join_requests
  FOR ALL USING (
    is_community_admin_or_mod(community_id, auth.uid())
  );

-- Drop and recreate community_invitations policies
DROP POLICY IF EXISTS "Members can create invitations" ON community_invitations;
CREATE POLICY "Members can create invitations" ON community_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND
    is_community_member(community_id, auth.uid())
  );

DROP POLICY IF EXISTS "Admins can manage invitations" ON community_invitations;
CREATE POLICY "Admins can manage invitations" ON community_invitations
  FOR ALL USING (
    is_community_admin_or_mod(community_id, auth.uid())
  );

-- Step 5: Update the trigger to bypass RLS when adding creator as admin
-- Drop and recreate the trigger function with SECURITY DEFINER
DROP TRIGGER IF EXISTS on_community_created ON communities;
DROP FUNCTION IF EXISTS add_creator_as_admin();

CREATE OR REPLACE FUNCTION add_creator_as_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_community_created
  AFTER INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION add_creator_as_admin();

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION is_community_member TO authenticated;
GRANT EXECUTE ON FUNCTION is_community_admin_or_mod TO authenticated;
GRANT EXECUTE ON FUNCTION is_community_admin TO authenticated;
