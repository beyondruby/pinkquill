import type { FeedViewId } from "./registry";

/** Per-view column container, shared by the feed, its skeleton and the route's loading state (F-22). */
export const FEED_CONTAINER_CLASS: Record<FeedViewId, string> = {
  classic: "home-feed-modern w-full max-w-[580px] mx-auto pt-6 pb-6 px-4 md:pt-8 md:pb-12 md:px-6",
  compact: "w-full max-w-[780px] mx-auto pt-6 pb-6 px-3 md:pt-8 md:pb-10 md:px-6",
  grid: "w-full max-w-[1240px] mx-auto pt-5 pb-6 px-3 md:pt-8 md:pb-10 md:px-5",
};
