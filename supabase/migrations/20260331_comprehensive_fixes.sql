-- NOTE (2026-09-02, docs/commissions/03-progress.md Phase 1a): this file was NEVER
-- APPLIED TO PRODUCTION and is superseded. The live schema is reconciled by
-- 20260902_commissions_phase1a_reconcile_schema.sql; any change still wanted from
-- here must be re-issued as a new migration. Do not apply this file.

-- Comprehensive fixes migration
-- Created: 2026-03-31
-- Description: Missing indexes, FK cascade fixes, race condition fixes,
--              promo code audit trail, order amount constraints.

-- ============================================
-- 1. MISSING INDEXES
-- ============================================

-- Buyer/seller dashboard queries: sort by creation date
CREATE INDEX IF NOT EXISTS idx_orders_buyer_created
  ON orders(buyer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_seller_created
  ON orders(seller_id, created_at DESC);

-- Community chat: message lookups by thread + sender (used for sender-role joins)
CREATE INDEX IF NOT EXISTS idx_community_chat_messages_thread_sender
  ON community_chat_messages(thread_id, sender_id);

-- Messages: conversation ordering and unread-badge queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages(conversation_id, is_read)
  WHERE is_read = false;

-- ============================================
-- 2. FIX product_purchases.product_id ON DELETE CASCADE
--    The original migration has no ON DELETE behavior,
--    which blocks product deletions when purchases exist.
-- ============================================

ALTER TABLE product_purchases
  DROP CONSTRAINT IF EXISTS product_purchases_product_id_fkey;

ALTER TABLE product_purchases
  ADD CONSTRAINT product_purchases_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE;

-- ============================================
-- 3. FIX sound use_count race condition
--    The existing trigger already uses the atomic pattern
--    (use_count = use_count + 1) so it is safe under concurrent
--    inserts. However, it does not handle the UPDATE case:
--    when a take changes its sound_id, the old sound's count
--    must be decremented and the new sound's count incremented.
--    It also does not decrement when a take is deleted.
-- ============================================

CREATE OR REPLACE FUNCTION increment_sound_use_count()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE: decrement old sound
  IF TG_OP = 'DELETE' THEN
    IF OLD.sound_id IS NOT NULL THEN
      UPDATE sounds
      SET use_count = GREATEST(use_count - 1, 0)
      WHERE id = OLD.sound_id;
    END IF;
    RETURN OLD;
  END IF;

  -- Handle UPDATE: decrement old, increment new (if changed)
  IF TG_OP = 'UPDATE' THEN
    IF OLD.sound_id IS DISTINCT FROM NEW.sound_id THEN
      IF OLD.sound_id IS NOT NULL THEN
        UPDATE sounds
        SET use_count = GREATEST(use_count - 1, 0)
        WHERE id = OLD.sound_id;
      END IF;
      IF NEW.sound_id IS NOT NULL THEN
        UPDATE sounds
        SET use_count = use_count + 1
        WHERE id = NEW.sound_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Handle INSERT: increment new sound
  IF NEW.sound_id IS NOT NULL THEN
    UPDATE sounds
    SET use_count = use_count + 1
    WHERE id = NEW.sound_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create trigger to cover INSERT, UPDATE, and DELETE
DROP TRIGGER IF EXISTS on_take_uses_sound ON takes;
CREATE TRIGGER on_take_uses_sound
  AFTER INSERT OR UPDATE OF sound_id OR DELETE ON takes
  FOR EACH ROW
  EXECUTE FUNCTION increment_sound_use_count();

-- ============================================
-- 4. PROMO CODE AUDIT TABLE
--    Immutable log of all promo applications.
--    Unlike promo_code_redemptions (which can be
--    DELETEd when a promo is removed from an order),
--    audit rows are permanent.
-- ============================================

CREATE TABLE IF NOT EXISTS promo_code_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
  user_id UUID NOT NULL REFERENCES profiles(id),
  order_id UUID NOT NULL REFERENCES orders(id),
  action TEXT NOT NULL CHECK (action IN ('applied', 'removed', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_audit_code_user
  ON promo_code_audit(promo_code_id, user_id);

CREATE INDEX IF NOT EXISTS idx_promo_audit_order
  ON promo_code_audit(order_id);

ALTER TABLE promo_code_audit ENABLE ROW LEVEL SECURITY;

-- Only SECURITY DEFINER functions interact with this table;
-- no direct user access needed.

-- ============================================
-- 5. HARDEN validate_promo_code PER-USER LIMIT
--    Count completed redemptions from promo_code_audit
--    (immutable) rather than promo_code_redemptions
--    (which can be deleted). Falls back to the
--    redemptions table count when no audit rows exist
--    (backward compat with pre-audit orders).
-- ============================================

CREATE OR REPLACE FUNCTION validate_promo_code(
  p_code TEXT,
  p_amount NUMERIC,
  p_listing_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_code, '')));
  v_listing_type TEXT := LOWER(COALESCE(NULLIF(TRIM(p_listing_type), ''), ''));
  v_promo promo_codes%ROWTYPE;
  v_discount NUMERIC(10,2);
  v_final NUMERIC(10,2);
  v_total_redemptions INTEGER := 0;
  v_user_redemptions INTEGER := 0;
  v_audit_user_count INTEGER := 0;
  v_redemption_user_count INTEGER := 0;
BEGIN
  IF v_code = '' THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code is required');
  END IF;

  IF p_amount IS NULL OR p_amount < 0 THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid amount');
  END IF;

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE code = v_code
    AND is_active = TRUE
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code not found');
  END IF;

  IF v_promo.starts_at IS NOT NULL AND v_promo.starts_at > NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code is not active yet');
  END IF;

  IF v_promo.expires_at IS NOT NULL AND v_promo.expires_at < NOW() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code has expired');
  END IF;

  IF v_promo.applicable_listing_type <> 'all' THEN
    IF v_listing_type = '' OR v_listing_type <> v_promo.applicable_listing_type THEN
      RETURN jsonb_build_object('valid', false, 'error', 'Promo code is not valid for this listing type');
    END IF;
  END IF;

  IF p_amount < v_promo.minimum_amount THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Order amount does not meet minimum for this promo code');
  END IF;

  -- Global redemption limit: count from redemptions table (still the source of truth for active promos)
  SELECT COUNT(*) INTO v_total_redemptions
  FROM promo_code_redemptions
  WHERE promo_code_id = v_promo.id;

  IF v_promo.max_redemptions IS NOT NULL AND v_total_redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code redemption limit reached');
  END IF;

  -- Per-user limit: use the GREATER of audit-based count and redemption-based count.
  -- The audit table is immutable (rows survive promo removal), so it prevents
  -- the apply-remove-reapply bypass. We take the max to handle both
  -- pre-audit orders (only in redemptions) and post-audit orders (in both).
  IF auth.uid() IS NOT NULL THEN
    SELECT COUNT(*) INTO v_audit_user_count
    FROM promo_code_audit
    WHERE promo_code_id = v_promo.id
      AND user_id = auth.uid()
      AND action = 'applied';

    SELECT COUNT(*) INTO v_redemption_user_count
    FROM promo_code_redemptions
    WHERE promo_code_id = v_promo.id
      AND user_id = auth.uid();

    v_user_redemptions := GREATEST(v_audit_user_count, v_redemption_user_count);

    IF v_user_redemptions >= v_promo.per_user_limit THEN
      RETURN jsonb_build_object('valid', false, 'error', 'You have already used this promo code the maximum number of times');
    END IF;
  END IF;

  IF v_promo.discount_type = 'percentage' THEN
    v_discount := ROUND((p_amount * (v_promo.discount_value / 100.0))::NUMERIC, 2);
  ELSE
    v_discount := LEAST(ROUND(v_promo.discount_value::NUMERIC, 2), ROUND(p_amount::NUMERIC, 2));
  END IF;

  v_discount := LEAST(v_discount, ROUND(p_amount::NUMERIC, 2));
  v_final := ROUND(GREATEST(p_amount - v_discount, 0)::NUMERIC, 2);

  RETURN jsonb_build_object(
    'valid', true,
    'promo_code_id', v_promo.id,
    'code', v_promo.code,
    'discount_type', v_promo.discount_type,
    'discount_value', v_promo.discount_value,
    'discount_amount', v_discount,
    'final_amount', v_final
  );
END;
$$;

-- ============================================
-- 6. UPDATE apply_promo_to_order TO WRITE AUDIT
-- ============================================

CREATE OR REPLACE FUNCTION apply_promo_to_order(
  p_order_id UUID,
  p_promo_code_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_validation JSONB;
  v_discount NUMERIC(10,2);
  v_final NUMERIC(10,2);
  v_amount NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;

  IF v_order.buyer_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;

  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be applied before payment');
  END IF;

  SELECT * INTO v_promo
  FROM promo_codes
  WHERE id = p_promo_code_id
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code not found');
  END IF;

  v_amount := COALESCE(v_order.original_amount, v_order.amount);

  v_validation := validate_promo_code(v_promo.code, v_amount, v_order.listing_type);
  IF (v_validation->>'valid')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', COALESCE(v_validation->>'error', 'Promo code is not valid')
    );
  END IF;

  v_discount := COALESCE((v_validation->>'discount_amount')::NUMERIC, 0);
  v_final := COALESCE((v_validation->>'final_amount')::NUMERIC, v_amount);

  UPDATE orders
  SET
    original_amount = v_amount,
    discount_amount = v_discount,
    amount = v_final,
    promo_code_id = v_promo.id,
    updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE promo_code_redemptions
  SET
    promo_code_id = v_promo.id,
    user_id = auth.uid(),
    discount_amount = v_discount,
    created_at = NOW()
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    INSERT INTO promo_code_redemptions (promo_code_id, order_id, user_id, discount_amount)
    VALUES (v_promo.id, p_order_id, auth.uid(), v_discount);
  END IF;

  -- Write immutable audit record
  INSERT INTO promo_code_audit (promo_code_id, user_id, order_id, action)
  VALUES (v_promo.id, auth.uid(), p_order_id, 'applied');

  RETURN jsonb_build_object(
    'success', true,
    'discount_amount', v_discount,
    'final_amount', v_final,
    'original_amount', v_amount
  );
END;
$$;

-- ============================================
-- 7. UPDATE remove_promo_from_order TO WRITE AUDIT
-- ============================================

CREATE OR REPLACE FUNCTION remove_promo_from_order(
  p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_original NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

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

  -- Write immutable audit record for removal (if a promo was applied)
  IF v_order.promo_code_id IS NOT NULL THEN
    INSERT INTO promo_code_audit (promo_code_id, user_id, order_id, action)
    VALUES (v_order.promo_code_id, auth.uid(), p_order_id, 'removed');
  END IF;

  UPDATE orders
  SET
    amount = v_original,
    discount_amount = 0,
    promo_code_id = NULL,
    updated_at = NOW()
  WHERE id = p_order_id;

  DELETE FROM promo_code_redemptions
  WHERE order_id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'discount_amount', 0,
    'final_amount', v_original,
    'original_amount', v_original
  );
END;
$$;

-- ============================================
-- 8. ORDER AMOUNT CONSTRAINTS
--    Prevent nonsensical financial values.
-- ============================================

-- Drop if they somehow exist from a partial run
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_amount_max;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_amount_non_negative;
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_discount_valid;

ALTER TABLE orders
  ADD CONSTRAINT orders_amount_non_negative
  CHECK (amount >= 0);

ALTER TABLE orders
  ADD CONSTRAINT orders_amount_max
  CHECK (amount <= 999999.99);

-- discount_amount must be non-negative and cannot exceed original_amount
-- (original_amount can be NULL for legacy rows, so guard with COALESCE)
ALTER TABLE orders
  ADD CONSTRAINT orders_discount_valid
  CHECK (
    COALESCE(discount_amount, 0) >= 0
    AND COALESCE(discount_amount, 0) <= COALESCE(original_amount, amount) + 0.01
  );

-- ============================================
-- 9. GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_promo_to_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_promo_from_order(UUID) TO authenticated;
