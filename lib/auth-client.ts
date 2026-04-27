import { supabase } from "@/lib/supabase";
import { safeResponseJson } from "@/lib/utils/fetch";

export interface LoginWithIdentifierResult {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  pendingEmail?: string;
  message?: string;
}

export interface SignupResult {
  success: boolean;
  error?: string;
  pendingEmail?: string;
  message?: string;
}

export interface SignupPayload {
  email: string;
  password: string;
  username: string;
  displayName: string;
}

export async function signupWithCredentials(payload: SignupPayload): Promise<SignupResult> {
  const response = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: payload.email,
      password: payload.password,
      username: payload.username,
      display_name: payload.displayName,
    }),
  });

  const data = await safeResponseJson<Record<string, unknown>>(response);

  if (!response.ok) {
    return {
      success: false,
      error: (data.error as string) || "Unable to create your account right now.",
    };
  }

  return {
    success: true,
    pendingEmail: (data.pending_email as string) || payload.email.toLowerCase(),
    message: (data.message as string) || undefined,
  };
}

export async function buildAuthenticatedHeaders(
  initial?: HeadersInit
): Promise<Headers> {
  const headers = new Headers(initial);

  try {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }
  } catch {
    // Auth can still be initializing; callers can decide whether to retry.
  }

  return headers;
}

export async function loginWithIdentifier(
  identifier: string,
  password: string
): Promise<LoginWithIdentifierResult> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      identifier,
      password,
    }),
    // Same-origin by default already includes cookies, but be explicit:
    // this is how the cookie-based session arrives in the browser.
    credentials: "same-origin",
  });

  const data = await safeResponseJson<Record<string, unknown>>(response);

  if (!response.ok) {
    return {
      success: false,
      error: (data.error as string) || "Unable to sign in right now.",
      requiresVerification: Boolean(data.requires_verification),
      pendingEmail: (data.pending_email as string) || undefined,
      message: (data.message as string) || undefined,
    };
  }

  // The server route set sb-* cookies via @supabase/ssr. Our browser client
  // (also @supabase/ssr) reads from the same store, so the session is now
  // visible to the SDK without any explicit setSession call. Surfacing the
  // SIGNED_IN event lets AuthProvider populate user state immediately.
  await supabase.auth.getSession();

  return {
    success: true,
    requiresVerification: Boolean(data.requires_verification),
    pendingEmail: (data.pending_email as string) || undefined,
    message: (data.message as string) || undefined,
  };
}
