-- Add feed_view_preference column for user-selectable feed layout feature.
-- NULL = user has never chosen (triggers cookie -> profile migration on first
-- authenticated visit). All non-NULL values are validated app-side against the
-- FEED_VIEWS registry in lib/feed-view/registry.ts; a CHECK constraint here
-- would couple the schema to the registry, which we want to evolve without
-- per-view migrations.
--
-- Mirrors the theme_preference pattern (see 20260507_profiles_theme_preference.sql).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS feed_view_preference TEXT;

COMMENT ON COLUMN profiles.feed_view_preference IS
  'User feed layout preference. NULL = never chosen. Valid values are validated app-side against lib/feed-view/registry.ts (e.g. ''classic'', ''compact'', ''grid'', ''magazine'').';
