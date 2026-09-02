-- Phase 2 (docs/audit/02-plan.md): realtime churn + DM/badge request storm.
--
-- 1. user-events triggers carry enough state for clients to apply DELTAS
--    (was_read / is_read, message preview) instead of refetching on every
--    event; read-receipt UPDATEs that do not change is_read emit nothing.
-- 2. Server-side aggregates for the conversation list and the DM unread badge
--    replace the client-side "fetch every message row and count in JS".
-- 3. supabase_realtime publication shrunk to the tables that still have a
--    live postgres_changes subscriber after the client changes in this phase.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1a. messages -> dm_unread_change
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_dm_unread_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime'
AS $function$
DECLARE
  v_conversation_id uuid;
  v_payload jsonb;
  v_participant uuid;
BEGIN
  IF (TG_OP = 'UPDATE') THEN
    -- Only read-state flips are interesting to badges/lists. Any other
    -- UPDATE (content edits, media url refresh) used to wake every
    -- participant for nothing.
    IF (OLD.is_read IS NOT DISTINCT FROM NEW.is_read) THEN
      RETURN NULL;
    END IF;
    v_conversation_id := NEW.conversation_id;
    v_payload := jsonb_build_object(
      'op', 'UPDATE',
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'message_id', NEW.id,
      'is_read', NEW.is_read,
      'was_read', OLD.is_read
    );
  ELSIF (TG_OP = 'DELETE') THEN
    v_conversation_id := OLD.conversation_id;
    v_payload := jsonb_build_object(
      'op', 'DELETE',
      'conversation_id', OLD.conversation_id,
      'sender_id', OLD.sender_id,
      'message_id', OLD.id,
      'is_read', OLD.is_read,
      'was_read', OLD.is_read
    );
  ELSE
    v_conversation_id := NEW.conversation_id;
    -- Preview fields let the conversation list update itself without a
    -- query. The channel is private and RLS-scoped to the recipient, and
    -- only participants receive it.
    v_payload := jsonb_build_object(
      'op', 'INSERT',
      'conversation_id', NEW.conversation_id,
      'sender_id', NEW.sender_id,
      'message_id', NEW.id,
      'is_read', NEW.is_read,
      'created_at', NEW.created_at,
      'content', left(COALESCE(NEW.content, ''), 200),
      'message_type', NEW.message_type,
      'voice_duration', NEW.voice_duration,
      'media_type', NEW.media_type
    );
  END IF;

  -- All participants, sender included: the sender's own conversation list
  -- needs the preview/receipt, and the reader's other tabs need the delta.
  -- Clients ignore what does not apply to them (sender_id = self).
  FOR v_participant IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = v_conversation_id
  LOOP
    PERFORM realtime.send(v_payload, 'dm_unread_change', 'user-events:' || v_participant::text, true);
  END LOOP;

  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 1b. notifications -> notification_change (skip no-op updates, carry was_read)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_notification_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime'
