import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { verifyCronSecret } from "@/lib/api-security";

export const runtime = "nodejs";

/**
 * Manual trigger for the hourly housekeeping job. The scheduled run lives in
 * the database (pg_cron → run_cron_job('hourly')); this route exists for
 * operators and tests. It never talks to Stripe — payouts are released here
 * and transferred by /api/payouts/run.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!verifyCronSecret(request.headers.get("authorization"), cronSecret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabaseAdmin.rpc("run_cron_job", { p_job: "hourly" });
  if (error) {
    console.error("[auto-complete] run_cron_job error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, result: data });
}
