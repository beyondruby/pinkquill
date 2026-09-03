"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerOrders, usePendingAcceptanceOrders } from "@/lib/hooks/useOrders";
import { useSellerEarnings, useSellerOnboarding, useSellerPayouts } from "@/lib/hooks/usePayments";
import Button from "@/components/ui/Button";
import type { Order, OrderStatus } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { shortDate } from "@/components/orders/orderFormat";
import { SellerOrderRow } from "./SellerOrdersTable";
import PendingOrderCard from "./PendingOrderCard";

/**
 * Seller dashboard (Phase 3e). Works before Stripe is connected: the old
 * gate read `charges_enabled` (wrong for a transfers-only account) and
 * dead-ended; now a banner asks for payouts while everything else runs.
 */

const WORKING: OrderStatus[] = ["paid", "in_progress", "revision_requested", "processing", "shipped", "submitted", "delivered"];
const DAY = 86_400_000;

export function PayoutBanner() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-ui font-semibold text-ink">Connect payouts to get paid</p>
        <p className="text-xs font-body text-muted mt-0.5">Orders, listings and messages work now. Earnings wait in Pinkquill&apos;s balance until a Stripe account is connected; a payout releases 7 days after an order is approved.</p>
      </div>
      <Link href="/seller/settings#payouts" className="shrink-0"><Button>Connect payouts</Button></Link>
    </div>
  );
}

function Tile({ label, value, sub, tone, href }: { label: string; value: string; sub?: string; tone?: "amber"; href?: string }) {
  const inner = (
    <>
      <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`font-display text-xl font-semibold mt-1 tabular-nums ${tone === "amber" ? "text-amber-700" : "text-ink"}`}>{value}</p>
      {sub && <p className="text-2xs font-body text-muted mt-0.5 truncate">{sub}</p>}
    </>
  );
  const cls = "rounded-2xl border border-border-light bg-surface p-4 min-w-0 block";
  return href ? <Link href={href} className={`${cls} hover:border-border-strong transition-colors`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}

/** Orders sorted by what needs the seller first: replies, late, due soon, awaiting approval. */
function urgency(o: Order, now: number): number {
  if (o.status === "pending_acceptance" || o.status === "refund_requested" || o.status === "disputed") return 0;
  if (o.due_date && ["paid", "in_progress", "revision_requested"].includes(o.status)) {
    const t = new Date(o.due_date).getTime();
    if (t < now) return 1;
    return 2 + (t - now) / DAY / 1000;
  }
  if (o.status === "submitted" || o.status === "delivered") return 3;
  return 4;
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const { earnings } = useSellerEarnings(user?.id);
  const { payouts } = useSellerPayouts(user?.id);
  const { orders: pendingOrders, count: pendingCount } = usePendingAcceptanceOrders(user?.id);
  const { orders: working, loading: workingLoading } = useSellerOrders(user?.id, { status: WORKING, sort: "due" }, 50);
  const { account, loading: accountLoading } = useSellerOnboarding();
  const connected = Boolean(account?.payouts_enabled);

  // Captured once per mount; the tiles compare due dates against it.
  const [now] = useState(() => Date.now());
  const stats = useMemo(() => {
    const active = working.filter((o) => o.due_date && ["paid", "in_progress", "revision_requested"].includes(o.status));
    const late = active.filter((o) => new Date(o.due_date!).getTime() < now);
    const week = active.filter((o) => { const t = new Date(o.due_date!).getTime(); return t >= now && t < now + 7 * DAY; });
    const awaiting = working.filter((o) => o.status === "submitted" || o.status === "delivered");
    return { late, week, awaiting };
  }, [working, now]);

  const attention = useMemo(() => {
    const all = [...pendingOrders, ...working];
    const seen = new Set<string>();
    return all.filter((o) => (seen.has(o.id) ? false : (seen.add(o.id), true))).sort((a, b) => urgency(a, now) - urgency(b, now)).slice(0, 6);
  }, [pendingOrders, working, now]);

  const onTheWay = payouts.filter((p) => p.status === "pending" || p.status === "processing");
  const paidOut = payouts.filter((p) => p.status === "sent");
  const cents = (list: typeof payouts) => list.reduce((s, p) => s + p.amount_cents, 0);
  const cur = payouts[0]?.currency ?? "cad";
  const nextRelease = onTheWay.map((p) => p.eligible_at).sort()[0];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Dashboard</h1>
      </div>

      {!accountLoading && !connected && <PayoutBanner />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Tile label="Needs your reply" value={String(pendingCount)} sub={pendingOrders[0]?.seller_response_deadline ? `reply by ${shortDate(pendingOrders[0].seller_response_deadline)}` : pendingCount ? "requests waiting" : "no open requests"} tone={pendingCount ? "amber" : undefined} href="/seller/orders" />
        <Tile label="Due this week" value={String(stats.week.length)} sub={stats.week[0] ? `${stats.week[0].product?.title ?? "Order"} · ${shortDate(stats.week[0].due_date!)}` : "nothing due"} href="/seller/orders" />
        <Tile label="Late" value={String(stats.late.length)} sub={stats.late[0] ? `${stats.late[0].product?.title ?? "Order"} · due ${shortDate(stats.late[0].due_date!)}` : "all on time"} tone={stats.late.length ? "amber" : undefined} href="/seller/orders" />
        <Tile label="Awaiting approval" value={String(stats.awaiting.length)} sub={stats.awaiting[0]?.auto_completion_at ? `auto-approves ${shortDate(stats.awaiting[0].auto_completion_at)}` : "nothing delivered yet"} href="/seller/orders" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Tile label={connected || accountLoading ? "On the way" : "Waiting for payouts"} value={formatCurrency(cents(onTheWay) / 100, cur)} sub={nextRelease ? `releases ${shortDate(nextRelease)}` : connected || accountLoading ? "nothing pending" : "connect Stripe to receive"} href="/seller/earnings" />
        <Tile label="Paid out" value={formatCurrency(cents(paidOut) / 100, cur)} sub={paidOut.length ? `${paidOut.length} payout${paidOut.length === 1 ? "" : "s"}` : undefined} href="/seller/earnings" />
        <Tile label="Earned" value={formatCurrency(earnings?.total_earned ?? 0)} sub={`${earnings?.completed_orders ?? 0} approved order${(earnings?.completed_orders ?? 0) === 1 ? "" : "s"}`} href="/seller/earnings" />
      </div>

      {pendingOrders.length > 0 && (
        <section className="space-y-2">
          <h2 className="font-display text-sm font-semibold text-ink">Requests waiting for you</h2>
          {pendingOrders.map((o) => <PendingOrderCard key={o.id} order={o} />)}
        </section>
      )}

      <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
          <h2 className="font-display text-sm font-semibold text-ink">Needs your attention</h2>
          <Link href="/seller/orders" className="text-xs font-ui font-semibold text-purple-primary hover:underline">All orders</Link>
        </div>
        {workingLoading ? (
          <div className="divide-y divide-border-light">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-skeleton/40 animate-pulse" />)}</div>
        ) : attention.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-body text-muted">Nothing in progress. New requests and orders show up here.</div>
        ) : (
          <div className="divide-y divide-border-light">{attention.map((o) => <SellerOrderRow key={o.id} order={o} />)}</div>
        )}
      </section>

      <div className="flex gap-2 flex-wrap">
        <Link href="/sell/service"><Button>Add a service</Button></Link>
        <Link href="/sell"><Button variant="secondary">Add a product</Button></Link>
      </div>
    </div>
  );
}
