-- ============================================================================
-- Takes RLS Policies
-- Adds Row Level Security to the takes table and related tables
-- that were missing proper RLS enforcement.
-- ============================================================================

-- Enable RLS on takes table
ALTER TABLE takes ENABLE ROW LEVEL SECURITY;

-- SELECT: Public takes visible to all, private/followers-only respect visibility
CREATE POLICY "Anyone can view public takes" ON takes
  FOR SELECT USING (
    visibility IS NULL
    OR visibility = 'public'
    OR author_id = auth.uid()
    OR (
      visibility = 'followers'
      AND EXISTS (
        SELECT 1 FROM follows
        WHERE follower_id = auth.uid()
          AND following_id = takes.author_id
          AND status = 'accepted'
      )
    )
  );

-- INSERT: Authenticated users can create their own takes
CREATE POLICY "Users can create own takes" ON takes
  FOR INSERT WITH CHECK (auth.uid() = author_id);

-- UPDATE: Only authors can update their own takes
CREATE POLICY "Users can update own takes" ON takes
  FOR UPDATE USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- DELETE: Only authors can delete their own takes
CREATE POLICY "Users can delete own takes" ON takes
  FOR DELETE USING (auth.uid() = author_id);

-- ============================================================================
-- Ensure RLS is enabled on take interaction tables
-- ============================================================================

-- take_comments
DO $$ BEGIN
  ALTER TABLE take_comments ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Anyone can read take comments" ON take_comments
  FOR SELECT USING (true);
CREATE POLICY "Users can create own take comments" ON take_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own take comments" ON take_comments
  FOR DELETE USING (auth.uid() = user_id);

-- take_saves
DO $$ BEGIN
  ALTER TABLE take_saves ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can view own take saves" ON take_saves
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own take saves" ON take_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own take saves" ON take_saves
  FOR DELETE USING (auth.uid() = user_id);

-- take_relays
DO $$ BEGIN
  ALTER TABLE take_relays ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Anyone can read take relays" ON take_relays
  FOR SELECT USING (true);
CREATE POLICY "Users can create own take relays" ON take_relays
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own take relays" ON take_relays
  FOR DELETE USING (auth.uid() = user_id);

-- take_reactions
DO $$ BEGIN
  ALTER TABLE take_reactions ENABLE ROW LEVEL SECURITY;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Anyone can read take reactions" ON take_reactions
  FOR SELECT USING (true);
CREATE POLICY "Users can add take reactions" ON take_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own take reactions" ON take_reactions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own take reactions" ON take_reactions
  FOR DELETE USING (auth.uid() = user_id);
