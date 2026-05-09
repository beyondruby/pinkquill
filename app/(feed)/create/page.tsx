import { Suspense } from "react";
import RequireAuth from "@/components/auth/RequireAuth";
import CreatePost from "@/components/create/CreatePost";
import Loading from "@/components/ui/Loading";

function CreatePostLoading() {
  return (
    <div className="max-w-[680px] mx-auto py-10 px-6 flex justify-center">
      <Loading text="Opening the composer" />
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
