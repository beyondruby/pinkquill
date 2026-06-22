-- Creative Formats / Sound feature — storage foundation.
-- 1) Allow audio items in post_media.
ALTER TABLE public.post_media DROP CONSTRAINT IF EXISTS post_media_media_type_check;
ALTER TABLE public.post_media ADD CONSTRAINT post_media_media_type_check
  CHECK (media_type = ANY (ARRAY['image'::text, 'video'::text, 'audio'::text]));

-- 2) Fresh public bucket for uploaded feed audio (Sound/Voice formats).
INSERT INTO storage.buckets (id, name, public)
VALUES ('post-audio', 'post-audio', true)
ON CONFLICT (id) DO NOTHING;

-- 3) Storage policies: public read; authenticated upload into own user-id folder;
--    users delete their own files (mirrors the post-media pattern).
DROP POLICY IF EXISTS "Public can read post audio" ON storage.objects;
CREATE POLICY "Public can read post audio" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-audio');

DROP POLICY IF EXISTS "Authenticated can upload post audio" ON storage.objects;
CREATE POLICY "Authenticated can upload post audio" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'post-audio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "Users delete own post audio" ON storage.objects;
CREATE POLICY "Users delete own post audio" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'post-audio' AND (storage.foldername(name))[1] = (SELECT auth.uid())::text);
