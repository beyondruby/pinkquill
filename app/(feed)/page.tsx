import Feed from "@/components/feed/Feed";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FeedErrorFallback } from "@/components/ui/ErrorFallbacks";

export default function Home() {
  return (
    <ErrorBoundary
      section="HomeFeed"
      fallback={<FeedErrorFallback />}
    >
      <Feed />
    </ErrorBoundary>
  );
}