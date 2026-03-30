"use client";

import type { OrderStatus } from "@/lib/types/store";

interface Step {
  label: string;
  status: "done" | "active" | "upcoming";
}

function getSteps(orderStatus: OrderStatus, listingType: string): Step[] {
  if (listingType === "service") {
    const steps = ["Placed", "Accepted", "Paid", "In Progress", "Delivered", "Completed"];
    const statusMap: Record<string, number> = {
      pending_acceptance: 0,
      pending_payment: 1,
      paid: 2,
      in_progress: 3,
      submitted: 4,
      revision_requested: 3,
      completed: 5,
      cancelled: -1,
      declined: -1,
      refunded: -1,
      disputed: -1,
      refund_requested: -1,
      resolved: -1,
    };
    const currentIdx = statusMap[orderStatus] ?? -1;
    return steps.map((label, i) => ({
      label,
      status: i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming",
    }));
  }

  const isDigital = listingType === "digital";
  const steps = isDigital
    ? ["Placed", "Paid", "Processing", "Completed"]
    : ["Placed", "Paid", "Processing", "Shipped", "Delivered"];

  const statusMap: Record<string, number> = isDigital
    ? { pending_acceptance: 0, pending_payment: 0, paid: 1, processing: 2, in_progress: 2, completed: 3, delivered: 3, cancelled: -1, declined: -1, refunded: -1, disputed: -1, refund_requested: -1, resolved: -1 }
    : { pending_acceptance: 0, pending_payment: 0, paid: 1, processing: 2, in_progress: 2, shipped: 3, delivered: 4, completed: 4, cancelled: -1, declined: -1, refunded: -1, disputed: -1, refund_requested: -1, resolved: -1 };

  const currentIdx = statusMap[orderStatus] ?? -1;
  return steps.map((label, i) => ({
    label,
    status: i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming",
  }));
}

const TERMINAL_STATUSES = ["cancelled", "declined", "refunded", "disputed", "refund_requested", "resolved"];

const TERMINAL_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  cancelled: { label: "Cancelled", color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  declined: { label: "Declined", color: "text-red-600", bg: "bg-red-50", border: "border-red-100" },
  refunded: { label: "Refunded", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
  disputed: { label: "Disputed", color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-100" },
  refund_requested: { label: "Refund Requested", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-100" },
  resolved: { label: "Resolved", color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-100" },
};

export default function OrderTracker({
  status,
  listingType,
  compact = false,
}: {
  status: OrderStatus;
  listingType: string;
  compact?: boolean;
}) {
  if (TERMINAL_STATUSES.includes(status)) {
    const config = TERMINAL_CONFIG[status] || TERMINAL_CONFIG.cancelled;
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${config.bg} border ${config.border}`}>
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span className={`text-xs font-ui font-medium ${config.color}`}>
          {config.label}
        </span>
      </div>
    );
  }

  const steps = getSteps(status, listingType);

  return (
    <div className="flex items-center w-full gap-0">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 min-w-0">
          {/* Step dot + label */}
          <div className="flex flex-col items-center gap-1 min-w-0">
            <div className="relative">
              {step.status === "done" ? (
                <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              ) : step.status === "active" ? (
                <div className="w-5 h-5 rounded-full bg-purple-primary ring-4 ring-purple-primary/15 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-white" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border-2 border-gray-200 bg-white" />
              )}
            </div>
            {!compact && (
              <span
                className={`text-[10px] font-ui text-center leading-tight w-full ${
                  step.status === "active"
                    ? "font-semibold text-purple-primary"
                    : step.status === "done"
                      ? "font-medium text-green-600"
                      : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            )}
          </div>
          {/* Connector line */}
          {i < steps.length - 1 && (
            <div
              className={`h-[2px] flex-1 min-w-3 ${compact ? "" : "mt-[-14px]"} ${
                step.status === "done" ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
