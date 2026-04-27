import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  checkRateLimit,
  enforceSameOrigin,
  rateLimitResponse,
  safeJsonParse,
} from "@/lib/api-security";
import { createSupabaseServerClient, getAuthUser } from "@/lib/auth-server";

export const runtime = "nodejs";

interface ChangeEmailPayload {
  email?: string;
  currentPassword?: string;
  redirectTo?: string;
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
 * Initiates an email change for the authenticated user. Done server-side via
 * the cookie-bound @supabase/ssr client so the operation does NOT depend on
 * the browser SDK having a usable in-memory session — calling
 * supabase.auth.updateUser({ email }) directly from the client used to
 * throw "Auth session missing!" whenever the client session drifted.
 *
 * Always requires the current password (mirrors Instagram's flow): an
 * unattended browser can't be used to hijack the account by changing the
 * recovery email.
 *
 * Supabase will email a confirmation link to the NEW address; the user
 * clicks it, our /auth/callback exchanges the code, and the email change
 * takes effect. Until then the existing email continues to work.
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
    const redirectTo = String(parsed.data.redirectTo || "");

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
    await transient.auth.signOut().catch(() => {});

    // Trigger the email-change flow via the user's own cookie session so
    // Supabase records it against the right user. updateUser sends the
    // confirmation email to the NEW address.
    const supabase = await createSupabaseServerClient();
    const { error: updateError } = await supabase.auth.updateUser(
      { email: newEmail },
      redirectTo ? { emailRedirectTo: redirectTo } : undefined
    );

    if (updateError) {
      const msg = updateError.message.toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
        // Don't reveal whether the address is already taken — generic message.
        return NextResponse.json(
          { error: "Could not start the email change. Please try a different address." },
          { status: 400 }
        );
      }
      console.error("[Auth Change Email]", updateError);
      return NextResponse.json(
        { error: "Could not start the email change right now." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Auth Change Email]", error);
    return NextResponse.json(
      { error: "Could not start the email change right now." },
      { status: 500 }
    );
  }
}
