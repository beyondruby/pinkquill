-- Atomic post creation RPC with collaborators and mentions
-- Ensures post + collaborator + mention writes succeed/fail together.

CREATE OR REPLACE FUNCTION create_post_with_relations(
  p_type TEXT,
  p_title TEXT DEFAULT NULL,
  p_content TEXT DEFAULT '',
  p_visibility TEXT DEFAULT 'public',
  p_content_warning TEXT DEFAULT NULL,
  p_community_id UUID DEFAULT NULL,
  p_flair_id UUID DEFAULT NULL,
  p_styling JSONB DEFAULT NULL,
  p_post_location TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL,
  p_spotify_track JSONB DEFAULT NULL,
  p_collaborators JSONB DEFAULT '[]'::jsonb,
  p_mentions UUID[] DEFAULT ARRAY[]::UUID[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_post_id UUID;
  v_collaborators_json JSONB := COALESCE(p_collaborators, '[]'::jsonb);
  v_collaborators_added INTEGER := 0;
  v_mentions_added INTEGER := 0;
  v_status TEXT := 'published';
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_visibility NOT IN ('public', 'followers', 'private') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid visibility value');
  END IF;

  IF jsonb_typeof(v_collaborators_json) <> 'array' THEN
    RAISE EXCEPTION 'p_collaborators must be a JSON array';
  END IF;

  INSERT INTO posts (
    author_id,
    type,
    title,
    content,
    visibility,
    content_warning,
    community_id,
    flair_id,
    styling,
    post_location,
    metadata,
    spotify_track,
    status
  )
  VALUES (
    v_user_id,
    p_type,
    NULLIF(BTRIM(COALESCE(p_title, '')), ''),
    COALESCE(p_content, ''),
    p_visibility,
    NULLIF(BTRIM(COALESCE(p_content_warning, '')), ''),
    p_community_id,
    p_flair_id,
    p_styling,
    NULLIF(BTRIM(COALESCE(p_post_location, '')), ''),
    p_metadata,
    p_spotify_track,
    v_status
  )
  RETURNING id INTO v_post_id;

  WITH parsed_collaborators AS (
    SELECT DISTINCT
      (collab->>'id')::UUID AS user_id,
      NULLIF(BTRIM(COALESCE(collab->>'role', '')), '') AS role
    FROM jsonb_array_elements(v_collaborators_json) AS collab
    WHERE collab ? 'id'
      AND NULLIF(BTRIM(COALESCE(collab->>'id', '')), '') IS NOT NULL
      AND (collab->>'id')::UUID <> v_user_id
  )
  INSERT INTO post_collaborators (post_id, user_id, status, role)
  SELECT v_post_id, user_id, 'pending', role
  FROM parsed_collaborators
  ON CONFLICT (post_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_collaborators_added = ROW_COUNT;

  IF v_collaborators_added > 0 THEN
    v_status := 'draft';
    UPDATE posts
    SET status = v_status
    WHERE id = v_post_id;
  END IF;

  IF p_mentions IS NOT NULL AND array_length(p_mentions, 1) IS NOT NULL THEN
    INSERT INTO post_mentions (post_id, user_id)
    SELECT v_post_id, mention_id
    FROM (
      SELECT DISTINCT unnest(p_mentions) AS mention_id
    ) mentions
    WHERE mention_id IS NOT NULL
      AND mention_id <> v_user_id
    ON CONFLICT (post_id, user_id) DO NOTHING;

    GET DIAGNOSTICS v_mentions_added = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'post_id', v_post_id,
    'status', v_status,
    'collaborators_added', v_collaborators_added,
    'mentions_added', v_mentions_added
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION create_post_with_relations(
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  TEXT,
  UUID,
  UUID,
  JSONB,
  TEXT,
  JSONB,
  JSONB,
  JSONB,
  UUID[]
) TO authenticated;
