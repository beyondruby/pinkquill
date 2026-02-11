import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";

interface RateLimitOptions {
  request: Request;
  scope: string;
  limit: number;
  windowSeconds: number;
  userId?: string;
}

interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: string | null;
}

function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xRealIp = request.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const first = xForwardedFor.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}

function getRateLimitIdentifier(request: Request, userId?: string): string {
  if (userId) return `user:${userId}`;
  return `ip:${getClientIp(request)}`;
}

export function enforceSameOrigin(request: Request): NextResponse | null {
  const requestOrigin = new URL(request.url).origin;
  const originHeader = request.headers.get("origin");

  if (originHeader) {
    try {
      if (new URL(originHeader).origin !== requestOrigin) {
        return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
      }
      return null;
    } catch {
      return NextResponse.json({ error: "Invalid origin header" }, { status: 403 });
    }
  }

  const referer = request.headers.get("referer");
  if (!referer) {
    return NextResponse.json({ error: "Missing origin and referer headers" }, { status: 403 });
  }

  try {
    if (new URL(referer).origin !== requestOrigin) {
      return NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid referer header" }, { status: 403 });
  }

  return null;
}

export async function checkRateLimit({
  request,
  scope,
  limit,
  windowSeconds,
  userId,
}: RateLimitOptions): Promise<RateLimitDecision> {
  try {
    const identifier = getRateLimitIdentifier(request, userId);
    const { data, error } = await supabaseAdmin
      .rpc("enforce_api_rate_limit", {
        p_scope: scope,
        p_identifier: identifier,
        p_limit: limit,
        p_window_seconds: windowSeconds,
      })
      .single<{ allowed: boolean; remaining: number; reset_at: string }>();

    if (error || !data) {
      console.error("[RateLimit] RPC error:", error);
      return { allowed: true, remaining: limit, resetAt: null };
    }

    return {
      allowed: Boolean(data.allowed),
      remaining: Math.max(0, Number(data.remaining) || 0),
      resetAt: data.reset_at || null,
    };
  } catch (error) {
    console.error("[RateLimit] unexpected error:", error);
    return { allowed: true, remaining: limit, resetAt: null };
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
