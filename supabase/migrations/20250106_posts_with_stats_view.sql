-- ============================================================================
-- STEP 1: POSTS_WITH_STATS VIEW
-- A materialized-style view for efficient post fetching with all stats computed
-- Uses SECURITY INVOKER to respect RLS policies of the calling user
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS posts_with_stats;

-- Create the optimized view
CREATE VIEW posts_with_stats
WITH (security_invoker = true)
AS
SELECT
  p.*,

  -- Author details (single join, not N+1)
  jsonb_build_object(
    'id', author.id,
    'username', author.username,
    'display_name', author.display_name,
    'avatar_url', author.avatar_url,
    'is_verified', author.is_verified,
    'is_private', author.is_private
  ) AS author,

  -- Community details (optional)
  CASE
    WHEN c.id IS NOT NULL THEN jsonb_build_object(
      'id', c.id,
      'slug', c.slug,
      'name', c.name,
      'avatar_url', c.avatar_url
    )
    ELSE NULL
  END AS community,

  -- Server-side computed counts (no N+1 queries)
  COALESCE(admire_counts.count, 0)::int AS admires_count,
  COALESCE(comment_counts.count, 0)::int AS comments_count,
  COALESCE(relay_counts.count, 0)::int AS relays_count,
  COALESCE(reaction_counts.count, 0)::int AS reactions_count,

  -- User-specific flags (using auth.uid())
  EXISTS (
    SELECT 1 FROM admires a
    WHERE a.post_id = p.id AND a.user_id = auth.uid()
  ) AS user_has_admired,

  EXISTS (
    SELECT 1 FROM saves s
    WHERE s.post_id = p.id AND s.user_id = auth.uid()
  ) AS user_has_saved,

  EXISTS (
    SELECT 1 FROM relays r
    WHERE r.post_id = p.id AND r.user_id = auth.uid()
  ) AS user_has_relayed,

  -- Get user's reaction type if any
  (
    SELECT reaction_type FROM reactions
    WHERE post_id = p.id AND user_id = auth.uid()
    LIMIT 1
  ) AS user_reaction_type

FROM posts p

-- Join author profile
INNER JOIN profiles author ON author.id = p.author_id

-- Optional community join
LEFT JOIN communities c ON c.id = p.community_id

-- Aggregate counts via lateral joins for efficiency
LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as count
  FROM admires WHERE post_id = p.id
) admire_counts ON true

LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as count
  FROM comments WHERE post_id = p.id
) comment_counts ON true

LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as count
  FROM relays WHERE post_id = p.id
) relay_counts ON true

LEFT JOIN LATERAL (
  SELECT COUNT(*)::int as count
  FROM reactions WHERE post_id = p.id
) reaction_counts ON true;

-- ============================================================================
-- STEP 2: POST MEDIA VIEW (for efficient media fetching)
-- ============================================================================

DROP VIEW IF EXISTS posts_media_aggregated;

CREATE VIEW posts_media_aggregated AS
SELECT
  post_id,
  jsonb_agg(
    jsonb_build_object(
      'id', id,
      'media_url', media_url,
      'media_type', media_type,
      'caption', caption,
      'position', position
    ) ORDER BY position
  ) AS media
FROM post_media
GROUP BY post_id;

-- ============================================================================
-- STEP 3: RLS POLICIES FOR POSTS
-- Move ALL visibility/blocking logic to database level
-- ============================================================================

-- Enable RLS on posts if not already enabled
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "posts_select_policy" ON posts;
DROP POLICY IF EXISTS "posts_insert_policy" ON posts;
DROP POLICY IF EXISTS "posts_update_policy" ON posts;
DROP POLICY IF EXISTS "posts_delete_policy" ON posts;
DROP POLICY IF EXISTS "Public posts are viewable by everyone" ON posts;
DROP POLICY IF EXISTS "Users can view posts from users they follow" ON posts;
DROP POLICY IF EXISTS "Users can view their own posts" ON posts;

