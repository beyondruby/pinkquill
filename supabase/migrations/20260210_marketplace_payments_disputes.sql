-- Marketplace payments/disputes hardening + placeholder provider support
-- Created: 2026-02-10

-- ============================================
-- ORDERS EXTENSIONS
-- ============================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_provider TEXT NOT NULL DEFAULT 'placeholder';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_reference TEXT;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS auto_completion_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_orders_auto_completion_at
  ON orders(auto_completion_at)
  WHERE auto_completion_at IS NOT NULL;

-- ============================================
-- SELLER ACCOUNTS
-- ============================================

CREATE TABLE IF NOT EXISTS seller_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_account_id TEXT UNIQUE,
  onboarding_complete BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  default_currency TEXT NOT NULL DEFAULT 'usd',
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE seller_accounts ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_accounts'
      AND policyname = 'Users can view own seller account'
  ) THEN
    CREATE POLICY "Users can view own seller account" ON seller_accounts
      FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_accounts'
      AND policyname = 'Users can insert own seller account'
  ) THEN
    CREATE POLICY "Users can insert own seller account" ON seller_accounts
      FOR INSERT WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'seller_accounts'
      AND policyname = 'Users can update own seller account'
  ) THEN
    CREATE POLICY "Users can update own seller account" ON seller_accounts
      FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_seller_account_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_seller_account_updated_at ON seller_accounts;
CREATE TRIGGER trigger_update_seller_account_updated_at
  BEFORE UPDATE ON seller_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_seller_account_updated_at();

-- ============================================
-- TRANSACTIONS
-- ============================================

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('payment', 'platform_fee', 'seller_payout', 'refund')),
  amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'usd',
  stripe_payment_intent_id TEXT,
  stripe_transfer_id TEXT,
  stripe_charge_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transactions'
      AND policyname = 'Order participants can view transactions'
  ) THEN
    CREATE POLICY "Order participants can view transactions" ON transactions
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = transactions.order_id
          AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================
-- DISPUTES
-- ============================================

CREATE TABLE IF NOT EXISTS disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  initiated_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL CHECK (
    reason IN (
      'item_not_as_described',
      'item_not_received',
      'quality_issue',
      'seller_unresponsive',
      'buyer_unresponsive',
      'late_delivery',
      'unauthorized_charge',
      'other'
    )
  ),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'under_review', 'resolved', 'escalated', 'cancelled')),
  resolution TEXT
    CHECK (
      resolution IS NULL OR
      resolution IN ('full_refund', 'partial_refund', 'release_to_seller', 'order_cancelled', 'mutual_agreement')
    ),
  resolution_notes TEXT,
  resolved_by UUID REFERENCES profiles(id),
  refund_amount DECIMAL(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disputes_order_id ON disputes(order_id);
CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(status);
CREATE INDEX IF NOT EXISTS idx_disputes_initiated_by ON disputes(initiated_by);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'disputes'
      AND policyname = 'Order participants can view disputes'
  ) THEN
    CREATE POLICY "Order participants can view disputes" ON disputes
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = disputes.order_id
          AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'disputes'
      AND policyname = 'Order participants can create disputes'
  ) THEN
    CREATE POLICY "Order participants can create disputes" ON disputes
      FOR INSERT WITH CHECK (
        initiated_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM orders
          WHERE orders.id = disputes.order_id
          AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
        )
      );
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_dispute_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_dispute_updated_at ON disputes;
CREATE TRIGGER trigger_update_dispute_updated_at
  BEFORE UPDATE ON disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_dispute_updated_at();

-- ============================================
-- ORDER AUTO-COMPLETION MAINTENANCE
-- ============================================

CREATE OR REPLACE FUNCTION manage_order_auto_completion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status IN ('submitted', 'delivered') THEN
      NEW.auto_completion_at = NOW() + INTERVAL '72 hours';
    ELSIF NEW.status IN ('revision_requested', 'completed', 'cancelled', 'refund_requested', 'refunded', 'disputed', 'resolved') THEN
      NEW.auto_completion_at = NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_manage_order_auto_completion ON orders;
