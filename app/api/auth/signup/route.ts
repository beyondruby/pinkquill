import { NextResponse } from "next/server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface SignupPayload {
  email?: string;
  password?: string;
  username?: string;
  display_name?: string;
}

const USERNAME_RE = /^[a-z0-9_]+$/;
const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "support",
  "help",
  "moderator",
  "mod",
  "staff",
  "official",
  "pinkquill",
  "quill",
]);

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
    if (!password || password.length < 6 || password.length > 200) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }
    if (!usernameInput || usernameInput.length < 2 || usernameInput.length > 30) {
      return NextResponse.json({ error: "Username must be 2–30 characters." }, { status: 400 });
    }
    if (!USERNAME_RE.test(usernameInput)) {
      return NextResponse.json(
        { error: "Username can only contain lowercase letters, numbers, and underscores." },
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
    // We DO NOT distinguish "email already registered" from a fresh signup
    // in the response — both return the same generic success so attackers
    // can't enumerate emails.
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
        // Pretend we created a fresh account; do not actually send an OTP
        // to avoid spamming the legitimate owner with extra emails.
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
