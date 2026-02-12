-- Marketplace alignment + approval/promotions/downloads hardening
-- Created: 2026-02-12

-- ============================================
-- SELLER ACCOUNTS: PayPal fields
-- ============================================

ALTER TABLE seller_accounts
  ADD COLUMN IF NOT EXISTS paypal_merchant_id TEXT UNIQUE;

ALTER TABLE seller_accounts
  ADD COLUMN IF NOT EXISTS paypal_email TEXT;

CREATE INDEX IF NOT EXISTS idx_seller_accounts_paypal_merchant_id
  ON seller_accounts(paypal_merchant_id)
  WHERE paypal_merchant_id IS NOT NULL;

-- ============================================
-- SELLER PROFILES (missing base table)
-- ============================================

CREATE TABLE IF NOT EXISTS seller_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  store_name TEXT NOT NULL,
  store_tagline TEXT,
  store_description TEXT,
  store_avatar_url TEXT,
  store_cover_url TEXT,
  specialties TEXT[] NOT NULL DEFAULT '{}',
  skills TEXT[] NOT NULL DEFAULT '{}',
  services TEXT[] NOT NULL DEFAULT '{}',
  experience_level TEXT CHECK (experience_level IS NULL OR experience_level IN ('beginner', 'intermediate', 'expert', 'professional')),
  response_time_hours INTEGER NOT NULL DEFAULT 24 CHECK (response_time_hours > 0),
  is_accepting_commissions BOOLEAN NOT NULL DEFAULT TRUE,
  location TEXT,
  languages TEXT[] NOT NULL DEFAULT '{}',
  require_approval BOOLEAN NOT NULL DEFAULT FALSE,
  auto_decline_hours INTEGER NOT NULL DEFAULT 72 CHECK (auto_decline_hours > 0),
  setup_completed BOOLEAN NOT NULL DEFAULT FALSE,
  setup_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seller_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_profiles'
      AND policyname = 'Users can view own seller profile'
  ) THEN
    CREATE POLICY "Users can view own seller profile" ON seller_profiles
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_profiles'
      AND policyname = 'Users can insert own seller profile'
  ) THEN
    CREATE POLICY "Users can insert own seller profile" ON seller_profiles
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_profiles'
      AND policyname = 'Users can update own seller profile'
  ) THEN
    CREATE POLICY "Users can update own seller profile" ON seller_profiles
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_seller_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seller_profile_updated_at ON seller_profiles;
CREATE TRIGGER trigger_update_seller_profile_updated_at
  BEFORE UPDATE ON seller_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_profile_updated_at();

-- ============================================
-- PROMO CODES
-- ============================================

CREATE TABLE IF NOT EXISTS promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
  discount_value NUMERIC(10,2) NOT NULL CHECK (discount_value >= 0),
  applicable_listing_type TEXT NOT NULL DEFAULT 'all' CHECK (applicable_listing_type IN ('all', 'product', 'service')),
  minimum_amount NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (minimum_amount >= 0),
  max_redemptions INTEGER CHECK (max_redemptions IS NULL OR max_redemptions > 0),
  per_user_limit INTEGER NOT NULL DEFAULT 1 CHECK (per_user_limit > 0),
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS promo_code_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id) ON DELETE CASCADE,
  order_id UUID NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  discount_amount NUMERIC(10,2) NOT NULL CHECK (discount_amount >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Backward-compatible shape alignment for projects that already created promo tables manually.
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS discount_type TEXT;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(10,2);
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS applicable_listing_type TEXT DEFAULT 'all';
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS minimum_amount NUMERIC(10,2) DEFAULT 0;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS max_redemptions INTEGER;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT 1;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE promo_codes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE promo_code_redemptions
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id) ON DELETE CASCADE;
ALTER TABLE promo_code_redemptions
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;
ALTER TABLE promo_code_redemptions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE promo_code_redemptions
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2);
ALTER TABLE promo_code_redemptions
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON promo_codes(code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_active ON promo_codes(is_active, code);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_code ON promo_code_redemptions(promo_code_id);
CREATE INDEX IF NOT EXISTS idx_promo_redemptions_user ON promo_code_redemptions(user_id, promo_code_id);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_code_redemptions ENABLE ROW LEVEL SECURITY;

-- App accesses promo data through SECURITY DEFINER functions.
DROP POLICY IF EXISTS "Users can read active promo codes" ON promo_codes;
DROP POLICY IF EXISTS "Users can read own promo redemptions" ON promo_code_redemptions;

CREATE OR REPLACE FUNCTION update_promo_code_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_promo_code_updated_at ON promo_codes;
CREATE TRIGGER trigger_update_promo_code_updated_at
  BEFORE UPDATE ON promo_codes
  FOR EACH ROW
  EXECUTE FUNCTION update_promo_code_updated_at();

DO $$
BEGIN
  UPDATE promo_codes
  SET
    discount_type = 'percentage',
    discount_value = 100,
    applicable_listing_type = 'all',
    minimum_amount = 0,
    max_redemptions = NULL,
    per_user_limit = 1000,
    is_active = TRUE,
    updated_at = NOW()
  WHERE code = 'TEST100';

  IF NOT FOUND THEN
    INSERT INTO promo_codes (
      code,
      discount_type,
      discount_value,
      applicable_listing_type,
      minimum_amount,
      max_redemptions,
      per_user_limit,
      is_active
    )
    VALUES (
      'TEST100',
      'percentage',
      100,
      'all',
      0,
      NULL,
      1000,
      TRUE
    );
  END IF;
END $$;

-- ============================================
-- ORDERS: missing columns + status constraints
-- ============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2);

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,2) DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS promo_code_id UUID REFERENCES promo_codes(id) ON DELETE SET NULL;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(10,2) NOT NULL DEFAULT 0;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tracking_carrier TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_accepted BOOLEAN;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_accepted_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_declined_at TIMESTAMPTZ;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_decline_reason TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_response_deadline TIMESTAMPTZ;

