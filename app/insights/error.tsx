"use client";

import { useEffect } from "react";

export default function InsightsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Insights Error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <h2 className="font-display text-xl text-ink mb-3">
        Something went wrong
      </h2>
      <p className="font-body text-muted text-sm mb-6">
        We couldn&apos;t load your insights. Please try again.
      </p>
      {process.env.NODE_ENV === "development" && error.message && (
        <p className="font-body text-xs text-red-500 mb-4 p-2 bg-red-50 rounded break-words max-w-md">
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
