-- =============================================================================
-- Collaborators & Mentions Feature - Database Migration
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. POST COLLABORATORS TABLE
-- Stores collaboration invitations and their status
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  role TEXT, -- e.g., 'Co-writer', 'Illustrator', 'Editor', 'Photographer', etc.
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  UNIQUE(post_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_post_collaborators_post ON post_collaborators(post_id);
CREATE INDEX idx_post_collaborators_user ON post_collaborators(user_id);
CREATE INDEX idx_post_collaborators_status ON post_collaborators(status);

-- RLS Policies
ALTER TABLE post_collaborators ENABLE ROW LEVEL SECURITY;

-- Users can view collaborations on any public post
CREATE POLICY "Anyone can view accepted collaborators" ON post_collaborators
  FOR SELECT USING (status = 'accepted');

-- Users can view their own collaboration invites
CREATE POLICY "Users can view their own collaborations" ON post_collaborators
  FOR SELECT USING (auth.uid() = user_id);

-- Post authors can view all collaborations on their posts
CREATE POLICY "Authors can view collaborations on their posts" ON post_collaborators
  FOR SELECT USING (
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- Post authors can invite collaborators
CREATE POLICY "Authors can invite collaborators" ON post_collaborators
  FOR INSERT WITH CHECK (
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- Users can respond to their own invites
CREATE POLICY "Users can update their collaboration status" ON post_collaborators
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Post authors can remove collaborators
CREATE POLICY "Authors can remove collaborators" ON post_collaborators
  FOR DELETE USING (
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- Users can remove themselves from collaborations
CREATE POLICY "Users can remove themselves" ON post_collaborators
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. POST MENTIONS TABLE
-- Stores people tagged in posts (separate from hashtags)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS post_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

-- Indexes
CREATE INDEX idx_post_mentions_post ON post_mentions(post_id);
CREATE INDEX idx_post_mentions_user ON post_mentions(user_id);

-- RLS Policies
ALTER TABLE post_mentions ENABLE ROW LEVEL SECURITY;

-- Anyone can view mentions on public posts
CREATE POLICY "Anyone can view mentions" ON post_mentions
  FOR SELECT USING (true);

-- Post authors can add mentions
CREATE POLICY "Authors can add mentions" ON post_mentions
  FOR INSERT WITH CHECK (
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- Post authors can remove mentions
CREATE POLICY "Authors can remove mentions" ON post_mentions
  FOR DELETE USING (
    post_id IN (SELECT id FROM posts WHERE author_id = auth.uid())
  );

-- -----------------------------------------------------------------------------
-- 3. ADD STATUS COLUMN TO POSTS
-- For draft state while awaiting collaborator acceptance
-- -----------------------------------------------------------------------------
ALTER TABLE posts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'published'
  CHECK (status IN ('draft', 'published', 'archived'));

-- Update existing posts to be published
UPDATE posts SET status = 'published' WHERE status IS NULL;

-- -----------------------------------------------------------------------------
-- 4. UPDATE NOTIFICATION TYPE CONSTRAINT
-- Add new collaboration and mention notification types
-- -----------------------------------------------------------------------------
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'admire', 'comment', 'relay', 'save', 'follow', 'reply', 'comment_like',
    'collaboration_invite', 'collaboration_accepted', 'collaboration_declined', 'mention',
    'snap', 'ovation', 'support', 'inspired', 'applaud',
    'community_invite', 'community_join_approved', 'community_muted', 'community_banned'
  ));

-- -----------------------------------------------------------------------------
-- 5. ENABLE REALTIME FOR NEW TABLES
-- For live updates on collaboration status changes
-- -----------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE post_collaborators;

-- -----------------------------------------------------------------------------
-- 6. HELPER FUNCTION: Check if all collaborators accepted
-- Returns true if all collaborators have accepted (or if no collaborators)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION all_collaborators_accepted(p_post_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM post_collaborators
    WHERE post_id = p_post_id AND status = 'pending'
  );
END;
$$ LANGUAGE plpgsql;

-- -----------------------------------------------------------------------------
-- 7. TRIGGER: Auto-publish post when all collaborators accept
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION auto_publish_post()
RETURNS TRIGGER AS $$
BEGIN
  -- When a collaborator accepts
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Check if all collaborators have now accepted
    IF all_collaborators_accepted(NEW.post_id) THEN
      -- Update post status to published
      UPDATE posts SET status = 'published' WHERE id = NEW.post_id AND status = 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_publish_post
  AFTER UPDATE ON post_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION auto_publish_post();
