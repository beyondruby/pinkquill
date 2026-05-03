import { createBrowserClient } from "@supabase/ssr";
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

function createRequestSignal(
  callerSignal: AbortSignal | null | undefined,
  timeoutMs: number
) {
  const controller = new AbortController();
  let didTimeout = false;

  const timeoutId = setTimeout(() => {
    didTimeout = true;
    controller.abort(createTimeoutAbortError(timeoutMs));
  }, timeoutMs);

  const abortFromCaller = () => {
    controller.abort(callerSignal?.reason);
  };

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  return {
    signal: controller.signal,
    didTimeout: () => didTimeout,
    cleanup: () => {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

async function fetchWithTimeout(
  url: RequestInfo | URL,
  options: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const requestSignal = createRequestSignal(options.signal, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: requestSignal.signal,
    });
  } catch (error) {
    if (requestSignal.didTimeout()) {
      throw createTimeoutAbortError(timeoutMs);
    }
    throw error;
  } finally {
    requestSignal.cleanup();
  }
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

// Singleton refresh lock: when multiple requests get 401 simultaneously,
// only ONE refresh call is made. All others wait for the same promise.
// Without this, N concurrent 401s trigger N refreshSession() calls — each
// generating CORS preflight + POST — creating a thundering-herd that can
// produce 40+ token refresh requests in a single second and freeze the page.
let _refreshPromise: Promise<string | null> | null = null;

// Cooldown after a failed refresh. Without this, a permanently-broken
// refresh token (revoked, expired, network-partitioned) keeps producing
// 401s, which keep triggering fresh refresh attempts, which keep failing
// — a spin loop that can fire dozens of refreshSession() calls per second
// and look indistinguishable from a hang.
const REFRESH_FAILURE_COOLDOWN_MS = 30_000;
let _lastRefreshFailureAt = 0;

function deduplicatedRefresh(): Promise<string | null> {
  if (_refreshPromise) return _refreshPromise;

  // Short-circuit if a recent attempt failed; skip the network roundtrip
  // and let the caller surface the 401 to the user (or the auth provider
  // will catch SIGNED_OUT on the next retryable failure).
  if (Date.now() - _lastRefreshFailureAt < REFRESH_FAILURE_COOLDOWN_MS) {
    return Promise.resolve(null);
  }

  _refreshPromise = (async () => {
    try {
      const { data, error } = await _client.auth.refreshSession();
      if (error || !data?.session?.access_token) {
        _lastRefreshFailureAt = Date.now();
        return null;
      }
      return data.session.access_token;
    } catch {
      _lastRefreshFailureAt = Date.now();
      return null;
    } finally {
      // Clear immediately so the next batch of 401s after this refresh
      // completes will trigger a fresh call. Concurrent callers that
      // arrived while this was in-flight already hold a reference to the
      // same promise, so they still share the single refresh.
      _refreshPromise = null;
    }
  })();

  return _refreshPromise;
}

// Custom fetch with timeouts + 401 retry. Reused by the browser client.
const customFetch: typeof fetch = async (url, options: RequestInit = {}) => {
  const authRequest = isAuthRequest(url);
  const timeout = isUploadRequest(url, options) ? TIMEOUT_UPLOAD : TIMEOUT_DEFAULT;
  const requestTimeout = authRequest ? TIMEOUT_AUTH : timeout;
  const startedAt = Date.now();

  try {
    const response = await fetchWithTimeout(url, options, requestTimeout);
    recordRequestMetric({
      url,
      options,
      status: response.status,
      durationMs: Date.now() - startedAt,
    });
    maybeLogBadRequest(url, options, response.status);

    // 401 retry: if the JWT was expired, refresh the session and retry once.
    // Uses deduplicatedRefresh() so N concurrent 401s only trigger ONE
    // refreshSession() call instead of N (prevents thundering-herd).
    if (!authRequest && response.status === 401 && _client && typeof window !== 'undefined') {
      const retryHeader = options.headers instanceof Headers
        ? options.headers.get('x-sb-retry')
        : null;
      if (!retryHeader) {
        const newToken = await deduplicatedRefresh();
        if (newToken) {
          const retryHeaders = new Headers(options.headers);
          retryHeaders.set('Authorization', `Bearer ${newToken}`);
          retryHeaders.set('x-sb-retry', '1');
          try {
            const retryResponse = await fetchWithTimeout(url, {
              ...options,
              headers: retryHeaders,
            }, requestTimeout);
            recordRequestMetric({
              url,
              options: { ...options, headers: retryHeaders },
              status: retryResponse.status,
              durationMs: Date.now() - startedAt,
            });
            maybeLogBadRequest(url, { ...options, headers: retryHeaders }, retryResponse.status);
            return retryResponse;
          } catch (retryError) {
            recordRequestMetric({
              url,
              options: { ...options, headers: retryHeaders },
              durationMs: Date.now() - startedAt,
              errorName: retryError instanceof Error ? retryError.name : String(retryError),
            });
          }
        }
      }
    }

    return response;
  } catch (error) {
    recordRequestMetric({
      url,
      options,
      durationMs: Date.now() - startedAt,
      errorName: error instanceof Error ? error.name : String(error),
    });
    throw error;
  }
};

/**
 * Browser Supabase client.
 *
 * IMPORTANT: this client stores its session in **cookies**, not localStorage.
 * Both the browser SDK and the server-side `@supabase/ssr` client read and
 * write the same cookie store, so:
 *   - Token auto-refresh stays in sync with the server.
 *   - `supabase.auth.signOut()` clears cookies once → server sees logout.
 *   - `supabase.auth.updateUser()` works without "Auth session missing!" errors.
 *
 * Previously we used `createClient` with `persistSession: true` (localStorage),
 * which drifted out of sync with cookies after every silent token refresh.
 */
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: customFetch },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
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
