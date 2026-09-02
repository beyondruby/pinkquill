-- Commissions rebuild — Phase 1d: refunds, cancellations, disputes, chargebacks
-- (docs/commissions/02-plan.md). Decisions: D6 = buyer cancels free while the
-- seller has not started (status paid) or when the order is 3+ days late;
-- after work starts a cancellation is a refund request the seller decides;
-- sellers may cancel any active order (full refund); partial refunds come out
-- of the seller's share only. D8 = platform_admins table (profiles.role is a
-- free-text bio field and cannot be used).
--
-- Root causes closed: RC-A3 (escrow exits: cancel-after-pay, refund window,
-- partial refunds, dispute resolution, chargebacks), RC-D1 server half
-- (get_order_actions replaces the client transition table).
--
-- Money rules (charge currency, i.e. what Stripe moved):
-- - full refund  = payment.amount_cents − already refunded; buyer gets fees
--   back; seller owed nothing; platform absorbs Stripe's processing fee.
-- - partial refund = listing amount × fx_rate, capped at the seller's remaining
--   share; platform fee and buyer fee untouched.
-- - after a payout was sent, a refund first reverses the transfer for the
--   seller's share; if that fails the refund waits for review (never refund
--   the buyer while the seller keeps the money).
-- Idempotent.

-- ===========================================================================
-- 1. Admins
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note TEXT
);
ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.platform_admins FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = p_user_id); $$;
REVOKE EXECUTE ON FUNCTION public.is_platform_admin(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_platform_admin(UUID) TO authenticated, service_role;

INSERT INTO public.platform_admins (user_id, note)
SELECT id, 'owner' FROM public.profiles WHERE username = 'hadi'
ON CONFLICT (user_id) DO NOTHING;

-- ===========================================================================
-- 2. Refunds
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.refunds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  initiated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  initiator_role TEXT NOT NULL CHECK (initiator_role IN ('buyer', 'seller', 'admin', 'system', 'stripe')),
  kind TEXT NOT NULL CHECK (kind IN ('full', 'partial')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL,
  listing_amount_cents INTEGER,
  listing_currency TEXT,
  seller_share_cents INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN (
    'requested', 'approved', 'declined', 'processing', 'succeeded', 'needs_review', 'failed', 'cancelled'
  )),
  previous_status TEXT,
  stripe_refund_id TEXT UNIQUE,
  reversal_id TEXT,
  reversal_cents INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  decided_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refunds_order ON public.refunds (order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON public.refunds (status);
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order participants can view refunds" ON public.refunds;
CREATE POLICY "Order participants can view refunds" ON public.refunds FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders o WHERE o.id = refunds.order_id
          AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid())))
);
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.refunds FROM anon, authenticated;
GRANT SELECT ON public.refunds TO authenticated;

-- ===========================================================================
-- 3. Disputes: kind, evidence, chargeback fields; one ACTIVE dispute per order
-- ===========================================================================
ALTER TABLE public.disputes
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'dispute',
  ADD COLUMN IF NOT EXISTS previous_status TEXT,
  ADD COLUMN IF NOT EXISTS evidence JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS stripe_dispute_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_status TEXT,
  ADD COLUMN IF NOT EXISTS evidence_due_by TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS amount_cents INTEGER,
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS funds_withdrawn BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_order_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_one_active_per_order ON public.disputes (order_id)
  WHERE status IN ('open', 'under_review', 'escalated');
CREATE UNIQUE INDEX IF NOT EXISTS idx_disputes_stripe_id ON public.disputes (stripe_dispute_id) WHERE stripe_dispute_id IS NOT NULL;
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_kind_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_kind_check CHECK (kind IN ('dispute', 'chargeback'));
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_reason_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_reason_check CHECK (reason = ANY (ARRAY[
  'item_not_as_described', 'item_not_received', 'quality_issue', 'seller_unresponsive', 'buyer_unresponsive',
  'late_delivery', 'unauthorized_charge', 'chargeback', 'other']));
ALTER TABLE public.disputes DROP CONSTRAINT IF EXISTS disputes_resolution_check;
ALTER TABLE public.disputes ADD CONSTRAINT disputes_resolution_check CHECK (resolution = ANY (ARRAY[
  'full_refund', 'partial_refund', 'release_to_seller', 'order_cancelled', 'mutual_agreement',
  'chargeback_won', 'chargeback_lost', NULL]));

