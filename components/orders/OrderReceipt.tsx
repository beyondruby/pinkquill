"use client";

import { useAuth } from "@/components/providers/AuthProvider";
import { useOrder } from "@/lib/hooks/useOrders";
import { useOrderMoneyRecords } from "@/lib/hooks/useOrderDocuments";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderKind, getOrderStatusMeta } from "@/lib/utils/orderStatus";
import { DocumentFooter, DocumentHeader, DocumentParty, DocumentSection, DocumentShell, MoneyRow } from "@/components/documents/DocumentShell";
import { longDate, longDateTime } from "@/lib/utils/time";
import { orderTotalForBuyer, personName } from "./orderFormat";

/**
 * Receipt (Phase 2e): what the buyer paid, line by line, with the card
 * charge in the settlement currency and any refunds. Both participants can
 * open it; the numbers are the same for both.
 */

export default function OrderReceipt({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const { order, loading, error } = useOrder(orderId);
  const money = useOrderMoneyRecords(order?.id);
  const paid = order ? ["paid", "partially_refunded", "refunded"].includes(order.payment_status) : false;

  const docError = error ? "You can only open receipts for your own orders." : order && !paid ? "This order hasn't been paid yet, so there is no receipt." : null;

  return (
    <DocumentShell backHref={`/orders/${orderId}`} backLabel="Back to order" eyebrow="Receipt" loading={loading || (Boolean(order) && money.loading)} error={docError} returnTo={`/orders/${orderId}/receipt`}>
      {order && (() => {
        const kind = getOrderKind(order);
        const isBuyer = user?.id === order.buyer_id;
        const shipping = Number(order.shipping_cost || 0);
        const original = Number(order.original_amount ?? order.amount);
        const discount = Number(order.discount_amount || 0);
        const subtotal = Math.max(original - shipping, 0);
        const unit = order.quantity > 1 ? subtotal / order.quantity : subtotal;
        const buyerFee = Number(order.buyer_fee || 0);
        const total = orderTotalForBuyer(order);
        const payment = money.payments.find((p) => p.status === "succeeded") ?? money.payments[0] ?? null;
        const paidAt = money.paidAt ?? payment?.created_at ?? null;
        const chargedElsewhere = Boolean(order.charge_currency && order.charge_currency !== order.currency && order.charge_amount_cents);
        const refunds = money.refunds.filter((r) => r.status === "succeeded");
        const refundedListing = refunds.reduce((s, r) => s + (r.listing_amount_cents ?? 0), 0) / 100;
        const pkg = order.pricing;
        const description = kind === "commission"
          ? `${order.product?.title ?? "Commission"}${pkg?.variant_name ? ` — ${pkg.variant_name} package` : ""}`
          : `${order.product?.title ?? "Product"}${pkg?.variant_name ? ` — ${pkg.variant_name}` : ""}`;
        const detail = kind === "commission"
          ? [pkg?.delivery_days ? `${pkg.delivery_days}-day delivery` : null, pkg?.revisions != null ? `${pkg.revisions} revision${pkg.revisions === 1 ? "" : "s"}` : null].filter(Boolean).join(" · ")
          : kind === "digital" ? "Digital download" : "Physical item";

        return (
          <>
            <DocumentHeader title="Receipt" number={order.order_number} right={<>
              <p><span className="text-muted">Paid</span> <span className="text-ink font-ui">{longDate(paidAt ?? order.updated_at)}</span></p>
              <p><span className="text-muted">Status</span> <span className="text-ink font-ui">{getOrderStatusMeta(order.status).label}</span></p>
            </>} />

            <div className="grid grid-cols-2 gap-6 mt-6">
              <DocumentParty label="Billed to" name={personName(order.buyer, "Buyer")} sub={order.buyer?.username ? `@${order.buyer.username}` : null} extra={isBuyer ? user?.email ?? null : null} />
              <DocumentParty label="Creator" name={personName(order.seller, "Creator")} sub={order.seller?.username ? `@${order.seller.username}` : null} extra="via PinkQuill" />
            </div>

            <DocumentSection title="Order">
              <div className="rounded-xl border border-border-light overflow-hidden">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3 bg-subtle text-2xs font-ui uppercase tracking-[0.12em] text-muted"><span>Description</span><span className="text-right">Amount</span></div>
                <div className="px-4 py-3">
                  <div className="flex items-start justify-between gap-6">
                    <div className="min-w-0">
                      <p className="text-sm font-ui font-medium text-ink">{description}</p>
                      {detail && <p className="text-2xs font-body text-muted mt-0.5">{detail}{order.quantity > 1 ? ` · ${order.quantity} × ${formatCurrency(unit, order.currency)}` : ""}</p>}
                    </div>
                    <p className="text-sm font-body text-ink tabular-nums shrink-0">{formatCurrency(subtotal, order.currency)}</p>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-1.5">
                  {shipping > 0 && <MoneyRow label="Shipping" value={formatCurrency(shipping, order.currency)} />}
                  {discount > 0 && <MoneyRow label="Discount" value={`−${formatCurrency(discount, order.currency)}`} />}
                  {buyerFee > 0 && <MoneyRow label="Processing fee" value={formatCurrency(buyerFee, order.currency)} muted note="Covers card processing. Charged by PinkQuill, not the creator." />}
                  <MoneyRow strong label="Total paid" value={formatCurrency(total, order.currency)} />
                  {refundedListing > 0 && <MoneyRow label={refundedListing >= total ? "Refunded in full" : "Refunded"} value={`−${formatCurrency(refundedListing, order.currency)}`} />}
                </div>
              </div>
            </DocumentSection>

            <DocumentSection title="Payment">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm font-body">
                <div><p className="text-muted">Method</p><p className="text-ink font-ui">{order.payment_provider === "placeholder" || (payment && payment.amount_cents === 0) ? "No charge" : "Card via Stripe"}</p></div>
                <div><p className="text-muted">Charged</p><p className="text-ink font-ui tabular-nums">{chargedElsewhere ? `${formatCurrency(Number(order.charge_amount_cents) / 100, order.charge_currency!)} (${order.charge_currency!.toUpperCase()})` : formatCurrency(total, order.currency)}</p>{chargedElsewhere && order.fx_rate ? <p className="text-2xs text-muted">1 {order.currency.toUpperCase()} = {Number(order.fx_rate).toFixed(4)} {order.charge_currency!.toUpperCase()} on the day of payment</p> : null}</div>
                <div><p className="text-muted">Date</p><p className="text-ink font-ui">{longDateTime(paidAt ?? order.updated_at)}</p></div>
                <div><p className="text-muted">Reference</p><p className="text-ink font-ui tabular-nums break-all">{payment?.charge_id ?? payment?.payment_intent_id ?? order.payment_intent_id ?? order.order_number}</p></div>
              </div>
            </DocumentSection>

            {refunds.length > 0 && (
              <DocumentSection title="Refunds">
                <div className="space-y-2">
                  {refunds.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-6 text-sm font-body">
                      <div className="min-w-0">
                        <p className="text-ink font-ui">{r.kind === "full" ? "Full refund" : "Partial refund"} · {longDate(r.decided_at ?? r.created_at)}</p>
                        <p className="text-2xs text-muted">{r.reason ? `“${r.reason}” · ` : ""}Returned to the original card; banks take 5–10 business days to show it.</p>
                      </div>
                      <p className="tabular-nums shrink-0 text-ink">−{formatCurrency((r.listing_amount_cents ?? 0) / 100, r.listing_currency ?? order.currency)}{r.currency !== (r.listing_currency ?? order.currency) ? <span className="block text-2xs text-muted">{formatCurrency(r.amount_cents / 100, r.currency)} on the card</span> : null}</p>
                    </div>
                  ))}
                </div>
              </DocumentSection>
            )}

            <DocumentFooter>
              <p>PinkQuill is the merchant of record for this purchase. The creator is paid their share after the work is approved.</p>
              <p>Questions about this order? Message the creator from the order page: www.pinkquill.com/orders/{order.id}</p>
            </DocumentFooter>
          </>
        );
      })()}
    </DocumentShell>
  );
}