-- Create comprehensive SELECT policy
-- A post is viewable if ALL conditions are met:
-- 1. Post is published (not draft)
-- 2. Viewer is not blocked by author AND author is not blocked by viewer
-- 3. Visibility rules: public OR (followers AND is_follower) OR is_author
CREATE POLICY "posts_visibility_policy" ON posts
FOR SELECT
USING (
  -- Always allow if no user is logged in and post is public
  (
    auth.uid() IS NULL
    AND visibility = 'public'
    AND status = 'published'
    AND NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE id = posts.author_id AND is_private = true
    )
  )
  OR
  -- For logged-in users
  (
    auth.uid() IS NOT NULL
    AND (
      -- Always see your own posts
      author_id = auth.uid()
      OR
      (
        -- Post must be published
        status = 'published'
        -- Block check: neither user has blocked the other
        AND NOT EXISTS (
          SELECT 1 FROM blocks
          WHERE (blocker_id = posts.author_id AND blocked_id = auth.uid())
             OR (blocker_id = auth.uid() AND blocked_id = posts.author_id)
        )
        -- Visibility check
        AND (
          -- Public posts are always visible (unless from private account)
          (
            visibility = 'public'
            AND NOT EXISTS (
              SELECT 1 FROM profiles
              WHERE id = posts.author_id
              AND is_private = true
              -- Unless viewer follows the private account
              AND NOT EXISTS (
                SELECT 1 FROM follows
                WHERE follower_id = auth.uid()
                AND following_id = posts.author_id
                AND status = 'accepted'
              )
            )
          )
          OR
          -- Followers-only posts visible to followers
          (
            visibility = 'followers'
            AND EXISTS (
              SELECT 1 FROM follows
              WHERE follower_id = auth.uid()
              AND following_id = posts.author_id
              AND status = 'accepted'
            )
          )
        )
      )
    )
  )
);

-- INSERT policy: users can only create posts as themselves
CREATE POLICY "posts_insert_policy" ON posts
FOR INSERT
WITH CHECK (
  auth.uid() IS NOT NULL
  AND author_id = auth.uid()
);

-- UPDATE policy: users can only update their own posts
CREATE POLICY "posts_update_policy" ON posts
FOR UPDATE
USING (auth.uid() = author_id)
WITH CHECK (auth.uid() = author_id);

-- DELETE policy: users can only delete their own posts
CREATE POLICY "posts_delete_policy" ON posts
FOR DELETE
USING (auth.uid() = author_id);

-- ============================================================================
-- STEP 4: CREATE HELPER FUNCTIONS
-- ============================================================================

-- Function to check if two users have blocked each other
CREATE OR REPLACE FUNCTION is_blocked_either_way(user1_id UUID, user2_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = user1_id AND blocked_id = user2_id)
       OR (blocker_id = user2_id AND blocked_id = user1_id)
  );
$$;

-- Function to check if user1 follows user2 (accepted)
CREATE OR REPLACE FUNCTION is_following(follower UUID, following UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM follows
    WHERE follower_id = follower
    AND following_id = following
    AND status = 'accepted'
  );
$$;

-- ============================================================================
-- STEP 5: INDEXES FOR PERFORMANCE
-- ============================================================================

-- Composite indexes for the view's aggregations
CREATE INDEX IF NOT EXISTS idx_admires_post_id ON admires(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_relays_post_id ON relays(post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_post_id ON reactions(post_id);

-- Indexes for RLS policy checks (critical for performance)
CREATE INDEX IF NOT EXISTS idx_blocks_blocker_blocked ON blocks(blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked_blocker ON blocks(blocked_id, blocker_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_following_status ON follows(follower_id, following_id, status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_private ON profiles(id) WHERE is_private = true;

-- Index for user interaction lookups
CREATE INDEX IF NOT EXISTS idx_admires_user_post ON admires(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_saves_user_post ON saves(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_relays_user_post ON relays(user_id, post_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_post ON reactions(user_id, post_id);

-- ============================================================================
-- STEP 6: GRANT PERMISSIONS
-- ============================================================================

-- Grant access to the view for authenticated users
GRANT SELECT ON posts_with_stats TO authenticated;
GRANT SELECT ON posts_with_stats TO anon;
GRANT SELECT ON posts_media_aggregated TO authenticated;
GRANT SELECT ON posts_media_aggregated TO anon;

-- ============================================================================
-- NOTES FOR DEVELOPERS:
--
-- 1. The view uses security_invoker = true, which means RLS policies
--    on the underlying tables are applied based on the calling user.
--
-- 2. All blocking/visibility logic is now in the database.
--    DO NOT filter posts in JavaScript anymore.
--
-- 3. To query with pagination:
--    SELECT * FROM posts_with_stats
--    ORDER BY created_at DESC
--    LIMIT 20 OFFSET 0;
--
-- 4. To get media for posts, join with posts_media_aggregated:
--    SELECT p.*, m.media
--    FROM posts_with_stats p
--    LEFT JOIN posts_media_aggregated m ON m.post_id = p.id;
--
-- ============================================================================
