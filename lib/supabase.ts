import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: supabaseUrl ? "set" : "missing",
    key: supabaseAnonKey ? "set" : "missing",
  });
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    // Add timeout to all fetch requests to prevent hanging
    fetch: (url, options: RequestInit = {}) => {
      // If request already has a signal, don't override it
      if (options.signal) {
        return fetch(url, options);
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      return fetch(url, {
        ...options,
        signal: controller.signal,
      }).finally(() => clearTimeout(timeoutId));
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
    // Disconnect when tab is hidden to prevent connection leaks
    timeout: 30000, // 30s timeout for realtime connections
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
