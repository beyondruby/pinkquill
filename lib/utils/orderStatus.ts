/**
 * Single source of truth for order status label/color, replacing the 6
 * divergent STATUS_CONFIG copies found in the Sep 2026 polish audit
 * (OrderCard, SellerDashboard, SellerOrdersTable, CustomersCRM each had
 * their own, with different colors for the same status and "submitted"
 * mislabeled "Delivered" in several of them).
 */

export interface OrderStatusMeta {
  label: string;
  dot: string;
  bg: string;
  text: string;
}

export const ORDER_STATUS_CONFIG: Record<string, OrderStatusMeta> = {
  pending_acceptance: { label: "Pending Approval", bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
  pending_payment: { label: "Awaiting Payment", bg: "bg-yellow-50", text: "text-yellow-700", dot: "bg-yellow-400" },
  paid: { label: "Paid", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  processing: { label: "Processing", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  in_progress: { label: "In Progress", bg: "bg-purple-50", text: "text-purple-700", dot: "bg-purple-400" },
  submitted: { label: "Submitted", bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-400" },
  revision_requested: { label: "Revision Requested", bg: "bg-orange-50", text: "text-orange-700", dot: "bg-orange-400" },
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

const DEFAULT_ORDER_STATUS_STYLE = { bg: "bg-subtle", text: "text-ink/60", dot: "bg-muted/60" };

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return (
    ORDER_STATUS_CONFIG[status] || {
      ...DEFAULT_ORDER_STATUS_STYLE,
      label: status.replace(/_/g, " "),
    }
  );
}
