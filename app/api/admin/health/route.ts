/** Operator health snapshot (admin only): cron, Stripe events, payouts, refunds, disputes, alerts, fx, ledger. */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isPlatformAdmin } from "@/lib/payments-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin.rpc("get_ops_health");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const { data: alerts } = await supabaseAdmin
    .from("ops_alerts").select("id, kind, severity, message, order_id, created_at")
    .is("resolved_at", null).order("created_at", { ascending: false }).limit(50);
  return NextResponse.json({ health: data, open_alerts: alerts ?? [] });
}
