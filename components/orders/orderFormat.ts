import type { Order, ProductSeller } from "@/lib/types/store";

/** "Sep 12" — dates on the order page are short; the year only appears when it differs. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Sep 12, 10:52" */
export function shortDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "in 9 days" / "today" / "2 days late" — relative to now, for deadlines. */
export function relativeDays(value: string, lateWord = "late"): { text: string; late: boolean } {
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (ms < 0 && days === 0) return { text: "today", late: true };
  if (days === 0) return { text: "today", late: false };
  if (days === 1) return { text: "tomorrow", late: false };
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} ${lateWord}`, late: true };
  return { text: `in ${days} days`, late: false };
}

/** "2d 23h" / "4h 12m" countdown to a deadline; "" when passed. */
export function countdown(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;
}

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
