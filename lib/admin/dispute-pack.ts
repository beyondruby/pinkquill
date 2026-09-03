/**
 * Everything an admin needs to judge one dispute (Phase 2f): the order, both
 * people, the message thread, deliveries and the evidence items. Read with
 * the service-role client from the admin routes only.
 */
import { supabaseAdmin } from "@/lib/supabase-server";
import type { EvidencePack } from "./chargeback-evidence";

export interface DisputeRow {
  id: string;
  order_id: string;
  kind: "dispute" | "chargeback";
  reason: string;
  description: string | null;
  status: string;
  stripe_dispute_id: string | null;
  stripe_status: string | null;
  evidence: EvidencePack["evidenceItems"];
  evidence_due_by: string | null;
  amount_cents: number | null;
  currency: string | null;
  previous_status: string | null;
  resolution: string | null;
  resolution_notes: string | null;
  resolved_at: string | null;
  initiated_by: string | null;
  created_at: string;
}

export async function loadDisputePack(disputeId: string): Promise<{ dispute: DisputeRow; pack: EvidencePack; buyer_id: string; seller_id: string } | null> {
  const { data: dispute } = await supabaseAdmin
    .from("disputes")
    .select("id, order_id, kind, reason, description, status, stripe_dispute_id, stripe_status, evidence, evidence_due_by, amount_cents, currency, previous_status, resolution, resolution_notes, resolved_at, initiated_by, created_at")
    .eq("id", disputeId)
    .maybeSingle<DisputeRow>();
  if (!dispute) return null;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, listing_type, status, payment_status, amount, currency, total_amount, created_at, started_at, submitted_at, completed_at, due_date, brief, requirements, buyer_id, seller_id, payment_intent_id, product:products (title, description), pricing:product_pricing!orders_pricing_id_fkey (variant_name, delivery_days, revisions, package_features), buyer:profiles!orders_buyer_id_fkey (username, display_name), seller:profiles!orders_seller_id_fkey (username, display_name)")
    .eq("id", dispute.order_id)
    .maybeSingle();
  if (!order) return null;
  const o = order as unknown as {
    id: string; order_number: string; listing_type: string; status: string; payment_status: string; amount: number; currency: string; total_amount: number | null;
    created_at: string; started_at: string | null; submitted_at: string | null; completed_at: string | null; due_date: string | null; brief: string | null; requirements: unknown;
    buyer_id: string; seller_id: string; payment_intent_id: string | null;
    product: { title: string | null; description: string | null } | null;
    pricing: { variant_name: string | null; delivery_days: number | null; revisions: number | null; package_features: string[] | null } | null;
    buyer: { username: string | null; display_name: string | null } | null;
    seller: { username: string | null; display_name: string | null } | null;
  };

  const [{ data: messages }, { data: deliveries }, { data: attachments }, { data: authUser }] = await Promise.all([
    supabaseAdmin.from("order_messages").select("sender_id, content, message_type, created_at").eq("order_id", o.id).order("created_at").limit(500),
    supabaseAdmin.from("order_deliveries").select("id, version, status, delivered_at").eq("order_id", o.id).order("version"),
    supabaseAdmin.from("order_attachments").select("delivery_id").eq("order_id", o.id).not("delivery_id", "is", null),
    supabaseAdmin.auth.admin.getUserById(o.buyer_id),
  ]);
  const filesByDelivery = new Map<string, number>();
  for (const a of attachments ?? []) filesByDelivery.set(a.delivery_id as string, (filesByDelivery.get(a.delivery_id as string) ?? 0) + 1);

  const pack: EvidencePack = {
    order: {
      order_number: o.order_number, listing_type: o.listing_type, status: o.status, amount: Number(o.amount), currency: o.currency,
      total_amount: o.total_amount == null ? null : Number(o.total_amount), created_at: o.created_at, started_at: o.started_at, submitted_at: o.submitted_at,
      completed_at: o.completed_at, due_date: o.due_date, brief: o.brief, requirements: o.requirements,
    },
    product: o.product,
    pricing: o.pricing,
    buyer: { username: o.buyer?.username ?? null, display_name: o.buyer?.display_name ?? null, email: authUser?.user?.email ?? null },
    seller: { username: o.seller?.username ?? null, display_name: o.seller?.display_name ?? null },
    messages: (messages ?? []).map((m) => ({
      role: m.message_type === "system" ? "system" : m.sender_id === o.buyer_id ? "buyer" : "seller",
      at: m.created_at as string,
      text: (m.content as string) ?? "",
    })),
    deliveries: (deliveries ?? []).map((d) => ({ version: d.version as number, at: d.delivered_at as string, files: filesByDelivery.get(d.id as string) ?? 0, status: (d.status as string) ?? null })),
    evidenceItems: Array.isArray(dispute.evidence) ? dispute.evidence : [],
  };
  return { dispute, pack, buyer_id: o.buyer_id, seller_id: o.seller_id };
}
