"use client";

import Link from "next/link";
import { useState } from "react";
import { useAdminQuery } from "@/lib/hooks/useAdmin";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderStatusMeta } from "@/lib/utils/orderStatus";
import { Chip, dt, Empty, Panel, Rows, Skeleton } from "./ui";

interface Row {
  id: string; order_number: string; status: string; payment_status: string; listing_type: string; amount: number; total_amount: number | null; seller_amount: number; currency: string;
  created_at: string; due_date: string | null; completed_at: string | null; payment_intent_id: string | null; title: string | null;
  buyer: string | null; buyer_name: string | null; seller: string | null; seller_name: string | null; payout_status: string | null; open_refunds: number; open_disputes: number;
}

const STATUSES = ["", "pending_acceptance", "pending_payment", "paid", "in_progress", "revision_requested", "submitted", "delivered", "completed", "refund_requested", "disputed", "cancelled", "refunded", "declined", "expired", "resolved"];

export default function AdminOrders() {
  const [q, setQ] = useState("");
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("");
  const path = `/api/admin/orders?q=${encodeURIComponent(term)}&status=${encodeURIComponent(status)}&limit=100`;
  const { data, loading, error } = useAdminQuery<{ orders: Row[] }>(path);

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>
      <form onSubmit={(e) => { e.preventDefault(); setTerm(q.trim()); }} className="flex gap-2 flex-wrap">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Order number, listing, buyer, seller, payment intent or order id" className="flex-1 min-w-[240px] px-3.5 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="px-3 py-2.5 rounded-xl border border-border-light bg-surface text-sm font-body text-ink" aria-label="Status">
          {STATUSES.map((s) => <option key={s} value={s}>{s ? getOrderStatusMeta(s).label : "Any status"}</option>)}
        </select>
        <button type="submit" className="px-4 py-2.5 rounded-xl bg-purple-primary text-white text-sm font-ui font-semibold">Search</button>
      </form>
      {error && <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 text-sm font-body text-ink">{error}</div>}
      <Panel title={`${data?.orders.length ?? 0} order${data?.orders.length === 1 ? "" : "s"}`} right={<span className="text-2xs font-body text-muted">newest first · up to 100</span>}>
        {loading ? <Skeleton rows={4} /> : !data?.orders.length ? <Empty text="No orders match." /> : (
          <Rows>
            {data.orders.map((o) => (
              <div key={o.id} className="px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[150px_minmax(0,1fr)_150px_110px_90px_120px] gap-3 items-center text-sm">
                <div className="min-w-0">
                  <Link href={`/orders/${o.id}`} className="font-ui text-ink hover:text-purple-primary tabular-nums">{o.order_number}</Link>
                  <p className="text-2xs font-body text-muted">{dt(o.created_at)}</p>
                </div>
                <div className="min-w-0 hidden md:block">
                  <p className="font-ui text-ink truncate">{o.title ?? "—"}</p>
                  <p className="text-2xs font-body text-muted truncate">@{o.buyer ?? "?"} → @{o.seller ?? "?"} · {o.listing_type}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end md:justify-start">
                  <Chip label={getOrderStatusMeta(o.status).label} tone={getOrderStatusMeta(o.status).tone} />
                  {o.open_refunds > 0 && <Chip label="refund" tone="amber" />}
                  {o.open_disputes > 0 && <Chip label="dispute" tone="red" />}
                </div>
                <span className="hidden md:block text-2xs font-body text-muted">{o.payment_status.replace(/_/g, " ")}</span>
                <span className="hidden md:block tabular-nums text-ink text-right">{formatCurrency(Number(o.total_amount ?? o.amount), o.currency)}</span>
                <span className="hidden md:block text-2xs font-body text-muted">{o.payout_status ? `payout ${o.payout_status}` : ""}{o.payment_status === "paid" ? <> · <Link href={`/orders/${o.id}/receipt`} className="text-purple-primary hover:underline">receipt</Link></> : null}</span>
              </div>
            ))}
          </Rows>
        )}
      </Panel>
    </div>
  );
}
