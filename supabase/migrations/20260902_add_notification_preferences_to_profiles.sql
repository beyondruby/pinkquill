-- Backs the new /settings/notifications preferences page. Stores per-category
-- mute flags as JSONB (category key -> false means muted); an absent key or
-- empty object means "on" (default), matching the app's existing all-on
-- notification behavior for every current user.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS notification_preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
