import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

/**
 * Refreshes the Supabase auth token on every request and returns the
 * (possibly refreshed) user plus a response carrying the new auth cookies.
 *
 * This is the canonical @supabase/ssr pattern documented at
 * https://supabase.com/docs/guides/auth/server-side/nextjs and is the
 * thing that keeps the server-side cookie session and the browser SDK
 * in sync. Without it:
 *   - Access tokens silently expire after ~1h.
 *   - The browser SDK refreshes them in document.cookie, but the server's
 *     cookies (which are scoped strictly by Path/Domain) drift out of date.
 *   - API routes start returning 401, supabase.auth.updateUser() throws
 *     "Auth session missing!", and logout sometimes "doesn't stick".
 *
 * IMPORTANT: do not insert logic between createServerClient() and
 * supabase.auth.getUser() — Supabase warns this can cause hard-to-debug
 * spontaneous sign-outs.
 */
export async function updateSession(
  request: NextRequest
): Promise<{ response: NextResponse; user: User | null }> {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Validates and refreshes the token if needed; the cookies adapter above
  // writes any new tokens back through supabaseResponse so the browser
  // receives the refreshed session.
  //
  // Race against a 5s timeout — without this cap, a hung Supabase auth
  // call would block every Next.js request indefinitely (middleware runs
  // on every page load), which manifests as the entire site "stuck on
  // loading" with nothing in the browser network tab returning. Treating
  // a timed-out auth check as "no user" is safe: pages that need auth
  // already redirect to /login when user is null, and client-side
  // AuthProvider re-validates from cookies anyway.
  const AUTH_TIMEOUT_MS = 5000;
  const user = await Promise.race([
    supabase.auth.getUser().then(({ data }) => data.user),
    new Promise<User | null>((resolve) =>
      setTimeout(() => {
        console.warn(`[middleware] auth.getUser() exceeded ${AUTH_TIMEOUT_MS}ms; treating as anonymous`);
        resolve(null);
      }, AUTH_TIMEOUT_MS)
    ),
  ]).catch((err) => {
    console.warn("[middleware] auth.getUser() threw:", err);
    return null;
  });

  return { response: supabaseResponse, user };
}