CREATE TRIGGER trigger_manage_order_auto_completion
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION manage_order_auto_completion();

-- ============================================
-- STATUS TRANSITION PATCH (SECURITY DEFINER RPCS)
-- ============================================

CREATE OR REPLACE FUNCTION update_order_as_seller(
  p_order_id UUID,
  p_status TEXT,
  p_tracking_number TEXT DEFAULT NULL,
  p_delivery_note TEXT DEFAULT NULL,
  p_delivery_assets JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

  CASE p_status
    WHEN 'in_progress' THEN
      IF v_order.status NOT IN ('paid', 'revision_requested') THEN
        RAISE EXCEPTION 'Cannot start work from status: %', v_order.status;
      END IF;
    WHEN 'submitted' THEN
      IF v_order.status != 'in_progress' THEN
        RAISE EXCEPTION 'Cannot submit from status: %', v_order.status;
      END IF;
    WHEN 'processing' THEN
      IF v_order.status != 'paid' THEN
        RAISE EXCEPTION 'Cannot process from status: %', v_order.status;
      END IF;
    WHEN 'shipped' THEN
      IF v_order.status NOT IN ('paid', 'processing') THEN
        RAISE EXCEPTION 'Cannot ship from status: %', v_order.status;
      END IF;
      IF v_order.shipping_address IS NULL THEN
        RAISE EXCEPTION 'Cannot ship a digital order';
      END IF;
    WHEN 'delivered' THEN
      IF v_order.status = 'shipped' THEN
        NULL;
      ELSIF v_order.status = 'paid' AND v_order.shipping_address IS NULL THEN
        NULL;
      ELSE
        RAISE EXCEPTION 'Cannot deliver from status: %', v_order.status;
      END IF;
    WHEN 'cancelled' THEN
      IF v_order.status != 'pending_payment' THEN
        RAISE EXCEPTION 'Only unpaid orders can be cancelled directly';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid seller status: %', p_status;
  END CASE;

  UPDATE orders SET
    status = p_status,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    delivery_note = COALESCE(p_delivery_note, delivery_note),
    delivery_assets = COALESCE(p_delivery_assets, delivery_assets),
    started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
    submitted_at = CASE WHEN p_status = 'submitted' THEN NOW() ELSE submitted_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE cancelled_by END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    auth.uid(),
    CASE p_status
      WHEN 'in_progress' THEN 'Seller started working on your order'
      WHEN 'submitted' THEN 'Seller submitted the delivery for review'
      WHEN 'shipped' THEN 'Order has been shipped' || COALESCE(' — Tracking: ' || p_tracking_number, '')
      WHEN 'delivered' THEN 'Order has been delivered'
      WHEN 'processing' THEN 'Order is being processed'
      WHEN 'cancelled' THEN 'Order was cancelled by the seller'
      ELSE 'Order status updated'
    END,
    'system'
  );

  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION update_order_as_buyer(
  p_order_id UUID,
  p_status TEXT,
  p_cancel_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_result JSONB;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;

  CASE p_status
    WHEN 'completed' THEN
      IF v_order.status NOT IN ('submitted', 'delivered') THEN
        RAISE EXCEPTION 'Cannot complete from status: %', v_order.status;
      END IF;
    WHEN 'revision_requested' THEN
      IF v_order.status != 'submitted' THEN
        RAISE EXCEPTION 'Cannot request revision from status: %', v_order.status;
      END IF;
      IF v_order.max_revisions IS NOT NULL AND v_order.revision_count >= v_order.max_revisions THEN
        RAISE EXCEPTION 'Maximum revisions reached (%)', v_order.max_revisions;
      END IF;
    WHEN 'cancelled' THEN
      IF v_order.status != 'pending_payment' THEN
        RAISE EXCEPTION 'Only unpaid orders can be cancelled directly';
      END IF;
    ELSE
      RAISE EXCEPTION 'Invalid buyer status: %', p_status;
  END CASE;

  UPDATE orders SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    revision_count = CASE WHEN p_status = 'revision_requested' THEN revision_count + 1 ELSE revision_count END,
    cancelled_by = CASE WHEN p_status = 'cancelled' THEN auth.uid() ELSE cancelled_by END,
    cancel_reason = CASE WHEN p_status = 'cancelled' THEN p_cancel_reason ELSE cancel_reason END,
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    auth.uid(),
    CASE p_status
      WHEN 'completed' THEN 'Buyer accepted the delivery — order complete!'
      WHEN 'revision_requested' THEN 'Buyer requested a revision'
      WHEN 'cancelled' THEN 'Order was cancelled by the buyer' || COALESCE(' — Reason: ' || p_cancel_reason, '')
      ELSE 'Order status updated'
    END,
    'system'
  );

  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

