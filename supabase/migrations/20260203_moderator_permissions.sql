-- Add moderator permissions to community_members table
-- This allows admins to grant specific powers to moderators

-- Add permissions JSONB column to community_members
ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT NULL;

-- Add comment explaining the structure
COMMENT ON COLUMN community_members.permissions IS 'Moderator permissions: { can_mute, can_ban, can_delete_posts, can_delete_comments, can_pin_posts, can_manage_rules }';

-- Create index for querying members with specific permissions
CREATE INDEX IF NOT EXISTS idx_community_members_permissions
ON community_members USING GIN (permissions)
WHERE permissions IS NOT NULL;

-- Create a function to check if a user has a specific permission in a community
CREATE OR REPLACE FUNCTION check_community_permission(
  p_community_id UUID,
  p_user_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
BEGIN
  -- Get the user's role and permissions
  SELECT role, permissions
  INTO v_role, v_permissions
  FROM community_members
  WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND status = 'active';

  -- If not a member, no permission
  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admins have all permissions
  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Members have no moderation permissions
  IF v_role = 'member' THEN
    RETURN FALSE;
  END IF;

  -- For moderators, check specific permission
  IF v_role = 'moderator' THEN
    -- If no permissions set, return false
    IF v_permissions IS NULL THEN
      RETURN FALSE;
    END IF;

    -- Check the specific permission
    RETURN COALESCE((v_permissions->>p_permission)::BOOLEAN, FALSE);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a table for deleted community content (audit trail)
CREATE TABLE IF NOT EXISTS community_content_deletions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'comment')),
  content_id UUID NOT NULL,
  content_author_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  deleted_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT,
  deleted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for the deletions table
CREATE INDEX IF NOT EXISTS idx_content_deletions_community ON community_content_deletions(community_id);
CREATE INDEX IF NOT EXISTS idx_content_deletions_deleted_by ON community_content_deletions(deleted_by);
CREATE INDEX IF NOT EXISTS idx_content_deletions_content ON community_content_deletions(content_type, content_id);

-- Enable RLS on the deletions table
ALTER TABLE community_content_deletions ENABLE ROW LEVEL SECURITY;

-- Admins and moderators can view deletions in their communities
CREATE POLICY "Community staff can view deletions" ON community_content_deletions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_content_deletions.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'moderator')
        AND community_members.status = 'active'
    )
  );

-- Only authenticated users can insert deletions (actual permission check happens in application)
CREATE POLICY "Authenticated users can log deletions" ON community_content_deletions
  FOR INSERT WITH CHECK (auth.uid() = deleted_by);
