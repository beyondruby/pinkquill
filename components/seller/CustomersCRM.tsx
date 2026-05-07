"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerCustomers } from "@/lib/hooks/useSellerCustomers";
import type { SellerCustomer } from "@/lib/hooks/useSellerCustomers";

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  pending_payment: { bg: "bg-yellow-50", text: "text-yellow-700" },
  pending_acceptance: { bg: "bg-yellow-50", text: "text-yellow-700" },
  paid: { bg: "bg-purple-50", text: "text-purple-700" },
  in_progress: { bg: "bg-purple-50", text: "text-purple-700" },
  submitted: { bg: "bg-indigo-50", text: "text-indigo-700" },
  revision_requested: { bg: "bg-orange-50", text: "text-orange-700" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { bg: "bg-red-50", text: "text-red-700" },
  refunded: { bg: "bg-red-50", text: "text-red-600" },
  shipped: { bg: "bg-sky-50", text: "text-sky-700" },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700" },
  declined: { bg: "bg-red-50", text: "text-red-600" },
};

// ---------------------------------------------------------------------------
// Metric Card
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
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
// Customer Row
// ---------------------------------------------------------------------------

function CustomerRow({ customer }: { customer: SellerCustomer }) {
  const [expanded, setExpanded] = useState(false);

  const location = customer.shipping_address
    ? [customer.shipping_address.city, customer.shipping_address.country].filter(Boolean).join(", ")
    : null;

  return (
    <div className="border-b border-border-light last:border-0">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-3.5 hover:bg-subtle transition-colors text-left"
      >
        {/* Avatar */}
        {customer.avatar_url ? (
          <Image src={customer.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
            <span className="text-xs font-ui font-bold text-white">
              {(customer.display_name || customer.username || "?")[0].toUpperCase()}
            </span>
          </div>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-ui text-sm font-medium text-ink truncate">
            {customer.display_name || customer.username}
            {customer.is_verified && (
              <svg className="inline w-3.5 h-3.5 text-purple-primary ml-1" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
          </p>
          <p className="text-xs text-muted">@{customer.username}</p>
        </div>

        {/* Orders count */}
        <div className="hidden sm:block w-16 text-center">
          <p className="font-ui text-sm font-semibold text-ink">{customer.total_orders}</p>
          <p className="text-[10px] text-muted">orders</p>
        </div>

        {/* Total spent */}
        <div className="w-24 text-right">
          <p className="font-ui text-sm font-semibold text-ink">${customer.total_spent.toFixed(2)}</p>
          <p className="text-[10px] text-muted">total</p>
        </div>

        {/* Location */}
        <div className="hidden lg:block w-32 text-right">
          <p className="font-ui text-xs text-muted truncate">{location || "—"}</p>
        </div>

        {/* Last order */}
        <div className="hidden sm:block w-20 text-right">
          <p className="font-ui text-xs text-muted">
            {new Date(customer.last_order_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </p>
        </div>

        {/* Expand */}
        <svg
          className={`w-4 h-4 text-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-4 pt-0">
          <div className="bg-subtle rounded-lg p-4 sm:p-5 space-y-4">
            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Contact */}
              <div>
                <h4 className="text-[11px] font-ui font-semibold text-muted uppercase tracking-wider mb-2">Contact</h4>
                <div className="space-y-1.5 text-sm font-body text-ink">
                  {customer.buyer_phone && (
                    <p className="flex items-center gap-2">
                      <svg className="w-3.5 h-3.5 text-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                      {customer.buyer_phone}
                    </p>
                  )}
                  <Link
                    href={`/studio/${customer.username}`}
                    className="flex items-center gap-2 text-purple-primary hover:underline"
                  >
                    <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                    </svg>
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Address */}
              {customer.shipping_address && (
                <div>
                  <h4 className="text-[11px] font-ui font-semibold text-muted uppercase tracking-wider mb-2">Shipping Address</h4>
                  <div className="text-sm font-body text-ink flex items-start gap-2">
                    <svg className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
                    </svg>
                    <span>
                      {customer.shipping_address.name}<br />
                      {customer.shipping_address.line1}
                      {customer.shipping_address.line2 && <><br />{customer.shipping_address.line2}</>}
                      <br />
                      {[customer.shipping_address.city, customer.shipping_address.state, customer.shipping_address.postal_code].filter(Boolean).join(", ")}
                      <br />
                      {customer.shipping_address.country}
                    </span>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div>
                <h4 className="text-[11px] font-ui font-semibold text-muted uppercase tracking-wider mb-2">Stats</h4>
                <div className="text-sm font-body text-ink space-y-1">
                  <p>Avg. order: <span className="font-semibold">${customer.avg_order_value.toFixed(2)}</span></p>
                  <p>Completed: <span className="font-semibold">{customer.completed_orders}</span></p>
                  <p>Active: <span className="font-semibold">{customer.active_orders}</span></p>
                  <p>First order: <span className="text-muted">{new Date(customer.first_order_at).toLocaleDateString()}</span></p>
                </div>
              </div>
            </div>

            {/* Orders */}
            <div>
              <h4 className="text-[11px] font-ui font-semibold text-muted uppercase tracking-wider mb-2">Orders</h4>
              <div className="space-y-0.5">
                {customer.orders.map((order) => {
                  const sc = STATUS_CONFIG[order.status] || { bg: "bg-subtle", text: "text-ink/70" };
                  return (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface transition-colors"
                    >
                      <span className="text-xs font-ui text-muted w-20 shrink-0">{order.order_number}</span>
                      <span className="text-sm font-body text-ink flex-1 truncate">{order.product_title || "Order"}</span>
                      <span className="text-xs font-ui text-muted capitalize hidden sm:block">
                        {order.listing_type === "service" ? "Commission" : "Product"}
                      </span>
                      <span className="text-sm font-ui font-semibold text-ink w-20 text-right">${order.amount.toFixed(2)}</span>
                      <span className={`text-[10px] font-ui font-medium px-2 py-0.5 rounded-full capitalize ${sc.bg} ${sc.text}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function CustomersCRM() {
  const { user } = useAuth();
  const { customers, stats, loading, error } = useSellerCustomers(user?.id);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? customers.filter((c) => {
        const q = search.toLowerCase();
        return c.username.toLowerCase().includes(q) || (c.display_name?.toLowerCase().includes(q) ?? false);
      })
    : customers;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Customers</h1>
          <p className="text-sm font-body text-muted mt-0.5">
            {stats.total_customers} customer{stats.total_customers !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Total Customers"
          value={stats.total_customers}
          accent
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
          }
        />
        <MetricCard
          label="Repeat Customers"
          value={stats.repeat_customers}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
            </svg>
          }
        />
        <MetricCard
          label="Total Revenue"
          value={`$${stats.total_revenue.toFixed(2)}`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          }
        />
        <MetricCard
          label="Avg. Order Value"
          value={`$${stats.avg_order_value.toFixed(2)}`}
          icon={
            <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" />
            </svg>
          }
        />
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border-light bg-surface font-body text-sm text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 transition-all"
        />
      </div>

      {/* Customer table */}
      <div className="rounded-xl border border-border-light bg-surface overflow-hidden">
        {/* Header */}
        <div className="hidden sm:flex items-center gap-3 sm:gap-4 px-4 sm:px-5 py-2.5 border-b border-border-light bg-subtle text-[11px] font-ui uppercase tracking-wider text-muted">
          <div className="w-10" />
          <div className="flex-1">Customer</div>
          <div className="hidden sm:block w-16 text-center">Orders</div>
          <div className="w-24 text-right">Spent</div>
          <div className="hidden lg:block w-32 text-right">Location</div>
          <div className="hidden sm:block w-20 text-right">Last Order</div>
          <div className="w-4" />
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-border-light border-t-purple-primary mx-auto" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="font-body text-red-500 text-sm">Failed to load customers. Refresh to try again.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-16 text-center">
            <svg className="w-10 h-10 text-muted/40 mx-auto mb-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            </svg>
            <p className="font-body text-sm text-muted">
              {search.trim()
                ? "No customers match your search."
                : "No customers yet. They'll appear here when you receive orders."}
            </p>
          </div>
        ) : (
          filtered.map((customer) => (
            <CustomerRow key={customer.buyer_id} customer={customer} />
          ))
        )}
      </div>
    </div>
  );
}
