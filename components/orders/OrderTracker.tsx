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
    };
    const currentIdx = statusMap[orderStatus] ?? -1;
    return steps.map((label, i) => ({
      label,
      status: i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming",
    }));
  }

  // Physical or digital product
  const isDigital = listingType === "digital";
  const steps = isDigital
    ? ["Placed", "Paid", "Processing", "Completed"]
    : ["Placed", "Paid", "Processing", "Shipped", "Delivered"];

  const statusMap: Record<string, number> = isDigital
    ? { pending_acceptance: 0, pending_payment: 0, paid: 1, processing: 2, in_progress: 2, completed: 3, delivered: 3, cancelled: -1, declined: -1, refunded: -1 }
    : { pending_acceptance: 0, pending_payment: 0, paid: 1, processing: 2, in_progress: 2, shipped: 3, delivered: 4, completed: 4, cancelled: -1, declined: -1, refunded: -1 };

  const currentIdx = statusMap[orderStatus] ?? -1;
  return steps.map((label, i) => ({
    label,
    status: i < currentIdx ? "done" : i === currentIdx ? "active" : "upcoming",
  }));
}

export default function OrderTracker({
  status,
  listingType,
}: {
  status: OrderStatus;
  listingType: string;
}) {
  const terminal = ["cancelled", "declined", "refunded"];
  if (terminal.includes(status)) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 border border-red-200/50">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="text-sm font-ui font-medium text-red-700 capitalize">
          {status.replace(/_/g, " ")}
        </span>
      </div>
    );
  }

  const steps = getSteps(status, listingType);

  return (
    <div className="flex items-center gap-1 w-full">
      {steps.map((step, i) => (
        <div key={step.label} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <div
              className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 ${
                step.status === "done"
                  ? "bg-green-500 border-green-500"
                  : step.status === "active"
                    ? "bg-purple-primary border-purple-primary"
                    : "bg-white border-gray-300"
              }`}
            />
            <span
              className={`text-[10px] font-ui text-center leading-tight truncate w-full ${
                step.status === "active"
                  ? "font-semibold text-purple-primary"
                  : step.status === "done"
                    ? "text-green-700"
                    : "text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 flex-1 min-w-2 mt-[-14px] ${
                step.status === "done" ? "bg-green-400" : "bg-gray-200"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}
