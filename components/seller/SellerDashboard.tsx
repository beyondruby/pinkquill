"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrderStats, useSellerOrders, usePendingAcceptanceOrders } from "@/lib/hooks/useOrders";
import { useSellerEarnings, useSellerOnboarding } from "@/lib/hooks/usePayments";
import PendingOrderCard from "./PendingOrderCard";
import Loading from "@/components/ui/Loading";
import type { Order } from "@/lib/types/store";
import { getOrderStatusMeta } from "@/lib/utils/orderStatus";

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
    <div className={`rounded-xl border p-4 sm:p-5 ${
      accent
        ? "border-purple-primary/15 bg-gradient-to-br from-purple-50/80 to-pink-50/60"
        : "border-border-light bg-surface"
    }`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-ui uppercase tracking-wider text-muted">{label}</p>
          <p className={`text-2xl font-display font-bold mt-1 ${accent ? "text-purple-primary" : "text-ink"}`}>
            {value}
          </p>
          {sublabel && <p className="text-[11px] font-body text-muted mt-0.5">{sublabel}</p>}
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
// Recent Order Row
// ---------------------------------------------------------------------------

function RecentOrderRow({ order }: { order: Order }) {
  const config = getOrderStatusMeta(order.status);

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-subtle transition-colors border-b border-border-light last:border-0"
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

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink truncate">
          {order.product?.title || "Order"}
        </p>
        <p className="text-xs text-muted mt-0.5">
          {order.order_number} · {order.buyer?.display_name || order.buyer?.username}
        </p>
      </div>

      {/* Amount */}
      <div className="text-right shrink-0">
        <p className="font-ui text-sm font-semibold text-ink">${Number(order.seller_amount).toFixed(2)}</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-ui font-medium px-2 py-0.5 rounded-full mt-0.5 ${config.bg} ${config.text}`}>
          <span className={`w-1 h-1 rounded-full ${config.dot}`} />
          {config.label}
        </span>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Main Dashboard
// ---------------------------------------------------------------------------

export default function SellerDashboard() {
  const { user } = useAuth();
  const { stats, loading: statsLoading } = useOrderStats(user?.id);
  const { earnings, loading: earningsLoading } = useSellerEarnings(user?.id);
  const { orders: recentOrders, loading: ordersLoading, error: ordersError } = useSellerOrders(user?.id, undefined, 5);
  const { orders: pendingOrders, count: pendingCount } = usePendingAcceptanceOrders(user?.id);
  const { account, loading: accountLoading } = useSellerOnboarding();

  const loading = statsLoading || earningsLoading || accountLoading;

  // Loading
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-7 w-40 bg-skeleton/70 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-[100px] bg-subtle rounded-xl animate-pulse border border-border-light" />
          ))}
        </div>
        <div className="h-80 bg-subtle rounded-xl animate-pulse border border-border-light" />
      </div>
    );
  }

  // Not onboarded
  if (!account?.charges_enabled) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-2xl bg-purple-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-purple-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <h2 className="font-display text-xl font-bold text-ink mb-2">Set Up Your Seller Account</h2>
          <p className="font-body text-sm text-muted mb-6">
            Complete your payment setup to start receiving orders and earning from your creative work.
          </p>
          <Link
            href="/seller/onboarding"
            className="inline-flex px-6 py-2.5 bg-purple-primary text-white rounded-lg font-ui text-sm font-semibold hover:bg-accent/90 transition-colors"
          >
            Complete Setup
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Dashboard</h1>
          <p className="text-sm font-body text-muted mt-0.5">Welcome back — here&apos;s your overview</p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Earned"
          value={`$${(earnings?.total_earned ?? 0).toFixed(2)}`}
          sublabel={`${earnings?.completed_orders ?? 0} completed`}
          accent
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <MetricCard
          label="Pending"
          value={`$${(earnings?.pending_earnings ?? 0).toFixed(2)}`}
          sublabel={`${earnings?.active_orders ?? 0} active orders`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
          }
        />
        <MetricCard
          label="Active Orders"
          value={`${stats?.active_orders ?? 0}`}
          sublabel="In progress"
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
          }
        />
        {pendingCount > 0 ? (
          <MetricCard
            label="Pending Approval"
            value={`${pendingCount}`}
            sublabel="Awaiting your response"
            accent
            icon={
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
          />
        ) : (
          <MetricCard
            label="Avg. Order"
            value={`$${(earnings?.avg_order_value ?? 0).toFixed(2)}`}
            sublabel={`${earnings?.total_orders ?? 0} total orders`}
            icon={
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            }
          />
        )}
      </div>

      {/* Pending Approval Section */}
      {pendingOrders.length > 0 && (
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <h2 className="font-display text-lg font-bold text-ink">Pending Approval</h2>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-primary text-white text-[11px] font-ui font-bold">
              {pendingCount}
            </span>
          </div>
          <div className="space-y-3">
            {pendingOrders.map((order) => (
              <PendingOrderCard key={order.id} order={order} />
            ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      <div className="flex gap-2 flex-wrap">
        <Link
          href="/sell"
          className="inline-flex items-center gap-2 px-4 py-2 bg-purple-primary text-white rounded-lg text-sm font-ui font-semibold hover:bg-accent/90 transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Product
        </Link>
        <Link
          href="/sell/service"
          className="inline-flex items-center gap-2 px-4 py-2 border border-border-light bg-surface rounded-lg text-sm font-ui font-medium text-ink hover:bg-subtle transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New Commission
        </Link>
        <Link
          href="/seller/orders"
          className="inline-flex items-center gap-2 px-4 py-2 border border-border-light bg-surface rounded-lg text-sm font-ui font-medium text-ink hover:bg-subtle transition-colors"
        >
          View All Orders
        </Link>
      </div>

      {/* Recent Orders */}
      <section className="rounded-xl border border-border-light bg-surface overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border-light">
          <h2 className="font-display text-base font-bold text-ink">Recent Orders</h2>
          <Link
            href="/seller/orders"
            className="text-xs font-ui font-medium text-purple-primary hover:text-accent/80 transition-colors"
          >
            View all
          </Link>
        </div>

        {ordersLoading ? (
          <div className="py-10 flex justify-center">
            <Loading size="small" text="" />
          </div>
        ) : ordersError ? (
          <div className="p-10 text-center">
            <p className="font-body text-red-500 text-sm">Failed to load orders. Refresh to try again.</p>
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-10 text-center">
            <svg className="w-10 h-10 text-muted/40 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
            </svg>
            <p className="font-body text-sm text-muted">No orders yet. Share your listings to get started!</p>
          </div>
        ) : (
          <div>
            {recentOrders.map((order) => (
              <RecentOrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
