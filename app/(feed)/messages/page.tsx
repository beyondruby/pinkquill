import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import MessagesView from "@/components/messages/MessagesView";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { MessagesErrorFallback } from "@/components/ui/ErrorFallbacks";

function MessagesLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-muted">Loading messages...</div>
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