UPDATE orders
SET original_amount = amount
WHERE original_amount IS NULL;

UPDATE orders
SET discount_amount = 0
WHERE discount_amount IS NULL;

DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname
  INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status IN (%pending_payment%';

  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE orders DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'orders'::regclass
      AND conname = 'orders_status_check'
  ) THEN
    ALTER TABLE orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN (
        'pending_acceptance',
        'declined',
        'pending_payment',
        'paid',
        'in_progress',
        'submitted',
        'revision_requested',
        'completed',
        'processing',
        'shipped',
        'delivered',
        'cancelled',
        'refund_requested',
        'refunded',
        'disputed',
        'resolved'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_pending_acceptance ON orders(status, seller_response_deadline)
  WHERE status = 'pending_acceptance';
CREATE INDEX IF NOT EXISTS idx_orders_promo_code_id ON orders(promo_code_id) WHERE promo_code_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_paypal_order_id ON orders(paypal_order_id) WHERE paypal_order_id IS NOT NULL;

-- ============================================
-- DOWNLOAD TOKENS: order-based support
-- ============================================

ALTER TABLE product_download_tokens
  ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id) ON DELETE CASCADE;

ALTER TABLE product_download_tokens
  ADD COLUMN IF NOT EXISTS download_limit INTEGER;

ALTER TABLE product_download_tokens
  ALTER COLUMN purchase_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_download_tokens_order ON product_download_tokens(order_id)
  WHERE order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_download_tokens_order_file_unique
  ON product_download_tokens(order_id, file_id)
  WHERE order_id IS NOT NULL;

DROP POLICY IF EXISTS "Buyers can view own download tokens" ON product_download_tokens;
DROP POLICY IF EXISTS "System can create download tokens" ON product_download_tokens;

CREATE POLICY "Buyers can view own download tokens" ON product_download_tokens
  FOR SELECT USING (
    (
      purchase_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM product_purchases
        WHERE id = purchase_id
          AND buyer_id = auth.uid()
      )
    )
    OR
    (
      order_id IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM orders
        WHERE id = order_id
          AND buyer_id = auth.uid()
      )
    )
  );

-- ============================================
-- ORDER CREATION: approval-aware
-- ============================================

