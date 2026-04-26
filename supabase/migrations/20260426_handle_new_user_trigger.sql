-- ============================================================================
-- handle_new_user trigger
-- ----------------------------------------------------------------------------
-- Creates a `profiles` row automatically when a new auth.users row is
-- inserted. Eliminates the race between auth user creation and the first
-- client INSERT, and removes the need for the client to have INSERT
-- permission on `profiles` for the signup flow.
--
-- Existing AuthProvider.createProfile fallback remains in place for
-- defensive recovery (orphaned auth users from before this trigger).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_username TEXT;
  v_display_name TEXT;
  v_email TEXT;
  v_attempts INTEGER := 0;
  v_max_attempts INTEGER := 5;
  v_inserted BOOLEAN := FALSE;
BEGIN
  -- Pull metadata that the signup endpoint set.
  v_username := lower(regexp_replace(
    coalesce(NEW.raw_user_meta_data ->> 'username', split_part(NEW.email, '@', 1)),
    '[^a-z0-9_]', '', 'g'
  ));
  v_display_name := coalesce(
    NULLIF(NEW.raw_user_meta_data ->> 'display_name', ''),
    v_username
  );
  v_email := lower(NEW.email);

  -- Fallback if the cleaned username is empty.
  IF v_username IS NULL OR length(v_username) = 0 THEN
    v_username := 'user_' || substr(NEW.id::text, 1, 8);
  END IF;

  -- Try to insert with collision-resolved username. Failures don't block
  -- the auth user creation — AuthProvider has a recovery path.
  WHILE v_attempts < v_max_attempts AND NOT v_inserted LOOP
    BEGIN
      INSERT INTO public.profiles (id, username, display_name, email, avatar_url)
      VALUES (
        NEW.id,
        CASE
          WHEN v_attempts = 0 THEN v_username
          ELSE v_username || '_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6)
        END,
        v_display_name,
        v_email,
        '/defaultprofile.png'
      );
      v_inserted := TRUE;
    EXCEPTION
      WHEN unique_violation THEN
        -- Could be username or pkey collision. If pkey, the profile
        -- already exists — exit successfully.
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
          v_inserted := TRUE;
        ELSE
          v_attempts := v_attempts + 1;
        END IF;
      WHEN OTHERS THEN
        -- Don't fail auth user insertion because of profile bookkeeping.
        RAISE WARNING 'handle_new_user: failed to insert profile for %: % %',
          NEW.id, SQLERRM, SQLSTATE;
        EXIT;
    END;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Replace any prior trigger definition.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- The function runs as the function owner (SECURITY DEFINER); only
-- the trigger needs to invoke it. Lock down direct execution.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