-- ============================================
-- DISPUTE / REFUND / EARNINGS RPCS
-- ============================================

CREATE OR REPLACE FUNCTION open_dispute(
  p_order_id UUID,
  p_reason TEXT,
  p_description TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
  v_dispute disputes;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF auth.uid() != v_order.buyer_id AND auth.uid() != v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status IN ('cancelled', 'refunded') THEN
    RAISE EXCEPTION 'Cannot dispute a terminal order';
  END IF;

  IF EXISTS (
    SELECT 1 FROM disputes
    WHERE order_id = p_order_id
      AND status IN ('open', 'under_review', 'escalated')
  ) THEN
    RAISE EXCEPTION 'An active dispute already exists for this order';
  END IF;

  INSERT INTO disputes (
    order_id,
    initiated_by,
    reason,
    description,
    status
  )
  VALUES (
    p_order_id,
    auth.uid(),
    p_reason,
    p_description,
    'open'
  )
  RETURNING * INTO v_dispute;

  UPDATE orders
  SET status = 'disputed', updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    auth.uid(),
    'dispute',
    jsonb_build_object('action', 'opened', 'reason', p_reason)
  );

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (
    p_order_id,
    auth.uid(),
    'A dispute has been opened for this order.',
    'system'
  );

  RETURN to_jsonb(v_dispute);
END;
$$;

CREATE OR REPLACE FUNCTION resolve_dispute(
  p_dispute_id UUID,
  p_resolution TEXT,
  p_resolution_notes TEXT DEFAULT NULL,
  p_refund_amount NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dispute disputes;
  v_order orders;
  v_order_status TEXT := 'resolved';
  v_payment_status TEXT := NULL;
BEGIN
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Only service role can resolve disputes';
  END IF;

  SELECT * INTO v_dispute FROM disputes WHERE id = p_dispute_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;

  IF v_dispute.status = 'resolved' THEN
    RETURN to_jsonb(v_dispute);
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_dispute.order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found for dispute'; END IF;

  IF p_resolution IN ('full_refund', 'order_cancelled') THEN
    v_order_status := 'refunded';
    v_payment_status := 'refunded';
  ELSIF p_resolution = 'partial_refund' THEN
    v_order_status := 'resolved';
    v_payment_status := 'partially_refunded';
  ELSE
    v_order_status := 'resolved';
  END IF;

  UPDATE disputes
  SET
    status = 'resolved',
    resolution = p_resolution,
    resolution_notes = p_resolution_notes,
    resolved_by = NULL,
    refund_amount = p_refund_amount,
    resolved_at = NOW(),
    updated_at = NOW()
  WHERE id = p_dispute_id
  RETURNING * INTO v_dispute;

  UPDATE orders
  SET
    status = v_order_status,
    payment_status = COALESCE(v_payment_status, payment_status),
    updated_at = NOW()
  WHERE id = v_order.id;

  IF p_resolution IN ('full_refund', 'order_cancelled') THEN
    UPDATE transactions
    SET status = 'refunded'
    WHERE order_id = v_order.id
      AND status = 'pending';

    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE order_id = v_order.id
        AND type = 'refund'
    ) THEN
      INSERT INTO transactions (
        order_id,
        type,
        amount,
        currency,
        status,
        metadata
      )
      VALUES (
        v_order.id,
        'refund',
        COALESCE(p_refund_amount, v_order.amount),
        v_order.currency,
        'completed',
        jsonb_build_object('source', 'resolve_dispute')
      );
    END IF;
  END IF;

  INSERT INTO order_events (order_id, event_type, metadata)
  VALUES (
    v_order.id,
    'dispute',
    jsonb_build_object(
      'action', 'resolved',
      'resolution', p_resolution,
      'refund_amount', p_refund_amount
    )
  );

  RETURN to_jsonb(v_dispute);
