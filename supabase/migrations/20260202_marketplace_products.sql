-- Marketplace Products Migration
-- Created: 2026-02-02
-- Description: Full marketplace/store feature with products, pricing, shipping, digital files

-- ============================================
-- ENUMS
-- ============================================

DO $$ BEGIN
  CREATE TYPE product_delivery AS ENUM ('physical', 'digital', 'both');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE product_status AS ENUM ('draft', 'active', 'sold', 'paused', 'archived');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- MAIN PRODUCTS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic info
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,

  -- Classification
  delivery_type product_delivery NOT NULL,
  category TEXT NOT NULL,
  subcategory TEXT,

  -- Flexible metadata (techniques, styles, dimensions, etc.)
  attributes JSONB DEFAULT '{}',

  -- Status & visibility
  status product_status DEFAULT 'draft',
  year_created INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  UNIQUE(seller_id, slug)
);

-- ============================================
-- PRODUCT MEDIA (images/videos)
-- ============================================

CREATE TABLE IF NOT EXISTS product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT DEFAULT 'image',
  is_primary BOOLEAN DEFAULT false,
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT PRICING (multiple options per product)
-- ============================================

CREATE TABLE IF NOT EXISTS product_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  pricing_type TEXT NOT NULL,
  variant_name TEXT,
  price DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',

  -- Stock (null = unlimited for digital)
  stock INTEGER,
  is_available BOOLEAN DEFAULT true,

  -- Reproduction-specific options
  reproduction_options JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT SHIPPING (physical products)
-- ============================================

CREATE TABLE IF NOT EXISTS product_shipping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,

  -- Dimensions
  dimensions_unit TEXT DEFAULT 'cm',
  height DECIMAL,
  width DECIMAL,
  thickness DECIMAL,
  weight DECIMAL,
  weight_unit TEXT DEFAULT 'kg',

  -- Shipping options
  shipping_services TEXT[],
  shipping_locations TEXT[],
  packaging TEXT,

  -- Estimated delivery
  processing_days INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(product_id)
);

-- ============================================
-- PRODUCT FILES (digital downloads)
-- ============================================

CREATE TABLE IF NOT EXISTS product_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  pricing_id UUID REFERENCES product_pricing(id) ON DELETE SET NULL,

  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,

  -- Access control
  is_preview BOOLEAN DEFAULT false,
  download_limit INTEGER,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT KEYWORDS (for search/discovery)
-- ============================================

CREATE TABLE IF NOT EXISTS product_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, keyword)
);

-- ============================================
-- PURCHASES/ORDERS
-- ============================================

CREATE TABLE IF NOT EXISTS product_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id),
  pricing_id UUID REFERENCES product_pricing(id),

  amount DECIMAL(10,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  status TEXT DEFAULT 'pending',

  -- Shipping address (for physical)
  shipping_address JSONB,
  tracking_number TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ
);

-- ============================================
-- DOWNLOAD TOKENS (secure digital delivery)
-- ============================================

CREATE TABLE IF NOT EXISTS product_download_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES product_purchases(id) ON DELETE CASCADE,
  file_id UUID NOT NULL REFERENCES product_files(id) ON DELETE CASCADE,

  token TEXT UNIQUE NOT NULL,
  downloads_used INTEGER DEFAULT 0,
  expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_products_seller ON products(seller_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category, subcategory);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(status);
CREATE INDEX IF NOT EXISTS idx_products_delivery ON products(delivery_type);
CREATE INDEX IF NOT EXISTS idx_products_created ON products(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id);
CREATE INDEX IF NOT EXISTS idx_product_media_primary ON product_media(product_id, is_primary) WHERE is_primary = true;

