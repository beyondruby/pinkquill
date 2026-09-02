-- Phase 5 (docs/audit/02-plan.md): database hygiene flagged by the advisors
-- (findings L11). Invisible at 30 MB, decisive once tables grow.
--
-- 1. Duplicate indexes dropped (write amplification for nothing).
-- 2. Covering indexes for the 9 unindexed foreign keys.
-- 3. Bare auth.uid() → (select auth.uid()) on community_member_history.
-- 4. Multiple permissive policies for the same command merged into one, so
--    each row is evaluated once instead of once per policy.
--
-- Idempotent.

-- 1. duplicate indexes
DROP INDEX IF EXISTS public.idx_content_deletions_community;
DROP INDEX IF EXISTS public.idx_content_deletions_deleted_by;
DROP INDEX IF EXISTS public.idx_orders_promo_code;
DROP INDEX IF EXISTS public.idx_download_tokens_order;
DROP INDEX IF EXISTS public.idx_purchases_product;

-- 2. foreign keys without a covering index
CREATE INDEX IF NOT EXISTS idx_community_content_deletions_content_author ON public.community_content_deletions (content_author_id);
CREATE INDEX IF NOT EXISTS idx_disputes_resolved_by ON public.disputes (resolved_by);
CREATE INDEX IF NOT EXISTS idx_order_reviews_reviewer ON public.order_reviews (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_orders_cancelled_by ON public.orders (cancelled_by);
CREATE INDEX IF NOT EXISTS idx_orders_pricing_id ON public.orders (pricing_id);
CREATE INDEX IF NOT EXISTS idx_product_download_tokens_file ON public.product_download_tokens (file_id);
CREATE INDEX IF NOT EXISTS idx_product_purchases_pricing ON public.product_purchases (pricing_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON public.reports (reported_user_id);
CREATE INDEX IF NOT EXISTS idx_reports_resolved_by ON public.reports (resolved_by);

-- 3. initplan-friendly auth.uid()
DROP POLICY IF EXISTS "Community managers can read member history" ON public.community_member_history;
CREATE POLICY "Community managers can read member history" ON public.community_member_history
  FOR SELECT TO authenticated
  USING (public.is_community_manager(community_id, (SELECT auth.uid())));

-- 4. one permissive policy per command
DROP POLICY IF EXISTS "Buyers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Sellers can view own orders" ON public.orders;
DROP POLICY IF EXISTS "Participants can view orders" ON public.orders;
CREATE POLICY "Participants can view orders" ON public.orders
  FOR SELECT TO authenticated
  USING (buyer_id = (SELECT auth.uid()) OR seller_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Order participants can read private order reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Public can read public order reviews" ON public.order_reviews;
DROP POLICY IF EXISTS "Order reviews are readable" ON public.order_reviews;
CREATE POLICY "Order reviews are readable" ON public.order_reviews
  FOR SELECT
  USING (
    is_public = true
    OR (
      (SELECT auth.uid()) IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_reviews.order_id
          AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid()))
      )
    )
  );

DROP POLICY IF EXISTS "Buyers can view purchased files" ON public.product_files;
DROP POLICY IF EXISTS "Sellers can view own product files" ON public.product_files;
DROP POLICY IF EXISTS "Product files are readable" ON public.product_files;
CREATE POLICY "Product files are readable" ON public.product_files
  FOR SELECT
  USING (
    is_preview = true
    OR EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_files.product_id AND products.seller_id = (SELECT auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.product_purchases pp
      JOIN public.products p ON p.id = pp.product_id
      WHERE pp.buyer_id = (SELECT auth.uid()) AND pp.status = 'paid' AND p.id = product_files.product_id
    )
    OR EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.buyer_id = (SELECT auth.uid())
        AND o.product_id = product_files.product_id
        AND o.status <> ALL (ARRAY['cancelled','refunded','pending_payment','pending_acceptance','declined'])
    )
  );

DROP POLICY IF EXISTS "Buyers can view own purchases" ON public.product_purchases;
DROP POLICY IF EXISTS "Sellers can view purchases of their products" ON public.product_purchases;
DROP POLICY IF EXISTS "Purchase participants can view" ON public.product_purchases;
CREATE POLICY "Purchase participants can view" ON public.product_purchases
  FOR SELECT TO authenticated
  USING (
    buyer_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.products
      WHERE products.id = product_purchases.product_id AND products.seller_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Mods can view community reports" ON public.reports;
DROP POLICY IF EXISTS "Users can view own reports" ON public.reports;
DROP POLICY IF EXISTS "Reports are readable by reporter or mods" ON public.reports;
CREATE POLICY "Reports are readable by reporter or mods" ON public.reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = (SELECT auth.uid())
    OR (
      community_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.community_members
        WHERE community_members.community_id = reports.community_id
          AND community_members.user_id = (SELECT auth.uid())
          AND community_members.role = ANY (ARRAY['admin','moderator'])
          AND community_members.status = 'active'
      )
    )
  );

DROP POLICY IF EXISTS "Participants can see own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public reviews are visible to everyone" ON public.reviews;
DROP POLICY IF EXISTS "Reviews are readable" ON public.reviews;
CREATE POLICY "Reviews are readable" ON public.reviews
  FOR SELECT
  USING (
    reviewer_id = (SELECT auth.uid())
    OR reviewee_id = (SELECT auth.uid())
    OR (is_public = true AND is_revealed = true)
  );

DROP POLICY IF EXISTS "Buyers can view order transactions" ON public.transactions;
DROP POLICY IF EXISTS "Sellers can view order transactions" ON public.transactions;
DROP POLICY IF EXISTS "Order participants can view transactions" ON public.transactions;
CREATE POLICY "Order participants can view transactions" ON public.transactions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = transactions.order_id
        AND (orders.buyer_id = (SELECT auth.uid()) OR orders.seller_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can join via invitation" ON public.community_members;
DROP POLICY IF EXISTS "insert_community_members" ON public.community_members;
CREATE POLICY "insert_community_members" ON public.community_members
  FOR INSERT
  WITH CHECK (
    -- self-join a public community as a plain member
    (
      user_id = (SELECT auth.uid())
      AND role = 'member'
      AND status = 'active'
      AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_members.community_id AND c.privacy = 'public')
    )
    -- accept a pending invitation as a plain member
    OR (
      user_id = (SELECT auth.uid())
      AND role = 'member'
      AND status = 'active'
      AND public.has_pending_invitation(community_id, (SELECT auth.uid()))
    )
    -- staff adding members; only admins may add admins
    OR (
      public.is_community_admin_or_mod(community_id, (SELECT auth.uid()))
      AND (role <> 'admin' OR public.is_community_admin(community_id, (SELECT auth.uid())))
    )
  );
