-- Commissions rebuild — Phase 2c: intake, references, revisions, deliveries
-- (docs/commissions/02-plan.md). Closes the data half of the silent-failure
-- root cause: a delivery, a revision request and a buyer's brief become rows
-- with files attached, instead of a status flip plus a chat message.
--
-- 1. listing_intake_fields   — typed questions a creator asks before work.
-- 2. order_intake_answers    — the buyer's answers, snapshotted per order.
-- 3. order_attachments       — every file on an order (reference / revision /
--                              delivery), bare storage paths in order-files.
-- 4. order_revisions         — numbered revision requests with a note and
--                              files, marked addressed by the next delivery.
-- 5. order_deliveries        — versioned deliveries (note, files, final flag,
--                              status submitted → revision_requested →
--                              accepted | superseded).
-- 6. RPCs: submit_order_delivery, request_order_revision,
--    add_order_references, get_order_workroom. create_marketplace_order
--    validates required intake fields and records answers.
--    update_order_as_seller('submitted') / update_order_as_buyer(
--    'revision_requested') delegate, so old callers keep working.
-- 7. run_workroom_selftest() — rolled-back scenario suite.
--
-- Retired (kept for reads, no longer written): orders.requirements,
-- orders.delivery_note, orders.delivery_assets. orders.brief stays — it is
-- the project brief every screen shows. Dropping columns is Phase 4c.
-- Idempotent.

-- ===========================================================================
-- 1. Listing intake fields
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.listing_intake_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL CHECK (length(label) BETWEEN 1 AND 200),
  help_text TEXT CHECK (help_text IS NULL OR length(help_text) <= 500),
  field_type TEXT NOT NULL DEFAULT 'long_text'
    CHECK (field_type IN ('short_text', 'long_text', 'number', 'url', 'select', 'multi_select', 'file')),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_listing_intake_fields_product ON public.listing_intake_fields (product_id, position);
ALTER TABLE public.listing_intake_fields ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.listing_intake_fields FROM anon, authenticated;
GRANT SELECT ON public.listing_intake_fields TO anon, authenticated;
GRANT INSERT (id, product_id, seller_id, position, label, help_text, field_type, options, required),
      UPDATE (position, label, help_text, field_type, options, required, updated_at),
      DELETE ON public.listing_intake_fields TO authenticated;

DROP POLICY IF EXISTS "intake_fields_public_read" ON public.listing_intake_fields;
CREATE POLICY "intake_fields_public_read" ON public.listing_intake_fields FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND (p.status::TEXT = 'active' OR p.seller_id = (SELECT auth.uid())))
);
DROP POLICY IF EXISTS "intake_fields_seller_write" ON public.listing_intake_fields;
CREATE POLICY "intake_fields_seller_write" ON public.listing_intake_fields FOR ALL
  USING (seller_id = (SELECT auth.uid()))
  WITH CHECK (seller_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = (SELECT auth.uid())));

CREATE OR REPLACE FUNCTION public.touch_listing_intake_field() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  SELECT seller_id INTO NEW.seller_id FROM products WHERE id = NEW.product_id;
  IF NEW.field_type NOT IN ('select', 'multi_select') THEN NEW.options := '[]'::jsonb; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_listing_intake_fields_touch ON public.listing_intake_fields;
CREATE TRIGGER trg_listing_intake_fields_touch BEFORE INSERT OR UPDATE ON public.listing_intake_fields
  FOR EACH ROW EXECUTE FUNCTION public.touch_listing_intake_field();

-- Backfill: the free-text "requirements" list becomes optional long-text questions.
INSERT INTO public.listing_intake_fields (product_id, seller_id, position, label, field_type, required)
SELECT p.id, p.seller_id, r.ordinality - 1, left(r.value, 200), 'long_text', FALSE
FROM public.products p
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(p.service_metadata->'requirements', '[]'::jsonb)) WITH ORDINALITY AS r(value, ordinality)
WHERE p.listing_type = 'service' AND length(trim(r.value)) > 0
  AND NOT EXISTS (SELECT 1 FROM public.listing_intake_fields f WHERE f.product_id = p.id);

-- ===========================================================================
-- 2–5. Order workroom tables (written only by RPCs)
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.order_intake_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  field_id UUID REFERENCES public.listing_intake_fields(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  label TEXT NOT NULL,
  field_type TEXT NOT NULL DEFAULT 'long_text',
  value_text TEXT,
  value_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_order_intake_answers_order ON public.order_intake_answers (order_id, position);

CREATE TABLE IF NOT EXISTS public.order_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  requested_by UUID NOT NULL,
  note TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'addressed', 'withdrawn')),
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  addressed_at TIMESTAMPTZ,
  addressed_by_delivery_id UUID,
  UNIQUE (order_id, number)
);

