-- Collections Phase 1 (docs/collections/01-design.md): one level.
-- A collection holds works (posts) directly through collection_posts.
-- The old collection_items / collection_item_posts tables are left in
-- place, untouched, for one release; their single link is copied over.
-- Every write goes through a SECURITY DEFINER RPC; the direct write
-- policies on collections are dropped.

-- ---------------------------------------------------------------- table
CREATE TABLE IF NOT EXISTS public.collection_posts (
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  post_id       uuid NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
  position      int  NOT NULL DEFAULT 0,
  added_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, post_id)
);
CREATE INDEX IF NOT EXISTS idx_collection_posts_post ON public.collection_posts(post_id);
CREATE INDEX IF NOT EXISTS idx_collection_posts_order ON public.collection_posts(collection_id, position);

ALTER TABLE public.collection_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS collection_posts_select ON public.collection_posts;
CREATE POLICY collection_posts_select ON public.collection_posts
  FOR SELECT USING (public.engagement_can_view_post(post_id, auth.uid()));
-- No insert/update/delete policies: writes go through the RPCs below.
REVOKE INSERT, UPDATE, DELETE ON public.collection_posts FROM anon, authenticated;
GRANT SELECT ON public.collection_posts TO anon, authenticated;

-- Carry the existing links across (item level → collection level).
INSERT INTO public.collection_posts (collection_id, post_id, position, added_at)
SELECT ci.collection_id, cip.post_id,
       row_number() OVER (PARTITION BY ci.collection_id ORDER BY ci.position, cip.position) - 1,
       cip.created_at
FROM public.collection_item_posts cip
JOIN public.collection_items ci ON ci.id = cip.collection_item_id
ON CONFLICT DO NOTHING;

-- collections: reads stay public, writes move to RPCs.
DROP POLICY IF EXISTS "Users can create own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can update own collections" ON public.collections;
DROP POLICY IF EXISTS "Users can delete own collections" ON public.collections;
REVOKE INSERT, UPDATE, DELETE ON public.collections FROM anon, authenticated;

-- updated_at
CREATE OR REPLACE FUNCTION public.collections_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_collections_touch_updated_at ON public.collections;
CREATE TRIGGER trg_collections_touch_updated_at
  BEFORE UPDATE ON public.collections
  FOR EACH ROW EXECUTE FUNCTION public.collections_touch_updated_at();

-- ---------------------------------------------------------------- helpers
CREATE OR REPLACE FUNCTION public.collection_unique_slug(p_user_id uuid, p_name text)
RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_base text;
  v_slug text;
  v_n int := 1;
BEGIN
  v_base := lower(trim(p_name));
  v_base := regexp_replace(v_base, '[^\w\s-]', '', 'g');
  v_base := regexp_replace(v_base, '\s+', '-', 'g');
  v_base := regexp_replace(v_base, '-+', '-', 'g');
  v_base := trim(BOTH '-' FROM left(v_base, 50));
  IF v_base = '' THEN v_base := 'collection'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.collections c WHERE c.user_id = p_user_id AND c.slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;
  RETURN v_slug;
END;
$$;

