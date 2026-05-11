-- Add min_price (PWYW floor) to product_pricing.
-- Existing rows: min_price = price (fixed pricing, no PWYW).
-- New rows with min_price < price = pay-what-you-want; buyer types amount >= min_price.
-- min_price = 0 makes the row free-eligible.

ALTER TABLE product_pricing
  ADD COLUMN IF NOT EXISTS min_price NUMERIC(10, 2);

UPDATE product_pricing
SET min_price = price
WHERE min_price IS NULL;

ALTER TABLE product_pricing
  ALTER COLUMN min_price SET NOT NULL;

ALTER TABLE product_pricing
  ADD CONSTRAINT product_pricing_min_price_nonneg
    CHECK (min_price >= 0);

ALTER TABLE product_pricing
  ADD CONSTRAINT product_pricing_min_price_lte_price
    CHECK (min_price <= price);

-- Service packages keep their $5 floor on the buyer's entry point.
ALTER TABLE product_pricing
  ADD CONSTRAINT product_pricing_service_min_price_floor
    CHECK (pricing_type <> 'service_package' OR min_price >= 5);

-- Update cached products.min_price to roll up from product_pricing.min_price
-- so the storefront filter surfaces PWYW entry points (including free-eligible).
CREATE OR REPLACE FUNCTION public.refresh_product_pricing_cache(p_product_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
BEGIN
  UPDATE products
  SET
    min_price          = (SELECT MIN(min_price)     FROM product_pricing WHERE product_id = p_product_id),
    max_price          = (SELECT MAX(price)         FROM product_pricing WHERE product_id = p_product_id),
    min_delivery_days  = (SELECT MIN(delivery_days) FROM product_pricing WHERE product_id = p_product_id AND delivery_days IS NOT NULL),
    max_revisions      = (SELECT MAX(revisions)     FROM product_pricing WHERE product_id = p_product_id AND revisions IS NOT NULL)
  WHERE id = p_product_id;
END;
$function$;

-- Backfill existing cached values once
UPDATE products p
SET min_price = sub.min_price,
    max_price = sub.max_price
FROM (
  SELECT product_id,
         MIN(min_price) AS min_price,
         MAX(price)     AS max_price
  FROM product_pricing
  GROUP BY product_id
) sub
WHERE p.id = sub.product_id;