CREATE TABLE IF NOT EXISTS public.order_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  seller_id UUID NOT NULL,
  note TEXT,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  revision_id UUID REFERENCES public.order_revisions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'revision_requested', 'accepted', 'superseded')),
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (order_id, version)
);
DO $$ BEGIN
  ALTER TABLE public.order_revisions
    ADD CONSTRAINT order_revisions_delivery_fk FOREIGN KEY (addressed_by_delivery_id) REFERENCES public.order_deliveries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.order_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('reference', 'revision', 'delivery')),
  storage_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0 AND size_bytes <= 104857600),
  delivery_id UUID REFERENCES public.order_deliveries(id) ON DELETE CASCADE,
  revision_id UUID REFERENCES public.order_revisions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (order_id, storage_path)
);
CREATE INDEX IF NOT EXISTS idx_order_attachments_order ON public.order_attachments (order_id, created_at);

ALTER TABLE public.order_intake_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_attachments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.order_intake_answers, public.order_revisions, public.order_deliveries, public.order_attachments FROM anon, authenticated;
GRANT SELECT ON public.order_intake_answers, public.order_revisions, public.order_deliveries, public.order_attachments TO authenticated;

CREATE OR REPLACE FUNCTION public.is_order_participant(p_order_id UUID) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id AND (o.buyer_id = auth.uid() OR o.seller_id = auth.uid())
  ) OR COALESCE(is_platform_admin(auth.uid()), FALSE);
$$;

DROP POLICY IF EXISTS "intake_answers_participants_read" ON public.order_intake_answers;
CREATE POLICY "intake_answers_participants_read" ON public.order_intake_answers FOR SELECT USING (is_order_participant(order_id));
DROP POLICY IF EXISTS "revisions_participants_read" ON public.order_revisions;
CREATE POLICY "revisions_participants_read" ON public.order_revisions FOR SELECT USING (is_order_participant(order_id));
DROP POLICY IF EXISTS "deliveries_participants_read" ON public.order_deliveries;
CREATE POLICY "deliveries_participants_read" ON public.order_deliveries FOR SELECT USING (is_order_participant(order_id));
DROP POLICY IF EXISTS "attachments_participants_read" ON public.order_attachments;
CREATE POLICY "attachments_participants_read" ON public.order_attachments FOR SELECT USING (is_order_participant(order_id));

-- ===========================================================================
-- Helpers
-- ===========================================================================
-- Files arrive as [{path, name, type, size}]. Paths must live under this
-- order's folder in the private order-files bucket (the storage policy only
-- lets participants upload there), so a row can never point at another
-- order's file. Caps: 25 files per call, 100 MB each (bucket limit).
CREATE OR REPLACE FUNCTION public.insert_order_attachments(
  p_order_id UUID, p_uploader UUID, p_kind TEXT, p_files JSONB,
  p_delivery_id UUID DEFAULT NULL, p_revision_id UUID DEFAULT NULL
) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_file JSONB; v_path TEXT; v_count INTEGER := 0; v_prefix TEXT := 'orders/' || p_order_id::TEXT || '/';
BEGIN
  IF p_files IS NULL OR jsonb_typeof(p_files) <> 'array' THEN RETURN 0; END IF;
  IF jsonb_array_length(p_files) > 25 THEN RAISE EXCEPTION 'Too many files (max 25 per upload)'; END IF;
  FOR v_file IN SELECT * FROM jsonb_array_elements(p_files) LOOP
    v_path := COALESCE(v_file->>'path', v_file->>'url');
    IF v_path IS NULL OR v_path NOT LIKE (v_prefix || '%') OR v_path LIKE '%..%' THEN
      RAISE EXCEPTION 'Invalid file path for this order';
    END IF;
    INSERT INTO order_attachments (order_id, uploader_id, kind, storage_path, file_name, mime_type, size_bytes, delivery_id, revision_id)
    VALUES (p_order_id, p_uploader, p_kind, v_path,
            left(COALESCE(NULLIF(v_file->>'name', ''), split_part(v_path, '/', -1)), 255),
            left(v_file->>'type', 120), LEAST(GREATEST(COALESCE((v_file->>'size')::BIGINT, 0), 0), 104857600),
            p_delivery_id, p_revision_id)
    ON CONFLICT (order_id, storage_path) DO UPDATE
      SET kind = EXCLUDED.kind, delivery_id = COALESCE(EXCLUDED.delivery_id, order_attachments.delivery_id),
          revision_id = COALESCE(EXCLUDED.revision_id, order_attachments.revision_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END; $$;
REVOKE EXECUTE ON FUNCTION public.insert_order_attachments(UUID, UUID, TEXT, JSONB, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- Attachments as message-style [{url,name,type,size}] for order_messages.
CREATE OR REPLACE FUNCTION public.attachments_as_message_json(p_files JSONB) RETURNS JSONB
LANGUAGE sql IMMUTABLE AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'url', COALESCE(f->>'path', f->>'url'), 'name', f->>'name', 'type', f->>'type', 'size', f->>'size')), '[]'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_files, '[]'::jsonb)) f;
$$;

