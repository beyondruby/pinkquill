-- ============================================================================
-- Community Chat Controls + Moderator Broadcast Permission
-- - Adds admin-configurable chat toggles to communities
-- - Adds moderator permission key: can_send_community_chat_messages
-- - Enforces settings in chat functions and RLS policies
-- ============================================================================

-- ============================================================================
-- COMMUNITY SETTINGS
-- ============================================================================

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS community_chat_enabled BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS community_chat_allow_member_messages BOOLEAN NOT NULL DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS community_chat_allow_modmail BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN communities.community_chat_enabled IS
'Master toggle for community chat availability.';
COMMENT ON COLUMN communities.community_chat_allow_member_messages IS
'Whether members can send regular messages in community chat threads.';
COMMENT ON COLUMN communities.community_chat_allow_modmail IS
'Whether members can message moderators (including appeals) in community chat.';

-- ============================================================================
-- MODERATOR PERMISSION BACKFILL
-- ============================================================================

COMMENT ON COLUMN community_members.permissions IS
'Moderator permissions: { can_mute, can_ban, can_delete_posts, can_delete_comments, can_pin_posts, can_manage_rules, can_send_community_chat_messages }';

UPDATE community_members
SET permissions = COALESCE(permissions, '{}'::jsonb) || jsonb_build_object('can_send_community_chat_messages', TRUE)
WHERE role = 'moderator'
  AND COALESCE((permissions ? 'can_send_community_chat_messages'), FALSE) = FALSE;

-- ============================================================================
-- FUNCTION UPDATES
-- ============================================================================

CREATE OR REPLACE FUNCTION can_access_community_chat_thread(
  p_thread_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_community_id UUID;
  v_member_id UUID;
  v_chat_enabled BOOLEAN;
BEGIN
  SELECT t.community_id, t.member_id, c.community_chat_enabled
  INTO v_community_id, v_member_id, v_chat_enabled
  FROM community_chat_threads t
  JOIN communities c ON c.id = t.community_id
  WHERE t.id = p_thread_id;

  IF v_community_id IS NULL OR v_chat_enabled IS NOT TRUE THEN
    RETURN FALSE;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM community_members
    WHERE community_id = v_community_id
      AND user_id = p_user_id
      AND (
        (
          role = 'member'
          AND user_id = v_member_id
          AND status IN ('active', 'muted', 'banned')
        )
        OR (
          role IN ('admin', 'moderator')
          AND status = 'active'
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION ensure_community_chat_thread(
  p_community_id UUID,
  p_member_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_chat_enabled BOOLEAN;
BEGIN
  SELECT community_chat_enabled
  INTO v_chat_enabled
  FROM communities
  WHERE id = p_community_id;

  IF v_chat_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Community chat is disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM community_members
    WHERE community_id = p_community_id
      AND user_id = p_member_id
      AND role = 'member'
      AND status IN ('active', 'muted', 'banned')
  ) THEN
    RAISE EXCEPTION 'No eligible member record found for community chat thread';
  END IF;

  INSERT INTO community_chat_threads (community_id, member_id)
  VALUES (p_community_id, p_member_id)
  ON CONFLICT (community_id, member_id) DO NOTHING;

  SELECT id
  INTO v_thread_id
  FROM community_chat_threads
  WHERE community_id = p_community_id
    AND member_id = p_member_id;

  RETURN v_thread_id;
END;
$$;

CREATE OR REPLACE FUNCTION handle_community_member_chat_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_thread_id UUID;
  v_welcome_message TEXT;
  v_status_message TEXT;
BEGIN
  -- Chat threads are only for regular members.
  IF NEW.role <> 'member' THEN
    RETURN NEW;
  END IF;

  -- Keep threads for active/muted/banned members only.
  IF NEW.status NOT IN ('active', 'muted', 'banned') THEN
    RETURN NEW;
  END IF;

  -- Respect community-level chat toggle.
  IF NOT EXISTS (
    SELECT 1
    FROM communities
    WHERE id = NEW.community_id
      AND community_chat_enabled = TRUE
  ) THEN
    RETURN NEW;
  END IF;

  v_thread_id := ensure_community_chat_thread(NEW.community_id, NEW.user_id);

  -- Welcome message on initial active membership.
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    SELECT welcome_message
    INTO v_welcome_message
    FROM communities
    WHERE id = NEW.community_id;

    IF v_welcome_message IS NOT NULL AND btrim(v_welcome_message) <> '' THEN
      IF NOT EXISTS (
        SELECT 1
        FROM community_chat_messages
        WHERE thread_id = v_thread_id
          AND message_type = 'welcome'
      ) THEN
        INSERT INTO community_chat_messages (
          thread_id,
          sender_id,
          sender_role,
          message_type,
          content,
          metadata
        )
        VALUES (
          v_thread_id,
          NULL,
          'system',
          'welcome',
          btrim(v_welcome_message),
          jsonb_build_object('community_id', NEW.community_id)
        );
      END IF;
    END IF;
  END IF;

  -- Status changes (mute/ban/unmute/unban) are sent into the chat thread.
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    v_status_message := NULL;

    IF NEW.status = 'muted' THEN
      v_status_message := 'You have been muted in this community.';
      IF NEW.muted_until IS NOT NULL THEN
        v_status_message := v_status_message || ' Muted until ' ||
          to_char(NEW.muted_until AT TIME ZONE 'UTC', 'Mon DD, YYYY HH24:MI "UTC"') || '.';
      END IF;
      IF NEW.mute_reason IS NOT NULL AND btrim(NEW.mute_reason) <> '' THEN
        v_status_message := v_status_message || ' Reason: ' || btrim(NEW.mute_reason) || '.';
      END IF;
    ELSIF NEW.status = 'banned' THEN
      v_status_message := 'You have been banned from this community.';
      IF NEW.banned_until IS NOT NULL THEN
        v_status_message := v_status_message || ' Ban expires on ' ||
          to_char(NEW.banned_until AT TIME ZONE 'UTC', 'Mon DD, YYYY HH24:MI "UTC"') || '.';
      ELSE
        v_status_message := v_status_message || ' This ban is currently indefinite.';
      END IF;
      IF NEW.ban_reason IS NOT NULL AND btrim(NEW.ban_reason) <> '' THEN
        v_status_message := v_status_message || ' Reason: ' || btrim(NEW.ban_reason) || '.';
      END IF;
    ELSIF NEW.status = 'active' THEN
      IF OLD.status = 'muted' THEN
        v_status_message := 'Your mute has been removed. You can post and comment again.';
      ELSIF OLD.status = 'banned' THEN
        v_status_message := 'Your ban has been lifted. You may participate in the community again.';
      END IF;
    END IF;

    IF v_status_message IS NOT NULL THEN
      INSERT INTO community_chat_messages (
        thread_id,
        sender_id,
        sender_role,
        message_type,
        content,
        metadata
      )
      VALUES (
        v_thread_id,
        NULL,
        'system',
        'status_update',
        v_status_message,
        jsonb_build_object(
          'community_id', NEW.community_id,
          'from_status', OLD.status,
          'to_status', NEW.status,
          'muted_until', NEW.muted_until,
          'banned_until', NEW.banned_until
        )
      );
    END IF;
  END IF;

  RETURN NEW;
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
  v_member RECORD;
  v_thread_id UUID;
  v_sent_count INTEGER := 0;
  v_broadcast_id UUID := gen_random_uuid();
  v_chat_enabled BOOLEAN;
BEGIN
  v_sender_id := auth.uid();
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role
  INTO v_sender_role
  FROM community_members
  WHERE community_id = p_community_id
    AND user_id = v_sender_id
    AND status = 'active';

  IF v_sender_role NOT IN ('admin', 'moderator') THEN
    RAISE EXCEPTION 'Only admins and moderators can broadcast';
  END IF;

  SELECT community_chat_enabled
  INTO v_chat_enabled
  FROM communities
  WHERE id = p_community_id;

  IF v_chat_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Community chat is disabled';
  END IF;

  IF NOT check_community_permission(p_community_id, v_sender_id, 'can_send_community_chat_messages') THEN
    RAISE EXCEPTION 'You do not have permission to send community chat broadcasts';
  END IF;

  IF p_content IS NULL OR btrim(p_content) = '' THEN
    RAISE EXCEPTION 'Message content cannot be empty';
  END IF;

  IF p_message_type <> 'announcement' THEN
    RAISE EXCEPTION 'Unsupported broadcast message type';
  END IF;

  FOR v_member IN
    SELECT user_id
    FROM community_members
    WHERE community_id = p_community_id
      AND role = 'member'
      AND status IN ('active', 'muted', 'banned')
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
      'announcement',
      btrim(p_content),
      jsonb_build_object(
        'community_id', p_community_id,
        'broadcast', TRUE,
        'broadcast_id', v_broadcast_id
      )
    );

    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$$;

-- ============================================================================
-- RLS POLICY UPDATES
-- ============================================================================

DROP POLICY IF EXISTS "Users can view accessible community chat threads" ON community_chat_threads;
CREATE POLICY "Users can view accessible community chat threads" ON community_chat_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM community_members cm
      JOIN communities c ON c.id = community_chat_threads.community_id
      WHERE cm.community_id = community_chat_threads.community_id
        AND cm.user_id = auth.uid()
        AND c.community_chat_enabled = TRUE
        AND (
          (
            cm.role = 'member'
            AND cm.user_id = community_chat_threads.member_id
            AND cm.status IN ('active', 'muted', 'banned')
          )
          OR (
            cm.role IN ('admin', 'moderator')
            AND cm.status = 'active'
          )
        )
    )
  );

