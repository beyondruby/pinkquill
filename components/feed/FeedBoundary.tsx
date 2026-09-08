"use client";

import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FeedErrorFallback } from "@/components/ui/ErrorFallbacks";
import Feed from "@/components/feed/Feed";
import type { FeedViewId } from "@/lib/feed-view/registry";

// Client wrapper so the boundary's `reset` can reach the fallback's button
// (a server component cannot pass a function down; finding F-13).
export default function FeedBoundary({ initialViewId }: { initialViewId?: FeedViewId }) {
  return (
    <ErrorBoundary
      section="HomeFeed"
      fallback={({ reset }) => <FeedErrorFallback onRetry={reset} />}
    >
      <Feed initialViewId={initialViewId} />
    </ErrorBoundary>
  );
}
