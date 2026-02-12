"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBuyerOrders, useBuyerOrderStats } from "@/lib/hooks/useOrders";
import type { OrderFilters, OrderStatus } from "@/lib/types/store";
import OrderCard from "./OrderCard";

const STATUS_TABS: { label: string; statuses?: OrderStatus[] }[] = [
  { label: "All" },
  { label: "Active", statuses: ["paid", "in_progress", "submitted", "revision_requested", "processing", "shipped"] },
  { label: "Pending", statuses: ["pending_payment", "pending_acceptance"] },
  { label: "Completed", statuses: ["completed", "delivered"] },
  { label: "Cancelled", statuses: ["cancelled", "declined", "refunded"] },
];

function MetricCard({
  label,
  value,
  sublabel,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 ${
        accent
          ? "border-purple-primary/20 bg-gradient-to-br from-purple-50 to-pink-50"
          : "border-black/[0.06] bg-white"
      }`}
    >
      <p className="text-xs font-ui uppercase tracking-wider text-muted">
        {label}
      </p>
      <p
        className={`text-2xl font-display font-bold mt-1 ${
          accent ? "text-purple-primary" : "text-ink"
        }`}
      >
        {value}
      </p>
      {sublabel && (
        <p className="text-xs font-body text-muted mt-1">{sublabel}</p>
      )}
    </div>
  );
}

export default function BuyerDashboard() {
  const { user } = useAuth();
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  const activeTab = STATUS_TABS[activeTabIdx];

  // For single-status tabs, use server-side filter. Otherwise fetch all + filter client-side.
  const singleFilter: OrderFilters | undefined =
    activeTab.statuses?.length === 1 ? { status: activeTab.statuses[0] } : undefined;

  const { orders, loading, error, hasMore, loadMore } = useBuyerOrders(
    user?.id,
    singleFilter
  );
  const { stats, loading: statsLoading } = useBuyerOrderStats(user?.id);

  const filteredOrders =
    activeTab.statuses && activeTab.statuses.length > 1
      ? orders.filter((o) => activeTab.statuses!.includes(o.status))
      : activeTab.statuses?.length === 1
        ? orders
        : orders;

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <h1 className="font-display text-3xl text-ink">My Orders</h1>
          <div className="flex gap-2">
            <Link
              href="/cart"
              className="px-4 py-2 rounded-xl border border-black/[0.08] bg-white text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors"
            >
              Studio Cart
            </Link>
            <Link
              href="/shop"
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-sm font-ui font-semibold hover:opacity-90 transition-opacity"
            >
              Browse Marketplace
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        {!statsLoading && stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <MetricCard
              label="Active"
              value={`${stats.active_orders}`}
              sublabel="Orders in progress"
              accent={stats.active_orders > 0}
            />
            <MetricCard
              label="Pending"
              value={`${stats.pending_orders}`}
              sublabel="Awaiting action"
            />
            <MetricCard
              label="Completed"
              value={`${stats.completed_orders}`}
              sublabel={`$${stats.total_spent.toFixed(2)} total`}
            />
            <MetricCard
              label="All Orders"
              value={`${stats.total_orders}`}
              sublabel={`${stats.cancelled_orders} cancelled`}
            />
          </div>
        )}

        {statsLoading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-gray-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Status tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 mb-6">
          {STATUS_TABS.map((tab, idx) => (
            <button
              key={tab.label}
              onClick={() => setActiveTabIdx(idx)}
              className={`px-4 py-2 rounded-full text-sm font-ui font-medium whitespace-nowrap transition-colors ${
                activeTabIdx === idx
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
              <div
                key={i}
                className="h-32 bg-gray-100 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-16">
            <h2 className="font-display text-2xl text-ink mb-2">
              {activeTabIdx === 0 ? "No orders yet" : `No ${activeTab.label.toLowerCase()} orders`}
            </h2>
            <p className="font-body text-muted mb-6">
              {activeTabIdx === 0
                ? "Browse the marketplace to find something you love."
                : "Check other tabs or browse the marketplace."}
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
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>

        {hasMore && (
          <div className="text-center mt-6">
            <button
              onClick={loadMore}
              className="px-5 py-3 rounded-full text-sm font-ui font-semibold text-purple-primary border border-purple-primary/30 bg-purple-50 hover:bg-purple-100 transition-colors"
            >
              Load More
            </button>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 font-body text-center mt-4">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
