"use client";

import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerAnalytics, type SellerAnalytics as Analytics } from "@/lib/hooks/useSellerAnalytics";
import { formatCurrency } from "@/lib/utils/currency";
import MetricCard from "@/components/ui/MetricCard";

/**
 * Seller analytics (Phase 2e): revenue over time, conversion, on-time rate,
 * response time (measured from real message timestamps) and repeat buyers.
 * One RPC, three windows, no client-side aggregation.
 */

const WINDOWS = [{ days: 30, label: "30 days" }, { days: 90, label: "90 days" }, { days: 365, label: "12 months" }];

function pct(rate: number | null | undefined): string {
  return rate == null ? "—" : `${Math.round(rate * 100)}%`;
}

function hours(h: number | null | undefined): string {
  if (h == null) return "—";
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round(h / 24)} days`;
}

function delta(now: number, before: number): { text: string; tone: "up" | "down" | "flat" } | null {
  if (!before) return now ? { text: "new", tone: "up" } : null;
  const change = (now - before) / before;
  if (Math.abs(change) < 0.005) return { text: "same as before", tone: "flat" };
  return { text: `${change > 0 ? "+" : ""}${Math.round(change * 100)}% vs previous`, tone: change > 0 ? "up" : "down" };
}

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; payload: { orders: number; gross: number } }>; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="bg-surface px-3 py-2 rounded-xl shadow-lg border border-border-light text-sm font-body">
      <p className="font-ui font-medium text-ink">Week of {label}</p>
      <p className="text-muted"><span className="text-purple-primary font-medium">{formatCurrency(p.value)}</span> to you · {formatCurrency(p.payload.gross)} gross · {p.payload.orders} order{p.payload.orders === 1 ? "" : "s"}</p>
    </div>
  );
}

function weekLabel(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function Funnel({ c }: { c: Analytics["conversion"] }) {
  const rows: Array<[string, number, string]> = [
    ["Requests", c.requests, "orders started in this window"],
    ["Paid", c.paid, "went through checkout"],
    ["Waiting", c.waiting, "still to accept or pay"],
    ["Declined", c.declined, "you turned down"],
    ["Expired", c.expired, "checkout not completed"],
    ["Cancelled before paying", c.cancelled_unpaid, ""],
  ];
  const max = Math.max(c.requests, 1);
  return (
    <div className="space-y-2.5">
      {rows.filter(([, n], i) => i < 2 || n > 0).map(([label, n, hint]) => (
        <div key={label}>
          <div className="flex items-baseline justify-between gap-3 text-sm font-body"><span className="text-ink font-ui">{label}</span><span className="tabular-nums text-ink">{n}<span className="text-muted text-2xs ml-1.5">{hint}</span></span></div>
          <div className="h-1.5 rounded-full bg-subtle mt-1 overflow-hidden"><div className={`h-full rounded-full ${label === "Paid" ? "bg-purple-primary" : "bg-border-strong"}`} style={{ width: `${Math.max((n / max) * 100, n ? 2 : 0)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

export default function SellerAnalytics() {
  const { user } = useAuth();
  const [days, setDays] = useState(90);
  const { data, loading, error } = useSellerAnalytics(user?.id, days);

  const net = data?.totals.net ?? 0;
  const netDelta = data ? delta(Number(data.totals.net), Number(data.previous.net)) : null;
  const ordersDelta = data ? delta(data.totals.paid_orders, data.previous.paid_orders) : null;
  const chart = (data?.revenue_by_week ?? []).map((w) => ({ ...w, label: weekLabel(w.week), net: Number(w.net), gross: Number(w.gross) }));
  const hasSales = (data?.totals.paid_orders ?? 0) > 0;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="font-display text-2xl font-semibold text-ink">Analytics</h1>
        <div className="flex gap-1.5" role="tablist" aria-label="Window">
          {WINDOWS.map((w) => (
            <button key={w.days} type="button" role="tab" aria-selected={days === w.days} onClick={() => setDays(w.days)}
              className={`px-3 py-1.5 rounded-full border text-xs font-ui font-semibold transition-colors ${days === w.days ? "bg-purple-primary/10 border-purple-primary/40 text-purple-800" : "bg-surface border-border-light text-muted hover:text-ink hover:border-border-strong"}`}>
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">Couldn&apos;t load analytics. {error}</div>}

      {loading || !data ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">{[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-24 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
          <div className="h-64 rounded-2xl bg-skeleton/60 animate-pulse" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <MetricCard label="To you" value={formatCurrency(net)} sub={netDelta?.text ?? (hasSales ? null : "no sales in this window")} subTone={netDelta?.tone} />
            <MetricCard label="Paid orders" value={String(data.totals.paid_orders)} sub={ordersDelta?.text ?? (data.totals.buyers ? `${data.totals.buyers} buyer${data.totals.buyers === 1 ? "" : "s"}` : null)} subTone={ordersDelta?.tone} />
            <MetricCard label="Requests → paid" value={pct(data.conversion.rate)} sub={data.conversion.requests ? `${data.conversion.paid} of ${data.conversion.requests} requests` : "no requests yet"} />
            <MetricCard label="On time" value={pct(data.on_time.rate)} sub={data.on_time.delivered ? `${data.on_time.on_time} of ${data.on_time.delivered} deliveries${data.on_time.avg_days_early > 0 ? ` · ${data.on_time.avg_days_early} days early on average` : ""}` : "no commissions delivered yet"} />
            <MetricCard label="First reply" value={hours(data.response.median_hours)} sub={data.response.asked ? `${pct(data.response.rate_24h)} within a day · ${data.response.answered} of ${data.response.asked} answered` : "no buyer messages yet"} />
            <MetricCard label="Repeat buyers" value={pct(data.repeat.rate)} sub={data.repeat.buyers ? `${data.repeat.repeat_buyers} of ${data.repeat.buyers} came back · all time` : "no buyers yet"} />
          </div>

          <section className="rounded-2xl border border-border-light bg-surface p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 className="font-display text-sm font-semibold text-ink">Revenue by week</h2>
              <p className="text-2xs font-body text-muted">What reaches you after the 5% fee · {formatCurrency(Number(data.totals.gross))} gross · {formatCurrency(Number(data.totals.fees))} fees{Number(data.totals.refunded) > 0 ? ` · ${formatCurrency(Number(data.totals.refunded))} refunded` : ""}</p>
            </div>
            {hasSales ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chart} margin={{ top: 4, right: 4, left: -12, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-light)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} width={52} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: "var(--color-subtle)" }} />
                  <Bar dataKey="net" fill="var(--color-purple-primary)" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-40 flex items-center justify-center text-sm font-body text-muted">No paid orders in the last {data.window_days} days. Sales show up here the day they are paid.</div>
            )}
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <section className="rounded-2xl border border-border-light bg-surface p-4 sm:p-5">
              <h2 className="font-display text-sm font-semibold text-ink mb-3">Requests to paid orders</h2>
              {data.conversion.requests ? <Funnel c={data.conversion} /> : <p className="text-sm font-body text-muted">No requests in this window.</p>}
            </section>
            <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
              <div className="px-4 sm:px-5 py-3 border-b border-border-light flex items-center justify-between gap-3">
                <h2 className="font-display text-sm font-semibold text-ink">By listing</h2>
                <Link href="/seller/listings" className="text-xs font-ui font-semibold text-purple-primary hover:underline">Listings</Link>
              </div>
              {data.by_listing.length === 0 ? (
                <p className="px-4 sm:px-5 py-6 text-sm font-body text-muted">Nothing sold in this window.</p>
              ) : (
                <div className="divide-y divide-border-light">
                  {data.by_listing.map((l) => (
                    <div key={l.product_id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 px-4 sm:px-5 py-3 items-center text-sm font-body">
                      <div className="min-w-0"><p className="font-ui text-ink truncate">{l.title ?? "Listing"}</p><p className="text-2xs text-muted">{l.orders} order{l.orders === 1 ? "" : "s"} · {formatCurrency(Number(l.gross))} gross</p></div>
                      <span className="tabular-nums font-ui font-semibold text-ink">{formatCurrency(Number(l.net))}</span>
                      <span className="text-2xs text-muted">to you</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
