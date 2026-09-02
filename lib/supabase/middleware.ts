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

  // Real cancellation, not a race: the signal is threaded into every fetch
  // the auth client makes, so a hung GoTrue call is torn down at the
  // deadline instead of holding a socket for undici's ~300s default.
  const AUTH_TIMEOUT_MS = 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), AUTH_TIMEOUT_MS);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: controller.signal }),
      },
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
  // A timed-out or failed check is treated as "no user" for THIS request:
  // pages that need auth already redirect to /login when user is null, and
  // the client-side AuthProvider re-validates from cookies. On timeout we
  // also return the untouched response so a half-finished refresh can never
  // hand the browser a mismatched cookie set.
  let user: User | null = null;
  let timedOut = false;
  try {
    const { data } = await supabase.auth.getUser();
    user = data.user;
  } catch (err) {
    if (controller.signal.aborted) {
      timedOut = true;
      console.warn(
        `[middleware] auth.getUser() exceeded ${AUTH_TIMEOUT_MS}ms for ${request.nextUrl.pathname}; treating as anonymous`
      );
    } else {
      console.warn("[middleware] auth.getUser() threw:", err);
    }
  } finally {
    clearTimeout(timer);
  }

  if (timedOut) {
    return { response: NextResponse.next({ request }), user: null };
  }

  return { response: supabaseResponse, user };
}
