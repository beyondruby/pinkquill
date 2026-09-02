-- Commissions rebuild — Phase 1a: schema truth (docs/commissions/02-plan.md).
--
-- Root cause closed: RC-A5 (repo ≠ production; CHECK constraints reject values
-- the code writes; dead triggers/overloads; cron RPC aborts).
--
-- 1. Snapshot every live-only object into the repo so a fresh database built
--    from supabase/migrations matches production (columns, indexes, tables,
--    trigger functions, triggers).
-- 2. Align CHECK constraints with the status vocabulary the code writes.
-- 3. Fix auto_complete_orders (NOT NULL sender_id) and restore stock on expiry.
-- 4. remove_promo_from_order recomputes platform_fee / seller_amount.
-- 5. Row locks + listing_type checks on the transition RPCs.
-- 6. Drop dead objects.
--
-- Not in this phase (1d): cancel-from-paid without refund; escrow release.
-- Idempotent.

-- ===========================================================================
-- 1. Live-only columns, indexes, tables
-- ===========================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS checkout_session_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_id TEXT,
  ADD COLUMN IF NOT EXISTS transfer_status TEXT,
  ADD COLUMN IF NOT EXISTS transfer_amount INTEGER;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_orders_checkout_session
  ON public.orders (checkout_session_id) WHERE checkout_session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_transfer_status
  ON public.orders (transfer_status) WHERE transfer_status IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent
  ON public.orders (payment_intent_id) WHERE payment_intent_id IS NOT NULL;

