// Cookie used to persist the theme preference for anonymous users and to
// SSR-stamp <html data-theme> for authenticated users (mirrors profile).
// Readable by client JS (no httpOnly) so ThemeProvider can update it on
// setTheme without a round-trip.

export const THEME_COOKIE = 'pq_theme';
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
