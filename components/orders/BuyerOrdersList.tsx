"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBuyerOrders } from "@/lib/hooks/useOrders";
import type { Order, OrderFilters, OrderStatus } from "@/lib/types/store";

const STATUS_TABS: { label: string; value: OrderStatus | undefined }[] = [
  { label: "All", value: undefined },
  { label: "Active", value: "in_progress" },
  { label: "Pending", value: "pending_payment" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

function statusColor(status: OrderStatus): string {
  switch (status) {
    case "pending_payment":
      return "bg-yellow-100 text-yellow-700";
    case "paid":
    case "processing":
      return "bg-purple-primary/10 text-purple-primary";
    case "in_progress":
    case "submitted":
      return "bg-purple-100 text-purple-700";
    case "revision_requested":
      return "bg-amber-100 text-amber-700";
    case "completed":
    case "delivered":
    case "resolved":
      return "bg-emerald-100 text-emerald-700";
    case "shipped":
      return "bg-indigo-100 text-indigo-700";
    case "cancelled":
    case "refunded":
      return "bg-red-100 text-red-600";
    default:
      return "bg-black/[0.04] text-ink/60";
  }
}

export default function BuyerOrdersList() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<OrderStatus | undefined>(undefined);
  const filters: OrderFilters | undefined = activeTab ? { status: activeTab } : undefined;

  const { orders, loading, error, hasMore, loadMore } = useBuyerOrders(user?.id, filters);

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="font-display text-3xl text-ink">Buyers Dashboard</h1>
          <Link
            href="/cart"
            className="px-4 py-2 rounded-xl border border-purple-primary/30 bg-purple-50 text-sm font-ui font-semibold text-purple-primary hover:bg-purple-100"
          >
            Open Studio Cart
          </Link>
        </div>

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-full text-sm font-ui font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.value
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                  : "bg-white border border-black/[0.08] text-muted hover:text-ink"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        {loading && orders.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-black/[0.04] rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="text-center py-16">
            <h2 className="font-display text-2xl text-ink mb-2">No orders yet</h2>
            <p className="font-body text-muted mb-6">
              Browse the marketplace to find something you love.
            </p>
            <Link
              href="/shop"
              className="inline-flex px-5 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
            >
              Explore Marketplace
            </Link>
          </div>
        )}

        <div className="space-y-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>

        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={loadMore}
              className="px-5 py-3 rounded-full text-sm font-ui font-semibold text-pink-vivid border border-pink-vivid/30 bg-pink-50 hover:bg-pink-100 transition-colors"
            >
              Load More
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 font-body text-center mt-4">{error}</p>
        )}
      </div>
    </div>
  );
}

function OrderCard({ order }: { order: Order }) {
  const isCommission = order.listing_type === "service";
  const primaryImage = order.product?.primary_image_url ||
    order.product?.media?.[0]?.media_url;

  return (
    <Link
      href={`/orders/${order.id}`}
      className="block rounded-2xl border border-black/[0.06] bg-white p-4 hover:border-pink-vivid/30 transition-colors"
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        {primaryImage ? (
          <Image
            src={primaryImage}
            alt=""
            width={72}
            height={72}
            className="w-[72px] h-[72px] rounded-xl object-cover shrink-0"
          />
        ) : (
          <div className="w-[72px] h-[72px] rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 shrink-0 flex items-center justify-center">
            <span className="text-2xl">
              {isCommission ? "\u270F\uFE0F" : "\u{1F4E6}"}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-ui font-semibold text-ink truncate">
                {order.product?.title || "Order"}
              </p>
              <p className="text-xs font-body text-muted mt-0.5">
                {order.order_number} &middot;{" "}
                {isCommission ? "Commission" : "Product"} &middot;{" "}
                {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <p className="font-ui font-semibold text-ink">${order.amount.toFixed(2)}</p>
              <span className={`px-2.5 py-1 rounded-full text-xs font-ui font-medium capitalize ${statusColor(order.status)}`}>
                {order.status.replace(/_/g, " ")}
              </span>
            </div>
          </div>

          {/* Seller */}
          {order.seller && (
            <div className="flex items-center gap-2 mt-2">
              {order.seller.avatar_url ? (
                <Image
                  src={order.seller.avatar_url}
                  alt=""
                  width={20}
                  height={20}
                  className="w-5 h-5 rounded-full"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                  <span className="text-[8px] font-ui font-bold text-white">
                    {(order.seller.display_name || order.seller.username)[0].toUpperCase()}
                  </span>
                </div>
              )}
              <span className="text-xs font-ui text-muted">
                {order.seller.display_name || order.seller.username}
              </span>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
