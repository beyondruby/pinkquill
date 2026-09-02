-- Commissions rebuild — Phase 0: stop the bleeding (docs/commissions/02-plan.md).
--
-- Root causes closed: RC-A1 (table grants never audited; forgeable INSERT
-- policies), RC-A7.1 (100%-off promo codes live and readable), and the theft
-- path of RC-A2 (forged order → cron payout).
--
-- 1. Money / order tables become read-only for anon + authenticated. Every
--    write to these tables already goes through SECURITY DEFINER RPCs or
--    service-role routes (verified: no client code inserts/updates them), so
--    nothing user-facing changes. SELECT grants are kept; RLS SELECT policies
--    still scope reads.
-- 2. Drop the four policies that let a client forge rows or read codes.
-- 3. order_messages: clients may post text/file messages only, never system
--    rows.
-- 4. order-files storage: uploads and deletes scoped to participants of the
--    order named in the path (orders/<order_id>/...), 100 MB cap.
-- 5. Deactivate the two test promo codes.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1. Table grants
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'orders', 'seller_accounts', 'transactions', 'order_events', 'disputes',
    'order_reviews', 'processed_stripe_events', 'promo_codes',
    'promo_code_redemptions', 'product_purchases', 'product_download_tokens',
    'seller_stats', 'reviews'
  ] LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.%I FROM anon, authenticated', t);
    END IF;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Forgeable / leaky policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Buyers can create orders" ON public.orders;
DROP POLICY IF EXISTS "Users can create own seller account" ON public.seller_accounts;
DROP POLICY IF EXISTS "Reviewers can update own review" ON public.order_reviews;
DROP POLICY IF EXISTS "Anyone can read active promo codes" ON public.promo_codes;

-- ---------------------------------------------------------------------------
-- 3. order_messages: participants may post text/file only
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Order participants can send messages" ON public.order_messages;
CREATE POLICY "Order participants can send messages" ON public.order_messages
  FOR INSERT WITH CHECK (
    (SELECT auth.uid()) = sender_id
    AND message_type IN ('text', 'file')
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_messages.order_id
        AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 4. order-files storage: participant-scoped, size-capped
-- ---------------------------------------------------------------------------
UPDATE storage.buckets
SET file_size_limit = 104857600
WHERE id = 'order-files';

DROP POLICY IF EXISTS "Authenticated users can upload order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own order files" ON storage.objects;
DROP POLICY IF EXISTS "Order participants can upload order files" ON storage.objects;
DROP POLICY IF EXISTS "Order participants can delete order files" ON storage.objects;

CREATE POLICY "Order participants can upload order files" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'order-files'
    AND (storage.foldername(name))[1] = 'orders'
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid()))
    )
  );

CREATE POLICY "Order participants can delete order files" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'order-files'
    AND (storage.foldername(name))[1] = 'orders'
    AND owner = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id::text = (storage.foldername(name))[2]
        AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Test promo codes off
-- ---------------------------------------------------------------------------
UPDATE public.promo_codes
SET is_active = false,
    expires_at = COALESCE(expires_at, NOW()),
    updated_at = NOW()
WHERE UPPER(code) IN ('TEST', 'TEST100');
