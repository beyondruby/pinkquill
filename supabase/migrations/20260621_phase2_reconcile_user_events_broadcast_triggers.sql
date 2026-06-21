-- P2 reconciliation: the per-user `user-events:` broadcast trigger functions +
-- triggers (the May-2026 realtime-egress design) existed only in the live DB with
-- no source migration. Captured here verbatim so the repo can rebuild prod.
-- Idempotent: CREATE OR REPLACE for functions, DROP TRIGGER IF EXISTS for triggers.

CREATE OR REPLACE FUNCTION public.notify_dm_unread_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'realtime'
AS $function$
DECLARE
  v_conversation_id uuid;
  v_sender_id uuid;
  v_payload jsonb;
  v_participant uuid;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_conversation_id := OLD.conversation_id;
    v_sender_id := OLD.sender_id;
  ELSE
    v_conversation_id := NEW.conversation_id;
    v_sender_id := NEW.sender_id;
  END IF;

  v_payload := jsonb_build_object(
    'op', TG_OP,
    'conversation_id', v_conversation_id,
    'sender_id', v_sender_id,
    'message_id', COALESCE(NEW.id, OLD.id),
    'is_read', COALESCE(NEW.is_read, OLD.is_read)
  );

  FOR v_participant IN
    SELECT user_id FROM public.conversation_participants
    WHERE conversation_id = v_conversation_id
      AND user_id IS DISTINCT FROM v_sender_id
  LOOP
    PERFORM realtime.send(v_payload, 'dm_unread_change', 'user-events:' || v_participant::text, true);
  END LOOP;

  RETURN NULL;
END;
$function$;

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
    PERFORM realtime.send(
      jsonb_build_object('op', 'DELETE', 'follower_id', OLD.follower_id, 'following_id', OLD.following_id),
      'follow_change', 'user-events:' || OLD.following_id::text, true
    );
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
    v_payload := jsonb_build_object('op', 'DELETE', 'id', OLD.id);
  ELSE
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('op', TG_OP, 'id', NEW.id, 'type', NEW.type, 'read', NEW.read);
  END IF;

  PERFORM realtime.send(v_payload, 'notification_change', 'user-events:' || v_user_id::text, true);

  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS follows_notify ON public.follows;
CREATE TRIGGER follows_notify AFTER INSERT OR DELETE OR UPDATE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION notify_follow_change();

DROP TRIGGER IF EXISTS messages_notify_unread ON public.messages;
CREATE TRIGGER messages_notify_unread AFTER INSERT OR DELETE OR UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION notify_dm_unread_change();

DROP TRIGGER IF EXISTS notifications_notify ON public.notifications;
CREATE TRIGGER notifications_notify AFTER INSERT OR DELETE OR UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION notify_notification_change();
