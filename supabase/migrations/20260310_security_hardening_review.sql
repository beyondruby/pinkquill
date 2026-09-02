-- NOTE (2026-09-02, docs/commissions/03-progress.md Phase 1a): this file was NEVER
-- APPLIED TO PRODUCTION and is superseded. The live schema is reconciled by
-- 20260902_commissions_phase1a_reconcile_schema.sql; any change still wanted from
-- here must be re-issued as a new migration. Do not apply this file.

-- ==========================================================================
-- Security hardening fixes from code review (March 2026)
-- ==========================================================================

-- 1. Fix overly permissive notification INSERT policy
--    Previous policy allowed any authenticated user to create notifications
--    targeting any user. Restrict to actor_id = auth.uid().
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON notifications;
CREATE POLICY "Authenticated users can create notifications" ON notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND actor_id = auth.uid());

-- 2. Add missing SELECT policies on product tables
--    product_keywords and product_shipping have RLS enabled but no SELECT policy,
--    making them completely unreadable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_keywords' AND policyname = 'Anyone can view product keywords'
  ) THEN
    CREATE POLICY "Anyone can view product keywords" ON product_keywords
      FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'product_shipping' AND policyname = 'Anyone can view product shipping'
  ) THEN
    CREATE POLICY "Anyone can view product shipping" ON product_shipping
      FOR SELECT USING (true);
  END IF;
END $$;

-- 3. Add missing DELETE policy on sounds table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'sounds' AND policyname = 'Creators can delete their sounds'
  ) THEN
    CREATE POLICY "Creators can delete their sounds" ON sounds
      FOR DELETE USING (auth.uid() = created_by);
  END IF;
END $$;

-- 4. Add promo code discount_value upper bound constraint
--    Prevents misconfigured codes with >100% percentage discount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'promo_codes_percentage_max_check'
  ) THEN
    ALTER TABLE promo_codes
      ADD CONSTRAINT promo_codes_percentage_max_check
      CHECK (discount_type = 'fixed' OR discount_value <= 100);
  END IF;
END $$;
