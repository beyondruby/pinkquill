-- =============================================================================
-- Add `collaboration_removed` notification type
-- Sent when an accepted collaborator removes themselves from a post.
-- Distinct from `collaboration_declined` (declining the initial invite).
-- =============================================================================

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'admire', 'snap', 'ovation', 'support', 'inspired', 'applaud',
      'comment', 'reply', 'comment_like', 'relay', 'save', 'mention',
      'follow', 'follow_request', 'follow_request_accepted',
      'community_invite', 'community_join_request', 'community_join_approved',
      'community_role_change', 'community_muted', 'community_banned',
      'collaboration_invite', 'collaboration_accepted', 'collaboration_declined',
      'collaboration_removed',
      'order_placed', 'order_paid', 'order_started', 'order_delivered',
      'order_completed', 'revision_requested', 'order_cancelled', 'review_received',
      'order_message', 'order_disputed', 'dispute_resolved',
      'refund_requested', 'order_refunded'
    )
  );
