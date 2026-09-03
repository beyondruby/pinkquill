"use client";

import type { Order, OrderRevision } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS, type DisputeReason } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderKind, getOrderProgress, TONE_CLASSES } from "@/lib/utils/orderStatus";
import type { OrderActions } from "@/lib/hooks/useDisputes";
import { countdown, orderTotalForBuyer, personName, relativeDays, shortDate, shortDateTime } from "./orderFormat";

interface Fact { label: string; value: string; tone?: "amber" }

/**
 * The deadline facts both roles see. At most three, in priority order, so the
 * card never fills up with dates.
 */
export function getOrderFacts(order: Order, actions: OrderActions | null, isBuyer: boolean): Fact[] {
  const facts: Fact[] = [];
  const kind = getOrderKind(order);
  const meta = getOrderProgress(order).meta;
  const active = !meta.terminal && !meta.paused && order.status !== "completed";

  if (order.status === "pending_acceptance" && order.seller_response_deadline) {
    facts.push({ label: isBuyer ? "Creator responds by" : "Respond by", value: shortDateTime(order.seller_response_deadline) });
  }
  if (kind === "commission" && order.due_date && active && order.status !== "pending_acceptance" && order.status !== "pending_payment") {
    const rel = relativeDays(order.due_date);
    facts.push({ label: "Due", value: `${shortDate(order.due_date)} · ${rel.text}`, tone: rel.late ? "amber" : undefined });
  }
  const autoAt = actions?.auto_complete_at ?? order.auto_completion_at;
  if (autoAt && active) {
    const left = countdown(autoAt);
    facts.push({ label: "Auto-approves", value: left ? `${shortDate(autoAt)} · in ${left}` : "any moment now" });
  }
  if (actions?.payout?.status === "sent") {
    facts.push({ label: isBuyer ? "Creator was paid" : "Paid out", value: actions.payout.sent_at ? shortDate(actions.payout.sent_at) : "sent" });
  } else if (actions?.release_at) {
    facts.push({ label: isBuyer ? "Creator is paid" : "Payout releases", value: `${shortDate(actions.release_at)} · 7 days after approval` });
  } else if (order.status === "completed" && order.completed_at) {
    facts.push({ label: "Approved", value: shortDate(order.completed_at) });
  }
  if (kind === "physical" && order.tracking_number && (order.status === "shipped" || order.status === "delivered")) {
    facts.push({ label: order.tracking_carrier ? `Tracking · ${order.tracking_carrier}` : "Tracking", value: order.tracking_number });
  }
  if (order.payment_status === "refunded" && meta.terminal) {
    facts.push({ label: "Refunded", value: formatCurrency(orderTotalForBuyer(order)) });
  }
  return facts.slice(0, 3);
}

/** One sentence for a paused or finished order, shown over the dimmed rail. */
function railNotice(order: Order, actions: OrderActions | null, isBuyer: boolean): string | null {
  const other = personName(isBuyer ? order.seller : order.buyer, isBuyer ? "the creator" : "the buyer");
  switch (order.status) {
    case "refund_requested": {
      const r = actions?.refund;
      const amount = r?.listing_amount_cents != null ? formatCurrency(r.listing_amount_cents / 100) : formatCurrency(orderTotalForBuyer(order));
      const who = r?.initiator_role === "buyer" ? (isBuyer ? "You" : other) : (isBuyer ? other : "You");
      const tail = r?.initiator_role === "buyer"
        ? (isBuyer ? "The creator decides; you'll be notified." : "Approve or decline below.")
        : "Waiting on the refund to go through.";
      return `${who} asked for a ${r?.kind === "partial" ? "partial" : "full"} refund of ${amount}. ${tail}`;
    }
    case "disputed": {
      const reason = actions?.dispute?.reason ? DISPUTE_REASON_LABELS[actions.dispute.reason as DisputeReason] ?? actions.dispute.reason : null;
      return `${actions?.dispute?.kind === "chargeback" ? "The buyer's bank opened a chargeback" : `Dispute open${reason ? ` · ${reason}` : ""}`}. Payout is on hold until it is resolved.`;
    }
    case "cancelled": {
      const by = order.cancelled_by ? (order.cancelled_by === (isBuyer ? order.buyer_id : order.seller_id) ? "you" : other) : null;
      const refund = order.payment_status === "refunded" ? " Full refund issued." : order.payment_status === "paid" ? " Refund in progress." : "";
      return `Cancelled${by ? ` by ${by}` : ""}${order.cancel_reason ? ` · "${order.cancel_reason}"` : ""}.${refund}`;
    }
    case "refunded":
      return `Refunded in full${order.cancel_reason ? ` · "${order.cancel_reason}"` : ""}. Money returns to the card in 5–10 days.`;
    case "declined":
      return `${isBuyer ? other : "You"} declined this request${order.seller_decline_reason ? ` · "${order.seller_decline_reason}"` : ""}. Nothing was charged.`;
    case "expired":
      return "Checkout expired before payment. Start a new request from the listing.";
    case "resolved":
      return "The dispute was resolved. Details are on the Overview tab.";
    default:
      return null;
  }
}

