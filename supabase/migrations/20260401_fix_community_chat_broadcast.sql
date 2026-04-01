-- ============================================================================
-- Fix community chat broadcast — two bugs
--
-- Bug 1: check_community_permission whitelist missing 'can_send_community_chat_messages'
-- The permission validation whitelist was defined before community chat existed.
-- It rejected 'can_send_community_chat_messages' before reaching the admin bypass,
-- so ALL users (including admins) got "You do not have permission" on every broadcast.
--
-- Bug 2: set_community_chat_sender_role trigger blocked member broadcasts
-- When a member posts to community-wide chat, community_chat_broadcast fans out
-- to all joined members' threads. The trigger checked thread ownership
-- (sender_id = member_id) which fails for other members' threads, then checked
-- staff role which fails for regular members → RAISE EXCEPTION.
-- Fix: check metadata.broadcast flag and allow if the sender is a community member.
-- ============================================================================

-- Fix 1: Add 'can_send_community_chat_messages' to the permission whitelist
CREATE OR REPLACE FUNCTION check_community_permission(
  p_community_id UUID,
  p_user_id UUID,
  p_permission TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  v_role TEXT;
  v_permissions JSONB;
  v_valid_permissions TEXT[] := ARRAY[
    'can_mute', 'can_ban', 'can_delete_posts',
    'can_delete_comments', 'can_pin_posts', 'can_manage_rules',
    'can_send_community_chat_messages'
  ];
BEGIN
  IF NOT (p_permission = ANY(v_valid_permissions)) THEN
    RETURN FALSE;
  END IF;

  SELECT role, permissions
  INTO v_role, v_permissions
  FROM community_members
  WHERE community_id = p_community_id
    AND user_id = p_user_id
    AND status = 'active';

  IF v_role IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'admin' THEN
    RETURN TRUE;
  END IF;

  IF v_role = 'member' THEN
    RETURN FALSE;
  END IF;

  IF v_role = 'moderator' THEN
    IF v_permissions IS NULL THEN
      RETURN FALSE;
    END IF;
    RETURN COALESCE((v_permissions->>p_permission)::BOOLEAN, FALSE);
  END IF;

  RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Fix 2: Allow broadcast messages in the sender role trigger
CREATE OR REPLACE FUNCTION set_community_chat_sender_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_auth_user UUID;
  v_community_id UUID;
  v_member_id UUID;
  v_role TEXT;
  v_status TEXT;
BEGIN
  IF NEW.sender_id IS NULL THEN
    NEW.sender_role := 'system';
    RETURN NEW;
  END IF;

  v_auth_user := auth.uid();
  IF v_auth_user IS NOT NULL AND NEW.sender_id <> v_auth_user THEN
    RAISE EXCEPTION 'sender_id must match authenticated user';
  END IF;

  SELECT community_id, member_id
  INTO v_community_id, v_member_id
  FROM community_chat_threads
  WHERE id = NEW.thread_id;

  IF v_community_id IS NULL THEN
    RAISE EXCEPTION 'Invalid community chat thread';
  END IF;

  IF NEW.sender_id = v_member_id THEN
    NEW.sender_role := 'member';
    RETURN NEW;
  END IF;

  IF COALESCE((NEW.metadata ->> 'broadcast')::boolean, FALSE) = TRUE THEN
    SELECT role INTO v_role
    FROM community_members
    WHERE community_id = v_community_id
      AND user_id = NEW.sender_id
      AND status IN ('active', 'muted', 'banned');

    IF v_role IS NOT NULL THEN
      NEW.sender_role := v_role;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Broadcast sender is not a community member';
  END IF;

  SELECT role, status
  INTO v_role, v_status
  FROM community_members
  WHERE community_id = v_community_id
    AND user_id = NEW.sender_id;

  IF v_role IN ('admin', 'moderator') AND v_status = 'active' THEN
    NEW.sender_role := v_role;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Sender is not allowed in this thread';
END;
$$;
