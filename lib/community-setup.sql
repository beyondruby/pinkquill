-- ============================================
-- QUILL COMMUNITIES - DATABASE SETUP SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================

-- 1. COMMUNITIES TABLE
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  privacy TEXT NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private')),
  category TEXT CHECK (category IN ('creative_genre', 'theme', 'community_type', NULL)),
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COMMUNITY TAGS TABLE
CREATE TABLE IF NOT EXISTS community_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  tag TEXT NOT NULL,
  tag_type TEXT DEFAULT 'custom' CHECK (tag_type IN ('genre', 'theme', 'type', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, tag)
);

-- 3. COMMUNITY RULES TABLE
CREATE TABLE IF NOT EXISTS community_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  rule_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, rule_number)
);

-- 4. COMMUNITY MEMBERS TABLE
CREATE TABLE IF NOT EXISTS community_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'moderator', 'member')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'muted', 'banned')),
  muted_until TIMESTAMPTZ,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- 5. COMMUNITY JOIN REQUESTS TABLE (for private communities)
CREATE TABLE IF NOT EXISTS community_join_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, user_id)
);

-- 6. COMMUNITY INVITATIONS TABLE
CREATE TABLE IF NOT EXISTS community_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(community_id, invitee_id)
);

-- 7. ADD COMMUNITY COLUMNS TO POSTS TABLE
ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES profiles(id);

-- 8. ADD COMMUNITY COLUMN TO NOTIFICATIONS TABLE
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE CASCADE;

-- 9. UPDATE NOTIFICATIONS TYPE CONSTRAINT
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'admire', 'comment', 'relay', 'save', 'follow', 'reply', 'comment_like',
    'community_invite', 'community_join_request', 'community_join_approved',
    'community_role_change', 'community_muted', 'community_banned'
  ));

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_privacy ON communities(privacy);
CREATE INDEX IF NOT EXISTS idx_communities_category ON communities(category);
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON communities(created_by);
CREATE INDEX IF NOT EXISTS idx_communities_created_at ON communities(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_tags_community ON community_tags(community_id);
CREATE INDEX IF NOT EXISTS idx_community_tags_tag ON community_tags(tag);
CREATE INDEX IF NOT EXISTS idx_community_tags_type ON community_tags(tag_type);

CREATE INDEX IF NOT EXISTS idx_community_rules_community ON community_rules(community_id);

CREATE INDEX IF NOT EXISTS idx_community_members_community ON community_members(community_id);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_community_members_role ON community_members(role);
CREATE INDEX IF NOT EXISTS idx_community_members_status ON community_members(status);

CREATE INDEX IF NOT EXISTS idx_join_requests_community ON community_join_requests(community_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_user ON community_join_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_join_requests_status ON community_join_requests(status);

CREATE INDEX IF NOT EXISTS idx_invitations_community ON community_invitations(community_id);
CREATE INDEX IF NOT EXISTS idx_invitations_invitee ON community_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS idx_invitations_status ON community_invitations(status);

CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id);
CREATE INDEX IF NOT EXISTS idx_posts_community_pinned ON posts(community_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_community ON notifications(community_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all community tables
ALTER TABLE communities ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_invitations ENABLE ROW LEVEL SECURITY;

-- COMMUNITIES POLICIES

-- Anyone can view public communities
CREATE POLICY "Anyone can view public communities" ON communities
  FOR SELECT USING (privacy = 'public');

-- Members can view private communities they belong to
CREATE POLICY "Members can view their private communities" ON communities
  FOR SELECT USING (
    privacy = 'private' AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Authenticated users can create communities
CREATE POLICY "Authenticated users can create communities" ON communities
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Admins can update their communities
CREATE POLICY "Admins can update communities" ON communities
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- Admins can delete their communities
CREATE POLICY "Admins can delete communities" ON communities
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = communities.id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- COMMUNITY TAGS POLICIES

-- Anyone can view tags of public communities
CREATE POLICY "Anyone can view public community tags" ON community_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_tags.community_id
      AND privacy = 'public'
    )
  );

-- Members can view tags of their private communities
CREATE POLICY "Members can view their community tags" ON community_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_tags.community_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Admins can manage tags
CREATE POLICY "Admins can manage community tags" ON community_tags
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_tags.community_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- COMMUNITY RULES POLICIES

-- Anyone can view rules of public communities
CREATE POLICY "Anyone can view public community rules" ON community_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_rules.community_id
      AND privacy = 'public'
    )
  );

