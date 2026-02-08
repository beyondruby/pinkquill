-- Fix reports table: ensure all needed columns and policies exist

-- Add missing columns
ALTER TABLE reports ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES profiles(id);
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_action TEXT;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS resolution_notes TEXT;

-- Index for fast mod queue lookups by community
CREATE INDEX IF NOT EXISTS idx_reports_community_id ON reports(community_id);

-- Ensure RLS is enabled
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- INSERT policy: authenticated users can create reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can create reports' AND tablename = 'reports') THEN
    EXECUTE 'CREATE POLICY "Users can create reports" ON reports FOR INSERT WITH CHECK (auth.uid() = reporter_id)';
  END IF;
END $$;

-- SELECT policy: users can view their own submitted reports
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can view own reports' AND tablename = 'reports') THEN
    EXECUTE 'CREATE POLICY "Users can view own reports" ON reports FOR SELECT USING (auth.uid() = reporter_id)';
  END IF;
END $$;

-- SELECT policy: moderators/admins can view reports for their community
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mods can view community reports' AND tablename = 'reports') THEN
    EXECUTE 'CREATE POLICY "Mods can view community reports" ON reports FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM community_members
        WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN (''admin'', ''moderator'')
        AND community_members.status = ''active''
      )
    )';
  END IF;
END $$;

-- UPDATE policy: moderators/admins can resolve reports for their community
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Mods can update community reports' AND tablename = 'reports') THEN
    EXECUTE 'CREATE POLICY "Mods can update community reports" ON reports FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM community_members
        WHERE community_members.community_id = reports.community_id
        AND community_members.user_id = auth.uid()
        AND community_members.role IN (''admin'', ''moderator'')
        AND community_members.status = ''active''
      )
    )';
  END IF;
END $$;
