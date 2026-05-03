import Feed from "@/components/feed/Feed";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FeedErrorFallback } from "@/components/ui/ErrorFallbacks";

// Public — guests can browse the feed. Interactions (comment, react,
// save, relay, post, follow, message) are individually gated and trigger
// the auth modal at the point of action. Reddit-style read-anywhere,
// log-in-to-act behavior.
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
