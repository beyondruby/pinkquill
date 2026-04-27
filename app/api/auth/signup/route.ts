import { NextResponse } from "next/server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import {
  PASSWORD_MAX_LENGTH,
  RESERVED_USERNAMES,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  USERNAME_RE,
  validatePasswordStrength,
} from "@/lib/auth/constants";

export const runtime = "nodejs";

interface SignupPayload {
  email?: string;
  password?: string;
  username?: string;
  display_name?: string;
}

/**
 * Generic, non-enumerating success response.
 * Returned for both new sign-ups and "already taken email/username" cases
 * so attackers can't probe the user database.
 */
function genericSuccessResponse(email: string) {
  return NextResponse.json({
    success: true,
    pending_email: email.toLowerCase(),
    message: "Check your email for the verification code we just sent.",
  });
}

interface AuthUserStatusRow {
  id: string;
  email_confirmed: boolean;
}

/** Look up an auth.users row by email through a SECURITY DEFINER RPC.
 *  Returns null when the email isn't registered. */
async function findUserByEmail(
  email: string
): Promise<{ id: string; email_confirmed_at: string | null } | null> {
  const { data, error } = await supabaseAdmin
    .rpc("auth_user_status_by_email", { p_email: email })
    .maybeSingle<AuthUserStatusRow>();

  if (error) {
    console.warn("[Auth Signup] auth_user_status_by_email failed:", error.message);
    return null;
  }
  if (!data) return null;
  // Translate the boolean back into the Supabase admin shape used by callers.
  return {
    id: data.id,
    email_confirmed_at: data.email_confirmed ? new Date().toISOString() : null,
  };
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await checkRateLimit({
      request,
      scope: "auth.signup.ip",
      limit: 5,
      windowSeconds: 600,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 600);
    }

    const parsed = await safeJsonParse<SignupPayload>(request);
    if ("error" in parsed) return parsed.error;

    const email = String(parsed.data.email || "").trim().toLowerCase();
    const password = String(parsed.data.password || "");
    const usernameInput = String(parsed.data.username || "").trim().replace(/^@/, "").toLowerCase();
    const displayName = String(parsed.data.display_name || "").trim();

    // Basic input validation. Errors here are user-fault (form issues) so we
    // do return a specific 400; we only mask errors that would reveal
    // the existence of a user.
    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.` },
        { status: 400 }
      );
    }
    const passwordCheck = validatePasswordStrength(password);
    if (!passwordCheck.valid) {
      return NextResponse.json(
        { error: passwordCheck.error ?? "Password is not strong enough." },
        { status: 400 }
      );
    }
    if (
      !usernameInput ||
      usernameInput.length < USERNAME_MIN_LENGTH ||
      usernameInput.length > USERNAME_MAX_LENGTH
    ) {
      return NextResponse.json(
        { error: `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.` },
        { status: 400 }
      );
    }
    if (!USERNAME_RE.test(usernameInput)) {
      return NextResponse.json(
        { error: "Username can only contain letters, numbers, and underscores." },
        { status: 400 }
      );
    }
    if (RESERVED_USERNAMES.has(usernameInput)) {
      return NextResponse.json({ error: "That username is unavailable." }, { status: 400 });
    }
    if (!displayName || displayName.length > 60) {
      return NextResponse.json({ error: "Display name must be 1–60 characters." }, { status: 400 });
    }

    // Username availability check — done server-side (the client check was
    // only an availability hint).
    const { data: existingByUsername } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", usernameInput)
      .maybeSingle();

    if (existingByUsername) {
      // We DO leak username availability — usernames are public anyway
      // (visible on profiles), so there's nothing to hide here.
      return NextResponse.json({ error: "That username is taken." }, { status: 409 });
    }

    // Create the auth user via admin API (no email confirmation auto-sent
    // by admin.createUser; we rely on the OTP flow below).
    //
    // We DO NOT distinguish "fresh signup" from "email already taken" in
    // the response — both return the same generic success so attackers
    // can't enumerate emails. The behaviour DOES differ in what email we
    // actually send:
    //   - new email           → OTP delivered
    //   - existing unconfirmed → OTP re-delivered (so the user can finish
    //                            an interrupted signup)
    //   - existing confirmed   → no email sent (the owner already has an
    //                            account; sending an OTP would be useless
    //                            and potentially harassing)
    const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        username: usernameInput,
        display_name: displayName,
      },
    });

    if (createError) {
      const msg = createError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Look up the existing user. If they never confirmed their email,
        // resending the signup OTP is the right behaviour — they're
        // probably the same person trying again. If they ARE confirmed,
        // we silently no-op and return the generic message; the UI's
        // "Already a member? Sign in" link points them to the right
        // place without leaking whether the account exists.
        const existing = await findUserByEmail(email);
        if (existing && !existing.email_confirmed_at) {
          await supabaseAdmin.auth.resend({ type: "signup", email }).catch((err: unknown) => {
            console.warn(
              "[Auth Signup] resend for unconfirmed existing user failed:",
              err instanceof Error ? err.message : String(err)
            );
          });
        }
        return genericSuccessResponse(email);
      }
      console.error("[Auth Signup] createUser failed:", createError.message);
      return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
    }

    if (!created.user) {
      console.error("[Auth Signup] createUser returned no user");
      return NextResponse.json({ error: "Unable to create account right now." }, { status: 500 });
    }

    // Send the signup OTP email by triggering a resend. supabase.auth.admin
    // doesn't expose a direct "send signup OTP" call, but resend works once
    // the user exists with email_confirm=false.
    const { error: resendError } = await supabaseAdmin.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      console.warn("[Auth Signup] resend failed:", resendError.message);
      // Don't fail the request — the user can hit "Resend Code" from the UI.
    }

    return genericSuccessResponse(email);
  } catch (error) {
    console.error("[Auth Signup]", error);
    return NextResponse.json(
      { error: "Unable to sign up right now. Please try again." },
      { status: 500 }
    );
  }
}
