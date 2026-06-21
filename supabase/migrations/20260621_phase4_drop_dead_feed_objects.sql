-- P4/S4: remove dead code. posts_with_stats (view) and get_trending_posts (function)
-- were built for pre-computed feed counts/ranking but are bypassed by inline queries
-- in useFeed — no code references (only a stale comment, now fixed) and no DB dependents.
DROP VIEW IF EXISTS public.posts_with_stats;
DROP FUNCTION IF EXISTS public.get_trending_posts(p_user_id uuid, p_limit integer, p_offset integer, p_max_age_hours integer);
