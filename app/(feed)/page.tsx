import { cookies } from "next/headers";
import FeedBoundary from "@/components/feed/FeedBoundary";
import { FEED_VIEW_COOKIE } from "@/lib/feed-view/cookie";
import { isFeedViewId, DEFAULT_FEED_VIEW } from "@/lib/feed-view/registry";

// Public — guests can browse the feed. Interactions (comment, react,
// save, relay, post, follow, message) are individually gated and trigger
// the auth modal at the point of action. Reddit-style read-anywhere,
// log-in-to-act behavior.
//
// The view cookie is read here so the first paint uses the chosen layout
// instead of flashing Classic first (F-23).
export default async function Home() {
  const raw = (await cookies()).get(FEED_VIEW_COOKIE)?.value;
  return <FeedBoundary initialViewId={isFeedViewId(raw) ? raw : DEFAULT_FEED_VIEW} />;
}
