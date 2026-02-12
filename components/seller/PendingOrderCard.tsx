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
  const deadline = order.seller_response_deadline
    ? new Date(order.seller_response_deadline)
    : null;
  const now = new Date();
  const hoursLeft = deadline
    ? Math.max(0, Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60)))
    : null;

  return (
    <div className="rounded-2xl border-2 border-purple-primary/20 bg-gradient-to-r from-purple-50/50 to-pink-50/50 p-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        {/* Buyer info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {buyer?.avatar_url ? (
            <Image src={buyer.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full" />
          ) : (
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
              <span className="text-xs font-ui font-bold text-white">
                {(buyer?.display_name || buyer?.username || "?")[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-ui font-semibold text-ink truncate">
              {buyer?.display_name || buyer?.username || "Buyer"}
            </p>
            <p className="text-xs font-body text-muted truncate">
              {order.order_number} &middot; {order.product?.title || "Order"}
            </p>
          </div>
        </div>

        {/* Price + type */}
        <div className="text-right shrink-0">
          <p className="font-display text-lg font-bold text-ink">${Number(order.amount).toFixed(2)}</p>
          <p className="text-xs font-ui text-muted capitalize">
            {order.listing_type === "service" ? "Commission" : "Product"}
          </p>
        </div>
      </div>

      {/* Brief preview (commissions) */}
      {order.listing_type === "service" && order.brief && (
        <div className="mt-3 p-3 rounded-xl bg-white/60 border border-black/[0.04]">
          <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Brief</p>
          <p className="text-sm font-body text-ink/80 line-clamp-2">{order.brief}</p>
        </div>
      )}

      {/* Deadline warning */}
      {hoursLeft !== null && hoursLeft <= 24 && (
        <div className="mt-3 flex items-center gap-2 text-xs font-ui text-orange-600">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {hoursLeft === 0 ? "Auto-declining soon" : `Auto-declines in ${hoursLeft}h`}
        </div>
      )}

      {/* Actions */}
      {!showDeclineForm ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={() => onAccept(order.id)}
            disabled={accepting || declining}
            className="px-5 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
          >
            {accepting ? "Accepting..." : "Accept"}
          </button>
          <button
            onClick={() => setShowDeclineForm(true)}
            disabled={accepting || declining}
            className="px-5 py-2.5 rounded-xl text-sm font-ui font-medium text-red-600 border border-red-200 bg-red-50 hover:bg-red-100 disabled:opacity-60"
          >
            Decline
          </button>
          <Link
            href={`/orders/${order.id}`}
            className="px-5 py-2.5 rounded-xl text-sm font-ui font-medium text-ink border border-black/[0.08] hover:bg-black/[0.02]"
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
            className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="flex gap-2">
            <button
              onClick={async () => {
                const success = await onDecline(order.id, declineReason || undefined);
                if (success) setShowDeclineForm(false);
              }}
              disabled={declining}
              className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-red-500 disabled:opacity-60"
            >
              {declining ? "Declining..." : "Confirm Decline"}
            </button>
            <button
              onClick={() => { setShowDeclineForm(false); setDeclineReason(""); }}
              className="px-4 py-2.5 rounded-xl text-sm font-ui text-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
