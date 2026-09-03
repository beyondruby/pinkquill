"use client";

import Link from "next/link";
import { formatCurrency } from "@/lib/utils/currency";
import Image from "next/image";
import { getTimeAgo } from "@/lib/utils/time";
import type { Order, OrderStatus } from "@/lib/types/store";
import { getOrderStatusMeta } from "@/lib/utils/orderStatus";
import OrderProgress from "./OrderProgress";

function StatusBadge({ status }: { status: OrderStatus }) {
  const config = getOrderStatusMeta(status);
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
      return { label: "Leave Review", href: `/orders/${order.id}`, variant: "secondary" };
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
  const primaryImage = order.product?.primary_image_url || order.product?.media?.[0]?.media_url;
  const action = getQuickAction(order);
  const typeInfo = getOrderTypeInfo(order);
  const timeAgo = getTimeAgo(order.created_at);

  return (
    <div className="rounded-xl border border-border-light bg-surface overflow-hidden hover:shadow-sm hover:border-border-light transition-all group">
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
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-lg bg-gradient-to-br from-purple-primary/8 to-pink-vivid/8 flex items-center justify-center border border-border-light">
                  <span className="text-lg font-display font-bold text-purple-primary/40">
                    {typeInfo.icon}
                  </span>
                </div>
              )}
              {/* Type badge on thumbnail */}
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.5 text-[9px] font-ui font-semibold rounded bg-surface border border-border-light text-muted shadow-sm">
                {typeInfo.label}
              </span>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-ui text-[15px] font-semibold text-ink truncate group-hover:text-accent transition-colors">
                    {order.product?.title || "Order"}
                  </h3>
                  <p className="text-xs font-body text-muted mt-0.5">
                    {order.order_number} · {timeAgo}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <p className="font-display text-base font-bold text-ink">
                    {formatCurrency(Number(order.total_amount ?? order.amount), order.currency)}
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
      <div className="border-t border-border-light px-4 sm:px-5 py-3 flex items-center gap-4 bg-subtle/40">
        <div className="flex-1 min-w-0">
          <OrderProgress order={order} actions={null} isBuyer compact />
        </div>
        {["paid", "partially_refunded", "refunded"].includes(order.payment_status) && (
          <Link href={`/orders/${order.id}/receipt`} className="shrink-0 text-xs font-ui font-semibold text-muted hover:text-purple-primary">Invoice</Link>
        )}
        {action && (
          <Link
            href={action.href}
            className={`shrink-0 px-4 py-1.5 rounded-lg text-xs font-ui font-semibold transition-all ${
              action.variant === "primary"
                ? "bg-purple-primary text-white hover:bg-accent/90"
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

