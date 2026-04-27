import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  PASSWORD_MAX_LENGTH,
  validatePasswordStrength,
} from "@/lib/auth/constants";

export const runtime = "nodejs";

interface ChangePasswordPayload {
  password?: string;
  /** Required unless the caller is in a recovery flow — see route comment. */
  currentPassword?: string;
}

/**
 * Build a transient, non-persistent anon client used purely to verify the
 * current password. Same pattern as /api/auth/verify-password — we don't
 * want to disturb the caller's existing session.
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

/**
 * POST /api/auth/change-password
 *
 * Updates the authenticated user's password. We do this server-side via the
 * admin API so the operation does NOT depend on the browser SDK having a
 * usable session in localStorage — calling supabase.auth.updateUser() from
 * the client throws "Auth session missing!" whenever the in-memory session
 * is out of sync with the server cookie session (a real-world failure mode,
 * particularly after an OAuth/recovery callback).
 *
 * Auth: Bearer token OR sb-* cookies (whichever the caller has). If the
 * caller supplies `currentPassword`, we verify it via a transient anon
 * client before allowing the update. Recovery flows omit `currentPassword`
 * — they're already authenticated through the magic link.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await checkRateLimit({
      request,
      scope: "auth.change-password.ip",
      limit: 10,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 600);

    const user = await getAuthUser(request);
    if (!user?.id || !user.email) {
      // Diagnostic logging to disambiguate "Not authenticated" failures.
      // Strip after we confirm the cause and ship the proper fix.
      const hasBearer = Boolean(request.headers.get("authorization"));
      const cookieHeader = request.headers.get("cookie") || "";
      const sbCookies = cookieHeader
        .split(";")
        .map((c) => c.trim().split("=")[0])
        .filter((n) => n.startsWith("sb-"));
      console.warn("[Auth Change Password] Not authenticated", {
        hasBearer,
        sbCookies,
        userPresent: Boolean(user),
        userHasId: Boolean(user?.id),
        userHasEmail: Boolean(user?.email),
      });
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const parsed = await safeJsonParse<ChangePasswordPayload>(request);
    if ("error" in parsed) return parsed.error;

    const newPassword = String(parsed.data.password || "");
    const currentPassword =
      typeof parsed.data.currentPassword === "string"
        ? parsed.data.currentPassword
        : "";

    if (newPassword.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }
    const strength = validatePasswordStrength(newPassword);
    if (!strength.valid) {
      return NextResponse.json(
        { error: strength.error ?? "Password is not strong enough." },
        { status: 400 }
      );
    }

    if (currentPassword) {
      const transient = createTransientAuthClient();
      const { error: verifyError } = await transient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyError) {
        return NextResponse.json(
          { error: "Current password is incorrect." },
          { status: 401 }
        );
      }
      await transient.auth.signOut().catch(() => {});
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error("[Auth Change Password]", updateError);
      return NextResponse.json(
        { error: "Could not update password right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth Change Password]", error);
    return NextResponse.json(
      { error: "Could not update password right now." },
      { status: 500 }
    );
  }
}
