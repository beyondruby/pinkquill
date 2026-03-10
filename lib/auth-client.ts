import { safeResponseJson } from "@/lib/utils/fetch";

export interface LoginWithIdentifierResult {
  success: boolean;
  error?: string;
  requiresVerification?: boolean;
  pendingEmail?: string;
  message?: string;
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

  return {
    success: true,
    requiresVerification: Boolean(data.requires_verification),
    pendingEmail: (data.pending_email as string) || undefined,
    message: (data.message as string) || undefined,
  };
}
