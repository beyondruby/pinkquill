"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerOrders } from "@/lib/hooks/useOrders";
import type { Order, OrderStatus } from "@/lib/types/store";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const STATUS_TABS: { label: string; value: OrderStatus | "all"; icon: React.ReactNode }[] = [
  {
    label: "All",
    value: "all",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>,
  },
  {
    label: "Active",
    value: "in_progress",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
  },
  {
    label: "Pending",
    value: "pending_payment",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>,
  },
  {
    label: "Submitted",
    value: "submitted",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    label: "Completed",
    value: "completed",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>,
  },
  {
    label: "Cancelled",
    value: "cancelled",
    icon: <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>,
  },
];

const STATUS_CONFIG: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  pending_acceptance: { label: "Pending", dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  pending_payment: { label: "Awaiting Payment", dot: "bg-yellow-400", bg: "bg-yellow-50", text: "text-yellow-700" },
  paid: { label: "Paid", dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
  processing: { label: "Processing", dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
  in_progress: { label: "In Progress", dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700" },
  submitted: { label: "Delivered", dot: "bg-indigo-400", bg: "bg-indigo-50", text: "text-indigo-700" },
  revision_requested: { label: "Revision", dot: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-700" },
  completed: { label: "Completed", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Cancelled", dot: "bg-red-400", bg: "bg-red-50", text: "text-red-600" },
  declined: { label: "Declined", dot: "bg-red-400", bg: "bg-red-50", text: "text-red-600" },
  refunded: { label: "Refunded", dot: "bg-red-400", bg: "bg-red-50", text: "text-red-600" },
  shipped: { label: "Shipped", dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700" },
  delivered: { label: "Delivered", dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700" },
};

// ---------------------------------------------------------------------------
// Order Row
// ---------------------------------------------------------------------------

function OrderRow({ order }: { order: Order }) {
  const config = STATUS_CONFIG[order.status] || { label: order.status, dot: "bg-muted/60", bg: "bg-black/[0.02]", text: "text-ink/60" };

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.02] transition-colors"
    >
      {/* Buyer avatar */}
      {order.buyer?.avatar_url ? (
        <Image src={order.buyer.avatar_url} alt="" width={36} height={36} className="w-9 h-9 rounded-full shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
          <span className="text-[11px] font-ui font-bold text-white">
            {(order.buyer?.display_name || order.buyer?.username || "?")[0].toUpperCase()}
          </span>
        </div>
      )}

      {/* Order info */}
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink truncate">
          {order.product?.title || "Order"}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {order.order_number} · {order.buyer?.display_name || order.buyer?.username}
        </p>
      </div>

      {/* Type */}
      <span className="hidden sm:inline-flex px-2 py-0.5 text-[10px] font-ui font-medium text-muted bg-black/[0.02] border border-black/[0.04] rounded">
        {order.listing_type === "service" ? "Commission" : "Product"}
      </span>

      {/* Date */}
      <span className="hidden md:inline-block text-xs font-ui text-muted w-20 text-right">
        {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
      </span>

      {/* Amount */}
      <span className="font-ui text-sm font-semibold text-ink w-20 text-right shrink-0">
        ${Number(order.seller_amount).toFixed(2)}
      </span>

      {/* Status badge */}
      <span className={`inline-flex items-center gap-1 text-[10px] font-ui font-medium px-2 py-0.5 rounded-full w-28 justify-center shrink-0 ${config.bg} ${config.text}`}>
        <span className={`w-1 h-1 rounded-full ${config.dot}`} />
        {config.label}
      </span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function SellerOrdersTable() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const filters = activeTab === "all" ? {} : { status: activeTab };
  const { orders, loading, error, hasMore, loadMore } = useSellerOrders(user?.id, filters, 20);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Orders</h1>
          <p className="text-sm font-body text-muted mt-0.5">
            {orders.length} order{orders.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-black/[0.06]">
        <div className="flex gap-0 overflow-x-auto -mb-px">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-ui font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.value
                  ? "border-purple-primary text-purple-primary"
                  : "border-transparent text-muted hover:text-ink hover:border-black/[0.06]"
              }`}
            >
              <span className={activeTab === tab.value ? "text-purple-primary" : "text-muted"}>
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 border-b border-black/[0.06] bg-black/[0.02] text-[11px] font-ui uppercase tracking-wider text-muted">
          <div className="w-9" />
          <div className="flex-1">Order</div>
          <div className="hidden sm:block w-20 text-center">Type</div>
          <div className="hidden md:block w-20 text-right">Date</div>
          <div className="w-20 text-right">Amount</div>
          <div className="w-28 text-center">Status</div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-black/[0.06] border-t-purple-primary mx-auto" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="font-body text-red-500 text-sm">Failed to load orders. Refresh to try again.</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="p-16 text-center">
            <svg className="w-10 h-10 text-muted/40 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="font-body text-sm text-muted">
              {activeTab === "all"
                ? "No orders yet. Your orders will appear here."
                : `No ${activeTab.replace(/_/g, " ")} orders.`}
            </p>
          </div>
        ) : (
          <>
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
            {hasMore && (
              <div className="p-4 text-center border-t border-black/[0.04]">
                <button
                  onClick={loadMore}
                  className="px-5 py-2 rounded-lg text-sm font-ui font-medium text-purple-primary border border-purple-primary/20 bg-purple-50/50 hover:bg-purple-50 transition-colors"
                >
                  Load More
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