-- Legacy star-review table and seller_stats cache (live only; retired in 4c).
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  communication_rating INTEGER CHECK (communication_rating >= 1 AND communication_rating <= 5),
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  value_rating INTEGER CHECK (value_rating >= 1 AND value_rating <= 5),
  content TEXT,
  is_public BOOLEAN DEFAULT true,
  is_revealed BOOLEAN DEFAULT false,
  seller_response TEXT,
  seller_responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (order_id, reviewer_id)
);
CREATE INDEX IF NOT EXISTS idx_reviews_created ON public.reviews (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_order ON public.reviews (order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews (reviewee_id, rating);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON public.reviews (reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_public ON public.reviews (reviewee_id, is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON public.reviews (reviewer_id);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Reviews are readable" ON public.reviews;
CREATE POLICY "Reviews are readable" ON public.reviews FOR SELECT USING (
  reviewer_id = (SELECT auth.uid()) OR reviewee_id = (SELECT auth.uid())
  OR (is_public = true AND is_revealed = true)
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.reviews FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.seller_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_orders INTEGER DEFAULT 0,
  completed_orders INTEGER DEFAULT 0,
  total_reviews INTEGER DEFAULT 0,
  avg_rating NUMERIC DEFAULT 0,
  completion_rate NUMERIC DEFAULT 0,
  repeat_buyer_rate NUMERIC DEFAULT 0,
  avg_response_time_hours INTEGER DEFAULT 0,
  seller_level TEXT DEFAULT 'new' CHECK (seller_level IN ('new', 'rising', 'established', 'top', 'pro')),
  member_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.seller_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view seller stats" ON public.seller_stats;
CREATE POLICY "Anyone can view seller stats" ON public.seller_stats FOR SELECT USING (true);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.seller_stats FROM anon, authenticated;

-- Private bucket for order deliveries / message attachments (live only).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('order-files', 'order-files', false, 104857600)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 104857600;

-- ===========================================================================
-- 2. Constraints aligned with what the code writes
-- ===========================================================================
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_status_check CHECK (status = ANY (ARRAY[
  'pending_acceptance', 'declined', 'pending_payment', 'expired', 'paid', 'in_progress',
  'submitted', 'revision_requested', 'completed', 'processing', 'shipped', 'delivered',
  'cancelled', 'refund_requested', 'refunded', 'disputed', 'resolved'
]));

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (payment_status = ANY (ARRAY[
  'pending', 'authorized', 'paid', 'refunded', 'partially_refunded', 'failed', 'expired'
]));

ALTER TABLE public.orders ALTER COLUMN payment_provider SET DEFAULT 'stripe';

ALTER TABLE public.order_events DROP CONSTRAINT IF EXISTS order_events_event_type_check;
ALTER TABLE public.order_events ADD CONSTRAINT order_events_event_type_check CHECK (event_type = ANY (ARRAY[
  'status_change', 'payment', 'message', 'revision', 'dispute', 'system',
  'amount_mismatch', 'transfer_failed'
]));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE public.transactions ADD CONSTRAINT transactions_status_check CHECK (status = ANY (ARRAY[
  'pending', 'completed', 'failed', 'refunded', 'reversal_failed'
]));

DO $$
DECLARE
  v_def TEXT;
  v_types TEXT[];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';
  IF v_def IS NOT NULL AND v_def NOT LIKE '%order_transfer_failed%' THEN
    -- Rebuild the list from the existing definition plus the two missing types.
    SELECT array_agg(m[1]) INTO v_types
    FROM regexp_matches(v_def, '''([a-z_]+)''::text', 'g') AS m;
    v_types := v_types || ARRAY['order_transfer_failed', 'order_expired'];
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format(
      'ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[%s]::text[]))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_types) AS t)
    );
  END IF;
END $$;

-- ===========================================================================
-- 3. Live-only trigger functions and triggers (snapshot)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.create_order_notification(
  p_user_id UUID, p_actor_id UUID, p_type TEXT, p_order_id UUID, p_content TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Don't notify yourself
  IF p_user_id = p_actor_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO notifications (user_id, actor_id, type, order_id, content)
  VALUES (p_user_id, p_actor_id, p_type, p_order_id, p_content)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_order_notification(UUID, UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_order_notification(UUID, UUID, TEXT, UUID, TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_order_created() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_product_title TEXT;
BEGIN
  -- Only notify the seller if the order requires their approval first.
  -- For normal orders (pending_payment), the seller is notified when
  -- payment succeeds via the notify_order_status_change trigger.
  IF NEW.status = 'pending_acceptance' THEN
    SELECT title INTO v_product_title FROM products WHERE id = NEW.product_id;

    PERFORM create_order_notification(
      NEW.seller_id,
      NEW.buyer_id,
      'order_pending_acceptance',
      NEW.id,
      'New order awaiting your approval: ' || COALESCE(v_product_title, 'a listing')
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_order_message() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_buyer_id UUID;
  v_seller_id UUID;
  v_recipient UUID;
  v_product_title TEXT;
BEGIN
  -- Skip system messages
  IF NEW.message_type = 'system' THEN
    RETURN NEW;
  END IF;

  SELECT o.buyer_id, o.seller_id, p.title
  INTO v_buyer_id, v_seller_id, v_product_title
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.id = NEW.order_id;

  -- Determine recipient (the other party)
  IF NEW.sender_id = v_buyer_id THEN
    v_recipient := v_seller_id;
  ELSE
    v_recipient := v_buyer_id;
  END IF;

  PERFORM create_order_notification(
    v_recipient,
    NEW.sender_id,
    'order_message',
    NEW.order_id,
    'New message in order: ' || COALESCE(v_product_title, 'your order')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_review_submitted() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_order_id UUID;
  v_product_title TEXT;
BEGIN
  SELECT o.id, p.title
  INTO v_order_id, v_product_title
  FROM orders o
  LEFT JOIN products p ON o.product_id = p.id
  WHERE o.id = NEW.order_id;

  PERFORM create_order_notification(
    NEW.reviewee_id,
    NEW.reviewer_id,
    'review_received',
    v_order_id,
    'New review received for ' || COALESCE(v_product_title, 'your order')
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_auto_completion_deadline() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  -- When order moves to submitted or delivered, set 3-day deadline
  IF NEW.status IN ('submitted', 'delivered') AND OLD.status != NEW.status THEN
    NEW.auto_completion_at := NOW() + INTERVAL '3 days';
  END IF;

  -- Clear deadline when buyer acts (completes, revises, disputes, etc.)
  IF NEW.status IN ('completed', 'revision_requested', 'disputed', 'cancelled', 'refunded', 'refund_requested')
     AND OLD.status != NEW.status THEN
    NEW.auto_completion_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_transfer_completed(
  p_order_id UUID, p_transfer_id TEXT, p_transfer_amount INTEGER, p_source TEXT DEFAULT 'api'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.transfer_id IS NOT NULL THEN
    RETURN jsonb_build_object('already_processed', true, 'order_id', v_order.id, 'transfer_id', v_order.transfer_id);
  END IF;

  UPDATE orders
  SET transfer_id = p_transfer_id,
      transfer_status = 'completed',
      transfer_amount = p_transfer_amount,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE transactions
  SET status = 'completed',
      metadata = metadata || jsonb_build_object('transfer_id', p_transfer_id, 'source', p_source)
  WHERE order_id = p_order_id AND type = 'seller_payout' AND status = 'pending';

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (p_order_id, v_order.seller_id, 'payment',
    jsonb_build_object('action', 'seller_transfer_completed', 'transfer_id', p_transfer_id,
                       'transfer_amount', p_transfer_amount, 'source', p_source));

  RETURN jsonb_build_object('already_processed', false, 'order_id', p_order_id,
                            'transfer_id', p_transfer_id, 'transfer_amount', p_transfer_amount);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.mark_order_transfer_completed(UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.mark_order_transfer_completed(UUID, TEXT, INTEGER, TEXT) TO service_role;

DROP TRIGGER IF EXISTS trg_order_created_notification ON public.orders;
CREATE TRIGGER trg_order_created_notification
  AFTER INSERT ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_created();

DROP TRIGGER IF EXISTS trg_order_status_notification ON public.orders;
CREATE TRIGGER trg_order_status_notification
  AFTER UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.notify_order_status_change();

DROP TRIGGER IF EXISTS trg_set_auto_completion_deadline ON public.orders;
CREATE TRIGGER trg_set_auto_completion_deadline
  BEFORE UPDATE OF status ON public.orders FOR EACH ROW EXECUTE FUNCTION public.set_auto_completion_deadline();

DROP TRIGGER IF EXISTS trg_order_message_notification ON public.order_messages;
CREATE TRIGGER trg_order_message_notification
  AFTER INSERT ON public.order_messages FOR EACH ROW EXECUTE FUNCTION public.notify_order_message();

DROP TRIGGER IF EXISTS trg_review_notification ON public.reviews;
CREATE TRIGGER trg_review_notification
  AFTER INSERT ON public.reviews FOR EACH ROW EXECUTE FUNCTION public.notify_review_submitted();

-- ===========================================================================
-- 4. Stock restore now also covers expiry; cron RPC fixed
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.restore_order_stock_on_early_exit() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF
    OLD.listing_type = 'product'
    AND OLD.pricing_id IS NOT NULL
    AND COALESCE(OLD.quantity, 1) > 0
    AND OLD.status IN ('pending_acceptance', 'pending_payment')
    AND NEW.status IN ('declined', 'cancelled', 'expired')
    AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    UPDATE product_pricing
    SET stock = stock + COALESCE(OLD.quantity, 1)
    WHERE id = OLD.pricing_id AND stock IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_complete_orders() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_count INTEGER := 0;
  v_order RECORD;
BEGIN
  FOR v_order IN
    SELECT id, buyer_id, seller_id, status, listing_type
    FROM orders
    WHERE auto_completion_at IS NOT NULL
      AND auto_completion_at <= NOW()
      AND status IN ('submitted', 'delivered')
    FOR UPDATE SKIP LOCKED
  LOOP
    UPDATE orders SET
      status = 'completed',
      completed_at = NOW(),
      auto_completion_at = NULL,
      updated_at = NOW()
    WHERE id = v_order.id;

    INSERT INTO order_events (order_id, event_type, from_status, to_status, metadata)
    VALUES (v_order.id, 'status_change', v_order.status, 'completed',
      jsonb_build_object('auto_completed', true));

    -- sender_id is NOT NULL; attribute the system message to the buyer whose
    -- inaction triggered it (the live body omitted it and aborted every run).
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (v_order.id, v_order.buyer_id,
      'Order was automatically completed (buyer did not respond within the deadline)', 'system');

    PERFORM create_order_notification(
      v_order.buyer_id, v_order.seller_id, 'order_completed', v_order.id,
      'Your order has been automatically completed'
    );
    PERFORM create_order_notification(
      v_order.seller_id, v_order.buyer_id, 'order_completed', v_order.id,
      'Order has been automatically completed'
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.auto_complete_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_complete_orders() TO service_role;

-- ===========================================================================
-- 5. remove_promo_from_order recomputes fee on the same base as apply_promo
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.remove_promo_from_order(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_original NUMERIC(10,2);
  v_fee_base NUMERIC(10,2);
  v_platform_fee NUMERIC(10,2);
  v_seller_amount NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF v_order.buyer_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be removed before payment');
  END IF;

  v_original := COALESCE(v_order.original_amount, v_order.amount);
  -- Same base as apply_promo_to_order / create_marketplace_order: 5% of the
  -- goods/service amount, shipping passed through.
  v_fee_base := GREATEST(v_original - COALESCE(v_order.shipping_cost, 0), 0);
  v_platform_fee := ROUND((v_fee_base * 0.05)::NUMERIC, 2);
  v_seller_amount := ROUND((v_original - v_platform_fee)::NUMERIC, 2);

  UPDATE orders
  SET amount = v_original,
      discount_amount = 0,
      promo_code_id = NULL,
      platform_fee = v_platform_fee,
      seller_amount = v_seller_amount,
      updated_at = NOW()
  WHERE id = p_order_id;

  DELETE FROM promo_code_redemptions WHERE order_id = p_order_id;

  RETURN jsonb_build_object('success', true, 'discount_amount', 0,
                            'final_amount', v_original, 'original_amount', v_original);
END;
$$;

-- ===========================================================================
-- 6. Transition RPCs: row locks + listing_type checks
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.update_order_as_buyer(
  p_order_id UUID, p_status TEXT, p_cancel_reason TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders; v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

  CASE p_status
    WHEN 'completed' THEN
      IF v_order.status NOT IN ('submitted', 'delivered') THEN
        RAISE EXCEPTION 'Cannot complete from status: %', v_order.status;
      END IF;
    WHEN 'revision_requested' THEN
      IF v_order.listing_type <> 'service' THEN
        RAISE EXCEPTION 'Revisions only apply to commission orders';
      END IF;
      IF v_order.status != 'submitted' THEN
        RAISE EXCEPTION 'Cannot request revision from status: %', v_order.status;
      END IF;
      IF v_order.max_revisions IS NOT NULL AND v_order.revision_count >= v_order.max_revisions THEN
        RAISE EXCEPTION 'Maximum revisions reached (%)', v_order.max_revisions;
      END IF;
    WHEN 'cancelled' THEN
      -- NOTE (Phase 1d): cancelling a paid order must become a refund, not a
      -- status flip. Kept as-is here so 1a stays a pure schema phase.
      IF v_order.status NOT IN ('pending_payment', 'paid') THEN
        RAISE EXCEPTION 'Cannot cancel from status: %', v_order.status;
      END IF;
    ELSE RAISE EXCEPTION 'Invalid buyer status: %', p_status;
  END CASE;

  UPDATE orders SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    revision_count = CASE WHEN p_status = 'revision_requested' THEN revision_count + 1 ELSE revision_count END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE cancelled_by END,
    cancel_reason = CASE WHEN p_status = 'cancelled' THEN p_cancel_reason ELSE cancel_reason END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(),
    CASE p_status
      WHEN 'completed' THEN 'Buyer accepted the delivery — order complete!'
      WHEN 'revision_requested' THEN 'Buyer requested a revision'
      WHEN 'cancelled' THEN 'Order was cancelled by the buyer' || COALESCE(' — Reason: ' || p_cancel_reason, '')
      ELSE 'Order status updated'
    END, 'system');

  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_as_seller(
  p_order_id UUID, p_status TEXT, p_tracking_number TEXT DEFAULT NULL,
  p_delivery_note TEXT DEFAULT NULL, p_delivery_assets JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders; v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF p_status IN ('in_progress', 'submitted') AND v_order.listing_type <> 'service' THEN
    RAISE EXCEPTION 'Status % only applies to commission orders', p_status;
  END IF;
  IF p_status IN ('processing', 'shipped', 'delivered') AND v_order.listing_type <> 'product' THEN
    RAISE EXCEPTION 'Status % only applies to product orders', p_status;
  END IF;

  CASE p_status
    WHEN 'in_progress' THEN
      IF v_order.status NOT IN ('paid', 'revision_requested') THEN
        RAISE EXCEPTION 'Cannot start work from status: %', v_order.status;
      END IF;
    WHEN 'submitted' THEN
      IF v_order.status != 'in_progress' THEN
        RAISE EXCEPTION 'Cannot submit from status: %', v_order.status;
      END IF;
    WHEN 'processing' THEN
      IF v_order.status != 'paid' THEN
        RAISE EXCEPTION 'Cannot process from status: %', v_order.status;
      END IF;
    WHEN 'shipped' THEN
      IF v_order.status NOT IN ('paid', 'processing') THEN
        RAISE EXCEPTION 'Cannot ship from status: %', v_order.status;
      END IF;
    WHEN 'delivered' THEN
      IF v_order.status != 'shipped' THEN
        RAISE EXCEPTION 'Cannot deliver from status: %', v_order.status;
      END IF;
    WHEN 'cancelled' THEN
      -- NOTE (Phase 1d): see update_order_as_buyer.
      IF v_order.status NOT IN ('pending_payment', 'paid') THEN
        RAISE EXCEPTION 'Cannot cancel from status: %', v_order.status;
      END IF;
    ELSE RAISE EXCEPTION 'Invalid seller status: %', p_status;
  END CASE;

  UPDATE orders SET
    status = p_status,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    delivery_note = COALESCE(p_delivery_note, delivery_note),
    delivery_assets = COALESCE(p_delivery_assets, delivery_assets),
    started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
    submitted_at = CASE WHEN p_status = 'submitted' THEN NOW() ELSE submitted_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE cancelled_by END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(),
    CASE p_status
      WHEN 'in_progress' THEN 'Seller started working on your order'
      WHEN 'submitted' THEN 'Seller submitted the delivery for review'
      WHEN 'shipped' THEN 'Order has been shipped' || COALESCE(' — Tracking: ' || p_tracking_number, '')
      WHEN 'delivered' THEN 'Order has been delivered'
      WHEN 'processing' THEN 'Order is being processed'
      WHEN 'cancelled' THEN 'Order was cancelled by the seller'
      ELSE 'Order status updated'
    END, 'system');

  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.open_dispute(p_order_id UUID, p_reason TEXT, p_description TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders;
  v_dispute disputes;
  v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller != v_order.buyer_id AND v_caller != v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Only post-payment, non-terminal orders can be disputed.
  IF v_order.status IN ('pending_acceptance', 'declined', 'pending_payment', 'expired',
                        'cancelled', 'refunded', 'disputed', 'resolved') THEN
    RAISE EXCEPTION 'Cannot dispute order with status: %', v_order.status;
  END IF;
  IF COALESCE(v_order.payment_status, '') NOT IN ('paid', 'partially_refunded') THEN
    RAISE EXCEPTION 'Cannot dispute an order that has not been paid';
  END IF;

  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status IN ('open', 'under_review', 'escalated')) THEN
    RAISE EXCEPTION 'An active dispute already exists for this order';
  END IF;

  INSERT INTO disputes (order_id, initiated_by, reason, description)
  VALUES (p_order_id, v_caller, p_reason, p_description)
  RETURNING * INTO v_dispute;

  UPDATE orders SET status = 'disputed', auto_completion_at = NULL, updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'dispute', v_order.status, 'disputed',
    jsonb_build_object('dispute_id', v_dispute.id, 'reason', p_reason));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller,
    'A dispute has been opened: ' ||
    CASE p_reason
      WHEN 'item_not_as_described' THEN 'Item not as described'
      WHEN 'item_not_received' THEN 'Item not received'
      WHEN 'quality_issue' THEN 'Quality issue'
      WHEN 'seller_unresponsive' THEN 'Seller unresponsive'
      WHEN 'buyer_unresponsive' THEN 'Buyer unresponsive'
      WHEN 'late_delivery' THEN 'Late delivery'
      WHEN 'unauthorized_charge' THEN 'Unauthorized charge'
      ELSE 'Other'
    END,
    'system');

  PERFORM create_order_notification(
    CASE WHEN v_caller = v_order.buyer_id THEN v_order.seller_id ELSE v_order.buyer_id END,
    v_caller, 'order_disputed', p_order_id, 'A dispute has been opened on your order'
  );

  RETURN to_jsonb(v_dispute);
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_order_review(
  p_order_id UUID, p_quill_score INTEGER, p_title TEXT DEFAULT NULL, p_content TEXT DEFAULT NULL,
  p_highlights TEXT[] DEFAULT '{}'::TEXT[], p_is_public BOOLEAN DEFAULT true
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_reviewer_id UUID;
  v_reviewee_id UUID;
  v_reviewer_role TEXT;
  v_reviewee_role TEXT;
  v_review_id UUID;
  v_content TEXT := trim(COALESCE(p_content, ''));
  v_title TEXT := NULLIF(trim(COALESCE(p_title, '')), '');
  v_highlights TEXT[];
  v_highlight_count INTEGER;
  v_counterpart_exists BOOLEAN := FALSE;
  v_revealed_at TIMESTAMPTZ := NULL;
  v_reveal_deadline TIMESTAMPTZ := NULL;
  c_reveal_window CONSTANT INTERVAL := INTERVAL '14 days';
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  IF p_quill_score IS NULL OR p_quill_score < 1 OR p_quill_score > 5 THEN
    RAISE EXCEPTION 'Quill score must be between 1 and 5';
  END IF;
  IF char_length(v_content) < 12 THEN
    RAISE EXCEPTION 'Review must be at least 12 characters';
  END IF;
  IF v_title IS NOT NULL AND char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'Review title cannot exceed 120 characters';
  END IF;

  -- Lock the order so two concurrent submissions serialize on the
  -- counterpart/duplicate checks below.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Reviews can only be left after an order is completed';
  END IF;
  IF v_reviewer_id <> v_order.buyer_id AND v_reviewer_id <> v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized to review this order';
  END IF;
  IF EXISTS (SELECT 1 FROM order_reviews r WHERE r.order_id = p_order_id AND r.reviewer_id = v_reviewer_id) THEN
    RAISE EXCEPTION 'You have already submitted a review for this order';
  END IF;

  IF v_reviewer_id = v_order.buyer_id THEN
    v_reviewer_role := 'buyer'; v_reviewee_role := 'seller'; v_reviewee_id := v_order.seller_id;
  ELSE
    v_reviewer_role := 'seller'; v_reviewee_role := 'buyer'; v_reviewee_id := v_order.buyer_id;
  END IF;

  IF v_order.listing_type = 'product' AND v_reviewer_role <> 'buyer' THEN
    RAISE EXCEPTION 'Only buyers can leave product reviews';
  END IF;

  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT h
      FROM (SELECT NULLIF(trim(value), '') AS h FROM unnest(COALESCE(p_highlights, '{}'::TEXT[])) AS value) cleaned
      WHERE h IS NOT NULL
      LIMIT 6
    ), '{}'::TEXT[]
  ) INTO v_highlights;

  IF v_order.listing_type = 'product' THEN
    v_revealed_at := now();
  ELSE
    v_counterpart_exists := EXISTS (
      SELECT 1 FROM order_reviews r WHERE r.order_id = p_order_id AND r.reviewer_id = v_reviewee_id
    );
    IF v_counterpart_exists THEN
      v_revealed_at := now();
    ELSE
      v_reveal_deadline := now() + c_reveal_window;
    END IF;
  END IF;

  INSERT INTO order_reviews (
    order_id, product_id, listing_type, reviewer_id, reviewee_id,
    reviewer_role, reviewee_role, quill_score, title, content, highlights,
    is_public, revealed_at, reveal_deadline
  ) VALUES (
    p_order_id, v_order.product_id, v_order.listing_type, v_reviewer_id, v_reviewee_id,
    v_reviewer_role, v_reviewee_role, p_quill_score, v_title, v_content, v_highlights,
    COALESCE(p_is_public, TRUE), v_revealed_at, v_reveal_deadline
  ) RETURNING id INTO v_review_id;

  IF v_counterpart_exists THEN
    UPDATE order_reviews SET revealed_at = now(), reveal_deadline = NULL
    WHERE order_id = p_order_id AND reviewer_id = v_reviewee_id AND revealed_at IS NULL;
  END IF;

  BEGIN
    INSERT INTO notifications (user_id, actor_id, type, order_id, content)
    VALUES (v_reviewee_id, v_reviewer_id, 'review_received', p_order_id,
            format('You received a %s-quill review.', p_quill_score));
  EXCEPTION WHEN undefined_table OR undefined_column OR check_violation THEN NULL;
  END;

  SELECT cardinality(v_highlights) INTO v_highlight_count;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (p_order_id, v_reviewer_id, 'system',
    jsonb_build_object('action', 'review_submitted', 'review_id', v_review_id,
      'reviewee_id', v_reviewee_id, 'reviewer_role', v_reviewer_role,
      'quill_score', p_quill_score, 'highlight_count', COALESCE(v_highlight_count, 0),
      'revealed', (v_revealed_at IS NOT NULL)));

  RETURN v_review_id;
END;
$$;

-- ===========================================================================
-- 7. Dead objects
-- ===========================================================================
DROP TRIGGER IF EXISTS trg_auto_complete_digital ON public.orders;
DROP FUNCTION IF EXISTS public.auto_complete_digital_order();
DROP FUNCTION IF EXISTS public.update_order_payment(TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.sync_seller_account(TEXT, BOOLEAN, BOOLEAN, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.update_purchase_as_buyer(UUID, TEXT);
DROP FUNCTION IF EXISTS public.update_purchase_as_seller(UUID, TEXT, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.submit_review(UUID, INTEGER, INTEGER, INTEGER, INTEGER, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.respond_to_review(UUID, TEXT);
DROP FUNCTION IF EXISTS public.reveal_expired_reviews();
DROP FUNCTION IF EXISTS public.recalculate_seller_stats(UUID);
DROP FUNCTION IF EXISTS public.release_order_escrow(UUID);
DROP FUNCTION IF EXISTS public.mark_order_payment_failed(UUID, TEXT, TEXT, TEXT, TEXT);
