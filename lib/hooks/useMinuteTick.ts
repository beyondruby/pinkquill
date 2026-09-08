"use client";

import { useEffect, useState } from "react";

// One interval for every card: "3 minutes ago" refreshes once a minute
// instead of freezing at whatever it said when the card mounted (F-35b).
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function subscribe(fn: () => void) {
  listeners.add(fn);
  if (!timer) timer = setInterval(() => listeners.forEach((l) => l()), 60_000);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** Returns a counter that increments every minute while any subscriber is mounted. */
export function useMinuteTick(): number {
  const [tick, setTick] = useState(0);
  useEffect(() => subscribe(() => setTick((t) => t + 1)), []);
  return tick;
}
