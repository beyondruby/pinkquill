-- Collections: subcollections (parent_id). Applied 2026-09-13.
-- Old collection_items become child collections (same ids); their post
-- links move to the child; the root duplicates the flatten migration
-- copied are removed. save_subcollection wraps save_collection.
ALTER TABLE public.collections ADD COLUMN parent_id uuid REFERENCES public.collections(id) ON DELETE CASCADE;
CREATE INDEX collections_parent_idx ON public.collections(parent_id);
ALTER TABLE public.collections ADD CONSTRAINT collections_not_own_parent CHECK (parent_id IS DISTINCT FROM id);

DO $$
DECLARE item record;
BEGIN
  FOR item IN SELECT ci.* FROM public.collection_items ci JOIN public.collections c ON c.id = ci.collection_id ORDER BY ci.position LOOP
    INSERT INTO public.collections (id, parent_id, user_id, name, slug, description, icon_emoji, cover_url, position, created_at, updated_at)
    SELECT item.id, item.collection_id, c.user_id, item.name, CASE WHEN EXISTS (SELECT 1 FROM public.collections sibling WHERE sibling.user_id = c.user_id AND sibling.slug = item.slug) THEN public.collection_unique_slug(c.user_id, item.name) ELSE item.slug END, item.description, item.icon_emoji, item.cover_url, item.position, item.created_at, item.updated_at
    FROM public.collections c WHERE c.id = item.collection_id;
  END LOOP;
END;
$$;
INSERT INTO public.collection_posts (collection_id, post_id, position, added_at)
SELECT cip.collection_item_id, cip.post_id, cip.position, cip.created_at
FROM public.collection_item_posts cip JOIN public.collections c ON c.id = cip.collection_item_id
ON CONFLICT DO NOTHING;
-- Remove only the root duplicates introduced by the flatten migration.
DELETE FROM public.collection_posts cp USING public.collection_items ci, public.collection_item_posts cip
WHERE cp.collection_id = ci.collection_id AND cip.collection_item_id = ci.id AND cp.post_id = cip.post_id;

CREATE FUNCTION public.save_subcollection(
  p_parent_id uuid, p_name text, p_id uuid DEFAULT NULL, p_description text DEFAULT NULL,
  p_icon_emoji text DEFAULT NULL, p_icon_url text DEFAULT NULL, p_cover_url text DEFAULT NULL
) RETURNS public.collections LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result public.collections;
BEGIN
  -- Lock the parent so a concurrent delete cannot orphan the new row.
  PERFORM 1 FROM public.collections WHERE id = p_parent_id AND user_id = auth.uid() AND parent_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'not_your_root_collection' USING ERRCODE = '42501'; END IF;
  IF p_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.collections WHERE id = p_id AND parent_id = p_parent_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'not_your_subcollection' USING ERRCODE = '42501';
  END IF;
  result := public.save_collection(p_name, p_id, p_description, p_icon_emoji, p_icon_url, p_cover_url);
  UPDATE public.collections SET parent_id = p_parent_id WHERE id = result.id RETURNING * INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.save_subcollection(uuid, text, uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_subcollection(uuid, text, uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_studio_collections(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH direct_visible AS (
    SELECT cp.collection_id, cp.post_id, cp.position, p.type, p.title, p.content
    FROM public.collection_posts cp
    JOIN public.collections c ON c.id = cp.collection_id AND c.user_id = p_user_id
    JOIN public.posts p ON p.id = cp.post_id
    WHERE public.engagement_can_view_post(cp.post_id, auth.uid())
  ),
  visible AS (
    SELECT DISTINCT ON (collection_id, post_id) * FROM (
      SELECT * FROM direct_visible
      UNION ALL
      SELECT c.parent_id, v.post_id, v.position, v.type, v.title, v.content
      FROM direct_visible v JOIN public.collections c ON c.id = v.collection_id
      WHERE c.parent_id IS NOT NULL
    ) all_visible ORDER BY collection_id, post_id, position
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
      'parent_id', c.parent_id, 'id', c.id, 'user_id', c.user_id, 'name', c.name, 'slug', c.slug,
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
