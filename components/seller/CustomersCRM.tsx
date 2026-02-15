"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerCustomers } from "@/lib/hooks/useSellerCustomers";
import type { SellerCustomer } from "@/lib/hooks/useSellerCustomers";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faRepeat,
  faDollarSign,
  faReceipt,
  faSearch,
  faChevronDown,
  faChevronUp,
  faPhone,
  faLocationDot,
  faEnvelope,
} from "@fortawesome/free-solid-svg-icons";

const STATUS_COLORS: Record<string, string> = {
  pending_payment: "bg-yellow-100 text-yellow-700",
  pending_acceptance: "bg-yellow-100 text-yellow-700",
  paid: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  submitted: "bg-indigo-100 text-indigo-700",
  revision_requested: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  refunded: "bg-red-100 text-red-600",
  shipped: "bg-cyan-100 text-cyan-700",
  delivered: "bg-emerald-100 text-emerald-700",
  declined: "bg-red-100 text-red-600",
};

function MetricCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string | number;
  icon: typeof faUsers;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white border-transparent"
          : "bg-white border-black/[0.06]"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            accent ? "bg-white/20" : "bg-purple-50"
          }`}
        >
          <FontAwesomeIcon
            icon={icon}
            className={`text-sm ${accent ? "text-white" : "text-purple-primary"}`}
          />
        </div>
        <div>
          <p
            className={`text-2xl font-display font-bold ${
              accent ? "text-white" : "text-ink"
            }`}
          >
            {value}
          </p>
          <p
            className={`text-xs font-ui ${
              accent ? "text-white/70" : "text-muted"
            }`}
          >
            {label}
          </p>
        </div>
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: SellerCustomer }) {
  const [expanded, setExpanded] = useState(false);

  const location = customer.shipping_address
    ? [customer.shipping_address.city, customer.shipping_address.country]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <div className="border-b border-black/[0.04] last:border-0">
      {/* Main row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 p-4 hover:bg-black/[0.01] transition-colors text-left"
      >
        {/* Avatar */}
        {customer.avatar_url ? (
          <Image
            src={customer.avatar_url}
            alt=""
            width={40}
            height={40}
            className="w-10 h-10 rounded-full shrink-0"
          />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
            <span className="text-xs font-ui font-bold text-white">
              {(
                customer.display_name ||
                customer.username ||
                "?"
              )[0].toUpperCase()}
            </span>
          </div>
        )}

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className="font-ui text-sm font-medium text-ink truncate">
            {customer.display_name || customer.username}
            {customer.is_verified && (
              <span className="ml-1 text-purple-primary text-xs">&#10003;</span>
            )}
          </p>
          <p className="text-xs text-muted">@{customer.username}</p>
        </div>

        {/* Orders count */}
        <div className="hidden sm:block w-20 text-center">
          <p className="font-ui text-sm font-semibold text-ink">
            {customer.total_orders}
          </p>
          <p className="text-[10px] text-muted">orders</p>
        </div>

        {/* Total spent */}
        <div className="w-24 text-right">
          <p className="font-ui text-sm font-semibold text-ink">
            ${customer.total_spent.toFixed(2)}
          </p>
          <p className="text-[10px] text-muted">total</p>
        </div>

        {/* Phone */}
        <div className="hidden md:block w-32 text-right">
          <p className="font-ui text-xs text-muted truncate">
            {customer.buyer_phone || "—"}
          </p>
        </div>

        {/* Location */}
        <div className="hidden lg:block w-36 text-right">
          <p className="font-ui text-xs text-muted truncate">
            {location || "—"}
          </p>
        </div>

        {/* Last order */}
        <div className="hidden sm:block w-24 text-right">
          <p className="font-ui text-xs text-muted">
            {new Date(customer.last_order_at).toLocaleDateString()}
          </p>
        </div>

        {/* Expand icon */}
        <FontAwesomeIcon
          icon={expanded ? faChevronUp : faChevronDown}
          className="text-xs text-muted ml-2"
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 pt-0">
          <div className="bg-gray-50/80 rounded-xl p-5 space-y-4">
            {/* Contact & Address row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Contact */}
              <div>
                <h4 className="font-ui text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Contact
                </h4>
                <div className="space-y-1.5">
                  {customer.buyer_phone && (
                    <p className="text-sm font-body text-ink flex items-center gap-2">
                      <FontAwesomeIcon
                        icon={faPhone}
                        className="text-xs text-muted"
                      />
                      {customer.buyer_phone}
                    </p>
                  )}
                  <Link
                    href={`/studio/${customer.username}`}
                    className="text-sm font-body text-purple-primary hover:underline flex items-center gap-2"
                  >
                    <FontAwesomeIcon
                      icon={faEnvelope}
                      className="text-xs"
                    />
                    View Profile
                  </Link>
                </div>
              </div>

              {/* Address */}
              {customer.shipping_address && (
                <div>
                  <h4 className="font-ui text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                    Shipping Address
                  </h4>
                  <div className="text-sm font-body text-ink space-y-0.5">
                    <p className="flex items-start gap-2">
                      <FontAwesomeIcon
                        icon={faLocationDot}
                        className="text-xs text-muted mt-1"
                      />
                      <span>
                        {customer.shipping_address.name}
                        <br />
                        {customer.shipping_address.line1}
                        {customer.shipping_address.line2 && (
                          <>
                            <br />
                            {customer.shipping_address.line2}
                          </>
                        )}
                        <br />
                        {[
                          customer.shipping_address.city,
                          customer.shipping_address.state,
                          customer.shipping_address.postal_code,
                        ]
                          .filter(Boolean)
                          .join(", ")}
                        <br />
                        {customer.shipping_address.country}
                      </span>
                    </p>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div>
                <h4 className="font-ui text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                  Stats
                </h4>
                <div className="text-sm font-body text-ink space-y-1">
                  <p>
                    Avg. order:{" "}
                    <span className="font-semibold">
                      ${customer.avg_order_value.toFixed(2)}
                    </span>
                  </p>
                  <p>
                    Completed:{" "}
                    <span className="font-semibold">
                      {customer.completed_orders}
                    </span>
                  </p>
                  <p>
                    Active:{" "}
                    <span className="font-semibold">
                      {customer.active_orders}
                    </span>
                  </p>
                  <p>
                    First order:{" "}
                    <span className="text-muted">
                      {new Date(customer.first_order_at).toLocaleDateString()}
                    </span>
                  </p>
                </div>
              </div>
            </div>

            {/* Recent orders */}
            <div>
              <h4 className="font-ui text-xs font-semibold text-muted uppercase tracking-wider mb-2">
                Orders
              </h4>
              <div className="space-y-1">
                {customer.orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/orders/${order.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-white transition-colors"
                  >
                    <span className="text-xs font-ui text-muted w-24 shrink-0">
                      {order.order_number}
                    </span>
                    <span className="text-sm font-body text-ink flex-1 truncate">
                      {order.product_title || "Order"}
                    </span>
                    <span className="text-xs font-ui text-muted capitalize hidden sm:block">
                      {order.listing_type === "service"
                        ? "Commission"
                        : "Product"}
                    </span>
                    <span className="text-sm font-ui font-semibold text-ink w-20 text-right">
                      ${order.amount.toFixed(2)}
                    </span>
                    <span
                      className={`text-[10px] font-ui font-medium px-2 py-0.5 rounded-full capitalize ${
                        STATUS_COLORS[order.status] || "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomersCRM() {
  const { user } = useAuth();
  const { customers, stats, loading, error } = useSellerCustomers(user?.id);
  const [search, setSearch] = useState("");

  const filtered = search.trim()
    ? customers.filter((c) => {
        const q = search.toLowerCase();
        return (
          c.username.toLowerCase().includes(q) ||
          (c.display_name?.toLowerCase().includes(q) ?? false)
        );
      })
    : customers;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl text-ink">Customers</h1>
        <span className="text-sm font-ui text-muted">
          {stats.total_customers} customer
          {stats.total_customers !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Total Customers"
          value={stats.total_customers}
          icon={faUsers}
          accent
        />
        <MetricCard
          label="Repeat Customers"
          value={stats.repeat_customers}
          icon={faRepeat}
        />
        <MetricCard
          label="Total Revenue"
          value={`$${stats.total_revenue.toFixed(2)}`}
          icon={faDollarSign}
        />
        <MetricCard
          label="Avg. Order Value"
          value={`$${stats.avg_order_value.toFixed(2)}`}
          icon={faReceipt}
        />
      </div>

      {/* Search */}
      <div className="relative">
        <FontAwesomeIcon
          icon={faSearch}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted text-sm"
        />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search customers by name or username..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-black/[0.08] bg-white font-body text-sm text-ink placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all"
        />
      </div>

      {/* Customer Table */}
      <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden">
        {/* Header */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-3 border-b border-black/[0.06] bg-gray-50/50 text-xs font-ui uppercase tracking-wider text-muted">
          <div className="w-10" />
          <div className="flex-1">Customer</div>
          <div className="hidden sm:block w-20 text-center">Orders</div>
          <div className="w-24 text-right">Spent</div>
          <div className="hidden md:block w-32 text-right">Phone</div>
          <div className="hidden lg:block w-36 text-right">Location</div>
          <div className="hidden sm:block w-24 text-right">Last Order</div>
          <div className="w-6" />
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-purple-primary mx-auto" />
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="font-body text-red-500">
              Failed to load customers. Please refresh to try again.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FontAwesomeIcon
              icon={faUsers}
              className="text-3xl text-muted/30 mb-3"
            />
            <p className="font-body text-muted">
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
