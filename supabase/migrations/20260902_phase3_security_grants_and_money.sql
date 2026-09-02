-- Phase 3 (docs/audit/02-plan.md): security grants + money correctness.
--
-- 1. SECURITY DEFINER functions: server-only ones locked to service_role;
--    user-action RPCs no longer executable by `anon`; RLS helper predicates keep
--    PUBLIC (they are called from policies as the invoking role).
--    Root cause (findings S1, June C1): CREATE FUNCTION grants EXECUTE to PUBLIC.
-- 2. auth.uid() guards on the p_user_id-parameterised chat RPCs and on
--    ensure_community_chat_thread.
-- 3. search_path pinned on the 25 functions the advisor flags as mutable.
-- 4. Platform-fee base unified: fee is 5% of the goods/service amount, never
--    of shipping (matches create_marketplace_order); apply_promo_to_order
--    recomputed on the same base. Payout uses the stored seller_amount (code).
-- 5. DM attachment buckets made private with participant-scoped reads; size
--    limits on the six unlimited buckets.
--
-- Idempotent.

-- ---------------------------------------------------------------------------
-- 1a. Server-only / unused: service_role only
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.enforce_api_rate_limit(text, text, integer, integer)',
    'public.create_order_notification(uuid, uuid, text, uuid, text)',
    'public.auto_complete_orders()',
    'public.auto_decline_expired_orders()',
    'public.reveal_expired_reviews()',
    'public.get_user_conversation_ids(uuid)',
    'public.get_total_reactions(uuid)',
    'public.is_following(uuid, uuid)',
    'public.is_blocked_either_way(uuid, uuid)',
    'public.increment_sound_use(uuid)',
    'public.increment_take_view(uuid)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 1b. User-action RPCs: authenticated + service_role, never anon/PUBLIC
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.accept_community_invitation(uuid)',
    'public.accept_order(uuid)',
    'public.add_order_tracking(uuid, text, text)',
    'public.apply_promo_to_order(uuid, uuid)',
    'public.approve_join_request(uuid)',
    'public.community_chat_broadcast(uuid, text, text)',
    'public.confirm_order_delivery(uuid)',
    'public.consume_download_token(text)',
    'public.create_post_with_relations(text, text, text, text, text, uuid, uuid, jsonb, text, jsonb, jsonb, jsonb, uuid[])',
    'public.decline_community_invitation(uuid)',
    'public.decline_order(uuid, text)',
    'public.ensure_community_chat_thread(uuid, uuid)',
    'public.generate_order_download_tokens(uuid)',
    'public.get_audience_breakdown(uuid, date, date, integer)',
    'public.get_community_chat_overview(uuid)',
    'public.get_community_chat_unread_count(uuid)',
    'public.get_seller_earnings(uuid)',
    'public.invite_to_community(uuid, uuid)',
    'public.moderate_delete_comment(uuid, uuid, text)',
    'public.moderate_delete_post(uuid, uuid, text)',
    'public.open_dispute(uuid, text, text)',
    'public.reject_join_request(uuid)',
    'public.remove_promo_from_order(uuid)',
    'public.request_refund(uuid, text)',
    'public.request_to_join_community(uuid, text)',
    'public.respond_to_review(uuid, text)',
    'public.set_community_chat_join_state(uuid, boolean)',
    'public.submit_order_review(uuid, integer, text, text, text[], boolean)',
    'public.submit_review(uuid, integer, integer, integer, integer, text, boolean)',
    'public.update_order_as_buyer(uuid, text, text)',
    'public.update_order_as_seller(uuid, text, text, text, jsonb)',
    'public.update_purchase_as_buyer(uuid, text)',
    'public.update_purchase_as_seller(uuid, text, text, text, jsonb)',
    'public.validate_promo_code(text, numeric, text)'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2. auth.uid() guards
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_community_chat_unread_count(p_user_id uuid)
 RETURNS integer
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH accessible_communities AS (
    SELECT DISTINCT cm.community_id, cm.role
    FROM community_members cm
    JOIN communities c ON c.id = cm.community_id
    WHERE cm.user_id = p_user_id
      AND p_user_id = (SELECT auth.uid())          -- caller may only read their own count
      AND c.community_chat_enabled = TRUE
      AND (
        (cm.role = 'member' AND cm.status IN ('active', 'muted', 'banned'))
        OR (cm.role IN ('admin', 'moderator') AND cm.status = 'active')
      )
  ),
  accessible_threads AS (
    SELECT t.id
    FROM community_chat_threads t
    JOIN accessible_communities ac ON ac.community_id = t.community_id
    WHERE (ac.role = 'member' AND t.member_id = p_user_id)
       OR ac.role IN ('admin', 'moderator')
  ),
  reads AS (
    SELECT thread_id, last_read_at
    FROM community_chat_thread_reads
    WHERE user_id = p_user_id
  ),
  unread_source AS (
    SELECT
      CASE
        WHEN m.message_type = 'announcement' AND NULLIF(m.metadata->>'broadcast_id', '') IS NOT NULL
          THEN 'announcement:' || (m.metadata->>'broadcast_id')
        ELSE m.id::TEXT
      END AS dedupe_key
    FROM accessible_threads at
    JOIN community_chat_messages m ON m.thread_id = at.id
    LEFT JOIN reads r ON r.thread_id = at.id
    WHERE m.sender_id IS DISTINCT FROM p_user_id
      AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
  )
  SELECT COALESCE(COUNT(DISTINCT dedupe_key), 0)::INTEGER
  FROM unread_source;
