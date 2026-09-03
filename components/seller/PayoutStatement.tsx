"use client";

import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { usePayoutStatement, useOrderMoneyRecords } from "@/lib/hooks/useOrderDocuments";
import { formatCurrency } from "@/lib/utils/currency";
import { TONE_CLASSES, type StatusTone } from "@/lib/utils/orderStatus";
import { DocumentFooter, DocumentHeader, DocumentParty, DocumentSection, DocumentShell, MoneyRow } from "@/components/documents/DocumentShell";

/**
 * Payout statement (Phase 2e): one payout, the order behind it, the fee line,
 * the conversion into the payout currency and the dates it moved on.
 */

const STATUS: Record<string, { label: string; tone: StatusTone; sentence: string }> = {
  pending: { label: "On the way", tone: "purple", sentence: "Releases 7 days after the order was approved, then goes to your Stripe account." },
  processing: { label: "Sending", tone: "purple", sentence: "The transfer to your Stripe account is in progress." },
  sent: { label: "Sent", tone: "emerald", sentence: "Transferred to your Stripe account. Stripe pays your bank on its schedule." },
  failed: { label: "Failed", tone: "red", sentence: "Stripe could not complete the transfer. Check your account in Seller settings; PinkQuill retries once it is fixed." },
  blocked: { label: "Held", tone: "amber", sentence: "Held until the reason below is cleared." },
  reversed: { label: "Reversed", tone: "red", sentence: "Reclaimed after a refund or a lost dispute." },
  cancelled: { label: "Cancelled", tone: "neutral", sentence: "This payout was cancelled; the order was refunded before release." },
};

const BLOCK_REASON: Record<string, string> = {
  dispute_open: "A dispute or chargeback is open on this order.",
  no_account: "No Stripe account is connected yet. Connect payouts in Seller settings.",
  onboarding: "Your Stripe account isn't finished. Continue setup in Seller settings.",
  payouts_disabled: "Stripe has paused payouts on your account. Open the Stripe dashboard to see what it needs.",
};

