-- Phase 2d — Timelines & notifications (2026-09-03)
-- Due-date engine (reminders at -24 h / due / +48 h late), extension requests,
-- richer in-app notifications (title, amount, CTA via metadata), and an email
-- hook: every order notification is posted to /api/notifications/email through
-- pg_net; the route renders one template system and sends through the provider
-- (D7 = Resend, behind lib/email). Idempotent. No money-path change.

-- ===========================================================================
-- 1. notifications: metadata + emailed_at + new types; profiles.email_preferences
-- ===========================================================================
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS emailed_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
DECLARE v_def TEXT; v_types TEXT[];
  v_new TEXT[] := ARRAY['order_due_soon', 'order_due', 'order_late', 'extension_requested', 'extension_accepted', 'extension_declined'];
BEGIN
  SELECT pg_get_constraintdef(oid) INTO v_def
  FROM pg_constraint WHERE conrelid = 'public.notifications'::regclass AND conname = 'notifications_type_check';
  IF v_def IS NOT NULL AND v_def NOT LIKE '%extension_requested%' THEN
    SELECT array_agg(m[1]) INTO v_types FROM regexp_matches(v_def, '''([a-z_]+)''::text', 'g') AS m;
    v_types := v_types || v_new;
    ALTER TABLE public.notifications DROP CONSTRAINT notifications_type_check;
    EXECUTE format('ALTER TABLE public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[%s]::text[]))',
      (SELECT string_agg(quote_literal(t), ', ') FROM unnest(v_types) AS t));
  END IF;
END $$;

-- create_order_notification now snapshots what the panel and the email need:
-- order number, listing title, the recipient's own money figure, the status.
CREATE OR REPLACE FUNCTION public.create_order_notification(
  p_user_id UUID, p_actor_id UUID, p_type TEXT, p_order_id UUID, p_content TEXT DEFAULT NULL
) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  v_id UUID; v_meta JSONB := '{}'::jsonb;
BEGIN
  IF p_user_id = p_actor_id THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'order_number', o.order_number, 'title', p.title, 'listing_type', o.listing_type, 'status', o.status,
    'currency', o.currency, 'due_date', o.due_date,
    'amount', CASE WHEN p_user_id = o.seller_id THEN o.seller_amount ELSE COALESCE(o.total_amount, o.amount) END,
    'role', CASE WHEN p_user_id = o.seller_id THEN 'seller' ELSE 'buyer' END
  ) INTO v_meta
  FROM orders o LEFT JOIN products p ON p.id = o.product_id WHERE o.id = p_order_id;
  INSERT INTO notifications (user_id, actor_id, type, order_id, content, metadata)
  VALUES (p_user_id, p_actor_id, p_type, p_order_id, p_content, COALESCE(v_meta, '{}'::jsonb))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ===========================================================================
-- 2. Extension requests
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.order_extensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  old_due_date TIMESTAMPTZ,
  new_due_date TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'withdrawn')),
  responded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  response_note TEXT,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_extensions_order ON public.order_extensions (order_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_extensions_one_pending ON public.order_extensions (order_id) WHERE status = 'pending';
ALTER TABLE public.order_extensions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order participants can view extensions" ON public.order_extensions;
CREATE POLICY "Order participants can view extensions" ON public.order_extensions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND (o.buyer_id = (SELECT auth.uid()) OR o.seller_id = (SELECT auth.uid()))) OR public.is_platform_admin((SELECT auth.uid())));
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.order_extensions FROM anon, authenticated;
GRANT SELECT ON public.order_extensions TO authenticated;

-- Reminder ladder rows (service-only; reset when a new due date is agreed)
CREATE TABLE IF NOT EXISTS public.order_reminders (
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('due_24h', 'due_now', 'late_48h')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (order_id, kind)
);
ALTER TABLE public.order_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_reminders FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.request_order_extension(p_order_id UUID, p_new_due_date TIMESTAMPTZ, p_reason TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_o orders%ROWTYPE; v_caller UUID := auth.uid(); v_id UUID; v_days INTEGER; v_base TIMESTAMPTZ;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_o FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_caller <> v_o.seller_id THEN RAISE EXCEPTION 'Only the seller can ask for more time'; END IF;
  IF v_o.listing_type <> 'service' THEN RAISE EXCEPTION 'Only commissions have a due date'; END IF;
  IF v_o.status NOT IN ('paid', 'in_progress', 'revision_requested') THEN RAISE EXCEPTION 'This order is not in progress'; END IF;
  v_base := COALESCE(v_o.due_date, NOW());
  IF p_new_due_date IS NULL OR p_new_due_date <= GREATEST(v_base, NOW()) THEN RAISE EXCEPTION 'Pick a date after the current due date'; END IF;
  IF p_new_due_date > v_base + INTERVAL '90 days' THEN RAISE EXCEPTION 'An extension can add at most 90 days'; END IF;
  IF EXISTS (SELECT 1 FROM order_extensions WHERE order_id = p_order_id AND status = 'pending') THEN RAISE EXCEPTION 'A request is already waiting for the buyer'; END IF;
  INSERT INTO order_extensions (order_id, requested_by, old_due_date, new_due_date, reason)
  VALUES (p_order_id, v_caller, v_o.due_date, p_new_due_date, NULLIF(left(trim(COALESCE(p_reason, '')), 1000), ''))
  RETURNING id INTO v_id;
  v_days := GREATEST(1, CEIL(EXTRACT(EPOCH FROM (p_new_due_date - v_base)) / 86400))::INTEGER;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, v_caller, 'system', v_o.status, v_o.status,
    jsonb_build_object('action', 'extension_requested', 'extension_id', v_id, 'new_due_date', p_new_due_date, 'days', v_days));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, v_caller, format('Asked for %s more day%s (new due date %s).', v_days, CASE WHEN v_days = 1 THEN '' ELSE 's' END, to_char(p_new_due_date, 'Mon DD')), 'system');
  PERFORM create_order_notification(v_o.buyer_id, v_caller, 'extension_requested', p_order_id,
    format('The creator asked for %s more day%s', v_days, CASE WHEN v_days = 1 THEN '' ELSE 's' END));
  RETURN jsonb_build_object('extension_id', v_id, 'status', 'pending', 'new_due_date', p_new_due_date, 'days', v_days);
END;
$$;

CREATE OR REPLACE FUNCTION public.respond_order_extension(p_extension_id UUID, p_accept BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_e order_extensions%ROWTYPE; v_o orders%ROWTYPE; v_caller UUID := auth.uid(); v_status TEXT;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM order_extensions WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_e.status <> 'pending' THEN RAISE EXCEPTION 'This request was already answered'; END IF;
  SELECT * INTO v_o FROM orders WHERE id = v_e.order_id FOR UPDATE;
  IF v_caller <> v_o.buyer_id AND NOT is_platform_admin(v_caller) THEN RAISE EXCEPTION 'Only the buyer can answer this'; END IF;
  v_status := CASE WHEN p_accept THEN 'accepted' ELSE 'declined' END;
  UPDATE order_extensions SET status = v_status, responded_by = v_caller, response_note = NULLIF(left(trim(COALESCE(p_note, '')), 1000), ''), responded_at = NOW()
  WHERE id = p_extension_id;
  IF p_accept THEN
    UPDATE orders SET due_date = v_e.new_due_date, updated_at = NOW() WHERE id = v_o.id;
    -- a fresh deadline restarts the reminder ladder
    DELETE FROM order_reminders WHERE order_id = v_o.id;
  END IF;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_o.id, v_caller, 'system', v_o.status, v_o.status,
    jsonb_build_object('action', 'extension_' || v_status, 'extension_id', p_extension_id, 'new_due_date', v_e.new_due_date));
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_o.id, v_caller, CASE WHEN p_accept THEN format('New due date agreed: %s.', to_char(v_e.new_due_date, 'Mon DD')) ELSE 'The request for more time was declined.' END, 'system');
  PERFORM create_order_notification(v_o.seller_id, v_caller, 'extension_' || v_status, v_o.id,
    CASE WHEN p_accept THEN format('New due date: %s', to_char(v_e.new_due_date, 'Mon DD')) ELSE 'The buyer declined more time' END);
  RETURN jsonb_build_object('status', v_status, 'due_date', CASE WHEN p_accept THEN v_e.new_due_date ELSE v_o.due_date END);
END;
$$;

CREATE OR REPLACE FUNCTION public.withdraw_order_extension(p_extension_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_e order_extensions%ROWTYPE; v_caller UUID := auth.uid();
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT * INTO v_e FROM order_extensions WHERE id = p_extension_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  IF v_e.requested_by <> v_caller THEN RAISE EXCEPTION 'Not your request'; END IF;
  IF v_e.status <> 'pending' THEN RAISE EXCEPTION 'This request was already answered'; END IF;
  UPDATE order_extensions SET status = 'withdrawn', responded_at = NOW() WHERE id = p_extension_id;
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_e.order_id, v_caller, 'Withdrew the request for more time.', 'system');
  RETURN jsonb_build_object('status', 'withdrawn');
END;
$$;

-- ===========================================================================
-- 3. Due-date reminders (hourly): -24 h to the seller, due and +48 h to both
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.send_due_date_reminders() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD; v_count INTEGER := 0; v_due TEXT;
BEGIN
  FOR v IN
    SELECT o.id, o.buyer_id, o.seller_id, o.due_date
    FROM orders o
    WHERE o.listing_type = 'service' AND o.due_date IS NOT NULL
      AND o.status IN ('paid', 'in_progress', 'revision_requested')
      AND o.due_date - INTERVAL '24 hours' <= NOW()
  LOOP
    v_due := to_char(v.due_date, 'Mon DD');
    IF v.due_date > NOW() AND NOT EXISTS (SELECT 1 FROM order_reminders r WHERE r.order_id = v.id AND r.kind = 'due_24h') THEN
      INSERT INTO order_reminders (order_id, kind) VALUES (v.id, 'due_24h');
      PERFORM create_order_notification(v.seller_id, v.buyer_id, 'order_due_soon', v.id, format('Due %s — less than a day left', v_due));
      v_count := v_count + 1;
    ELSIF v.due_date <= NOW() AND v.due_date + INTERVAL '48 hours' > NOW() AND NOT EXISTS (SELECT 1 FROM order_reminders r WHERE r.order_id = v.id AND r.kind = 'due_now') THEN
      INSERT INTO order_reminders (order_id, kind) VALUES (v.id, 'due_now');
      PERFORM create_order_notification(v.seller_id, v.buyer_id, 'order_due', v.id, format('This order was due %s', v_due));
      PERFORM create_order_notification(v.buyer_id, v.seller_id, 'order_due', v.id, format('Your order was due %s and has not been delivered yet', v_due));
      v_count := v_count + 1;
    ELSIF v.due_date + INTERVAL '48 hours' <= NOW() AND NOT EXISTS (SELECT 1 FROM order_reminders r WHERE r.order_id = v.id AND r.kind = 'late_48h') THEN
      INSERT INTO order_reminders (order_id, kind) VALUES (v.id, 'late_48h');
      PERFORM create_order_notification(v.seller_id, v.buyer_id, 'order_late', v.id, format('Two days late (due %s). The buyer can cancel for a full refund from the third day.', v_due));
      PERFORM create_order_notification(v.buyer_id, v.seller_id, 'order_late', v.id, format('Two days late (due %s). You can cancel for a full refund from the third day.', v_due));
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.send_due_date_reminders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.send_due_date_reminders() TO service_role;

-- hourly job: reminders ride along with auto-complete / reveal / release
CREATE OR REPLACE FUNCTION public.run_cron_job(p_job TEXT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_run_id BIGINT;
  v_result JSONB := '{}'::jsonb;
  v_base_url TEXT;
  v_secret TEXT;
  v_request_id BIGINT;
BEGIN
  INSERT INTO cron_runs (job) VALUES (p_job) RETURNING id INTO v_run_id;
  BEGIN
    IF p_job = 'auto_decline' THEN
      v_result := jsonb_build_object('declined', auto_decline_expired_orders());
      DELETE FROM api_rate_limits WHERE window_start < NOW() - INTERVAL '1 day';
    ELSIF p_job = 'hourly' THEN
      v_result := jsonb_build_object('auto_completed', auto_complete_orders());
      PERFORM reveal_due_reviews();
      v_result := v_result || jsonb_build_object('payouts_released', release_eligible_payouts());
      v_result := v_result || jsonb_build_object('reminders', send_due_date_reminders());
    ELSIF p_job = 'payout_worker' THEN
      IF NOT EXISTS (SELECT 1 FROM payouts WHERE status = 'pending' AND eligible_at <= NOW()) THEN
        v_result := jsonb_build_object('skipped', 'no pending payouts');
      ELSE
        SELECT value #>> '{}' INTO v_base_url FROM platform_settings WHERE key = 'app_base_url';
        SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
        IF v_base_url IS NULL OR v_secret IS NULL THEN
          RAISE EXCEPTION 'app_base_url setting or cron_secret vault entry missing';
        END IF;
        SELECT net.http_post(
          url := v_base_url || '/api/payouts/run',
          headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
          body := jsonb_build_object('source', 'pg_cron', 'run_id', v_run_id),
          timeout_milliseconds := 60000
        ) INTO v_request_id;
        v_result := jsonb_build_object('http_request_id', v_request_id);
      END IF;
    ELSE
      RAISE EXCEPTION 'Unknown cron job %', p_job;
    END IF;
    UPDATE cron_runs SET finished_at = NOW(), ok = TRUE, result = v_result WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE cron_runs SET finished_at = NOW(), ok = FALSE, error = SQLERRM WHERE id = v_run_id;
  END;
  RETURN v_result;
END;
$$;

-- ===========================================================================
-- 4. Email hook: every order notification is handed to the app to render + send
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.queue_notification_email() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE v_base_url TEXT; v_secret TEXT; v_request_id BIGINT;
BEGIN
  IF NEW.order_id IS NULL THEN RETURN NEW; END IF;
  -- self-tests run inside a rolled-back transaction; nothing should leave the DB
  IF current_setting('pinkquill.selftest', TRUE) = 'on' THEN RETURN NEW; END IF;
  BEGIN
    SELECT value #>> '{}' INTO v_base_url FROM platform_settings WHERE key = 'app_base_url';
    SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
    IF v_base_url IS NULL OR v_secret IS NULL THEN RETURN NEW; END IF;
    SELECT net.http_post(
      url := v_base_url || '/api/notifications/email',
      headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
      body := jsonb_build_object('notification_id', NEW.id),
      timeout_milliseconds := 15000
    ) INTO v_request_id;
  EXCEPTION WHEN OTHERS THEN
    -- Email is best-effort; the in-app notification must never fail because of it.
    NULL;
  END;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_queue_notification_email ON public.notifications;
CREATE TRIGGER trg_queue_notification_email
  AFTER INSERT ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.queue_notification_email();

-- ===========================================================================
-- 5. get_order_actions: extension flags
-- ===========================================================================
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
    'payout', CASE WHEN v_payout.id IS NULL THEN NULL ELSE jsonb_build_object('status', v_payout.status, 'amount_cents', v_payout.amount_cents, 'currency', v_payout.currency, 'listing_amount_cents', v_payout.listing_amount_cents, 'sent_at', v_payout.sent_at, 'block_reason', v_payout.block_reason) END,
    'release_at', CASE WHEN v_o.status = 'completed' AND v_o.completed_at IS NOT NULL THEN v_o.completed_at + make_interval(hours => v_window::INTEGER) ELSE NULL END,
    'auto_complete_at', v_o.auto_completion_at,
    'refund', CASE WHEN v_refund.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_refund.id, 'status', v_refund.status, 'kind', v_refund.kind, 'amount_cents', v_refund.amount_cents, 'currency', v_refund.currency, 'listing_amount_cents', v_refund.listing_amount_cents, 'initiator_role', v_refund.initiator_role, 'reason', v_refund.reason) END,
    'dispute', CASE WHEN v_dispute.id IS NULL THEN NULL ELSE jsonb_build_object('id', v_dispute.id, 'kind', v_dispute.kind, 'status', v_dispute.status, 'reason', v_dispute.reason, 'evidence_due_by', v_dispute.evidence_due_by, 'evidence_count', jsonb_array_length(v_dispute.evidence)) END
  );
END;
$$;

-- ===========================================================================
-- 6. Grants
-- ===========================================================================
DO $$
DECLARE f TEXT;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.request_order_extension(UUID, TIMESTAMPTZ, TEXT)', 'public.respond_order_extension(UUID, BOOLEAN, TEXT)', 'public.withdraw_order_extension(UUID)'
  ] LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ===========================================================================
-- 7. Self-test (service role; always rolls back)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.timeline_selftest_body(p_buyer UUID, p_seller UUID, p_product UUID, p_pricing UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_out TEXT := ''; v_r JSONB; v_o UUID; v_ext UUID; v_n INTEGER; v_due TIMESTAMPTZ; v_a JSONB; v_meta JSONB;
BEGIN
  PERFORM set_config('pinkquill.selftest', 'on', TRUE);
  IF EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_seller) THEN
    UPDATE seller_profiles SET is_accepting_commissions = TRUE, require_approval = FALSE WHERE user_id = p_seller;
  ELSE
    INSERT INTO seller_profiles (user_id, store_name, is_accepting_commissions, require_approval, setup_completed)
    VALUES (p_seller, 'selftest', TRUE, FALSE, TRUE);
  END IF;
  UPDATE commission_listings SET availability = 'open', slots_total = NULL WHERE product_id = p_product;

  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'timeline brief', '{"answers": []}'::jsonb);
  v_o := (v_r->>'order_id')::UUID;
  UPDATE orders SET status = 'paid', payment_status = 'paid' WHERE id = v_o;

  -- (a) notification metadata carries the order facts for the recipient
  PERFORM create_order_notification(p_seller, p_buyer, 'order_paid', v_o, 'selftest');
  SELECT metadata INTO v_meta FROM notifications WHERE order_id = v_o AND user_id = p_seller ORDER BY created_at DESC LIMIT 1;
  v_out := v_out || 'a.role=' || COALESCE(v_meta->>'role', 'none') || ' has_amount=' || (v_meta ? 'amount') || ' has_title=' || (v_meta ? 'title') || ' ';

  -- (b) reminders: due in 12 h → seller reminded once; then due 1 h ago → both; then 3 days late → both; never twice
  UPDATE orders SET due_date = NOW() + INTERVAL '12 hours' WHERE id = v_o;
  v_n := send_due_date_reminders(); v_out := v_out || 'b.soon=' || v_n;
  v_n := send_due_date_reminders(); v_out := v_out || '/' || v_n;
  UPDATE orders SET due_date = NOW() - INTERVAL '1 hour' WHERE id = v_o;
  v_n := send_due_date_reminders(); v_out := v_out || ' due=' || v_n;
  UPDATE orders SET due_date = NOW() - INTERVAL '3 days' WHERE id = v_o;
  v_n := send_due_date_reminders(); v_out := v_out || ' late=' || v_n;
  v_n := send_due_date_reminders(); v_out := v_out || '/' || v_n;
  SELECT count(*) INTO v_n FROM notifications WHERE order_id = v_o AND type IN ('order_due_soon', 'order_due', 'order_late');
  v_out := v_out || ' reminder_notifs=' || v_n || ' ';

  -- (c) extension: buyer cannot ask; seller asks; second request refused; buyer accepts → due date moves, reminders reset
  UPDATE orders SET due_date = NOW() + INTERVAL '2 days' WHERE id = v_o;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  BEGIN
    PERFORM request_order_extension(v_o, NOW() + INTERVAL '5 days', 'x'); v_out := v_out || 'c.buyer_ask=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'c.buyer_ask=refused';
  END;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  v_r := request_order_extension(v_o, NOW() + INTERVAL '5 days', 'need more time');
  v_ext := (v_r->>'extension_id')::UUID;
  v_out := v_out || ' ask=' || (v_r->>'status') || '/' || (v_r->>'days');
  BEGIN
    PERFORM request_order_extension(v_o, NOW() + INTERVAL '6 days', 'again'); v_out := v_out || ' second=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' second=refused';
  END;
  v_a := get_order_actions(v_o);
  v_out := v_out || ' seller_can_ask=' || (v_a->>'can_request_extension') || ' pending=' || ((v_a->'extension'->>'id') IS NOT NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  v_a := get_order_actions(v_o);
  v_out := v_out || ' buyer_can_respond=' || (v_a->>'can_respond_extension');
  v_r := respond_order_extension(v_ext, TRUE, 'ok');
  SELECT due_date INTO v_due FROM orders WHERE id = v_o;
  v_out := v_out || ' accepted=' || (v_r->>'status') || ' moved=' || (v_due > NOW() + INTERVAL '4 days');
  SELECT count(*) INTO v_n FROM order_reminders WHERE order_id = v_o; v_out := v_out || ' reminders_reset=' || (v_n = 0);
  BEGIN
    PERFORM respond_order_extension(v_ext, TRUE, 'twice'); v_out := v_out || ' twice=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' twice=refused';
  END;

  -- (d) decline path and withdraw path
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  v_r := request_order_extension(v_o, v_due + INTERVAL '2 days', NULL); v_ext := (v_r->>'extension_id')::UUID;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  v_r := respond_order_extension(v_ext, FALSE, 'no');
  v_out := v_out || ' d.declined=' || (v_r->>'status') || ' kept=' || ((SELECT due_date FROM orders WHERE id = v_o) = v_due);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  v_r := request_order_extension(v_o, v_due + INTERVAL '2 days', NULL); v_ext := (v_r->>'extension_id')::UUID;
  v_r := withdraw_order_extension(v_ext);
  v_out := v_out || ' withdrawn=' || (v_r->>'status');
  SELECT count(*) INTO v_n FROM notifications WHERE order_id = v_o AND type LIKE 'extension_%';
  v_out := v_out || ' ext_notifs=' || v_n;
  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.timeline_selftest_body(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_timeline_selftest() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_product products%ROWTYPE; v_pricing product_pricing%ROWTYPE; v_buyer UUID; v_seller UUID; v_out TEXT; v_msg TEXT;
  v_before BIGINT := (SELECT count(*) FROM orders);
BEGIN
  SELECT * INTO v_product FROM products WHERE listing_type = 'service' AND status = 'active' ORDER BY created_at LIMIT 1;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'no active service listing to test with'); END IF;
  SELECT * INTO v_pricing FROM product_pricing WHERE product_id = v_product.id ORDER BY price LIMIT 1;
  v_seller := v_product.seller_id;
  SELECT user_id INTO v_buyer FROM platform_admins WHERE user_id <> v_seller LIMIT 1;
  IF v_buyer IS NULL THEN SELECT id INTO v_buyer FROM profiles WHERE id <> v_seller LIMIT 1; END IF;
  BEGIN
    v_out := timeline_selftest_body(v_buyer, v_seller, v_product.id, v_pricing.id);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELFTEST_ROLLBACK ' || v_out;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  IF v_msg LIKE 'SELFTEST_ROLLBACK %' THEN
    RETURN jsonb_build_object('ok', true, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'result', substr(v_msg, 19));
  END IF;
  RETURN jsonb_build_object('ok', false, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'error', v_msg);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_timeline_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_timeline_selftest() TO service_role;