CREATE OR REPLACE FUNCTION create_marketplace_order(
  p_buyer_id UUID,
  p_product_id UUID,
  p_pricing_id UUID,
  p_requested_quantity INTEGER DEFAULT 1,
  p_brief TEXT DEFAULT NULL,
  p_requirements JSONB DEFAULT '{}'::jsonb,
  p_due_date TIMESTAMPTZ DEFAULT NULL,
  p_shipping_address JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product products%ROWTYPE;
  v_pricing product_pricing%ROWTYPE;
  v_listing_type TEXT;
  v_quantity INTEGER;
  v_amount NUMERIC(10, 2);
  v_fee_rate NUMERIC(5, 4);
  v_platform_fee NUMERIC(10, 2);
  v_seller_amount NUMERIC(10, 2);
  v_currency TEXT;
  v_due_date TIMESTAMPTZ;
  v_order_id UUID;
  v_require_approval BOOLEAN := FALSE;
  v_auto_decline_hours INTEGER := 72;
  v_requires_seller_approval BOOLEAN := FALSE;
  v_initial_status TEXT := 'pending_payment';
BEGIN
  IF p_buyer_id IS NULL THEN
    RAISE EXCEPTION 'Buyer is required';
  END IF;

  IF p_product_id IS NULL OR p_pricing_id IS NULL THEN
    RAISE EXCEPTION 'product_id and pricing_id are required';
  END IF;

  SELECT *
  INTO v_product
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  IF v_product.status::TEXT <> 'active' THEN
    RAISE EXCEPTION 'This listing is not available';
  END IF;

  IF v_product.seller_id = p_buyer_id THEN
    RAISE EXCEPTION 'You cannot purchase your own listing';
  END IF;

  SELECT *
  INTO v_pricing
  FROM product_pricing
  WHERE id = p_pricing_id
    AND product_id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pricing option not found';
  END IF;

  IF COALESCE(v_pricing.is_available, true) = false THEN
    RAISE EXCEPTION 'This pricing option is unavailable';
  END IF;

  v_listing_type := v_product.listing_type::TEXT;
  IF v_listing_type NOT IN ('product', 'service') THEN
    RAISE EXCEPTION 'Invalid listing type: %', v_listing_type;
  END IF;

  v_quantity := GREATEST(COALESCE(p_requested_quantity, 1), 1);
  IF v_listing_type = 'service' THEN
    v_quantity := 1;
  END IF;

  IF v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital' AND p_shipping_address IS NULL THEN
    RAISE EXCEPTION 'Shipping address is required for physical orders';
  END IF;

  IF v_pricing.stock IS NOT NULL THEN
    IF v_pricing.stock < v_quantity THEN
      RAISE EXCEPTION 'Insufficient stock for this quantity';
    END IF;

    UPDATE product_pricing
    SET stock = stock - v_quantity
    WHERE id = v_pricing.id;
  END IF;

  v_amount := ROUND((v_pricing.price * v_quantity)::NUMERIC, 2);
  v_fee_rate := CASE WHEN v_listing_type = 'service' THEN 0.10 ELSE 0.08 END;
  v_platform_fee := ROUND((v_amount * v_fee_rate)::NUMERIC, 2);
  v_seller_amount := ROUND((v_amount - v_platform_fee)::NUMERIC, 2);
  v_currency := LOWER(COALESCE(v_pricing.currency, 'usd'));

  IF v_listing_type = 'service' THEN
    v_due_date := COALESCE(
      p_due_date,
      CASE
        WHEN v_pricing.delivery_days IS NOT NULL THEN NOW() + make_interval(days => v_pricing.delivery_days)
        ELSE NULL
      END
    );
  ELSE
    v_due_date := NULL;
  END IF;

  SELECT sp.require_approval, sp.auto_decline_hours
  INTO v_require_approval, v_auto_decline_hours
  FROM seller_profiles sp
  WHERE sp.user_id = v_product.seller_id
  LIMIT 1;

  v_auto_decline_hours := GREATEST(COALESCE(v_auto_decline_hours, 72), 1);

  v_requires_seller_approval := COALESCE(v_require_approval, FALSE)
    AND (
      v_listing_type = 'service'
      OR (v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital')
    );

  IF v_requires_seller_approval THEN
    v_initial_status := 'pending_acceptance';
  END IF;

  INSERT INTO orders (
    buyer_id,
    seller_id,
    product_id,
    pricing_id,
    listing_type,
    amount,
    original_amount,
    discount_amount,
    promo_code_id,
    platform_fee,
    seller_amount,
    currency,
    status,
    payment_status,
    payment_provider,
    brief,
    requirements,
    due_date,
    max_revisions,
    quantity,
    shipping_address,
    shipping_cost,
    seller_accepted,
    seller_response_deadline
  )
  VALUES (
    p_buyer_id,
    v_product.seller_id,
    p_product_id,
    p_pricing_id,
    v_listing_type,
    v_amount,
    v_amount,
    0,
    NULL,
    v_platform_fee,
    v_seller_amount,
    v_currency,
    v_initial_status,
    'pending',
    'placeholder',
    CASE WHEN v_listing_type = 'service' THEN p_brief ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN COALESCE(p_requirements, '{}'::jsonb) ELSE '{}'::jsonb END,
    CASE WHEN v_listing_type = 'service' THEN v_due_date ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN v_pricing.revisions ELSE NULL END,
    v_quantity,
    CASE WHEN v_listing_type = 'product' THEN p_shipping_address ELSE NULL END,
    0,
    CASE WHEN v_requires_seller_approval THEN NULL ELSE TRUE END,
    CASE WHEN v_requires_seller_approval THEN NOW() + make_interval(hours => v_auto_decline_hours) ELSE NULL END
  )
  RETURNING id INTO v_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (
    v_order_id,
    p_buyer_id,
    'status_change',
    NULL,
    v_initial_status,
    jsonb_build_object(
      'source', 'create_marketplace_order',
      'requires_approval', v_requires_seller_approval
    )
  );

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    v_order_id,
    p_buyer_id,
    CASE
      WHEN v_requires_seller_approval THEN 'Order created and awaiting seller approval.'
      ELSE 'Order created and ready for payment confirmation.'
    END,
    'system'
  );

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'status', v_initial_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION create_marketplace_order(UUID, UUID, UUID, INTEGER, TEXT, JSONB, TIMESTAMPTZ, JSONB) TO service_role;

-- ============================================
-- ORDER APPROVAL RPCs
-- ============================================

CREATE OR REPLACE FUNCTION accept_order(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF auth.uid() <> v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status <> 'pending_acceptance' THEN
    RAISE EXCEPTION 'Order is not awaiting acceptance';
  END IF;

  UPDATE orders
  SET
    status = 'pending_payment',
    seller_accepted = TRUE,
    seller_accepted_at = NOW(),
    seller_declined_at = NULL,
    seller_decline_reason = NULL,
    seller_response_deadline = NULL,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, auth.uid(), 'status_change', 'pending_acceptance', 'pending_payment', jsonb_build_object('action', 'accept_order'));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(), 'Seller accepted your order. Please complete payment to continue.', 'system');

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION decline_order(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF auth.uid() <> v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status <> 'pending_acceptance' THEN
    RAISE EXCEPTION 'Order is not awaiting acceptance';
  END IF;

  UPDATE orders
  SET
    status = 'declined',
    payment_status = 'failed',
    seller_accepted = FALSE,
    seller_declined_at = NOW(),
    seller_decline_reason = NULLIF(p_reason, ''),
    seller_response_deadline = NULL,
    cancel_reason = COALESCE(NULLIF(p_reason, ''), cancel_reason),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (
    p_order_id,
    auth.uid(),
    'status_change',
    'pending_acceptance',
    'declined',
    jsonb_build_object('action', 'decline_order', 'reason', NULLIF(p_reason, ''))
  );

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    auth.uid(),
    CASE
      WHEN NULLIF(p_reason, '') IS NULL THEN 'Seller declined your order.'
      ELSE 'Seller declined your order. Reason: ' || NULLIF(p_reason, '')
    END,
    'system'
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION auto_decline_expired_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
  v_row RECORD;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Only service role can run auto decline';
  END IF;

  FOR v_row IN
    UPDATE orders
    SET
      status = 'declined',
      payment_status = 'failed',
      seller_accepted = FALSE,
      seller_declined_at = NOW(),
      seller_decline_reason = COALESCE(seller_decline_reason, 'Auto-declined: seller did not respond in time'),
      seller_response_deadline = NULL,
      updated_at = NOW()
    WHERE status = 'pending_acceptance'
      AND seller_response_deadline IS NOT NULL
      AND seller_response_deadline < NOW()
    RETURNING id, buyer_id
  LOOP
    v_count := v_count + 1;

    INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
    VALUES (
      v_row.id,
      NULL,
      'status_change',
      'pending_acceptance',
      'declined',
      jsonb_build_object('action', 'auto_decline_expired_orders')
    );

    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (
      v_row.id,
      v_row.buyer_id,
      'Order was auto-declined because the seller did not respond in time.',
      'system'
    );
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION restore_order_stock_on_early_exit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF
    OLD.listing_type = 'product'
    AND OLD.pricing_id IS NOT NULL
    AND COALESCE(OLD.quantity, 1) > 0
    AND OLD.status IN ('pending_acceptance', 'pending_payment')
    AND NEW.status IN ('declined', 'cancelled')
    AND OLD.status IS DISTINCT FROM NEW.status
  THEN
    UPDATE product_pricing
    SET stock = stock + COALESCE(OLD.quantity, 1)
    WHERE id = OLD.pricing_id
      AND stock IS NOT NULL;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_restore_order_stock_on_early_exit ON orders;
CREATE TRIGGER trigger_restore_order_stock_on_early_exit
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION restore_order_stock_on_early_exit();

GRANT EXECUTE ON FUNCTION accept_order(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_order(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_decline_expired_orders() TO service_role;

-- ============================================
-- SHIPPING RPCs
-- ============================================

CREATE OR REPLACE FUNCTION add_order_tracking(
  p_order_id UUID,
  p_tracking_number TEXT,
  p_tracking_carrier TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NULLIF(p_tracking_number, '') IS NULL THEN
    RAISE EXCEPTION 'Tracking number is required';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF auth.uid() <> v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.listing_type <> 'product' OR v_order.shipping_address IS NULL THEN
    RAISE EXCEPTION 'Tracking can only be added to physical product orders';
  END IF;

  IF v_order.status NOT IN ('paid', 'processing', 'in_progress') THEN
    RAISE EXCEPTION 'Cannot add tracking from status: %', v_order.status;
  END IF;

  UPDATE orders
  SET
    tracking_number = NULLIF(p_tracking_number, ''),
    tracking_carrier = NULLIF(LOWER(COALESCE(p_tracking_carrier, '')), ''),
    status = 'shipped',
    shipped_at = COALESCE(shipped_at, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (
    p_order_id,
    auth.uid(),
    'status_change',
    v_order.status,
    'shipped',
    jsonb_build_object('tracking_number', NULLIF(p_tracking_number, ''), 'carrier', NULLIF(LOWER(COALESCE(p_tracking_carrier, '')), ''))
  );

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    auth.uid(),
    'Order has shipped' || COALESCE(' — Tracking: ' || NULLIF(p_tracking_number, ''), ''),
    'system'
  );

  RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION confirm_order_delivery(p_order_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF auth.uid() <> v_order.buyer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.listing_type <> 'product' OR v_order.shipping_address IS NULL THEN
    RAISE EXCEPTION 'Delivery confirmation only applies to physical product orders';
  END IF;

  IF v_order.status NOT IN ('shipped', 'delivered') THEN
    RAISE EXCEPTION 'Cannot confirm delivery from status: %', v_order.status;
  END IF;

  UPDATE orders
  SET
    status = 'completed',
    delivered_at = COALESCE(delivered_at, NOW()),
    completed_at = COALESCE(completed_at, NOW()),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, 'completed', jsonb_build_object('action', 'confirm_order_delivery'));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(), 'Buyer confirmed delivery. Order completed.', 'system');

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION add_order_tracking(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_delivery(UUID) TO authenticated;

-- ============================================
-- PROMO RPCs
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

  SELECT COUNT(*) INTO v_total_redemptions
  FROM promo_code_redemptions
  WHERE promo_code_id = v_promo.id;

  IF v_promo.max_redemptions IS NOT NULL AND v_total_redemptions >= v_promo.max_redemptions THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Promo code redemption limit reached');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT COUNT(*) INTO v_user_redemptions
    FROM promo_code_redemptions
    WHERE promo_code_id = v_promo.id
      AND user_id = auth.uid();

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

  RETURN jsonb_build_object(
    'success', true,
    'discount_amount', v_discount,
    'final_amount', v_final,
    'original_amount', v_amount
  );
END;
$$;

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

GRANT EXECUTE ON FUNCTION validate_promo_code(TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION apply_promo_to_order(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION remove_promo_from_order(UUID) TO authenticated;

-- ============================================
-- DIGITAL DOWNLOAD TOKEN RPCs
-- ============================================

CREATE OR REPLACE FUNCTION create_order_download_tokens_internal(p_order_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_file RECORD;
  v_count INTEGER := 0;
  v_inserted INTEGER := 0;
BEGIN
  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF v_order.listing_type <> 'product' OR v_order.shipping_address IS NOT NULL THEN
    RETURN 0;
  END IF;

  FOR v_file IN
    SELECT pf.id, pf.download_limit
    FROM product_files pf
    WHERE pf.product_id = v_order.product_id
      AND (pf.pricing_id IS NULL OR pf.pricing_id = v_order.pricing_id)
      AND COALESCE(pf.is_preview, FALSE) = FALSE
  LOOP
    INSERT INTO product_download_tokens (
      purchase_id,
      order_id,
      file_id,
      token,
      downloads_used,
      download_limit,
      expires_at
    )
    VALUES (
      NULL,
      v_order.id,
      v_file.id,
      encode(gen_random_bytes(24), 'hex'),
      0,
      v_file.download_limit,
      NOW() + INTERVAL '365 days'
    )
    ON CONFLICT (order_id, file_id)
    DO NOTHING;

    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION generate_order_download_tokens(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_tokens_generated INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order
  FROM orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF auth.uid() <> v_order.seller_id AND auth.uid() <> v_order.buyer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status NOT IN ('delivered', 'completed') THEN
    RAISE EXCEPTION 'Downloads are only available after delivery';
  END IF;

  v_tokens_generated := create_order_download_tokens_internal(p_order_id);

  RETURN jsonb_build_object('tokens_generated', v_tokens_generated);
END;
$$;

CREATE OR REPLACE FUNCTION consume_download_token(p_token TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row RECORD;
  v_new_used INTEGER;
  v_remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    pdt.id,
    pdt.token,
    pdt.downloads_used,
    pdt.download_limit,
    pdt.expires_at,
    pdt.order_id,
    pdt.purchase_id,
    pf.file_url,
    pf.file_name,
    o.buyer_id AS order_buyer_id,
    pp.buyer_id AS purchase_buyer_id
  INTO v_row
  FROM product_download_tokens pdt
  JOIN product_files pf ON pf.id = pdt.file_id
  LEFT JOIN orders o ON o.id = pdt.order_id
  LEFT JOIN product_purchases pp ON pp.id = pdt.purchase_id
  WHERE pdt.token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid download token';
  END IF;

  IF v_row.expires_at IS NOT NULL AND v_row.expires_at < NOW() THEN
    RAISE EXCEPTION 'Download token has expired';
  END IF;

  IF v_row.order_id IS NOT NULL THEN
    IF v_row.order_buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not authorized to download this file';
    END IF;
  ELSIF v_row.purchase_id IS NOT NULL THEN
    IF v_row.purchase_buyer_id IS DISTINCT FROM auth.uid() THEN
      RAISE EXCEPTION 'Not authorized to download this file';
    END IF;
  ELSE
    RAISE EXCEPTION 'Download token is not attached to an order';
  END IF;

  IF v_row.download_limit IS NOT NULL AND v_row.downloads_used >= v_row.download_limit THEN
    RAISE EXCEPTION 'Download limit reached';
  END IF;

  UPDATE product_download_tokens
  SET downloads_used = downloads_used + 1
  WHERE id = v_row.id;

  v_new_used := v_row.downloads_used + 1;
  IF v_row.download_limit IS NULL THEN
    v_remaining := NULL;
  ELSE
    v_remaining := GREATEST(v_row.download_limit - v_new_used, 0);
  END IF;

  RETURN jsonb_build_object(
    'file_url', v_row.file_url,
    'file_name', v_row.file_name,
    'downloads_used', v_new_used,
    'downloads_remaining', v_remaining
  );
END;
$$;

CREATE OR REPLACE FUNCTION ensure_digital_download_tokens_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.listing_type = 'product'
     AND NEW.shipping_address IS NULL
     AND NEW.status IN ('delivered', 'completed')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM create_order_download_tokens_internal(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_ensure_digital_download_tokens ON orders;
CREATE TRIGGER trigger_ensure_digital_download_tokens
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION ensure_digital_download_tokens_trigger();

GRANT EXECUTE ON FUNCTION generate_order_download_tokens(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION consume_download_token(TEXT) TO authenticated;
