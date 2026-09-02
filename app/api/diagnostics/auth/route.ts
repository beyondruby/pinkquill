import { NextResponse } from "next/server";
import { enforceSameOrigin } from "@/lib/api-security";

export const runtime = "nodejs";

const MAX_BODY_BYTES = 8 * 1024;
const ALLOWED_KINDS = new Set([
  "auth_init_slow",
  "auth_init_timeout",
  "auth_init_error",
  "auth_lock_timeout",
]);

/**
 * Sink for client auth diagnostics (see lib/diagnostics/authDiagnostics.ts).
 *
 * Intentionally does not authenticate (the reporting client may be unable to)
 * and does not use the DB-backed rate limiter (the DB path is what we are
 * diagnosing). It only validates shape/size and writes one log line that is
 * searchable in the platform logs as "[auth-diagnostic]".
 */
export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return new NextResponse(null, { status: 413 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const kind = typeof payload.kind === "string" ? payload.kind : "";
  if (!ALLOWED_KINDS.has(kind)) {
    return new NextResponse(null, { status: 400 });
  }

  console.error(
    "[auth-diagnostic]",
    JSON.stringify({
      ...payload,
      ua: request.headers.get("user-agent")?.slice(0, 160) ?? null,
      country: request.headers.get("x-vercel-ip-country") ?? null,
    })
  );

  return new NextResponse(null, { status: 204 });
}
