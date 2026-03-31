import { NextResponse } from "next/server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

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

    // Use the admin client to attempt a sign-in on the server side.
    // This validates the password without touching the client's session.
    const { error } = await supabaseAdmin.auth.signInWithPassword({
      email: user.email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    // Sign-in succeeded — password is correct.
    // We don't need the server-side session token; just confirm success.
    return NextResponse.json({ verified: true });
  } catch (error) {
    console.error("[Auth Verify Password]", error);
    return NextResponse.json(
      { error: "Unable to verify password right now." },
      { status: 500 }
    );
  }
}
