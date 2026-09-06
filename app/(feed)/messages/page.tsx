import { Suspense } from "react";
import { Spinner } from "@/components/ui/Loading";
import RequireAuth from "@/components/auth/RequireAuth";
import MessagesView from "@/components/messages/MessagesView";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { MessagesErrorFallback } from "@/components/ui/ErrorFallbacks";

function MessagesLoading() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]" role="status" aria-label="Loading messages">
      <Spinner size="lg" />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth loadingText="Loading messages">
      <ErrorBoundary
        section="Messages"
        fallback={<MessagesErrorFallback />}
      >
        <Suspense fallback={<MessagesLoading />}>
          <MessagesView />
        </Suspense>
      </ErrorBoundary>
    </RequireAuth>
  );
}
