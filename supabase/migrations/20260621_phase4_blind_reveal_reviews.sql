-- P4: Blind-reveal reviews. Reviews were visible the instant written, letting a
-- party read the counterpart's review and tailor their own. Add double-blind reveal:
--   * product orders are one-sided (only buyers review) -> reveal immediately.
--   * service orders are two-sided -> reveal BOTH when the second party submits,
--     or after a 14-day deadline if the counterpart never reviews.
-- Visible when revealed_at IS NOT NULL OR reveal_deadline <= now().
-- Existing reviews are backfilled as revealed so nothing disappears.

ALTER TABLE public.order_reviews
  ADD COLUMN IF NOT EXISTS revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reveal_deadline timestamptz;

UPDATE public.order_reviews
SET revealed_at = COALESCE(revealed_at, created_at)
WHERE revealed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_order_reviews_reveal_deadline
  ON public.order_reviews (reveal_deadline)
  WHERE revealed_at IS NULL AND reveal_deadline IS NOT NULL;

CREATE OR REPLACE FUNCTION public.reveal_due_reviews()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE order_reviews
  SET revealed_at = now()
  WHERE revealed_at IS NULL
    AND reveal_deadline IS NOT NULL
    AND reveal_deadline <= now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.reveal_due_reviews() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reveal_due_reviews() TO service_role;

CREATE OR REPLACE FUNCTION public.submit_order_review(p_order_id uuid, p_quill_score integer, p_title text DEFAULT NULL::text, p_content text DEFAULT NULL::text, p_highlights text[] DEFAULT '{}'::text[], p_is_public boolean DEFAULT true)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_reviewer_id UUID;
  v_reviewee_id UUID;
  v_reviewer_role TEXT;
  v_reviewee_role TEXT;
  v_review_id UUID;
  v_content TEXT := trim(COALESCE(p_content, ''));
  v_title TEXT := NULLIF(trim(COALESCE(p_title, '')), '');
  v_highlights TEXT[];
  v_highlight_count INTEGER;
  v_counterpart_exists BOOLEAN := FALSE;
  v_revealed_at TIMESTAMPTZ := NULL;
  v_reveal_deadline TIMESTAMPTZ := NULL;
  c_reveal_window CONSTANT INTERVAL := INTERVAL '14 days';
BEGIN
  v_reviewer_id := auth.uid();
  IF v_reviewer_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_quill_score IS NULL OR p_quill_score < 1 OR p_quill_score > 5 THEN
    RAISE EXCEPTION 'Quill score must be between 1 and 5';
  END IF;

  IF char_length(v_content) < 12 THEN
    RAISE EXCEPTION 'Review must be at least 12 characters';
  END IF;

  IF v_title IS NOT NULL AND char_length(v_title) > 120 THEN
    RAISE EXCEPTION 'Review title cannot exceed 120 characters';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status <> 'completed' THEN
    RAISE EXCEPTION 'Reviews can only be left after an order is completed';
  END IF;

  IF v_reviewer_id <> v_order.buyer_id AND v_reviewer_id <> v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized to review this order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM order_reviews r
    WHERE r.order_id = p_order_id AND r.reviewer_id = v_reviewer_id
  ) THEN
    RAISE EXCEPTION 'You have already submitted a review for this order';
  END IF;

  IF v_reviewer_id = v_order.buyer_id THEN
    v_reviewer_role := 'buyer';
    v_reviewee_role := 'seller';
    v_reviewee_id := v_order.seller_id;
  ELSE
    v_reviewer_role := 'seller';
    v_reviewee_role := 'buyer';
    v_reviewee_id := v_order.buyer_id;
  END IF;

  IF v_order.listing_type = 'product' AND v_reviewer_role <> 'buyer' THEN
    RAISE EXCEPTION 'Only buyers can leave product reviews';
  END IF;

  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT h
      FROM (
        SELECT NULLIF(trim(value), '') AS h
        FROM unnest(COALESCE(p_highlights, '{}'::TEXT[])) AS value
      ) cleaned
      WHERE h IS NOT NULL
      LIMIT 6
    ),
    '{}'::TEXT[]
  ) INTO v_highlights;

  IF v_order.listing_type = 'product' THEN
    v_revealed_at := now();
  ELSE
    v_counterpart_exists := EXISTS (
      SELECT 1 FROM order_reviews r
      WHERE r.order_id = p_order_id AND r.reviewer_id = v_reviewee_id
    );
    IF v_counterpart_exists THEN
      v_revealed_at := now();
    ELSE
      v_reveal_deadline := now() + c_reveal_window;
    END IF;
  END IF;

  INSERT INTO order_reviews (
    order_id, product_id, listing_type, reviewer_id, reviewee_id,
    reviewer_role, reviewee_role, quill_score, title, content, highlights,
    is_public, revealed_at, reveal_deadline
  )
  VALUES (
    p_order_id, v_order.product_id, v_order.listing_type, v_reviewer_id, v_reviewee_id,
    v_reviewer_role, v_reviewee_role, p_quill_score, v_title, v_content, v_highlights,
    COALESCE(p_is_public, TRUE), v_revealed_at, v_reveal_deadline
  )
  RETURNING id INTO v_review_id;

  IF v_counterpart_exists THEN
    UPDATE order_reviews
    SET revealed_at = now(), reveal_deadline = NULL
    WHERE order_id = p_order_id
      AND reviewer_id = v_reviewee_id
      AND revealed_at IS NULL;
  END IF;

  BEGIN
    INSERT INTO notifications (user_id, actor_id, type, order_id, content)
    VALUES (
      v_reviewee_id, v_reviewer_id, 'review_received', p_order_id,
      format('You received a %s-quill review.', p_quill_score)
    );
  EXCEPTION
    WHEN undefined_table OR undefined_column OR check_violation THEN
      NULL;
  END;

  SELECT cardinality(v_highlights) INTO v_highlight_count;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id, v_reviewer_id, 'system',
    jsonb_build_object(
      'action', 'review_submitted',
      'review_id', v_review_id,
      'reviewee_id', v_reviewee_id,
      'reviewer_role', v_reviewer_role,
      'quill_score', p_quill_score,
      'highlight_count', COALESCE(v_highlight_count, 0),
      'revealed', (v_revealed_at IS NOT NULL)
    )
  );

  RETURN v_review_id;
END;
$function$;
