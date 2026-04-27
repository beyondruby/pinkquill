import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { enforceSameOrigin } from "@/lib/api-security";
import { createSupabaseServerClient } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Clears the user's session in the most reliable way available:
 *
 *  1. Calls supabase.auth.signOut() via the @supabase/ssr server client,
 *     which invalidates the refresh token server-side and emits proper
 *     Set-Cookie expiration headers via our cookies adapter.
 *  2. Defence-in-depth: walks every cookie on the request and explicitly
 *     expires anything that looks like a Supabase session cookie. This
 *     catches edge cases where Supabase's signOut might miss a cookie
 *     (different cookie names across SDK versions, Path mismatches, etc.).
 *
 * Idempotent — returning 200 even when no session exists.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    // Step 1 — invalidate the session via Supabase. The cookies adapter
    // attached by createSupabaseServerClient writes Max-Age=0 cookies for
    // every session cookie, with the same Path/Domain Supabase set them
    // with (this is the part the browser SDK can't reliably do).
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.warn("[Auth Logout] signOut warning:", error.message);
    }

    // Step 2 — belt-and-suspenders: expire every sb-* cookie ourselves.
    // Set-Cookie response headers are additive in Next.js Route Handlers,
    // so layering ours on top of Supabase's is harmless.
    const cookieStore = await cookies();
    const isProd = process.env.NODE_ENV === "production";
    for (const cookie of cookieStore.getAll()) {
      if (!cookie.name.startsWith("sb-")) continue;
      cookieStore.set(cookie.name, "", {
        maxAge: 0,
        path: "/",
        sameSite: "lax",
        httpOnly: false,
        secure: isProd,
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth Logout]", error);
    return NextResponse.json(
      { error: "Logout failed. Please try again." },
      { status: 500 }
    );
  }
}