AS $function$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_user_id := OLD.user_id;
    v_payload := jsonb_build_object('op', 'DELETE', 'id', OLD.id, 'type', OLD.type, 'was_read', OLD.read);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.read IS NOT DISTINCT FROM NEW.read) THEN
      RETURN NULL;
    END IF;
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('op', 'UPDATE', 'id', NEW.id, 'type', NEW.type, 'read', NEW.read, 'was_read', OLD.read);
  ELSE
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('op', 'INSERT', 'id', NEW.id, 'type', NEW.type, 'read', NEW.read);
  END IF;

  PERFORM realtime.send(v_payload, 'notification_change', 'user-events:' || v_user_id::text, true);

  RETURN NULL;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 2a. Conversation list aggregate (replaces MessagesView's 7-query scan)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dm_conversation_overview()
RETURNS TABLE (
  conversation_id uuid,
  updated_at timestamptz,
  participant_id uuid,
  participant_username text,
  participant_display_name text,
  participant_avatar_url text,
  is_blocked boolean,
  last_message_content text,
  last_message_created_at timestamptz,
  last_message_sender_id uuid,
  last_message_type text,
  last_message_voice_duration integer,
  last_message_media_type text,
  unread_count integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS id
  ),
  mine AS (
    SELECT cp.conversation_id
    FROM conversation_participants cp, me
    WHERE cp.user_id = me.id
  ),
  blocked AS (
    SELECT b.blocked_id AS uid FROM blocks b, me WHERE b.blocker_id = me.id
    UNION
    SELECT b.blocker_id AS uid FROM blocks b, me WHERE b.blocked_id = me.id
  ),
  other AS (
    SELECT DISTINCT ON (cp.conversation_id)
      cp.conversation_id, p.id, p.username, p.display_name, p.avatar_url
    FROM conversation_participants cp
    JOIN profiles p ON p.id = cp.user_id, me
    WHERE cp.conversation_id IN (SELECT conversation_id FROM mine)
      AND cp.user_id <> me.id
    ORDER BY cp.conversation_id, cp.joined_at
  ),
  conv AS (
    SELECT o.conversation_id, o.id AS participant_id, o.username, o.display_name, o.avatar_url,
      EXISTS (SELECT 1 FROM blocked b WHERE b.uid = o.id) AS is_blocked
    FROM other o
  ),
  last_msg AS (
    SELECT DISTINCT ON (m.conversation_id)
      m.conversation_id, m.content, m.created_at, m.sender_id, m.message_type, m.voice_duration, m.media_type
    FROM messages m
    JOIN conv c ON c.conversation_id = m.conversation_id, me
    WHERE (NOT c.is_blocked) OR m.sender_id = me.id
    ORDER BY m.conversation_id, m.created_at DESC
  ),
  unread AS (
    SELECT m.conversation_id, count(*)::integer AS n
    FROM messages m
    JOIN conv c ON c.conversation_id = m.conversation_id, me
    WHERE m.is_read = false
      AND m.sender_id <> me.id
      AND NOT c.is_blocked
    GROUP BY m.conversation_id
  )
  SELECT
    c.conversation_id,
    cv.updated_at,
    c.participant_id,
    c.username,
    c.display_name,
    c.avatar_url,
    c.is_blocked,
    lm.content,
    lm.created_at,
    lm.sender_id,
    lm.message_type,
    lm.voice_duration,
    lm.media_type,
    COALESCE(u.n, 0)
  FROM conv c
  JOIN conversations cv ON cv.id = c.conversation_id
  LEFT JOIN last_msg lm ON lm.conversation_id = c.conversation_id
  LEFT JOIN unread u ON u.conversation_id = c.conversation_id
  ORDER BY cv.updated_at DESC NULLS LAST;
$$;

REVOKE ALL ON FUNCTION public.get_dm_conversation_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dm_conversation_overview() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2b. DM unread badge aggregate (replaces blocks x2 -> participants -> HEAD messages)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_dm_unread_summary()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT auth.uid() AS id
  ),
  mine AS (
    SELECT cp.conversation_id
    FROM conversation_participants cp, me
    WHERE cp.user_id = me.id
  ),
  blocked AS (
    SELECT b.blocked_id AS uid FROM blocks b, me WHERE b.blocker_id = me.id
    UNION
    SELECT b.blocker_id AS uid FROM blocks b, me WHERE b.blocked_id = me.id
  )
  SELECT jsonb_build_object(
    'unread_count', (
      SELECT count(*)
      FROM messages m, me
      WHERE m.conversation_id IN (SELECT conversation_id FROM mine)
        AND m.is_read = false
        AND m.sender_id <> me.id
        AND m.sender_id NOT IN (SELECT uid FROM blocked)
    ),
    'conversation_ids', COALESCE((SELECT jsonb_agg(conversation_id) FROM mine), '[]'::jsonb),
    'blocked_user_ids', COALESCE((SELECT jsonb_agg(uid) FROM blocked), '[]'::jsonb)
  );
$$;

REVOKE ALL ON FUNCTION public.get_dm_unread_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dm_unread_summary() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. Publication: only tables with a live postgres_changes subscriber remain.
--    Removed: follows, notifications, conversation_participants (all served by
--    user-events broadcast), community_members/join_requests/invitations,
--    reactions, take_*, post_collaborators, collections*, message_reactions,
--    community_chat_thread_reads, disputes (no subscriber after this phase).
--    Kept: messages (ChatView), community_chat_threads, community_chat_messages,
--    orders, order_messages (scoped per-thread / per-order channels; Phase 2
--    deferred list in the plan).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'follows', 'notifications', 'conversation_participants', 'community_members',
    'community_join_requests', 'community_invitations', 'reactions', 'take_admires',
    'take_comments', 'take_comment_likes', 'post_collaborators', 'collections',
    'collection_items', 'collection_item_posts', 'message_reactions',
    'community_chat_thread_reads', 'disputes'
  ]
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;
