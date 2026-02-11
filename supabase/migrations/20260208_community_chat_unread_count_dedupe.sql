-- ============================================================================
-- Community Chat Unread Count Deduping
-- - Prevents broadcast fan-out announcements from overcounting unread totals
--   for admins/moderators who can see all member threads.
-- ============================================================================

CREATE OR REPLACE FUNCTION get_community_chat_unread_count(
  p_user_id UUID
) RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH accessible_communities AS (
    SELECT DISTINCT cm.community_id, cm.role
    FROM community_members cm
    JOIN communities c
      ON c.id = cm.community_id
    WHERE cm.user_id = p_user_id
      AND c.community_chat_enabled = TRUE
      AND (
        (
          cm.role = 'member'
          AND cm.status IN ('active', 'muted', 'banned')
        )
        OR (
          cm.role IN ('admin', 'moderator')
          AND cm.status = 'active'
        )
      )
  ),
  accessible_threads AS (
    SELECT t.id
    FROM community_chat_threads t
    JOIN accessible_communities ac
      ON ac.community_id = t.community_id
    WHERE
      (
        ac.role = 'member'
        AND t.member_id = p_user_id
      )
      OR ac.role IN ('admin', 'moderator')
  ),
  reads AS (
    SELECT thread_id, last_read_at
    FROM community_chat_thread_reads
    WHERE user_id = p_user_id
  ),
  unread_source AS (
    SELECT
      CASE
        WHEN m.message_type = 'announcement'
          AND NULLIF(m.metadata->>'broadcast_id', '') IS NOT NULL
          THEN 'announcement:' || (m.metadata->>'broadcast_id')
        ELSE m.id::TEXT
      END AS dedupe_key
    FROM accessible_threads at
    JOIN community_chat_messages m
      ON m.thread_id = at.id
    LEFT JOIN reads r
      ON r.thread_id = at.id
    WHERE m.sender_id IS DISTINCT FROM p_user_id
      AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
  )
  SELECT COALESCE(COUNT(DISTINCT dedupe_key), 0)::INTEGER
  FROM unread_source;
$$;

GRANT EXECUTE ON FUNCTION get_community_chat_unread_count TO authenticated;
