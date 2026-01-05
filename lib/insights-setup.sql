-- ============================================================================
-- QUILL INSIGHTS SYSTEM - DATABASE SCHEMA
-- ============================================================================
-- Run this SQL in Supabase SQL Editor to set up analytics tracking tables
-- ============================================================================

-- ============================================================================
-- 1. POST VIEWS (unique per user/session per post per day)
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,  -- For anonymous users
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'feed',  -- feed, search, profile, community, direct, relay
  is_follower BOOLEAN DEFAULT false,
  read_time_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one view per authenticated user per post per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_user_unique
  ON post_views(post_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;

-- Unique constraint: one view per anonymous session per post per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_post_views_session_unique
  ON post_views(post_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;

-- ============================================================================
-- 2. POST IMPRESSIONS (every display, including repeats)
-- ============================================================================
CREATE TABLE IF NOT EXISTS post_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT DEFAULT 'feed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 3. TAKE VIEWS (unique per user/session per take per day)
-- ============================================================================
CREATE TABLE IF NOT EXISTS take_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id UUID NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'feed',
  is_follower BOOLEAN DEFAULT false,
  watch_time_seconds INTEGER DEFAULT 0,
  watch_percentage INTEGER DEFAULT 0,  -- 0-100+
  loop_count INTEGER DEFAULT 1,
  completed BOOLEAN DEFAULT false,  -- Watched to end at least once
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one view per authenticated user per take per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_take_views_user_unique
  ON take_views(take_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;

-- Unique constraint: one view per anonymous session per take per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_take_views_session_unique
  ON take_views(take_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;

-- ============================================================================
-- 4. TAKE IMPRESSIONS (every display)
-- ============================================================================
CREATE TABLE IF NOT EXISTS take_impressions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  take_id UUID NOT NULL REFERENCES takes(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT DEFAULT 'feed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 5. PROFILE VIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  source TEXT DEFAULT 'direct',  -- direct, post, take, search
  is_follower BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one view per authenticated user per profile per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_user_unique
  ON profile_views(profile_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;

-- Unique constraint: one view per anonymous session per profile per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_profile_views_session_unique
  ON profile_views(profile_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;

-- ============================================================================
-- 6. COMMUNITY VIEWS
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  view_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_member BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one view per authenticated user per community per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_views_user_unique
  ON community_views(community_id, viewer_id, view_date)
  WHERE viewer_id IS NOT NULL;

-- Unique constraint: one view per anonymous session per community per day
CREATE UNIQUE INDEX IF NOT EXISTS idx_community_views_session_unique
  ON community_views(community_id, session_id, view_date)
  WHERE session_id IS NOT NULL AND viewer_id IS NULL;

-- ============================================================================
-- 7. FOLLOWER HISTORY (for growth tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS follower_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  follower_count INTEGER DEFAULT 0,
  gained INTEGER DEFAULT 0,
  lost INTEGER DEFAULT 0,
  net_change INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, date)
);

-- ============================================================================
-- 8. COMMUNITY MEMBER HISTORY
-- ============================================================================
CREATE TABLE IF NOT EXISTS community_member_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  member_count INTEGER DEFAULT 0,
  joined INTEGER DEFAULT 0,
  left INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(community_id, date)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Post views indexes
CREATE INDEX IF NOT EXISTS idx_post_views_post_date ON post_views(post_id, view_date);
CREATE INDEX IF NOT EXISTS idx_post_views_viewer ON post_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_post_views_created ON post_views(created_at);

-- Post impressions indexes
CREATE INDEX IF NOT EXISTS idx_post_impressions_post ON post_impressions(post_id);
CREATE INDEX IF NOT EXISTS idx_post_impressions_created ON post_impressions(created_at);

-- Take views indexes
CREATE INDEX IF NOT EXISTS idx_take_views_take_date ON take_views(take_id, view_date);
CREATE INDEX IF NOT EXISTS idx_take_views_viewer ON take_views(viewer_id);
CREATE INDEX IF NOT EXISTS idx_take_views_created ON take_views(created_at);

-- Take impressions indexes
CREATE INDEX IF NOT EXISTS idx_take_impressions_take ON take_impressions(take_id);
CREATE INDEX IF NOT EXISTS idx_take_impressions_created ON take_impressions(created_at);

-- Profile views indexes
CREATE INDEX IF NOT EXISTS idx_profile_views_profile_date ON profile_views(profile_id, view_date);
CREATE INDEX IF NOT EXISTS idx_profile_views_viewer ON profile_views(viewer_id);

-- Community views indexes
CREATE INDEX IF NOT EXISTS idx_community_views_community_date ON community_views(community_id, view_date);

-- History indexes
CREATE INDEX IF NOT EXISTS idx_follower_history_profile_date ON follower_history(profile_id, date);
CREATE INDEX IF NOT EXISTS idx_community_member_history_date ON community_member_history(community_id, date);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE post_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE take_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE take_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_views ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_member_history ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- INSERT POLICIES (anyone can record views)
-- ============================================================================

CREATE POLICY "Anyone can record post views" ON post_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can record post impressions" ON post_impressions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can record take views" ON take_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can record take impressions" ON take_impressions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can record profile views" ON profile_views
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can record community views" ON community_views
  FOR INSERT WITH CHECK (true);

-- ============================================================================
-- SELECT POLICIES (only content owners can read their stats)
-- ============================================================================

CREATE POLICY "Authors can read their post views" ON post_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_views.post_id
      AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can read their post impressions" ON post_impressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_impressions.post_id
      AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can read their take views" ON take_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM takes
      WHERE takes.id = take_views.take_id
      AND takes.author_id = auth.uid()
    )
  );

CREATE POLICY "Authors can read their take impressions" ON take_impressions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM takes
      WHERE takes.id = take_impressions.take_id
      AND takes.author_id = auth.uid()
    )
  );

CREATE POLICY "Users can read their own profile views" ON profile_views
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Users can read their own follower history" ON follower_history
  FOR SELECT USING (auth.uid() = profile_id);

CREATE POLICY "Community admins can read community views" ON community_views
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_views.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "Community admins can read member history" ON community_member_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM community_members
      WHERE community_members.community_id = community_member_history.community_id
      AND community_members.user_id = auth.uid()
      AND community_members.role IN ('admin', 'moderator')
    )
  );

