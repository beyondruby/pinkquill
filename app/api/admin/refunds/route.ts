/**
 * Admin refund desk (Phase 2f).
 *   GET  → refunds that need a person: needs_review, failed, plus requested / approved / processing for context
 *   POST → { refund_id, action: "retry" | "cancel", note? }
 * "retry" puts the row back to `approved`, which the existing executor picks
 * up (we call it once here, the payout worker cron does the rest).
 */
import { NextResponse } from "next/server";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { adminRpc, requireAdmin } from "@/lib/admin-server";
import { executeApprovedRefunds } from "@/lib/refunds-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT = "id, order_id, kind, status, amount_cents, currency, listing_amount_cents, listing_currency, seller_share_cents, initiator_role, reason, note, last_error, attempts, stripe_refund_id, created_at, updated_at, decided_at, previous_status, order:orders!refunds_order_id_fkey (order_number, status, payment_status, listing_type, buyer:profiles!orders_buyer_id_fkey (username, display_name), seller:profiles!orders_seller_id_fkey (username, display_name), product:products (title))";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "open";
  let query = supabaseAdmin.from("refunds").select(SELECT).order("created_at", { ascending: false }).limit(100);
  query = scope === "all" ? query : query.in("status", ["needs_review", "failed", "requested", "approved", "processing"]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ refunds: data ?? [] });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const parsed = await safeJsonParse<{ refund_id?: string; action?: string; note?: string }>(request);
  if ("error" in parsed) return parsed.error;
  const { refund_id, action, note } = parsed.data;
  if (!refund_id || !action) return NextResponse.json({ error: "refund_id and action are required" }, { status: 400 });

  if (action === "retry") {
    const r = await adminRpc<{ outcome: string }>("admin_retry_refund", { p_refund_id: refund_id, p_admin_id: gate.user.id });
    if ("error" in r) return r.error;
    const { data: refund } = await supabaseAdmin.from("refunds").select("order_id").eq("id", refund_id).maybeSingle();
    const execution = refund?.order_id ? await executeApprovedRefunds(refund.order_id as string, 5).catch((err: unknown) => ({ error: err instanceof Error ? err.message : "executor failed" })) : null;
    return NextResponse.json({ success: true, result: r.data, execution });
  }
  if (action === "cancel") {
    const r = await adminRpc("admin_cancel_refund", { p_refund_id: refund_id, p_admin_id: gate.user.id, p_note: note ?? null });
    if ("error" in r) return r.error;
    return NextResponse.json({ success: true, result: r.data });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
