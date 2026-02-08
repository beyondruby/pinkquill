-- ============================================================================
-- Community Chat Broadcast Metadata
-- - Adds a shared broadcast_id to each fan-out announcement row
-- - Enables reliable deduping for the "General" staff thread view
-- ============================================================================

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
        'broadcast', true,
        'broadcast_id', v_broadcast_id
      )
    );

    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$$;
