-- Two related fixes to notify_order_status_change:
-- 1. Digital products skip the `paid` state (pending_payment -> delivered);
--    the seller never got an order_paid notification. Fire it explicitly.
-- 2. The fallback `COALESCE(auth.uid(), NEW.buyer_id)` for the actor breaks
--    buyer-targeted notifications when the trigger runs under service_role
--    (auth.uid() = null), because the actor then equals the buyer recipient
--    and create_order_notification self-suppresses. Compute the actor
--    relative to the target so the suppression only fires for genuine
--    self-action cases.

CREATE OR REPLACE FUNCTION public.notify_order_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_notification_type TEXT;
  v_target_user_id UUID;
  v_actor UUID;
  v_auth UUID := auth.uid();
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  CASE NEW.status
    WHEN 'pending_acceptance' THEN
      v_notification_type := 'order_pending_acceptance';
      v_target_user_id := NEW.seller_id;
    WHEN 'pending_payment' THEN
      IF OLD.status = 'pending_acceptance' THEN
        v_notification_type := 'order_accepted';
        v_target_user_id := NEW.buyer_id;
      ELSE
        RETURN NEW;
      END IF;
    WHEN 'declined' THEN
      v_notification_type := 'order_declined';
      v_target_user_id := NEW.buyer_id;
    WHEN 'paid' THEN
      v_notification_type := 'order_paid';
      v_target_user_id := NEW.seller_id;
    WHEN 'in_progress' THEN
      v_notification_type := 'order_started';
      v_target_user_id := NEW.buyer_id;
    WHEN 'submitted' THEN
      v_notification_type := 'order_delivered';
      v_target_user_id := NEW.buyer_id;
    WHEN 'revision_requested' THEN
      v_notification_type := 'revision_requested';
      v_target_user_id := NEW.seller_id;
    WHEN 'completed' THEN
      v_notification_type := 'order_completed';
      v_target_user_id := NEW.seller_id;
    WHEN 'shipped' THEN
      v_notification_type := 'order_delivered';
      v_target_user_id := NEW.buyer_id;
    WHEN 'delivered' THEN
      -- Digital instant delivery: pending_payment -> delivered skips `paid`,
      -- so the seller never got their sale notification. Fire it explicitly.
      IF OLD.status = 'pending_payment' THEN
        PERFORM create_order_notification(
          NEW.seller_id,
          COALESCE(v_auth, NEW.buyer_id),
          'order_paid',
          NEW.id
        );
      END IF;
      v_notification_type := 'order_delivered';
      v_target_user_id := NEW.buyer_id;
    WHEN 'cancelled' THEN
      IF NEW.cancelled_by = NEW.buyer_id THEN
        v_target_user_id := NEW.seller_id;
      ELSE
        v_target_user_id := NEW.buyer_id;
      END IF;
      v_notification_type := 'order_cancelled';
    WHEN 'refund_requested' THEN
      v_notification_type := 'refund_requested';
      v_target_user_id := NEW.seller_id;
    WHEN 'refunded' THEN
      v_notification_type := 'order_refunded';
      v_target_user_id := NEW.buyer_id;
    WHEN 'disputed' THEN
      v_notification_type := 'order_disputed';
      v_target_user_id := CASE
        WHEN v_auth = NEW.buyer_id THEN NEW.seller_id
        ELSE NEW.buyer_id
      END;
    WHEN 'resolved' THEN
      v_notification_type := 'dispute_resolved';
      v_target_user_id := CASE
        WHEN v_auth = NEW.buyer_id THEN NEW.seller_id
        ELSE NEW.buyer_id
      END;
    ELSE
      RETURN NEW;
  END CASE;

  -- Pick the actor relative to the target so service_role-driven transitions
  -- (where auth.uid() is null) don't accidentally self-suppress the
  -- recipient's notification.
  v_actor := COALESCE(
    v_auth,
    CASE
      WHEN v_target_user_id = NEW.seller_id THEN NEW.buyer_id
      ELSE NEW.seller_id
    END
  );

  PERFORM create_order_notification(
    v_target_user_id,
    v_actor,
    v_notification_type,
    NEW.id
  );

  RETURN NEW;
END;
$function$;