function longDate(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export default function PayoutStatement({ payoutId }: { payoutId: string }) {
  const { user } = useAuth();
  const { payout, loading, error } = usePayoutStatement(payoutId);
  const money = useOrderMoneyRecords(payout?.order_id);
  const docError = error ? "You can only open statements for your own payouts." : payout && user && payout.seller_id !== user.id ? "You can only open statements for your own payouts." : null;

  return (
    <DocumentShell backHref="/seller/earnings" backLabel="Back to earnings" eyebrow="Payout statement" loading={loading || (Boolean(payout) && money.loading)} error={docError} returnTo={`/seller/payouts/${payoutId}`}>
      {payout && (() => {
        const o = payout.order;
        const st = STATUS[payout.status] ?? STATUS.pending;
        const shipping = Number(o.shipping_cost || 0);
        const original = Number(o.original_amount ?? o.amount);
        const discount = Number(o.discount_amount || 0);
        const price = Math.max(original - shipping, 0);
        const buyerFee = Number(o.buyer_fee || 0);
        const buyerTotal = Number(o.total_amount ?? o.amount);
        const listingCurrency = payout.listing_currency ?? o.currency;
        const converted = payout.currency !== listingCurrency;
        const refunds = money.refunds.filter((r) => r.status === "succeeded");
        const reversed = Number(payout.reversed_cents || 0);
        const timeline: Array<[string, string | null]> = [
          ["Order paid", money.paidAt],
          ["Approved", o.completed_at],
          [payout.status === "sent" ? "Released" : "Releases", payout.eligible_at],
          ...(payout.sent_at ? [["Sent", payout.sent_at] as [string, string | null]] : []),
        ];

        return (
          <>
            <DocumentHeader title="Payout statement" number={`Payout ${payout.id.slice(0, 8)} · ${o.order_number}`} right={<>
              <p><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[st.tone].chip}`}>{st.label}</span></p>
              <p className="font-display text-xl font-semibold text-ink tabular-nums mt-1">{formatCurrency(payout.amount_cents / 100, payout.currency)}</p>
              <p>{payout.sent_at ? `Sent ${longDate(payout.sent_at)}` : payout.status === "pending" ? `Releases ${longDate(payout.eligible_at)}` : ""}</p>
            </>} />

            <p className="text-sm font-body text-muted mt-5">{st.sentence}{payout.status === "blocked" && payout.block_reason ? ` ${BLOCK_REASON[payout.block_reason] ?? payout.block_reason}` : ""}{payout.status === "failed" && payout.last_error ? ` Stripe said: “${payout.last_error}”.` : ""}</p>

            <div className="grid grid-cols-2 gap-6 mt-6">
              <DocumentParty label="Paid to" name={user?.email ?? "You"} sub={payout.destination_account_id ? `Stripe ${payout.destination_account_id}` : "Stripe account"} />
              <DocumentParty label="Buyer" name={o.buyer?.display_name || o.buyer?.username || "Buyer"} sub={o.buyer?.username ? `@${o.buyer.username}` : null} />
            </div>

            <DocumentSection title="Order">
              <div className="rounded-xl border border-border-light overflow-hidden">
                <div className="px-4 py-3 flex items-start justify-between gap-6">
                  <div className="min-w-0">
                    <Link href={`/orders/${o.id}`} className="text-sm font-ui font-medium text-ink hover:text-purple-primary">{o.product?.title ?? "Order"}</Link>
                    <p className="text-2xs font-body text-muted mt-0.5 tabular-nums">{o.order_number} · ordered {longDate(o.created_at)}{o.completed_at ? ` · approved ${longDate(o.completed_at)}` : ""}</p>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-1.5">
                  <MoneyRow label="Listing price" value={formatCurrency(price, listingCurrency)} />
                  {shipping > 0 && <MoneyRow label="Shipping" value={formatCurrency(shipping, listingCurrency)} />}
                  {discount > 0 && <MoneyRow label="Promo discount" value={`−${formatCurrency(discount, listingCurrency)}`} note="Discounts come out of PinkQuill's side, not yours." muted />}
                  <MoneyRow label="PinkQuill fee · 5%" value={`−${formatCurrency(Number(o.platform_fee), listingCurrency)}`} muted />
                  <MoneyRow strong label="You receive" value={formatCurrency(Number(o.seller_amount), listingCurrency)} />
                  {buyerFee > 0 && <MoneyRow label="Buyer paid" value={formatCurrency(buyerTotal, listingCurrency)} muted note={`Includes a ${formatCurrency(buyerFee, listingCurrency)} processing fee that goes to PinkQuill.`} />}
                </div>
              </div>
            </DocumentSection>

            <DocumentSection title="Payout">
              <div className="space-y-1.5">
                {converted && (
                  <MoneyRow label={`Converted to ${payout.currency.toUpperCase()}`} value={formatCurrency((payout.listing_amount_cents ?? Math.round(Number(o.seller_amount) * 100)) / 100, listingCurrency)} note={o.fx_rate ? `1 ${listingCurrency.toUpperCase()} = ${Number(o.fx_rate).toFixed(4)} ${payout.currency.toUpperCase()} on the day the buyer paid` : "At the rate on the day the buyer paid"} muted />
                )}
                {reversed > 0 && <MoneyRow label="Reversed" value={`−${formatCurrency(reversed / 100, payout.currency)}`} note="Reclaimed after a refund or a lost dispute." />}
                <MoneyRow strong label={payout.status === "sent" ? "Paid out" : "Payout"} value={formatCurrency(Math.max(payout.amount_cents - reversed, 0) / 100, payout.currency)} />
              </div>
              {payout.transfer_id && <p className="text-2xs font-body text-muted mt-3 tabular-nums">Stripe transfer {payout.transfer_id}</p>}
            </DocumentSection>

            {refunds.length > 0 && (
              <DocumentSection title="Refunds on this order">
                <div className="space-y-2">
                  {refunds.map((r) => (
                    <div key={r.id} className="flex items-start justify-between gap-6 text-sm font-body">
                      <div className="min-w-0"><p className="text-ink font-ui">{r.kind === "full" ? "Full refund" : "Partial refund"} · {longDate(r.decided_at ?? r.created_at)}</p>{r.reason && <p className="text-2xs text-muted">“{r.reason}”</p>}</div>
                      <p className="tabular-nums shrink-0 text-ink">−{formatCurrency((r.listing_amount_cents ?? 0) / 100, r.listing_currency ?? listingCurrency)}{r.seller_share_cents != null ? <span className="block text-2xs text-muted">your share {formatCurrency(r.seller_share_cents / 100, r.currency)}</span> : null}</p>
                    </div>
                  ))}
                </div>
              </DocumentSection>
            )}

            <DocumentSection title="Timeline">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm font-body">
                {timeline.map(([k, v]) => (
                  <div key={k}><p className="text-muted">{k}</p><p className="text-ink font-ui">{v ? longDate(v) : "—"}</p></div>
                ))}
              </div>
            </DocumentSection>

            <DocumentFooter>
              <p>Payouts settle in {payout.currency.toUpperCase()} to your connected Stripe account; Stripe pays your bank on its own schedule. Prices and fees are shown in the listing currency.</p>
              <p>Every payout and its order are listed under Seller studio → Earnings: www.pinkquill.com/seller/earnings</p>
            </DocumentFooter>
          </>
        );
      })()}
    </DocumentShell>
  );
}
