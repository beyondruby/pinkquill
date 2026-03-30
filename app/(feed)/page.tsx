import Feed from "@/components/feed/Feed";
import RequireAuth from "@/components/auth/RequireAuth";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FeedErrorFallback } from "@/components/ui/ErrorFallbacks";

export default function Home() {
  return (
    <RequireAuth loadingText="Loading your feed">
      <ErrorBoundary
        section="HomeFeed"
        fallback={<FeedErrorFallback />}
      >
        <Feed />
      </ErrorBoundary>
    </RequireAuth>
  );
}
