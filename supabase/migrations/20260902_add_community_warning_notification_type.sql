-- Adds 'community_warning' to the notifications type CHECK constraint so the
-- mod-queue "Send Warning" resolution can actually notify the reported user
-- instead of being a silent no-op. Additive only — no existing values removed.
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'admire', 'snap', 'ovation', 'support', 'inspired', 'applaud',
    'comment', 'reply', 'comment_like', 'relay', 'save', 'mention',
    'follow', 'follow_request', 'follow_request_accepted',
    'community_invite', 'community_join_request', 'community_join_approved',
    'community_role_change', 'community_muted', 'community_banned', 'community_warning',
    'collaboration_invite', 'collaboration_accepted', 'collaboration_declined', 'collaboration_removed',
    'order_placed', 'order_paid', 'order_started', 'order_delivered', 'order_completed',
    'revision_requested', 'order_cancelled', 'review_received', 'order_message',
    'order_disputed', 'dispute_resolved', 'refund_requested', 'order_refunded',
    'order_pending_acceptance', 'order_accepted', 'order_declined'
  ]::text[]));
