/**
 * System desk (Phase 2f): cron schedule + recent runs, Stripe event health,
 * open alerts and the audit trail. POST runs a cron job now or resolves an alert.
 */
import { NextResponse } from "next/server";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { adminRpc, requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const JOBS = new Set(["auto_decline", "hourly", "payout_worker"]);

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const [health, runs, events, alerts, audit] = await Promise.all([
    supabaseAdmin.rpc("get_ops_health"),
    supabaseAdmin.from("cron_runs").select("id, job, started_at, finished_at, ok, result, error").order("started_at", { ascending: false }).limit(40),
    supabaseAdmin.from("stripe_events").select("event_id, event_type, order_id, status, attempts, error, received_at, processed_at").in("status", ["failed", "processing"]).order("received_at", { ascending: false }).limit(40),
    supabaseAdmin.from("ops_alerts").select("id, kind, severity, message, context, order_id, created_at").is("resolved_at", null).order("created_at", { ascending: false }).limit(50),
    supabaseAdmin.from("ops_alerts").select("id, kind, severity, message, context, order_id, created_at, resolved_at").not("resolved_at", "is", null).order("created_at", { ascending: false }).limit(50),
  ]);
  if (health.error) return NextResponse.json({ error: health.error.message }, { status: 500 });
  return NextResponse.json({ health: health.data, runs: runs.data ?? [], stripe_events: events.data ?? [], alerts: alerts.data ?? [], history: audit.data ?? [] });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const parsed = await safeJsonParse<{ action?: string; job?: string; alert_id?: number }>(request);
  if ("error" in parsed) return parsed.error;
  const { action, job, alert_id } = parsed.data;

  if (action === "run_job" && job) {
    if (!JOBS.has(job)) return NextResponse.json({ error: "Unknown job" }, { status: 400 });
    const r = await adminRpc("run_cron_job", { p_job: job });
    if ("error" in r) return r.error;
    await supabaseAdmin.rpc("admin_log", { p_admin_id: gate.user.id, p_action: "cron_run_now", p_context: { job, result: r.data } });
    return NextResponse.json({ success: true, result: r.data });
  }
  if (action === "resolve_alert" && alert_id) {
    const r = await adminRpc("admin_resolve_alert", { p_alert_id: alert_id, p_admin_id: gate.user.id });
    if ("error" in r) return r.error;
    return NextResponse.json({ success: true, result: r.data });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
