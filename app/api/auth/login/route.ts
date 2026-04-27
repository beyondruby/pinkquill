import { NextResponse } from "next/server";
import { checkRateLimit, enforceSameOrigin, rateLimitResponse, safeJsonParse } from "@/lib/api-security";
import { createSupabaseServerClient } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

interface LoginPayload {
  identifier?: string;
  password?: string;
}

function isUsernameIdentifier(value: string): boolean {
  return !value.includes("@") || value.startsWith("@");
}

function normalizeUsername(value: string): string {
  return value.toLowerCase().replace(/^@/, "").trim();
}

function invalidCredentialsResponse() {
  return NextResponse.json(
    { error: "Invalid email/username or password." },
    { status: 401 }
  );
}

export async function POST(request: Request) {
  try {
    const originError = enforceSameOrigin(request);
    if (originError) return originError;

    const rateLimit = await checkRateLimit({
      request,
      scope: "auth.login.ip",
      limit: 20,
      windowSeconds: 300,
    });
    if (!rateLimit.allowed) {
      return rateLimitResponse(rateLimit, 300);
    }

    const parsed = await safeJsonParse<LoginPayload>(request);
    if ("error" in parsed) return parsed.error;

    const identifier = String(parsed.data.identifier || "").trim();
    const password = String(parsed.data.password || "");

    if (!identifier || !password) {
      return NextResponse.json(
        { error: "Email/username and password are required." },
        { status: 400 }
      );
    }

    let loginEmail = identifier;

    if (isUsernameIdentifier(identifier)) {
      const normalizedUsername = normalizeUsername(identifier);
      if (!normalizedUsername) {
        return invalidCredentialsResponse();
      }

      const { data: profile, error: profileError } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("username", normalizedUsername)
        .maybeSingle<{ email: string | null }>();

      if (profileError || !profile?.email) {
        return invalidCredentialsResponse();
      }

      loginEmail = profile.email;
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });

    if (error) {
      if (error.message.includes("Email not confirmed")) {
        // Silently resend verification email — do NOT reveal this to the client
        console.info("[Auth Login] Resending verification email for unconfirmed account");
        await supabase.auth.resend({
          type: "signup",
          email: loginEmail,
        }).catch(() => {});
      }

      // Return the exact same generic error for ALL failure reasons
      // (wrong password, unconfirmed email, nonexistent user, etc.)
      // to prevent email/account enumeration attacks.
      return invalidCredentialsResponse();
    }

    // signInWithPassword wrote the sb-* session cookies via the @supabase/ssr
    // client. The browser SDK uses the same cookie store, so the session is
    // now visible on the client too — no token-passing required.
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth Login]", error);
    return NextResponse.json(
      { error: "Unable to sign in right now. Please try again." },
      { status: 500 }
    );
  }
}
