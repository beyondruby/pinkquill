-- P1b task 9: a refunded/cancelled/disputed buyer could keep downloading digital
-- goods. Block consumption when the order is no longer a valid entitlement.
-- (TTL is intentionally left long — a legitimately purchased digital product
-- should remain downloadable; the entitlement check is the correct gate.)
CREATE OR REPLACE FUNCTION public.consume_download_token(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row RECORD;
  v_new_used INTEGER;
  v_remaining INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT
    pdt.id, pdt.token, pdt.downloads_used, pdt.download_limit, pdt.expires_at,
    pdt.order_id, pdt.purchase_id, pf.file_url, pf.file_name,
    o.buyer_id AS order_buyer_id, o.status AS order_status,
    pp.buyer_id AS purchase_buyer_id
  INTO v_row
  FROM product_download_tokens pdt
  JOIN product_files pf ON pf.id = pdt.file_id
  LEFT JOIN orders o ON o.id = pdt.order_id
  LEFT JOIN product_purchases pp ON pp.id = pdt.purchase_id
  WHERE pdt.token = p_token
  FOR UPDATE OF pdt;

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
    IF v_row.order_status IN ('refunded', 'refund_requested', 'cancelled', 'disputed', 'expired') THEN
      RAISE EXCEPTION 'This order is no longer eligible for downloads';
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
$function$;
