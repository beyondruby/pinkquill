-- Phase 4c (part 2) — drop `transactions` (2026-09-03, approved as a money-path edit)
-- Five money-path RPCs still wrote compatibility rows into the legacy
-- `transactions` table: record_payment_succeeded, record_payment_refund,
-- mark_payout_sent, record_chargeback, finalize_order_payment. The ledger
-- (ledger_entries) and payments/payouts/refunds are the books since Phase 1c;
-- nothing reads `transactions` any more (the seller earnings screen stopped in 3e).
--
-- Rather than retyping five long bodies, this migration re-creates each
-- function from its CURRENT definition with only the `INSERT INTO transactions`
-- and `UPDATE transactions` statements removed. One condition in
-- record_payment_refund relied on FOUND from the removed UPDATE; it becomes an
-- explicit check on the payout row (same outcome: the payout is cancelled when
-- it exists and has not been sent). The block refuses to run if any reference
-- to the table would remain. Idempotent: a second run finds nothing to change.
DO $$
DECLARE r RECORD; v_def TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('record_payment_succeeded', 'record_payment_refund', 'mark_payout_sent', 'record_chargeback', 'finalize_order_payment')
      AND p.prosrc ~* '(INSERT INTO|UPDATE)[[:space:]]+transactions'
  LOOP
    v_def := pg_get_functiondef(r.oid);
    v_def := regexp_replace(v_def, E'\\n[[:space:]]*INSERT INTO transactions[^;]*;', '', 'gi');
    v_def := regexp_replace(v_def, E'\\n[[:space:]]*UPDATE transactions[^;]*;', '', 'gi');
    v_def := replace(v_def, 'IF FOUND AND v_payout.status IN', 'IF v_payout.id IS NOT NULL AND v_payout.status IN');
    IF v_def ~* '(INSERT INTO|UPDATE|FROM|JOIN)[[:space:]]+(public\.)?transactions([^_a-z]|$)' THEN
      RAISE EXCEPTION 'transactions is still referenced in %', r.proname;
    END IF;
    EXECUTE v_def;
    RAISE NOTICE 'rewrote %', r.proname;
  END LOOP;
END $$;

DO $$
DECLARE v_left TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ') INTO v_left
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosrc ~* '(INSERT INTO|UPDATE|FROM|JOIN)[[:space:]]+(public\.)?transactions([^_a-z]|$)';
  IF v_left IS NOT NULL THEN RAISE EXCEPTION 'functions still use transactions: %', v_left; END IF;
END $$;

DROP TABLE IF EXISTS public.transactions CASCADE;
