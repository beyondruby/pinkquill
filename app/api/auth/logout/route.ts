import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/lib/api-security";
import { createSupabaseServerClient } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * POST /api/auth/logout
 *
 * Clears the @supabase/ssr cookie session. The client SDK clears its
 * localStorage session separately via supabase.auth.signOut() — both
 * sides need to happen for a complete logout, since the proxy
 * middleware gates protected routes on the presence of the auth cookie.
 *
 * Idempotent: returns 200 even if no session exists.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const supabase = await createSupabaseServerClient();

    // signOut tears down the server-side session and instructs the
    // cookie callback to expire all sb-* cookies for this project.
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Non-fatal — the user may already be signed out, or the
      // refresh token may have been invalidated. Log and proceed.
      console.warn("[Auth Logout]", error.message);
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
