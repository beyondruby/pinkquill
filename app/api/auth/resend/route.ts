import { NextResponse } from "next/server";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface ResendPayload {
  email?: string;
  type?: "signup" | "email_change";
}

/**
 * POST /api/auth/resend
 *
 * Re-sends an OTP email for an unverified signup or pending email change.
 * Rate-limited per IP and per email so neither client-side timers nor a
 * scripted client can spam users with verification emails.
 */
export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    // Per-IP gate
    const ipLimit = await checkRateLimit({
      request,
      scope: "auth.resend.ip",
      limit: 10,
      windowSeconds: 600,
    });
    if (!ipLimit.allowed) {
      return rateLimitResponse(ipLimit, 600);
    }

    const parsed = await safeJsonParse<ResendPayload>(request);
    if ("error" in parsed) return parsed.error;

    const email = String(parsed.data.email || "").trim().toLowerCase();
    const type = parsed.data.type === "email_change" ? "email_change" : "signup";

    if (!email || !email.includes("@") || email.length > 254) {
      return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
    }

    // Per-email gate (mitigates targeted email-bombing of one address)
    const emailLimit = await checkRateLimit({
      request,
      scope: "auth.resend.email",
      identifier: `email:${email}`,
      limit: 3,
      windowSeconds: 600,
    });
    if (!emailLimit.allowed) {
      return rateLimitResponse(emailLimit, 600);
    }

    const { error: resendError } = await supabaseAdmin.auth.resend({ type, email });

    if (resendError) {
      // Log but do not surface — would leak whether the email exists.
      console.warn("[Auth Resend]", resendError.message);
    }

    // Generic confirmation regardless of outcome.
    return NextResponse.json({
      success: true,
      message: "If an unverified account exists for this email, a new code has been sent.",
    });
  } catch (error) {
    console.error("[Auth Resend]", error);
    return NextResponse.json(
      { error: "Unable to resend right now. Please try again." },
      { status: 500 }
    );
  }
}
