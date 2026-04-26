-- ============================================================================
-- Cache pricing aggregates on `products` so the marketplace browser can
-- filter and sort by price/delivery/revisions server-side. The previous
-- implementation post-filtered in JavaScript which broke pagination
-- (`pagination.total` and `has_more` were misleading).
-- ============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS min_price NUMERIC,
  ADD COLUMN IF NOT EXISTS max_price NUMERIC,
  ADD COLUMN IF NOT EXISTS min_delivery_days INTEGER,
  ADD COLUMN IF NOT EXISTS max_revisions INTEGER;

CREATE INDEX IF NOT EXISTS idx_products_active_min_price
  ON products(min_price)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_products_active_service_delivery
  ON products(min_delivery_days)
  WHERE status = 'active' AND listing_type = 'service';

CREATE INDEX IF NOT EXISTS idx_products_active_service_revisions
  ON products(max_revisions)
  WHERE status = 'active' AND listing_type = 'service';

CREATE OR REPLACE FUNCTION refresh_product_pricing_cache(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE products
  SET
    min_price          = (SELECT MIN(price)         FROM product_pricing WHERE product_id = p_product_id),
    max_price          = (SELECT MAX(price)         FROM product_pricing WHERE product_id = p_product_id),
    min_delivery_days  = (SELECT MIN(delivery_days) FROM product_pricing WHERE product_id = p_product_id AND delivery_days IS NOT NULL),
    max_revisions      = (SELECT MAX(revisions)     FROM product_pricing WHERE product_id = p_product_id AND revisions IS NOT NULL)
  WHERE id = p_product_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION refresh_product_pricing_cache(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_product_pricing_cache(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION refresh_product_pricing_cache(UUID) FROM authenticated;

CREATE OR REPLACE FUNCTION on_product_pricing_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_product_pricing_cache(OLD.product_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' AND NEW.product_id IS DISTINCT FROM OLD.product_id THEN
    PERFORM refresh_product_pricing_cache(OLD.product_id);
    PERFORM refresh_product_pricing_cache(NEW.product_id);
    RETURN NEW;
  ELSE
    PERFORM refresh_product_pricing_cache(NEW.product_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS product_pricing_cache_trigger ON product_pricing;

CREATE TRIGGER product_pricing_cache_trigger
  AFTER INSERT OR UPDATE OR DELETE ON product_pricing
  FOR EACH ROW
  EXECUTE FUNCTION on_product_pricing_change();

-- Backfill all existing products in a single statement.
UPDATE products p
SET
  min_price         = pp.min_price,
  max_price         = pp.max_price,
  min_delivery_days = pp.min_delivery_days,
  max_revisions     = pp.max_revisions
FROM (
  SELECT
    product_id,
    MIN(price)         AS min_price,
    MAX(price)         AS max_price,
    MIN(delivery_days) FILTER (WHERE delivery_days IS NOT NULL) AS min_delivery_days,
    MAX(revisions)     FILTER (WHERE revisions IS NOT NULL)     AS max_revisions
  FROM product_pricing
  GROUP BY product_id
) pp
WHERE p.id = pp.product_id;