-- ===========================================================================
-- Intake: validate required questions and record answers at order creation
-- ===========================================================================
-- p_requirements shape (new): {"answers": [{"field_id": uuid, "value": text | [text]}], "notes": text}
-- Legacy shape {"notes": "..."} keeps working (stored as one answer).
CREATE OR REPLACE FUNCTION public.validate_order_intake(p_product_id UUID, p_requirements JSONB) RETURNS VOID
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_field RECORD; v_answer JSONB; v_val JSONB;
BEGIN
  FOR v_field IN SELECT * FROM listing_intake_fields WHERE product_id = p_product_id AND required AND field_type <> 'file' LOOP
    SELECT a INTO v_answer FROM jsonb_array_elements(COALESCE(p_requirements->'answers', '[]'::jsonb)) a
    WHERE (a->>'field_id')::UUID = v_field.id LIMIT 1;
    v_val := v_answer->'value';
    IF v_val IS NULL
       OR (jsonb_typeof(v_val) = 'string' AND length(trim(v_val #>> '{}')) = 0)
       OR (jsonb_typeof(v_val) = 'array' AND jsonb_array_length(v_val) = 0)
       OR jsonb_typeof(v_val) = 'null' THEN
      RAISE EXCEPTION 'Please answer "%" before sending your request', v_field.label;
    END IF;
  END LOOP;
END; $$;
REVOKE EXECUTE ON FUNCTION public.validate_order_intake(UUID, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.record_order_intake(p_order_id UUID, p_product_id UUID, p_requirements JSONB) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_answer JSONB; v_field listing_intake_fields%ROWTYPE; v_val JSONB; v_n INTEGER := 0; v_notes TEXT;
BEGIN
  FOR v_answer IN SELECT * FROM jsonb_array_elements(COALESCE(p_requirements->'answers', '[]'::jsonb)) LOOP
    v_val := v_answer->'value';
    IF v_val IS NULL OR jsonb_typeof(v_val) = 'null' THEN CONTINUE; END IF;
    v_field := NULL;
    IF v_answer->>'field_id' IS NOT NULL THEN
      SELECT * INTO v_field FROM listing_intake_fields WHERE id = (v_answer->>'field_id')::UUID AND product_id = p_product_id;
    END IF;
    INSERT INTO order_intake_answers (order_id, field_id, position, label, field_type, value_text, value_json)
    VALUES (p_order_id, v_field.id, COALESCE(v_field.position, 100 + v_n),
            left(COALESCE(v_field.label, v_answer->>'label', 'Answer'), 200),
            COALESCE(v_field.field_type, 'long_text'),
            CASE WHEN jsonb_typeof(v_val) = 'string' THEN left(v_val #>> '{}', 5000) ELSE NULL END,
            CASE WHEN jsonb_typeof(v_val) <> 'string' THEN v_val ELSE NULL END);
    v_n := v_n + 1;
  END LOOP;
  v_notes := NULLIF(trim(COALESCE(p_requirements->>'notes', '')), '');
  IF v_notes IS NOT NULL THEN
    INSERT INTO order_intake_answers (order_id, position, label, field_type, value_text)
    VALUES (p_order_id, 1000, 'Extra notes', 'long_text', left(v_notes, 5000));
    v_n := v_n + 1;
  END IF;
  RETURN v_n;
END; $$;
REVOKE EXECUTE ON FUNCTION public.record_order_intake(UUID, UUID, JSONB) FROM PUBLIC, anon, authenticated;

-- create_marketplace_order: same body as Phase 2a plus intake validation +
-- recording, and orders.requirements no longer written (kept NULL/{}).
CREATE OR REPLACE FUNCTION public.create_marketplace_order(
  p_buyer_id uuid, p_product_id uuid, p_pricing_id uuid,
  p_requested_quantity integer DEFAULT 1, p_brief text DEFAULT NULL::text,
  p_requirements jsonb DEFAULT '{}'::jsonb, p_due_date timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_shipping_address jsonb DEFAULT NULL::jsonb, p_chosen_amount numeric DEFAULT NULL::numeric)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_product products%ROWTYPE;
  v_pricing product_pricing%ROWTYPE;
  v_listing_type TEXT;
  v_quantity INTEGER;
  v_unit_price NUMERIC(10,2);
  v_item_amount NUMERIC(10,2);
  v_shipping_cost NUMERIC(10,2) := 0;
  v_money RECORD;
  v_currency TEXT;
  v_due_date TIMESTAMPTZ;
  v_order_id UUID;
  v_require_approval BOOLEAN := FALSE;
  v_auto_decline_hours INTEGER := 72;
  v_requires_seller_approval BOOLEAN := FALSE;
  v_initial_status TEXT := 'pending_payment';
  v_is_pwyw BOOLEAN;
  v_gate RECORD;
  v_queued BOOLEAN := FALSE;
  v_queue_position INTEGER := NULL;
  v_lead_time INTEGER := NULL;
  v_answers INTEGER := 0;
BEGIN
  IF p_buyer_id IS NULL THEN RAISE EXCEPTION 'Buyer is required'; END IF;
  IF p_product_id IS NULL OR p_pricing_id IS NULL THEN RAISE EXCEPTION 'product_id and pricing_id are required'; END IF;

  SELECT * INTO v_product FROM products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Product not found'; END IF;
  IF v_product.status::TEXT <> 'active' THEN RAISE EXCEPTION 'This listing is not available'; END IF;
  IF v_product.seller_id = p_buyer_id THEN RAISE EXCEPTION 'You cannot purchase your own listing'; END IF;

  SELECT * INTO v_pricing FROM product_pricing WHERE id = p_pricing_id AND product_id = p_product_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pricing option not found'; END IF;
  IF COALESCE(v_pricing.is_available, true) = false THEN RAISE EXCEPTION 'This pricing option is unavailable'; END IF;

  v_listing_type := v_product.listing_type::TEXT;
  IF v_listing_type NOT IN ('product', 'service') THEN RAISE EXCEPTION 'Invalid listing type: %', v_listing_type; END IF;

  v_quantity := GREATEST(COALESCE(p_requested_quantity, 1), 1);
  IF v_listing_type = 'service' THEN v_quantity := 1; END IF;

  IF v_pricing.stock IS NOT NULL THEN
    IF v_pricing.stock < v_quantity THEN RAISE EXCEPTION 'Insufficient stock for this quantity'; END IF;
    UPDATE product_pricing SET stock = stock - v_quantity WHERE id = v_pricing.id;
  END IF;

  IF v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital' THEN
    SELECT COALESCE(ps.shipping_cost, 0) INTO v_shipping_cost FROM product_shipping ps WHERE ps.product_id = p_product_id LIMIT 1;
  END IF;

  v_is_pwyw := v_pricing.min_price < v_pricing.price;
  IF v_is_pwyw THEN
    v_unit_price := ROUND(COALESCE(p_chosen_amount, v_pricing.price)::NUMERIC, 2);
    IF v_unit_price < v_pricing.min_price THEN
      RAISE EXCEPTION 'Chosen amount % is below the minimum of %', v_unit_price, v_pricing.min_price;
    END IF;
    IF v_unit_price > 1000000 THEN RAISE EXCEPTION 'Chosen amount % exceeds the maximum allowed', v_unit_price; END IF;
  ELSE
    v_unit_price := v_pricing.price;
  END IF;

  v_item_amount := ROUND((v_unit_price * v_quantity)::NUMERIC, 2);
  SELECT * INTO v_money FROM compute_order_money(v_item_amount, v_shipping_cost, 0);
  v_currency := LOWER(COALESCE(v_pricing.currency, 'usd'));

  SELECT sp.require_approval, sp.auto_decline_hours INTO v_require_approval, v_auto_decline_hours
  FROM seller_profiles sp WHERE sp.user_id = v_product.seller_id LIMIT 1;
  v_auto_decline_hours := GREATEST(COALESCE(v_auto_decline_hours, 72), 1);

  v_requires_seller_approval := COALESCE(v_require_approval, FALSE)
    AND (v_listing_type = 'service' OR (v_listing_type = 'product' AND v_product.delivery_type::TEXT <> 'digital'));

  IF v_listing_type = 'service' THEN
    INSERT INTO commission_listings (product_id, seller_id) VALUES (p_product_id, v_product.seller_id)
    ON CONFLICT (product_id) DO NOTHING;
    SELECT * INTO v_gate FROM commission_order_gate(p_product_id);
    IF v_gate.can_order IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_gate.reason, 'This commission is not taking orders right now.');
    END IF;
    v_lead_time := COALESCE(v_gate.lead_time_days, 0);
    IF v_gate.mode = 'waitlist' THEN
      v_queued := TRUE;
      v_requires_seller_approval := TRUE;
      v_queue_position := v_gate.active_count + 1;
    END IF;

    -- Phase 2c: the creator's required questions must be answered.
    PERFORM validate_order_intake(p_product_id, COALESCE(p_requirements, '{}'::jsonb));

    v_due_date := NOW() + make_interval(days => v_lead_time + COALESCE(v_pricing.delivery_days, 0));
    IF p_due_date IS NOT NULL AND p_due_date > v_due_date THEN v_due_date := p_due_date; END IF;
  END IF;

  IF v_requires_seller_approval THEN v_initial_status := 'pending_acceptance'; END IF;

  INSERT INTO orders (
    buyer_id, seller_id, product_id, pricing_id, listing_type,
    amount, original_amount, discount_amount, promo_code_id,
    platform_fee, seller_amount, buyer_fee, currency,
    status, payment_status, payment_provider,
    brief, requirements, due_date, max_revisions,
    quantity, shipping_address, shipping_cost,
    seller_accepted, seller_response_deadline
  ) VALUES (
    p_buyer_id, v_product.seller_id, p_product_id, p_pricing_id, v_listing_type,
    v_money.amount, v_money.amount, 0, NULL,
    v_money.platform_fee, v_money.seller_amount, v_money.buyer_fee, v_currency,
    v_initial_status, 'pending', 'stripe',
    CASE WHEN v_listing_type = 'service' THEN p_brief ELSE NULL END,
    '{}'::jsonb,
    CASE WHEN v_listing_type = 'service' THEN v_due_date ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN v_pricing.revisions ELSE NULL END,
    v_quantity,
    CASE WHEN v_listing_type = 'product' THEN p_shipping_address ELSE NULL END,
    v_shipping_cost,
    CASE WHEN v_requires_seller_approval THEN NULL ELSE TRUE END,
    CASE WHEN v_requires_seller_approval THEN NOW() + make_interval(hours => v_auto_decline_hours) ELSE NULL END
  ) RETURNING id INTO v_order_id;

  IF v_listing_type = 'service' THEN
    v_answers := record_order_intake(v_order_id, p_product_id, COALESCE(p_requirements, '{}'::jsonb));
  END IF;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order_id, p_buyer_id, 'status_change', NULL, v_initial_status,
    jsonb_build_object('source', 'create_marketplace_order', 'requires_approval', v_requires_seller_approval,
                       'pwyw', v_is_pwyw, 'unit_price', v_unit_price, 'buyer_fee', v_money.buyer_fee,
                       'queued', v_queued, 'queue_position', v_queue_position, 'lead_time_days', v_lead_time,
                       'intake_answers', v_answers));

  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (v_order_id, p_buyer_id,
    CASE WHEN v_queued THEN 'Request added to the waitlist and awaiting seller approval.'
         WHEN v_requires_seller_approval THEN 'Order created and awaiting seller approval.'
         ELSE 'Order created and ready for payment confirmation.' END, 'system');

  RETURN jsonb_build_object('order_id', v_order_id, 'status', v_initial_status,
                            'queued', v_queued, 'queue_position', v_queue_position);
END;
$function$;

-- ===========================================================================
-- References (buyer files, any time before completion)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.add_order_references(p_order_id UUID, p_files JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_order orders%ROWTYPE; v_existing INTEGER; v_added INTEGER;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() IS DISTINCT FROM v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'References only apply to commission orders'; END IF;
  IF v_order.status::TEXT IN ('completed', 'cancelled', 'refunded', 'declined', 'expired', 'resolved') THEN
    RAISE EXCEPTION 'This order is closed';
  END IF;
  SELECT count(*) INTO v_existing FROM order_attachments WHERE order_id = p_order_id AND kind = 'reference';
  IF v_existing + COALESCE(jsonb_array_length(p_files), 0) > 20 THEN RAISE EXCEPTION 'Up to 20 reference files per order'; END IF;
  v_added := insert_order_attachments(p_order_id, auth.uid(), 'reference', p_files);
  IF v_added > 0 THEN
    INSERT INTO order_messages (order_id, sender_id, content, message_type, attachments)
    VALUES (p_order_id, auth.uid(), 'Reference files added', 'system', attachments_as_message_json(p_files));
    INSERT INTO order_events (order_id, actor_id, event_type, metadata)
    VALUES (p_order_id, auth.uid(), 'system', jsonb_build_object('action', 'references_added', 'count', v_added));
  END IF;
  RETURN jsonb_build_object('added', v_added, 'total', v_existing + v_added);
END; $$;
REVOKE EXECUTE ON FUNCTION public.add_order_references(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_order_references(UUID, JSONB) TO authenticated, service_role;

-- ===========================================================================
-- Deliveries
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.submit_order_delivery(p_order_id UUID, p_note TEXT DEFAULT NULL, p_files JSONB DEFAULT '[]'::jsonb, p_is_final BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order orders%ROWTYPE; v_version INTEGER; v_delivery_id UUID; v_revision order_revisions%ROWTYPE; v_files INTEGER; v_note TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() IS DISTINCT FROM v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'Deliveries only apply to commission orders'; END IF;
  IF v_order.status::TEXT NOT IN ('paid', 'in_progress', 'revision_requested') THEN
    RAISE EXCEPTION 'Cannot deliver from status: %', v_order.status;
  END IF;
  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  IF v_note IS NULL AND (p_files IS NULL OR jsonb_typeof(p_files) <> 'array' OR jsonb_array_length(p_files) = 0) THEN
    RAISE EXCEPTION 'Add a note or at least one file to deliver';
  END IF;

  SELECT COALESCE(max(version), 0) + 1 INTO v_version FROM order_deliveries WHERE order_id = p_order_id;
  UPDATE order_deliveries SET status = 'superseded' WHERE order_id = p_order_id AND status = 'revision_requested';
  SELECT * INTO v_revision FROM order_revisions WHERE order_id = p_order_id AND status = 'open' ORDER BY number DESC LIMIT 1;

  INSERT INTO order_deliveries (order_id, version, seller_id, note, is_final, revision_id)
  VALUES (p_order_id, v_version, auth.uid(), left(v_note, 5000), COALESCE(p_is_final, FALSE), v_revision.id)
  RETURNING id INTO v_delivery_id;
  v_files := insert_order_attachments(p_order_id, auth.uid(), 'delivery', p_files, v_delivery_id, NULL);

  IF v_revision.id IS NOT NULL THEN
    UPDATE order_revisions SET status = 'addressed', addressed_at = NOW(), addressed_by_delivery_id = v_delivery_id WHERE id = v_revision.id;
  END IF;

  UPDATE orders SET
    status = 'submitted',
    started_at = COALESCE(started_at, NOW()),
    submitted_at = NOW(),
    updated_at = NOW()
  WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, 'submitted',
          jsonb_build_object('delivery_id', v_delivery_id, 'version', v_version, 'files', v_files, 'is_final', COALESCE(p_is_final, FALSE),
                             'addresses_revision', v_revision.number));
  INSERT INTO order_messages (order_id, sender_id, content, message_type, attachments)
  VALUES (p_order_id, auth.uid(),
          'Delivery v' || v_version || CASE WHEN v_note IS NOT NULL THEN ': ' || left(v_note, 2000) ELSE '' END,
          'system', attachments_as_message_json(p_files));

  RETURN jsonb_build_object('delivery_id', v_delivery_id, 'version', v_version, 'files', v_files, 'status', 'submitted');
END; $$;
REVOKE EXECUTE ON FUNCTION public.submit_order_delivery(UUID, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_order_delivery(UUID, TEXT, JSONB, BOOLEAN) TO authenticated, service_role;

-- ===========================================================================
-- Revisions
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.request_order_revision(p_order_id UUID, p_note TEXT DEFAULT NULL, p_files JSONB DEFAULT '[]'::jsonb)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_order orders%ROWTYPE; v_number INTEGER; v_revision_id UUID; v_files INTEGER; v_note TEXT;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() IS DISTINCT FROM v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'Revisions only apply to commission orders'; END IF;
  IF v_order.status::TEXT <> 'submitted' THEN RAISE EXCEPTION 'Cannot request revision from status: %', v_order.status; END IF;
  IF v_order.max_revisions IS NOT NULL AND v_order.revision_count >= v_order.max_revisions THEN
    RAISE EXCEPTION 'Maximum revisions reached (%)', v_order.max_revisions;
  END IF;
  v_note := NULLIF(trim(COALESCE(p_note, '')), '');
  v_number := v_order.revision_count + 1;

  INSERT INTO order_revisions (order_id, number, requested_by, note)
  VALUES (p_order_id, v_number, auth.uid(), left(v_note, 5000)) RETURNING id INTO v_revision_id;
  v_files := insert_order_attachments(p_order_id, auth.uid(), 'revision', p_files, NULL, v_revision_id);
  UPDATE order_deliveries SET status = 'revision_requested' WHERE order_id = p_order_id AND status = 'submitted';

  UPDATE orders SET status = 'revision_requested', revision_count = v_number, updated_at = NOW() WHERE id = p_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, 'revision_requested',
          jsonb_build_object('revision_id', v_revision_id, 'number', v_number, 'files', v_files));
  INSERT INTO order_messages (order_id, sender_id, content, message_type, attachments)
  VALUES (p_order_id, auth.uid(),
          'Revision ' || v_number || ' requested' || CASE WHEN v_note IS NOT NULL THEN ': ' || left(v_note, 2000) ELSE '' END,
          'system', attachments_as_message_json(p_files));

  RETURN jsonb_build_object('revision_id', v_revision_id, 'number', v_number, 'files', v_files, 'status', 'revision_requested');
END; $$;
REVOKE EXECUTE ON FUNCTION public.request_order_revision(UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_order_revision(UUID, TEXT, JSONB) TO authenticated, service_role;

-- ===========================================================================
-- Legacy entry points delegate; acceptance marks the delivery accepted
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.update_order_as_seller(p_order_id uuid, p_status text, p_tracking_number text DEFAULT NULL::text, p_delivery_note text DEFAULT NULL::text, p_delivery_assets jsonb DEFAULT NULL::jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_order orders; v_result JSONB;
BEGIN
  IF p_status = 'cancelled' THEN RETURN cancel_order(p_order_id, p_delivery_note); END IF;
  IF p_status = 'submitted' THEN
    PERFORM submit_order_delivery(p_order_id, p_delivery_note, COALESCE(p_delivery_assets, '[]'::jsonb), FALSE);
    SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
    RETURN v_result;
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.seller_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_status IN ('in_progress') AND v_order.listing_type <> 'service' THEN RAISE EXCEPTION 'Status % only applies to commission orders', p_status; END IF;
  IF p_status IN ('processing', 'shipped', 'delivered') AND v_order.listing_type <> 'product' THEN RAISE EXCEPTION 'Status % only applies to product orders', p_status; END IF;
  CASE p_status
    WHEN 'in_progress' THEN IF v_order.status NOT IN ('paid', 'revision_requested') THEN RAISE EXCEPTION 'Cannot start work from status: %', v_order.status; END IF;
    WHEN 'processing' THEN IF v_order.status != 'paid' THEN RAISE EXCEPTION 'Cannot process from status: %', v_order.status; END IF;
    WHEN 'shipped' THEN IF v_order.status NOT IN ('paid', 'processing') THEN RAISE EXCEPTION 'Cannot ship from status: %', v_order.status; END IF;
    WHEN 'delivered' THEN IF v_order.status != 'shipped' THEN RAISE EXCEPTION 'Cannot deliver from status: %', v_order.status; END IF;
    ELSE RAISE EXCEPTION 'Invalid seller status: %', p_status;
  END CASE;
  UPDATE orders SET
    status = p_status,
    tracking_number = COALESCE(p_tracking_number, tracking_number),
    started_at = CASE WHEN p_status = 'in_progress' AND started_at IS NULL THEN NOW() ELSE started_at END,
    shipped_at = CASE WHEN p_status = 'shipped' THEN NOW() ELSE shipped_at END,
    delivered_at = CASE WHEN p_status = 'delivered' THEN NOW() ELSE delivered_at END,
    updated_at = NOW()
  WHERE id = p_order_id;
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(),
    CASE p_status WHEN 'in_progress' THEN 'Seller started working on your order'
      WHEN 'shipped' THEN 'Order has been shipped' || COALESCE(' — Tracking: ' || p_tracking_number, '') WHEN 'delivered' THEN 'Order has been delivered'
      WHEN 'processing' THEN 'Order is being processed' ELSE 'Order status updated' END, 'system');
  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_order_as_buyer(p_order_id uuid, p_status text, p_cancel_reason text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_order orders; v_result JSONB;
BEGIN
  IF p_status = 'cancelled' THEN RETURN cancel_order(p_order_id, p_cancel_reason); END IF;
  IF p_status = 'revision_requested' THEN
    PERFORM request_order_revision(p_order_id, p_cancel_reason, '[]'::jsonb);
    SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
    RETURN v_result;
  END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF auth.uid() != v_order.buyer_id THEN RAISE EXCEPTION 'Not authorized'; END IF;
  CASE p_status
    WHEN 'completed' THEN
      IF v_order.status NOT IN ('submitted', 'delivered') THEN RAISE EXCEPTION 'Cannot complete from status: %', v_order.status; END IF;
    ELSE RAISE EXCEPTION 'Invalid buyer status: %', p_status;
  END CASE;
  UPDATE orders SET
    status = p_status,
    completed_at = CASE WHEN p_status = 'completed' THEN NOW() ELSE completed_at END,
    updated_at = NOW()
  WHERE id = p_order_id;
  UPDATE order_deliveries SET status = 'accepted', accepted_at = NOW()
  WHERE order_id = p_order_id AND status = 'submitted';
  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status)
  VALUES (p_order_id, auth.uid(), 'status_change', v_order.status, p_status);
  INSERT INTO order_messages (order_id, sender_id, content, message_type)
  VALUES (p_order_id, auth.uid(), 'Buyer accepted the delivery — order complete!', 'system');
  SELECT to_jsonb(o) INTO v_result FROM orders o WHERE o.id = p_order_id;
  RETURN v_result;
END;
$function$;

-- Auto-completion (cron) also closes the open delivery.
CREATE OR REPLACE FUNCTION public.trg_orders_accept_delivery_on_complete() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status::TEXT = 'completed' AND OLD.status::TEXT IS DISTINCT FROM 'completed' AND NEW.listing_type = 'service' THEN
    UPDATE order_deliveries SET status = 'accepted', accepted_at = COALESCE(accepted_at, NOW())
    WHERE order_id = NEW.id AND status = 'submitted';
  END IF;
  RETURN NULL;
END; $$;
DROP TRIGGER IF EXISTS trg_orders_accept_delivery_on_complete ON public.orders;
CREATE TRIGGER trg_orders_accept_delivery_on_complete AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_accept_delivery_on_complete();

-- ===========================================================================
-- One read for the order page
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_order_workroom(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT is_order_participant(p_order_id) THEN RAISE EXCEPTION 'Not authorized'; END IF;
  RETURN jsonb_build_object(
    'intake_answers', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.position, a.created_at), '[]'::jsonb) FROM order_intake_answers a WHERE a.order_id = p_order_id),
    'references', (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.created_at), '[]'::jsonb) FROM order_attachments f WHERE f.order_id = p_order_id AND f.kind = 'reference'),
    'revisions', (SELECT COALESCE(jsonb_agg((to_jsonb(r) || jsonb_build_object('attachments',
        (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.created_at), '[]'::jsonb) FROM order_attachments f WHERE f.revision_id = r.id))) ORDER BY r.number), '[]'::jsonb)
      FROM order_revisions r WHERE r.order_id = p_order_id),
    'deliveries', (SELECT COALESCE(jsonb_agg((to_jsonb(d) || jsonb_build_object('attachments',
        (SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.created_at), '[]'::jsonb) FROM order_attachments f WHERE f.delivery_id = d.id))) ORDER BY d.version), '[]'::jsonb)
      FROM order_deliveries d WHERE d.order_id = p_order_id)
  );
