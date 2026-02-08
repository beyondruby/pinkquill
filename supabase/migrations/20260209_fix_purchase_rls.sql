-- Fix Purchase RLS Policies
-- Created: 2026-02-09
-- Description: Restricts overly permissive UPDATE policies on product_purchases.
-- The original policies let buyer/seller update ANY column. Now uses
-- SECURITY DEFINER functions for safe status transitions.

-- ============================================
-- DROP EXISTING OVERLY-PERMISSIVE POLICIES
-- ============================================

DROP POLICY IF EXISTS "Sellers can update purchase status" ON product_purchases;
DROP POLICY IF EXISTS "Buyers can update own commission purchases" ON product_purchases;

-- ============================================
-- SELLER STATUS TRANSITION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_purchase_as_seller(
  p_purchase_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_delivery_note TEXT DEFAULT NULL,
  p_delivery_assets JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_seller_id UUID;
  v_product_seller_id UUID;
BEGIN
  -- Get the current purchase
  SELECT pp.status, p.seller_id
  INTO v_current_status, v_product_seller_id
  FROM product_purchases pp
  JOIN products p ON p.id = pp.product_id
  WHERE pp.id = p_purchase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  -- Verify caller is the seller
  IF auth.uid() != v_product_seller_id THEN
    RAISE EXCEPTION 'Only the seller can perform this action';
  END IF;

  -- Validate status transitions for seller
  IF p_status = 'in_progress' AND v_current_status NOT IN ('paid', 'revision_requested') THEN
    RAISE EXCEPTION 'Cannot start work from status: %', v_current_status;
  END IF;

  IF p_status = 'submitted' AND v_current_status != 'in_progress' THEN
    RAISE EXCEPTION 'Cannot submit delivery from status: %', v_current_status;
  END IF;

  IF p_status = 'shipped' AND v_current_status != 'paid' THEN
    RAISE EXCEPTION 'Cannot mark as shipped from status: %', v_current_status;
  END IF;

  IF p_status = 'delivered' AND v_current_status != 'shipped' THEN
    RAISE EXCEPTION 'Cannot mark as delivered from status: %', v_current_status;
  END IF;

  -- Perform the update with only allowed fields
  UPDATE product_purchases SET
    status = p_status,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    delivery_note = COALESCE(p_delivery_note, delivery_note),
    delivery_assets = COALESCE(p_delivery_assets, delivery_assets),
    started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
    submitted_at = CASE WHEN p_status = 'submitted' THEN NOW() ELSE submitted_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END
  WHERE id = p_purchase_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- BUYER STATUS TRANSITION FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_purchase_as_buyer(
  p_purchase_id UUID,
  p_status TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_status TEXT;
  v_buyer_id UUID;
BEGIN
  -- Get the current purchase
  SELECT status, buyer_id
  INTO v_current_status, v_buyer_id
  FROM product_purchases
  WHERE id = p_purchase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  -- Verify caller is the buyer
  IF auth.uid() != v_buyer_id THEN
    RAISE EXCEPTION 'Only the buyer can perform this action';
  END IF;

  -- Validate status transitions for buyer
  IF p_status = 'completed' AND v_current_status != 'submitted' THEN
    RAISE EXCEPTION 'Cannot complete from status: %', v_current_status;
  END IF;

  IF p_status = 'revision_requested' AND v_current_status != 'submitted' THEN
    RAISE EXCEPTION 'Cannot request revision from status: %', v_current_status;
  END IF;

  IF p_status = 'cancelled' AND v_current_status NOT IN ('pending', 'paid') THEN
    RAISE EXCEPTION 'Cannot cancel from status: %', v_current_status;
  END IF;

  -- Perform the update
  UPDATE product_purchases SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    revision_count = CASE WHEN p_status = 'revision_requested' THEN revision_count + 1 ELSE revision_count END
  WHERE id = p_purchase_id;

  RETURN TRUE;
END;
$$;

-- ============================================
-- GRANT EXECUTE TO AUTHENTICATED USERS
-- ============================================

GRANT EXECUTE ON FUNCTION update_purchase_as_seller TO authenticated;
GRANT EXECUTE ON FUNCTION update_purchase_as_buyer TO authenticated;
