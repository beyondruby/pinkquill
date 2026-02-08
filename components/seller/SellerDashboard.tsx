"use client";

import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrderStats, useSellerOrders } from "@/lib/hooks/useOrders";
import { useSellerEarnings } from "@/lib/hooks/usePayments";
import { useSellerOnboarding } from "@/lib/hooks/usePayments";
import type { Order } from "@/lib/types/store";

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
    <div className={`rounded-2xl border p-5 ${
      accent
        ? "border-purple-primary/20 bg-gradient-to-br from-purple-50 to-pink-50"
        : "border-black/[0.06] bg-white"
    }`}>
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className={`text-2xl font-display font-bold mt-1 ${
        accent ? "text-purple-primary" : "text-ink"
      }`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs font-body text-muted mt-1">{sublabel}</p>
      )}
    </div>
  );
}

function RecentOrderRow({ order }: { order: Order }) {
  const statusColors: Record<string, string> = {
    pending_payment: "bg-yellow-100 text-yellow-700",
    paid: "bg-blue-100 text-blue-700",
    in_progress: "bg-purple-100 text-purple-700",
    submitted: "bg-indigo-100 text-indigo-700",
    revision_requested: "bg-orange-100 text-orange-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    shipped: "bg-cyan-100 text-cyan-700",
    delivered: "bg-emerald-100 text-emerald-700",
  };

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-3 p-3 rounded-xl hover:bg-black/[0.02] transition-colors"
    >
      {order.buyer?.avatar_url ? (
        <Image src={order.buyer.avatar_url} alt="" width={36} height={36} className="w-9 h-9 rounded-full" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
          <span className="text-xs font-ui font-bold text-white">
            {(order.buyer?.display_name || order.buyer?.username || "?")[0].toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-ui text-sm font-medium text-ink truncate">
          {order.product?.title || "Order"}
        </p>
        <p className="text-xs text-muted">
          {order.order_number} &middot; {order.buyer?.display_name || order.buyer?.username}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-ui text-sm font-semibold text-ink">${Number(order.seller_amount).toFixed(2)}</p>
        <span className={`inline-block text-[10px] font-ui font-medium px-2 py-0.5 rounded-full ${
          statusColors[order.status] || "bg-gray-100 text-gray-700"
        }`}>
          {order.status.replace(/_/g, " ")}
        </span>
      </div>
    </Link>
  );
}

export default function SellerDashboard() {
  const { user } = useAuth();
  const { stats, loading: statsLoading } = useOrderStats(user?.id);
  const { earnings, loading: earningsLoading } = useSellerEarnings(user?.id);
  const { orders: recentOrders, loading: ordersLoading } = useSellerOrders(user?.id, {}, 5);
  const { account } = useSellerOnboarding();

  const loading = statsLoading || earningsLoading;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-100 rounded-lg animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // Not onboarded yet
  if (!account?.charges_enabled) {
    return (
      <div className="text-center py-16">
        <h2 className="font-display text-2xl text-ink mb-3">Set Up Your Seller Account</h2>
        <p className="font-body text-muted mb-6 max-w-md mx-auto">
          Complete your payment setup to start receiving orders and earning from your creative work.
        </p>
        <Link
          href="/seller/onboarding"
          className="inline-flex px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
        >
          Complete Setup
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl text-ink">Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Earned"
          value={`$${(earnings?.total_earned ?? 0).toFixed(2)}`}
          sublabel={`${earnings?.completed_orders ?? 0} completed orders`}
          accent
        />
        <MetricCard
          label="Pending"
          value={`$${(earnings?.pending_earnings ?? 0).toFixed(2)}`}
          sublabel={`${earnings?.active_orders ?? 0} active orders`}
        />
        <MetricCard
          label="Active Orders"
          value={`${stats?.active_orders ?? 0}`}
          sublabel="In progress"
        />
        <MetricCard
          label="Avg. Order"
          value={`$${(earnings?.avg_order_value ?? 0).toFixed(2)}`}
          sublabel={`${earnings?.total_orders ?? 0} total orders`}
        />
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/sell"
          className="px-4 py-2 bg-white border border-black/[0.08] rounded-xl text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors"
        >
          + New Product
        </Link>
        <Link
          href="/sell/service"
          className="px-4 py-2 bg-white border border-black/[0.08] rounded-xl text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors"
        >
          + New Commission
        </Link>
        <Link
          href="/seller/orders"
          className="px-4 py-2 bg-white border border-black/[0.08] rounded-xl text-sm font-ui font-medium text-ink hover:bg-black/[0.02] transition-colors"
        >
          View All Orders
        </Link>
      </div>

      {/* Recent Orders */}
      <section className="rounded-2xl border border-black/[0.06] bg-white">
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/[0.04]">
          <h2 className="font-display text-lg text-ink">Recent Orders</h2>
          <Link
            href="/seller/orders"
            className="text-sm font-ui text-purple-primary hover:underline"
          >
            View all
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-purple-primary mx-auto" />
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="p-8 text-center">
            <p className="font-body text-muted text-sm">No orders yet. Share your listings to get started!</p>
          </div>
        ) : (
          <div className="p-2">
            {recentOrders.map((order) => (
              <RecentOrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
