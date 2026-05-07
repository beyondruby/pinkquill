-- Add theme_preference column for user-selectable color palette feature.
-- NULL = user has never chosen (triggers cookie -> profile migration on first
-- authenticated visit). All non-NULL values are validated app-side against the
-- THEMES registry in lib/theme/registry.ts; a CHECK constraint here would
-- couple the schema to the registry, which we want to evolve without per-theme
-- migrations.

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS theme_preference TEXT;

COMMENT ON COLUMN profiles.theme_preference IS
  'User color theme preference. NULL = never chosen. Valid values: ''system'' or any theme id from lib/theme/registry.ts.';
