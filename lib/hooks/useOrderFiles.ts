"use client";

import { useEffect, useMemo, useState } from "react";

/**
 * Resolves order delivery-file references (storage paths, or legacy public URLs)
 * into short-lived signed URLs via /api/orders/files. The order-files bucket is
 * private, so raw references are not directly loadable — every render of a
 * delivery asset or message attachment must resolve through here.
 *
 * Returns a map of original-ref -> signed URL. Unresolved refs are simply absent.
 */
export function useOrderFileUrls(
  orderId: string | undefined,
  refs: (string | null | undefined)[]
): Record<string, string> {
  const cleaned = useMemo(
    () => Array.from(new Set(refs.filter((r): r is string => !!r))),
    [refs]
  );
  const key = cleaned.join("|");
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!orderId || !key) return;
    let cancelled = false;
    const paths = key.split("|");
    fetch("/api/orders/files", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, paths }),
    })
      .then((r) => (r.ok ? r.json() : { urls: {} }))
      .then((d) => {
        if (!cancelled) setUrls((d?.urls as Record<string, string>) || {});
      })
      .catch(() => {
        if (!cancelled) setUrls({});
      });
    return () => {
      cancelled = true;
    };
  }, [orderId, key]);

  return urls;
}
