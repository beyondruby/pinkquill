"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBuyerOrders, useBuyerOrderStats } from "@/lib/hooks/useOrders";
import type { OrderFilters, OrderStatus } from "@/lib/types/store";
import OrderCard from "./OrderCard";

// ---------------------------------------------------------------------------
// Tab definitions
// ---------------------------------------------------------------------------

const STATUS_TABS: { label: string; key: string; statuses?: OrderStatus[]; icon: React.ReactNode }[] = [
  {
    label: "All",
    key: "all",
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    label: "Active",
    key: "active",
    statuses: ["paid", "in_progress", "submitted", "revision_requested", "processing", "shipped"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    label: "Pending",
    key: "pending",
    statuses: ["pending_payment", "pending_acceptance"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
      </svg>
    ),
  },
  {
    label: "Completed",
    key: "completed",
    statuses: ["completed", "delivered"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
  },
  {
    label: "Cancelled",
    key: "cancelled",
    statuses: ["cancelled", "declined", "refunded"],
    icon: (
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  sublabel,
  icon,
  accent,
}: {
  label: string;
  value: string;
  sublabel?: string;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div
      className={`relative rounded-xl border p-4 sm:p-5 overflow-hidden ${
        accent
          ? "border-purple-primary/15 bg-gradient-to-br from-purple-50/80 to-accent-2/60"
          : "border-border-light bg-surface"
      }`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-ui uppercase tracking-wider text-muted">{label}</p>
          <p className={`text-2xl font-display font-bold mt-1 ${accent ? "text-purple-primary" : "text-ink"}`}>
            {value}
          </p>
          {sublabel && (
            <p className="text-[11px] font-body text-muted mt-0.5">{sublabel}</p>
          )}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
          accent ? "bg-purple-primary/10 text-purple-primary" : "bg-skeleton/70 text-muted"
        }`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeletons
// ---------------------------------------------------------------------------

function MetricSkeleton() {
  return <div className="h-[100px] bg-subtle rounded-xl animate-pulse border border-border-light" />;
}

function OrderSkeleton() {
  return (
    <div className="rounded-xl border border-border-light bg-surface p-5">
      <div className="flex gap-4">
        <div className="w-[72px] h-[72px] rounded-lg bg-skeleton/70 animate-pulse shrink-0" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 bg-skeleton/70 rounded animate-pulse" />
          <div className="h-3 w-1/2 bg-subtle rounded animate-pulse" />
          <div className="h-3 w-1/3 bg-subtle rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BuyerDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [activeTabIdx, setActiveTabIdx] = useState(0);
  const activeTab = STATUS_TABS[activeTabIdx];

  const singleFilter: OrderFilters | undefined =
    activeTab.statuses?.length === 1 ? { status: activeTab.statuses[0] } : undefined;

  const { orders, loading: ordersLoading, error, hasMore, loadMore } = useBuyerOrders(user?.id, singleFilter);
  const { stats, loading: statsLoading } = useBuyerOrderStats(user?.id);
  const loading = authLoading || ordersLoading;

  const filteredOrders =
    activeTab.statuses && activeTab.statuses.length > 1
      ? orders.filter((o) => activeTab.statuses!.includes(o.status))
      : orders;

  // Not authenticated
  if (!authLoading && !user) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Sign in to view orders</h2>
          <p className="font-body text-sm text-muted mb-6">Log in to track your purchases and commissions.</p>
          <Link
            href="/login"
            className="inline-flex px-6 py-2.5 rounded-lg text-sm font-ui font-semibold text-white bg-purple-primary hover:bg-accent/90 transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">My Orders</h1>
            <p className="text-sm font-body text-muted mt-1">Track your purchases and commissions</p>
          </div>
          <div className="flex gap-2">
            <Link
              href="/cart"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border-light bg-surface text-sm font-ui font-medium text-ink hover:bg-subtle transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" /><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
              </svg>
              Cart
            </Link>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-primary text-white text-sm font-ui font-semibold hover:bg-accent/90 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Browse
            </Link>
          </div>
        </div>

        {/* Stats cards */}
        {statsLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            {[1, 2, 3, 4].map((i) => <MetricSkeleton key={i} />)}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
            <MetricCard
              label="Active"
              value={`${stats.active_orders}`}
              sublabel="Orders in progress"
              accent={stats.active_orders > 0}
              icon={
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              }
            />
            <MetricCard
              label="Pending"
              value={`${stats.pending_orders}`}
              sublabel="Awaiting action"
              icon={
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </svg>
              }
            />
            <MetricCard
              label="Completed"
              value={`${stats.completed_orders}`}
              sublabel={`$${stats.total_spent.toFixed(2)} total spent`}
              icon={
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
            <MetricCard
              label="All Orders"
              value={`${stats.total_orders}`}
              sublabel={stats.cancelled_orders > 0 ? `${stats.cancelled_orders} cancelled` : "Lifetime total"}
              icon={
                <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              }
            />
          </div>
        ) : null}

        {/* Tab bar */}
        <div className="border-b border-border-light mb-6">
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {STATUS_TABS.map((tab, idx) => (
              <button
                key={tab.key}
                onClick={() => setActiveTabIdx(idx)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-ui font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTabIdx === idx
                    ? "border-purple-primary text-purple-primary"
                    : "border-transparent text-muted hover:text-ink hover:border-border-light"
                }`}
              >
                <span className={activeTabIdx === idx ? "text-purple-primary" : "text-muted"}>{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Order list */}
        {loading && orders.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <OrderSkeleton key={i} />)}
          </div>
        )}

        {!loading && filteredOrders.length === 0 && (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-subtle flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-muted/40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a4 4 0 0 0-8 0v2" />
              </svg>
            </div>
            <h2 className="font-display text-lg font-bold text-ink mb-1">
              {activeTabIdx === 0 ? "No orders yet" : `No ${activeTab.label.toLowerCase()} orders`}
            </h2>
            <p className="font-body text-sm text-muted mb-6 max-w-xs mx-auto">
              {activeTabIdx === 0
                ? "Browse the marketplace to find something you love."
                : "Check other tabs or browse the marketplace."}
            </p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-ui font-semibold text-white bg-purple-primary hover:bg-accent/90 transition-colors"
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
          <div className="text-center mt-8">
            <button
              onClick={loadMore}
              className="px-6 py-2.5 rounded-lg text-sm font-ui font-medium text-purple-primary border border-purple-primary/20 bg-accent/5 hover:bg-accent/10 transition-colors"
            >
              Load More Orders
            </button>
          </div>
        )}

        {error && (
          <div className="mt-4 p-4 rounded-lg bg-red-50 border border-red-100">
            <p className="text-sm text-red-600 font-body">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
