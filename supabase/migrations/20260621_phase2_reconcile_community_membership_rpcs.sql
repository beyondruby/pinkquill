-- P2 reconciliation: these community-membership RPCs existed only in the live DB
-- with NO source migration (applied out-of-band). Captured here verbatim so the
-- repo can rebuild prod. Idempotent (CREATE OR REPLACE) — safe to re-apply.

CREATE OR REPLACE FUNCTION public.accept_community_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_inv record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_inv FROM community_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  END IF;

  IF v_inv.invitee_id <> v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_invitee');
  END IF;

  IF v_inv.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_responded');
  END IF;

  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (v_inv.community_id, v_caller, 'member', 'active')
  ON CONFLICT (community_id, user_id) DO UPDATE
  SET status = 'active';

  UPDATE community_invitations
  SET status = 'accepted', responded_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_join_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_req record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM community_join_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  IF NOT public.is_community_admin_or_mod(v_req.community_id, v_caller) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
  END IF;

  UPDATE community_join_requests
  SET status = 'approved', reviewed_by = v_caller, reviewed_at = now()
  WHERE id = p_request_id;

  INSERT INTO community_members (community_id, user_id, role, status)
  VALUES (v_req.community_id, v_req.user_id, 'member', 'active')
  ON CONFLICT (community_id, user_id) DO UPDATE
  SET status = 'active';

  INSERT INTO notifications (user_id, actor_id, type, community_id)
  VALUES (v_req.user_id, v_caller, 'community_join_approved', v_req.community_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.decline_community_invitation(p_invitation_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_inv record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_inv FROM community_invitations WHERE id = p_invitation_id;
  IF v_inv IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitation_not_found');
  END IF;

  IF v_inv.invitee_id <> v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_invitee');
  END IF;

  UPDATE community_invitations
  SET status = 'declined', responded_at = now()
  WHERE id = p_invitation_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.invite_to_community(p_community_id uuid, p_invitee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF p_invitee_id = v_caller THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cannot_invite_self');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = v_caller AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_member');
  END IF;

  IF EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = p_invitee_id AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  IF EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = p_invitee_id AND status = 'banned'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invitee_banned');
  END IF;

  INSERT INTO community_invitations (community_id, inviter_id, invitee_id, status)
  VALUES (p_community_id, v_caller, p_invitee_id, 'pending')
  ON CONFLICT (community_id, invitee_id) DO UPDATE
  SET status = 'pending',
      inviter_id = EXCLUDED.inviter_id,
      created_at = now(),
      responded_at = NULL;

  INSERT INTO notifications (user_id, actor_id, type, community_id)
  VALUES (p_invitee_id, v_caller, 'community_invite', p_community_id)
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_join_request(p_request_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_req record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  SELECT * INTO v_req FROM community_join_requests WHERE id = p_request_id;
  IF v_req IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'request_not_found');
  END IF;

  IF NOT public.is_community_admin_or_mod(v_req.community_id, v_caller) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authorized');
  END IF;

  IF v_req.status <> 'pending' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_reviewed');
  END IF;

  UPDATE community_join_requests
  SET status = 'rejected', reviewed_by = v_caller, reviewed_at = now()
  WHERE id = p_request_id;

  RETURN jsonb_build_object('ok', true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.request_to_join_community(p_community_id uuid, p_message text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_admin record;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = v_caller AND status = 'active'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'already_member');
  END IF;

  IF EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id AND user_id = v_caller AND status = 'banned'
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'banned');
  END IF;

  INSERT INTO community_join_requests (community_id, user_id, message, status)
  VALUES (p_community_id, v_caller, p_message, 'pending')
  ON CONFLICT (community_id, user_id) DO UPDATE
  SET status = 'pending',
      message = EXCLUDED.message,
      reviewed_by = NULL,
      reviewed_at = NULL,
      created_at = now();

  FOR v_admin IN
    SELECT user_id FROM community_members
    WHERE community_id = p_community_id
      AND role IN ('admin', 'moderator')
      AND status = 'active'
  LOOP
    INSERT INTO notifications (user_id, actor_id, type, community_id, content)
    VALUES (
      v_admin.user_id, v_caller, 'community_join_request', p_community_id,
      CASE WHEN p_message IS NULL OR p_message = ''
        THEN NULL
        ELSE 'Join request: "' || left(p_message, 100) ||
             CASE WHEN length(p_message) > 100 THEN '...' ELSE '' END || '"'
      END
    )
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN jsonb_build_object('ok', true);
END;
$function$;
