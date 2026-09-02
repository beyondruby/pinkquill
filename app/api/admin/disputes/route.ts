/**
 * Admin dispute desk (Phase 1d, decision D8: platform_admins table).
 *   GET  → open disputes with order + evidence
 *   POST → { dispute_id, resolution, notes?, refund_amount? } resolves one
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { enforceSameOrigin, safeJsonParse } from "@/lib/api-security";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isPlatformAdmin, resolveDisputeAsAdmin } from "@/lib/payments-server";
import { executeApprovedRefunds } from "@/lib/refunds-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin(request: Request) {
  const user = await getAuthUser(request);
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!(await isPlatformAdmin(user.id))) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  return { user };
}

export async function GET(request: Request) {
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;

  const { data, error } = await supabaseAdmin
    .from("disputes")
    .select("id, order_id, kind, reason, description, status, stripe_status, evidence, evidence_due_by, amount_cents, currency, previous_status, created_at, initiated_by, orders(order_number, status, payment_status, buyer_id, seller_id, listing_type, amount, currency)")
    .in("status", ["open", "under_review", "escalated"])
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ disputes: data ?? [] });
}

export async function POST(request: Request) {
  const originError = enforceSameOrigin(request);
  if (originError) return originError;
  const gate = await requireAdmin(request);
  if ("error" in gate) return gate.error;

  const parsed = await safeJsonParse<{ dispute_id?: string; resolution?: string; notes?: string; refund_amount?: number | string }>(request);
  if ("error" in parsed) return parsed.error;
  const { dispute_id, resolution, notes, refund_amount } = parsed.data;
  if (!dispute_id || !resolution) return NextResponse.json({ error: "dispute_id and resolution are required" }, { status: 400 });

  try {
    const result = await resolveDisputeAsAdmin({
      disputeId: dispute_id,
      resolution,
      notes: notes ?? null,
      refundAmount: refund_amount === undefined || refund_amount === null || refund_amount === "" ? null : Number(refund_amount),
      adminId: gate.user.id,
    });
    const { data: dispute } = await supabaseAdmin.from("disputes").select("order_id").eq("id", dispute_id).maybeSingle();
    const execution = dispute?.order_id ? await executeApprovedRefunds(dispute.order_id as string, 5).catch(() => null) : null;
    return NextResponse.json({ success: true, result, execution });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to resolve dispute";
    return NextResponse.json({ error: message }, { status: /admin/i.test(message) ? 403 : 400 });
  }
}
