-- ============================================================================
-- Fix community chat broadcast for regular members
--
-- The set_community_chat_sender_role trigger rejected broadcast messages from
-- regular members because it checked thread ownership (sender_id = member_id)
-- which fails when fanning out to other members' threads. The SECURITY DEFINER
-- RPC community_chat_broadcast already validates permissions, so the trigger
-- just needs to allow broadcast messages and set the correct sender_role.
-- ============================================================================

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
  -- System messages (no sender)
  IF NEW.sender_id IS NULL THEN
    NEW.sender_role := 'system';
    RETURN NEW;
  END IF;

  -- Verify sender matches authenticated user
  v_auth_user := auth.uid();
  IF v_auth_user IS NOT NULL AND NEW.sender_id <> v_auth_user THEN
    RAISE EXCEPTION 'sender_id must match authenticated user';
  END IF;

  -- Look up thread context
  SELECT community_id, member_id
  INTO v_community_id, v_member_id
  FROM community_chat_threads
  WHERE id = NEW.thread_id;

  IF v_community_id IS NULL THEN
    RAISE EXCEPTION 'Invalid community chat thread';
  END IF;

  -- Thread owner can always send in their own thread
  IF NEW.sender_id = v_member_id THEN
    NEW.sender_role := 'member';
    RETURN NEW;
  END IF;

  -- Broadcast messages: the SECURITY DEFINER RPC (community_chat_broadcast)
  -- already validated all permissions before inserting. The trigger just needs
  -- to resolve the sender's actual community role for the sender_role column.
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

  -- Staff (admin/moderator) can send to any thread (modmail replies)
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
