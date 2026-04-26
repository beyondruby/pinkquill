import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { getAuthUser } from "@/lib/auth-server";

export const runtime = "nodejs";

/**
 * Build a transient, non-persistent anon client used purely to verify a
 * password. We deliberately avoid the admin/service-role client here:
 * the operation is a user-level auth action and using the admin client
 * obscures intent without changing Supabase's auth-side accounting.
 *
 * Note: Supabase records every signInWithPassword call in its auth audit
 * log and applies user-level rate limits; this is unavoidable as long
 * as we use signInWithPassword for verification. Acceptable trade-off
 * — the current password is needed to authorise the change.
 */
function createTransientAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase env vars missing for transient auth client");
  }
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

interface VerifyPasswordPayload {
  password?: string;
}

/**
 * POST /api/auth/verify-password
 *
 * Verifies the current user's password server-side without creating a new
 * session. Used by the password-change flow in settings so the client
 * doesn't call signInWithPassword() (which would create a duplicate session).
 *
 * Requires a valid session (Authorization header or cookie).
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await checkRateLimit({
      request,
      scope: "auth.verify-password.ip",
      limit: 10,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 300);
    }

    // Authenticate the caller
    const user = await getAuthUser(request);
    if (!user?.email) {
      return NextResponse.json(
        { error: "Not authenticated." },
        { status: 401 }
      );
    }

    const parsed = await safeJsonParse<VerifyPasswordPayload>(request);
    if ("error" in parsed) return parsed.error;

    const password = String(parsed.data.password || "");
    if (!password) {
      return NextResponse.json(
        { error: "Password is required." },
        { status: 400 }
      );
    }

    // Use a transient, non-persistent anon client to attempt a sign-in.
    // The session is discarded immediately — we only care whether the
    // password matches. This does NOT touch the caller's existing
    // session (cookies or localStorage).
    const transient = createTransientAuthClient();
    const { error } = await transient.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    // Best-effort session cleanup. The client is non-persistent so this
    // is purely defensive in case Supabase ever changes the default.
    await transient.auth.signOut().catch(() => {});

    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("[Auth Verify Password]", error);
    return NextResponse.json(
      { error: "Unable to verify password right now." },
      { status: 500 }
    );
  }
}
