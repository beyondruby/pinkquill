-- =============================================================================
-- Notifications + Messaging Realtime Hardening
-- Ensures notification schema parity and realtime publications for live updates.
-- =============================================================================

-- Add order reference column for order-related notifications when orders table exists.
DO $$
BEGIN
  IF to_regclass('public.orders') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'notifications'
        AND column_name = 'order_id'
    ) THEN
      ALTER TABLE public.notifications
        ADD COLUMN order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL;
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notifications_order_id ON public.notifications(order_id);

-- Keep notification type constraint aligned with client-supported types.
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
      'order_placed', 'order_paid', 'order_started', 'order_delivered',
      'order_completed', 'revision_requested', 'order_cancelled', 'review_received',
      'order_message', 'order_disputed', 'dispute_resolved',
      'refund_requested', 'order_refunded'
    )
  );

-- Ensure all realtime-dependent tables are present in supabase_realtime publication.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'notifications',
    'messages',
    'follows',
    'post_collaborators',
    'conversation_participants',
    'message_reactions',
    'community_chat_messages',
    'community_chat_thread_reads',
    'community_members',
    'order_messages'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = table_name
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
EXCEPTION
  WHEN undefined_object THEN
    -- Publication may not exist in some local/test environments.
    NULL;
END $$;
