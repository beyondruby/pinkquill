"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to console for debugging
    console.error("[Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="text-center max-w-md">
        <h2 className="font-display text-2xl text-ink mb-4">
          Something went wrong
        </h2>
        <p className="font-body text-muted mb-6">
          We encountered an unexpected error. Please try again.
        </p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="font-body text-sm text-red-500 mb-6 p-3 bg-red-50 rounded-lg break-words">
            {error.message}
          </p>
        )}
        <button
          onClick={() => reset()}
          className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
