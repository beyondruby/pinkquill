/**
 * Admin payout desk (Phase 2f).
 *   GET  → failed and held payouts (plus pending / processing for context) with order + seller + account state
 *   POST → { payout_id, action: "retry" } | { seller_id, action: "unblock" }
 * Retry only re-queues; the payout worker cron moves the money.
 */
import { NextResponse } from "next/server";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { adminRpc, requireAdmin } from "@/lib/admin-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SELECT = "id, order_id, seller_id, amount_cents, currency, listing_amount_cents, listing_currency, status, block_reason, last_error, attempts, transfer_id, destination_account_id, reversed_cents, eligible_at, sent_at, created_at, updated_at, order:orders!payouts_order_id_fkey (order_number, status, payment_status, product:products (title)), seller:profiles!payouts_seller_id_fkey (username, display_name)";

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const url = new URL(request.url);
  const scope = url.searchParams.get("scope") ?? "open";
  let query = supabaseAdmin.from("payouts").select(SELECT).order("created_at", { ascending: false }).limit(100);
  query = scope === "all" ? query : query.in("status", ["failed", "blocked", "pending", "processing"]);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const sellerIds = Array.from(new Set((data ?? []).map((p) => p.seller_id as string)));
  const { data: accounts } = sellerIds.length
    ? await supabaseAdmin.from("seller_accounts").select("user_id, stripe_account_id, payouts_enabled, disabled_reason, requirements_currently_due").in("user_id", sellerIds)
    : { data: [] };
  return NextResponse.json({ payouts: data ?? [], accounts: accounts ?? [] });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;
  const parsed = await safeJsonParse<{ payout_id?: string; seller_id?: string; action?: string }>(request);
  if ("error" in parsed) return parsed.error;
  const { payout_id, seller_id, action } = parsed.data;

  if (action === "retry" && payout_id) {
    const r = await adminRpc("admin_retry_payout", { p_payout_id: payout_id, p_admin_id: gate.user.id });
    if ("error" in r) return r.error;
    return NextResponse.json({ success: true, result: r.data });
  }
  if (action === "unblock" && seller_id) {
    const r = await adminRpc("admin_unblock_seller_payouts", { p_seller_id: seller_id, p_admin_id: gate.user.id });
    if ("error" in r) return r.error;
    return NextResponse.json({ success: true, result: r.data });
  }
  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
