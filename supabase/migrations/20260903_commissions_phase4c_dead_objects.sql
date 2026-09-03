-- Phase 4c — Dead objects (2026-09-03)
-- Drops what nothing reads or writes any more, after checking callers in
-- code, in other functions, in triggers and in policies:
--   tables  product_purchases (0 rows; superseded by orders), reviews (0 rows;
--           superseded by order_reviews), seller_stats (get_seller_stats computes live)
--   RPCs    get_seller_order_stats, finalize_order_escrow_release, mark_order_expired,
--           mark_order_payment_failed, mark_order_transfer_completed, request_refund,
--           generate_order_download_tokens, resolve_dispute (4-arg overload),
--           update_purchase_status_timestamp, notify_review_submitted
--   publication  orders and order_messages leave supabase_realtime: no client
--           subscribes to them since 4b (the triggers broadcast instead)
-- KEPT on purpose: `transactions` — record_payment_succeeded, mark_payout_sent,
-- record_chargeback and record_payment_refund still write compatibility rows
-- into it; removing those writes is a money-path edit and needs its own go.
-- Idempotent.

-- ===========================================================================
-- 1. Download tokens: order-only (the purchase branch served product_purchases)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.consume_download_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_row RECORD;
  v_new_used INTEGER;
  v_remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT pdt.id, pdt.downloads_used, pdt.download_limit, pdt.expires_at, pdt.order_id,
         pf.file_url, pf.file_name, o.buyer_id AS order_buyer_id, o.status AS order_status
  INTO v_row
  FROM product_download_tokens pdt
  JOIN product_files pf ON pf.id = pdt.file_id
  LEFT JOIN orders o ON o.id = pdt.order_id
  WHERE pdt.token = p_token
  FOR UPDATE OF pdt;

  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid download token'; END IF;
  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < NOW() THEN RAISE EXCEPTION 'Download token has expired'; END IF;
  IF v_row.order_id IS NULL THEN RAISE EXCEPTION 'Download token is not attached to an order'; END IF;
  IF v_row.order_buyer_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Not authorized to download this file'; END IF;
  -- Revoke access once the order is no longer a valid purchase entitlement.
  IF v_row.order_status IN ('refunded', 'refund_requested', 'cancelled', 'disputed', 'expired') THEN
    RAISE EXCEPTION 'This order is no longer eligible for downloads';
  END IF;
  IF v_row.download_limit IS NOT NULL AND v_row.downloads_used >= v_row.download_limit THEN RAISE EXCEPTION 'Download limit reached'; END IF;

  UPDATE product_download_tokens SET downloads_used = downloads_used + 1 WHERE id = v_row.id;
  v_new_used := v_row.downloads_used + 1;
  v_remaining := CASE WHEN v_row.download_limit IS NULL THEN NULL ELSE GREATEST(v_row.download_limit - v_new_used, 0) END;

  RETURN jsonb_build_object('file_url', v_row.file_url, 'file_name', v_row.file_name, 'downloads_used', v_new_used, 'downloads_remaining', v_remaining);
END;
$$;

-- The read policy still mentioned purchase_id; recreate it on orders only.
DROP POLICY IF EXISTS "Buyers can view own download tokens" ON public.product_download_tokens;
CREATE POLICY "Buyers can view own download tokens" ON public.product_download_tokens FOR SELECT
  USING (order_id IS NOT NULL AND EXISTS (SELECT 1 FROM public.orders WHERE orders.id = product_download_tokens.order_id AND orders.buyer_id = (SELECT auth.uid())));
ALTER TABLE public.product_download_tokens DROP COLUMN IF EXISTS purchase_id;

-- ===========================================================================
-- 2. Tables
-- ===========================================================================
DROP TABLE IF EXISTS public.product_purchases CASCADE;
DROP FUNCTION IF EXISTS public.update_purchase_status_timestamp();
DROP TABLE IF EXISTS public.reviews CASCADE;
DROP FUNCTION IF EXISTS public.notify_review_submitted();
DROP TABLE IF EXISTS public.seller_stats CASCADE;

-- ===========================================================================
-- 3. RPCs with no callers (code, functions, triggers, policies all checked)
-- ===========================================================================
DROP FUNCTION IF EXISTS public.get_seller_order_stats();
DROP FUNCTION IF EXISTS public.finalize_order_escrow_release(UUID, TEXT, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.mark_order_expired(UUID, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.mark_order_transfer_completed(UUID, TEXT, INTEGER, TEXT);
DROP FUNCTION IF EXISTS public.request_refund(UUID, TEXT);
DROP FUNCTION IF EXISTS public.generate_order_download_tokens(UUID);
DROP FUNCTION IF EXISTS public.resolve_dispute(UUID, TEXT, TEXT, NUMERIC);

-- ===========================================================================
-- 4. Realtime publication: order rows travel by trigger broadcast now
-- ===========================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'orders') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.orders;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'order_messages') THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.order_messages;
  END IF;
END $$;
