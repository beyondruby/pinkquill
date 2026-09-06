"use client";

import RequireAuth from "@/components/auth/RequireAuth";
import SavedLibrary from "@/components/saved/SavedLibrary";

export default function SavedPage() {
  return (
    <RequireAuth loadingText="Loading your saved things">
      <SavedLibrary />
    </RequireAuth>
  );
}