CREATE OR REPLACE FUNCTION public.collection_text_preview(p_title text, p_content text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT left(
    trim(regexp_replace(regexp_replace(coalesce(nullif(trim(p_title), ''), p_content, ''), '<[^>]+>', ' ', 'g'), '\s+', ' ', 'g')),
    160
  );
$$;

-- ---------------------------------------------------------------- writes
CREATE OR REPLACE FUNCTION public.save_collection(
  p_name text,
  p_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL,
  p_icon_emoji text DEFAULT NULL,
  p_icon_url text DEFAULT NULL,
  p_cover_url text DEFAULT NULL
)
RETURNS public.collections LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_row public.collections;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  IF length(v_name) < 1 OR length(v_name) > 80 THEN RAISE EXCEPTION 'invalid_name' USING ERRCODE = '22023'; END IF;
  IF p_description IS NOT NULL AND length(p_description) > 500 THEN RAISE EXCEPTION 'invalid_description' USING ERRCODE = '22023'; END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.collections (user_id, name, slug, description, icon_emoji, icon_url, cover_url, position)
    VALUES (
      v_uid, v_name, public.collection_unique_slug(v_uid, v_name),
      nullif(trim(coalesce(p_description, '')), ''), nullif(p_icon_emoji, ''), nullif(p_icon_url, ''), nullif(p_cover_url, ''),
      coalesce((SELECT max(position) + 1 FROM public.collections WHERE user_id = v_uid), 0)
    )
    RETURNING * INTO v_row;
  ELSE
    -- The slug stays put on rename so shared links keep working.
    UPDATE public.collections
    SET name = v_name,
        description = nullif(trim(coalesce(p_description, '')), ''),
        icon_emoji = nullif(p_icon_emoji, ''),
        icon_url = nullif(p_icon_url, ''),
        cover_url = nullif(p_cover_url, '')
    WHERE id = p_id AND user_id = v_uid
    RETURNING * INTO v_row;
    IF v_row.id IS NULL THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_collection(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.collections WHERE id = p_id AND user_id = v_uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_found' USING ERRCODE = 'P0002'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_collections(p_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  UPDATE public.collections c
  SET position = o.ord - 1
  FROM unnest(p_ids) WITH ORDINALITY AS o(id, ord)
  WHERE c.id = o.id AND c.user_id = v_uid;
END;
$$;

-- Replace a post's memberships (composer, edit, "Add to collection" sheet).
CREATE OR REPLACE FUNCTION public.set_post_collections(p_post_id uuid, p_collection_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = p_post_id AND p.author_id = v_uid) THEN
    RAISE EXCEPTION 'not_your_post' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM unnest(p_collection_ids) AS x(id) LEFT JOIN public.collections c ON c.id = x.id
             WHERE c.id IS NULL OR c.user_id <> v_uid) THEN
    RAISE EXCEPTION 'not_your_collection' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.collection_posts cp
  WHERE cp.post_id = p_post_id AND NOT (cp.collection_id = ANY (coalesce(p_collection_ids, '{}')));

  INSERT INTO public.collection_posts (collection_id, post_id, position)
  SELECT x.id, p_post_id,
         coalesce((SELECT max(position) + 1 FROM public.collection_posts WHERE collection_id = x.id), 0)
  FROM unnest(coalesce(p_collection_ids, '{}')) AS x(id)
  ON CONFLICT DO NOTHING;
END;
$$;

-- Append works to a collection (the "Add works" sheet).
CREATE OR REPLACE FUNCTION public.add_posts_to_collection(p_collection_id uuid, p_post_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_next int;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.collections c WHERE c.id = p_collection_id AND c.user_id = v_uid) THEN
    RAISE EXCEPTION 'not_your_collection' USING ERRCODE = '42501';
  END IF;
  SELECT coalesce(max(position) + 1, 0) INTO v_next FROM public.collection_posts WHERE collection_id = p_collection_id;
  INSERT INTO public.collection_posts (collection_id, post_id, position)
  SELECT p_collection_id, x.id, v_next + x.ord - 1
  FROM unnest(p_post_ids) WITH ORDINALITY AS x(id, ord)
  JOIN public.posts p ON p.id = x.id AND p.author_id = v_uid
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_post_from_collection(p_collection_id uuid, p_post_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  DELETE FROM public.collection_posts cp
  USING public.collections c
  WHERE cp.collection_id = p_collection_id AND cp.post_id = p_post_id
    AND c.id = cp.collection_id AND c.user_id = v_uid;
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_collection_posts(p_collection_id uuid, p_post_ids uuid[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_signed_in' USING ERRCODE = '42501'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.collections c WHERE c.id = p_collection_id AND c.user_id = v_uid) THEN
    RAISE EXCEPTION 'not_your_collection' USING ERRCODE = '42501';
  END IF;
  UPDATE public.collection_posts cp
  SET position = o.ord - 1
  FROM unnest(p_post_ids) WITH ORDINALITY AS o(id, ord)
  WHERE cp.collection_id = p_collection_id AND cp.post_id = o.id;
END;
$$;

-- ---------------------------------------------------------------- reads
-- The studio shelf in one round trip: every collection of a user with the
-- count of works the caller may see, a per-type tally, and up to three
-- previews (first image, or a text excerpt) in shelf order.
CREATE OR REPLACE FUNCTION public.get_studio_collections(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH visible AS (
    SELECT cp.collection_id, cp.post_id, cp.position, p.type, p.title, p.content
    FROM public.collection_posts cp
    JOIN public.collections c ON c.id = cp.collection_id AND c.user_id = p_user_id
    JOIN public.posts p ON p.id = cp.post_id
    WHERE public.engagement_can_view_post(cp.post_id, auth.uid())
  ),
  previews AS (
    SELECT v.collection_id, v.position, v.post_id,
      (SELECT m.media_url FROM public.post_media m
        WHERE m.post_id = v.post_id AND m.media_type = 'image'
        ORDER BY m.position LIMIT 1) AS image_url,
      public.collection_text_preview(v.title, v.content) AS text
    FROM visible v
  )
  SELECT coalesce(jsonb_agg(row ORDER BY (row->>'position')::int), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'user_id', c.user_id, 'name', c.name, 'slug', c.slug,
      'description', c.description, 'icon_emoji', c.icon_emoji, 'icon_url', c.icon_url,
      'cover_url', c.cover_url, 'position', c.position,
      'created_at', c.created_at, 'updated_at', c.updated_at,
      'works_count', (SELECT count(*) FROM visible v WHERE v.collection_id = c.id),
      'type_counts', coalesce((SELECT jsonb_object_agg(t.type, t.n)
                               FROM (SELECT v.type, count(*) AS n FROM visible v WHERE v.collection_id = c.id GROUP BY v.type) t), '{}'::jsonb),
      'previews', coalesce((SELECT jsonb_agg(jsonb_build_object(
                              'post_id', pv.post_id,
                              'kind', CASE WHEN pv.image_url IS NOT NULL THEN 'image' ELSE 'text' END,
                              'src', pv.image_url,
                              'text', pv.text) ORDER BY pv.position)
                            FROM (SELECT * FROM previews WHERE collection_id = c.id ORDER BY position LIMIT 3) pv), '[]'::jsonb)
    ) AS row
    FROM public.collections c
    WHERE c.user_id = p_user_id
  ) rows;
$$;

-- The collections a post sits in (the "Part of …" line).
CREATE OR REPLACE FUNCTION public.get_post_collections(p_post_id uuid)
RETURNS TABLE (id uuid, name text, slug text, username text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.slug, pr.username
  FROM public.collection_posts cp
  JOIN public.collections c ON c.id = cp.collection_id
  JOIN public.profiles pr ON pr.id = c.user_id
  WHERE cp.post_id = p_post_id
    AND public.engagement_can_view_post(p_post_id, auth.uid())
  ORDER BY c.position;
$$;

-- ---------------------------------------------------------------- grants
REVOKE ALL ON FUNCTION public.collection_unique_slug(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.collection_text_preview(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_collection(text, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.delete_collection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_collections(uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_post_collections(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_posts_to_collection(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.remove_post_from_collection(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reorder_collection_posts(uuid, uuid[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_studio_collections(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_post_collections(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.collection_text_preview(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_collection(text, uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_collection(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_collections(uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_post_collections(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_posts_to_collection(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_post_from_collection(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_collection_posts(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_studio_collections(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_post_collections(uuid) TO anon, authenticated;
