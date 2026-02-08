-- ============================================================================
-- Community Chat / Modmail
-- - Adds per-community member chat threads for moderation and announcements
-- - Adds welcome message support on communities
-- - Adds status and moderation message automation
-- ============================================================================

-- ============================================================================
-- COMMUNITY SETTINGS
-- ============================================================================

ALTER TABLE communities
ADD COLUMN IF NOT EXISTS welcome_message TEXT;

COMMENT ON COLUMN communities.welcome_message IS
'Optional welcome message sent to members in community chat when they join.';

-- ============================================================================
-- CORE TABLES
-- ============================================================================

CREATE TABLE IF NOT EXISTS community_chat_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  community_id UUID NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  UNIQUE (community_id, member_id)
);

CREATE TABLE IF NOT EXISTS community_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES community_chat_threads(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('system', 'member', 'moderator', 'admin')),
  message_type TEXT NOT NULL DEFAULT 'message'
    CHECK (message_type IN ('message', 'announcement', 'welcome', 'mod_action', 'appeal', 'status_update')),
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS community_chat_thread_reads (
  thread_id UUID NOT NULL REFERENCES community_chat_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (thread_id, user_id)
);

COMMENT ON TABLE community_chat_threads IS
'One moderation chat thread per community member.';
COMMENT ON TABLE community_chat_messages IS
'Messages inside community moderation/member threads.';
COMMENT ON TABLE community_chat_thread_reads IS
'Per-user read markers for community chat threads.';

