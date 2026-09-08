import PostSkeleton from "./PostSkeleton";
import { FEED_CONTAINER_CLASS } from "@/lib/feed-view/layout";
import type { FeedViewId } from "@/lib/feed-view/registry";

/** Loading placeholders for one feed view. `withFrame` wraps them in the view's column (the route's loading.tsx). */
export function FeedSkeletonItems({ viewId }: { viewId: FeedViewId }) {
  if (viewId === "classic") return <>{[0, 1, 2].map((i) => <PostSkeleton key={i} />)}</>;
  if (viewId === "compact") return <>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-32 rounded-2xl bg-skeleton animate-pulse" />)}</>;
  const spans = [
    "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2",
    "col-span-2 row-span-2 sm:col-span-3 lg:col-span-3 lg:row-span-3",
    "col-span-2 row-span-1 sm:col-span-2 lg:col-span-3 lg:row-span-1",
    "col-span-2 row-span-2 sm:col-span-4 lg:col-span-5 lg:row-span-2",
  ];
  return <>{[0, 1, 2, 3, 4, 5, 6, 7].map((i) => <div key={i} className={`${spans[i % 4]} rounded-2xl bg-skeleton animate-pulse`} />)}</>;
}

export default function FeedSkeleton({ viewId }: { viewId: FeedViewId }) {
  return (
    <div className={FEED_CONTAINER_CLASS[viewId]}>
      <FeedSkeletonItems viewId={viewId} />
    </div>
  );
}
