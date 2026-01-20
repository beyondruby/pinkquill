import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing Supabase environment variables:", {
    url: supabaseUrl ? "set" : "missing",
    key: supabaseAnonKey ? "set" : "missing",
  });
}

// Use createBrowserClient from @supabase/ssr for proper cookie-based auth in Next.js
// This ensures sessions are properly synced between server and client
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
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
});
