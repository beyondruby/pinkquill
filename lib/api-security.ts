import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

interface RateLimitOptions {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string;
  identifier?: string;
}

interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
}

/**
 * Client IP as set by the hosting platform. On Vercel both `x-real-ip` and
 * `x-forwarded-for` are populated by the edge and cannot be spoofed by the
 * client; `cf-connecting-ip` is NOT (we are not behind Cloudflare), so it was
 * a free per-request bypass of every IP rate limit (findings S5). If the
 * deployment ever moves behind Cloudflare, add that header back at the top.
 */
/**
 * Constant-time check of the cron bearer secret (shared by the cron routes).
 */
export function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function getClientIp(request: Request): string {
  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function getRateLimitIdentifier(request: Request, userId?: string, explicitIdentifier?: string): string {
  if (explicitIdentifier) return explicitIdentifier;
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(request)}`;
}

/**
 * Resolve the public-facing origin for this request.
 * Behind reverse proxies (Vercel, Cloudflare, nginx) `request.url` may contain
 * an internal host (e.g. 127.0.0.1:3000). We prefer forwarded headers to get the
 * origin the client actually targeted.
 */
function resolvePublicOrigin(request: Request): string {
  // x-forwarded-host is the standard proxy header for the original Host
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${forwardedHost.split(",")[0].trim()}`;
  }

  // Fall back to the Host header (set by the browser on every request)
  const host = request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "https";
    return `${proto}://${host}`;
  }

  // Last resort: use request.url directly
  return new URL(request.url).origin;
}

export function enforceSameOrigin(request: Request): NextResponse | null {
  const publicOrigin = resolvePublicOrigin(request);

  const originHeader = request.headers.get("origin");
  if (originHeader) {
    try {
      if (new URL(originHeader).origin !== publicOrigin) {
        return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
      }
      return null;
    } catch {
      return NextResponse.json({ error: "Invalid origin header" }, { status: 403 });
    }
  }

  const referer = request.headers.get("referer");
  if (referer) {
    try {
      if (new URL(referer).origin !== publicOrigin) {
        return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
      }
      return null;
    } catch {
      return NextResponse.json({ error: "Invalid referer header" }, { status: 403 });
    }
  }

  // Neither origin nor referer present — allow the request through.
  // Authentication (getAuthUser) still guards access; blocking here only
  // caused false-positive 403s for mobile webviews, privacy extensions,
  // and redirect-back flows from Stripe/PayPal.
  return null;
}

/**
 * Safely parse the request body as JSON.
 * Returns the parsed body or a 400 NextResponse on failure.
 */
export async function safeJsonParse<T = unknown>(
  request: Request
): Promise<{ data: T } | { error: NextResponse }> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return {
      error: NextResponse.json(
        { error: "Failed to read request body" },
        { status: 400 }
      ),
    };
  }

  if (!text) {
    return {
      error: NextResponse.json(
        { error: "Request body is empty" },
        { status: 400 }
      ),
    };
  }

  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return {
      error: NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      ),
    };
  }
}

export async function checkRateLimit({
  request,
  scope,
  limit,
  windowSeconds,
  userId,
  identifier,
}: RateLimitOptions): Promise<RateLimitDecision> {
  try {
    const resolvedIdentifier = getRateLimitIdentifier(request, userId, identifier);
    const { data, error } = await supabaseAdmin
      .rpc("enforce_api_rate_limit", {
        p_scope: scope,
        p_identifier: resolvedIdentifier,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      .single<{ allowed: boolean; remaining: number; reset_at: string }>();

    if (error || !data) {
      console.error("[RateLimit] RPC error — failing closed:", error);
      return { allowed: false, remaining: 0, resetAt: null };
    }

    return {
      allowed: Boolean(data.allowed),
      remaining: Math.max(0, Number(data.remaining) || 0),
      resetAt: data.reset_at || null,
    };
  } catch (error) {
    console.error("[RateLimit] unexpected error — failing closed:", error);
    return { allowed: false, remaining: 0, resetAt: null };
  }
}

export function rateLimitResponse(decision: RateLimitDecision, defaultWindowSeconds: number): NextResponse {
  const now = Date.now();
  const resetAtMs = decision.resetAt ? Date.parse(decision.resetAt) : NaN;
  const retryAfter = Number.isFinite(resetAtMs)
    ? Math.max(1, Math.ceil((resetAtMs - now) / 1000))
    : defaultWindowSeconds;

  return NextResponse.json(
    { error: "Too many requests. Please try again shortly." },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfter),
        "X-RateLimit-Remaining": String(decision.remaining),
        "X-RateLimit-Reset": decision.resetAt || "",
      },
    }
  );
}
