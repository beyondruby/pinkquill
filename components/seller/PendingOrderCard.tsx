"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Order } from "@/lib/types/store";

interface PendingOrderCardProps {
  order: Order;
  onAccept: (orderId: string) => Promise<boolean>;
  onDecline: (orderId: string, reason?: string) => Promise<boolean>;
  accepting: boolean;
  declining: boolean;
}

export default function PendingOrderCard({
  order,
  onAccept,
  onDecline,
  accepting,
  declining,
}: PendingOrderCardProps) {
  const [showDeclineForm, setShowDeclineForm] = useState(false);
  const [declineReason, setDeclineReason] = useState("");

  const buyer = order.buyer;
  const isCommission = order.listing_type === "service";
  const deadline = order.seller_response_deadline ? new Date(order.seller_response_deadline) : null;
  const now = new Date();
  const hoursLeft = deadline
    ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)))
    : null;
  const isUrgent = hoursLeft !== null && hoursLeft <= 24;

  return (
    <div className={`rounded-xl border bg-white overflow-hidden ${
      isUrgent ? "border-orange-200" : "border-black/[0.06]"
    }`}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          {/* Buyer info */}
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {buyer?.avatar_url ? (
              <Image src={buyer.avatar_url} alt="" width={44} height={44} className="w-11 h-11 rounded-full shrink-0" />
            ) : (
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
                <span className="text-sm font-ui font-bold text-white">
                  {(buyer?.display_name || buyer?.username || "?")[0].toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-ui font-semibold text-ink truncate">
                {buyer?.display_name || buyer?.username || "Buyer"}
              </p>
              <p className="text-xs font-body text-muted truncate">
                {order.order_number} · {order.product?.title || "Order"}
              </p>
              <p className="text-xs font-ui text-muted mt-0.5">
                {isCommission ? "Commission" : "Product"} · {new Date(order.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>

          {/* Price */}
          <div className="text-left sm:text-right shrink-0">
            <p className="font-display text-xl font-bold text-ink">
              ${Number(order.amount).toFixed(2)}
            </p>
            {/* Deadline */}
            {isUrgent && (
              <div className="flex items-center gap-1.5 mt-1">
                <svg className="w-3.5 h-3.5 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                <span className="text-xs font-ui font-medium text-orange-600">
                  {hoursLeft === 0 ? "Auto-declining soon" : `${hoursLeft}h left`}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Brief preview */}
        {isCommission && order.brief && (
          <div className="mt-4 p-3 rounded-lg bg-black/[0.02] border border-black/[0.04]">
            <p className="text-[11px] font-ui uppercase tracking-wider text-muted mb-1">Brief</p>
            <p className="text-sm font-body text-ink/80 line-clamp-2">{order.brief}</p>
          </div>
        )}

        {/* Actions */}
        {!showDeclineForm ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              onClick={() => onAccept(order.id)}
              disabled={accepting || declining}
              className="px-5 py-2 rounded-lg text-sm font-ui font-semibold text-white bg-purple-primary hover:bg-purple-primary/90 disabled:opacity-50 transition-colors"
            >
              {accepting ? "Accepting..." : "Accept Order"}
            </button>
            <button
              onClick={() => setShowDeclineForm(true)}
              disabled={accepting || declining}
              className="px-5 py-2 rounded-lg text-sm font-ui font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              Decline
            </button>
            <Link
              href={`/orders/${order.id}`}
              className="px-4 py-2 rounded-lg text-sm font-ui font-medium text-muted hover:text-ink transition-colors"
            >
              View Details
            </Link>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <textarea
              rows={2}
              value={declineReason}
              onChange={(e) => setDeclineReason(e.target.value)}
              placeholder="Reason for declining (optional)..."
              className="w-full px-3.5 py-2.5 rounded-lg border border-black/[0.08] text-sm font-body text-ink placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-red-200 focus:border-red-300 transition-all resize-none"
            />
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const success = await onDecline(order.id, declineReason || undefined);
                  if (success) setShowDeclineForm(false);
                }}
                disabled={declining}
                className="px-4 py-2 rounded-lg text-sm font-ui font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
              >
                {declining ? "Declining..." : "Confirm Decline"}
              </button>
              <button
                onClick={() => { setShowDeclineForm(false); setDeclineReason(""); }}
                className="px-4 py-2 rounded-lg text-sm font-ui text-muted hover:text-ink transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