END; $$;
REVOKE EXECUTE ON FUNCTION public.get_order_workroom(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_workroom(UUID) TO authenticated, service_role;

-- ===========================================================================
-- Rolled-back self-test
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.workroom_selftest_body(p_buyer UUID, p_seller UUID, p_product UUID, p_pricing UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_out TEXT := ''; v_field UUID; v_r JSONB; v_o UUID; v_w JSONB; v_prefix TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_seller) THEN
    UPDATE seller_profiles SET is_accepting_commissions = TRUE, require_approval = FALSE WHERE user_id = p_seller;
  ELSE
    INSERT INTO seller_profiles (user_id, store_name, is_accepting_commissions, require_approval, setup_completed)
    VALUES (p_seller, 'selftest', TRUE, FALSE, TRUE);
  END IF;
  UPDATE commission_listings SET availability = 'open', slots_total = NULL WHERE product_id = p_product;
  UPDATE product_pricing SET revisions = 1 WHERE id = p_pricing;
  DELETE FROM listing_intake_fields WHERE product_id = p_product;
  INSERT INTO listing_intake_fields (product_id, seller_id, position, label, field_type, required)
  VALUES (p_product, p_seller, 0, 'What is it for?', 'short_text', TRUE) RETURNING id INTO v_field;

  -- (a) required question enforced
  BEGIN
    PERFORM create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'brief', '{"answers": []}'::jsonb);
    v_out := v_out || 'a.missing=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'a.missing=refused'; END;

  -- (b) answered → order + snapshot answer + legacy notes
  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'brief',
           jsonb_build_object('answers', jsonb_build_array(jsonb_build_object('field_id', v_field, 'value', 'A wedding gift')), 'notes', 'be gentle'));
  v_o := (v_r->>'order_id')::UUID;
  v_out := v_out || ' b.answers=' || (SELECT count(*) FROM order_intake_answers WHERE order_id = v_o)
        || '/' || (SELECT value_text FROM order_intake_answers WHERE order_id = v_o AND field_id = v_field);
  v_prefix := 'orders/' || v_o::TEXT || '/';

  -- run the rest as the buyer / seller
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  -- (c) references: wrong path refused, right path stored
  BEGIN
    PERFORM add_order_references(v_o, '[{"path":"orders/00000000-0000-0000-0000-000000000000/references/x.png","name":"x.png"}]'::jsonb);
    v_out := v_out || ' c.badpath=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' c.badpath=refused'; END;
  v_r := add_order_references(v_o, jsonb_build_array(jsonb_build_object('path', v_prefix || 'references/ref1.png', 'name', 'ref1.png', 'type', 'image/png', 'size', 1234)));
  v_out := v_out || ' refs=' || (v_r->>'total');

  -- (d) seller delivers from paid (auto-starts), v1 with a file
  UPDATE orders SET status = 'paid', payment_status = 'paid' WHERE id = v_o;
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  BEGIN
    PERFORM submit_order_delivery(v_o, NULL, '[]'::jsonb, FALSE); v_out := v_out || ' d.empty=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' d.empty=refused'; END;
  v_r := submit_order_delivery(v_o, 'First pass', jsonb_build_array(jsonb_build_object('path', v_prefix || 'delivery/v1.png', 'name', 'v1.png', 'type', 'image/png', 'size', 5000)), FALSE);
  v_out := v_out || ' v' || (v_r->>'version') || '=' || (SELECT status FROM orders WHERE id = v_o) || '/started=' || (SELECT started_at IS NOT NULL FROM orders WHERE id = v_o);

  -- (e) buyer requests revision 1 with a note; delivery marked; then revision 2 refused (max 1)
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  v_r := request_order_revision(v_o, 'Make it bluer', '[]'::jsonb);
  v_out := v_out || ' e.rev' || (v_r->>'number') || '=' || (SELECT status FROM orders WHERE id = v_o)
        || '/delivery=' || (SELECT status FROM order_deliveries WHERE order_id = v_o AND version = 1);

  -- (f) seller delivers v2 → revision addressed, v1 superseded
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  v_r := submit_order_delivery(v_o, 'Bluer now', '[]'::jsonb, TRUE);
  v_out := v_out || ' f.v' || (v_r->>'version') || ' rev1=' || (SELECT status FROM order_revisions WHERE order_id = v_o AND number = 1)
        || ' v1=' || (SELECT status FROM order_deliveries WHERE order_id = v_o AND version = 1);

  -- (g) second revision refused (max 1); buyer accepts → delivery accepted
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_buyer, 'role', 'authenticated')::TEXT, TRUE);
  BEGIN
    PERFORM request_order_revision(v_o, 'again', '[]'::jsonb); v_out := v_out || ' g.rev2=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' g.rev2=refused'; END;
  PERFORM update_order_as_buyer(v_o, 'completed');
  v_out := v_out || ' accepted=' || (SELECT status FROM order_deliveries WHERE order_id = v_o AND version = 2)
        || '/' || (SELECT status FROM orders WHERE id = v_o);

  -- (h) workroom read
  v_w := get_order_workroom(v_o);
  v_out := v_out || ' h.workroom=' || jsonb_array_length(v_w->'intake_answers') || '/' || jsonb_array_length(v_w->'references')
        || '/' || jsonb_array_length(v_w->'revisions') || '/' || jsonb_array_length(v_w->'deliveries')
        || ' d1files=' || jsonb_array_length(v_w->'deliveries'->0->'attachments');
  RETURN v_out;
END; $$;
REVOKE EXECUTE ON FUNCTION public.workroom_selftest_body(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_workroom_selftest() RETURNS JSONB
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
    v_out := workroom_selftest_body(v_buyer, v_seller, v_product.id, v_pricing.id);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELFTEST_ROLLBACK ' || v_out;
  EXCEPTION WHEN OTHERS THEN v_msg := SQLERRM; END;
  IF v_msg LIKE 'SELFTEST_ROLLBACK %' THEN
    RETURN jsonb_build_object('ok', true, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'result', substr(v_msg, 19));
  END IF;
  RETURN jsonb_build_object('ok', false, 'rolled_back', (SELECT count(*) FROM orders) = v_before, 'error', v_msg);
END; $$;
REVOKE EXECUTE ON FUNCTION public.run_workroom_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_workroom_selftest() TO service_role;
