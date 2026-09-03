"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerEarnings, useSellerOnboarding, useSellerPayouts, useSellerStatement, type SellerPayout } from "@/lib/hooks/usePayments";
import Button from "@/components/ui/Button";
import { formatCurrency } from "@/lib/utils/currency";
import { TONE_CLASSES, type StatusTone } from "@/lib/utils/orderStatus";
import { shortDate } from "@/components/orders/orderFormat";
import { PayoutBanner } from "./SellerDashboard";

/**
 * Earnings (Phase 3e): what is on the way, what was paid out, what is held,
 * plus the real payouts list and a per-order statement with the fee line.
 * Payout amounts are in the payout currency (CAD today); prices stay USD.
 */

const PAYOUT_STATUS: Record<SellerPayout["status"], { label: string; tone: StatusTone }> = {
  pending: { label: "On the way", tone: "purple" },
  processing: { label: "Sending", tone: "purple" },
  sent: { label: "Sent", tone: "emerald" },
  failed: { label: "Failed", tone: "red" },
  blocked: { label: "Held", tone: "amber" },
  reversed: { label: "Reversed", tone: "red" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

function chip(label: string, tone: StatusTone) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[tone].chip}`}>{label}</span>;
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-border-light bg-surface p-4 min-w-0">
      <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="font-display text-xl font-semibold text-ink mt-1 tabular-nums">{value}</p>
      {sub && <p className="text-2xs font-body text-muted mt-0.5 truncate">{sub}</p>}
    </div>
  );
}

function sumCents(list: SellerPayout[], statuses: SellerPayout["status"][]): { cents: number; currency: string; count: number } {
  const rows = list.filter((p) => statuses.includes(p.status));
  return { cents: rows.reduce((s, p) => s + p.amount_cents, 0), currency: rows[0]?.currency ?? list[0]?.currency ?? "cad", count: rows.length };
}

function csvEscape(v: string | number | null | undefined): string {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export default function EarningsOverview() {
  const { user } = useAuth();
  const { earnings, loading: earningsLoading } = useSellerEarnings(user?.id);
  const { payouts, loading: payoutsLoading } = useSellerPayouts(user?.id);
  const { rows, loading: rowsLoading } = useSellerStatement(user?.id);
  const { openDashboard, account, loading: accountLoading } = useSellerOnboarding();
  const connected = Boolean(account?.payouts_enabled) || accountLoading;

  const onTheWay = useMemo(() => sumCents(payouts, ["pending", "processing"]), [payouts]);
  const paidOut = useMemo(() => sumCents(payouts, ["sent"]), [payouts]);
  const held = useMemo(() => sumCents(payouts, ["blocked", "failed"]), [payouts]);

  const downloadCsv = () => {
    const header = ["Order", "Listing", "Ordered", "Approved", "Status", "Price (USD)", "Pinkquill fee (USD)", "You receive (USD)", "Payout status", "Payout amount", "Payout currency", "Payout sent"];
    const lines = rows.map((r) => [
      r.order_number, r.product?.title ?? "", r.created_at.slice(0, 10), r.completed_at?.slice(0, 10) ?? "", r.status,
      Number(r.amount).toFixed(2), Number(r.platform_fee).toFixed(2), Number(r.seller_amount).toFixed(2),
      r.payout?.status ?? "", r.payout ? (r.payout.amount_cents / 100).toFixed(2) : "", r.payout?.currency?.toUpperCase() ?? "", r.payout?.sent_at?.slice(0, 10) ?? "",
    ].map(csvEscape).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pinkquill-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (earningsLoading || accountLoading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-40 rounded bg-skeleton/60 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{[1, 2, 3, 4].map((i) => <div key={i} className="h-24 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
        <div className="h-48 rounded-2xl bg-skeleton/60 animate-pulse" />
      </div>
    );
  }

  const payoutSub = (p: SellerPayout) => {
    if (p.status === "sent") return `${p.sent_at ? shortDate(p.sent_at) : "sent"}${p.transfer_id ? ` · ${p.transfer_id.slice(0, 10)}…` : ""}`;
    if (p.status === "pending") return `releases ${shortDate(p.eligible_at)}`;
    if (p.status === "blocked") return p.block_reason === "dispute_open" ? "dispute open" : p.block_reason === "no_account" || p.block_reason === "onboarding" ? "connect payouts" : (p.block_reason ?? "held");
    if (p.status === "failed") return "Stripe couldn't pay this out; check your account";
    return "";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Earnings</h1>
        {connected && <Button variant="secondary" size="sm" onClick={openDashboard}>Open Stripe dashboard</Button>}
      </div>

      {!connected && <PayoutBanner />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label={connected ? "On the way" : "Waiting for payouts"} value={formatCurrency(onTheWay.cents / 100, onTheWay.currency)} sub={connected ? (onTheWay.count ? `${onTheWay.count} payout${onTheWay.count === 1 ? "" : "s"}` : "nothing pending") : "connect Stripe to receive"} />
        <Tile label="Paid out" value={formatCurrency(paidOut.cents / 100, paidOut.currency)} sub={paidOut.count ? `${paidOut.count} payout${paidOut.count === 1 ? "" : "s"}` : undefined} />
        <Tile label="Held" value={formatCurrency(held.cents / 100, held.currency)} sub={held.count ? `${held.count} needing attention` : undefined} />
        <Tile label="Earned" value={formatCurrency(earnings?.total_earned ?? 0)} sub={`${earnings?.completed_orders ?? 0} approved order${(earnings?.completed_orders ?? 0) === 1 ? "" : "s"}`} />
      </div>

      <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
          <h2 className="font-display text-sm font-semibold text-ink">Payouts</h2>
          <p className="text-2xs font-body text-muted">Released 7 days after approval, then paid to your bank on Stripe&apos;s schedule. Open one for its statement.</p>
        </div>
        {payoutsLoading ? (
          <div className="h-24 bg-skeleton/40 animate-pulse" />
        ) : payouts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-body text-muted">No payouts yet. The first one is created when an order is approved.</div>
        ) : (
          <div className="divide-y divide-border-light">
            {payouts.map((p) => {
              const st = PAYOUT_STATUS[p.status];
              return (
                <Link key={p.id} href={`/seller/payouts/${p.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[minmax(0,1fr)_120px_120px_200px] gap-3 px-4 py-3 items-center hover:bg-subtle transition-colors">
                  <div className="min-w-0">
                    <p className="text-sm font-ui text-ink truncate">{p.order?.product?.title || p.order?.order_number || "Order"}</p>
                    <p className="text-2xs font-body text-muted tabular-nums">{p.order?.order_number}<span className="md:hidden"> · {payoutSub(p)}</span></p>
                  </div>
                  <span className="hidden md:inline text-sm font-ui font-semibold text-ink tabular-nums">{formatCurrency(p.amount_cents / 100, p.currency)}</span>
                  <span className="flex items-center gap-2 justify-end md:justify-start">{chip(st.label, st.tone)}<span className="md:hidden text-sm font-ui font-semibold text-ink tabular-nums">{formatCurrency(p.amount_cents / 100, p.currency)}</span></span>
                  <span className="hidden md:inline text-2xs font-body text-muted truncate">{payoutSub(p)}</span>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
          <h2 className="font-display text-sm font-semibold text-ink">Statement</h2>
          {rows.length > 0 && <button type="button" onClick={downloadCsv} className="text-xs font-ui font-semibold text-purple-primary hover:underline">Download CSV</button>}
        </div>
        {rowsLoading ? (
          <div className="h-24 bg-skeleton/40 animate-pulse" />
        ) : rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-body text-muted">No paid orders yet.</div>
        ) : (
          <>
            <div className="hidden md:grid grid-cols-[76px_minmax(0,1fr)_84px_84px_96px_120px] gap-3 px-4 py-2 bg-subtle text-2xs font-ui uppercase tracking-[0.12em] text-muted">
              <span>Ordered</span><span>Order</span><span className="text-right">Price</span><span className="text-right">Fee 5%</span><span className="text-right">You receive</span><span>Payout</span>
            </div>
            <div className="divide-y divide-border-light">
              {rows.map((r) => {
                const payoutText = r.payout
                  ? r.payout.status === "sent" ? `Sent ${r.payout.sent_at ? shortDate(r.payout.sent_at) : ""}` : PAYOUT_STATUS[r.payout.status as SellerPayout["status"]]?.label ?? r.payout.status
                  : r.status === "completed" ? "Scheduling" : r.status === "refunded" || r.status === "cancelled" ? "Refunded" : "After approval";
                return (
                  <Link key={r.id} href={`/orders/${r.id}`} className="block px-4 py-3 hover:bg-subtle transition-colors">
                    <div className="md:hidden">
                      <div className="flex justify-between gap-3"><span className="text-sm font-ui text-ink tabular-nums">{r.order_number}</span><span className="text-sm font-ui font-semibold text-ink tabular-nums">{formatCurrency(r.seller_amount, r.currency)}</span></div>
                      <p className="text-2xs font-body text-muted mt-0.5 truncate">{shortDate(r.created_at)} · price {formatCurrency(r.amount, r.currency)} · fee {formatCurrency(r.platform_fee, r.currency)} · {payoutText}</p>
                    </div>
                    <div className="hidden md:grid grid-cols-[76px_minmax(0,1fr)_84px_84px_96px_120px] gap-3 items-center text-sm font-body">
                      <span className="text-muted">{shortDate(r.created_at)}</span>
                      <span className="min-w-0"><span className="block font-ui text-ink truncate">{r.product?.title || "Order"}</span><span className="block text-2xs text-muted tabular-nums">{r.order_number}</span></span>
                      <span className="text-right tabular-nums text-ink">{formatCurrency(r.amount, r.currency)}</span>
                      <span className="text-right tabular-nums text-muted">−{formatCurrency(r.platform_fee, r.currency)}</span>
                      <span className="text-right tabular-nums font-ui font-semibold text-ink">{formatCurrency(r.seller_amount, r.currency)}</span>
                      <span className="text-2xs text-muted truncate">{payoutText}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
