-- Performance indexes migration
-- These indexes improve query performance for common operations

-- ============================================================================
-- Post-related indexes
-- ============================================================================

-- Index for fetching posts by status and creation date (feed queries)
CREATE INDEX IF NOT EXISTS idx_posts_status_created
  ON posts(status, created_at DESC)
  WHERE status = 'published';

-- Index for community posts
CREATE INDEX IF NOT EXISTS idx_posts_community_created
  ON posts(community_id, created_at DESC)
  WHERE community_id IS NOT NULL;

-- ============================================================================
-- Post interactions indexes
-- ============================================================================

-- Index for post collaborators lookup (used in feed)
CREATE INDEX IF NOT EXISTS idx_post_collaborators_post_status
  ON post_collaborators(post_id, status);

-- Index for post mentions lookup (used in feed)
CREATE INDEX IF NOT EXISTS idx_post_mentions_post_id
  ON post_mentions(post_id);

-- Index for post tags lookup (used in feed and tag pages)
CREATE INDEX IF NOT EXISTS idx_post_tags_post_id
  ON post_tags(post_id);

CREATE INDEX IF NOT EXISTS idx_post_tags_tag_id
  ON post_tags(tag_id);

-- ============================================================================
-- Reactions indexes
-- ============================================================================

-- Composite index for user reaction lookup
CREATE INDEX IF NOT EXISTS idx_reactions_user_post
  ON reactions(user_id, post_id);

-- Index for reaction counts by post
CREATE INDEX IF NOT EXISTS idx_reactions_post_type
  ON reactions(post_id, reaction_type);

-- ============================================================================
-- Follow system indexes
-- ============================================================================

-- Index for checking follow status (private accounts)
CREATE INDEX IF NOT EXISTS idx_follows_follower_following_status
  ON follows(follower_id, following_id, status);

-- Index for counting followers
CREATE INDEX IF NOT EXISTS idx_follows_following_status
  ON follows(following_id, status)
  WHERE status = 'accepted';

-- Index for counting following
CREATE INDEX IF NOT EXISTS idx_follows_follower_status
  ON follows(follower_id, status)
  WHERE status = 'accepted';

-- ============================================================================
-- Notification indexes
-- ============================================================================

-- Index for unread notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read, created_at DESC)
  WHERE read = false;

-- ============================================================================
-- Message indexes
-- ============================================================================

-- Index for unread messages count
CREATE INDEX IF NOT EXISTS idx_messages_conversation_read
  ON messages(conversation_id, is_read, sender_id)
  WHERE is_read = false;

-- ============================================================================
-- Products indexes (marketplace)
-- ============================================================================

-- Index for seller products lookup
CREATE INDEX IF NOT EXISTS idx_products_seller_status
  ON products(seller_id, status, created_at DESC);

-- Index for active products browsing
CREATE INDEX IF NOT EXISTS idx_products_status_category
  ON products(status, category, created_at DESC)
  WHERE status = 'active';

-- ============================================================================
-- Community indexes
-- ============================================================================

-- Index for community member role checks
CREATE INDEX IF NOT EXISTS idx_community_members_user_role
  ON community_members(community_id, user_id, role);

-- Index for community posts
CREATE INDEX IF NOT EXISTS idx_community_members_community_status
  ON community_members(community_id, status)
  WHERE status = 'active';
