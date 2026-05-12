import { cookies } from "next/headers";
import {
  isFeedViewId,
  DEFAULT_FEED_VIEW,
  type FeedViewId,
} from "./registry";
import { FEED_VIEW_COOKIE } from "./cookie";

// Read the feed-view cookie at request time so FeedViewProvider can hydrate
// with the correct initial value (no flash from default → user choice on
// first render). Falls back to DEFAULT_FEED_VIEW when missing/invalid.
export async function getServerFeedView(): Promise<FeedViewId> {
  const store = await cookies();
  const raw = store.get(FEED_VIEW_COOKIE)?.value;
  return isFeedViewId(raw) ? raw : DEFAULT_FEED_VIEW;
}
