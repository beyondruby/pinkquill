import { Suspense } from "react";
import { Spinner } from "@/components/ui/Loading";
import RequireAuth from "@/components/auth/RequireAuth";
import CommunityInboxView from "@/components/messages/community/CommunityInboxView";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { MessagesErrorFallback } from "@/components/ui/ErrorFallbacks";

function CommunityInboxLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading community inbox">
      <Spinner size="lg" />
    </div>
  );
}

export default function CommunityInboxPage() {
  return (
    <RequireAuth loadingText="Loading community inbox">
      <ErrorBoundary
        section="Community Inbox"
        fallback={<MessagesErrorFallback />}
      >
        <Suspense fallback={<CommunityInboxLoading />}>
          <CommunityInboxView />
        </Suspense>
      </ErrorBoundary>
    </RequireAuth>
  );
}