DROP POLICY IF EXISTS "Users can create own or staff community chat threads" ON community_chat_threads;
CREATE POLICY "Users can create own or staff community chat threads" ON community_chat_threads
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1
      FROM communities c
      WHERE c.id = community_chat_threads.community_id
        AND c.community_chat_enabled = TRUE
    )
    AND (
      (
        member_id = auth.uid()
        AND EXISTS (
          SELECT 1
          FROM community_members cm
          WHERE cm.community_id = community_chat_threads.community_id
            AND cm.user_id = auth.uid()
            AND cm.role = 'member'
            AND cm.status IN ('active', 'muted', 'banned')
        )
      )
      OR is_community_staff(community_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "Staff can update community chat threads" ON community_chat_threads;
CREATE POLICY "Staff can update community chat threads" ON community_chat_threads
  FOR UPDATE
  USING (
    is_community_staff(community_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM communities c
      WHERE c.id = community_chat_threads.community_id
        AND c.community_chat_enabled = TRUE
    )
  )
  WITH CHECK (
    is_community_staff(community_id, auth.uid())
    AND EXISTS (
      SELECT 1
      FROM communities c
      WHERE c.id = community_chat_threads.community_id
        AND c.community_chat_enabled = TRUE
    )
  );

DROP POLICY IF EXISTS "Users can send community chat messages" ON community_chat_messages;
CREATE POLICY "Users can send community chat messages" ON community_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
    AND (
      (
        message_type = 'message'
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
                AND c.community_chat_allow_member_messages = TRUE
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

GRANT EXECUTE ON FUNCTION can_access_community_chat_thread TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_community_chat_thread TO authenticated;
GRANT EXECUTE ON FUNCTION community_chat_broadcast TO authenticated;
