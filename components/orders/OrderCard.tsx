"use client";

import Link from "next/link";
import Image from "next/image";
import type { Order, OrderStatus } from "@/lib/types/store";
import OrderTracker from "./OrderTracker";

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending_acceptance: { label: "Pending Approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  pending_payment: { label: "Awaiting Payment", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  paid: { label: "Paid", bg: "bg-purple-primary/[0.04]", text: "text-purple-primary", dot: "bg-purple-primary" },
  processing: { label: "Processing", bg: "bg-purple-primary/[0.04]", text: "text-purple-primary", dot: "bg-purple-primary" },
  in_progress: { label: "In Progress", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  submitted: { label: "Delivered", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  revision_requested: { label: "Revision", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
  completed: { label: "Completed", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  delivered: { label: "Delivered", bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  shipped: { label: "Shipped", bg: "bg-sky-50", text: "text-sky-700", dot: "bg-sky-400" },
  cancelled: { label: "Cancelled", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
  declined: { label: "Declined", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
  refunded: { label: "Refunded", bg: "bg-red-50", text: "text-red-600", dot: "bg-red-400" },
  disputed: { label: "Disputed", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  refund_requested: { label: "Refund Requested", bg: "bg-orange-50", text: "text-orange-600", dot: "bg-orange-400" },
  resolved: { label: "Resolved", bg: "bg-slate-50", text: "text-slate-600", dot: "bg-slate-400" },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = STATUS_CONFIG[status] || { label: status, bg: "bg-black/[0.02]", text: "text-ink/60", dot: "bg-muted/60" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-ui font-medium ${config.bg} ${config.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function getQuickAction(order: Order): { label: string; href: string; variant: "primary" | "secondary" } | null {
  switch (order.status) {
    case "pending_payment":
      return { label: "Pay Now", href: `/checkout/${order.id}`, variant: "primary" };
    case "submitted":
      return { label: "Review Delivery", href: `/orders/${order.id}`, variant: "primary" };
    case "completed":
      return { label: "Leave Review", href: `/orders/${order.id}#reviews`, variant: "secondary" };
    default:
      return null;
  }
}

function getOrderTypeInfo(order: Order): { label: string; icon: string } {
  if (order.listing_type === "service") return { label: "Commission", icon: "M" };
  if (order.product?.delivery_type === "digital") return { label: "Digital", icon: "D" };
  return { label: "Physical", icon: "P" };
}

export default function OrderCard({ order }: { order: Order }) {
  const isCommission = order.listing_type === "service";
  const primaryImage = order.product?.primary_image_url || order.product?.media?.[0]?.media_url;
  const action = getQuickAction(order);
  const typeInfo = getOrderTypeInfo(order);
  const timeAgo = getTimeAgo(order.created_at);

  return (
    <div className="rounded-xl border border-black/[0.06] bg-white overflow-hidden hover:shadow-sm hover:border-black/[0.1] transition-all group">
      <Link href={`/orders/${order.id}`} className="block">
        <div className="p-4 sm:p-5">
          <div className="flex gap-4">
            {/* Thumbnail */}
            <div className="relative shrink-0">
              {primaryImage ? (
                <Image
                  src={primaryImage}
                  alt=""
                  width={72}
                  height={72}
                  className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg object-cover"
                />
              ) : (
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg bg-gradient-to-br from-purple-primary/8 to-pink-vivid/8 flex items-center justify-center border border-black/[0.04]">
                  <span className="text-lg font-display font-bold text-purple-primary/40">
                    {typeInfo.icon}
                  </span>
                </div>
              )}
              {/* Type badge on thumbnail */}
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[9px] font-ui font-semibold rounded bg-white border border-black/[0.06] text-muted shadow-sm">
                {typeInfo.label}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-ui text-[15px] font-semibold text-ink truncate group-hover:text-purple-primary transition-colors">
                    {order.product?.title || "Order"}
                  </h3>
                  <p className="text-xs font-body text-muted mt-0.5">
                    {order.order_number} · {timeAgo}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="font-display text-base font-bold text-ink">
                    ${Number(order.amount).toFixed(2)}
                  </p>
                  <div className="hidden sm:block">
                    <StatusBadge status={order.status} />
                  </div>
                </div>
              </div>

              {/* Seller info */}
              {order.seller && (
                <div className="flex items-center gap-2 mt-2.5">
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
                        {(order.seller.display_name || order.seller.username || "?")[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <span className="text-xs font-ui text-muted">
                    {order.seller.display_name || order.seller.username}
                  </span>
                  {order.seller.is_verified && (
                    <svg className="w-3.5 h-3.5 text-purple-primary" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Mobile status badge */}
          <div className="sm:hidden mt-3">
            <StatusBadge status={order.status} />
          </div>
        </div>
      </Link>

      {/* Progress tracker + Quick action */}
      <div className="border-t border-black/[0.04] px-4 sm:px-5 py-3 flex items-center gap-4 bg-black/[0.015]">
        <div className="flex-1 min-w-0">
          <OrderTracker
            status={order.status}
            listingType={
              isCommission ? "service" : order.product?.delivery_type || "product"
            }
          />
        </div>
        {action && (
          <Link
            href={action.href}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all ${
              action.variant === "primary"
                ? "bg-purple-primary text-white hover:bg-purple-primary/90"
                : "text-purple-primary border border-purple-primary/20 bg-purple-50 hover:bg-purple-100"
            }`}
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