CREATE INDEX IF NOT EXISTS idx_community_chat_threads_community_updated
ON community_chat_threads(community_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_chat_threads_member_updated
ON community_chat_threads(member_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_community_chat_messages_thread_created
ON community_chat_messages(thread_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_community_chat_messages_sender
ON community_chat_messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_community_chat_reads_user
ON community_chat_thread_reads(user_id, last_read_at DESC);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION is_community_staff(
  p_community_id UUID,
  p_user_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM community_members
    WHERE community_id = p_community_id
      AND user_id = p_user_id
      AND role IN ('admin', 'moderator')
      AND status = 'active'
  );
END;
$$;

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
BEGIN
  SELECT community_id, member_id
  INTO v_community_id, v_member_id
  FROM community_chat_threads
  WHERE id = p_thread_id;

  IF v_community_id IS NULL THEN
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
BEGIN
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

-- ============================================================================
-- MESSAGE / THREAD TRIGGERS
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

DROP TRIGGER IF EXISTS trigger_set_community_chat_sender_role ON community_chat_messages;
CREATE TRIGGER trigger_set_community_chat_sender_role
  BEFORE INSERT ON community_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_community_chat_sender_role();

CREATE OR REPLACE FUNCTION touch_community_chat_thread()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE community_chat_threads
  SET
    updated_at = NEW.created_at,
    last_message_at = NEW.created_at
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_touch_community_chat_thread ON community_chat_messages;
CREATE TRIGGER trigger_touch_community_chat_thread
  AFTER INSERT ON community_chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION touch_community_chat_thread();

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

DROP TRIGGER IF EXISTS trigger_community_member_chat_sync ON community_members;
CREATE TRIGGER trigger_community_member_chat_sync
  AFTER INSERT OR UPDATE OF status, mute_reason, muted_until, ban_reason, banned_until
  ON community_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_community_member_chat_sync();

-- ============================================================================
-- BROADCAST RPC
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
        'broadcast', true
      )
    );

    v_sent_count := v_sent_count + 1;
  END LOOP;

  RETURN v_sent_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_community_chat_unread_count(
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible_threads AS (
    SELECT t.id
    FROM community_chat_threads t
    JOIN community_members cm
      ON cm.community_id = t.community_id
     AND cm.user_id = p_user_id
    WHERE
      (
        cm.role = 'member'
        AND t.member_id = p_user_id
        AND cm.status IN ('active', 'muted', 'banned')
      )
      OR (
        cm.role IN ('admin', 'moderator')
        AND cm.status = 'active'
      )
  ),
  reads AS (
    SELECT thread_id, last_read_at
    FROM community_chat_thread_reads
    WHERE user_id = p_user_id
  )
  SELECT COUNT(*)::INTEGER
  FROM community_chat_messages m
  JOIN accessible_threads t ON t.id = m.thread_id
  LEFT JOIN reads r ON r.thread_id = m.thread_id
  WHERE m.sender_id IS DISTINCT FROM p_user_id
    AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz);
$$;

-- ============================================================================
-- MODERATION RPC UPDATES
-- - Keep existing behavior
-- - Also write moderation messages to community chat threads
-- ============================================================================

CREATE OR REPLACE FUNCTION moderate_delete_post(
  p_community_id UUID,
  p_post_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_author_id UUID;
  v_snapshot JSONB;
  v_thread_id UUID;
  v_message TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT check_community_permission(p_community_id, v_user_id, 'can_delete_posts') THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to delete posts');
  END IF;

  SELECT author_id,
         jsonb_build_object(
           'title', title,
           'content', content,
           'type', type
         )
  INTO v_author_id, v_snapshot
  FROM posts
  WHERE id = p_post_id
    AND community_id = p_community_id;

  IF v_author_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Post not found in this community');
  END IF;

  DELETE FROM posts
  WHERE id = p_post_id
    AND community_id = p_community_id;

  INSERT INTO community_content_deletions
    (community_id, content_type, content_id, content_author_id, deleted_by, reason, content_snapshot)
  VALUES
    (p_community_id, 'post', p_post_id, v_author_id, v_user_id, p_reason, v_snapshot);

  BEGIN
    v_thread_id := ensure_community_chat_thread(p_community_id, v_author_id);
    v_message := 'Your post was removed by the moderation team.';
    IF p_reason IS NOT NULL AND btrim(p_reason) <> '' THEN
      v_message := v_message || ' Reason: ' || btrim(p_reason);
    END IF;

    INSERT INTO community_chat_messages (
      thread_id,
      sender_id,
      message_type,
      content,
      metadata
    )
    VALUES (
      v_thread_id,
      v_user_id,
      'mod_action',
      v_message,
      jsonb_build_object(
        'community_id', p_community_id,
        'content_type', 'post',
        'content_id', p_post_id,
        'action', 'deleted'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Deletion should still succeed even if chat notification cannot be sent.
      NULL;
  END;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION moderate_delete_comment(
  p_community_id UUID,
  p_comment_id UUID,
  p_reason TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_comment_author_id UUID;
  v_comment_post_id UUID;
  v_snapshot JSONB;
  v_thread_id UUID;
  v_message TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT check_community_permission(p_community_id, v_user_id, 'can_delete_comments') THEN
    RETURN jsonb_build_object('success', false, 'error', 'You do not have permission to delete comments');
  END IF;

  SELECT user_id, post_id,
         jsonb_build_object('content', content)
  INTO v_comment_author_id, v_comment_post_id, v_snapshot
  FROM comments
  WHERE id = p_comment_id;

  IF v_comment_author_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comment not found');
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM posts
    WHERE id = v_comment_post_id
      AND community_id = p_community_id
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Comment does not belong to this community');
  END IF;

  DELETE FROM comment_likes
  WHERE comment_id IN (
    SELECT id
    FROM comments
    WHERE parent_id = p_comment_id
  );

  DELETE FROM comments
  WHERE parent_id = p_comment_id;

  DELETE FROM comment_likes
  WHERE comment_id = p_comment_id;

  DELETE FROM comments
  WHERE id = p_comment_id;

  INSERT INTO community_content_deletions
    (community_id, content_type, content_id, content_author_id, deleted_by, reason, content_snapshot)
  VALUES
    (p_community_id, 'comment', p_comment_id, v_comment_author_id, v_user_id, p_reason, v_snapshot);

  BEGIN
    v_thread_id := ensure_community_chat_thread(p_community_id, v_comment_author_id);
    v_message := 'Your comment was removed by the moderation team.';
    IF p_reason IS NOT NULL AND btrim(p_reason) <> '' THEN
      v_message := v_message || ' Reason: ' || btrim(p_reason);
    END IF;

    INSERT INTO community_chat_messages (
      thread_id,
      sender_id,
      message_type,
      content,
      metadata
    )
    VALUES (
      v_thread_id,
      v_user_id,
      'mod_action',
      v_message,
      jsonb_build_object(
        'community_id', p_community_id,
        'content_type', 'comment',
        'content_id', p_comment_id,
        'action', 'deleted'
      )
    );
  EXCEPTION
    WHEN OTHERS THEN
      NULL;
  END;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE community_chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE community_chat_thread_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view accessible community chat threads" ON community_chat_threads;
CREATE POLICY "Users can view accessible community chat threads" ON community_chat_threads
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM community_members cm
      WHERE cm.community_id = community_chat_threads.community_id
        AND cm.user_id = auth.uid()
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
  );

DROP POLICY IF EXISTS "Staff can update community chat threads" ON community_chat_threads;
CREATE POLICY "Staff can update community chat threads" ON community_chat_threads
  FOR UPDATE
  USING (is_community_staff(community_id, auth.uid()))
  WITH CHECK (is_community_staff(community_id, auth.uid()));

DROP POLICY IF EXISTS "Users can view accessible community chat messages" ON community_chat_messages;
CREATE POLICY "Users can view accessible community chat messages" ON community_chat_messages
  FOR SELECT USING (
    can_access_community_chat_thread(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can send community chat messages" ON community_chat_messages;
CREATE POLICY "Users can send community chat messages" ON community_chat_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
    AND (
      message_type = 'message'
      OR (
        message_type = 'appeal'
        AND EXISTS (
          SELECT 1
          FROM community_chat_threads t
          JOIN community_members cm ON cm.community_id = t.community_id
          WHERE t.id = community_chat_messages.thread_id
            AND cm.user_id = auth.uid()
            AND cm.user_id = t.member_id
            AND cm.role = 'member'
            AND cm.status IN ('muted', 'banned')
        )
      )
      OR (
        message_type = 'announcement'
        AND EXISTS (
          SELECT 1
          FROM community_chat_threads t
          JOIN community_members cm ON cm.community_id = t.community_id
          WHERE t.id = community_chat_messages.thread_id
            AND cm.user_id = auth.uid()
            AND cm.role IN ('admin', 'moderator')
            AND cm.status = 'active'
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can view own community chat read markers" ON community_chat_thread_reads;
CREATE POLICY "Users can view own community chat read markers" ON community_chat_thread_reads
  FOR SELECT USING (
    user_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert own community chat read markers" ON community_chat_thread_reads;
CREATE POLICY "Users can insert own community chat read markers" ON community_chat_thread_reads
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
  );

DROP POLICY IF EXISTS "Users can update own community chat read markers" ON community_chat_thread_reads;
CREATE POLICY "Users can update own community chat read markers" ON community_chat_thread_reads
  FOR UPDATE
  USING (
    user_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
  )
  WITH CHECK (
    user_id = auth.uid()
    AND can_access_community_chat_thread(thread_id, auth.uid())
  );

-- ============================================================================
-- BACKFILL EXISTING MEMBER THREADS
-- ============================================================================

INSERT INTO community_chat_threads (community_id, member_id)
SELECT community_id, user_id
FROM community_members
WHERE role = 'member'
  AND status IN ('active', 'muted', 'banned')
ON CONFLICT (community_id, member_id) DO NOTHING;

INSERT INTO community_chat_messages (
  thread_id,
  sender_id,
  sender_role,
  message_type,
  content,
  metadata
)
SELECT
  t.id,
  NULL,
  'system',
  'welcome',
  btrim(c.welcome_message),
  jsonb_build_object('community_id', t.community_id)
FROM community_chat_threads t
JOIN community_members cm
  ON cm.community_id = t.community_id
 AND cm.user_id = t.member_id
JOIN communities c
  ON c.id = t.community_id
WHERE cm.role = 'member'
  AND cm.status = 'active'
  AND c.welcome_message IS NOT NULL
  AND btrim(c.welcome_message) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM community_chat_messages m
    WHERE m.thread_id = t.id
      AND m.message_type = 'welcome'
  );

-- ============================================================================
-- REALTIME + GRANTS
-- ============================================================================

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE community_chat_threads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE community_chat_messages;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE community_chat_thread_reads;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION is_community_staff TO authenticated;
GRANT EXECUTE ON FUNCTION can_access_community_chat_thread TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_community_chat_thread TO authenticated;
GRANT EXECUTE ON FUNCTION community_chat_broadcast TO authenticated;
GRANT EXECUTE ON FUNCTION get_community_chat_unread_count TO authenticated;
