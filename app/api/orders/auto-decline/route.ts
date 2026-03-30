import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

function verifyCronSecret(authHeader: string | null, secret: string): boolean {
  const expected = `Bearer ${secret}`;
  if (!authHeader || authHeader.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  const authHeader = request.headers.get("authorization");
  if (!verifyCronSecret(authHeader, cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { data, error } = await supabaseAdmin.rpc("auto_decline_expired_orders");

    if (error) {
      console.error("[auto-decline] RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const count = typeof data === "number" ? data : 0;
    return NextResponse.json({ declined: count });
  } catch (err) {
    console.error("[auto-decline] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
