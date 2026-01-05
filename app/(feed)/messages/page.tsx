import { Suspense } from "react";
import MessagesView from "@/components/messages/MessagesView";

function MessagesLoading() {
  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-pulse text-muted">Loading messages...</div>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <Suspense fallback={<MessagesLoading />}>
      <MessagesView />
    </Suspense>
  );
}
