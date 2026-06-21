"use client";

import { useEffect, useRef } from "react";

/**
 * Calls `callback` when the tab regains focus or becomes visible, throttled so
 * rapid focus/blur cycles don't spam. This is the project's standard replacement
 * for `postgres_changes` subscriptions on non-critical freshness (the realtime
 * strategy is one per-user broadcast channel + poll-on-focus for everything else).
 */
export function usePollOnFocus(callback: () => void, throttleMs = 10_000): void {
  const cbRef = useRef(callback);
  useEffect(() => {
    cbRef.current = callback;
  }, [callback]);

  const lastRunRef = useRef(0);

  useEffect(() => {
    const run = () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRunRef.current < throttleMs) return;
      lastRunRef.current = now;
      cbRef.current();
    };
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", run);
    };
  }, [throttleMs]);
}
