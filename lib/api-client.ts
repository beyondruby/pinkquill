"use client";

import { buildAuthenticatedHeaders } from "@/lib/auth-client";
import { safeResponseJson } from "@/lib/utils/fetch";

/**
 * The one way client code calls our own API routes (Phase 4a).
 * Adds the session bearer, sends JSON, parses JSON safely (HTML error pages
 * become a readable message) and never throws: callers branch on `ok`.
 */

export type ApiResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export async function apiFetch<T = Record<string, unknown>>(
  path: string,
  init: { method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE"; json?: unknown; headers?: HeadersInit; signal?: AbortSignal } = {},
): Promise<ApiResult<T>> {
  const headers = await buildAuthenticatedHeaders(init.headers);
  const hasJson = init.json !== undefined;
  if (hasJson) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? (hasJson ? "POST" : "GET"),
      headers,
      body: hasJson ? JSON.stringify(init.json) : undefined,
      signal: init.signal,
    });
  } catch (err) {
    return { ok: false, error: err instanceof Error && err.name === "AbortError" ? "Cancelled" : "Connection failed", status: 0 };
  }
  let data: T & { error?: string };
  try {
    data = await safeResponseJson<T & { error?: string }>(response);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : `Request failed (${response.status})`, status: response.status };
  }
  if (!response.ok) return { ok: false, error: (data && typeof data.error === "string" && data.error) || `Request failed (${response.status})`, status: response.status };
  return { ok: true, data, status: response.status };
}
