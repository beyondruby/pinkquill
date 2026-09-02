-- Commissions rebuild — Phase 2a: availability & slots
-- (docs/commissions/02-plan.md, closes the overselling half of RC-B1).
--
-- 1. commission_listings — one row per service product: availability
--    (open / waitlist / closed / scheduled+opens_at), slots_total (NULL =
--    unlimited), slots_used (maintained by trigger from active orders),
--    lead_time_days, turnaround_starts (payment | acceptance), terms,
--    accepts_custom_quotes. Auto-created for every service product.
-- 2. commission_order_gate() — the single rule set that decides whether a
--    buyer may order right now, used by the public availability RPC and by
--    create_marketplace_order under the product row lock (the "last slot"
--    race is serialized there).
-- 3. create_marketplace_order — enforces seller-level
--    is_accepting_commissions, listing availability and slots; a waitlisted
--    request always requires seller approval; due date = start + lead time
--    + package delivery days (never shorter, whatever the buyer typed).
-- 4. Due date re-based when the turnaround clock actually starts (payment
--    or seller acceptance), via a BEFORE UPDATE trigger on orders.
-- 5. get_commission_availability(product_id) (public) and
--    get_order_queue_position(order_id) (buyer/seller) for the UI.
-- 6. run_listing_selftest() — rolled-back scenario suite.
-- Idempotent.

-- ===========================================================================
-- 1. commission_listings
-- ===========================================================================
CREATE TABLE IF NOT EXISTS public.commission_listings (
  product_id UUID PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL,
  availability TEXT NOT NULL DEFAULT 'open'
    CHECK (availability IN ('open', 'waitlist', 'closed', 'scheduled')),
  opens_at TIMESTAMPTZ,
  slots_total INTEGER CHECK (slots_total IS NULL OR slots_total BETWEEN 1 AND 500),
  slots_used INTEGER NOT NULL DEFAULT 0,
  lead_time_days INTEGER NOT NULL DEFAULT 0 CHECK (lead_time_days BETWEEN 0 AND 365),
  turnaround_starts TEXT NOT NULL DEFAULT 'payment'
    CHECK (turnaround_starts IN ('payment', 'acceptance')),
  terms TEXT CHECK (terms IS NULL OR length(terms) <= 5000),
  accepts_custom_quotes BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT commission_listings_scheduled_needs_date
    CHECK (availability <> 'scheduled' OR opens_at IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_commission_listings_seller ON public.commission_listings (seller_id);

ALTER TABLE public.commission_listings ENABLE ROW LEVEL SECURITY;

-- Grants: everyone can read; sellers write their own rows but never
-- slots_used (that column is owned by the trigger below).
REVOKE ALL ON public.commission_listings FROM anon, authenticated;
GRANT SELECT ON public.commission_listings TO anon, authenticated;
GRANT INSERT (product_id, seller_id, availability, opens_at, slots_total, lead_time_days, turnaround_starts, terms, accepts_custom_quotes)
  ON public.commission_listings TO authenticated;
GRANT UPDATE (availability, opens_at, slots_total, lead_time_days, turnaround_starts, terms, accepts_custom_quotes, updated_at)
  ON public.commission_listings TO authenticated;
GRANT DELETE ON public.commission_listings TO authenticated;

DROP POLICY IF EXISTS "commission_listings_public_read" ON public.commission_listings;
CREATE POLICY "commission_listings_public_read" ON public.commission_listings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.products p
      WHERE p.id = product_id AND (p.status::TEXT = 'active' OR p.seller_id = (SELECT auth.uid()))
    )
  );
DROP POLICY IF EXISTS "commission_listings_seller_insert" ON public.commission_listings;
CREATE POLICY "commission_listings_seller_insert" ON public.commission_listings
  FOR INSERT WITH CHECK (
    seller_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_id AND p.seller_id = (SELECT auth.uid()) AND p.listing_type = 'service')
  );
DROP POLICY IF EXISTS "commission_listings_seller_update" ON public.commission_listings;
CREATE POLICY "commission_listings_seller_update" ON public.commission_listings
  FOR UPDATE USING (seller_id = (SELECT auth.uid())) WITH CHECK (seller_id = (SELECT auth.uid()));
DROP POLICY IF EXISTS "commission_listings_seller_delete" ON public.commission_listings;
CREATE POLICY "commission_listings_seller_delete" ON public.commission_listings
  FOR DELETE USING (seller_id = (SELECT auth.uid()));