-- Notification and ledger vocab
DO $$
DECLARE v_def TEXT; v_types TEXT[]; v_new TEXT[] := ARRAY['refund_approved', 'chargeback_opened', 'chargeback_closed', 'order_cancel_requested'];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';
  IF v_def IS NOT NULL AND v_def NOT LIKE '%chargeback_opened%' THEN
    SELECT array_agg(m[1]) INTO v_types FROM regexp_matches(v_def, '''([a-z_]+)''::text', 'g') AS m;
    v_types := v_types || v_new;
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[%s]::text[]))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_types) AS t));
  END IF;
END $$;
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_entries_account_check;
ALTER TABLE public.ledger_entries ADD CONSTRAINT ledger_entries_account_check CHECK (account IN (
  'stripe_balance', 'stripe_fees_expense', 'buyer_fee_revenue', 'platform_fee_revenue',
  'seller_liability', 'seller_paid_out', 'refunds', 'fx_reserve', 'chargebacks'
));

-- ===========================================================================
-- 4. Helpers
-- ===========================================================================
-- Seller's remaining share in charge currency (what a partial refund can take).
CREATE OR REPLACE FUNCTION public.order_seller_share_remaining_cents(p_order_id UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    COALESCE(o.seller_amount_charge_cents, ROUND(o.seller_amount * 100)::INTEGER)
    - COALESCE((SELECT SUM(r.seller_share_cents) FROM refunds r WHERE r.order_id = o.id AND r.status IN ('approved', 'processing', 'succeeded')), 0),
    0)::INTEGER
  FROM orders o WHERE o.id = p_order_id;
$$;

CREATE OR REPLACE FUNCTION public.order_refundable_cents(p_order_id UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT GREATEST(
    COALESCE((SELECT p.amount_cents - p.refunded_cents FROM payments p WHERE p.order_id = p_order_id AND p.status IN ('succeeded', 'partially_refunded') ORDER BY p.created_at DESC LIMIT 1), 0)
    - COALESCE((SELECT SUM(r.amount_cents) FROM refunds r WHERE r.order_id = p_order_id AND r.status IN ('approved', 'processing')), 0),
    0)::INTEGER;
$$;
REVOKE EXECUTE ON FUNCTION public.order_seller_share_remaining_cents(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_refundable_cents(UUID) FROM PUBLIC, anon, authenticated;

-- Creates a refund row from listing-currency cents (NULL = full). Internal.
CREATE OR REPLACE FUNCTION public.create_refund_row(
  p_order orders, p_initiator UUID, p_role TEXT, p_listing_cents INTEGER, p_reason TEXT, p_status TEXT, p_previous_status TEXT
) RETURNS refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_payment payments%ROWTYPE;
  v_rate NUMERIC := COALESCE(NULLIF(p_order.fx_rate, 0), 1);
  v_cur TEXT := COALESCE(p_order.charge_currency, p_order.currency);
  v_full BOOLEAN := p_listing_cents IS NULL;
  v_refundable INTEGER := order_refundable_cents(p_order.id);
  v_seller_remaining INTEGER := order_seller_share_remaining_cents(p_order.id);
  v_amount INTEGER; v_seller_share INTEGER; v_listing INTEGER;
  v_row refunds%ROWTYPE;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE order_id = p_order.id AND status IN ('succeeded', 'partially_refunded') ORDER BY created_at DESC LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'No payment on this order to refund'; END IF;
  IF v_refundable <= 0 THEN RAISE EXCEPTION 'Nothing left to refund on this order'; END IF;

  IF v_full THEN
    v_amount := v_refundable;
    v_seller_share := v_seller_remaining;
    v_listing := ROUND(v_amount / v_rate)::INTEGER;
  ELSE
    IF p_listing_cents <= 0 THEN RAISE EXCEPTION 'Refund amount must be positive'; END IF;
    v_amount := ROUND(p_listing_cents * v_rate)::INTEGER;
    IF v_amount > v_seller_remaining THEN
      RAISE EXCEPTION 'Partial refunds are limited to the seller''s remaining share (% %)', ROUND(v_seller_remaining / v_rate)::INTEGER / 100.0, UPPER(p_order.currency);
    END IF;
    v_seller_share := v_amount;
    v_listing := p_listing_cents;
  END IF;
  IF v_amount <= 0 THEN RAISE EXCEPTION 'Refund amount rounds to zero'; END IF;

  INSERT INTO refunds (order_id, payment_id, initiated_by, initiator_role, kind, amount_cents, currency,
                       listing_amount_cents, listing_currency, seller_share_cents, reason, status, previous_status,
                       decided_by, decided_at)
  VALUES (p_order.id, v_payment.id, p_initiator, p_role, CASE WHEN v_full THEN 'full' ELSE 'partial' END, v_amount, v_cur,
          v_listing, p_order.currency, v_seller_share, p_reason, p_status, p_previous_status,
          CASE WHEN p_status = 'approved' THEN p_initiator ELSE NULL END, CASE WHEN p_status = 'approved' THEN NOW() ELSE NULL END)
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.create_refund_row(orders, UUID, TEXT, INTEGER, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- 5. Buyer: request a refund (D6: after work started, cancellation = this)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.request_order_refund(p_order_id UUID, p_listing_cents INTEGER DEFAULT NULL, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders%ROWTYPE; v_caller UUID := auth.uid(); v_r refunds%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller <> v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.status NOT IN ('paid', 'in_progress', 'revision_requested', 'submitted', 'delivered', 'completed') THEN
    RAISE EXCEPTION 'Cannot request a refund from status: %', v_order.status;
  END IF;
  IF EXISTS (SELECT 1 FROM payouts py WHERE py.order_id = p_order_id AND py.status = 'sent') THEN
    RAISE EXCEPTION 'The seller has already been paid for this order. Please open a dispute instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = p_order_id AND r.status IN ('requested', 'approved', 'processing', 'needs_review')) THEN
    RAISE EXCEPTION 'A refund is already in progress for this order';
  END IF;

  v_r := create_refund_row(v_order, v_caller, 'buyer', p_listing_cents, p_reason, 'requested', v_order.status);

  UPDATE orders SET status = 'refund_requested', cancel_reason = p_reason, auto_completion_at = NULL, updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'status_change', v_order.status, 'refund_requested',
    jsonb_build_object('action', 'refund_requested', 'refund_id', v_r.id, 'kind', v_r.kind, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency, 'reason', p_reason));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller,
    'Buyer requested a ' || v_r.kind || ' refund' || CASE WHEN v_r.kind = 'partial' THEN ' of ' || to_char(v_r.listing_amount_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) ELSE '' END
    || COALESCE(' — Reason: ' || p_reason, ''), 'system');
  -- notification comes from the status trigger (refund_requested → seller)

  RETURN jsonb_build_object('outcome', 'requested', 'refund_id', v_r.id, 'kind', v_r.kind, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency);
END;
$$;

-- ===========================================================================
-- 6. Seller/admin: decide a request
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.decide_refund_request(p_refund_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r refunds%ROWTYPE; v_order orders%ROWTYPE; v_caller UUID := auth.uid(); v_restore TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_r FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund request not found'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_r.order_id FOR UPDATE;
  IF v_caller <> v_order.seller_id AND NOT is_platform_admin(v_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_r.status <> 'requested' THEN RAISE EXCEPTION 'This refund request was already %', v_r.status; END IF;

  IF p_approve THEN
    UPDATE refunds SET status = 'approved', note = p_note, decided_by = v_caller, decided_at = NOW(), updated_at = NOW() WHERE id = p_refund_id;
    -- a full refund ends the order; a partial one continues from where it was
    IF v_r.kind = 'full' THEN
      UPDATE orders SET status = 'cancelled', cancelled_by = v_order.buyer_id, updated_at = NOW() WHERE id = v_order.id;
    ELSE
      UPDATE orders SET status = COALESCE(v_r.previous_status, 'paid'), updated_at = NOW() WHERE id = v_order.id;
    END IF;
    INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
    VALUES (v_order.id, v_caller, 'status_change', 'refund_requested', CASE WHEN v_r.kind = 'full' THEN 'cancelled' ELSE COALESCE(v_r.previous_status, 'paid') END,
      jsonb_build_object('action', 'refund_approved', 'refund_id', p_refund_id, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency, 'note', p_note));
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (v_order.id, v_caller, 'Refund approved' || COALESCE(': ' || p_note, '.') || ' The money is on its way back to the buyer.', 'system');
    PERFORM create_order_notification(v_order.buyer_id, v_caller, 'refund_approved', v_order.id,
      'Your refund of ' || to_char(v_r.listing_amount_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) || ' was approved and is being processed.');
    RETURN jsonb_build_object('outcome', 'approved', 'refund_id', p_refund_id);
  ELSE
    v_restore := COALESCE(v_r.previous_status, 'paid');
    UPDATE refunds SET status = 'declined', note = p_note, decided_by = v_caller, decided_at = NOW(), updated_at = NOW() WHERE id = p_refund_id;
    UPDATE orders SET status = v_restore, updated_at = NOW() WHERE id = v_order.id;
    INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
    VALUES (v_order.id, v_caller, 'status_change', 'refund_requested', v_restore,
      jsonb_build_object('action', 'refund_declined', 'refund_id', p_refund_id, 'note', p_note));
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (v_order.id, v_caller, 'Refund request declined' || COALESCE(': ' || p_note, '.') || ' You can open a dispute if you disagree.', 'system');
    PERFORM create_order_notification(v_order.buyer_id, v_caller, 'refund_declined', v_order.id,
      'Your refund request was declined' || COALESCE(': ' || p_note, '.'));
    RETURN jsonb_build_object('outcome', 'declined', 'refund_id', p_refund_id, 'status', v_restore);
  END IF;
END;
$$;

-- ===========================================================================
-- 7. Seller/admin: issue a refund proactively (partial keeps the order going)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.issue_order_refund(p_order_id UUID, p_listing_cents INTEGER DEFAULT NULL, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders%ROWTYPE; v_caller UUID := auth.uid(); v_role TEXT; v_r refunds%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller = v_order.seller_id THEN v_role := 'seller';
  ELSIF is_platform_admin(v_caller) THEN v_role := 'admin';
  ELSE RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.status NOT IN ('paid', 'in_progress', 'revision_requested', 'submitted', 'delivered', 'completed', 'refund_requested', 'resolved') THEN
    RAISE EXCEPTION 'Cannot refund an order with status: %', v_order.status;
  END IF;
  IF EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = p_order_id AND r.status IN ('approved', 'processing', 'needs_review')) THEN
    RAISE EXCEPTION 'A refund is already being processed for this order';
  END IF;
  -- an open buyer request is superseded by the seller's own refund
  UPDATE refunds SET status = 'cancelled', note = 'superseded by seller refund', updated_at = NOW()
  WHERE order_id = p_order_id AND status = 'requested';

  v_r := create_refund_row(v_order, v_caller, v_role, p_listing_cents, p_reason, 'approved', v_order.status);

  IF v_r.kind = 'full' THEN
    UPDATE orders SET status = 'cancelled', cancelled_by = v_caller, cancel_reason = COALESCE(p_reason, cancel_reason), auto_completion_at = NULL, updated_at = NOW()
    WHERE id = p_order_id;
  ELSIF v_order.status = 'refund_requested' THEN
    UPDATE orders SET status = COALESCE(v_r.previous_status, 'paid'), updated_at = NOW() WHERE id = p_order_id;
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'payment', v_order.status, CASE WHEN v_r.kind = 'full' THEN 'cancelled' ELSE v_order.status END,
    jsonb_build_object('action', 'refund_issued', 'refund_id', v_r.id, 'kind', v_r.kind, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency, 'by', v_role, 'reason', p_reason));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller,
    initcap(v_role) || ' issued a ' || v_r.kind || ' refund' || CASE WHEN v_r.kind = 'partial' THEN ' of ' || to_char(v_r.listing_amount_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) ELSE '' END
    || COALESCE(' — ' || p_reason, '.'), 'system');
  PERFORM create_order_notification(v_order.buyer_id, v_caller, 'refund_approved', p_order_id,
    'A ' || v_r.kind || ' refund of ' || to_char(v_r.listing_amount_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_order.currency) || ' is being processed for your order.');

  RETURN jsonb_build_object('outcome', 'approved', 'refund_id', v_r.id, 'kind', v_r.kind, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency);
END;
$$;

-- ===========================================================================
-- 8. Cancel (D6)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.cancel_order(p_order_id UUID, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_order orders%ROWTYPE; v_caller UUID := auth.uid(); v_role TEXT; v_r refunds%ROWTYPE;
  v_late BOOLEAN; v_grace INTERVAL := INTERVAL '3 days';
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller = v_order.buyer_id THEN v_role := 'buyer';
  ELSIF v_caller = v_order.seller_id THEN v_role := 'seller';
  ELSIF is_platform_admin(v_caller) THEN v_role := 'admin';
  ELSE RAISE EXCEPTION 'Not authorized'; END IF;

  -- Before any money: plain cancellation (stock restored by trigger).
  IF v_order.status IN ('pending_acceptance', 'pending_payment') THEN
    UPDATE orders SET status = 'cancelled', cancelled_by = v_caller, cancel_reason = p_reason, updated_at = NOW() WHERE id = p_order_id;
    INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
    VALUES (p_order_id, v_caller, 'status_change', v_order.status, 'cancelled', jsonb_build_object('action', 'cancel_order', 'by', v_role, 'reason', p_reason));
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (p_order_id, v_caller, 'Order was cancelled by the ' || v_role || COALESCE(' — Reason: ' || p_reason, ''), 'system');
    RETURN jsonb_build_object('outcome', 'cancelled', 'refund', false);
  END IF;

  IF v_order.status NOT IN ('paid', 'in_progress', 'revision_requested', 'submitted') THEN
    RAISE EXCEPTION 'Cannot cancel an order with status: %', v_order.status;
  END IF;
  IF EXISTS (SELECT 1 FROM payouts py WHERE py.order_id = p_order_id AND py.status = 'sent') THEN
    RAISE EXCEPTION 'The seller has already been paid for this order. Please open a dispute instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM refunds r WHERE r.order_id = p_order_id AND r.status IN ('requested', 'approved', 'processing', 'needs_review')) THEN
    RAISE EXCEPTION 'A refund is already in progress for this order';
  END IF;

  v_late := v_order.due_date IS NOT NULL AND v_order.due_date + v_grace < NOW() AND v_order.status IN ('paid', 'in_progress', 'revision_requested');

  -- Buyer after work started and not late → becomes a refund request.
  IF v_role = 'buyer' AND v_order.status <> 'paid' AND NOT v_late THEN
    RETURN request_order_refund(p_order_id, NULL, COALESCE(p_reason, 'Buyer asked to cancel'));
  END IF;

  -- Otherwise: cancel now with an approved full refund.
  v_r := create_refund_row(v_order, v_caller, v_role, NULL, COALESCE(p_reason, 'Order cancelled'), 'approved', v_order.status);
  UPDATE orders SET status = 'cancelled', cancelled_by = v_caller, cancel_reason = p_reason, auto_completion_at = NULL, updated_at = NOW()
  WHERE id = p_order_id;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'status_change', v_order.status, 'cancelled',
    jsonb_build_object('action', 'cancel_order', 'by', v_role, 'late', v_late, 'refund_id', v_r.id, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency, 'reason', p_reason));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller,
    'Order was cancelled by the ' || v_role || CASE WHEN v_late THEN ' (order was overdue)' ELSE '' END || COALESCE(' — Reason: ' || p_reason, '') || '. A full refund is being processed.', 'system');
  -- 'cancelled' status trigger notifies the other party
  RETURN jsonb_build_object('outcome', 'cancelled', 'refund', true, 'refund_id', v_r.id, 'amount_cents', v_r.amount_cents, 'currency', v_r.currency, 'late', v_late);
END;
$$;

-- update_order_as_* no longer cancel; cancel_order owns it.
CREATE OR REPLACE FUNCTION public.update_order_as_buyer(p_order_id UUID, p_status TEXT, p_cancel_reason TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders; v_result JSONB;
BEGIN
  IF p_status = 'cancelled' THEN RETURN cancel_order(p_order_id, p_cancel_reason); END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  CASE p_status
    WHEN 'completed' THEN
      IF v_order.status NOT IN ('submitted', 'delivered') THEN RAISE EXCEPTION 'Cannot complete from status: %', v_order.status; END IF;
    WHEN 'revision_requested' THEN
      IF v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'Revisions only apply to commission orders'; END IF;
      IF v_order.status != 'submitted' THEN RAISE EXCEPTION 'Cannot request revision from status: %', v_order.status; END IF;
      IF v_order.max_revisions IS NOT NULL AND v_order.revision_count >= v_order.max_revisions THEN RAISE EXCEPTION 'Maximum revisions reached (%)', v_order.max_revisions; END IF;
    ELSE RAISE EXCEPTION 'Invalid buyer status: %', p_status;
  END CASE;
  UPDATE orders SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    revision_count = CASE WHEN p_status = 'revision_requested' THEN revision_count + 1 ELSE revision_count END,
    updated_at = NOW()
  WHERE id = p_order_id;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(), CASE p_status WHEN 'completed' THEN 'Buyer accepted the delivery — order complete!' WHEN 'revision_requested' THEN 'Buyer requested a revision' ELSE 'Order status updated' END, 'system');
  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_order_as_seller(
  p_order_id UUID, p_status TEXT, p_tracking_number TEXT DEFAULT NULL, p_delivery_note TEXT DEFAULT NULL, p_delivery_assets JSONB DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders; v_result JSONB;
BEGIN
  IF p_status = 'cancelled' THEN RETURN cancel_order(p_order_id, p_delivery_note); END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status IN ('in_progress', 'submitted') AND v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'Status % only applies to commission orders', p_status; END IF;
  IF p_status IN ('processing', 'shipped', 'delivered') AND v_order.listing_type <> 'product' THEN RAISE EXCEPTION 'Status % only applies to product orders', p_status; END IF;
  CASE p_status
    WHEN 'in_progress' THEN IF v_order.status NOT IN ('paid', 'revision_requested') THEN RAISE EXCEPTION 'Cannot start work from status: %', v_order.status; END IF;
    WHEN 'submitted' THEN IF v_order.status != 'in_progress' THEN RAISE EXCEPTION 'Cannot submit from status: %', v_order.status; END IF;
    WHEN 'processing' THEN IF v_order.status != 'paid' THEN RAISE EXCEPTION 'Cannot process from status: %', v_order.status; END IF;
    WHEN 'shipped' THEN IF v_order.status NOT IN ('paid', 'processing') THEN RAISE EXCEPTION 'Cannot ship from status: %', v_order.status; END IF;
    WHEN 'delivered' THEN IF v_order.status != 'shipped' THEN RAISE EXCEPTION 'Cannot deliver from status: %', v_order.status; END IF;
    ELSE RAISE EXCEPTION 'Invalid seller status: %', p_status;
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
    updated_at = NOW()
  WHERE id = p_order_id;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(),
    CASE p_status WHEN 'in_progress' THEN 'Seller started working on your order' WHEN 'submitted' THEN 'Seller submitted the delivery for review'
      WHEN 'shipped' THEN 'Order has been shipped' || COALESCE(' — Tracking: ' || p_tracking_number, '') WHEN 'delivered' THEN 'Order has been delivered'
      WHEN 'processing' THEN 'Order is being processed' ELSE 'Order status updated' END, 'system');
  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$$;

-- ===========================================================================
-- 9. Refund execution bookkeeping (service_role; the worker moves the money)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.claim_approved_refunds(p_order_id UUID DEFAULT NULL, p_limit INTEGER DEFAULT 25)
RETURNS SETOF public.refunds
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  UPDATE refunds SET status = 'processing', attempts = attempts + 1, updated_at = NOW()
  WHERE id IN (
    SELECT id FROM refunds
    WHERE status = 'approved' AND (p_order_id IS NULL OR order_id = p_order_id)
    ORDER BY created_at
    FOR UPDATE SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 25), 1)
  )
  RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_refund_submitted(p_refund_id UUID, p_stripe_refund_id TEXT, p_reversal_id TEXT DEFAULT NULL, p_reversal_cents INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  UPDATE refunds SET stripe_refund_id = p_stripe_refund_id, reversal_id = COALESCE(p_reversal_id, reversal_id),
    reversal_cents = GREATEST(reversal_cents, COALESCE(p_reversal_cents, 0)), last_error = NULL, updated_at = NOW()
  WHERE id = p_refund_id AND status = 'processing';
  RETURN jsonb_build_object('outcome', 'submitted');
END;
$$;

-- Reversal impossible (seller already withdrew) or Stripe error: park it.
CREATE OR REPLACE FUNCTION public.mark_refund_needs_review(p_refund_id UUID, p_error TEXT, p_retryable BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_r refunds%ROWTYPE; v_status TEXT;
BEGIN
  SELECT * INTO v_r FROM refunds WHERE id = p_refund_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Refund not found'; END IF;
  v_status := CASE WHEN p_retryable AND v_r.attempts < 3 THEN 'approved' ELSE 'needs_review' END;
  UPDATE refunds SET status = v_status, last_error = p_error, updated_at = NOW() WHERE id = p_refund_id;
  IF v_status = 'needs_review' THEN
    INSERT INTO order_events (order_id, event_type, metadata)
    VALUES (v_r.order_id, 'payment', jsonb_build_object('action', 'refund_needs_review', 'refund_id', p_refund_id, 'error', p_error));
    INSERT INTO notifications (user_id, actor_id, type, order_id, content)
    SELECT pa.user_id, pa.user_id, 'order_transfer_failed', v_r.order_id, 'A refund needs manual review: ' || left(p_error, 140)
    FROM platform_admins pa;
  END IF;
  RETURN jsonb_build_object('outcome', v_status);
END;
$$;

-- charge.refunded → mark the matching refund row succeeded (or record a dashboard refund).
CREATE OR REPLACE FUNCTION public.record_payment_refund(
  p_payment_intent_id TEXT, p_refund_id TEXT, p_refunded_cents_total INTEGER, p_charge_cents INTEGER,
  p_reason TEXT, p_event_id TEXT, p_source TEXT DEFAULT 'stripe.webhook'
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_payment payments%ROWTYPE; v_order orders%ROWTYPE; v_full BOOLEAN; v_delta_cents INTEGER; v_new_status TEXT;
  v_payout payouts%ROWTYPE; v_refund refunds%ROWTYPE;
  v_seller_cents BIGINT; v_platform_cents BIGINT; v_buyer_cents BIGINT; v_reserve_cents BIGINT; v_seller_share BIGINT;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE payment_intent_id = p_payment_intent_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'no_payment_record'); END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id FOR UPDATE;

  v_full := p_refunded_cents_total >= COALESCE(NULLIF(p_charge_cents, 0), v_payment.amount_cents);
  v_delta_cents := p_refunded_cents_total - v_payment.refunded_cents;
  IF v_delta_cents <= 0 THEN RETURN jsonb_build_object('outcome', 'already_processed', 'refunded_cents', v_payment.refunded_cents); END IF;

  UPDATE payments SET refunded_cents = p_refunded_cents_total,
    status = CASE WHEN v_payment.status IN ('amount_mismatch', 'unexpected_status') THEN v_payment.status WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END,
    last_event_id = p_event_id, metadata = metadata || jsonb_build_object('last_refund_id', p_refund_id, 'refund_reason', p_reason), updated_at = NOW()
  WHERE id = v_payment.id;

  -- Link to the refunds row that asked for it (by Stripe refund id, else the processing one), or record an external refund.
  SELECT * INTO v_refund FROM refunds WHERE order_id = v_order.id AND (stripe_refund_id = p_refund_id OR (stripe_refund_id IS NULL AND status = 'processing')) ORDER BY created_at LIMIT 1 FOR UPDATE;
  IF FOUND THEN
    UPDATE refunds SET status = 'succeeded', stripe_refund_id = COALESCE(stripe_refund_id, p_refund_id), updated_at = NOW() WHERE id = v_refund.id;
    v_seller_share := v_refund.seller_share_cents;
  ELSIF v_payment.status NOT IN ('amount_mismatch', 'unexpected_status') THEN
    INSERT INTO refunds (order_id, payment_id, initiator_role, kind, amount_cents, currency, listing_amount_cents, listing_currency,
                         seller_share_cents, reason, status, stripe_refund_id, previous_status)
    VALUES (v_order.id, v_payment.id, 'stripe', CASE WHEN v_full THEN 'full' ELSE 'partial' END, v_delta_cents, v_payment.currency,
            ROUND(v_delta_cents / COALESCE(NULLIF(v_order.fx_rate, 0), 1))::INTEGER, v_order.currency,
            CASE WHEN v_full THEN order_seller_share_remaining_cents(v_order.id) ELSE LEAST(v_delta_cents, order_seller_share_remaining_cents(v_order.id)) END,
            COALESCE(p_reason, 'refund issued in Stripe'), 'succeeded', p_refund_id, v_order.status)
    RETURNING * INTO v_refund;
    v_seller_share := v_refund.seller_share_cents;
  ELSE
    v_seller_share := 0;
  END IF;

  INSERT INTO transactions (order_id, type, amount, currency, status, stripe_payment_intent_id, metadata)
  VALUES (v_order.id, 'refund', ROUND(v_delta_cents / 100.0 / COALESCE(NULLIF(v_order.fx_rate, 0), 1), 2), v_order.currency, 'completed', p_payment_intent_id,
    jsonb_build_object('provider', 'stripe', 'refund_id', p_refund_id, 'reason', p_reason, 'stripe_event_id', p_event_id, 'source', p_source,
                       'refund_type', CASE WHEN v_full THEN 'full' ELSE 'partial' END, 'refunded_cents', v_delta_cents, 'charge_currency', v_payment.currency));

  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'stripe_balance', 'refund', -v_delta_cents, v_payment.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));
  PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'refunds', 'refund', v_delta_cents, v_payment.currency, 'refund', p_refund_id, jsonb_build_object('reason', p_reason));

  IF v_payment.status IN ('amount_mismatch', 'unexpected_status') THEN
    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (v_order.id, v_order.buyer_id, 'payment', jsonb_build_object('action', 'mismatched_payment_refunded', 'refund_id', p_refund_id, 'refunded_cents', v_delta_cents, 'stripe_event_id', p_event_id));
    RETURN jsonb_build_object('outcome', 'mismatch_refunded', 'status', v_order.status);
  END IF;

  v_new_status := CASE WHEN v_full AND v_order.status NOT IN ('cancelled', 'expired', 'declined', 'resolved') THEN 'refunded' ELSE v_order.status END;
  UPDATE orders SET payment_status = CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END, status = v_new_status,
    auto_completion_at = CASE WHEN v_full THEN NULL ELSE auto_completion_at END, updated_at = NOW()
  WHERE id = v_order.id;

  SELECT * INTO v_payout FROM payouts WHERE order_id = v_order.id FOR UPDATE;
  IF v_full THEN
    UPDATE transactions SET status = 'refunded' WHERE order_id = v_order.id AND type = 'seller_payout' AND status = 'pending';
    IF FOUND AND v_payout.status IN ('pending', 'blocked', 'failed', 'processing') THEN
      UPDATE payouts SET status = 'cancelled', last_error = 'order refunded', updated_at = NOW() WHERE id = v_payout.id;
    END IF;
    v_seller_cents := order_seller_share_remaining_cents(v_order.id) + COALESCE(v_seller_share, 0);
    v_platform_cents := COALESCE(v_order.platform_fee_charge_cents, ROUND(v_order.platform_fee * 100))::BIGINT;
    v_buyer_cents := COALESCE(v_order.buyer_fee_charge_cents, ROUND(v_order.buyer_fee * 100))::BIGINT;
    v_reserve_cents := v_payment.amount_cents - (COALESCE(v_order.seller_amount_charge_cents, ROUND(v_order.seller_amount * 100))::BIGINT + v_platform_cents + v_buyer_cents);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'seller_liability', 'refund', -v_seller_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'platform_fee_revenue', 'refund', -v_platform_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'buyer_fee_revenue', 'refund', -v_buyer_cents, v_payment.currency, 'refund', p_refund_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'fx_reserve', 'refund', -v_reserve_cents, v_payment.currency, 'refund', p_refund_id);
  ELSE
    -- Partial: the seller's share shrinks; a not-yet-sent payout shrinks with it.
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'seller_liability', 'partial_refund', -COALESCE(v_seller_share, 0), v_payment.currency, 'refund', p_refund_id);
    IF FOUND AND v_payout.status IN ('pending', 'blocked', 'failed') AND COALESCE(v_seller_share, 0) > 0 THEN
      IF v_payout.amount_cents - v_seller_share <= 0 THEN
        UPDATE payouts SET status = 'cancelled', last_error = 'consumed by refunds', updated_at = NOW() WHERE id = v_payout.id;
      ELSE
        UPDATE payouts SET amount_cents = amount_cents - v_seller_share, updated_at = NOW() WHERE id = v_payout.id;
      END IF;
    END IF;
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order.id, v_order.buyer_id, 'payment', v_order.status, v_new_status,
    jsonb_build_object('action', CASE WHEN v_full THEN 'refund' ELSE 'partial_refund' END, 'refund_id', p_refund_id, 'refunds_row', v_refund.id,
                       'refunded_cents', v_delta_cents, 'refunded_total_cents', p_refunded_cents_total, 'currency', v_payment.currency,
                       'reason', p_reason, 'stripe_event_id', p_event_id, 'source', p_source));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order.id, v_order.buyer_id, CASE WHEN v_full THEN 'Your payment has been refunded.' ELSE 'A partial refund has been issued for your payment.' END, 'system');
  IF NOT v_full THEN
    PERFORM create_order_notification(v_order.buyer_id, v_order.seller_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_payment.currency) || ' has been issued.');
    PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'order_refunded', v_order.id,
      'A partial refund of ' || to_char(v_delta_cents / 100.0, 'FM999990.00') || ' ' || UPPER(v_payment.currency) || ' was processed on your order.');
  END IF;
  RETURN jsonb_build_object('outcome', CASE WHEN v_full THEN 'refunded' ELSE 'partially_refunded' END, 'status', v_new_status, 'refunded_cents', p_refunded_cents_total);
END;
$$;

-- ===========================================================================
-- 10. Disputes: open (with previous_status), evidence, admin resolution
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.open_dispute(p_order_id UUID, p_reason TEXT, p_description TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_order orders; v_dispute disputes; v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller != v_order.buyer_id AND v_caller != v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.status IN ('pending_acceptance', 'declined', 'pending_payment', 'expired', 'cancelled', 'refunded', 'disputed') THEN
    RAISE EXCEPTION 'Cannot dispute order with status: %', v_order.status;
  END IF;
  IF COALESCE(v_order.payment_status, '') NOT IN ('paid', 'partially_refunded') THEN RAISE EXCEPTION 'Cannot dispute an order that has not been paid'; END IF;
  IF EXISTS (SELECT 1 FROM disputes WHERE order_id = p_order_id AND status IN ('open', 'under_review', 'escalated')) THEN
    RAISE EXCEPTION 'An active dispute already exists for this order';
  END IF;
  -- an open refund request is folded into the dispute
  UPDATE refunds SET status = 'cancelled', note = 'superseded by dispute', updated_at = NOW() WHERE order_id = p_order_id AND status = 'requested';

  INSERT INTO disputes (order_id, initiated_by, reason, description, kind, previous_status, amount_cents, currency)
  VALUES (p_order_id, v_caller, p_reason, p_description, 'dispute',
          CASE WHEN v_order.status = 'refund_requested' THEN COALESCE((SELECT previous_status FROM refunds WHERE order_id = p_order_id ORDER BY created_at DESC LIMIT 1), 'paid') ELSE v_order.status END,
          order_refundable_cents(p_order_id), COALESCE(v_order.charge_currency, v_order.currency))
  RETURNING * INTO v_dispute;

  UPDATE orders SET status = 'disputed', auto_completion_at = NULL, updated_at = NOW() WHERE id = p_order_id;
  UPDATE payouts SET status = 'blocked', block_reason = 'dispute_open', updated_at = NOW() WHERE order_id = p_order_id AND status IN ('pending', 'failed');

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'dispute', v_order.status, 'disputed', jsonb_build_object('dispute_id', v_dispute.id, 'reason', p_reason));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller, 'A dispute has been opened: ' ||
    CASE p_reason WHEN 'item_not_as_described' THEN 'Item not as described' WHEN 'item_not_received' THEN 'Item not received' WHEN 'quality_issue' THEN 'Quality issue'
      WHEN 'seller_unresponsive' THEN 'Seller unresponsive' WHEN 'buyer_unresponsive' THEN 'Buyer unresponsive' WHEN 'late_delivery' THEN 'Late delivery'
      WHEN 'unauthorized_charge' THEN 'Unauthorized charge' ELSE 'Other' END || '. Pinkquill will review it.', 'system');
  PERFORM create_order_notification(CASE WHEN v_caller = v_order.buyer_id THEN v_order.seller_id ELSE v_order.buyer_id END, v_caller, 'order_disputed', p_order_id, 'A dispute has been opened on your order');
  INSERT INTO notifications (user_id, actor_id, type, order_id, content)
  SELECT pa.user_id, v_caller, 'order_disputed', p_order_id, 'A dispute needs review' FROM platform_admins pa WHERE pa.user_id <> v_caller;
  RETURN to_jsonb(v_dispute);
END;
$$;

CREATE OR REPLACE FUNCTION public.add_dispute_evidence(p_dispute_id UUID, p_text TEXT, p_attachments JSONB DEFAULT '[]'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_d disputes%ROWTYPE; v_order orders%ROWTYPE; v_caller UUID := auth.uid(); v_item JSONB;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF v_d.status NOT IN ('open', 'under_review', 'escalated') THEN RAISE EXCEPTION 'This dispute is closed'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_d.order_id;
  IF v_caller <> v_order.buyer_id AND v_caller <> v_order.seller_id AND NOT is_platform_admin(v_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF length(trim(COALESCE(p_text, ''))) = 0 AND jsonb_array_length(COALESCE(p_attachments, '[]'::jsonb)) = 0 THEN RAISE EXCEPTION 'Evidence cannot be empty'; END IF;
  v_item := jsonb_build_object('by', v_caller, 'role', CASE WHEN v_caller = v_order.buyer_id THEN 'buyer' WHEN v_caller = v_order.seller_id THEN 'seller' ELSE 'admin' END,
                               'text', left(COALESCE(p_text, ''), 5000), 'attachments', COALESCE(p_attachments, '[]'::jsonb), 'at', NOW());
  UPDATE disputes SET evidence = evidence || jsonb_build_array(v_item), status = CASE WHEN status = 'open' THEN 'under_review' ELSE status END, updated_at = NOW() WHERE id = p_dispute_id;
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_d.order_id, v_caller, 'Evidence added to the dispute.', 'system');
  RETURN jsonb_build_object('outcome', 'added', 'evidence_count', jsonb_array_length(v_d.evidence) + 1);
END;
$$;

-- Admin only (called from /api/admin/disputes with the admin's id).
CREATE OR REPLACE FUNCTION public.resolve_dispute(
  p_dispute_id UUID, p_resolution TEXT, p_resolution_notes TEXT DEFAULT NULL, p_refund_amount NUMERIC DEFAULT NULL, p_admin_id UUID DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_d disputes%ROWTYPE; v_order orders%ROWTYPE; v_admin UUID := COALESCE(p_admin_id, auth.uid()); v_r refunds%ROWTYPE; v_new_status TEXT; v_listing_cents INTEGER;
BEGIN
  IF v_admin IS NULL OR NOT is_platform_admin(v_admin) THEN RAISE EXCEPTION 'Only a platform admin can resolve disputes'; END IF;
  SELECT * INTO v_d FROM disputes WHERE id = p_dispute_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dispute not found'; END IF;
  IF v_d.status NOT IN ('open', 'under_review', 'escalated') THEN RAISE EXCEPTION 'Dispute is not active'; END IF;
  IF v_d.kind = 'chargeback' THEN RAISE EXCEPTION 'Chargebacks are decided by the card network; respond with evidence in Stripe'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_d.order_id FOR UPDATE;

  CASE p_resolution
    WHEN 'full_refund' THEN
      v_r := create_refund_row(v_order, v_admin, 'admin', NULL, 'Dispute resolved: full refund', 'approved', v_d.previous_status);
      v_new_status := 'cancelled';
    WHEN 'partial_refund' THEN
      IF p_refund_amount IS NULL OR p_refund_amount <= 0 THEN RAISE EXCEPTION 'partial_refund needs a positive amount'; END IF;
      v_listing_cents := ROUND(p_refund_amount * 100)::INTEGER;
      v_r := create_refund_row(v_order, v_admin, 'admin', v_listing_cents, 'Dispute resolved: partial refund', 'approved', v_d.previous_status);
      v_new_status := COALESCE(v_d.previous_status, 'completed');
    WHEN 'release_to_seller' THEN v_new_status := COALESCE(v_d.previous_status, 'completed');
    WHEN 'order_cancelled' THEN
      v_r := create_refund_row(v_order, v_admin, 'admin', NULL, 'Dispute resolved: order cancelled', 'approved', v_d.previous_status);
      v_new_status := 'cancelled';
    WHEN 'mutual_agreement' THEN
      IF p_refund_amount IS NOT NULL AND p_refund_amount > 0 THEN
        v_r := create_refund_row(v_order, v_admin, 'admin', ROUND(p_refund_amount * 100)::INTEGER, 'Dispute resolved: mutual agreement', 'approved', v_d.previous_status);
      END IF;
      v_new_status := COALESCE(v_d.previous_status, 'completed');
    ELSE RAISE EXCEPTION 'Invalid resolution: %', p_resolution;
  END CASE;

  UPDATE disputes SET status = 'resolved', resolution = p_resolution, resolution_notes = p_resolution_notes,
    refund_amount = p_refund_amount, resolved_by = v_admin, resolved_at = NOW(), updated_at = NOW() WHERE id = p_dispute_id;
  UPDATE orders SET status = v_new_status, cancelled_by = CASE WHEN v_new_status = 'cancelled' THEN v_admin ELSE cancelled_by END, updated_at = NOW() WHERE id = v_order.id;
  -- money continues: blocked payout back to the queue (the release gate re-checks), or cancelled by the refund
  UPDATE payouts SET status = 'pending', block_reason = NULL, eligible_at = NOW(), updated_at = NOW()
  WHERE order_id = v_order.id AND status = 'blocked' AND block_reason = 'dispute_open' AND p_resolution IN ('release_to_seller', 'partial_refund', 'mutual_agreement');

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order.id, v_admin, 'dispute', 'disputed', v_new_status,
    jsonb_build_object('dispute_id', p_dispute_id, 'resolution', p_resolution, 'refund_amount', p_refund_amount, 'refund_id', v_r.id));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order.id, v_admin, 'Dispute resolved: ' ||
    CASE p_resolution WHEN 'full_refund' THEN 'full refund to the buyer' WHEN 'partial_refund' THEN 'partial refund of ' || to_char(p_refund_amount, 'FM999990.00') || ' ' || UPPER(v_order.currency)
      WHEN 'release_to_seller' THEN 'funds released to the seller' WHEN 'order_cancelled' THEN 'order cancelled and refunded' ELSE 'mutual agreement' END
    || COALESCE(' — ' || p_resolution_notes, ''), 'system');
  PERFORM create_order_notification(v_order.buyer_id, v_admin, 'dispute_resolved', v_order.id, 'Your dispute has been resolved');
  PERFORM create_order_notification(v_order.seller_id, v_admin, 'dispute_resolved', v_order.id, 'A dispute on your order has been resolved');
  RETURN jsonb_build_object('outcome', 'resolved', 'resolution', p_resolution, 'status', v_new_status, 'refund_id', v_r.id);
END;
$$;

-- ===========================================================================
-- 11. Chargebacks (card-network disputes) — from charge.dispute.* webhooks
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.record_chargeback(
  p_payment_intent_id TEXT, p_stripe_dispute_id TEXT, p_phase TEXT, p_stripe_status TEXT, p_reason TEXT,
  p_amount_cents INTEGER, p_currency TEXT, p_evidence_due_by TIMESTAMPTZ, p_event_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_payment payments%ROWTYPE; v_order orders%ROWTYPE; v_d disputes%ROWTYPE; v_payout payouts%ROWTYPE; v_won BOOLEAN;
BEGIN
  SELECT * INTO v_payment FROM payments WHERE payment_intent_id = p_payment_intent_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('outcome', 'no_payment_record'); END IF;
  SELECT * INTO v_order FROM orders WHERE id = v_payment.order_id FOR UPDATE;
  SELECT * INTO v_d FROM disputes WHERE stripe_dispute_id = p_stripe_dispute_id FOR UPDATE;

  IF NOT FOUND THEN
    -- any active manual dispute is superseded by the card-network one
    UPDATE disputes SET status = 'cancelled', resolution_notes = 'superseded by chargeback ' || p_stripe_dispute_id, updated_at = NOW()
    WHERE order_id = v_order.id AND status IN ('open', 'under_review', 'escalated');
    UPDATE refunds SET status = 'cancelled', note = 'superseded by chargeback', updated_at = NOW() WHERE order_id = v_order.id AND status IN ('requested', 'approved');
    INSERT INTO disputes (order_id, initiated_by, reason, description, kind, previous_status, stripe_dispute_id, stripe_status, evidence_due_by, amount_cents, currency, status)
    VALUES (v_order.id, v_order.buyer_id, 'chargeback', 'Card-network dispute (' || COALESCE(p_reason, 'unknown') || ')', 'chargeback',
            CASE WHEN v_order.status = 'disputed' THEN COALESCE((SELECT previous_status FROM disputes WHERE order_id = v_order.id AND kind = 'dispute' ORDER BY created_at DESC LIMIT 1), 'completed') ELSE v_order.status END,
            p_stripe_dispute_id, p_stripe_status, p_evidence_due_by, p_amount_cents, p_currency, 'open')
    RETURNING * INTO v_d;
    IF v_order.status NOT IN ('cancelled', 'refunded', 'expired', 'declined') THEN
      UPDATE orders SET status = 'disputed', auto_completion_at = NULL, updated_at = NOW() WHERE id = v_order.id;
    END IF;
    UPDATE payouts SET status = 'blocked', block_reason = 'chargeback', updated_at = NOW() WHERE order_id = v_order.id AND status IN ('pending', 'failed');
    INSERT INTO order_events (order_id, event_type, from_status, to_status, metadata)
    VALUES (v_order.id, 'dispute', v_order.status, 'disputed', jsonb_build_object('action', 'chargeback_created', 'stripe_dispute_id', p_stripe_dispute_id,
      'dispute_status', p_stripe_status, 'reason', p_reason, 'amount_cents', p_amount_cents, 'currency', p_currency, 'evidence_due_by', p_evidence_due_by, 'stripe_event_id', p_event_id));
    INSERT INTO order_messages (order_id, sender_id, content, message_type)
    VALUES (v_order.id, v_order.buyer_id, 'The buyer''s bank has opened a chargeback on this payment. Pinkquill is handling it with Stripe.', 'system');
    PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'chargeback_opened', v_order.id,
      'The buyer''s bank disputed this payment. Any payout is on hold' || COALESCE('; evidence is due by ' || to_char(p_evidence_due_by, 'YYYY-MM-DD'), '') || '.');
    INSERT INTO notifications (user_id, actor_id, type, order_id, content)
    SELECT pa.user_id, v_order.buyer_id, 'chargeback_opened', v_order.id, 'Chargeback ' || p_stripe_dispute_id || ' — submit evidence in Stripe' || COALESCE(' by ' || to_char(p_evidence_due_by, 'YYYY-MM-DD'), '') FROM platform_admins pa;
  END IF;

  IF p_phase = 'funds_withdrawn' AND NOT v_d.funds_withdrawn THEN
    UPDATE disputes SET funds_withdrawn = TRUE, stripe_status = p_stripe_status, updated_at = NOW() WHERE id = v_d.id;
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'stripe_balance', 'chargeback_withdrawn', -p_amount_cents, p_currency, 'dispute', p_stripe_dispute_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'chargebacks', 'chargeback_withdrawn', p_amount_cents, p_currency, 'dispute', p_stripe_dispute_id);
  ELSIF p_phase = 'funds_reinstated' AND v_d.funds_withdrawn THEN
    UPDATE disputes SET funds_withdrawn = FALSE, stripe_status = p_stripe_status, updated_at = NOW() WHERE id = v_d.id;
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'stripe_balance', 'chargeback_reinstated', p_amount_cents, p_currency, 'dispute', p_stripe_dispute_id);
    PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'chargebacks', 'chargeback_reinstated', -p_amount_cents, p_currency, 'dispute', p_stripe_dispute_id);
  ELSIF p_phase = 'updated' THEN
    UPDATE disputes SET stripe_status = p_stripe_status, evidence_due_by = COALESCE(p_evidence_due_by, evidence_due_by), updated_at = NOW() WHERE id = v_d.id;
  ELSIF p_phase = 'closed' AND v_d.status IN ('open', 'under_review', 'escalated') THEN
    v_won := p_stripe_status = 'won';
    UPDATE disputes SET status = 'resolved', stripe_status = p_stripe_status, resolution = CASE WHEN v_won THEN 'chargeback_won' ELSE 'chargeback_lost' END,
      resolved_at = NOW(), updated_at = NOW() WHERE id = v_d.id;
    IF v_won THEN
      UPDATE orders SET status = COALESCE(v_d.previous_status, 'completed'), updated_at = NOW() WHERE id = v_order.id AND status = 'disputed';
      UPDATE payouts SET status = 'pending', block_reason = NULL, eligible_at = NOW(), updated_at = NOW() WHERE order_id = v_order.id AND status = 'blocked' AND block_reason = 'chargeback';
    ELSE
      -- Lost: the bank took the money. Treat like a full external refund for the seller's share.
      UPDATE orders SET status = 'refunded', payment_status = 'refunded', updated_at = NOW() WHERE id = v_order.id;
      UPDATE payouts SET status = 'cancelled', last_error = 'chargeback lost', updated_at = NOW() WHERE order_id = v_order.id AND status IN ('pending', 'blocked', 'failed', 'processing');
      UPDATE transactions SET status = 'refunded' WHERE order_id = v_order.id AND type = 'seller_payout' AND status = 'pending';
      PERFORM ledger_post(v_order.id, v_payment.id, NULL, 'seller_liability', 'chargeback_lost', -order_seller_share_remaining_cents(v_order.id), p_currency, 'dispute', p_stripe_dispute_id);
      INSERT INTO refunds (order_id, payment_id, initiator_role, kind, amount_cents, currency, listing_amount_cents, listing_currency, seller_share_cents, reason, status, previous_status)
      VALUES (v_order.id, v_payment.id, 'stripe', 'full', GREATEST(p_amount_cents, 1), p_currency, ROUND(p_amount_cents / COALESCE(NULLIF(v_order.fx_rate, 0), 1))::INTEGER, v_order.currency,
              order_seller_share_remaining_cents(v_order.id), 'chargeback lost (' || p_stripe_dispute_id || ')', 'succeeded', v_d.previous_status);
    END IF;
    INSERT INTO order_events (order_id, event_type, metadata)
    VALUES (v_order.id, 'dispute', jsonb_build_object('action', 'chargeback_closed', 'stripe_dispute_id', p_stripe_dispute_id, 'dispute_status', p_stripe_status, 'stripe_event_id', p_event_id));
    PERFORM create_order_notification(v_order.seller_id, v_order.buyer_id, 'chargeback_closed', v_order.id,
      CASE WHEN v_won THEN 'The chargeback on your order was resolved in your favour.' ELSE 'The chargeback on your order was lost; the payment was returned to the buyer''s bank.' END);
  END IF;

  RETURN jsonb_build_object('outcome', p_phase, 'dispute_id', v_d.id, 'order_status', (SELECT status FROM orders WHERE id = v_order.id),
    'payout_transfer_id', (SELECT transfer_id FROM payouts WHERE order_id = v_order.id AND status = 'sent'),
    'payout_id', (SELECT id FROM payouts WHERE order_id = v_order.id AND status = 'sent'));
END;
$$;

-- ===========================================================================
-- 12. get_order_actions — the server tells the client what is allowed
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_order_actions(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_o orders%ROWTYPE; v_caller UUID := auth.uid(); v_role TEXT; v_window NUMERIC := platform_setting_numeric('release_window_hours', 168);
  v_payout payouts%ROWTYPE; v_refund refunds%ROWTYPE; v_dispute disputes%ROWTYPE; v_late BOOLEAN; v_paid_out BOOLEAN; v_refund_busy BOOLEAN;
  v_is_service BOOLEAN;
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
    'payout', CASE WHEN v_payout.id IS NULL THEN NULL ELSE jsonb_build_object('status', v_payout.status, 'amount_cents', v_payout.amount_cents, 'currency', v_payout.currency, 'listing_amount_cents', v_payout.listing_amount_cents, 'sent_at', v_payout.sent_at, 'block_reason', v_payout.block_reason) END,
    'release_at', CASE WHEN v_o.status = 'completed' AND v_o.completed_at IS NOT NULL THEN v_o.completed_at + make_interval(hours => v_window::INTEGER) ELSE NULL END,
    'auto_complete_at', v_o.auto_completion_at,
    'refund', CASE WHEN v_refund.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_refund.id, 'status', v_refund.status, 'kind', v_refund.kind, 'amount_cents', v_refund.amount_cents, 'currency', v_refund.currency, 'listing_amount_cents', v_refund.listing_amount_cents, 'initiator_role', v_refund.initiator_role, 'reason', v_refund.reason) END,
    'dispute', CASE WHEN v_dispute.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_dispute.id, 'kind', v_dispute.kind, 'status', v_dispute.status, 'reason', v_dispute.reason, 'evidence_due_by', v_dispute.evidence_due_by, 'evidence_count', jsonb_array_length(v_dispute.evidence)) END
  );
END;
$$;

-- ===========================================================================
-- 13. Grants
-- ===========================================================================
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.request_order_refund(UUID, INTEGER, TEXT)', 'public.decide_refund_request(UUID, BOOLEAN, TEXT)',
    'public.issue_order_refund(UUID, INTEGER, TEXT)', 'public.cancel_order(UUID, TEXT)',
    'public.add_dispute_evidence(UUID, TEXT, JSONB)', 'public.get_order_actions(UUID)', 'public.open_dispute(UUID, TEXT, TEXT)',
    'public.update_order_as_buyer(UUID, TEXT, TEXT)', 'public.update_order_as_seller(UUID, TEXT, TEXT, TEXT, JSONB)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
  FOREACH f IN ARRAY ARRAY[
    'public.claim_approved_refunds(UUID, INTEGER)', 'public.mark_refund_submitted(UUID, TEXT, TEXT, INTEGER)',
    'public.mark_refund_needs_review(UUID, TEXT, BOOLEAN)', 'public.resolve_dispute(UUID, TEXT, TEXT, NUMERIC, UUID)',
    'public.record_chargeback(TEXT, TEXT, TEXT, TEXT, TEXT, INTEGER, TEXT, TIMESTAMPTZ, TEXT)',
    'public.record_payment_refund(TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
-- request_refund (old) is superseded; keep it callable but route everything to the new one.
CREATE OR REPLACE FUNCTION public.request_refund(p_order_id UUID, p_reason TEXT DEFAULT NULL) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.request_order_refund(p_order_id, NULL, p_reason); $$;
