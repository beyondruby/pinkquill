-- Phase 2e — Money visibility (2026-09-03)
-- One new RPC: get_seller_analytics. It aggregates every order, payment,
-- refund and message thread of a seller (response time needs the first
-- buyer message and the first seller reply per order); the client would
-- otherwise have to download all messages of all orders. Receipts and payout
-- statements read existing tables under existing policies. get_order_actions
-- is re-created only to expose the payout id (for the statement link).
-- Idempotent. No money-path change.

CREATE OR REPLACE FUNCTION public.get_seller_analytics(p_seller_id UUID, p_days INTEGER DEFAULT 90)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 90), 7), 730);
  v_to TIMESTAMPTZ := NOW();
  v_from TIMESTAMPTZ;
  v_prev_from TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF v_caller IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_caller IS NOT NULL AND v_caller <> p_seller_id AND NOT is_platform_admin(v_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_from := v_to - make_interval(days => v_days);
  v_prev_from := v_from - make_interval(days => v_days);

  WITH paid AS (
    -- Paid orders with the moment they were paid (first payment event; creation as a fallback)
    SELECT o.id, o.buyer_id, o.product_id, o.amount, o.platform_fee, o.seller_amount,
      COALESCE((SELECT SUM(r.listing_amount_cents) / 100.0 FROM refunds r WHERE r.order_id = o.id AND r.status = 'succeeded'), 0) AS refunded,
      COALESCE((SELECT MIN(e.created_at) FROM order_events e WHERE e.order_id = o.id AND e.event_type = 'payment'), o.created_at) AS paid_at
    FROM orders o
    WHERE o.seller_id = p_seller_id AND o.payment_status IN ('paid', 'partially_refunded', 'refunded')
  ),
  totals AS (
    SELECT jsonb_build_object(
      'paid_orders', COUNT(*), 'gross', COALESCE(SUM(amount), 0), 'fees', COALESCE(SUM(platform_fee), 0),
      'net', COALESCE(SUM(seller_amount), 0), 'refunded', COALESCE(SUM(refunded), 0),
      'avg_order', ROUND(COALESCE(AVG(amount), 0), 2), 'buyers', COUNT(DISTINCT buyer_id)
    ) AS j FROM paid WHERE paid_at >= v_from AND paid_at < v_to
  ),
  prev AS (
    SELECT jsonb_build_object('paid_orders', COUNT(*), 'gross', COALESCE(SUM(amount), 0), 'net', COALESCE(SUM(seller_amount), 0)) AS j
    FROM paid WHERE paid_at >= v_prev_from AND paid_at < v_from
  ),
  weekly AS (
    SELECT date_trunc('week', paid_at) AS wk, SUM(amount) AS gross, SUM(seller_amount) AS net, COUNT(*) AS n
    FROM paid WHERE paid_at >= date_trunc('week', v_from) GROUP BY 1
  ),
  series AS (
    -- Weekly buckets covering the whole window (zeros included)
    SELECT COALESCE(jsonb_agg(jsonb_build_object('week', to_char(w.week_start, 'YYYY-MM-DD'), 'gross', COALESCE(s.gross, 0), 'net', COALESCE(s.net, 0), 'orders', COALESCE(s.n, 0)) ORDER BY w.week_start), '[]'::jsonb) AS j
    FROM generate_series(date_trunc('week', v_from), date_trunc('week', v_to), INTERVAL '1 week') AS w(week_start)
    LEFT JOIN weekly s ON s.wk = w.week_start
  ),
  conv AS (
    -- Conversion: requests created in the window → paid
    SELECT jsonb_build_object(
      'requests', COUNT(*),
      'paid', COUNT(*) FILTER (WHERE payment_status IN ('paid', 'partially_refunded', 'refunded')),
      'declined', COUNT(*) FILTER (WHERE status = 'declined'),
      'expired', COUNT(*) FILTER (WHERE status = 'expired'),
      'waiting', COUNT(*) FILTER (WHERE status IN ('pending_acceptance', 'pending_payment')),
      'cancelled_unpaid', COUNT(*) FILTER (WHERE status = 'cancelled' AND payment_status NOT IN ('paid', 'partially_refunded', 'refunded')),
      'rate', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(COUNT(*) FILTER (WHERE payment_status IN ('paid', 'partially_refunded', 'refunded'))::NUMERIC / COUNT(*), 3) END
    ) AS j FROM orders WHERE seller_id = p_seller_id AND created_at >= v_from AND created_at < v_to
  ),
  ontime AS (
    -- On-time: commissions delivered in the window, judged against the agreed due date
    SELECT jsonb_build_object(
      'delivered', COUNT(*),
      'on_time', COUNT(*) FILTER (WHERE submitted_at <= due_date),
      'rate', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(COUNT(*) FILTER (WHERE submitted_at <= due_date)::NUMERIC / COUNT(*), 3) END,
      'avg_days_early', ROUND(COALESCE(AVG(EXTRACT(EPOCH FROM (due_date - submitted_at)) / 86400), 0)::NUMERIC, 1)
    ) AS j FROM orders
    WHERE seller_id = p_seller_id AND listing_type = 'service' AND due_date IS NOT NULL AND submitted_at IS NOT NULL
      AND submitted_at >= v_from AND submitted_at < v_to
  ),
  firsts AS (
    -- Response time: first buyer message → first seller reply, per order started in the window
    SELECT o.id, o.seller_id,
      (SELECT MIN(m.created_at) FROM order_messages m WHERE m.order_id = o.id AND m.sender_id = o.buyer_id AND m.message_type <> 'system') AS buyer_at
    FROM orders o WHERE o.seller_id = p_seller_id AND o.created_at >= v_from AND o.created_at < v_to
  ),
  replies AS (
    SELECT f.id, f.buyer_at,
      (SELECT MIN(m.created_at) FROM order_messages m WHERE m.order_id = f.id AND m.sender_id = f.seller_id AND m.message_type <> 'system' AND m.created_at > f.buyer_at) AS seller_at
    FROM firsts f WHERE f.buyer_at IS NOT NULL
  ),
  resp AS (
    SELECT jsonb_build_object(
      'asked', COUNT(*),
      'answered', COUNT(seller_at),
      'median_hours', ROUND((percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (seller_at - buyer_at)) / 3600))::NUMERIC, 1),
      'avg_hours', ROUND(AVG(EXTRACT(EPOCH FROM (seller_at - buyer_at)) / 3600)::NUMERIC, 1),
      'within_24h', COUNT(*) FILTER (WHERE seller_at IS NOT NULL AND seller_at - buyer_at <= INTERVAL '24 hours'),
      'rate_24h', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(COUNT(*) FILTER (WHERE seller_at IS NOT NULL AND seller_at - buyer_at <= INTERVAL '24 hours')::NUMERIC / COUNT(*), 3) END
    ) AS j FROM replies
  ),
  per_buyer AS (SELECT buyer_id, COUNT(*) AS n FROM paid GROUP BY buyer_id),
  rep AS (
    -- Repeat buyers, all time
    SELECT jsonb_build_object(
      'buyers', COUNT(*),
      'repeat_buyers', COUNT(*) FILTER (WHERE n >= 2),
      'rate', CASE WHEN COUNT(*) = 0 THEN NULL ELSE ROUND(COUNT(*) FILTER (WHERE n >= 2)::NUMERIC / COUNT(*), 3) END,
      'orders_from_repeat', COALESCE(SUM(n) FILTER (WHERE n >= 2), 0),
      'orders', COALESCE(SUM(n), 0)
    ) AS j FROM per_buyer
  ),
  by_listing AS (
    SELECT product_id, COUNT(*) AS n, SUM(amount) AS gross, SUM(seller_amount) AS net
    FROM paid WHERE paid_at >= v_from AND paid_at < v_to GROUP BY product_id ORDER BY 3 DESC LIMIT 8
  ),
  listings AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object('product_id', l.product_id, 'title', p.title, 'listing_type', p.listing_type, 'orders', l.n, 'gross', l.gross, 'net', l.net) ORDER BY l.gross DESC), '[]'::jsonb) AS j
    FROM by_listing l LEFT JOIN products p ON p.id = l.product_id
  )
  SELECT jsonb_build_object(
    'window_days', v_days, 'from', v_from, 'to', v_to,
    'currency', COALESCE((SELECT currency FROM orders WHERE seller_id = p_seller_id ORDER BY created_at DESC LIMIT 1), 'usd'),
    'totals', totals.j, 'previous', prev.j, 'revenue_by_week', series.j,
    'conversion', conv.j, 'on_time', ontime.j, 'response', resp.j, 'repeat', rep.j, 'by_listing', listings.j
  ) INTO v_result
  FROM totals, prev, series, conv, ontime, resp, rep, listings;

  RETURN v_result;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_seller_analytics(UUID, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_analytics(UUID, INTEGER) TO authenticated, service_role;

-- get_order_actions: payout id for the statement link
CREATE OR REPLACE FUNCTION public.get_order_actions(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_o orders%ROWTYPE; v_caller UUID := auth.uid(); v_role TEXT; v_window NUMERIC := platform_setting_numeric('release_window_hours', 168);
  v_payout payouts%ROWTYPE; v_refund refunds%ROWTYPE; v_dispute disputes%ROWTYPE; v_late BOOLEAN; v_paid_out BOOLEAN; v_refund_busy BOOLEAN;
  v_is_service BOOLEAN;
  v_ext order_extensions%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  v_role := CASE WHEN v_caller = v_o.buyer_id THEN 'buyer' WHEN v_caller = v_o.seller_id THEN 'seller' WHEN is_platform_admin(v_caller) THEN 'admin' ELSE NULL END;
  IF v_role IS NULL THEN RAISE EXCEPTION 'Not authorized'; END IF;
  v_is_service := v_o.listing_type = 'service';
  SELECT * INTO v_payout FROM payouts WHERE order_id = p_order_id;
  SELECT * INTO v_refund FROM refunds WHERE order_id = p_order_id AND status IN ('requested', 'approved', 'processing', 'needs_review') ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_dispute FROM disputes WHERE order_id = p_order_id AND status IN ('open', 'under_review', 'escalated') ORDER BY created_at DESC LIMIT 1;
  SELECT * INTO v_ext FROM order_extensions WHERE order_id = p_order_id AND status = 'pending' ORDER BY created_at DESC LIMIT 1;
  v_paid_out := COALESCE(v_payout.status = 'sent', FALSE);
  v_refund_busy := v_refund.id IS NOT NULL;
  v_late := v_o.due_date IS NOT NULL AND v_o.due_date + INTERVAL '3 days' < NOW() AND v_o.status IN ('paid', 'in_progress', 'revision_requested');

  RETURN jsonb_build_object(
    'role', v_role,
    'status', v_o.status,
    'payment_status', v_o.payment_status,
    'is_late', v_late,
    -- seller work
    'can_accept', v_role = 'seller' AND v_o.status = 'pending_acceptance',
    'can_decline', v_role = 'seller' AND v_o.status = 'pending_acceptance',
    'can_start', v_role = 'seller' AND v_is_service AND v_o.status IN ('paid', 'revision_requested'),
    'can_deliver', v_role = 'seller' AND v_is_service AND v_o.status = 'in_progress',
    'can_ship', v_role = 'seller' AND NOT v_is_service AND v_o.status IN ('paid', 'processing'),
    'can_mark_delivered', v_role = 'seller' AND NOT v_is_service AND v_o.status = 'shipped',
    -- buyer review
    'can_pay', v_role = 'buyer' AND v_o.status = 'pending_payment',
    'can_accept_delivery', v_role = 'buyer' AND v_o.status IN ('submitted', 'delivered'),
    'can_request_revision', v_role = 'buyer' AND v_is_service AND v_o.status = 'submitted' AND (v_o.max_revisions IS NULL OR v_o.revision_count < v_o.max_revisions),
    'revisions_left', CASE WHEN v_o.max_revisions IS NULL THEN NULL ELSE GREATEST(v_o.max_revisions - v_o.revision_count, 0) END,
    -- timelines (2d)
    'can_request_extension', v_role = 'seller' AND v_is_service AND v_o.status IN ('paid', 'in_progress', 'revision_requested') AND v_ext.id IS NULL,
    'can_respond_extension', v_role = 'buyer' AND v_ext.id IS NOT NULL,
    'extension', CASE WHEN v_ext.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_ext.id, 'old_due_date', v_ext.old_due_date, 'new_due_date', v_ext.new_due_date, 'reason', v_ext.reason, 'requested_at', v_ext.created_at, 'mine', v_ext.requested_by = v_caller) END,
    -- exits
    'can_cancel', NOT v_refund_busy AND NOT v_paid_out AND (
        v_o.status IN ('pending_acceptance', 'pending_payment')
        OR (v_role = 'buyer' AND (v_o.status = 'paid' OR v_late OR v_o.status IN ('in_progress', 'revision_requested', 'submitted')))
        OR (v_role IN ('seller', 'admin') AND v_o.status IN ('paid', 'in_progress', 'revision_requested', 'submitted'))),
    'cancel_mode', CASE
        WHEN v_o.status IN ('pending_acceptance', 'pending_payment') THEN 'free'
        WHEN v_role = 'buyer' AND (v_o.status = 'paid' OR v_late) THEN 'refund'
        WHEN v_role = 'buyer' THEN 'request'
        WHEN v_role IN ('seller', 'admin') THEN 'refund' ELSE NULL END,
    'can_request_refund', v_role = 'buyer' AND NOT v_refund_busy AND NOT v_paid_out AND v_o.status IN ('paid', 'in_progress', 'revision_requested', 'submitted', 'delivered', 'completed'),
    'can_issue_refund', v_role IN ('seller', 'admin') AND NOT v_refund_busy AND v_o.status IN ('paid', 'in_progress', 'revision_requested', 'submitted', 'delivered', 'completed', 'refund_requested', 'resolved') AND v_o.payment_status IN ('paid', 'partially_refunded'),
    'can_decide_refund', v_role IN ('seller', 'admin') AND COALESCE(v_refund.status = 'requested', FALSE),
    'can_open_dispute', v_dispute.id IS NULL AND v_o.payment_status IN ('paid', 'partially_refunded') AND v_o.status NOT IN ('pending_acceptance', 'declined', 'pending_payment', 'expired', 'cancelled', 'refunded', 'disputed'),
    'can_add_evidence', v_dispute.id IS NOT NULL AND v_dispute.kind = 'dispute',
    'seller_share_remaining_listing_cents', ROUND(order_seller_share_remaining_cents(p_order_id) / COALESCE(NULLIF(v_o.fx_rate, 0), 1))::INTEGER,
    -- money state
    'paid_out', v_paid_out,
    'payout', CASE WHEN v_payout.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_payout.id, 'status', v_payout.status, 'amount_cents', v_payout.amount_cents, 'currency', v_payout.currency, 'listing_amount_cents', v_payout.listing_amount_cents, 'sent_at', v_payout.sent_at, 'block_reason', v_payout.block_reason) END,
    'release_at', CASE WHEN v_o.status = 'completed' AND v_o.completed_at IS NOT NULL THEN v_o.completed_at + make_interval(hours => v_window::INTEGER) ELSE NULL END,
    'auto_complete_at', v_o.auto_completion_at,
    'refund', CASE WHEN v_refund.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_refund.id, 'status', v_refund.status, 'kind', v_refund.kind, 'amount_cents', v_refund.amount_cents, 'currency', v_refund.currency, 'listing_amount_cents', v_refund.listing_amount_cents, 'initiator_role', v_refund.initiator_role, 'reason', v_refund.reason) END,
    'dispute', CASE WHEN v_dispute.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_dispute.id, 'kind', v_dispute.kind, 'status', v_dispute.status, 'reason', v_dispute.reason, 'evidence_due_by', v_dispute.evidence_due_by, 'evidence_count', jsonb_array_length(v_dispute.evidence)) END
  );
END;
$$;
