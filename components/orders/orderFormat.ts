import type { Order, ProductSeller } from "@/lib/types/store";

// Dates live in lib/utils/time (Phase 4a); re-exported so order screens keep one import.
export { shortDate, shortDateTime, relativeDays, countdown } from "@/lib/utils/time";

export function personName(p: ProductSeller | undefined | null, fallback = "them"): string {
  return p?.display_name || p?.username || fallback;
}

export function counterparty(order: Order, isBuyer: boolean): ProductSeller | undefined {
  return isBuyer ? order.seller : order.buyer;
}

export function orderTotalForBuyer(order: Order): number {
  return Number(order.total_amount ?? order.amount);
}

export function isOrderOpen(order: Order): boolean {
  return !["completed", "cancelled", "refunded", "declined", "expired", "resolved"].includes(order.status);
}
