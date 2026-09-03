-- Phase 4b — Load & realtime (2026-09-03)
-- 1. Order changes and order messages fan out over the existing per-user
--    broadcast channel (user-events:<userId>) so the client keeps ONE
--    realtime channel; the three postgres_changes subscriptions are gone.
-- 2. get_seller_customers: the CRM aggregate computed in one query instead of
--    every order row shipped to the browser.
-- 3. save_commission_listing: the listing wizard's ten writes become one
--    transaction (product, settings, questions, keywords, media rows,
--    packages) — a half-saved listing is no longer possible.
-- Idempotent. No money-path change.

-- ===========================================================================
-- 1. Broadcast triggers (same pattern as notify_dm_unread_change / notify_follow_change)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.notify_order_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'realtime'
AS $$
DECLARE v_payload jsonb;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status = OLD.status AND NEW.payment_status = OLD.payment_status
     AND NEW.due_date IS NOT DISTINCT FROM OLD.due_date AND NEW.tracking_number IS NOT DISTINCT FROM OLD.tracking_number
     AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at AND NEW.submitted_at IS NOT DISTINCT FROM OLD.submitted_at
     AND NEW.brief IS NOT DISTINCT FROM OLD.brief AND NEW.transfer_status IS NOT DISTINCT FROM OLD.transfer_status THEN
    RETURN NULL; -- nothing a screen shows changed
  END IF;
  v_payload := jsonb_build_object(
    'op', TG_OP, 'order_id', NEW.id, 'status', NEW.status, 'payment_status', NEW.payment_status,
    'buyer_id', NEW.buyer_id, 'seller_id', NEW.seller_id, 'updated_at', NEW.updated_at
  );
  BEGIN
    PERFORM realtime.send(v_payload, 'order_change', 'user-events:' || NEW.buyer_id::text, true);
    IF NEW.seller_id <> NEW.buyer_id THEN
      PERFORM realtime.send(v_payload, 'order_change', 'user-events:' || NEW.seller_id::text, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- realtime must never fail an order write
  END;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_order_change ON public.orders;
CREATE TRIGGER trg_notify_order_change AFTER INSERT OR UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_change();

CREATE OR REPLACE FUNCTION public.notify_order_message() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'realtime'
AS $$
DECLARE v_o RECORD; v_payload jsonb;
BEGIN
  SELECT buyer_id, seller_id INTO v_o FROM orders WHERE id = NEW.order_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_payload := jsonb_build_object(
    'op', 'INSERT', 'order_id', NEW.order_id, 'message_id', NEW.id, 'sender_id', NEW.sender_id,
    'message_type', NEW.message_type, 'created_at', NEW.created_at
  );
  BEGIN
    PERFORM realtime.send(v_payload, 'order_message', 'user-events:' || v_o.buyer_id::text, true);
    IF v_o.seller_id <> v_o.buyer_id THEN
      PERFORM realtime.send(v_payload, 'order_message', 'user-events:' || v_o.seller_id::text, true);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NULL;
END;
$$;
DROP TRIGGER IF EXISTS trg_notify_order_message ON public.order_messages;
CREATE TRIGGER trg_notify_order_message AFTER INSERT ON public.order_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_order_message();

-- ===========================================================================
-- 2. Seller customers aggregate
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.get_seller_customers(p_seller_id UUID)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_caller UUID := auth.uid(); v_customers JSONB; v_stats JSONB;
BEGIN
  IF v_caller IS NULL AND auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_caller IS NOT NULL AND v_caller <> p_seller_id AND NOT is_platform_admin(v_caller) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  WITH o AS (
    SELECT o.id, o.order_number, o.status, o.amount, o.created_at, o.listing_type, o.buyer_id, o.buyer_phone, o.shipping_address, p.title,
      o.status IN ('paid', 'in_progress', 'submitted', 'revision_requested', 'processing', 'shipped') AS is_active,
      o.status IN ('completed', 'delivered') AS is_completed
    FROM orders o LEFT JOIN products p ON p.id = o.product_id
    WHERE o.seller_id = p_seller_id
  ),
  per_buyer AS (
    SELECT o.buyer_id,
      COUNT(*) AS total_orders,
      COUNT(*) FILTER (WHERE is_completed) AS completed_orders,
      COUNT(*) FILTER (WHERE is_active) AS active_orders,
      COALESCE(SUM(amount) FILTER (WHERE is_active OR is_completed), 0) AS total_spent,
      COUNT(*) FILTER (WHERE is_active OR is_completed) AS revenue_orders,
      MIN(created_at) AS first_order_at, MAX(created_at) AS last_order_at,
      (SELECT buyer_phone FROM o o2 WHERE o2.buyer_id = o.buyer_id AND o2.buyer_phone IS NOT NULL ORDER BY o2.created_at DESC LIMIT 1) AS buyer_phone,
      (SELECT shipping_address FROM o o3 WHERE o3.buyer_id = o.buyer_id AND o3.shipping_address IS NOT NULL ORDER BY o3.created_at DESC LIMIT 1) AS shipping_address,
      (SELECT jsonb_agg(jsonb_build_object('id', o4.id, 'order_number', o4.order_number, 'status', o4.status, 'amount', o4.amount, 'created_at', o4.created_at, 'product_title', o4.title, 'listing_type', o4.listing_type) ORDER BY o4.created_at DESC)
         FROM o o4 WHERE o4.buyer_id = o.buyer_id) AS orders
    FROM o GROUP BY o.buyer_id
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'buyer_id', b.buyer_id, 'username', pr.username, 'display_name', pr.display_name, 'avatar_url', pr.avatar_url, 'is_verified', COALESCE(pr.is_verified, FALSE),
      'total_orders', b.total_orders, 'completed_orders', b.completed_orders, 'active_orders', b.active_orders,
      'total_spent', ROUND(b.total_spent, 2), 'avg_order_value', CASE WHEN b.revenue_orders = 0 THEN 0 ELSE ROUND(b.total_spent / b.revenue_orders, 2) END,
      'buyer_phone', b.buyer_phone, 'shipping_address', b.shipping_address, 'first_order_at', b.first_order_at, 'last_order_at', b.last_order_at, 'orders', COALESCE(b.orders, '[]'::jsonb)
    ) ORDER BY b.total_spent DESC, b.last_order_at DESC), '[]'::jsonb)
  INTO v_customers
  FROM per_buyer b JOIN profiles pr ON pr.id = b.buyer_id;

  WITH o AS (
    SELECT buyer_id, amount, status IN ('paid', 'in_progress', 'submitted', 'revision_requested', 'processing', 'shipped', 'completed', 'delivered') AS counts
    FROM orders WHERE seller_id = p_seller_id
  ), per_buyer AS (SELECT buyer_id, COUNT(*) AS n FROM o GROUP BY buyer_id)
  SELECT jsonb_build_object(
    'total_customers', (SELECT COUNT(*) FROM per_buyer),
    'repeat_customers', (SELECT COUNT(*) FROM per_buyer WHERE n > 1),
    'total_revenue', ROUND(COALESCE((SELECT SUM(amount) FROM o WHERE counts), 0), 2),
    'avg_order_value', ROUND(COALESCE((SELECT AVG(amount) FROM o WHERE counts), 0), 2)
  ) INTO v_stats;

  RETURN jsonb_build_object('customers', v_customers, 'stats', v_stats);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.get_seller_customers(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_seller_customers(UUID) TO authenticated, service_role;

-- ===========================================================================
-- 3. One transaction for the listing wizard
-- ===========================================================================
-- p_payload: { title, description, headline, category, subcategory, status?,
--   settings {availability, opens_at, slots_total, lead_time_days, turnaround_starts, terms, accepts_custom_quotes},
--   intake_fields [{id?, label, help_text, field_type, options, required}],
--   keywords [text], includes [text], excludes [text], faqs [{question, answer}],
--   media [{id?, url, media_type, is_primary}]  (files are uploaded by the client first),
--   packages [{pricing_id?, tier, name, description, price, delivery_days, revisions, features}] }
CREATE OR REPLACE FUNCTION public.save_commission_listing(p_product_id UUID, p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_caller UUID := auth.uid();
  v_id UUID := p_product_id;
  v_status TEXT := NULLIF(p_payload->>'status', '');
  v_publishing BOOLEAN;
  v_title TEXT := left(trim(COALESCE(p_payload->>'title', '')), 200);
  v_description TEXT := trim(COALESCE(p_payload->>'description', ''));
  v_category TEXT := NULLIF(trim(COALESCE(p_payload->>'category', '')), '');
  v_slug TEXT;
  v_existing_meta JSONB := '{}'::jsonb;
  v_settings JSONB := COALESCE(p_payload->'settings', '{}'::jsonb);
  v_opens_at TIMESTAMPTZ;
  v_item JSONB; v_idx INTEGER := 0; v_row_id UUID;
  v_keep UUID[] := '{}';
  v_packages JSONB := COALESCE(p_payload->'packages', '[]'::jsonb);
  v_valid_packages INTEGER := 0;
  v_pkg_id UUID; v_tier TEXT; v_name TEXT; v_price NUMERIC;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_category IS NULL THEN RAISE EXCEPTION 'Select a commission category'; END IF;
  IF v_title = '' THEN RAISE EXCEPTION 'Give the listing a title'; END IF;
  IF v_status IS NOT NULL AND v_status NOT IN ('draft', 'active') THEN RAISE EXCEPTION 'Invalid status'; END IF;

  -- count usable packages (name + price); publishing needs at least one
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_packages) LOOP
    IF trim(COALESCE(v_item->>'name', '')) <> '' AND COALESCE((v_item->>'price')::NUMERIC, 0) > 0 THEN v_valid_packages := v_valid_packages + 1; END IF;
  END LOOP;

  IF v_id IS NULL THEN
    v_status := COALESCE(v_status, 'active');
    v_publishing := v_status = 'active';
    IF v_publishing AND v_valid_packages = 0 THEN RAISE EXCEPTION 'Add at least one package with a price'; END IF;
    v_slug := generate_product_slug(v_title, v_caller);
    INSERT INTO products (seller_id, listing_type, title, slug, description, delivery_type, category, subcategory, attributes, service_metadata, status)
    VALUES (v_caller, 'service', v_title, v_slug, v_description, 'digital', v_category, NULLIF(p_payload->>'subcategory', ''), '{}'::jsonb,
      jsonb_build_object(
        'headline', NULLIF(trim(COALESCE(p_payload->>'headline', '')), ''),
        'requirements', COALESCE((SELECT jsonb_agg(trim(f->>'label')) FROM jsonb_array_elements(COALESCE(p_payload->'intake_fields', '[]'::jsonb)) f WHERE trim(COALESCE(f->>'label', '')) <> ''), '[]'::jsonb),
        'faqs', COALESCE(p_payload->'faqs', '[]'::jsonb), 'includes', COALESCE(p_payload->'includes', '[]'::jsonb), 'excludes', COALESCE(p_payload->'excludes', '[]'::jsonb)),
      v_status::product_status)
    RETURNING id, slug INTO v_id, v_slug;
  ELSE
    SELECT service_metadata INTO v_existing_meta FROM products WHERE id = v_id AND seller_id = v_caller AND listing_type = 'service' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Commission not found or not editable'; END IF;
    v_publishing := v_status = 'active';
    IF v_publishing AND v_description = '' THEN RAISE EXCEPTION 'Service description is required'; END IF;
    IF v_valid_packages = 0 AND COALESCE(v_status, 'active') <> 'draft' THEN RAISE EXCEPTION 'Add at least one package with price and title'; END IF;
    IF jsonb_typeof(v_existing_meta) <> 'object' THEN v_existing_meta := '{}'::jsonb; END IF;
    UPDATE products SET
      title = v_title, description = v_description, delivery_type = 'digital', category = v_category, subcategory = NULLIF(p_payload->>'subcategory', ''), attributes = '{}'::jsonb,
      service_metadata = v_existing_meta || jsonb_build_object(
        'headline', NULLIF(trim(COALESCE(p_payload->>'headline', '')), ''),
        'requirements', COALESCE((SELECT jsonb_agg(trim(f->>'label')) FROM jsonb_array_elements(COALESCE(p_payload->'intake_fields', '[]'::jsonb)) f WHERE trim(COALESCE(f->>'label', '')) <> ''), '[]'::jsonb),
        'faqs', COALESCE(p_payload->'faqs', '[]'::jsonb), 'includes', COALESCE(p_payload->'includes', '[]'::jsonb), 'excludes', COALESCE(p_payload->'excludes', '[]'::jsonb)),
      status = COALESCE(v_status::product_status, status), updated_at = NOW()
    WHERE id = v_id
    RETURNING slug INTO v_slug;
  END IF;

  -- listing settings (the products trigger created the row on insert)
  IF v_settings->>'availability' = 'scheduled' THEN
    v_opens_at := NULLIF(v_settings->>'opens_at', '')::TIMESTAMPTZ;
    IF v_opens_at IS NULL THEN RAISE EXCEPTION 'Pick the date this commission opens'; END IF;
  END IF;
  UPDATE commission_listings SET
    availability = COALESCE(NULLIF(v_settings->>'availability', ''), availability),
    opens_at = v_opens_at,
    slots_total = CASE WHEN v_settings ? 'slots_total' AND jsonb_typeof(v_settings->'slots_total') = 'number' THEN LEAST(500, GREATEST(1, ROUND((v_settings->>'slots_total')::NUMERIC)))::INTEGER ELSE NULL END,
    lead_time_days = LEAST(365, GREATEST(0, ROUND(COALESCE((v_settings->>'lead_time_days')::NUMERIC, 0))))::INTEGER,
    turnaround_starts = COALESCE(NULLIF(v_settings->>'turnaround_starts', ''), turnaround_starts),
    terms = NULLIF(left(trim(COALESCE(v_settings->>'terms', '')), 5000), ''),
    accepts_custom_quotes = COALESCE((v_settings->>'accepts_custom_quotes')::BOOLEAN, FALSE),
    updated_at = NOW()
  WHERE product_id = v_id;

  -- intake questions: existing ids updated in place (answers keep pointing at them), the rest replaced
  v_keep := '{}'; v_idx := 0;
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'intake_fields', '[]'::jsonb)) LOOP
    IF trim(COALESCE(v_item->>'label', '')) = '' THEN CONTINUE; END IF;
    v_row_id := NULLIF(v_item->>'id', '')::UUID;
    IF v_row_id IS NOT NULL AND EXISTS (SELECT 1 FROM listing_intake_fields WHERE id = v_row_id AND product_id = v_id) THEN
      UPDATE listing_intake_fields SET position = v_idx, label = left(trim(v_item->>'label'), 200), help_text = NULLIF(left(trim(COALESCE(v_item->>'help_text', '')), 500), ''),
        field_type = COALESCE(NULLIF(v_item->>'field_type', ''), 'long_text'),
        options = CASE WHEN COALESCE(v_item->>'field_type', '') IN ('select', 'multi_select') THEN COALESCE(v_item->'options', '[]'::jsonb) ELSE '[]'::jsonb END,
        required = COALESCE((v_item->>'required')::BOOLEAN, FALSE), updated_at = NOW()
      WHERE id = v_row_id;
    ELSE
      INSERT INTO listing_intake_fields (product_id, seller_id, position, label, help_text, field_type, options, required)
      VALUES (v_id, v_caller, v_idx, left(trim(v_item->>'label'), 200), NULLIF(left(trim(COALESCE(v_item->>'help_text', '')), 500), ''),
        COALESCE(NULLIF(v_item->>'field_type', ''), 'long_text'),
        CASE WHEN COALESCE(v_item->>'field_type', '') IN ('select', 'multi_select') THEN COALESCE(v_item->'options', '[]'::jsonb) ELSE '[]'::jsonb END,
        COALESCE((v_item->>'required')::BOOLEAN, FALSE))
      RETURNING id INTO v_row_id;
    END IF;
    v_keep := v_keep || v_row_id; v_idx := v_idx + 1;
  END LOOP;
  DELETE FROM listing_intake_fields WHERE product_id = v_id AND NOT (id = ANY (v_keep));

  -- keywords: replaced
  DELETE FROM product_keywords WHERE product_id = v_id;
  INSERT INTO product_keywords (product_id, keyword)
  SELECT DISTINCT v_id, lower(trim(k)) FROM jsonb_array_elements_text(COALESCE(p_payload->'keywords', '[]'::jsonb)) k WHERE trim(k) <> '';

  -- media rows: by id, else by url; the rest removed (files themselves are the client's business)
  IF p_payload ? 'media' THEN
    v_keep := '{}'; v_idx := 0;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_payload->'media') LOOP
      v_row_id := NULLIF(v_item->>'id', '')::UUID;
      IF v_row_id IS NULL OR NOT EXISTS (SELECT 1 FROM product_media WHERE id = v_row_id AND product_id = v_id) THEN
        SELECT id INTO v_row_id FROM product_media WHERE product_id = v_id AND media_url = v_item->>'url' AND NOT (id = ANY (v_keep)) LIMIT 1;
      END IF;
      IF v_row_id IS NOT NULL THEN
        UPDATE product_media SET media_url = COALESCE(NULLIF(v_item->>'url', ''), media_url), media_type = COALESCE(NULLIF(v_item->>'media_type', ''), media_type),
          is_primary = COALESCE((v_item->>'is_primary')::BOOLEAN, FALSE), position = v_idx WHERE id = v_row_id;
      ELSE
        INSERT INTO product_media (product_id, media_url, media_type, is_primary, position)
        VALUES (v_id, v_item->>'url', COALESCE(NULLIF(v_item->>'media_type', ''), 'image'), COALESCE((v_item->>'is_primary')::BOOLEAN, FALSE), v_idx)
        RETURNING id INTO v_row_id;
      END IF;
      v_keep := v_keep || v_row_id; v_idx := v_idx + 1;
    END LOOP;
    DELETE FROM product_media WHERE product_id = v_id AND NOT (id = ANY (v_keep));
    -- exactly one primary
    IF NOT EXISTS (SELECT 1 FROM product_media WHERE product_id = v_id AND is_primary) THEN
      UPDATE product_media SET is_primary = TRUE WHERE id = (SELECT id FROM product_media WHERE product_id = v_id ORDER BY position LIMIT 1);
    END IF;
  END IF;

  -- packages: by pricing_id, else by tier or name; orphans deleted, or disabled when an order references them
  v_keep := '{}';
  FOR v_item IN SELECT * FROM jsonb_array_elements(v_packages) LOOP
    v_name := left(trim(COALESCE(v_item->>'name', '')), 100);
    v_price := (v_item->>'price')::NUMERIC;
    IF v_name = '' OR v_price IS NULL OR v_price <= 0 THEN CONTINUE; END IF;
    v_tier := NULLIF(v_item->>'tier', '');
    v_pkg_id := NULLIF(v_item->>'pricing_id', '')::UUID;
    IF v_pkg_id IS NULL OR NOT EXISTS (SELECT 1 FROM product_pricing WHERE id = v_pkg_id AND product_id = v_id) THEN
      SELECT id INTO v_pkg_id FROM product_pricing
      WHERE product_id = v_id AND pricing_type = 'service_package' AND NOT (id = ANY (v_keep))
        AND (package_tier = v_tier OR lower(trim(COALESCE(variant_name, ''))) = lower(v_name))
      ORDER BY (package_tier = v_tier) DESC NULLS LAST LIMIT 1;
    END IF;
    IF v_pkg_id IS NOT NULL THEN
      UPDATE product_pricing SET pricing_type = 'service_package', variant_name = v_name, price = v_price, min_price = v_price, currency = 'USD', stock = NULL, is_available = TRUE,
        package_tier = v_tier, delivery_days = GREATEST(1, COALESCE((v_item->>'delivery_days')::INTEGER, 1)), revisions = GREATEST(0, COALESCE((v_item->>'revisions')::INTEGER, 0)),
        package_features = COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements_text(COALESCE(v_item->'features', '[]'::jsonb)) f WHERE trim(f) <> ''), '[]'::jsonb),
        reproduction_options = jsonb_build_object('description', COALESCE(v_item->>'description', ''))
      WHERE id = v_pkg_id;
    ELSE
      INSERT INTO product_pricing (product_id, pricing_type, variant_name, price, min_price, currency, stock, is_available, package_tier, delivery_days, revisions, package_features, reproduction_options)
      VALUES (v_id, 'service_package', v_name, v_price, v_price, 'USD', NULL, TRUE, v_tier, GREATEST(1, COALESCE((v_item->>'delivery_days')::INTEGER, 1)), GREATEST(0, COALESCE((v_item->>'revisions')::INTEGER, 0)),
        COALESCE((SELECT jsonb_agg(f) FROM jsonb_array_elements_text(COALESCE(v_item->'features', '[]'::jsonb)) f WHERE trim(f) <> ''), '[]'::jsonb),
        jsonb_build_object('description', COALESCE(v_item->>'description', '')))
      RETURNING id INTO v_pkg_id;
    END IF;
    v_keep := v_keep || v_pkg_id;
  END LOOP;
  FOR v_pkg_id IN SELECT id FROM product_pricing WHERE product_id = v_id AND pricing_type = 'service_package' AND NOT (id = ANY (v_keep)) LOOP
    IF EXISTS (SELECT 1 FROM orders WHERE pricing_id = v_pkg_id) THEN
      UPDATE product_pricing SET is_available = FALSE WHERE id = v_pkg_id;
    ELSE
      DELETE FROM product_pricing WHERE id = v_pkg_id;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('product_id', v_id, 'slug', v_slug, 'status', (SELECT status FROM products WHERE id = v_id));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.save_commission_listing(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_commission_listing(UUID, JSONB) TO authenticated, service_role;

-- ===========================================================================
-- 4. Self-test for the listing save (rolled back)
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.listing_save_selftest_body(p_seller UUID, p_other UUID) RETURNS TEXT
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_out TEXT := ''; v_r JSONB; v_id UUID; v_n INTEGER; v_qid UUID; v_st TEXT; v_pid UUID;
BEGIN
  PERFORM set_config('pinkquill.selftest', 'on', TRUE);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);

  -- (a) a draft with no packages; missing category refused
  BEGIN
    PERFORM save_commission_listing(NULL, '{"title": "x"}'::jsonb); v_out := v_out || 'a.nocat=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || 'a.nocat=refused';
  END;
  v_r := save_commission_listing(NULL, jsonb_build_object('title', 'Selftest portrait', 'category', 'illustration', 'status', 'draft',
    'intake_fields', '[{"label": "Describe the subject", "field_type": "long_text", "required": true}]'::jsonb, 'keywords', '["Portrait", "portrait ", "ink"]'::jsonb,
    'settings', '{"availability": "open", "lead_time_days": 2, "turnaround_starts": "payment"}'::jsonb));
  v_id := (v_r->>'product_id')::UUID;
  SELECT status::text INTO v_st FROM products WHERE id = v_id;
  SELECT count(*) INTO v_n FROM product_keywords WHERE product_id = v_id;
  v_out := v_out || ' draft=' || v_st || ' keywords=' || v_n || ' lead=' || (SELECT lead_time_days FROM commission_listings WHERE product_id = v_id);
  SELECT id INTO v_qid FROM listing_intake_fields WHERE product_id = v_id;

  -- (b) publishing without a package or description is refused
  BEGIN
    PERFORM save_commission_listing(v_id, jsonb_build_object('title', 'Selftest portrait', 'category', 'illustration', 'status', 'active', 'description', 'Ink portraits')); v_out := v_out || ' | b.nopkg=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' | b.nopkg=refused';
  END;

  -- (c) publish with two packages, the question edited in place (same id), one media row
  v_r := save_commission_listing(v_id, jsonb_build_object('title', 'Selftest portrait', 'category', 'illustration', 'status', 'active', 'description', 'Ink portraits',
    'intake_fields', jsonb_build_array(jsonb_build_object('id', v_qid, 'label', 'Describe the subject in detail', 'field_type', 'long_text', 'required', true), '{"label": "Reference links", "field_type": "url"}'::jsonb),
    'packages', '[{"tier": "basic", "name": "Sketch", "price": 20, "delivery_days": 3, "revisions": 1, "features": ["Line art"]}, {"tier": "standard", "name": "Colour", "price": 45, "delivery_days": 7, "revisions": 2}]'::jsonb,
    'media', '[{"url": "https://example.com/a.png", "media_type": "image", "is_primary": false}]'::jsonb,
    'settings', '{"availability": "waitlist", "slots_total": 2, "lead_time_days": 0, "turnaround_starts": "payment", "terms": "No refunds after sketch approval."}'::jsonb));
  SELECT status::text INTO v_st FROM products WHERE id = v_id;
  SELECT count(*) INTO v_n FROM product_pricing WHERE product_id = v_id AND pricing_type = 'service_package';
  v_out := v_out || ' | c.published=' || v_st || ' packages=' || v_n
    || ' q_kept=' || EXISTS (SELECT 1 FROM listing_intake_fields WHERE id = v_qid AND label = 'Describe the subject in detail')
    || ' questions=' || (SELECT count(*) FROM listing_intake_fields WHERE product_id = v_id)
    || ' primary=' || (SELECT count(*) FROM product_media WHERE product_id = v_id AND is_primary)
    || ' slots=' || (SELECT slots_total FROM commission_listings WHERE product_id = v_id);

  -- (d) dropping a package: deleted when unused, disabled when an order references it
  SELECT id INTO v_pid FROM product_pricing WHERE product_id = v_id AND variant_name = 'Sketch';
  INSERT INTO orders (buyer_id, seller_id, product_id, pricing_id, listing_type, amount, platform_fee, seller_amount, currency, status, payment_status, order_number)
  VALUES (p_other, p_seller, v_id, v_pid, 'service', 20, 1, 19, 'usd', 'pending_payment', 'pending', 'PQ-SELFTEST-4B');
  v_r := save_commission_listing(v_id, jsonb_build_object('title', 'Selftest portrait', 'category', 'illustration', 'description', 'Ink portraits',
    'packages', jsonb_build_array(jsonb_build_object('pricing_id', (SELECT id FROM product_pricing WHERE product_id = v_id AND variant_name = 'Colour'), 'tier', 'standard', 'name', 'Colour', 'price', 50, 'delivery_days', 7, 'revisions', 2))));
  v_out := v_out || ' | d.sketch=' || (SELECT CASE WHEN NOT is_available THEN 'disabled' ELSE 'kept' END FROM product_pricing WHERE id = v_pid)
    || ' colour=' || (SELECT price FROM product_pricing WHERE product_id = v_id AND variant_name = 'Colour');

  -- (e) someone else cannot edit it
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_other, 'role', 'authenticated')::TEXT, TRUE);
  BEGIN
    PERFORM save_commission_listing(v_id, jsonb_build_object('title', 'Hijack', 'category', 'illustration')); v_out := v_out || ' | e.other=allowed';
  EXCEPTION WHEN OTHERS THEN v_out := v_out || ' | e.other=refused';
  END;

  -- (f) customers aggregate sees the pending order for this seller
  PERFORM set_config('request.jwt.claims', json_build_object('sub', p_seller, 'role', 'authenticated')::TEXT, TRUE);
  v_r := get_seller_customers(p_seller);
  v_out := v_out || ' | f.customers>=1=' || (jsonb_array_length(v_r->'customers') >= 1) || ' stats=' || (v_r->'stats' ? 'repeat_customers');
  RETURN v_out;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.listing_save_selftest_body(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.run_listing_save_selftest() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_seller UUID; v_other UUID; v_out TEXT; v_msg TEXT; v_before BIGINT := (SELECT count(*) FROM products);
BEGIN
  SELECT seller_id INTO v_seller FROM products WHERE listing_type = 'service' AND status = 'active' ORDER BY created_at LIMIT 1;
  IF v_seller IS NULL THEN SELECT id INTO v_seller FROM profiles ORDER BY created_at LIMIT 1; END IF;
  SELECT id INTO v_other FROM profiles WHERE id <> v_seller ORDER BY created_at LIMIT 1;
  BEGIN
    v_out := listing_save_selftest_body(v_seller, v_other);
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'SELFTEST_ROLLBACK ' || v_out;
  EXCEPTION WHEN OTHERS THEN
    v_msg := SQLERRM;
  END;
  IF v_msg LIKE 'SELFTEST_ROLLBACK %' THEN
    RETURN jsonb_build_object('ok', true, 'rolled_back', (SELECT count(*) FROM products) = v_before, 'result', substr(v_msg, 19));
  END IF;
  RETURN jsonb_build_object('ok', false, 'rolled_back', (SELECT count(*) FROM products) = v_before, 'error', v_msg);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_listing_save_selftest() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_listing_save_selftest() TO service_role;
