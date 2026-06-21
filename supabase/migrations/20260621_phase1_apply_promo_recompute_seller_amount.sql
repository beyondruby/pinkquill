-- P1 task 2: apply_promo_to_order
--  (1) recompute platform_fee + seller_amount from the discounted total (flat 5%)
--      so a discounted/$0 order does not still carry the full pre-discount payout.
--      Basis matches transferToSeller (amount * rate) so stored == actual payout.
--  (2) lock the promo row FOR UPDATE before re-validating to close the
--      redemption-limit check-then-insert race.
CREATE OR REPLACE FUNCTION public.apply_promo_to_order(p_order_id uuid, p_promo_code_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_validation JSONB;
  v_discount NUMERIC(10,2);
  v_final NUMERIC(10,2);
  v_amount NUMERIC(10,2);
  v_platform_fee NUMERIC(10,2);
  v_seller_amount NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF v_order.buyer_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be applied before payment');
  END IF;

  -- Lock the promo row so concurrent applies of a limited/last-use code serialize.
  SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_code_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code not found');
  END IF;

  v_amount := COALESCE(v_order.original_amount, v_order.amount);

  v_validation := validate_promo_code(v_promo.code, v_amount, v_order.listing_type);
  IF (v_validation->>'valid')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_validation->>'error', 'Promo code is not valid'));
  END IF;

  v_discount := COALESCE((v_validation->>'discount_amount')::NUMERIC, 0);
  v_final := COALESCE((v_validation->>'final_amount')::NUMERIC, v_amount);

  -- Recompute the platform fee + seller payout off the discounted total (flat 5%).
  v_platform_fee := ROUND((v_final * 0.05)::NUMERIC, 2);
  v_seller_amount := ROUND((v_final - v_platform_fee)::NUMERIC, 2);

  UPDATE orders
  SET original_amount = v_amount,
      discount_amount = v_discount,
      amount = v_final,
      platform_fee = v_platform_fee,
      seller_amount = v_seller_amount,
      promo_code_id = v_promo.id,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE promo_code_redemptions
  SET promo_code_id = v_promo.id, user_id = auth.uid(), discount_amount = v_discount, created_at = NOW()
  WHERE order_id = p_order_id;

  IF NOT FOUND THEN
    INSERT INTO promo_code_redemptions (promo_code_id, order_id, user_id, discount_amount)
    VALUES (v_promo.id, p_order_id, auth.uid(), v_discount);
  END IF;

  RETURN jsonb_build_object('success', true, 'discount_amount', v_discount, 'final_amount', v_final, 'original_amount', v_amount);
END;
$function$;