interface OrderProgressProps {
  order: Order;
  actions: OrderActions | null;
  isBuyer: boolean;
  /** The open revision request, so the rail can say what changed. */
  openRevision?: OrderRevision | null;
  /** Rail only, no dates or facts (order cards). */
  compact?: boolean;
}

const STEP_DATES: Record<string, (o: Order) => string | null> = {
  Requested: (o) => o.created_at,
  Accepted: (o) => o.seller_accepted_at,
  // orders has no paid_at column; the payment date lives on the Activity tab.
  Paid: () => null,
  "In progress": (o) => o.started_at,
  Shipped: (o) => o.shipped_at,
  Delivered: (o) => o.submitted_at ?? o.delivered_at,
  Approved: (o) => o.completed_at,
};

export default function OrderProgress({ order, actions, isBuyer, openRevision, compact = false }: OrderProgressProps) {
  const { steps, index, meta } = getOrderProgress(order);
  const dimmed = meta.paused || meta.terminal;
  const notice = compact ? null : railNotice(order, actions, isBuyer);
  const facts = compact ? [] : getOrderFacts(order, actions, isBuyer);

  const rail = (
    <div className={`flex items-start ${dimmed ? "opacity-50" : ""}`} aria-label="Order progress">
      {steps.map((step, i) => {
        // Steps the order reached stay ticked even when it paused or ended.
        const done = i < index || (i === index && (order.status === "completed" || dimmed));
        const active = i === index && !done;
        const date = !compact && (done || active) ? STEP_DATES[step]?.(order) : null;
        return (
          <div key={step} className={`flex items-center min-w-0 ${i < steps.length - 1 ? "flex-1" : ""}`}>
            <div className={`flex flex-col items-center gap-1 min-w-0 ${compact ? "w-10" : "w-14 sm:w-20"}`}>
              {done ? (
                <span className="w-5 h-5 rounded-full bg-emerald-500 text-white inline-flex items-center justify-center">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                </span>
              ) : active ? (
                <span className="w-5 h-5 rounded-full bg-purple-primary ring-4 ring-purple-primary/15 inline-flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-surface" />
                </span>
              ) : (
                <span className="w-5 h-5 rounded-full border-2 border-skeleton bg-surface inline-flex" />
              )}
              <span className={`${compact ? "text-3xs" : "text-3xs sm:text-xs"} font-ui leading-tight text-center ${active ? "text-purple-700 font-semibold" : done ? "text-ink font-medium" : "text-muted"}`}>
                {step}
              </span>
              {!compact && (
                <span className="hidden sm:block text-3xs font-body text-muted tabular-nums h-3">{date ? shortDate(date) : ""}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className={`h-[2px] flex-1 min-w-2 ${compact ? "-mt-4" : "-mt-5 sm:-mt-8"} ${i < index ? "bg-emerald-400" : "bg-skeleton"}`} />
            )}
          </div>
        );
      })}
    </div>
  );

  if (compact) return rail;

  return (
    <div>
      {notice && (
        <div className={`rounded-xl border px-3.5 py-3 text-sm font-body text-ink mb-4 ${TONE_CLASSES[meta.tone].box}`}>{notice}</div>
      )}
      {order.status === "revision_requested" && openRevision && (
        <div className={`rounded-xl border px-3.5 py-3 text-sm font-body text-ink mb-4 ${TONE_CLASSES.orange.box}`}>
          <span className="font-ui font-semibold">Revision {openRevision.number}{order.max_revisions ? ` of ${order.max_revisions}` : ""}</span>
          {openRevision.note ? <> · &ldquo;{openRevision.note}&rdquo;</> : null}
        </div>
      )}
      {rail}
      {facts.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border-light grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
          {facts.map((f) => (
            <div key={f.label} className="min-w-0">
              <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{f.label}</p>
              <p className={`text-sm font-ui font-medium mt-0.5 truncate ${f.tone === "amber" ? "text-amber-700" : "text-ink"}`}>{f.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
