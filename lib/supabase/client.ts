"use client";

import { createBrowserClient } from "@supabase/ssr";

let supabaseInstance: ReturnType<typeof createBrowserClient> | null = null;

/**
 * Creates a Supabase client for use in the browser (Client Components).
 * Uses @supabase/ssr for proper cookie-based session management with Next.js App Router.
 *
 * This is a singleton - the same client instance is reused across the app.
 */
export function createClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  supabaseInstance = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
      global: {
        fetch: (url, options) => {
          // Add retry logic for fetch failures
          return fetchWithRetry(url, options);
        },
      },
    }
  );

  return supabaseInstance;
}

/**
 * Fetch with automatic retry for transient failures
 */
async function fetchWithRetry(
  url: RequestInfo | URL,
  options?: RequestInit,
  retries = 2
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // Don't retry on abort
      if (lastError.name === "AbortError") {
        throw lastError;
      }

      // Wait before retry (exponential backoff)
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

// Export a getter for the singleton instance
export const supabase = createClient();
