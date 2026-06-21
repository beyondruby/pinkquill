-- Phase 0 / C6: order-files holds paid commission deliverables. It was a PUBLIC,
-- listable bucket, so anyone with the URL (or the anon key) could read/enumerate
-- every order's files. Make the bucket private and drop the public SELECT policy.
-- Reads now go exclusively through admin-signed URLs (/api/orders/files), which run
-- as service_role and bypass storage RLS. Upload (authenticated) + own-delete remain.
UPDATE storage.buckets SET public = false WHERE id = 'order-files';

DROP POLICY IF EXISTS "Anyone can read order files" ON storage.objects;