-- Members can view rules of their private communities
CREATE POLICY "Members can view their community rules" ON community_rules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_rules.community_id
      AND user_id = auth.uid()
      AND status = 'active'
    )
  );

-- Admins can manage rules
CREATE POLICY "Admins can manage community rules" ON community_rules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_rules.community_id
      AND user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- COMMUNITY MEMBERS POLICIES

-- Members can view other members of public communities
CREATE POLICY "Anyone can view public community members" ON community_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_members.community_id
      AND privacy = 'public'
    )
  );

-- Members can view members of their private communities
CREATE POLICY "Members can view their community members" ON community_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
      AND cm.status = 'active'
    )
  );

-- Users can join public communities
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

-- Users can leave communities
CREATE POLICY "Users can leave communities" ON community_members
  FOR DELETE USING (auth.uid() = user_id);

-- Admins and mods can manage members
CREATE POLICY "Admins can manage members" ON community_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM community_members cm
      WHERE cm.community_id = community_members.community_id
      AND cm.user_id = auth.uid()
      AND cm.role IN ('admin', 'moderator')
    )
  );

-- COMMUNITY JOIN REQUESTS POLICIES

-- Users can create join requests for private communities
CREATE POLICY "Users can create join requests" ON community_join_requests
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    status = 'pending' AND
    EXISTS (
      SELECT 1 FROM communities
      WHERE id = community_id
      AND privacy = 'private'
    )
  );

-- Users can view their own requests
CREATE POLICY "Users can view their own requests" ON community_join_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Admins and mods can view and manage requests
CREATE POLICY "Admins can manage join requests" ON community_join_requests
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_join_requests.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Users can cancel their own pending requests
CREATE POLICY "Users can cancel their requests" ON community_join_requests
  FOR DELETE USING (auth.uid() = user_id AND status = 'pending');

-- COMMUNITY INVITATIONS POLICIES

-- Invitees can view their invitations
CREATE POLICY "Users can view their invitations" ON community_invitations
  FOR SELECT USING (auth.uid() = invitee_id);

-- Admins and mods can create invitations
CREATE POLICY "Admins can create invitations" ON community_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_invitations.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- Invitees can update (accept/decline) their invitations
CREATE POLICY "Users can respond to invitations" ON community_invitations
  FOR UPDATE USING (auth.uid() = invitee_id AND status = 'pending');

-- Admins can view all invitations for their community
CREATE POLICY "Admins can view community invitations" ON community_invitations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_id = community_invitations.community_id
      AND user_id = auth.uid()
      AND role IN ('admin', 'moderator')
    )
  );

-- ============================================
-- ENABLE REAL-TIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE community_members;
ALTER PUBLICATION supabase_realtime ADD TABLE community_join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE community_invitations;

-- ============================================
-- HELPER FUNCTION: Auto-add creator as admin
-- ============================================

CREATE OR REPLACE FUNCTION add_community_creator_as_admin()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (NEW.id, NEW.created_by, 'admin', 'active');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then create
DROP TRIGGER IF EXISTS on_community_created ON communities;
CREATE TRIGGER on_community_created
  AFTER INSERT ON communities
  FOR EACH ROW
  EXECUTE FUNCTION add_community_creator_as_admin();

-- ============================================
-- HELPER FUNCTION: Update community timestamp
-- ============================================

CREATE OR REPLACE FUNCTION update_community_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_community_updated ON communities;
CREATE TRIGGER on_community_updated
  BEFORE UPDATE ON communities
  FOR EACH ROW
  EXECUTE FUNCTION update_community_timestamp();

-- ============================================
-- DONE! Your communities tables are ready.
-- ============================================
