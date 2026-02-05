-- ============================================================================
-- Phase 1 Community Features Migration
-- Features: Post Flair, Mod Queue Enhancements, Hot Score Function
-- ============================================================================

-- ============================================================================
-- POST FLAIR SYSTEM
-- ============================================================================

-- Create community_flairs table for categorizing posts within communities
CREATE TABLE IF NOT EXISTS community_flairs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#8e44ad',
  emoji TEXT,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, name)
);

COMMENT ON TABLE community_flairs IS 'Flair/tag options for categorizing posts within a community';
COMMENT ON COLUMN community_flairs.color IS 'Hex color code for the flair badge';
COMMENT ON COLUMN community_flairs.emoji IS 'Optional emoji prefix for the flair';
COMMENT ON COLUMN community_flairs.position IS 'Display order position (lower = first)';

-- Add flair_id column to posts table
ALTER TABLE posts ADD COLUMN IF NOT EXISTS flair_id UUID REFERENCES community_flairs(id) ON DELETE SET NULL;

COMMENT ON COLUMN posts.flair_id IS 'Optional flair/category for the post within its community';

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_community_flairs_community ON community_flairs(community_id);
CREATE INDEX IF NOT EXISTS idx_community_flairs_position ON community_flairs(community_id, position);
CREATE INDEX IF NOT EXISTS idx_posts_flair ON posts(flair_id) WHERE flair_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_posts_community_flair ON posts(community_id, flair_id) WHERE community_id IS NOT NULL;

-- Enable RLS for community_flairs
ALTER TABLE community_flairs ENABLE ROW LEVEL SECURITY;

-- Anyone can view flairs (needed for displaying on posts)
DROP POLICY IF EXISTS "Anyone can view flairs" ON community_flairs;
CREATE POLICY "Anyone can view flairs" ON community_flairs
  FOR SELECT USING (true);

-- Only community admins can create flairs
DROP POLICY IF EXISTS "Admins can create flairs" ON community_flairs;
CREATE POLICY "Admins can create flairs" ON community_flairs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_flairs.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role = 'admin'
        AND community_members.status = 'active'
    )
  );

-- Only community admins can update flairs
DROP POLICY IF EXISTS "Admins can update flairs" ON community_flairs;
CREATE POLICY "Admins can update flairs" ON community_flairs
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_flairs.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role = 'admin'
        AND community_members.status = 'active'
    )
  );

-- Only community admins can delete flairs
DROP POLICY IF EXISTS "Admins can delete flairs" ON community_flairs;
CREATE POLICY "Admins can delete flairs" ON community_flairs
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_flairs.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role = 'admin'
        AND community_members.status = 'active'
    )
  );

-- ============================================================================
-- MOD QUEUE ENHANCEMENTS TO REPORTS TABLE
-- ============================================================================

-- Add missing base columns to reports table
ALTER TABLE reports ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'post';
ALTER TABLE reports ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';

-- Add community_id to reports for community-scoped moderation
ALTER TABLE reports ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- Add resolution tracking columns
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_action TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

COMMENT ON COLUMN reports.reported_user_id IS 'User being reported (for user reports)';
COMMENT ON COLUMN reports.type IS 'Type of report: user, post, comment, take, community';
COMMENT ON COLUMN reports.status IS 'Report status: pending, reviewed, resolved';
COMMENT ON COLUMN reports.community_id IS 'Community where the reported content belongs (for community-scoped moderation)';
COMMENT ON COLUMN reports.resolved_by IS 'Moderator who resolved this report';
COMMENT ON COLUMN reports.resolved_at IS 'Timestamp when the report was resolved';
COMMENT ON COLUMN reports.resolution_action IS 'Action taken: dismissed, content_deleted, user_muted, user_banned, warning_sent';
COMMENT ON COLUMN reports.resolution_notes IS 'Optional notes from the moderator about the resolution';

-- Add constraints for valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_type_check'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_type_check
      CHECK (type IN ('user', 'post', 'comment', 'take', 'community'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_status_check'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_status_check
      CHECK (status IN ('pending', 'reviewed', 'resolved'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_resolution_action_check'
  ) THEN
    ALTER TABLE reports ADD CONSTRAINT reports_resolution_action_check
      CHECK (resolution_action IS NULL OR resolution_action IN ('dismissed', 'content_deleted', 'user_muted', 'user_banned', 'warning_sent'));
  END IF;
END $$;

-- Create indexes for mod queue queries
CREATE INDEX IF NOT EXISTS idx_reports_community ON reports(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_status_community ON reports(community_id, status) WHERE community_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);

-- RLS policies for community moderators to access reports

-- Community moderators can view reports for their community
DROP POLICY IF EXISTS "Mods can view community reports" ON reports;
CREATE POLICY "Mods can view community reports" ON reports
  FOR SELECT USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'moderator')
        AND community_members.status = 'active'
    )
  );

-- Community moderators can update (resolve) reports for their community
DROP POLICY IF EXISTS "Mods can update community reports" ON reports;
CREATE POLICY "Mods can update community reports" ON reports
  FOR UPDATE USING (
    community_id IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN ('admin', 'moderator')
        AND community_members.status = 'active'
    )
  );

-- ============================================================================
-- HOT SCORE FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_hot_score(
  admires_count INTEGER,
  comments_count INTEGER,
  relays_count INTEGER,
  created_at TIMESTAMPTZ
) RETURNS FLOAT AS $$
DECLARE
  hours_age FLOAT;
  engagement_score FLOAT;
BEGIN
  hours_age := GREATEST(0, EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600);
  engagement_score := COALESCE(admires_count, 0) +
                      (COALESCE(comments_count, 0) * 2) +
                      (COALESCE(relays_count, 0) * 1.5);
  RETURN engagement_score / POWER(hours_age + 2, 1.5);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_hot_score IS 'Calculates hot/trending score for posts based on engagement and age';

-- ============================================================================
-- HELPER FUNCTION: Get time range start date
-- ============================================================================

CREATE OR REPLACE FUNCTION get_time_range_start(time_range TEXT)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN CASE time_range
    WHEN 'today' THEN DATE_TRUNC('day', NOW())
    WHEN 'week' THEN NOW() - INTERVAL '7 days'
    WHEN 'month' THEN NOW() - INTERVAL '30 days'
    WHEN 'year' THEN NOW() - INTERVAL '365 days'
    ELSE NULL
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION get_time_range_start IS 'Returns the start timestamp for a given time range filter';
