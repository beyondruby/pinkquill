-- ============================================================================
-- Engagement Phase 3 — notifications created and reconciled in the database
-- (docs/engagement/02-plan.md)
--
-- Before: every engagement notification was a browser-side insert with no
-- dedupe, no cleanup on undo, wrong comment ids, and nothing for takes.
-- Now: AFTER triggers on reactions / take_reactions / comments /
-- take_comments / comment_likes / take_comment_likes / post_mentions /
-- take_mentions / relays / saves / take_relays / take_saves create exactly
-- one row per (actor, content, kind of action), update it in place when a
-- reaction changes, and delete it when the action is undone or the comment
-- is deleted. Self-actions, blocked users (either way) and muted categories
-- never notify. `@name` in comment text is resolved to profiles, stored in
-- comment_mentions / take_comment_mentions, and notified as `mention`.
-- ============================================================================

-- 0. mention tables ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.comment_mentions (
  comment_id uuid NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_user ON public.comment_mentions(user_id);
ALTER TABLE public.comment_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS comment_mentions_select ON public.comment_mentions;
CREATE POLICY comment_mentions_select ON public.comment_mentions FOR SELECT USING (true);
GRANT SELECT ON public.comment_mentions TO anon, authenticated;

CREATE TABLE IF NOT EXISTS public.take_comment_mentions (
  comment_id uuid NOT NULL REFERENCES public.take_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_take_comment_mentions_user ON public.take_comment_mentions(user_id);
ALTER TABLE public.take_comment_mentions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS take_comment_mentions_select ON public.take_comment_mentions;
CREATE POLICY take_comment_mentions_select ON public.take_comment_mentions FOR SELECT USING (true);
GRANT SELECT ON public.take_comment_mentions TO anon, authenticated;

-- 1. helpers ----------------------------------------------------------------

-- May `p_actor` notify `p_recipient` in `p_category`? No self-notifications,
-- no notifications across a block in either direction, none for a category
-- the recipient muted in /settings/notifications.
CREATE OR REPLACE FUNCTION public.engagement_notify_allowed(p_recipient uuid, p_actor uuid, p_category text)
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_recipient IS NOT NULL
     AND p_actor IS NOT NULL
     AND p_recipient <> p_actor
     AND NOT EXISTS (
       SELECT 1 FROM public.blocks b
       WHERE (b.blocker_id = p_recipient AND b.blocked_id = p_actor)
          OR (b.blocker_id = p_actor AND b.blocked_id = p_recipient)
     )
     AND COALESCE((
       SELECT (p.notification_preferences ->> p_category)::boolean
       FROM public.profiles p WHERE p.id = p_recipient
     ), true);
$$;
REVOKE ALL ON FUNCTION public.engagement_notify_allowed(uuid, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.engagement_notify_insert(
  p_user_id uuid, p_actor_id uuid, p_type text,
  p_post_id uuid, p_take_id uuid, p_comment_id uuid,
  p_reaction_type text, p_content text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.notifications (user_id, actor_id, type, post_id, take_id, comment_id, reaction_type, content)
  VALUES (p_user_id, p_actor_id, p_type, p_post_id, p_take_id, p_comment_id, p_reaction_type, LEFT(p_content, 280));
$$;
REVOKE ALL ON FUNCTION public.engagement_notify_insert(uuid, uuid, text, uuid, uuid, uuid, text, text) FROM PUBLIC;

-- The realtime broadcast now also fires when a reaction notification changes
-- type in place, so the panel can re-label it live.
CREATE OR REPLACE FUNCTION public.notify_notification_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, realtime
AS $$
DECLARE
  v_user_id uuid;
  v_payload jsonb;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    v_user_id := OLD.user_id;
    v_payload := jsonb_build_object('op', 'DELETE', 'id', OLD.id, 'type', OLD.type, 'was_read', OLD.read);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.read IS NOT DISTINCT FROM NEW.read) AND (OLD.type IS NOT DISTINCT FROM NEW.type) THEN
      RETURN NULL;
    END IF;
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('op', 'UPDATE', 'id', NEW.id, 'type', NEW.type, 'read', NEW.read, 'was_read', OLD.read, 'created_at', NEW.created_at);
  ELSE
    v_user_id := NEW.user_id;
    v_payload := jsonb_build_object('op', 'INSERT', 'id', NEW.id, 'type', NEW.type, 'read', NEW.read);
  END IF;

  PERFORM realtime.send(v_payload, 'notification_change', 'user-events:' || v_user_id::text, true);
  RETURN NULL;
END;
$$;

-- 2. reactions --------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_reactions_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE actor_id = OLD.user_id AND post_id = OLD.post_id
      AND type IN ('admire','snap','ovation','support','inspired','applaud');
    RETURN OLD;
  END IF;

  SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  IF NOT public.engagement_notify_allowed(v_author, NEW.user_id, 'post_activity') THEN
    RETURN NEW;
  END IF;

  -- One row per (actor, post): change the verb in place, else create.
  UPDATE public.notifications
  SET type = NEW.reaction_type, reaction_type = NEW.reaction_type, read = false, created_at = now()
  WHERE user_id = v_author AND actor_id = NEW.user_id AND post_id = NEW.post_id
    AND type IN ('admire','snap','ovation','support','inspired','applaud');
  IF NOT FOUND THEN
    PERFORM public.engagement_notify_insert(v_author, NEW.user_id, NEW.reaction_type, NEW.post_id, NULL, NULL, NEW.reaction_type, NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS reactions_notify ON public.reactions;
CREATE TRIGGER reactions_notify
  AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_reactions_notify();

CREATE OR REPLACE FUNCTION public.trg_take_reactions_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE actor_id = OLD.user_id AND take_id = OLD.take_id
      AND type IN ('admire','snap','ovation','support','inspired','applaud');
    RETURN OLD;
  END IF;

  SELECT author_id INTO v_author FROM public.takes WHERE id = NEW.take_id;
  IF NOT public.engagement_notify_allowed(v_author, NEW.user_id, 'post_activity') THEN
    RETURN NEW;
  END IF;

  UPDATE public.notifications
  SET type = NEW.reaction_type, reaction_type = NEW.reaction_type, read = false, created_at = now()
  WHERE user_id = v_author AND actor_id = NEW.user_id AND take_id = NEW.take_id
    AND type IN ('admire','snap','ovation','support','inspired','applaud');
  IF NOT FOUND THEN
    PERFORM public.engagement_notify_insert(v_author, NEW.user_id, NEW.reaction_type, NULL, NEW.take_id, NULL, NEW.reaction_type, NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS take_reactions_notify ON public.take_reactions;
CREATE TRIGGER take_reactions_notify
  AFTER INSERT OR UPDATE OF reaction_type OR DELETE ON public.take_reactions
  FOR EACH ROW EXECUTE FUNCTION public.trg_take_reactions_notify();

-- 3. comments ---------------------------------------------------------------
-- Shared body: p_kind = 'post' | 'take'. Notifies the content author
-- (`comment`), the person answered (`reply`), and every resolved `@name`
-- (`mention`), each at most once per comment.
CREATE OR REPLACE FUNCTION public.engagement_comment_notify(
  p_kind text, p_comment_id uuid, p_content_id uuid, p_actor uuid,
  p_parent_id uuid, p_reply_to uuid, p_content text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_target uuid;
  v_post_id uuid := CASE WHEN p_kind = 'post' THEN p_content_id END;
  v_take_id uuid := CASE WHEN p_kind = 'take' THEN p_content_id END;
  v_excerpt text := LEFT(p_content, 100);
  v_notified uuid[] := ARRAY[p_actor];
  v_name text;
  v_uid uuid;
BEGIN
  IF p_kind = 'post' THEN
    SELECT author_id INTO v_author FROM public.posts WHERE id = p_content_id;
  ELSE
    SELECT author_id INTO v_author FROM public.takes WHERE id = p_content_id;
  END IF;

  IF p_parent_id IS NULL THEN
    IF public.engagement_notify_allowed(v_author, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_author, p_actor, 'comment', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_author;
    END IF;
  ELSE
    IF p_reply_to IS NOT NULL THEN
      v_target := p_reply_to;
    ELSIF p_kind = 'post' THEN
      SELECT user_id INTO v_target FROM public.comments WHERE id = p_parent_id;
    ELSE
      SELECT user_id INTO v_target FROM public.take_comments WHERE id = p_parent_id;
    END IF;
    IF public.engagement_notify_allowed(v_target, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_target, p_actor, 'reply', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_target;
    END IF;
    IF v_author IS DISTINCT FROM v_target AND public.engagement_notify_allowed(v_author, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_author, p_actor, 'comment', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_author;
    END IF;
  END IF;

  -- @mentions in the text → mention rows + notifications (once per person).
  FOR v_name IN
    SELECT DISTINCT lower(m[1]) FROM regexp_matches(p_content, '(?:^|[^\w@.])@([A-Za-z0-9_]{2,30})', 'g') AS m
  LOOP
    SELECT id INTO v_uid FROM public.profiles WHERE lower(username) = v_name;
    IF v_uid IS NULL THEN CONTINUE; END IF;
    IF p_kind = 'post' THEN
      INSERT INTO public.comment_mentions (comment_id, user_id) VALUES (p_comment_id, v_uid) ON CONFLICT DO NOTHING;
    ELSE
      INSERT INTO public.take_comment_mentions (comment_id, user_id) VALUES (p_comment_id, v_uid) ON CONFLICT DO NOTHING;
    END IF;
    IF NOT (v_uid = ANY (v_notified)) AND public.engagement_notify_allowed(v_uid, p_actor, 'comments') THEN
      PERFORM public.engagement_notify_insert(v_uid, p_actor, 'mention', v_post_id, v_take_id, p_comment_id, NULL, v_excerpt);
      v_notified := v_notified || v_uid;
    END IF;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.engagement_comment_notify(text, uuid, uuid, uuid, uuid, uuid, text) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.trg_comments_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- BEFORE DELETE: comment_id still matches (the FK would SET NULL after).
    DELETE FROM public.notifications WHERE comment_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.engagement_comment_notify('post', NEW.id, NEW.post_id, NEW.user_id, NEW.parent_id, NEW.reply_to_user_id, NEW.content);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comments_notify_insert ON public.comments;
CREATE TRIGGER comments_notify_insert
  AFTER INSERT ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_comments_notify();
DROP TRIGGER IF EXISTS comments_notify_delete ON public.comments;
CREATE TRIGGER comments_notify_delete
  BEFORE DELETE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_comments_notify();

CREATE OR REPLACE FUNCTION public.trg_take_comments_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications WHERE comment_id = OLD.id;
    RETURN OLD;
  END IF;
  PERFORM public.engagement_comment_notify('take', NEW.id, NEW.take_id, NEW.user_id, NEW.parent_id, NEW.reply_to_user_id, NEW.content);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS take_comments_notify_insert ON public.take_comments;
CREATE TRIGGER take_comments_notify_insert
  AFTER INSERT ON public.take_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_take_comments_notify();
DROP TRIGGER IF EXISTS take_comments_notify_delete ON public.take_comments;
CREATE TRIGGER take_comments_notify_delete
  BEFORE DELETE ON public.take_comments
  FOR EACH ROW EXECUTE FUNCTION public.trg_take_comments_notify();

-- notifications.comment_id references comments only; take comments live in
-- a different table, so the FK must not apply to take rows. Keep the FK for
-- post comments by moving it to a validated CHECK-free constraint: drop the
-- FK and rely on the BEFORE DELETE triggers above for cleanup.
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_comment_id_fkey;

-- 4. comment likes ----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_comment_likes_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_post uuid;
  v_text text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'comment_like' AND comment_id = OLD.comment_id AND actor_id = OLD.user_id;
    RETURN OLD;
  END IF;
  SELECT user_id, post_id, content INTO v_owner, v_post, v_text FROM public.comments WHERE id = NEW.comment_id;
  IF public.engagement_notify_allowed(v_owner, NEW.user_id, 'comments') THEN
    PERFORM public.engagement_notify_insert(v_owner, NEW.user_id, 'comment_like', v_post, NULL, NEW.comment_id, NULL, LEFT(v_text, 100));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS comment_likes_notify ON public.comment_likes;
CREATE TRIGGER comment_likes_notify
  AFTER INSERT OR DELETE ON public.comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_comment_likes_notify();

CREATE OR REPLACE FUNCTION public.trg_take_comment_likes_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_take uuid;
  v_text text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'comment_like' AND comment_id = OLD.comment_id AND actor_id = OLD.user_id;
    RETURN OLD;
  END IF;
  SELECT user_id, take_id, content INTO v_owner, v_take, v_text FROM public.take_comments WHERE id = NEW.comment_id;
  IF public.engagement_notify_allowed(v_owner, NEW.user_id, 'comments') THEN
    PERFORM public.engagement_notify_insert(v_owner, NEW.user_id, 'comment_like', NULL, v_take, NEW.comment_id, NULL, LEFT(v_text, 100));
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS take_comment_likes_notify ON public.take_comment_likes;
CREATE TRIGGER take_comment_likes_notify
  AFTER INSERT OR DELETE ON public.take_comment_likes
  FOR EACH ROW EXECUTE FUNCTION public.trg_take_comment_likes_notify();

-- 5. post / take tags -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_post_mentions_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
  v_status text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'mention' AND post_id = OLD.post_id AND user_id = OLD.user_id AND comment_id IS NULL;
    RETURN OLD;
  END IF;
  SELECT author_id, status INTO v_author, v_status FROM public.posts WHERE id = NEW.post_id;
  IF v_status IS DISTINCT FROM 'published' THEN RETURN NEW; END IF;
  IF public.engagement_notify_allowed(NEW.user_id, v_author, 'comments') THEN
    PERFORM public.engagement_notify_insert(NEW.user_id, v_author, 'mention', NEW.post_id, NULL, NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS post_mentions_notify ON public.post_mentions;
CREATE TRIGGER post_mentions_notify
  AFTER INSERT OR DELETE ON public.post_mentions
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_mentions_notify();

CREATE OR REPLACE FUNCTION public.trg_take_mentions_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.notifications
    WHERE type = 'mention' AND take_id = OLD.take_id AND user_id = OLD.user_id AND comment_id IS NULL;
    RETURN OLD;
  END IF;
  SELECT author_id INTO v_author FROM public.takes WHERE id = NEW.take_id;
  IF public.engagement_notify_allowed(NEW.user_id, v_author, 'comments') THEN
    PERFORM public.engagement_notify_insert(NEW.user_id, v_author, 'mention', NULL, NEW.take_id, NULL, NULL, NULL);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS take_mentions_notify ON public.take_mentions;
CREATE TRIGGER take_mentions_notify
  AFTER INSERT OR DELETE ON public.take_mentions
  FOR EACH ROW EXECUTE FUNCTION public.trg_take_mentions_notify();

-- 6. relays / saves ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_post_activity_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_type text := TG_ARGV[0];        -- 'relay' | 'save'
  v_kind text := TG_ARGV[1];        -- 'post'  | 'take'
  v_author uuid;
  v_content_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF v_kind = 'post' THEN
      DELETE FROM public.notifications WHERE type = v_type AND post_id = OLD.post_id AND actor_id = OLD.user_id;
    ELSE
      DELETE FROM public.notifications WHERE type = v_type AND take_id = OLD.take_id AND actor_id = OLD.user_id;
    END IF;
    RETURN OLD;
  END IF;
  IF v_kind = 'post' THEN
    v_content_id := NEW.post_id;
    SELECT author_id INTO v_author FROM public.posts WHERE id = NEW.post_id;
  ELSE
    v_content_id := NEW.take_id;
    SELECT author_id INTO v_author FROM public.takes WHERE id = NEW.take_id;
  END IF;
  IF public.engagement_notify_allowed(v_author, NEW.user_id, 'post_activity') THEN
    IF v_kind = 'post' THEN
      PERFORM public.engagement_notify_insert(v_author, NEW.user_id, v_type, v_content_id, NULL, NULL, NULL, NULL);
    ELSE
      PERFORM public.engagement_notify_insert(v_author, NEW.user_id, v_type, NULL, v_content_id, NULL, NULL, NULL);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS relays_notify ON public.relays;
CREATE TRIGGER relays_notify AFTER INSERT OR DELETE ON public.relays
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_activity_notify('relay', 'post');
DROP TRIGGER IF EXISTS saves_notify ON public.saves;
CREATE TRIGGER saves_notify AFTER INSERT OR DELETE ON public.saves
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_activity_notify('save', 'post');
DROP TRIGGER IF EXISTS take_relays_notify ON public.take_relays;
CREATE TRIGGER take_relays_notify AFTER INSERT OR DELETE ON public.take_relays
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_activity_notify('relay', 'take');
DROP TRIGGER IF EXISTS take_saves_notify ON public.take_saves;
CREATE TRIGGER take_saves_notify AFTER INSERT OR DELETE ON public.take_saves
  FOR EACH ROW EXECUTE FUNCTION public.trg_post_activity_notify('save', 'take');

-- 7. backfill ---------------------------------------------------------------
-- Reaction rows: carry the reaction in reaction_type; drop rows whose reaction is gone.
UPDATE public.notifications SET reaction_type = type
WHERE type IN ('admire','snap','ovation','support','inspired','applaud') AND reaction_type IS NULL;
DELETE FROM public.notifications n
WHERE n.type IN ('admire','snap','ovation','support','inspired','applaud')
  AND n.post_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.reactions r WHERE r.post_id = n.post_id AND r.user_id = n.actor_id);
-- Comment likes / replies / mentions whose comment or like no longer exists.
DELETE FROM public.notifications n
WHERE n.type = 'comment_like'
  AND (n.comment_id IS NULL
       OR NOT EXISTS (SELECT 1 FROM public.comment_likes l WHERE l.comment_id = n.comment_id AND l.user_id = n.actor_id));
DELETE FROM public.notifications n
WHERE n.type IN ('reply', 'mention') AND n.comment_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.comments c WHERE c.id = n.comment_id);
DELETE FROM public.notifications n WHERE n.type = 'reply' AND n.comment_id IS NULL;
-- Saves / relays that were undone.
DELETE FROM public.notifications n
WHERE n.type = 'save' AND n.post_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.saves s WHERE s.post_id = n.post_id AND s.user_id = n.actor_id);
DELETE FROM public.notifications n
WHERE n.type = 'relay' AND n.post_id IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.posts p WHERE p.id = n.post_id)
  AND NOT EXISTS (SELECT 1 FROM public.relays r WHERE r.post_id = n.post_id AND r.user_id = n.actor_id);
-- Take relays that were stored in post_id.
UPDATE public.notifications n SET take_id = n.post_id, post_id = NULL
WHERE n.type = 'relay' AND n.post_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.takes t WHERE t.id = n.post_id);
