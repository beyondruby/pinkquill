// Cookie used to persist the feed-view preference for anonymous users and to
// SSR-stamp the initial value into FeedViewProvider for authenticated users
// (mirrors the profile column). Readable by client JS (no httpOnly) so the
// provider can update it on setView without a round-trip.

export const FEED_VIEW_COOKIE = "pq_feed_view";
export const FEED_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year
