import type { Order, OrderStatus } from "@/lib/types/store";

/**
 * The one order status map (Phase 3a). Every order surface — the order page
 * chip, the progress rail, dashboards, order cards, the activity feed —
 * derives its label, colour and step from here. Do not add a second table.
 *
 * Vocabulary: Requested → Accepted → Paid → In progress → Delivered → Approved
 * (products: Requested → Paid → Shipped → Delivered → Approved; digital
 * products skip Shipped). Paused states (refund requested, dispute) and
 * terminal states (cancelled, refunded, declined, expired, resolved) sit on
 * top of the rail as a pill instead of being a step.
 */

export type OrderStep = "Requested" | "Accepted" | "Paid" | "In progress" | "Shipped" | "Delivered" | "Approved";
export type StatusTone = "amber" | "purple" | "orange" | "indigo" | "emerald" | "sky" | "red" | "neutral";

/** Full subtle background + matching full border (never an accent-line box). */
export const TONE_CLASSES: Record<StatusTone, { chip: string; box: string; dot: string; text: string; bg: string }> = {
  amber:   { chip: "bg-amber-50 text-amber-700 border-amber-200", box: "bg-amber-50/60 border-amber-200", dot: "bg-amber-400", text: "text-amber-700", bg: "bg-amber-50" },
  purple:  { chip: "bg-purple-50 text-purple-700 border-purple-200", box: "bg-purple-50/60 border-purple-200", dot: "bg-purple-400", text: "text-purple-700", bg: "bg-purple-50" },
  orange:  { chip: "bg-orange-50 text-orange-700 border-orange-200", box: "bg-orange-50/60 border-orange-200", dot: "bg-orange-400", text: "text-orange-700", bg: "bg-orange-50" },
  indigo:  { chip: "bg-indigo-50 text-indigo-700 border-indigo-200", box: "bg-indigo-50/60 border-indigo-200", dot: "bg-indigo-400", text: "text-indigo-700", bg: "bg-indigo-50" },
  emerald: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", box: "bg-emerald-50/60 border-emerald-200", dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50" },
  sky:     { chip: "bg-sky-50 text-sky-700 border-sky-200", box: "bg-sky-50/60 border-sky-200", dot: "bg-sky-400", text: "text-sky-700", bg: "bg-sky-50" },
  red:     { chip: "bg-red-50 text-red-700 border-red-200", box: "bg-red-50/60 border-red-200", dot: "bg-red-400", text: "text-red-700", bg: "bg-red-50" },
  neutral: { chip: "bg-subtle text-muted border-border-strong", box: "bg-subtle border-border-light", dot: "bg-muted/60", text: "text-muted", bg: "bg-subtle" },
};

export interface OrderStatusMeta {
  label: string;
  tone: StatusTone;
  /** Step on the progress rail while the order is moving. */
  step: OrderStep | null;
  /** Order is waiting on a refund decision or a dispute; rail is dimmed. */
  paused: boolean;
  /** Order is over; rail is dimmed and the pill explains why. */
  terminal: boolean;
  // Kept for the dashboards / order cards that read the older shape.
  bg: string;
  text: string;
  dot: string;
}

function meta(label: string, tone: StatusTone, step: OrderStep | null, flags: { paused?: boolean; terminal?: boolean } = {}): OrderStatusMeta {
  const t = TONE_CLASSES[tone];
  return { label, tone, step, paused: !!flags.paused, terminal: !!flags.terminal, bg: t.bg, text: t.text, dot: t.dot };
}

export const ORDER_STATUS_CONFIG: Record<OrderStatus, OrderStatusMeta> = {
  pending_acceptance: meta("Requested", "amber", "Requested"),
  pending_payment:    meta("Awaiting payment", "amber", "Accepted"),
  expired:            meta("Checkout expired", "neutral", null, { terminal: true }),
  declined:           meta("Declined", "neutral", null, { terminal: true }),
  paid:               meta("Paid", "purple", "Paid"),
  processing:         meta("Preparing", "purple", "Paid"),
  in_progress:        meta("In progress", "purple", "In progress"),
  revision_requested: meta("Revision requested", "orange", "In progress"),
  submitted:          meta("Delivered · review", "indigo", "Delivered"),
  shipped:            meta("Shipped", "sky", "Shipped"),
  delivered:          meta("Delivered · review", "indigo", "Delivered"),
  completed:          meta("Approved", "emerald", "Approved"),
  refund_requested:   meta("Refund requested", "orange", null, { paused: true }),
  disputed:           meta("Dispute open", "red", null, { paused: true }),
  cancelled:          meta("Cancelled", "neutral", null, { terminal: true }),
  refunded:           meta("Refunded", "red", null, { terminal: true }),
  resolved:           meta("Resolved", "emerald", null, { terminal: true }),
};

