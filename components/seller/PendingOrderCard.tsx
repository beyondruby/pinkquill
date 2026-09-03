"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import type { Order } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";

/**
 * A request waiting for the seller's answer, on the seller dashboard.
 * Accept / Decline live on the order page only (Phase 3a: one action bar),
 * so this card just says what is waiting and links there.
 */
export default function PendingOrderCard({ order }: { order: Order }) {
  const buyer = order.buyer;
  const isCommission = order.listing_type === "service";
  const [now] = useState(() => Date.now());
  const deadline = order.seller_response_deadline ? new Date(order.seller_response_deadline) : null;
  const hoursLeft = deadline ? Math.max(0, Math.floor((deadline.getTime() - now) / 3_600_000)) : null;
  const urgent = hoursLeft !== null && hoursLeft <= 24;

  return (
    <Link
      href={`/orders/${order.id}`}
      className="flex items-center gap-4 rounded-xl border border-border-light bg-surface p-4 hover:border-border-strong transition-colors group"
    >
      <Avatar src={buyer?.avatar_url} alt="" size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-ui font-semibold text-ink truncate group-hover:text-accent transition-colors">
          {buyer?.display_name || buyer?.username || "Buyer"}
          <span className="font-normal text-muted"> · {isCommission ? "commission" : "product"} request</span>
        </p>
        <p className="text-xs font-body text-muted truncate">{order.product?.title || "Order"}{order.brief ? ` — ${order.brief}` : ""}</p>
        {hoursLeft !== null && (
          <p className={`text-xs font-ui mt-1 ${urgent ? "text-orange-600 font-medium" : "text-muted"}`}>
            {hoursLeft === 0 ? "Auto-declines soon" : `${hoursLeft}h to respond`}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-display text-base font-bold text-ink tabular-nums">{formatCurrency(order.amount)}</p>
        <p className="text-2xs font-ui font-semibold text-purple-primary mt-1">Review →</p>
      </div>
    </Link>
  );
}