$function$;

CREATE OR REPLACE FUNCTION public.get_community_chat_overview(p_user_id uuid)
 RETURNS TABLE(community_id uuid, unread_count integer, last_message_at timestamp with time zone, last_message_preview text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH accessible_communities AS (
    SELECT DISTINCT cm.community_id, cm.role
    FROM community_members cm
    JOIN communities c ON c.id = cm.community_id
    WHERE cm.user_id = p_user_id
      AND p_user_id = (SELECT auth.uid())          -- caller may only read their own overview
      AND c.community_chat_enabled = TRUE
      AND (
        (cm.role = 'member' AND cm.status IN ('active', 'muted', 'banned'))
        OR (cm.role IN ('admin', 'moderator') AND cm.status = 'active')
      )
  ),
  accessible_threads AS (
    SELECT t.id, t.community_id
    FROM community_chat_threads t
    JOIN accessible_communities ac ON ac.community_id = t.community_id
    WHERE (ac.role = 'member' AND t.member_id = p_user_id)
       OR ac.role IN ('admin', 'moderator')
  ),
  reads AS (
    SELECT thread_id, last_read_at
    FROM community_chat_thread_reads
    WHERE user_id = p_user_id
  ),
  unread_source AS (
    SELECT
      at.community_id,
      CASE
        WHEN m.message_type = 'announcement' AND NULLIF(m.metadata->>'broadcast_id', '') IS NOT NULL
          THEN 'announcement:' || (m.metadata->>'broadcast_id')
        ELSE m.id::TEXT
      END AS dedupe_key
    FROM accessible_threads at
    JOIN community_chat_messages m ON m.thread_id = at.id
    LEFT JOIN reads r ON r.thread_id = at.id
    WHERE m.sender_id IS DISTINCT FROM p_user_id
      AND m.created_at > COALESCE(r.last_read_at, 'epoch'::timestamptz)
  ),
  unread_by_community AS (
    SELECT community_id, COUNT(DISTINCT dedupe_key)::INTEGER AS unread_count
    FROM unread_source
    GROUP BY community_id
  ),
  last_activity AS (
    SELECT t.community_id, MAX(t.last_message_at) AS last_message_at
    FROM community_chat_threads t
    JOIN accessible_threads at ON at.id = t.id
    GROUP BY t.community_id
  ),
  latest_preview AS (
    SELECT DISTINCT ON (at.community_id)
      at.community_id,
      m.content AS last_message_preview
    FROM accessible_threads at
    JOIN community_chat_messages m ON m.thread_id = at.id
    ORDER BY at.community_id, m.created_at DESC
  )
  SELECT
    ac.community_id,
    COALESCE(ubc.unread_count, 0) AS unread_count,
    la.last_message_at,
    lp.last_message_preview
  FROM accessible_communities ac
  LEFT JOIN unread_by_community ubc ON ubc.community_id = ac.community_id
  LEFT JOIN last_activity la ON la.community_id = ac.community_id
  LEFT JOIN latest_preview lp ON lp.community_id = ac.community_id;
$function$;

CREATE OR REPLACE FUNCTION public.ensure_community_chat_thread(p_community_id uuid, p_member_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_thread_id UUID;
  v_chat_enabled BOOLEAN;
BEGIN
  -- A member may open their own thread; staff may open a thread for a member.
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_member_id <> auth.uid() AND NOT is_community_staff(p_community_id, auth.uid()) THEN
    RAISE EXCEPTION 'Not authorized to open this thread';
  END IF;

  SELECT community_chat_enabled INTO v_chat_enabled FROM communities WHERE id = p_community_id;
  IF v_chat_enabled IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'Community chat is disabled';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM community_members
    WHERE community_id = p_community_id
      AND user_id = p_member_id
      AND role = 'member'
      AND status IN ('active', 'muted', 'banned')
  ) THEN
    RAISE EXCEPTION 'No eligible member record found for community chat thread';
  END IF;

  INSERT INTO community_chat_threads (community_id, member_id)
  VALUES (p_community_id, p_member_id)
  ON CONFLICT (community_id, member_id) DO NOTHING;

  SELECT id INTO v_thread_id
  FROM community_chat_threads
  WHERE community_id = p_community_id AND member_id = p_member_id;

  RETURN v_thread_id;
END;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Pin search_path on the functions the advisor flags as mutable
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.create_order_notification(uuid, uuid, text, uuid, text)',
    'public.get_user_conversation_ids(uuid)',
    'public.moderate_delete_comment(uuid, uuid, text)',
    'public.moderate_delete_post(uuid, uuid, text)',
    'public.notify_order_message()',
    'public.notify_review_submitted()',
    'public.calculate_hot_score(integer, integer, integer, timestamp with time zone)',
    'public.check_community_permission(uuid, uuid, text)',
    'public.generate_order_number()',
    'public.generate_product_slug(text, uuid)',
    'public.get_popular_tags(integer)',
    'public.get_reaction_counts(uuid)',
    'public.get_takes_feed(uuid, integer, integer, uuid, uuid, uuid, uuid)',
    'public.get_time_range_start(text)',
    'public.get_trending_tags(integer, integer)',
    'public.get_trending_tags(integer)',
    'public.increment_sound_use_count()',
    'public.set_product_published_at()',
    'public.update_order_reviews_updated_at()',
    'public.update_order_updated_at()',
    'public.update_product_updated_at()',
    'public.update_promo_code_updated_at()',
    'public.update_purchase_status_timestamp()',
    'public.update_seller_profile_updated_at()',
    'public.update_trending_sounds()'
  ]
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 4. Fee base: 5% of the discounted goods/service amount, shipping excluded
--    (same base as create_marketplace_order). Payout = stored seller_amount.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.apply_promo_to_order(p_order_id uuid, p_promo_code_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_order orders%ROWTYPE;
  v_promo promo_codes%ROWTYPE;
  v_validation JSONB;
  v_discount NUMERIC(10,2);
  v_final NUMERIC(10,2);
  v_amount NUMERIC(10,2);
  v_fee_base NUMERIC(10,2);
  v_platform_fee NUMERIC(10,2);
  v_seller_amount NUMERIC(10,2);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Order not found');
  END IF;
  IF v_order.buyer_id <> auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF v_order.status NOT IN ('pending_acceptance', 'pending_payment') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code can only be applied before payment');
  END IF;

  SELECT * INTO v_promo FROM promo_codes WHERE id = p_promo_code_id AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Promo code not found');
  END IF;

  v_amount := COALESCE(v_order.original_amount, v_order.amount);

  v_validation := validate_promo_code(v_promo.code, v_amount, v_order.listing_type);
  IF (v_validation->>'valid')::BOOLEAN IS DISTINCT FROM TRUE THEN
    RETURN jsonb_build_object('success', false, 'error', COALESCE(v_validation->>'error', 'Promo code is not valid'));
  END IF;

  v_discount := COALESCE((v_validation->>'discount_amount')::NUMERIC, 0);
  v_final := COALESCE((v_validation->>'final_amount')::NUMERIC, v_amount);

  -- Fee on the discounted goods/service amount only; shipping is passed
  -- through to the seller in full (same rule as create_marketplace_order).
  v_fee_base := GREATEST(v_final - COALESCE(v_order.shipping_cost, 0), 0);
  v_platform_fee := ROUND((v_fee_base * 0.05)::NUMERIC, 2);
  v_seller_amount := ROUND((v_final - v_platform_fee)::NUMERIC, 2);

  UPDATE orders
  SET original_amount = v_amount,
      discount_amount = v_discount,
      amount = v_final,
      platform_fee = v_platform_fee,
      seller_amount = v_seller_amount,
      promo_code_id = v_promo.id,
      updated_at = NOW()
  WHERE id = p_order_id;

  UPDATE promo_code_redemptions
  SET promo_code_id = v_promo.id, user_id = auth.uid(), discount_amount = v_discount, created_at = NOW()
  WHERE order_id = p_order_id;
  IF NOT FOUND THEN
    INSERT INTO promo_code_redemptions (promo_code_id, order_id, user_id, discount_amount)
    VALUES (v_promo.id, p_order_id, auth.uid(), v_discount);
  END IF;

  RETURN jsonb_build_object('success', true, 'discount_amount', v_discount, 'final_amount', v_final, 'original_amount', v_amount);
END;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Storage: DM attachments private + participant-scoped; size limits
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id IN ('message-media', 'voice-notes');

UPDATE storage.buckets SET file_size_limit = 5242880   WHERE id = 'avatars'       AND file_size_limit IS NULL; -- 5 MB
UPDATE storage.buckets SET file_size_limit = 10485760  WHERE id = 'covers'        AND file_size_limit IS NULL; -- 10 MB
UPDATE storage.buckets SET file_size_limit = 104857600 WHERE id = 'post-media'    AND file_size_limit IS NULL; -- 100 MB
UPDATE storage.buckets SET file_size_limit = 52428800  WHERE id = 'post-audio'    AND file_size_limit IS NULL; -- 50 MB
UPDATE storage.buckets SET file_size_limit = 26214400  WHERE id = 'voice-notes'   AND file_size_limit IS NULL; -- 25 MB
UPDATE storage.buckets SET file_size_limit = 52428800  WHERE id = 'message-media' AND file_size_limit IS NULL; -- 50 MB

DROP POLICY IF EXISTS "Anyone can view message media" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view voice notes" ON storage.objects;
DROP POLICY IF EXISTS "Participants can read message media" ON storage.objects;
DROP POLICY IF EXISTS "Participants can read voice notes" ON storage.objects;

-- Object paths are <sender_id>/<conversation_id>/<file>; only participants of
-- that conversation may read (or sign) the object.
CREATE POLICY "Participants can read message media" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-media'
    AND public.user_is_conversation_participant(((storage.foldername(name))[2])::uuid)
  );

