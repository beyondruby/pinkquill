// Feed view registry — single source of truth for which feed layouts exist.
// Mirrors lib/theme/registry.ts. Add a new view by: (1) adding an entry here,
// (2) handling its `id` in components/feed/Feed.tsx renderer switch.

export interface FeedViewMeta {
  id: string;
  label: string;
  description: string;
}

export const FEED_VIEWS = {
  classic: {
    id: "classic",
    label: "Classic",
    description: "Single-column reading feed — full posts, generous spacing.",
  },
  compact: {
    id: "compact",
    label: "Compact",
    description: "Dense single column — small thumbnails, scan-friendly.",
  },
  grid: {
    id: "grid",
    label: "Grid",
    description: "Tile catalogue — visual browsing across rows.",
  },
  magazine: {
    id: "magazine",
    label: "Magazine",
    description: "Two-column masonry — mixed-height discovery layout.",
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
