"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrderList } from "@/lib/hooks/useOrders";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import type { Order, OrderFilters, OrderStatus } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderStatusMeta, TONE_CLASSES } from "@/lib/utils/orderStatus";
import { relativeDays, shortDate, shortDateTime } from "@/components/orders/orderFormat";

/**
 * Seller orders (Phase 3e): search across order number / listing / buyer,
 * status chips that filter on the server, and a Due column so late work is
 * visible without opening each order.
 */

const ACTIVE: OrderStatus[] = ["paid", "processing", "in_progress", "revision_requested", "shipped"];

const CHIPS: Array<{ key: string; label: string; filters: OrderFilters }> = [
  { key: "all", label: "All", filters: {} },
  { key: "reply", label: "Needs reply", filters: { status: ["pending_acceptance", "refund_requested"] } },
  { key: "active", label: "Active", filters: { status: ACTIVE, sort: "due" } },
  { key: "late", label: "Late", filters: { status: ["paid", "in_progress", "revision_requested"], sort: "due" } },
  { key: "delivered", label: "Delivered", filters: { status: ["submitted", "delivered"] } },
  { key: "approved", label: "Approved", filters: { status: ["completed"] } },
  { key: "closed", label: "Closed", filters: { status: ["cancelled", "declined", "refunded", "expired", "resolved", "disputed"] } },
];

/** What the Due column says for one order. */
export function dueCell(order: Order): { text: string; sub?: string; late: boolean } {
  switch (order.status) {
    case "pending_acceptance":
      return order.seller_response_deadline ? { text: `Reply by ${shortDateTime(order.seller_response_deadline)}`, late: true } : { text: "Needs your reply", late: true };
    case "pending_payment":
      return { text: "Awaiting payment", late: false };
    case "submitted":
    case "delivered":
      return order.auto_completion_at ? { text: `Auto-approves ${shortDate(order.auto_completion_at)}`, sub: relativeDays(order.auto_completion_at).text, late: false } : { text: "Awaiting approval", late: false };
    case "completed":
      return { text: order.completed_at ? `Approved ${shortDate(order.completed_at)}` : "Approved", late: false };
    case "refund_requested":
      return { text: "Refund request", sub: "needs your answer", late: true };
    case "disputed":
      return { text: "Dispute open", late: true };
    default: {
      if (!order.due_date || !ACTIVE.includes(order.status)) return { text: "—", late: false };
      const rel = relativeDays(order.due_date);
      return { text: shortDate(order.due_date), sub: rel.text, late: rel.late };
    }
  }
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function SellerOrderRow({ order }: { order: Order }) {
  const meta = getOrderStatusMeta(order.status);
  const due = dueCell(order);
  const buyer = order.buyer?.display_name || order.buyer?.username || "Buyer";
  return (
    <Link href={`/orders/${order.id}`} className="block px-4 py-3 hover:bg-subtle transition-colors">
      <div className="grid grid-cols-[32px_minmax(0,1fr)_auto] md:grid-cols-[32px_minmax(0,1fr)_170px_140px_96px] items-center gap-3 md:gap-4">
        <Avatar src={order.buyer?.avatar_url} alt="" size={32} />
        <div className="min-w-0">
          <p className="text-sm font-ui font-medium text-ink truncate">{order.product?.title || "Order"}</p>
          <p className="text-2xs font-body text-muted truncate">@{order.buyer?.username || buyer} · <span className="tabular-nums">{order.order_number}</span></p>
          <div className="mt-1.5 flex items-center gap-2 flex-wrap md:hidden">
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[meta.tone].chip}`}>{meta.label}</span>
            <span className={`text-2xs font-ui ${due.late ? "text-amber-700 font-semibold" : "text-muted"}`}>{due.text}{due.sub ? ` · ${due.sub}` : ""}</span>
          </div>
        </div>
        <div className="hidden md:block min-w-0">
          <p className={`text-xs font-ui truncate ${due.late ? "text-amber-700 font-semibold" : "text-ink"}`}>{due.text}</p>
          {due.sub && <p className={`text-2xs font-body ${due.late ? "text-amber-700" : "text-muted"}`}>{due.sub}</p>}
        </div>
        <div className="hidden md:block"><span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[meta.tone].chip}`}>{meta.label}</span></div>
        <span className="text-sm font-ui font-semibold text-ink tabular-nums text-right">{formatCurrency(order.seller_amount, order.currency)}</span>
      </div>
    </Link>
  );
}

export default function SellerOrdersTable() {
  const { user } = useAuth();
  const [chip, setChip] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "due">("newest");
  const debounced = useDebounced(search, 300);

  const filters = useMemo<OrderFilters>(() => {
    const base = CHIPS.find((c) => c.key === chip)?.filters ?? {};
    const f: OrderFilters = { ...base, search: debounced || undefined, sort: base.sort ?? sort };
    if (chip === "late") f.due_before = new Date().toISOString();
    return f;
  }, [chip, debounced, sort]);

  const { orders, loading, error, hasMore, loadMore } = useOrderList({ role: "seller", userId: user?.id, filters, pageSize: 20 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold text-ink">Orders</h1>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <label className="flex-1 relative">
          <span className="sr-only">Search orders</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search orders, listings, buyers"
            className="w-full h-10 rounded-full border border-border-light bg-surface pl-4 pr-4 text-sm font-body text-ink placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-purple-primary/25"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "newest" | "due")}
          aria-label="Sort"
          className="h-10 rounded-full border border-border-light bg-surface px-4 text-sm font-ui text-ink focus:outline-none focus:ring-2 focus:ring-purple-primary/25"
        >
          <option value="newest">Newest</option>
          <option value="due">Due first</option>
        </select>
      </div>

      <div className="flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" role="tablist" aria-label="Order status">
        {CHIPS.map((c) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={chip === c.key}
            onClick={() => setChip(c.key)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-ui font-medium transition-colors ${chip === c.key ? "bg-pink-vivid/10 text-pink-vivid" : "text-muted bg-surface border border-border-light hover:text-ink"}`}
          >
            {c.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-border-light bg-surface overflow-hidden">
        <div className="hidden md:grid grid-cols-[32px_minmax(0,1fr)_170px_140px_96px] gap-4 px-4 py-2 border-b border-border-light bg-subtle text-xs font-ui text-muted">
          <span /><span>Order</span><span>Due</span><span>Status</span><span className="text-right">You receive</span>
        </div>
        {loading ? (
          <div className="divide-y divide-border-light">{[1, 2, 3, 4].map((i) => <div key={i} className="h-16 bg-skeleton/40 animate-pulse" />)}</div>
        ) : error ? (
          <div className="p-10 text-center"><p className="font-body text-sm text-red-600">Couldn&apos;t load orders. Refresh to try again.</p></div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-body text-sm text-muted">{debounced ? `Nothing matches “${debounced}”.` : chip === "all" ? "No orders yet. They appear here as soon as someone requests or buys." : `No ${CHIPS.find((c) => c.key === chip)?.label.toLowerCase()} orders.`}</p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-border-light">{orders.map((o) => <SellerOrderRow key={o.id} order={o} />)}</div>
            {hasMore && (
              <div className="p-3 text-center border-t border-border-light">
                <Button variant="secondary" size="sm" onClick={loadMore}>Load more</Button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
