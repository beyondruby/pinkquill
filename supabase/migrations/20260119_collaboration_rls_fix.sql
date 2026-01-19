-- =============================================================================
-- Collaboration & Notifications RLS Fix
-- This migration ensures proper RLS policies for collaboration features
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FIX NOTIFICATIONS TABLE RLS
-- Ensure notifications can be created and read properly
-- -----------------------------------------------------------------------------

-- Enable RLS on notifications if not already enabled
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
DROP POLICY IF EXISTS "Anyone can create notifications" ON notifications;
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;

-- Users can view notifications sent to them
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Any authenticated user can create notifications (for likes, comments, follows, etc.)
CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete their own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 2. FIX POST_COLLABORATORS TABLE RLS
-- Ensure collaborators can be added and viewed properly
-- -----------------------------------------------------------------------------

-- Enable RLS on post_collaborators if not already enabled
ALTER TABLE post_collaborators ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them properly
DROP POLICY IF EXISTS "Anyone can view accepted collaborators" ON post_collaborators;
DROP POLICY IF EXISTS "Users can view their own collaborations" ON post_collaborators;
DROP POLICY IF EXISTS "Authors can view collaborations on their posts" ON post_collaborators;
DROP POLICY IF EXISTS "Authors can invite collaborators" ON post_collaborators;
DROP POLICY IF EXISTS "Users can update their collaboration status" ON post_collaborators;
DROP POLICY IF EXISTS "Authors can remove collaborators" ON post_collaborators;
DROP POLICY IF EXISTS "Users can remove themselves" ON post_collaborators;

-- Anyone can view accepted collaborators on published posts
CREATE POLICY "Anyone can view accepted collaborators" ON post_collaborators
  FOR SELECT USING (status = 'accepted');

-- Users can view their own collaboration invites (regardless of status)
CREATE POLICY "Users can view their own collaborations" ON post_collaborators
  FOR SELECT USING (auth.uid() = user_id);

-- Post authors can view all collaborations on their posts
CREATE POLICY "Authors can view collaborations on their posts" ON post_collaborators
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_collaborators.post_id AND posts.author_id = auth.uid())
  );

-- Post authors can invite collaborators
CREATE POLICY "Authors can invite collaborators" ON post_collaborators
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_collaborators.post_id AND posts.author_id = auth.uid())
  );

-- Users can respond to their own invites (accept/decline)
CREATE POLICY "Users can update their collaboration status" ON post_collaborators
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Post authors can remove collaborators
CREATE POLICY "Authors can remove collaborators" ON post_collaborators
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM posts WHERE posts.id = post_collaborators.post_id AND posts.author_id = auth.uid())
  );

-- Users can remove themselves from collaborations
CREATE POLICY "Users can remove themselves" ON post_collaborators
  FOR DELETE USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------------
-- 3. FIX POSTS TABLE - Ensure authors can update their own posts status
-- -----------------------------------------------------------------------------

-- Drop and recreate policy for updating posts
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Authors can update their own posts" ON posts;

-- Authors can update their own posts (including status changes)
CREATE POLICY "Authors can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- -----------------------------------------------------------------------------
-- 4. ENSURE REALTIME IS ENABLED
-- -----------------------------------------------------------------------------

-- Enable realtime for post_collaborators (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'post_collaborators'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE post_collaborators;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Publication might not exist or table already in publication
    NULL;
END $$;

-- Enable realtime for notifications (if not already)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;

-- -----------------------------------------------------------------------------
-- 5. VERIFY TRIGGER EXISTS FOR AUTO-PUBLISH
-- -----------------------------------------------------------------------------

-- Recreate the auto-publish trigger function
CREATE OR REPLACE FUNCTION auto_publish_post()
RETURNS TRIGGER AS $$
BEGIN
  -- When a collaborator accepts
  IF NEW.status = 'accepted' AND OLD.status = 'pending' THEN
    -- Check if all collaborators have now accepted
    IF NOT EXISTS (
      SELECT 1 FROM post_collaborators
      WHERE post_id = NEW.post_id AND status = 'pending'
    ) THEN
      -- Update post status to published
      UPDATE posts SET status = 'published' WHERE id = NEW.post_id AND status = 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_publish_post ON post_collaborators;
CREATE TRIGGER trigger_auto_publish_post
  AFTER UPDATE ON post_collaborators
  FOR EACH ROW
  EXECUTE FUNCTION auto_publish_post();
