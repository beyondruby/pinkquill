-- Phase 0 / C1: Lock down server-only money/escrow/order/seller SECURITY DEFINER RPCs.
-- These are called exclusively via the service_role client (supabaseAdmin) or
-- internally by triggers/other definer functions, and have NO internal auth.uid()
-- check. The default PUBLIC EXECUTE grant made them callable by anon/authenticated,
-- letting anyone with the anon key mark orders paid, release escrow, mint download
-- tokens, etc. Revoke PUBLIC/anon/authenticated; service_role keeps its grant.
--
-- NOTE (convention): every service-role-only RPC authored from now on MUST end with
--   REVOKE EXECUTE ... FROM PUBLIC, anon, authenticated;  GRANT ... TO service_role;
-- because `GRANT TO service_role` alone does NOT remove Postgres' default PUBLIC grant.
DO $$
DECLARE
  fn_names text[] := ARRAY[
    'update_order_payment',
    'finalize_order_payment',
    'finalize_order_escrow_release',
    'release_order_escrow',
    'mark_order_transfer_completed',
    'mark_order_payment_failed',
    'create_order_download_tokens_internal',
    'sync_seller_account',
    'recalculate_seller_stats',
    'create_marketplace_order'
  ];
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY(fn_names)
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;
