import { NextResponse } from "next/server";
import { getClientIp as getPlatformClientIp } from "@/lib/api-security";

interface VerifyTurnstileOptions {
  request: Request;
  token: string | null | undefined;
  action: string;
}

interface TurnstileSiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  action?: string;
}

export interface TurnstileVerificationResult {
  ok: boolean;
  response?: NextResponse;
}

function getClientIp(request: Request): string | null {
  const ip = getPlatformClientIp(request);
  return ip === "unknown" ? null : ip;
}

export async function verifyTurnstileToken({
  request,
  token,
  action,
}: VerifyTurnstileOptions): Promise<TurnstileVerificationResult> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return { ok: true };
    }
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Security verification is unavailable. Please try again later." },
        { status: 503 }
      ),
    };
  }

  const trimmedToken = String(token || "").trim();
  if (!trimmedToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Complete the security check before payment." },
        { status: 400 }
      ),
    };
  }

  const form = new URLSearchParams();
  form.set("secret", secret);
  form.set("response", trimmedToken);

  const clientIp = getClientIp(request);
  if (clientIp) {
    form.set("remoteip", clientIp);
  }

  let siteVerifyResponse: Response;
  try {
    siteVerifyResponse = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
      cache: "no-store",
      // Checkout used to block for the platform's whole function timeout
      // when Cloudflare stalled (findings H11).
      signal: AbortSignal.timeout(8000),
    });
  } catch (error) {
    console.error("[Turnstile] siteverify request failed", error);
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Security verification failed. Please try again." },
        { status: 502 }
      ),
    };
  }

  let payload: TurnstileSiteVerifyResponse | null = null;
  try {
    payload = await siteVerifyResponse.json() as TurnstileSiteVerifyResponse;
  } catch (error) {
    console.error("[Turnstile] invalid siteverify response", error);
  }

  if (!siteVerifyResponse.ok || !payload?.success) {
    const codes = Array.isArray(payload?.["error-codes"]) ? payload?.["error-codes"] : [];
    console.warn("[Turnstile] verification rejected", { status: siteVerifyResponse.status, codes });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Security verification failed. Please refresh and try again." },
        { status: 403 }
      ),
    };
  }

  if (payload.action && payload.action !== action) {
    console.warn("[Turnstile] action mismatch", { expected: action, actual: payload.action });
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Security verification expired. Please retry." },
        { status: 403 }
      ),
    };
  }

  return { ok: true };
}
