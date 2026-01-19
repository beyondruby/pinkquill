-- Migration: Add comment_id to notifications for scroll-to-comment functionality
-- This allows reply and comment_like notifications to link directly to the specific comment

-- Add comment_id column to notifications table
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES comments(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_comment_id ON notifications(comment_id);

-- Update notification type constraint to include all types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    -- Reaction types
    'admire', 'snap', 'ovation', 'support', 'inspired', 'applaud',
    -- Post interactions
    'comment', 'reply', 'comment_like', 'relay', 'save', 'mention',
    -- Follow system
    'follow', 'follow_request', 'follow_request_accepted',
    -- Collaborations
    'collaboration_invite', 'collaboration_accepted', 'collaboration_declined',
    -- Communities
    'community_invite', 'community_join_request', 'community_join_approved',
    'community_role_change', 'community_muted', 'community_banned'
  ));
