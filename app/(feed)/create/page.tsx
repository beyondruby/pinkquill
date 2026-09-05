import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import CreatePost from "@/components/create/CreatePost";
import { PageFrame } from "@/components/layout/PageFrame";
import { Spinner } from "@/components/ui/Loading";

function CreatePostLoading() {
  return (
    <PageFrame width="reading">
      <div className="pq-feed-state" role="status" aria-live="polite">
        <Spinner size="lg" />
        <p className="pq-feed-state__text">Opening the composer…</p>
      </div>
    </PageFrame>
  );
}

export default function CreatePage() {
  return (
    <RequireAuth loadingText="Loading composer">
      <Suspense fallback={<CreatePostLoading />}>
        <CreatePost />
      </Suspense>
    </RequireAuth>
  );
}
