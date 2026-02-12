"use client";

import Link from "next/link";
import Image from "next/image";
import type { Order, OrderStatus } from "@/lib/types/store";
import OrderTracker from "./OrderTracker";

function statusColor(status: OrderStatus): string {
  switch (status) {
    case "pending_acceptance":
      return "bg-amber-100 text-amber-700";
    case "pending_payment":
      return "bg-yellow-100 text-yellow-700";
    case "paid":
    case "processing":
      return "bg-blue-100 text-blue-700";
    case "in_progress":
    case "submitted":
      return "bg-purple-100 text-purple-700";
    case "revision_requested":
      return "bg-orange-100 text-orange-700";
    case "completed":
    case "delivered":
    case "resolved":
      return "bg-green-100 text-green-700";
    case "shipped":
      return "bg-indigo-100 text-indigo-700";
    case "cancelled":
    case "refunded":
    case "declined":
      return "bg-red-100 text-red-600";
    default:
      return "bg-gray-100 text-gray-600";
  }
}

function quickAction(order: Order): { label: string; href: string } | null {
  switch (order.status) {
    case "pending_payment":
      return { label: "Pay Now", href: `/checkout/${order.id}` };
    case "submitted":
      return { label: "Review Delivery", href: `/orders/${order.id}` };
    case "completed":
    case "delivered":
      return { label: "Leave Review", href: `/orders/${order.id}#reviews` };
    default:
      return null;
  }
}

export default function OrderCard({ order }: { order: Order }) {
  const isCommission = order.listing_type === "service";
  const primaryImage =
    order.product?.primary_image_url || order.product?.media?.[0]?.media_url;
  const action = quickAction(order);

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white overflow-hidden hover:border-purple-primary/20 transition-colors">
      <Link href={`/orders/${order.id}`} className="block p-4">
        <div className="flex gap-4">
          {/* Thumbnail */}
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt=""
              width={80}
              height={80}
              className="w-20 h-20 rounded-xl object-cover shrink-0"
            />
          ) : (
            <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 shrink-0 flex items-center justify-center">
              <span className="text-2xl">{isCommission ? "\u270F\uFE0F" : "\u{1F4E6}"}</span>
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
              <div className="flex items-center gap-2 shrink-0">
                <p className="font-ui font-semibold text-ink">
                  ${Number(order.amount).toFixed(2)}
                </p>
                <span
                  className={`hidden sm:inline-block px-2.5 py-1 rounded-full text-xs font-ui font-medium capitalize ${statusColor(order.status)}`}
                >
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
                      {(
                        order.seller.display_name ||
                        order.seller.username ||
                        "?"
                      )[0].toUpperCase()}
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

        {/* Mobile status badge */}
        <div className="sm:hidden mt-3">
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-ui font-medium capitalize ${statusColor(order.status)}`}
          >
            {order.status.replace(/_/g, " ")}
          </span>
        </div>
      </Link>

      {/* Tracker + Quick Action */}
      <div className="border-t border-black/[0.04] px-4 py-3 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <OrderTracker
            status={order.status}
            listingType={
              isCommission
                ? "service"
                : order.product?.delivery_type || "product"
            }
          />
        </div>
        {action && (
          <Link
            href={action.href}
            className="shrink-0 px-4 py-1.5 rounded-lg text-xs font-ui font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid text-white hover:opacity-90 transition-opacity"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
