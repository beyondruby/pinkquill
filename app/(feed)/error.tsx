"use client";

import { useEffect } from "react";

export default function FeedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Feed Error]", error);
  }, [error]);

  return (
    <div className="max-w-2xl mx-auto py-12 px-4 text-center">
      <h2 className="font-display text-xl text-ink mb-3">
        Something went wrong
      </h2>
      <p className="font-body text-muted mb-6 text-sm">
        We had trouble loading this page. Please try again.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="font-body text-xs text-red-500 mb-4 p-2 bg-red-50 rounded break-words">
          {error.message}
        </p>
      )}
      <button
        onClick={() => reset()}
        className="px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}
