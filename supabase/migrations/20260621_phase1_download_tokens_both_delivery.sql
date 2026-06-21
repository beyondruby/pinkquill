-- P1 task 4: digital download tokens were gated on `shipping_address IS NULL`, so
-- a delivery_type='both' product (which carries a shipping address for its physical
-- component) never generated tokens for its digital files — buyers paid but could
-- never download. Gate on the product's delivery_type (digital OR both) instead.
-- Physical-only products have no non-preview digital files, so the loop is a no-op.
CREATE OR REPLACE FUNCTION public.create_order_download_tokens_internal(p_order_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_delivery_type TEXT;
  v_file RECORD;
  v_count INTEGER := 0;
  v_inserted INTEGER := 0;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  IF v_order.listing_type <> 'product' THEN RETURN 0; END IF;

  SELECT p.delivery_type::TEXT INTO v_delivery_type FROM products p WHERE p.id = v_order.product_id;

  IF v_delivery_type IS NULL OR v_delivery_type NOT IN ('digital', 'both') THEN
    RETURN 0;
  END IF;

  FOR v_file IN
    SELECT pf.id, pf.download_limit
    FROM product_files pf
    WHERE pf.product_id = v_order.product_id
      AND (pf.pricing_id IS NULL OR pf.pricing_id = v_order.pricing_id)
      AND COALESCE(pf.is_preview, FALSE) = FALSE
  LOOP
    INSERT INTO product_download_tokens (purchase_id, order_id, file_id, token, downloads_used, download_limit, expires_at)
    VALUES (NULL, v_order.id, v_file.id, encode(extensions.gen_random_bytes(24), 'hex'), 0, v_file.download_limit, NOW() + INTERVAL '365 days')
    ON CONFLICT (order_id, file_id) DO NOTHING;
    GET DIAGNOSTICS v_inserted = ROW_COUNT;
    v_count := v_count + v_inserted;
  END LOOP;

  RETURN v_count;
END;
$function$;

-- Trigger: fire for any completed/delivered product order; the internal function
-- now decides eligibility by delivery_type (previously skipped all 'both' orders).
CREATE OR REPLACE FUNCTION public.ensure_digital_download_tokens_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.listing_type = 'product'
     AND NEW.status IN ('delivered', 'completed')
     AND (OLD.status IS DISTINCT FROM NEW.status)
  THEN
    PERFORM create_order_download_tokens_internal(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;
