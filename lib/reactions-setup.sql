-- ============================================
-- QUILL REACTIONS - DATABASE SETUP SCRIPT
-- Run this in your Supabase SQL Editor
-- ============================================

-- This replaces the simple "admires" with a richer "reactions" system
-- Reaction types: admire, snap, ovation, support, inspired, applaud

-- 1. CREATE REACTIONS TABLE
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('admire', 'snap', 'ovation', 'support', 'inspired', 'applaud')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)  -- One reaction per user per post
);

-- 2. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_type ON reactions(reaction_type);
CREATE INDEX IF NOT EXISTS idx_reactions_created ON reactions(created_at DESC);

-- 3. ENABLE ROW LEVEL SECURITY
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

-- 4. RLS POLICIES

-- Anyone can view reactions
CREATE POLICY "Anyone can view reactions" ON reactions
  FOR SELECT USING (true);

-- Authenticated users can add reactions
CREATE POLICY "Users can add reactions" ON reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own reactions (change reaction type)
CREATE POLICY "Users can update own reactions" ON reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can remove their own reactions
CREATE POLICY "Users can remove own reactions" ON reactions
  FOR DELETE USING (auth.uid() = user_id);

-- 5. MIGRATE EXISTING ADMIRES TO REACTIONS (Optional)
-- This will copy existing admires to the new reactions table as 'admire' type
-- Uncomment and run if you want to preserve existing admires

-- INSERT INTO reactions (post_id, user_id, reaction_type, created_at)
-- SELECT post_id, user_id, 'admire', COALESCE(created_at, NOW())
-- FROM admires
-- ON CONFLICT (post_id, user_id) DO NOTHING;

-- 6. UPDATE NOTIFICATIONS TYPE CONSTRAINT
-- Add new reaction notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'admire', 'snap', 'ovation', 'support', 'inspired', 'applaud',  -- Reaction types
    'comment', 'relay', 'save', 'follow', 'reply', 'comment_like',  -- Existing types
    'community_invite', 'community_join_request', 'community_join_approved',
    'community_role_change', 'community_muted', 'community_banned'
  ));

-- 7. ADD REACTION_TYPE COLUMN TO NOTIFICATIONS (for reaction notifications)
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS reaction_type TEXT;

-- 8. ENABLE REAL-TIME
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get reaction counts by type for a post
CREATE OR REPLACE FUNCTION get_reaction_counts(p_post_id UUID)
RETURNS TABLE (
  reaction_type TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT r.reaction_type, COUNT(*)::BIGINT
  FROM reactions r
  WHERE r.post_id = p_post_id
  GROUP BY r.reaction_type;
END;
$$;

-- Function to get total reaction count for a post
CREATE OR REPLACE FUNCTION get_total_reactions(p_post_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total BIGINT;
BEGIN
  SELECT COUNT(*) INTO total
  FROM reactions
  WHERE post_id = p_post_id;
  RETURN total;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_reaction_counts TO authenticated;
GRANT EXECUTE ON FUNCTION get_total_reactions TO authenticated;

-- ============================================
-- DONE! Your reactions table is ready.
-- ============================================