CREATE OR REPLACE FUNCTION public.touch_commission_listing() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  -- seller_id follows the product; never trust the client's value
  SELECT seller_id INTO NEW.seller_id FROM products WHERE id = NEW.product_id;
  IF NEW.availability <> 'scheduled' THEN NEW.opens_at := NULL; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_commission_listings_touch ON public.commission_listings;
CREATE TRIGGER trg_commission_listings_touch
  BEFORE INSERT OR UPDATE ON public.commission_listings
  FOR EACH ROW EXECUTE FUNCTION public.touch_commission_listing();

-- Every service product gets a listing row (defaults: open, unlimited).
CREATE OR REPLACE FUNCTION public.ensure_commission_listing_row() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.listing_type = 'service' THEN
    INSERT INTO commission_listings (product_id, seller_id)
    VALUES (NEW.id, NEW.seller_id)
    ON CONFLICT (product_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_products_commission_listing ON public.products;
CREATE TRIGGER trg_products_commission_listing
  AFTER INSERT OR UPDATE OF listing_type ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.ensure_commission_listing_row();

INSERT INTO public.commission_listings (product_id, seller_id)
SELECT id, seller_id FROM public.products WHERE listing_type = 'service'
ON CONFLICT (product_id) DO NOTHING;

-- ===========================================================================
-- 2. Slot accounting
-- ===========================================================================
-- An order occupies a slot from the moment it exists until it reaches a
-- terminal state. pending_payment counts: two buyers must not both be able
-- to reach Stripe for the last slot (the webhook cannot refuse money).
-- Stale checkouts are expired by record_checkout_expired, which frees it.
CREATE OR REPLACE FUNCTION public.commission_slot_statuses() RETURNS TEXT[]
LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY['pending_acceptance', 'pending_payment', 'paid', 'in_progress',
               'revision_requested', 'submitted', 'disputed', 'refund_requested']::TEXT[];
$$;

CREATE OR REPLACE FUNCTION public.commission_active_order_count(p_product_id UUID) RETURNS INTEGER
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT count(*)::INTEGER FROM orders
  WHERE product_id = p_product_id AND listing_type = 'service'
    AND status::TEXT = ANY (commission_slot_statuses());
$$;

CREATE OR REPLACE FUNCTION public.refresh_commission_slots(p_product_id UUID) RETURNS VOID
LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  UPDATE commission_listings
  SET slots_used = commission_active_order_count(p_product_id)
  WHERE product_id = p_product_id;
$$;

CREATE OR REPLACE FUNCTION public.trg_orders_refresh_commission_slots() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.listing_type = 'service' THEN
    PERFORM refresh_commission_slots(NEW.product_id);
  END IF;
  IF TG_OP IN ('DELETE', 'UPDATE') AND OLD.listing_type = 'service'
     AND (TG_OP = 'DELETE' OR OLD.product_id IS DISTINCT FROM NEW.product_id) THEN
    PERFORM refresh_commission_slots(OLD.product_id);
  END IF;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_commission_slots ON public.orders;
CREATE TRIGGER trg_orders_commission_slots
  AFTER INSERT OR DELETE OR UPDATE OF status, product_id ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_refresh_commission_slots();

UPDATE public.commission_listings cl SET slots_used = commission_active_order_count(cl.product_id);

-- ===========================================================================
-- 3. The gate: may this listing take an order right now?
-- ===========================================================================
-- mode: 'order'    → normal order
--       'waitlist' → order allowed but always needs seller approval
--       'closed'   → refused (reason says why)
CREATE OR REPLACE FUNCTION public.commission_order_gate(p_product_id UUID)
RETURNS TABLE (
  can_order BOOLEAN, mode TEXT, reason TEXT,
  availability TEXT, opens_at TIMESTAMPTZ, slots_total INTEGER, active_count INTEGER,
  lead_time_days INTEGER, turnaround_starts TEXT, seller_accepting BOOLEAN
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_listing commission_listings%ROWTYPE;
  v_seller_id UUID;
  v_accepting BOOLEAN := TRUE;
  v_active INTEGER;
BEGIN
  SELECT p.seller_id INTO v_seller_id FROM products p WHERE p.id = p_product_id;
  IF v_seller_id IS NULL THEN RETURN; END IF;

  SELECT cl.* INTO v_listing FROM commission_listings cl WHERE cl.product_id = p_product_id;
  IF NOT FOUND THEN
    -- Legacy row without settings: behave as open / unlimited.
    v_listing.availability := 'open'; v_listing.slots_total := NULL;
    v_listing.lead_time_days := 0; v_listing.turnaround_starts := 'payment';
  END IF;

  SELECT COALESCE(sp.is_accepting_commissions, TRUE) INTO v_accepting
  FROM seller_profiles sp WHERE sp.user_id = v_seller_id LIMIT 1;
  v_accepting := COALESCE(v_accepting, TRUE);

  v_active := commission_active_order_count(p_product_id);

  can_order := TRUE; mode := 'order'; reason := NULL;
  availability := v_listing.availability; opens_at := v_listing.opens_at;
  slots_total := v_listing.slots_total; active_count := v_active;
  lead_time_days := v_listing.lead_time_days; turnaround_starts := v_listing.turnaround_starts;
  seller_accepting := v_accepting;

  IF NOT v_accepting THEN
    can_order := FALSE; mode := 'closed'; reason := 'This creator is not taking new commissions right now.';
  ELSIF v_listing.availability = 'closed' THEN
    can_order := FALSE; mode := 'closed'; reason := 'This commission is closed for new requests.';
  ELSIF v_listing.availability = 'scheduled' AND v_listing.opens_at > NOW() THEN
    can_order := FALSE; mode := 'closed';
    reason := 'This commission opens on ' || to_char(v_listing.opens_at AT TIME ZONE 'UTC', 'Mon DD, YYYY') || '.';
  ELSIF v_listing.availability = 'waitlist' THEN
    mode := 'waitlist';
  ELSIF v_listing.slots_total IS NOT NULL AND v_active >= v_listing.slots_total THEN
    can_order := FALSE; mode := 'closed';
    reason := CASE WHEN v_listing.slots_total = 1 THEN 'The only slot is taken right now.'
                   ELSE 'All ' || v_listing.slots_total || ' slots are taken right now.' END;
  END IF;
  RETURN NEXT;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.commission_order_gate(UUID) FROM PUBLIC, anon, authenticated;

-- ===========================================================================
-- 4. create_marketplace_order — enforce the gate under the product lock
-- ===========================================================================
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
    -- Availability + slots, decided while holding the products row lock so
    -- two buyers racing for the last slot are serialized here.
    INSERT INTO commission_listings (product_id, seller_id) VALUES (p_product_id, v_product.seller_id)
    ON CONFLICT (product_id) DO NOTHING;
    SELECT * INTO v_gate FROM commission_order_gate(p_product_id);
    IF v_gate.can_order IS DISTINCT FROM TRUE THEN
      RAISE EXCEPTION '%', COALESCE(v_gate.reason, 'This commission is not taking orders right now.');
    END IF;
    v_lead_time := COALESCE(v_gate.lead_time_days, 0);
    IF v_gate.mode = 'waitlist' THEN
      v_queued := TRUE;
      v_requires_seller_approval := TRUE;      -- the seller decides when
      v_queue_position := v_gate.active_count + 1;
    END IF;

    -- Due date: lead time + package delivery days from now; the clock is
    -- re-based when payment / acceptance actually happens (trigger below).
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
    CASE WHEN v_listing_type = 'service' THEN COALESCE(p_requirements, '{}'::jsonb) ELSE '{}'::jsonb END,
    CASE WHEN v_listing_type = 'service' THEN v_due_date ELSE NULL END,
    CASE WHEN v_listing_type = 'service' THEN v_pricing.revisions ELSE NULL END,
    v_quantity,
    CASE WHEN v_listing_type = 'product' THEN p_shipping_address ELSE NULL END,
    v_shipping_cost,
    CASE WHEN v_requires_seller_approval THEN NULL ELSE TRUE END,
    CASE WHEN v_requires_seller_approval THEN NOW() + make_interval(hours => v_auto_decline_hours) ELSE NULL END
  ) RETURNING id INTO v_order_id;

  INSERT INTO order_events (order_id, actor_id, event_type, from_status, to_status, metadata)
  VALUES (v_order_id, p_buyer_id, 'status_change', NULL, v_initial_status,
    jsonb_build_object('source', 'create_marketplace_order', 'requires_approval', v_requires_seller_approval,
                       'pwyw', v_is_pwyw, 'unit_price', v_unit_price, 'buyer_fee', v_money.buyer_fee,
                       'queued', v_queued, 'queue_position', v_queue_position, 'lead_time_days', v_lead_time));

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
-- 5. Due date re-base when the turnaround clock starts
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.trg_orders_rebase_due_date() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_listing commission_listings%ROWTYPE;
  v_delivery_days INTEGER;
  v_starts BOOLEAN := FALSE;
BEGIN
  IF NEW.listing_type <> 'service' THEN RETURN NEW; END IF;
  SELECT * INTO v_listing FROM commission_listings WHERE product_id = NEW.product_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  IF v_listing.turnaround_starts = 'payment'
     AND NEW.status::TEXT = 'paid' AND OLD.status::TEXT IS DISTINCT FROM 'paid' THEN
    v_starts := TRUE;
  ELSIF v_listing.turnaround_starts = 'acceptance'
     AND NEW.seller_accepted IS TRUE AND OLD.seller_accepted IS DISTINCT FROM TRUE THEN
    v_starts := TRUE;
  END IF;
  IF NOT v_starts THEN RETURN NEW; END IF;

  SELECT delivery_days INTO v_delivery_days FROM product_pricing WHERE id = NEW.pricing_id;
  NEW.due_date := NOW() + make_interval(days => v_listing.lead_time_days + COALESCE(v_delivery_days, 0));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_orders_rebase_due_date ON public.orders;
CREATE TRIGGER trg_orders_rebase_due_date
  BEFORE UPDATE OF status, seller_accepted ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_orders_rebase_due_date();

-- ===========================================================================
-- 6. Read RPCs for the UI
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_commission_availability(p_product_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_gate RECORD;
  v_listing commission_listings%ROWTYPE;
BEGIN
  SELECT * INTO v_gate FROM commission_order_gate(p_product_id);
  IF v_gate IS NULL OR v_gate.mode IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_listing FROM commission_listings WHERE product_id = p_product_id;
  RETURN jsonb_build_object(
    'can_order', v_gate.can_order,
    'mode', v_gate.mode,
    'reason', v_gate.reason,
    'availability', v_gate.availability,
    'opens_at', v_gate.opens_at,
    'slots_total', v_gate.slots_total,
    'slots_used', v_gate.active_count,
    'slots_open', CASE WHEN v_gate.slots_total IS NULL THEN NULL ELSE GREATEST(v_gate.slots_total - v_gate.active_count, 0) END,
    'queue_length', v_gate.active_count,
    'lead_time_days', v_gate.lead_time_days,
    'turnaround_starts', v_gate.turnaround_starts,
    'seller_accepting', v_gate.seller_accepting,
    'accepts_custom_quotes', COALESCE(v_listing.accepts_custom_quotes, FALSE),
    'terms', v_listing.terms
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_commission_availability(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_commission_availability(UUID) TO anon, authenticated, service_role;

-- Where does this request sit in the creator's queue for this listing?
-- Only meaningful before work starts; NULL otherwise.
CREATE OR REPLACE FUNCTION public.get_order_queue_position(p_order_id UUID) RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_order orders%ROWTYPE;
  v_position INTEGER;
  v_total INTEGER;
  v_slots INTEGER;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF auth.uid() IS DISTINCT FROM v_order.buyer_id AND auth.uid() IS DISTINCT FROM v_order.seller_id
     AND NOT is_platform_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF v_order.listing_type <> 'service' OR v_order.status::TEXT NOT IN ('pending_acceptance', 'pending_payment', 'paid') THEN
    RETURN NULL;
  END IF;

  SELECT count(*) + 1 INTO v_position FROM orders o
  WHERE o.product_id = v_order.product_id AND o.listing_type = 'service'
    AND o.status::TEXT = ANY (commission_slot_statuses())
    AND o.created_at < v_order.created_at;
  v_total := commission_active_order_count(v_order.product_id);
  SELECT slots_total INTO v_slots FROM commission_listings WHERE product_id = v_order.product_id;

  RETURN jsonb_build_object('position', v_position, 'total_active', v_total, 'slots_total', v_slots);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_order_queue_position(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_order_queue_position(UUID) TO authenticated, service_role;

-- ===========================================================================
-- 7. Rolled-back self-test
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.listing_selftest_body(p_buyer UUID, p_seller UUID, p_product UUID, p_pricing UUID)
RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_out TEXT := '';
  v_r JSONB; v_o1 UUID; v_msg TEXT; v_g RECORD; v_due TIMESTAMPTZ; v_days INTEGER;
  v_second_buyer UUID;
BEGIN
  -- a fixture: 1 slot, 2-day lead, open, seller accepting
  IF EXISTS (SELECT 1 FROM seller_profiles WHERE user_id = p_seller) THEN
    UPDATE seller_profiles SET is_accepting_commissions = TRUE, require_approval = FALSE WHERE user_id = p_seller;
  ELSE
    INSERT INTO seller_profiles (user_id, store_name, is_accepting_commissions, require_approval, setup_completed)
    VALUES (p_seller, 'selftest', TRUE, FALSE, TRUE);
  END IF;
  UPDATE commission_listings SET availability = 'open', slots_total = 1, lead_time_days = 2, turnaround_starts = 'payment'
  WHERE product_id = p_product;
  SELECT delivery_days INTO v_days FROM product_pricing WHERE id = p_pricing;
  SELECT id INTO v_second_buyer FROM profiles WHERE id NOT IN (p_buyer, p_seller) LIMIT 1;
  IF v_second_buyer IS NULL THEN v_second_buyer := p_buyer; END IF;

  -- (a) first order takes the only slot; due = lead + delivery
  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'selftest brief');
  v_o1 := (v_r->>'order_id')::UUID;
  SELECT due_date INTO v_due FROM orders WHERE id = v_o1;
  SELECT * INTO v_g FROM commission_order_gate(p_product);
  v_out := v_out || 'a.status=' || (v_r->>'status') || ' due_days=' || EXTRACT(DAY FROM (v_due - NOW()) + interval '1 hour')::INT
        || ' expected=' || (2 + COALESCE(v_days, 0)) || ' active=' || v_g.active_count || ' can_order=' || v_g.can_order;

  -- (b) second buyer is refused: slot taken
  BEGIN
    PERFORM create_marketplace_order(v_second_buyer, p_product, p_pricing, 1, 'second');
    v_out := v_out || ' b.second=ALLOWED';
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || ' b.second=refused(' || SQLERRM || ')';
  END;

  -- (c) waitlist: allowed, forced to seller approval, queue position 2
  UPDATE commission_listings SET availability = 'waitlist' WHERE product_id = p_product;
  v_r := create_marketplace_order(v_second_buyer, p_product, p_pricing, 1, 'waitlisted');
  v_out := v_out || ' c.waitlist=' || (v_r->>'status') || '/queued=' || (v_r->>'queued') || '/pos=' || (v_r->>'queue_position');
  v_out := v_out || ' slots_used=' || (SELECT slots_used FROM commission_listings WHERE product_id = p_product);

  -- (d) cancelling the first frees the slot
  UPDATE orders SET status = 'cancelled' WHERE id = v_o1;
  v_out := v_out || ' d.after_cancel_used=' || (SELECT slots_used FROM commission_listings WHERE product_id = p_product);

  -- (e) closed / scheduled / seller not accepting are refused with a reason
  UPDATE commission_listings SET availability = 'closed' WHERE product_id = p_product;
  BEGIN
    PERFORM create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'x'); v_out := v_out || ' e.closed=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' e.closed=refused'; END;
  UPDATE commission_listings SET availability = 'scheduled', opens_at = NOW() + interval '3 days' WHERE product_id = p_product;
  BEGIN
    PERFORM create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'x'); v_out := v_out || ' scheduled=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' scheduled=refused'; END;
  UPDATE commission_listings SET availability = 'scheduled', opens_at = NOW() - interval '1 day', slots_total = NULL WHERE product_id = p_product;
  v_r := create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'opened');
  v_out := v_out || ' scheduled_past=' || (v_r->>'status');
  UPDATE seller_profiles SET is_accepting_commissions = FALSE WHERE user_id = p_seller;
  BEGIN
    PERFORM create_marketplace_order(p_buyer, p_product, p_pricing, 1, 'x'); v_out := v_out || ' not_accepting=ALLOWED';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' not_accepting=refused'; END;
  UPDATE seller_profiles SET is_accepting_commissions = TRUE WHERE user_id = p_seller;

  -- (f) due date re-based when payment lands (turnaround starts at payment)
  UPDATE orders SET due_date = NOW() - interval '10 days' WHERE id = (v_r->>'order_id')::UUID;
  UPDATE orders SET status = 'paid' WHERE id = (v_r->>'order_id')::UUID;
  SELECT due_date INTO v_due FROM orders WHERE id = (v_r->>'order_id')::UUID;
  v_out := v_out || ' f.rebased_days=' || EXTRACT(DAY FROM (v_due - NOW()) + interval '1 hour')::INT;

  -- (g) public availability RPC agrees
  v_r := get_commission_availability(p_product);
  v_out := v_out || ' g.mode=' || (v_r->>'mode') || ' used=' || (v_r->>'slots_used') || ' accepting=' || (v_r->>'seller_accepting');
  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.listing_selftest_body(UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_listing_selftest() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
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
    v_out := listing_selftest_body(v_buyer, v_seller, v_product.id, v_pricing.id);
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
REVOKE EXECUTE ON FUNCTION public.run_listing_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_listing_selftest() TO service_role;
