-- Commissions / Services extension for marketplace
-- Created: 2026-02-08
-- Description: Adds first-class service listings and commission order workflow

-- ============================================
-- PRODUCTS: LISTING TYPE + SERVICE METADATA
-- ============================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS listing_type TEXT NOT NULL DEFAULT 'product';

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS service_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_listing_type_check'
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_listing_type_check
      CHECK (listing_type IN ('product', 'service'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_listing_type ON products(listing_type);
CREATE INDEX IF NOT EXISTS idx_products_listing_status ON products(listing_type, status);

-- ============================================
-- PRICING: SERVICE PACKAGES
-- ============================================

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS package_tier TEXT;

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS delivery_days INTEGER;

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS revisions INTEGER;

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS package_features JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_pricing_package_tier_check'
  ) THEN
    ALTER TABLE product_pricing
      ADD CONSTRAINT product_pricing_package_tier_check
      CHECK (package_tier IS NULL OR package_tier IN ('basic', 'standard', 'premium', 'custom'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_pricing_delivery_days_check'
  ) THEN
    ALTER TABLE product_pricing
      ADD CONSTRAINT product_pricing_delivery_days_check
      CHECK (delivery_days IS NULL OR delivery_days > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_pricing_revisions_check'
  ) THEN
    ALTER TABLE product_pricing
      ADD CONSTRAINT product_pricing_revisions_check
      CHECK (revisions IS NULL OR revisions >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_pricing_package_tier ON product_pricing(package_tier);

-- ============================================
-- PURCHASES: COMMISSION WORKFLOW FIELDS
-- ============================================

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS brief TEXT;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS delivery_note TEXT;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS delivery_assets JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS revision_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE product_purchases
  ADD COLUMN IF NOT EXISTS last_status_update_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'product_purchases_revision_count_check'
  ) THEN
    ALTER TABLE product_purchases
      ADD CONSTRAINT product_purchases_revision_count_check
      CHECK (revision_count >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_product_purchases_due_date ON product_purchases(due_date);
CREATE INDEX IF NOT EXISTS idx_product_purchases_status_updated ON product_purchases(last_status_update_at DESC);

-- ============================================
-- PURCHASE POLICIES (BUYER STATUS ACTIONS)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'product_purchases'
      AND policyname = 'Buyers can update own commission purchases'
  ) THEN
    CREATE POLICY "Buyers can update own commission purchases" ON product_purchases
      FOR UPDATE
      USING (buyer_id = auth.uid())
      WITH CHECK (buyer_id = auth.uid());
  END IF;
END $$;

-- ============================================
-- STATUS TIMESTAMP MAINTENANCE
-- ============================================

CREATE OR REPLACE FUNCTION update_purchase_status_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.last_status_update_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_purchase_status_timestamp ON product_purchases;
CREATE TRIGGER trigger_update_purchase_status_timestamp
  BEFORE UPDATE ON product_purchases
  FOR EACH ROW
  EXECUTE FUNCTION update_purchase_status_timestamp();
