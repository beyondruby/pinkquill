import { createClient } from "@supabase/supabase-js";

// Validate environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    `Missing Supabase environment variables: ${!supabaseUrl ? "NEXT_PUBLIC_SUPABASE_URL" : ""} ${!supabaseAnonKey ? "NEXT_PUBLIC_SUPABASE_ANON_KEY" : ""}`.trim()
  );
}

// Timeout configuration (in milliseconds)
const TIMEOUT_DEFAULT = 15000;    // 15s for regular API calls
const TIMEOUT_UPLOAD = 300000;    // 5 minutes for file uploads

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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    // Add timeout to all fetch requests to prevent hanging
    fetch: async (url, options: RequestInit = {}) => {
      // If request already has a signal, don't override it
      if (options.signal) {
        return fetch(url, options);
      }

      // Use longer timeout for uploads
      const timeout = isUploadRequest(url, options) ? TIMEOUT_UPLOAD : TIMEOUT_DEFAULT;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (error) {
        clearTimeout(timeoutId);
        // Provide clearer error message for timeouts
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timed out after ${timeout / 1000}s`);
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