END;
$$;

CREATE OR REPLACE FUNCTION request_refund(
  p_order_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;

  IF auth.role() != 'service_role' AND auth.uid() != v_order.buyer_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF v_order.status IN ('refund_requested', 'refunded') THEN
    RETURN to_jsonb(v_order);
  END IF;

  UPDATE orders
  SET
    status = 'refund_requested',
    cancel_reason = COALESCE(p_reason, cancel_reason),
    updated_at = NOW()
  WHERE id = p_order_id
  RETURNING * INTO v_order;

  INSERT INTO order_events (order_id, actor_id, event_type, metadata)
  VALUES (
    p_order_id,
    auth.uid(),
    'payment',
    jsonb_build_object('action', 'refund_requested', 'reason', p_reason)
  );

  RETURN to_jsonb(v_order);
END;
$$;

CREATE OR REPLACE FUNCTION auto_complete_orders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  WITH completed AS (
    UPDATE orders
    SET
      status = 'completed',
      completed_at = NOW(),
      updated_at = NOW()
    WHERE auto_completion_at IS NOT NULL
      AND auto_completion_at <= NOW()
      AND status IN ('submitted', 'delivered')
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM completed;

  IF v_count > 0 THEN
    INSERT INTO order_events (order_id, event_type, metadata)
    SELECT id, 'system', jsonb_build_object('action', 'auto_completed')
    FROM orders
    WHERE status = 'completed'
      AND completed_at >= NOW() - INTERVAL '1 minute';
  END IF;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION get_seller_earnings(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_orders INTEGER := 0;
  v_completed_orders INTEGER := 0;
  v_active_orders INTEGER := 0;
  v_cancelled_orders INTEGER := 0;
  v_total_earned NUMERIC := 0;
  v_pending_earnings NUMERIC := 0;
  v_avg_order_value NUMERIC := 0;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status IN ('completed', 'delivered', 'resolved')),
    COUNT(*) FILTER (WHERE status IN ('paid', 'in_progress', 'submitted', 'revision_requested', 'processing', 'shipped')),
    COUNT(*) FILTER (WHERE status IN ('cancelled', 'refunded'))
  INTO
    v_total_orders,
    v_completed_orders,
    v_active_orders,
    v_cancelled_orders
  FROM orders
  WHERE seller_id = p_user_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_earned
  FROM transactions t
  JOIN orders o ON o.id = t.order_id
  WHERE o.seller_id = p_user_id
    AND t.type = 'seller_payout'
    AND t.status = 'completed';

  IF v_total_earned = 0 THEN
    SELECT COALESCE(SUM(seller_amount), 0)
    INTO v_total_earned
    FROM orders
    WHERE seller_id = p_user_id
      AND status IN ('completed', 'delivered', 'resolved')
      AND payment_status = 'paid';
  END IF;

  SELECT COALESCE(SUM(seller_amount), 0)
  INTO v_pending_earnings
  FROM orders
  WHERE seller_id = p_user_id
    AND status IN ('paid', 'in_progress', 'submitted', 'revision_requested', 'processing', 'shipped')
    AND payment_status IN ('authorized', 'paid');

  IF v_completed_orders > 0 THEN
    v_avg_order_value := ROUND(v_total_earned / v_completed_orders, 2);
  END IF;

  RETURN jsonb_build_object(
    'total_earned', ROUND(v_total_earned, 2),
    'pending_earnings', ROUND(v_pending_earnings, 2),
    'total_orders', v_total_orders,
    'completed_orders', v_completed_orders,
    'active_orders', v_active_orders,
    'cancelled_orders', v_cancelled_orders,
    'avg_order_value', COALESCE(v_avg_order_value, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION update_order_as_seller(UUID, TEXT, TEXT, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_as_buyer(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION open_dispute(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION request_refund(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_seller_earnings(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_complete_orders() TO service_role;
