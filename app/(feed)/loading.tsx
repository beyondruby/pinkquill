import { cookies } from "next/headers";
import FeedSkeleton from "@/components/feed/FeedSkeleton";
import { FEED_VIEW_COOKIE } from "@/lib/feed-view/cookie";
import { isFeedViewId, DEFAULT_FEED_VIEW } from "@/lib/feed-view/registry";

// The first skeleton already uses the view the person chose (F-23).
export default async function FeedLoading() {
  const raw = (await cookies()).get(FEED_VIEW_COOKIE)?.value;
  return <FeedSkeleton viewId={isFeedViewId(raw) ? raw : DEFAULT_FEED_VIEW} />;
}
