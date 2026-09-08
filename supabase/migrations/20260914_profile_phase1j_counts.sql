-- Profile audit phase 1j (docs/profile/02-plan.md, finding P-9; decision 2).
-- Applied to prod 2026-09-08 via the Supabase MCP (migration name
-- profile_phase1j_counts) after the user approved decision 2.
--
-- The profile's "Posts" and "Admires" stats were derived on the client from
-- the list of posts the *viewer* could fetch: they changed per viewer, could
-- not survive pagination (the count was `array.length`), and left out
-- nothing consistently. This function returns the author's own totals the
-- way a profile header states them — every published post, and every
-- reaction those posts received — regardless of who is looking.
-- SECURITY DEFINER so the totals do not shrink to the viewer's visibility;
-- it exposes two integers, nothing about the rows themselves.

CREATE OR REPLACE FUNCTION public.get_profile_counts(p_profile_id uuid)
RETURNS TABLE (posts integer, admires integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::integer                         AS posts,
    COALESCE(SUM(p.reactions_count), 0)::integer AS admires
  FROM public.posts p
  WHERE p.author_id = p_profile_id
    AND p.status = 'published';
$$;

REVOKE ALL ON FUNCTION public.get_profile_counts(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_profile_counts(uuid) TO anon, authenticated;
