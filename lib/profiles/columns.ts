/**
 * The columns a browser client may select from `profiles`.
 *
 * `profiles.email` and `profiles.stripe_customer_id` are not granted to the
 * anon / authenticated roles (migration 20260913_profile_phase1b_grants), and
 * PostgREST rejects `select=*` when any column is missing a grant, so every
 * client-side profile query must name its columns. Server code that needs
 * the two private columns uses the service-role client.
 *
 * Kept as one string literal (not a joined array) so supabase-js can parse
 * it into a typed row. When a column is added to `profiles`, add it to the
 * GRANTs in the migration and here.
 */
export const PROFILE_CLIENT_COLUMNS =
  "id, username, display_name, avatar_url, cover_url, bio, tagline, role, education, location, languages, website, is_verified, is_private, theme_preference, notification_preferences, email_preferences, feed_view_preference, created_at, updated_at";
