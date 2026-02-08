"use client";

import { useMemo } from "react";
import type { Order, OrderStatus } from "@/lib/types/store";

interface OrderTimelineProps {
  order: Order;
}

interface TimelineStep {
  key: OrderStatus;
  label: string;
  description: string;
}

const COMMISSION_FLOW: TimelineStep[] = [
  { key: "paid", label: "Hired", description: "Payment confirmed" },
  { key: "in_progress", label: "In Progress", description: "Creator is working" },
  { key: "submitted", label: "Delivered", description: "Ready for review" },
  { key: "completed", label: "Completed", description: "Delivery accepted" },
];

const PRODUCT_FLOW: TimelineStep[] = [
  { key: "paid", label: "Confirmed", description: "Payment received" },
  { key: "processing", label: "Processing", description: "Being prepared" },
  { key: "shipped", label: "Shipped", description: "On the way" },
  { key: "delivered", label: "Delivered", description: "Package arrived" },
];

const DIGITAL_FLOW: TimelineStep[] = [
  { key: "paid", label: "Purchased", description: "Payment confirmed" },
  { key: "delivered", label: "Delivered", description: "Download ready" },
];

function getSteps(order: Order): TimelineStep[] {
  if (order.listing_type === "service") return COMMISSION_FLOW;

  // Check if it's a digital product (no shipping address, instant delivery)
  if (!order.shipping_address) return DIGITAL_FLOW;

  return PRODUCT_FLOW;
}

function getStatusIndex(steps: TimelineStep[], status: OrderStatus): number {
  // Map revision_requested back to in_progress step
  const effectiveStatus = status === "revision_requested" ? "in_progress" : status;
  const idx = steps.findIndex((step) => step.key === effectiveStatus);
  return idx === -1 ? -1 : idx;
}

export default function OrderTimeline({ order }: OrderTimelineProps) {
  const steps = useMemo(() => getSteps(order), [order]);
  const activeIndex = useMemo(() => getStatusIndex(steps, order.status), [steps, order.status]);

  const isCancelled = order.status === "cancelled" || order.status === "refunded";
  const isRevisionRequested = order.status === "revision_requested";

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
      <h2 className="font-display text-2xl text-ink mb-4">Timeline</h2>

      {isCancelled && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <p className="text-sm font-ui font-semibold text-red-600">
            {order.status === "refunded" ? "Order Refunded" : "Order Cancelled"}
          </p>
          {order.cancel_reason && (
            <p className="text-xs font-body text-red-500 mt-1">{order.cancel_reason}</p>
          )}
        </div>
      )}

      {isRevisionRequested && (
        <div className="mb-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3">
          <p className="text-sm font-ui font-semibold text-amber-700">
            Revision Requested (#{order.revision_count})
          </p>
          <p className="text-xs font-body text-amber-600 mt-1">
            {order.max_revisions
              ? `${order.revision_count} of ${order.max_revisions} revisions used`
              : `${order.revision_count} revision${order.revision_count !== 1 ? "s" : ""} requested`}
          </p>
        </div>
      )}

      <div className={`grid grid-cols-1 md:grid-cols-${steps.length} gap-3`}>
        {steps.map((step, index) => {
          const isActive = index <= activeIndex;
          const isCurrent = index === activeIndex;
          return (
            <div
              key={step.key}
              className={`relative rounded-xl border px-3 py-3 transition-colors ${
                isCancelled
                  ? "border-red-200/60 bg-red-50/30 opacity-50"
                  : isActive
                    ? "border-pink-vivid/40 bg-pink-50/50"
                    : "border-black/[0.08]"
              }`}
            >
              <p className="text-xs font-ui uppercase tracking-wider text-muted">Step {index + 1}</p>
              <p className={`font-ui font-semibold mt-1 ${isActive ? "text-ink" : "text-muted"}`}>
                {step.label}
              </p>
              <p className="text-xs font-body text-muted mt-1">{step.description}</p>
              {isCurrent && !isCancelled && (
                <div className="absolute top-3 right-3 w-2 h-2 rounded-full bg-pink-vivid animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
