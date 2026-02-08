-- RPC functions for atomic moderator deletion of posts and comments.
-- Uses SECURITY DEFINER to bypass RLS (permission checked inside the function).
-- Wraps audit log + delete in a single transaction to prevent orphan records.
-- Captures a content snapshot before deletion for the mod log.

-- Add content_snapshot column to audit table (stores deleted content for review)
ALTER TABLE community_content_deletions
ADD COLUMN IF NOT EXISTS content_snapshot JSONB DEFAULT NULL;

COMMENT ON COLUMN community_content_deletions.content_snapshot IS 'Snapshot of deleted content: {title, content, type} for posts, {content} for comments';

-- =============================================================================
-- moderate_delete_post: Atomically delete a community post with audit logging
-- =============================================================================
CREATE OR REPLACE FUNCTION moderate_delete_post(
  p_community_id UUID,
  p_post_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_author_id UUID;
  v_snapshot JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check permission using existing helper
  IF NOT check_community_permission(p_community_id, v_user_id, 'can_delete_posts') THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to delete posts');
  END IF;

  -- Get post info and snapshot content before deletion
  SELECT author_id,
         jsonb_build_object(
           'title', title,
           'content', content,
           'type', type
         )
  INTO v_author_id, v_snapshot
  FROM posts
  WHERE id = p_post_id AND community_id = p_community_id;

  IF v_author_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found in this community');
  END IF;

  -- Delete the post (ON DELETE CASCADE on post_media, admires, comments, etc. handles related data)
  DELETE FROM posts WHERE id = p_post_id AND community_id = p_community_id;

  -- Log the deletion with content snapshot
  INSERT INTO community_content_deletions
    (community_id, content_type, content_id, content_author_id, deleted_by, reason, content_snapshot)
  VALUES
    (p_community_id, 'post', p_post_id, v_author_id, v_user_id, p_reason, v_snapshot);

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- moderate_delete_comment: Atomically delete a community comment with audit logging
-- =============================================================================
CREATE OR REPLACE FUNCTION moderate_delete_comment(
  p_community_id UUID,
  p_comment_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_comment_author_id UUID;
  v_comment_post_id UUID;
  v_snapshot JSONB;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check permission using existing helper
  IF NOT check_community_permission(p_community_id, v_user_id, 'can_delete_comments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to delete comments');
  END IF;

  -- Get comment info and snapshot content before deletion
  SELECT user_id, post_id,
         jsonb_build_object('content', content)
  INTO v_comment_author_id, v_comment_post_id, v_snapshot
  FROM comments
  WHERE id = p_comment_id;

  IF v_comment_author_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comment not found');
  END IF;

  -- Verify the comment's post belongs to this community
  IF NOT EXISTS (
    SELECT 1 FROM posts WHERE id = v_comment_post_id AND community_id = p_community_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comment does not belong to this community');
  END IF;

  -- Delete likes on replies to this comment
  DELETE FROM comment_likes
  WHERE comment_id IN (SELECT id FROM comments WHERE parent_id = p_comment_id);

  -- Delete replies to this comment
  DELETE FROM comments WHERE parent_id = p_comment_id;

  -- Delete likes on the comment itself
  DELETE FROM comment_likes WHERE comment_id = p_comment_id;

  -- Delete the comment
  DELETE FROM comments WHERE id = p_comment_id;

  -- Log the deletion with content snapshot
  INSERT INTO community_content_deletions
    (community_id, content_type, content_id, content_author_id, deleted_by, reason, content_snapshot)
  VALUES
    (p_community_id, 'comment', p_comment_id, v_comment_author_id, v_user_id, p_reason, v_snapshot);

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
