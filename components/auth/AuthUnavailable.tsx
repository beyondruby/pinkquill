"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

/**
 * Shown by route guards when auth status is "unknown": we waited the full
 * init budget without learning whether there is a session. This replaces the
 * old behaviour of treating the timeout as "signed out" and bouncing the
 * user to /login (docs/audit/01-findings.md H3).
 */
export default function AuthUnavailable({
  text = "We couldn't confirm your session",
}: {
  text?: string;
}) {
  const { retryAuth } = useAuth();

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-border-light bg-surface p-6 text-center">
        <h2 className="text-lg font-semibold text-primary">{text}</h2>
        <p className="mt-2 text-sm text-secondary">
          The connection is taking longer than usual. You can try again, or sign in.
        </p>
        <div className="mt-5 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={retryAuth}
            className="rounded-full bg-[var(--color-purple-primary)] px-5 py-2 text-sm font-semibold text-white"
          >
            Try again
          </button>
          <Link
            href="/login"
            className="rounded-full border border-border-strong px-5 py-2 text-sm font-semibold text-primary"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
