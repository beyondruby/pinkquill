import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import CreatePost from "@/components/create/CreatePost";

function CreatePostLoading() {
  return (
    <div className="max-w-[680px] mx-auto py-10 px-6 text-center">
      <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
      <p className="font-body text-muted italic">Loading...</p>
    </div>
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
