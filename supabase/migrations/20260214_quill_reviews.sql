-- Quill-based marketplace reviews
-- Replaces star/sub-rating review model with a unified quill system.

CREATE TABLE IF NOT EXISTS order_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'service')),
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewer_role TEXT NOT NULL CHECK (reviewer_role IN ('buyer', 'seller')),
  reviewee_role TEXT NOT NULL CHECK (reviewee_role IN ('buyer', 'seller')),
  quill_score INTEGER NOT NULL CHECK (quill_score BETWEEN 1 AND 5),
  title TEXT,
  content TEXT NOT NULL,
  highlights TEXT[] NOT NULL DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT order_reviews_unique_per_reviewer UNIQUE(order_id, reviewer_id),
  CONSTRAINT order_reviews_distinct_users CHECK (reviewer_id <> reviewee_id),
  CONSTRAINT order_reviews_distinct_roles CHECK (reviewer_role <> reviewee_role),
  CONSTRAINT order_reviews_content_length CHECK (char_length(trim(content)) BETWEEN 12 AND 3000),
  CONSTRAINT order_reviews_title_length CHECK (title IS NULL OR char_length(title) <= 120)
);

CREATE INDEX IF NOT EXISTS idx_order_reviews_order ON order_reviews(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_reviews_product ON order_reviews(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_reviews_reviewee ON order_reviews(reviewee_id, reviewee_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_reviews_listing ON order_reviews(listing_type, created_at DESC);

CREATE OR REPLACE FUNCTION update_order_reviews_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_order_reviews_updated_at ON order_reviews;
CREATE TRIGGER trigger_update_order_reviews_updated_at
  BEFORE UPDATE ON order_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_order_reviews_updated_at();

ALTER TABLE order_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read public order reviews" ON order_reviews;
CREATE POLICY "Public can read public order reviews" ON order_reviews
  FOR SELECT USING (is_public = TRUE);

DROP POLICY IF EXISTS "Order participants can read private order reviews" ON order_reviews;
CREATE POLICY "Order participants can read private order reviews" ON order_reviews
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM orders o
      WHERE o.id = order_id
        AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Reviewers can update own review" ON order_reviews;
CREATE POLICY "Reviewers can update own review" ON order_reviews
  FOR UPDATE USING (reviewer_id = auth.uid())
  WITH CHECK (reviewer_id = auth.uid());

CREATE OR REPLACE FUNCTION submit_order_review(
  p_order_id UUID,
  p_quill_score INTEGER,
  p_title TEXT DEFAULT NULL,
  p_content TEXT DEFAULT NULL,
  p_highlights TEXT[] DEFAULT '{}'::TEXT[],
  p_is_public BOOLEAN DEFAULT TRUE
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  SELECT *
  INTO v_order
  FROM orders
  WHERE id = p_order_id;

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
    SELECT 1
    FROM order_reviews r
    WHERE r.order_id = p_order_id
      AND r.reviewer_id = v_reviewer_id
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

  INSERT INTO order_reviews (
    order_id,
    product_id,
    listing_type,
    reviewer_id,
    reviewee_id,
    reviewer_role,
    reviewee_role,
    quill_score,
    title,
    content,
    highlights,
    is_public
  )
  VALUES (
    p_order_id,
    v_order.product_id,
    v_order.listing_type,
    v_reviewer_id,
    v_reviewee_id,
    v_reviewer_role,
    v_reviewee_role,
    p_quill_score,
    v_title,
    v_content,
    v_highlights,
    COALESCE(p_is_public, TRUE)
  )
  RETURNING id INTO v_review_id;

  -- Best effort notification (schema-safe fallback).
  BEGIN
    INSERT INTO notifications (user_id, actor_id, type, order_id, content)
    VALUES (
      v_reviewee_id,
      v_reviewer_id,
      'review_received',
      p_order_id,
      format('You received a %s-quill review.', p_quill_score)
    );
  EXCEPTION
    WHEN undefined_table OR undefined_column OR check_violation THEN
      NULL;
  END;

  SELECT cardinality(v_highlights) INTO v_highlight_count;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    v_reviewer_id,
    'system',
    jsonb_build_object(
      'action', 'review_submitted',
      'review_id', v_review_id,
      'reviewee_id', v_reviewee_id,
      'reviewer_role', v_reviewer_role,
      'quill_score', p_quill_score,
      'highlight_count', COALESCE(v_highlight_count, 0)
    )
  );

  RETURN v_review_id;
END;
$$;

GRANT SELECT ON order_reviews TO anon, authenticated;
GRANT EXECUTE ON FUNCTION submit_order_review(UUID, INTEGER, TEXT, TEXT, TEXT[], BOOLEAN) TO authenticated;
