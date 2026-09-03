"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "../supabase";

/**
 * Admin console plumbing (Phase 2f). Reads and writes go through
 * /api/admin/* with the session's bearer token; the routes hold the
 * service-role client and verify platform_admins.
 */

export async function adminFetch<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) };
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  let body = init?.body;
  if (init?.json !== undefined) { headers["Content-Type"] = "application/json"; body = JSON.stringify(init.json); }
  const response = await fetch(path, { ...init, headers, body, method: init?.method ?? (init?.json !== undefined ? "POST" : "GET") });
  let json: { error?: string } & Record<string, unknown> = {};
  try { json = await response.json(); } catch { /* non-JSON error page */ }
  if (!response.ok) return { ok: false, error: json.error || `Request failed (${response.status})`, status: response.status };
  return { ok: true, data: json as T };
}

export function useIsPlatformAdmin(userId?: string) {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const { data } = await supabase.rpc("is_platform_admin", { p_user_id: userId });
      if (!cancelled) setIsAdmin(Boolean(data));
    }, 0);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [userId]);
  return isAdmin;
}

/** GET a JSON endpoint with a refetch handle; `deps` re-run it. */
export function useAdminQuery<T>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));

  const refetch = useCallback(async () => {
    if (!path) { setLoading(false); return; }
    setLoading(true);
    const r = await adminFetch<T>(path);
    if (r.ok) { setData(r.data); setError(null); } else { setError(r.error); }
    setLoading(false);
  }, [path]);

  useEffect(() => {
    const timer = setTimeout(() => { void refetch(); }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refetch, ...deps]);

  return { data, error, loading, refetch };
}
