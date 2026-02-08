"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerOrders } from "@/lib/hooks/useOrders";
import type { Order, OrderStatus } from "@/lib/types/store";

const STATUS_TABS: { label: string; value: OrderStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "in_progress" },
  { label: "Pending Payment", value: "pending_payment" },
  { label: "Submitted", value: "submitted" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  submitted: "bg-indigo-100 text-indigo-700",
  revision_requested: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-600",
  shipped: "bg-cyan-100 text-cyan-700",
  delivered: "bg-emerald-100 text-emerald-700",
  processing: "bg-blue-100 text-blue-600",
};

function OrderRow({ order }: { order: Order }) {
  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-4 p-4 border-b border-black/[0.04] last:border-0 hover:bg-black/[0.01] transition-colors"
    >
      {/* Buyer avatar */}
      {order.buyer?.avatar_url ? (
        <Image src={order.buyer.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full shrink-0" />
      ) : (
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
          <span className="text-xs font-ui font-bold text-white">
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
          {order.order_number} &middot; {order.buyer?.display_name || order.buyer?.username}
        </p>
      </div>

      {/* Type */}
      <span className="hidden sm:inline-block text-xs font-ui text-muted capitalize">
        {order.listing_type === "service" ? "Commission" : "Product"}
      </span>

      {/* Date */}
      <span className="hidden md:inline-block text-xs font-ui text-muted w-24 text-right">
        {new Date(order.created_at).toLocaleDateString()}
      </span>

      {/* Amount */}
      <span className="font-ui text-sm font-semibold text-ink w-20 text-right">
        ${Number(order.seller_amount).toFixed(2)}
      </span>

      {/* Status */}
      <span className={`text-[10px] font-ui font-medium px-2.5 py-1 rounded-full w-28 text-center capitalize ${
        STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
      }`}>
        {order.status.replace(/_/g, " ")}
      </span>
    </Link>
  );
}

export default function SellerOrdersTable() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatus | "all">("all");
  const filters = activeTab === "all" ? {} : { status: activeTab };
  const { orders, loading, hasMore, loadMore } = useSellerOrders(user?.id, filters, 20);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Orders</h1>
        <span className="text-sm font-ui text-muted">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-2 rounded-full text-sm font-ui transition-colors ${
              activeTab === tab.value
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                : "bg-white border border-black/[0.08] text-ink hover:bg-black/[0.02]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
        {/* Table Header */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-black/[0.06] bg-gray-50/50 text-xs font-ui uppercase tracking-wider text-muted">
          <div className="w-10" />
          <div className="flex-1">Order</div>
          <div className="hidden sm:block">Type</div>
          <div className="hidden md:block w-24 text-right">Date</div>
          <div className="w-20 text-right">Amount</div>
          <div className="w-28 text-center">Status</div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-primary mx-auto" />
          </div>
        ) : orders.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-body text-muted">
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
              <div className="p-4 text-center">
                <button
                  onClick={loadMore}
                  className="text-sm font-ui text-purple-primary hover:underline"
                >
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
