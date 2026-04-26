-- Lightweight auth.users lookup for the signup endpoint so we can
-- distinguish "unconfirmed existing user" from "fully confirmed user"
-- without exposing the auth schema to PostgREST. service_role only.
CREATE OR REPLACE FUNCTION public.auth_user_status_by_email(p_email TEXT)
RETURNS TABLE (
  id UUID,
  email_confirmed BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    (u.email_confirmed_at IS NOT NULL) AS email_confirmed
  FROM auth.users u
  WHERE lower(u.email) = lower(p_email)
  LIMIT 1;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.auth_user_status_by_email(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auth_user_status_by_email(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION public.auth_user_status_by_email(TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_status_by_email(TEXT) TO service_role;
