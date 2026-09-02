// Feed view registry — single source of truth for which feed layouts exist.
// Mirrors lib/theme/registry.ts. Add a new view by: (1) adding an entry here,
// (2) handling its `id` in components/feed/Feed.tsx renderer switch.
//
// Three views, each with a distinct job (decided Sep 2026; "magazine" retired):
//   classic — READ.   Full posts, one at a time. The default.
//   compact — STREAM. Catch up fast: one row per post, grouped by day,
//                     expands in place to the full post.
//   grid    — GALLERY. Browse by eye: a masonry wall of images and
//                     typographic cards.
// IDs are persisted (cookie + profiles.feed_view_preference) so they stay
// stable even though the user-facing labels changed.

export interface FeedViewMeta {
  id: string;
  label: string;
  description: string;
}

export const FEED_VIEWS = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Full posts, one at a time. The reading feed.",
  },
  compact: {
    id: "compact",
    label: "Stream",
    description: "Catch up fast. One line per post, grouped by day, expands in place.",
  },
  grid: {
    id: "grid",
    label: "Gallery",
    description: "Browse by eye. A wall of images and typographic cards.",
  },
} as const satisfies Record<string, FeedViewMeta>;

export type FeedViewId = keyof typeof FEED_VIEWS;

export const DEFAULT_FEED_VIEW: FeedViewId = "classic";

export function isFeedViewId(value: unknown): value is FeedViewId {
  return typeof value === "string" && value in FEED_VIEWS;
}

export function getFeedViewList(): FeedViewMeta[] {
  return Object.values(FEED_VIEWS);
}
