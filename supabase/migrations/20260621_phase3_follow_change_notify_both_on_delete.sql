-- P3: notify_follow_change previously broadcast DELETE only to the followed user.
-- The follower also needs it (to see a pending request being rejected, or a follow
-- removed) so the per-user broadcast channel can fully replace the postgres_changes
-- subscription StudioProfile used for follow status. Broadcast DELETE to both parties.
CREATE OR REPLACE FUNCTION public.notify_follow_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime'
AS $function$
DECLARE
  v_payload jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_payload := jsonb_build_object('op', 'DELETE', 'follower_id', OLD.follower_id, 'following_id', OLD.following_id);
    PERFORM realtime.send(v_payload, 'follow_change', 'user-events:' || OLD.following_id::text, true);
    PERFORM realtime.send(v_payload, 'follow_change', 'user-events:' || OLD.follower_id::text, true);
    RETURN NULL;
  END IF;

  v_payload := jsonb_build_object(
    'op', TG_OP,
    'follower_id', NEW.follower_id,
    'following_id', NEW.following_id,
    'status', NEW.status
  );

  PERFORM realtime.send(v_payload, 'follow_change', 'user-events:' || NEW.following_id::text, true);

  IF (TG_OP = 'UPDATE') THEN
    PERFORM realtime.send(v_payload, 'follow_change', 'user-events:' || NEW.follower_id::text, true);
  END IF;

  RETURN NULL;
END;
$function$;