CREATE INDEX IF NOT EXISTS idx_product_pricing_product ON product_pricing(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_type ON product_pricing(pricing_type);
CREATE INDEX IF NOT EXISTS idx_product_pricing_available ON product_pricing(product_id, is_available) WHERE is_available = true;

CREATE INDEX IF NOT EXISTS idx_product_files_product ON product_files(product_id);
CREATE INDEX IF NOT EXISTS idx_product_files_pricing ON product_files(pricing_id);

CREATE INDEX IF NOT EXISTS idx_product_keywords_product ON product_keywords(product_id);
CREATE INDEX IF NOT EXISTS idx_product_keywords_keyword ON product_keywords(keyword);

CREATE INDEX IF NOT EXISTS idx_purchases_buyer ON product_purchases(buyer_id);
CREATE INDEX IF NOT EXISTS idx_purchases_product ON product_purchases(product_id);
CREATE INDEX IF NOT EXISTS idx_purchases_status ON product_purchases(status);

CREATE INDEX IF NOT EXISTS idx_download_tokens_purchase ON product_download_tokens(purchase_id);
CREATE INDEX IF NOT EXISTS idx_download_tokens_token ON product_download_tokens(token);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_shipping ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_download_tokens ENABLE ROW LEVEL SECURITY;

-- Products: anyone can view active, owners can manage
CREATE POLICY "Anyone can view active products" ON products
  FOR SELECT USING (status = 'active' OR seller_id = auth.uid());

CREATE POLICY "Sellers can create products" ON products
  FOR INSERT WITH CHECK (auth.uid() = seller_id);

CREATE POLICY "Sellers can update own products" ON products
  FOR UPDATE USING (auth.uid() = seller_id);

CREATE POLICY "Sellers can delete own products" ON products
  FOR DELETE USING (auth.uid() = seller_id);

-- Product media: follows product access
CREATE POLICY "Anyone can view product media" ON product_media
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      AND (status = 'active' OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Sellers can manage product media" ON product_media
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update product media" ON product_media
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete product media" ON product_media
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Product pricing: follows product access
CREATE POLICY "Anyone can view product pricing" ON product_pricing
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      AND (status = 'active' OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Sellers can manage product pricing" ON product_pricing
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update product pricing" ON product_pricing
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete product pricing" ON product_pricing
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Product shipping: follows product access
CREATE POLICY "Anyone can view product shipping" ON product_shipping
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      AND (status = 'active' OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Sellers can manage product shipping" ON product_shipping
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Product files: restricted access (only sellers and buyers)
CREATE POLICY "Sellers can view own product files" ON product_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can view purchased files" ON product_files
  FOR SELECT USING (
    is_preview = true OR
    EXISTS (
      SELECT 1 FROM product_purchases pp
      JOIN products p ON p.id = pp.product_id
      WHERE pp.buyer_id = auth.uid()
      AND pp.status = 'paid'
      AND p.id = product_files.product_id
    )
  );

CREATE POLICY "Sellers can manage product files" ON product_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can update product files" ON product_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Sellers can delete product files" ON product_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Product keywords: follows product access
CREATE POLICY "Anyone can view product keywords" ON product_keywords
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id
      AND (status = 'active' OR seller_id = auth.uid())
    )
  );

CREATE POLICY "Sellers can manage product keywords" ON product_keywords
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Purchases: buyers can view their own, sellers can view purchases of their products
CREATE POLICY "Buyers can view own purchases" ON product_purchases
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Sellers can view purchases of their products" ON product_purchases
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

CREATE POLICY "Buyers can create purchases" ON product_purchases
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

CREATE POLICY "Sellers can update purchase status" ON product_purchases
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM products
      WHERE id = product_id AND seller_id = auth.uid()
    )
  );

-- Download tokens: only for buyer
CREATE POLICY "Buyers can view own download tokens" ON product_download_tokens
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM product_purchases
      WHERE id = purchase_id AND buyer_id = auth.uid()
    )
  );

CREATE POLICY "System can create download tokens" ON product_download_tokens
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM product_purchases
      WHERE id = purchase_id AND buyer_id = auth.uid()
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to generate URL-friendly slug
CREATE OR REPLACE FUNCTION generate_product_slug(title TEXT, seller_id UUID)
RETURNS TEXT AS $$
DECLARE
  base_slug TEXT;
  final_slug TEXT;
  counter INTEGER := 0;
BEGIN
  -- Convert title to lowercase, replace spaces with hyphens, remove special chars
  base_slug := lower(regexp_replace(title, '[^a-zA-Z0-9\s-]', '', 'g'));
  base_slug := regexp_replace(base_slug, '\s+', '-', 'g');
  base_slug := regexp_replace(base_slug, '-+', '-', 'g');
  base_slug := trim(both '-' from base_slug);

  -- Truncate to reasonable length
  base_slug := left(base_slug, 50);

  final_slug := base_slug;

  -- Check for uniqueness and add number if needed
  WHILE EXISTS (SELECT 1 FROM products WHERE slug = final_slug AND products.seller_id = generate_product_slug.seller_id) LOOP
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  END LOOP;

  RETURN final_slug;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_product_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS trigger_update_product_updated_at ON products;
CREATE TRIGGER trigger_update_product_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_product_updated_at();

-- Function to set published_at when status changes to active
CREATE OR REPLACE FUNCTION set_product_published_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS NULL OR OLD.status != 'active') THEN
    NEW.published_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for published_at
DROP TRIGGER IF EXISTS trigger_set_product_published_at ON products;
CREATE TRIGGER trigger_set_product_published_at
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION set_product_published_at();

-- ============================================
-- STORAGE BUCKETS
-- ============================================

-- Create storage buckets for product files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('product-images', 'product-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime']),
  ('product-files', 'product-files', false, 524288000, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for product-images (public read, authenticated upload)
CREATE POLICY "Anyone can view product images"
ON storage.objects FOR SELECT
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'product-images'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update own product images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete own product images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'product-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Storage policies for product-files (restricted access)
CREATE POLICY "Sellers can manage product files"
ON storage.objects FOR ALL
USING (
  bucket_id = 'product-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Note: Download access for buyers is handled via signed URLs in the application
