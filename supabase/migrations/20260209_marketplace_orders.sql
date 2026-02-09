-- Marketplace Orders System
-- Created: 2026-02-09
-- Description: Full order system with orders, order messages, order events,
-- status machine, escrow support, and audit logging.

-- ============================================
-- ORDER NUMBER SEQUENCE
-- ============================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1000;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN 'PQ-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
END;
$$;

-- ============================================
-- ORDERS TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT UNIQUE NOT NULL DEFAULT generate_order_number(),

  -- Participants
  buyer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Product reference
  product_id UUID NOT NULL REFERENCES products(id),
  pricing_id UUID REFERENCES product_pricing(id),
  listing_type TEXT NOT NULL CHECK (listing_type IN ('product', 'service')),

  -- Financial
  amount DECIMAL(10,2) NOT NULL,
  platform_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
  seller_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',

  -- Status
  status TEXT NOT NULL DEFAULT 'pending_payment'
    CHECK (status IN (
      'pending_payment',
      'paid',
      'in_progress',
      'submitted',
      'revision_requested',
      'completed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refund_requested',
      'refunded',
      'disputed',
      'resolved'
    )),

  -- Payment
  payment_intent_id TEXT,
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'authorized', 'paid', 'refunded', 'partially_refunded', 'failed')),
  escrow_released BOOLEAN DEFAULT false,
  escrow_released_at TIMESTAMPTZ,

  -- Commission-specific fields
  brief TEXT,
  requirements JSONB DEFAULT '{}'::jsonb,
  due_date TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  delivery_note TEXT,
  delivery_assets JSONB DEFAULT '[]'::jsonb,
  revision_count INTEGER NOT NULL DEFAULT 0 CHECK (revision_count >= 0),
  max_revisions INTEGER,

  -- Product-specific fields
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  shipping_address JSONB,
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,

  -- Cancellation
  cancelled_by UUID REFERENCES profiles(id),
  cancel_reason TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER MESSAGES TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS order_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  content TEXT,
  message_type TEXT NOT NULL DEFAULT 'text'
    CHECK (message_type IN ('text', 'file', 'status_update', 'system')),
  attachments JSONB DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- ORDER EVENTS TABLE (Audit Log)
-- ============================================

CREATE TABLE IF NOT EXISTS order_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES profiles(id),

  event_type TEXT NOT NULL
    CHECK (event_type IN ('status_change', 'payment', 'message', 'revision', 'dispute', 'system')),
  from_status TEXT,
  to_status TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

-- Orders
CREATE INDEX IF NOT EXISTS idx_orders_buyer ON orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_orders_seller ON orders(seller_id);
CREATE INDEX IF NOT EXISTS idx_orders_product ON orders(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_listing_type ON orders(listing_type);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_payment_intent ON orders(payment_intent_id) WHERE payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_buyer_status ON orders(buyer_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_seller_status ON orders(seller_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);

-- Order messages
CREATE INDEX IF NOT EXISTS idx_order_messages_order ON order_messages(order_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_sender ON order_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_order_messages_created ON order_messages(order_id, created_at);

-- Order events
CREATE INDEX IF NOT EXISTS idx_order_events_order ON order_events(order_id);
CREATE INDEX IF NOT EXISTS idx_order_events_created ON order_events(order_id, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_events ENABLE ROW LEVEL SECURITY;

-- Orders: buyer and seller can view their own orders
CREATE POLICY "Buyers can view own orders" ON orders
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "Sellers can view own orders" ON orders
  FOR SELECT USING (seller_id = auth.uid());

-- Orders: only system/hooks create orders (buyers insert via RPC below)
CREATE POLICY "Buyers can create orders" ON orders
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Orders: NO direct UPDATE — all updates go through SECURITY DEFINER functions
-- This prevents arbitrary column modifications

-- Order messages: buyer and seller of the order can view
CREATE POLICY "Order participants can view messages" ON order_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Order messages: buyer and seller can send
CREATE POLICY "Order participants can send messages" ON order_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Order events: buyer and seller can view
CREATE POLICY "Order participants can view events" ON order_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- Order events: created by system functions only
CREATE POLICY "System can create events" ON order_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
      AND (orders.buyer_id = auth.uid() OR orders.seller_id = auth.uid())
    )
  );

-- ============================================
-- STATUS TRANSITION FUNCTIONS
-- ============================================

-- Seller actions: start work, submit delivery, ship, deliver
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

  -- Validate transitions
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

  -- Log event
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  -- Auto-generate system message
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

-- Buyer actions: complete, request revision, cancel
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
      -- Check max revisions
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

  -- Log event
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);

  -- Auto-generate system message
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
-- TRIGGERS
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_order_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_order_updated_at ON orders;
CREATE TRIGGER trigger_update_order_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_order_updated_at();

-- ============================================
-- GRANTS
-- ============================================

GRANT EXECUTE ON FUNCTION update_order_as_seller TO authenticated;
GRANT EXECUTE ON FUNCTION update_order_as_buyer TO authenticated;
GRANT EXECUTE ON FUNCTION generate_order_number TO authenticated;

-- ============================================
-- ENABLE REALTIME
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE order_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
