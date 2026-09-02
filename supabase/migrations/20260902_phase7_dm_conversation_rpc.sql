-- Phase 7 (docs/audit/02-plan.md): one atomic "find or create a DM
-- conversation" instead of four client implementations, none of which was
-- atomic (concurrent creation produced duplicate conversations; one of them
-- looped over every conversation with a query each) — findings C4/L9.
--
-- Idempotent.

CREATE OR REPLACE FUNCTION public.get_or_create_dm_conversation(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conversation_id uuid;
BEGIN
  IF v_me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_other_user_id IS NULL OR p_other_user_id = v_me THEN
    RAISE EXCEPTION 'Invalid recipient';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'Recipient not found';
  END IF;
  IF EXISTS (
    SELECT 1 FROM blocks
    WHERE (blocker_id = v_me AND blocked_id = p_other_user_id)
       OR (blocker_id = p_other_user_id AND blocked_id = v_me)
  ) THEN
    RAISE EXCEPTION 'Cannot message this user';
  END IF;

  -- Serialise concurrent creation for the same pair.
  PERFORM pg_advisory_xact_lock(hashtext(least(v_me::text, p_other_user_id::text) || ':' || greatest(v_me::text, p_other_user_id::text)));

  SELECT a.conversation_id INTO v_conversation_id
  FROM conversation_participants a
  JOIN conversation_participants b ON b.conversation_id = a.conversation_id
  WHERE a.user_id = v_me AND b.user_id = p_other_user_id
  ORDER BY a.joined_at NULLS LAST
  LIMIT 1;

  IF v_conversation_id IS NOT NULL THEN
    RETURN v_conversation_id;
  END IF;

  INSERT INTO conversations (created_by) VALUES (v_me) RETURNING id INTO v_conversation_id;
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (v_conversation_id, v_me), (v_conversation_id, p_other_user_id);

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_dm_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_conversation(uuid) TO authenticated, service_role;