CREATE POLICY "Participants can read voice notes" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'voice-notes'
    AND public.user_is_conversation_participant(((storage.foldername(name))[2])::uuid)
  );

DROP POLICY IF EXISTS "Users can upload message media" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload voice notes" ON storage.objects;
CREATE POLICY "Users can upload message media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-media'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND public.user_is_conversation_participant(((storage.foldername(name))[2])::uuid)
  );
CREATE POLICY "Users can upload voice notes" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'voice-notes'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
    AND public.user_is_conversation_participant(((storage.foldername(name))[2])::uuid)
  );

-- ---------------------------------------------------------------------------
-- 6. Trigger functions: not callable via RPC. Verified in a rolled-back
--    transaction that revoking EXECUTE from `authenticated` does not stop the
--    trigger from firing on that role's DML (privilege is checked at CREATE
--    TRIGGER time, not at fire time).
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.add_creator_as_admin()',
    'public.auto_complete_digital_order()',
    'public.ensure_digital_download_tokens_trigger()',
    'public.handle_community_member_chat_sync()',
    'public.log_community_member_change()',
    'public.log_follower_change()',
    'public.notify_dm_unread_change()',
    'public.notify_follow_change()',
    'public.notify_notification_change()',
    'public.notify_order_created()',
    'public.notify_order_message()',
    'public.notify_order_status_change()',
    'public.notify_review_submitted()',
    'public.on_product_pricing_change()',
    'public.restore_order_stock_on_early_exit()',
    'public.set_auto_completion_deadline()',
    'public.set_community_chat_sender_role()',
    'public.touch_community_chat_thread()'
  ]
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f);
  END LOOP;
END $$;