-- ============================================================================
-- UPDATE POLICIES (for updating read time, watch time, etc.)
-- ============================================================================

CREATE POLICY "Viewers can update their own post views" ON post_views
  FOR UPDATE USING (
    (viewer_id IS NOT NULL AND viewer_id = auth.uid()) OR
    (viewer_id IS NULL AND session_id IS NOT NULL)
  );

CREATE POLICY "Viewers can update their own take views" ON take_views
  FOR UPDATE USING (
    (viewer_id IS NOT NULL AND viewer_id = auth.uid()) OR
    (viewer_id IS NULL AND session_id IS NOT NULL)
  );

-- ============================================================================
-- FOLLOWER CHANGE TRIGGER (auto-log follower gains/losses)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_follower_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Someone gained a follower
    INSERT INTO follower_history (profile_id, date, gained, net_change)
    VALUES (NEW.following_id, CURRENT_DATE, 1, 1)
    ON CONFLICT (profile_id, date)
    DO UPDATE SET
      gained = follower_history.gained + 1,
      net_change = follower_history.net_change + 1;
  ELSIF TG_OP = 'DELETE' THEN
    -- Someone lost a follower
    INSERT INTO follower_history (profile_id, date, lost, net_change)
    VALUES (OLD.following_id, CURRENT_DATE, 1, -1)
    ON CONFLICT (profile_id, date)
    DO UPDATE SET
      lost = follower_history.lost + 1,
      net_change = follower_history.net_change - 1;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_follow_change ON follows;

-- Create trigger for follow changes
CREATE TRIGGER on_follow_change
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION log_follower_change();

-- ============================================================================
-- COMMUNITY MEMBER CHANGE TRIGGER (auto-log member joins/leaves)
-- ============================================================================

CREATE OR REPLACE FUNCTION log_community_member_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Someone joined the community
    INSERT INTO community_member_history (community_id, date, joined)
    VALUES (NEW.community_id, CURRENT_DATE, 1)
    ON CONFLICT (community_id, date)
    DO UPDATE SET joined = community_member_history.joined + 1;
  ELSIF TG_OP = 'DELETE' THEN
    -- Someone left the community
    INSERT INTO community_member_history (community_id, date, left)
    VALUES (OLD.community_id, CURRENT_DATE, 1)
    ON CONFLICT (community_id, date)
    DO UPDATE SET left = community_member_history.left + 1;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_community_member_change ON community_members;

-- Create trigger for community member changes
CREATE TRIGGER on_community_member_change
AFTER INSERT OR DELETE ON community_members
FOR EACH ROW EXECUTE FUNCTION log_community_member_change();

-- ============================================================================
-- ENABLE REALTIME FOR INSIGHTS TABLES (optional, for live dashboards)
-- ============================================================================

-- Uncomment these if you want real-time updates in the dashboard
-- ALTER PUBLICATION supabase_realtime ADD TABLE post_views;
-- ALTER PUBLICATION supabase_realtime ADD TABLE take_views;
-- ALTER PUBLICATION supabase_realtime ADD TABLE profile_views;
-- ALTER PUBLICATION supabase_realtime ADD TABLE follower_history;
