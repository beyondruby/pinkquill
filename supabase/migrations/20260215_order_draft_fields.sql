-- ==========================================================================
-- Add missing draft fields to orders table
-- These columns are used by the update-draft API and checkout flow
-- ==========================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS buyer_phone TEXT,
  ADD COLUMN IF NOT EXISTS buyer_note TEXT;

-- Index for phone lookups (seller customer CRM)
CREATE INDEX IF NOT EXISTS idx_orders_buyer_phone ON orders(buyer_phone)
  WHERE buyer_phone IS NOT NULL;
