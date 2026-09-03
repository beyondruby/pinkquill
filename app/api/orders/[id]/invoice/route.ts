/**
 * Tax invoice PDF for an order (Phase 4c follow-up). Either participant or an
 * operator can fetch it; unpaid orders have no invoice. Rendered on the
 * server from the same rows the receipt page reads, so the numbers match.
 * Inline so the browser shows it; the "Download PDF" link saves it.
 */
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { supabaseAdmin } from "@/lib/supabase-server";
import { isPlatformAdmin } from "@/lib/payments-server";
import { DEFAULT_ISSUER, renderInvoicePdf, type InvoiceIssuer } from "@/lib/invoice/render-invoice";
import { getOrderStatusMeta } from "@/lib/utils/orderStatus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Bad order id" }, { status: 400 });

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("id, order_number, buyer_id, seller_id, status, payment_status, listing_type, quantity, amount, original_amount, discount_amount, shipping_cost, buyer_fee, total_amount, currency, charge_currency, charge_amount_cents, fx_rate, payment_intent_id, payment_provider, created_at, updated_at, product:products (title, delivery_type), pricing:product_pricing!orders_pricing_id_fkey (variant_name, delivery_days, revisions), buyer:profiles!orders_buyer_id_fkey (username, display_name), seller:profiles!orders_seller_id_fkey (username, display_name)")
    .eq("id", id)
    .maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
  const o = order as unknown as {
    id: string; order_number: string; buyer_id: string; seller_id: string; status: string; payment_status: string; listing_type: string; quantity: number;
    amount: number; original_amount: number | null; discount_amount: number | null; shipping_cost: number | null; buyer_fee: number | null; total_amount: number | null; currency: string;
    charge_currency: string | null; charge_amount_cents: number | null; fx_rate: number | null; payment_intent_id: string | null; payment_provider: string | null; created_at: string; updated_at: string;
    product: { title: string | null; delivery_type: string | null } | null; pricing: { variant_name: string | null; delivery_days: number | null; revisions: number | null } | null;
    buyer: { username: string | null; display_name: string | null } | null; seller: { username: string | null; display_name: string | null } | null;
  };
  const participant = o.buyer_id === user.id || o.seller_id === user.id;
  if (!participant && !(await isPlatformAdmin(user.id))) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!["paid", "partially_refunded", "refunded"].includes(o.payment_status)) return NextResponse.json({ error: "This order has not been paid, so there is no invoice yet." }, { status: 409 });

  const [{ data: payments }, { data: refunds }, { data: events }, { data: issuerRow }, buyerAuth] = await Promise.all([
    supabaseAdmin.from("payments").select("status, charge_id, payment_intent_id, amount_cents, currency, created_at").eq("order_id", o.id).order("created_at"),
    supabaseAdmin.from("refunds").select("kind, status, listing_amount_cents, listing_currency, reason, created_at, decided_at").eq("order_id", o.id).eq("status", "succeeded").order("created_at"),
    supabaseAdmin.from("order_events").select("created_at").eq("order_id", o.id).eq("event_type", "payment").order("created_at").limit(1),
    supabaseAdmin.from("platform_settings").select("value").eq("key", "invoice_issuer").maybeSingle(),
    o.buyer_id === user.id ? Promise.resolve({ data: { user } }) : supabaseAdmin.auth.admin.getUserById(o.buyer_id),
  ]);
  const payment = (payments ?? []).find((p) => p.status === "succeeded") ?? (payments ?? [])[0] ?? null;
  const issuer: InvoiceIssuer = { ...DEFAULT_ISSUER, ...((issuerRow?.value as Partial<InvoiceIssuer> | null) ?? {}) };
  if (!Array.isArray(issuer.lines)) issuer.lines = DEFAULT_ISSUER.lines;

  const shipping = Number(o.shipping_cost || 0);
  const original = Number(o.original_amount ?? o.amount);
  const discount = Number(o.discount_amount || 0);
  const subtotal = Math.max(original - shipping, 0);
  const quantity = Math.max(1, Number(o.quantity || 1));
  const isService = o.listing_type === "service";
  const pkg = o.pricing;
  const description = `${o.product?.title ?? (isService ? "Commission" : "Product")}${pkg?.variant_name ? ` - ${pkg.variant_name}${isService ? " package" : ""}` : ""}`;
  const detail = isService
    ? [pkg?.delivery_days ? `${pkg.delivery_days}-day delivery` : null, pkg?.revisions != null ? `${pkg.revisions} revision${pkg.revisions === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")
    : o.product?.delivery_type === "digital" ? "Digital download" : "Physical item";
  const paidAt = events?.[0]?.created_at ?? payment?.created_at ?? null;
  const free = o.payment_provider === "placeholder" || (payment ? payment.amount_cents === 0 : false);

  const pdf = renderInvoicePdf({
    invoiceNumber: o.order_number,
    orderId: o.id,
    issuedAt: paidAt ?? o.updated_at,
    paidAt,
    status: getOrderStatusMeta(o.status).label,
    currency: o.currency,
    buyer: { name: o.buyer?.display_name || o.buyer?.username || "Buyer", username: o.buyer?.username ?? null, email: buyerAuth?.data?.user?.email ?? null },
    creator: { name: o.seller?.display_name || o.seller?.username || "Creator", username: o.seller?.username ?? null },
    issuer,
    lines: [{ description, detail, quantity, unitAmount: subtotal / quantity, amount: subtotal }],
    shipping, discount,
    processingFee: Number(o.buyer_fee || 0),
    tax: 0,
    total: Number(o.total_amount ?? o.amount),
    charged: o.charge_currency && o.charge_amount_cents ? { amountCents: o.charge_amount_cents, currency: o.charge_currency, rate: o.fx_rate == null ? null : Number(o.fx_rate) } : null,
    payment: { method: free ? "No charge" : "Card via Stripe", reference: payment?.charge_id ?? payment?.payment_intent_id ?? o.payment_intent_id ?? null, at: payment?.created_at ?? null },
    refunds: (refunds ?? []).map((r) => ({ kind: r.kind as string, amount: Number(r.listing_amount_cents ?? 0) / 100, currency: (r.listing_currency as string) ?? o.currency, at: (r.decided_at ?? r.created_at) as string, reason: (r.reason as string) ?? null })),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="pinkquill-invoice-${o.order_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
