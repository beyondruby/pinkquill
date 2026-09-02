import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { getAuthUser, createSupabaseServerClient } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface ChangeEmailPayload {
  email?: string;
  currentPassword?: string;
}

/**
 * Build a transient, non-persistent anon client used purely to verify the
 * current password without disturbing the caller's existing session.
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
 * POST /api/auth/change-email
 *
 * Updates the email of the authenticated user, immediately and unconditionally.
 *
 * Implementation: same pattern as /api/auth/change-password — verify the
 * caller's current password with a transient anon client, then update via
 * the admin API. We deliberately do NOT use the cookie-bound server client
 * for the actual update: in production, cookie chunking, the Secure flag,
 * domain/path edge cases, or a transient refresh-token failure can leave
 * the SSR client unable to reconstruct the session even when the user is
 * authenticated. That used to surface as "Auth session missing!" on form
 * submit. Going through the admin API removes that whole class of failure.
 *
 * Security: knowledge of the current password is required (verified above).
 * That's the same proof we require for password change, and matches
 * Instagram's flow for sensitive-account-action re-auth.
 *
 * Trade-off: skips Supabase's "click a link in your new inbox to confirm"
 * step, so a user who mistypes their new email can lock themselves out.
 * Acceptable pre-launch — we'll add a "type new email twice" UX check
 * client-side as a typo guard, and can layer in confirm-email later if
 * needed.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await checkRateLimit({
      request,
      scope: "auth.change-email.ip",
      limit: 5,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) return rateLimitResponse(rateLimit, 600);

    const user = await getAuthUser(request);
    if (!user?.id || !user.email) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const parsed = await safeJsonParse<ChangeEmailPayload>(request);
    if ("error" in parsed) return parsed.error;

    const newEmail = String(parsed.data.email || "").trim().toLowerCase();
    const currentPassword = String(parsed.data.currentPassword || "");

    if (!newEmail || !newEmail.includes("@") || newEmail.length > 254) {
      return NextResponse.json(
        { error: "A valid email is required." },
        { status: 400 }
      );
    }
    if (newEmail === user.email.toLowerCase()) {
      return NextResponse.json(
        { error: "That's already your email address." },
        { status: 400 }
      );
    }
    if (!currentPassword) {
      return NextResponse.json(
        { error: "Current password is required." },
        { status: 400 }
      );
    }

    // Verify current password with a transient anon client so we don't
    // create a duplicate session.
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
    // scope "local" — the default "global" revoked EVERY refresh token of the
    // account, silently logging the user out of all devices within the hour
    // (findings S4).
    await transient.auth.signOut({ scope: "local" }).catch(() => {});

    // Ask GoTrue to send a confirmation link to the new address (and, with
    // secure email change enabled, to the old one). The email only changes
    // once confirmed; profiles.email follows via the on_auth_user_email_updated
    // trigger. This replaces the admin overwrite with email_confirm:true,
    // which let a typo lock the user out and let a hijacked session re-point
    // the account silently (findings S6).
    const supabase = await createSupabaseServerClient();
    const origin = new URL(request.url).origin;
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/settings/account?email_changed=true")}` }
    );

    if (updateError) {
      const lower = (updateError.message || "").toLowerCase();
      if (
        lower.includes("already") ||
        lower.includes("registered") ||
        lower.includes("exists") ||
        lower.includes("duplicate")
      ) {
        return NextResponse.json(
          { error: "That email is already in use. Please try a different address." },
          { status: 400 }
        );
      }
      console.error("[Auth Change Email] updateUser failed:", updateError);
      return NextResponse.json(
        { error: "Could not update email right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, pending_confirmation: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Auth Change Email] unexpected:", message, error);
    return NextResponse.json(
      { error: "Could not update email right now." },
      { status: 500 }
    );
  }
}
