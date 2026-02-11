-- ============================================================================
-- Community Chat Overview RPC
-- - Per-community unread counts
-- - Per-community last activity timestamp
-- - Per-community latest message preview
-- ============================================================================

CREATE OR REPLACE FUNCTION get_community_chat_overview(
  p_user_id UUID
) RETURNS TABLE (
  community_id UUID,
  unread_count INTEGER,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT
)
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
    SELECT t.id, t.community_id
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
      at.community_id,
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
  ),
  unread_by_community AS (
    SELECT community_id, COUNT(DISTINCT dedupe_key)::INTEGER AS unread_count
    FROM unread_source
    GROUP BY community_id
  ),
  last_activity AS (
    SELECT t.community_id, MAX(t.last_message_at) AS last_message_at
    FROM community_chat_threads t
    JOIN accessible_threads at ON at.id = t.id
    GROUP BY t.community_id
  ),
  latest_preview AS (
    SELECT DISTINCT ON (at.community_id)
      at.community_id,
      m.content AS last_message_preview
    FROM accessible_threads at
    JOIN community_chat_messages m
      ON m.thread_id = at.id
    ORDER BY at.community_id, m.created_at DESC
  )
  SELECT
    ac.community_id,
    COALESCE(ubc.unread_count, 0) AS unread_count,
    la.last_message_at,
    lp.last_message_preview
  FROM accessible_communities ac
  LEFT JOIN unread_by_community ubc
    ON ubc.community_id = ac.community_id
  LEFT JOIN last_activity la
    ON la.community_id = ac.community_id
  LEFT JOIN latest_preview lp
    ON lp.community_id = ac.community_id;
$$;

GRANT EXECUTE ON FUNCTION get_community_chat_overview TO authenticated;
