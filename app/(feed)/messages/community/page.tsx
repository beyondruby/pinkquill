import { Suspense } from "react";
import CommunityInboxView from "@/components/messages/community/CommunityInboxView";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { MessagesErrorFallback } from "@/components/ui/ErrorFallbacks";

function CommunityInboxLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-muted">Loading community inbox...</div>
    </div>
  );
}

export default function CommunityInboxPage() {
  return (
    <ErrorBoundary
      section="Community Inbox"
      fallback={<MessagesErrorFallback />}
    >
      <Suspense fallback={<CommunityInboxLoading />}>
        <CommunityInboxView />
      </Suspense>
    </ErrorBoundary>
  );
}
