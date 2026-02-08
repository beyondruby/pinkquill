-- Product Saves (Bookmarks) Migration
-- Created: 2026-02-09
-- Description: Creates the missing product_saves table referenced by useToggleSaveProduct / useSavedProducts

CREATE TABLE IF NOT EXISTS product_saves (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (product_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_saves_user ON product_saves(user_id);
CREATE INDEX IF NOT EXISTS idx_product_saves_product ON product_saves(product_id);

ALTER TABLE product_saves ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saves" ON product_saves
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can save products" ON product_saves
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave products" ON product_saves
  FOR DELETE USING (auth.uid() = user_id);
