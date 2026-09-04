-- Site-wide email (2026-09-04)
-- 1. Every notification (not just orders) is handed to /api/notifications/email;
--    the route decides per person and category whether it becomes an email.
-- 2. Direct-message digests: a 10-minute cron finds unread messages that have
--    waited at least 5 minutes and asks the app to send one email per
--    (recipient, conversation, sender), at most once an hour.
-- Idempotent. No money-path change.

-- ===========================================================================
-- 1. queue_notification_email: all types except ops_alert
-- ===========================================================================
CREATE OR REPLACE FUNCTION public.queue_notification_email() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE v_base_url TEXT; v_secret TEXT; v_request_id BIGINT;
BEGIN
  IF NEW.type = 'ops_alert' THEN RETURN NEW; END IF;
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

-- Fast path for the route's "did we already email about this?" checks.
CREATE INDEX IF NOT EXISTS notifications_user_emailed_at_idx
  ON public.notifications (user_id, emailed_at DESC) WHERE emailed_at IS NOT NULL;

-- ===========================================================================
-- 2. Direct-message digests
-- ===========================================================================
ALTER TABLE public.conversation_participants ADD COLUMN IF NOT EXISTS last_emailed_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.queue_dm_digest_emails() RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions', 'net'
AS $$
DECLARE
  v_base_url TEXT; v_secret TEXT; v_request_id BIGINT; v_row RECORD; v_count INTEGER := 0;
BEGIN
  IF current_setting('pinkquill.selftest', TRUE) = 'on' THEN RETURN 0; END IF;
  SELECT value #>> '{}' INTO v_base_url FROM platform_settings WHERE key = 'app_base_url';
  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
  IF v_base_url IS NULL OR v_secret IS NULL THEN RETURN 0; END IF;

  FOR v_row IN
    SELECT cp.user_id, cp.conversation_id, m.sender_id
    FROM conversation_participants cp
    JOIN messages m
      ON m.conversation_id = cp.conversation_id
     AND m.sender_id <> cp.user_id
     AND m.is_read = FALSE
    WHERE m.created_at > COALESCE(cp.last_emailed_at, '-infinity'::timestamptz)
      AND m.created_at > COALESCE(cp.joined_at, '-infinity'::timestamptz)
      AND (cp.last_emailed_at IS NULL OR cp.last_emailed_at < NOW() - INTERVAL '60 minutes')
    GROUP BY cp.user_id, cp.conversation_id, m.sender_id
    HAVING MIN(m.created_at) < NOW() - INTERVAL '5 minutes'
    LIMIT 200
  LOOP
    -- Stamp first: even if the request fails we never nag more than hourly.
    UPDATE conversation_participants SET last_emailed_at = NOW()
     WHERE user_id = v_row.user_id AND conversation_id = v_row.conversation_id;
    BEGIN
      SELECT net.http_post(
        url := v_base_url || '/api/notifications/email',
        headers := jsonb_build_object('Authorization', 'Bearer ' || v_secret, 'Content-Type', 'application/json'),
        body := jsonb_build_object('kind', 'dm_digest', 'user_id', v_row.user_id, 'conversation_id', v_row.conversation_id, 'sender_id', v_row.sender_id),
        timeout_milliseconds := 15000
      ) INTO v_request_id;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_dm_digest_emails() FROM PUBLIC, anon, authenticated;

CREATE INDEX IF NOT EXISTS messages_unread_by_conversation_idx
  ON public.messages (conversation_id, sender_id, created_at) WHERE is_read = FALSE;

-- run_cron_job: identical to the live body plus the dm_digest branch.
CREATE OR REPLACE FUNCTION public.run_cron_job(p_job text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
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
    ELSIF p_job = 'dm_digest' THEN
      v_result := jsonb_build_object('digests_queued', queue_dm_digest_emails());
    ELSE
      RAISE EXCEPTION 'Unknown cron job %', p_job;
    END IF;
    UPDATE cron_runs SET finished_at = NOW(), ok = TRUE, result = v_result WHERE id = v_run_id;
  EXCEPTION WHEN OTHERS THEN
    UPDATE cron_runs SET finished_at = NOW(), ok = FALSE, error = SQLERRM WHERE id = v_run_id;
  END;
  RETURN v_result;
END;
$function$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'dm-digest') THEN
    PERFORM cron.schedule('dm-digest', '*/10 * * * *', $cron$SELECT public.run_cron_job('dm_digest')$cron$);
  END IF;
END $$;
