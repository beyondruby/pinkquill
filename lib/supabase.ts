import { createClient } from "@supabase/supabase-js";
import { recordRequestMetric } from "./utils/requestMetrics";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase environment variables: ${!supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : ""}`.trim()
  );
}

// Timeout configuration (in milliseconds)
const TIMEOUT_DEFAULT = 25000;    // 25s for regular API calls
const TIMEOUT_AUTH = 10000;       // 10s for auth requests (token refresh, getUser, etc.)
const TIMEOUT_UPLOAD = 300000;    // 5 minutes for file uploads
const SUPABASE_400_LOG_THROTTLE_MS = 60000;
const recentBadRequestLogs = new Map<string, number>();

function createTimeoutAbortError(timeoutMs: number): Error {
  const message = `Request timed out after ${timeoutMs / 1000}s`;
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "AbortError");
  }
  const error = new Error(message);
  error.name = "AbortError";
  return error;
}

function getRequestMethod(options?: RequestInit): string {
  return (options?.method || "GET").toUpperCase();
}

function formatRequestPath(url: RequestInfo | URL): string {
  try {
    const raw = typeof url === "string"
      ? url
      : url instanceof URL
      ? url.toString()
      : url.url;
    const parsed = new URL(raw, "http://localhost");
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url.toString();
  }
}

function maybeLogBadRequest(url: RequestInfo | URL, options: RequestInit | undefined, status: number) {
  if (status !== 400 || typeof window === "undefined") return;

  const key = `${getRequestMethod(options)} ${formatRequestPath(url)}`;
  const now = Date.now();
  const lastLoggedAt = recentBadRequestLogs.get(key) ?? 0;
  if (now - lastLoggedAt < SUPABASE_400_LOG_THROTTLE_MS) return;

  recentBadRequestLogs.set(key, now);
  console.warn(`[supabase][400] ${key}`);
}

// Check if a request is to the auth API (token refresh, getUser, etc.)
function isAuthRequest(url: RequestInfo | URL): boolean {
  const urlString = url.toString();
  return urlString.includes('/auth/v1/');
}

// Check if a request is a file upload based on URL and content type
function isUploadRequest(url: RequestInfo | URL, options?: RequestInit): boolean {
  const urlString = url.toString();
  // Storage upload endpoints
  if (urlString.includes('/storage/v1/object')) return true;
  // Check content type for multipart/form-data (file uploads)
  const contentType = options?.headers instanceof Headers
    ? options.headers.get('content-type')
    : (options?.headers as Record<string, string>)?.['content-type'] ||
      (options?.headers as Record<string, string>)?.['Content-Type'];
  if (contentType?.includes('multipart/form-data')) return true;
  return false;
}

// Lazy reference for 401 retry logic — populated after createClient returns.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: any = null;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    // Add timeout to data fetch requests to prevent hanging
    fetch: async (url, options: RequestInit = {}) => {
      // If request already has a signal, don't override it
      if (options.signal) {
        return fetch(url, options);
      }

      // Auth requests get a generous but bounded timeout (10s).
      // Previously these had NO timeout — a hanging token refresh would
      // block all subsequent data queries indefinitely.
      if (isAuthRequest(url)) {
        const authController = new AbortController();
        const authTimeoutId = setTimeout(() => authController.abort(), TIMEOUT_AUTH);
        try {
          const response = await fetch(url, { ...options, signal: authController.signal });
          clearTimeout(authTimeoutId);
          return response;
        } catch (error) {
          clearTimeout(authTimeoutId);
          throw error;
        }
      }

      // Use longer timeout for uploads
      const timeout = isUploadRequest(url, options) ? TIMEOUT_UPLOAD : TIMEOUT_DEFAULT;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const startedAt = Date.now();

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        recordRequestMetric({
          url,
          options,
          status: response.status,
          durationMs: Date.now() - startedAt,
        });
        maybeLogBadRequest(url, options, response.status);

        // 401 retry: if the JWT was expired, refresh the session and retry once.
        // The Supabase client sets the Authorization header before calling fetch,
        // so we need to replace it with the refreshed token.
        if (response.status === 401 && _client && typeof window !== 'undefined') {
          const retryHeader = options.headers instanceof Headers
            ? options.headers.get('x-sb-retry')
            : null;
          if (!retryHeader) {
            try {
              const { data } = await _client.auth.refreshSession();
              if (data?.session?.access_token) {
                const retryHeaders = new Headers(options.headers);
                retryHeaders.set('Authorization', `Bearer ${data.session.access_token}`);
                retryHeaders.set('x-sb-retry', '1');
                const retryController = new AbortController();
                const retryTimeout = setTimeout(() => retryController.abort(), timeout);
                try {
                  const retryResponse = await fetch(url, {
                    ...options,
                    headers: retryHeaders,
                    signal: retryController.signal,
                  });
                  clearTimeout(retryTimeout);
                  return retryResponse;
                } catch {
                  clearTimeout(retryTimeout);
                }
              }
            } catch {
              // Refresh failed — return original 401
            }
          }
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        recordRequestMetric({
          url,
          options,
          durationMs: Date.now() - startedAt,
          errorName: error instanceof Error ? error.name : String(error),
        });
        // Preserve AbortError semantics so hooks can correctly handle cancellations/timeouts.
        if (error instanceof Error && error.name === 'AbortError') {
          throw createTimeoutAbortError(timeout);
        }
        throw error;
      }
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Timeout for realtime connection attempts
    timeout: 30000,
  },
  db: {
    schema: 'public',
  },
});

// Set lazy reference for 401 retry logic
_client = supabase;

// Clean up all realtime channels when page is unloaded
// This prevents connection leaks during hot reload and navigation
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    supabase.removeAllChannels();
  });

  // NOTE: We intentionally do NOT clean up channels on visibilitychange.
  // Removing channels when the tab is hidden is too aggressive because:
  // 1. Components don't know channels were removed externally
  // 2. When user returns to tab, realtime subscriptions are broken
  // 3. useEffect cleanup/re-run doesn't trigger since deps haven't changed
  // The stable channel naming pattern (no Date.now()) already prevents leaks.
}
