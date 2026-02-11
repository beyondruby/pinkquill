-- ============================================================================
-- Community Chat Joinable Thread Controls
-- - Adds member join-state for community chat participation
-- - Extends broadcast RPC to support community-wide member messages
-- - Updates direct message policy so modmail and community thread stay distinct
-- ============================================================================

ALTER TABLE community_members
ADD COLUMN IF NOT EXISTS community_chat_joined BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN community_members.community_chat_joined IS
'Whether the member has joined the community-wide chat thread.';

-- Preserve existing behavior for current members while keeping new joins opt-in by default.
UPDATE community_members
SET community_chat_joined = TRUE
WHERE role = 'member'
  AND status IN ('active', 'muted', 'banned')
  AND community_chat_joined IS DISTINCT FROM TRUE;

CREATE INDEX IF NOT EXISTS idx_community_members_chat_joined
ON community_members(community_id, role, status, community_chat_joined);

CREATE OR REPLACE FUNCTION set_community_chat_join_state(
  p_community_id UUID,
  p_joined BOOLEAN DEFAULT TRUE
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_status TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_joined AND NOT EXISTS (
    SELECT 1
    FROM communities
    WHERE id = p_community_id
      AND community_chat_enabled = TRUE
  ) THEN
    RAISE EXCEPTION 'Community chat is disabled';
  END IF;

  SELECT status
  INTO v_status
  FROM community_members
  WHERE community_id = p_community_id
    AND user_id = v_user_id
    AND role = 'member'
    AND status IN ('active', 'muted', 'banned');

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Only community members can update chat participation';
  END IF;

  UPDATE community_members
  SET community_chat_joined = p_joined
  WHERE community_id = p_community_id
    AND user_id = v_user_id
    AND role = 'member';

  RETURN p_joined;
END;
$$;

CREATE OR REPLACE FUNCTION community_chat_broadcast(
  p_community_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'announcement'
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_id UUID;
  v_sender_role TEXT;
  v_sender_status TEXT;
  v_sender_joined BOOLEAN;
  v_member RECORD;
  v_thread_id UUID;
  v_sent_count INTEGER := 0;
  v_broadcast_id UUID := gen_random_uuid();
  v_chat_enabled BOOLEAN;
  v_allow_member_messages BOOLEAN;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT cm.role, cm.status, cm.community_chat_joined
  INTO v_sender_role, v_sender_status, v_sender_joined
  FROM community_members cm
  WHERE cm.community_id = p_community_id
    AND cm.user_id = v_sender_id;

  IF v_sender_role IS NULL THEN
    RAISE EXCEPTION 'Not a community member';
  END IF;

  SELECT community_chat_enabled, community_chat_allow_member_messages
  INTO v_chat_enabled, v_allow_member_messages
  FROM communities
  WHERE id = p_community_id;

  IF v_chat_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Community chat is disabled';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  IF p_message_type = 'announcement' THEN
    IF v_sender_role NOT IN ('admin', 'moderator') OR v_sender_status <> 'active' THEN
      RAISE EXCEPTION 'Only active admins and moderators can post announcements';
    END IF;

    IF NOT check_community_permission(p_community_id, v_sender_id, 'can_send_community_chat_messages') THEN
      RAISE EXCEPTION 'You do not have permission to send community chat announcements';
    END IF;
  ELSIF p_message_type = 'message' THEN
    IF v_sender_role IN ('admin', 'moderator') THEN
      IF v_sender_status <> 'active' THEN
        RAISE EXCEPTION 'Only active staff can post in community chat';
      END IF;

      IF NOT check_community_permission(p_community_id, v_sender_id, 'can_send_community_chat_messages') THEN
        RAISE EXCEPTION 'You do not have permission to send community chat messages';
      END IF;
    ELSIF v_sender_role = 'member' THEN
      IF v_sender_status <> 'active' THEN
        RAISE EXCEPTION 'Only active members can post in community chat';
      END IF;

      IF v_sender_joined IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Join community chat before posting';
      END IF;

      IF v_allow_member_messages IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'Member community chat messages are disabled';
      END IF;
    ELSE
      RAISE EXCEPTION 'Unsupported sender role';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unsupported broadcast message type';
  END IF;

  FOR v_member IN
    SELECT user_id
    FROM community_members
    WHERE community_id = p_community_id
      AND role = 'member'
      AND status IN ('active', 'muted', 'banned')
      AND community_chat_joined = TRUE
  LOOP
    v_thread_id := ensure_community_chat_thread(p_community_id, v_member.user_id);

    INSERT INTO community_chat_messages (
      thread_id,
      sender_id,
      message_type,
      content,
      metadata
    )
    VALUES (
      v_thread_id,
      v_sender_id,
      p_message_type,
      btrim(p_content),
      jsonb_build_object(
        'community_id', p_community_id,
        'broadcast', TRUE,
        'broadcast_id', v_broadcast_id,
        'channel', 'community'
      )
    );

    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$$;

DROP POLICY IF EXISTS "Users can send community chat messages" ON community_chat_messages;
CREATE POLICY "Users can send community chat messages" ON community_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
    AND (
      (
        message_type = 'message'
        AND COALESCE((community_chat_messages.metadata ->> 'broadcast')::boolean, FALSE) = FALSE
        AND EXISTS (
          SELECT 1
          FROM community_chat_threads t
          JOIN community_members cm ON cm.community_id = t.community_id
          JOIN communities c ON c.id = t.community_id
          WHERE t.id = community_chat_messages.thread_id
            AND cm.user_id = auth.uid()
            AND c.community_chat_enabled = TRUE
            AND (
              (
                cm.role IN ('admin', 'moderator')
                AND cm.status = 'active'
              )
              OR (
                cm.role = 'member'
                AND cm.user_id = t.member_id
                AND cm.status IN ('active', 'muted', 'banned')
                AND c.community_chat_allow_modmail = TRUE
              )
            )
        )
      )
      OR (
        message_type = 'appeal'
        AND EXISTS (
          SELECT 1
          FROM community_chat_threads t
          JOIN community_members cm ON cm.community_id = t.community_id
          JOIN communities c ON c.id = t.community_id
          WHERE t.id = community_chat_messages.thread_id
            AND cm.user_id = auth.uid()
            AND cm.user_id = t.member_id
            AND cm.role = 'member'
            AND cm.status IN ('muted', 'banned')
            AND c.community_chat_enabled = TRUE
            AND c.community_chat_allow_modmail = TRUE
        )
      )
      OR (
        message_type = 'announcement'
        AND EXISTS (
          SELECT 1
          FROM community_chat_threads t
          JOIN communities c ON c.id = t.community_id
          WHERE t.id = community_chat_messages.thread_id
            AND c.community_chat_enabled = TRUE
            AND check_community_permission(
              t.community_id,
              auth.uid(),
              'can_send_community_chat_messages'
            )
        )
      )
    )
  );

GRANT EXECUTE ON FUNCTION set_community_chat_join_state TO authenticated;
GRANT EXECUTE ON FUNCTION community_chat_broadcast TO authenticated;