export function getOrderStatusMeta(status: string): OrderStatusMeta {
  return ORDER_STATUS_CONFIG[status as OrderStatus] ?? meta(status.replace(/_/g, " "), "neutral", null);
}

/** Payout states as sellers and operators see them (Phase 4a: one place). */
export const PAYOUT_STATUS_META: Record<string, { label: string; tone: StatusTone; sentence: string }> = {
  pending:    { label: "On the way", tone: "purple",  sentence: "Releases 7 days after the order was approved, then goes to your Stripe account." },
  processing: { label: "Sending",    tone: "purple",  sentence: "The transfer to your Stripe account is in progress." },
  sent:       { label: "Sent",       tone: "emerald", sentence: "Transferred to your Stripe account. Stripe pays your bank on its schedule." },
  failed:     { label: "Failed",     tone: "red",     sentence: "Stripe could not complete the transfer. Check your account in Seller settings; PinkQuill retries once it is fixed." },
  blocked:    { label: "Held",       tone: "amber",   sentence: "Held until the reason below is cleared." },
  reversed:   { label: "Reversed",   tone: "red",     sentence: "Reclaimed after a refund or a lost dispute." },
  cancelled:  { label: "Cancelled",  tone: "neutral", sentence: "This payout was cancelled; the order was refunded before release." },
};
export function getPayoutStatusMeta(status: string) {
  return PAYOUT_STATUS_META[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as StatusTone, sentence: "" };
}

/** Refund states, operator wording. */
export const REFUND_STATUS_META: Record<string, { label: string; tone: StatusTone }> = {
  requested:    { label: "Waiting on seller",  tone: "amber" },
  approved:     { label: "Approved · sending", tone: "purple" },
  processing:   { label: "Sending",            tone: "purple" },
  succeeded:    { label: "Refunded",           tone: "emerald" },
  needs_review: { label: "Needs review",       tone: "red" },
  failed:       { label: "Failed",             tone: "red" },
  declined:     { label: "Declined",           tone: "neutral" },
  cancelled:    { label: "Cancelled",          tone: "neutral" },
};
export function getRefundStatusMeta(status: string) {
  return REFUND_STATUS_META[status] ?? { label: status.replace(/_/g, " "), tone: "neutral" as StatusTone };
}

export type OrderKind = "commission" | "physical" | "digital";

export function getOrderKind(order: Pick<Order, "listing_type" | "product" | "shipping_address">): OrderKind {
  if (order.listing_type === "service") return "commission";
  if (order.product?.delivery_type === "digital") return "digital";
  if (order.product?.delivery_type === "physical" || order.shipping_address) return "physical";
  return "digital";
}

/** Did this order go through seller approval? Only then does "Accepted" earn a step. */
export function usesApprovalStep(order: Pick<Order, "status" | "seller_accepted_at" | "seller_response_deadline">): boolean {
  return order.status === "pending_acceptance" || order.status === "declined" || !!order.seller_accepted_at || !!order.seller_response_deadline;
}

export function getOrderSteps(order: Pick<Order, "listing_type" | "product" | "shipping_address" | "status" | "seller_accepted_at" | "seller_response_deadline">): OrderStep[] {
  const kind = getOrderKind(order);
  if (kind === "physical") return ["Requested", "Paid", "Shipped", "Delivered", "Approved"];
  if (kind === "digital") return ["Requested", "Paid", "Delivered", "Approved"];
  return usesApprovalStep(order)
    ? ["Requested", "Accepted", "Paid", "In progress", "Delivered", "Approved"]
    : ["Requested", "Paid", "In progress", "Delivered", "Approved"];
}

export interface OrderProgressState {
  steps: OrderStep[];
  /** Index of the current (or last reached, when paused/terminal) step. */
  index: number;
  meta: OrderStatusMeta;
}

/** Where the order sits on its rail. For paused/terminal orders, the furthest step it reached. */
export function getOrderProgress(order: Order): OrderProgressState {
  const steps = getOrderSteps(order);
  const m = getOrderStatusMeta(order.status);
  let step: OrderStep | null = m.step;
  if (!step) {
    if (order.completed_at) step = "Approved";
    else if (order.submitted_at || order.delivered_at) step = "Delivered";
    else if (order.shipped_at) step = "Shipped";
    else if (order.started_at) step = "In progress";
    else if (order.payment_status === "paid" || order.payment_status === "partially_refunded" || order.payment_status === "refunded") step = "Paid";
    else if (order.seller_accepted_at) step = "Accepted";
    else step = "Requested";
  }
  let index = steps.indexOf(step);
  if (index === -1) index = 0;
  return { steps, index, meta: m };
}
