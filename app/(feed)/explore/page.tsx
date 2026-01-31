export const dynamic = 'force-dynamic';

import ExplorePageContent from "@/components/explore/ExplorePageContent";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { FeedErrorFallback } from "@/components/ui/ErrorFallbacks";

export default function ExplorePage() {
  return (
    <ErrorBoundary
      section="Explore"
      fallback={<FeedErrorFallback />}
    >
      <ExplorePageContent />
    </ErrorBoundary>
  );
}
