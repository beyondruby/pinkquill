"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Shared error boundary body for route groups. Rendered inside the group's
 * layout, so a thrown render error replaces only the page — not the whole
 * shell as the root app/error.tsx does (findings H10).
 */
export default function RouteError({
  error,
  reset,
  title = "Something went wrong",
}: {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
}) {
  useEffect(() => {
    console.error("[RouteError]", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <h2 className="font-display text-2xl text-ink mb-3">{title}</h2>
        <p className="font-body text-muted mb-6">
          This part of the page failed to load. You can try again, or go back home.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="font-body text-sm text-red-500 mb-6 p-3 bg-red-50 rounded-lg break-words">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => reset()}
            className="px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-6 py-3 rounded-full border border-border-strong font-ui text-[0.95rem] font-medium text-ink hover:bg-subtle transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </div>
  );
}
