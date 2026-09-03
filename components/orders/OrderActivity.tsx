"use client";

import type { Order, OrderEvent } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderStatusMeta } from "@/lib/utils/orderStatus";
import { orderTotalForBuyer, personName, shortDateTime } from "./orderFormat";

interface OrderActivityProps {
  order: Order;
  events: OrderEvent[];
  loading: boolean;
  isBuyer: boolean;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

/** Turn an order_events row into one sentence in the page's vocabulary. */
function describe(e: OrderEvent, order: Order, isBuyer: boolean): string | null {
  const who = (id: string | null | undefined): string => {
    if (!id) return "Pinkquill";
    if (id === order.buyer_id) return isBuyer ? "You" : personName(order.buyer, "The buyer");
    if (id === order.seller_id) return isBuyer ? personName(order.seller, "The creator") : "You";
    return "Pinkquill";
  };
  const actor = who(e.actor_id);
  const m = e.metadata ?? {};
  const to = e.to_status;

  switch (e.event_type) {
    case "payment": {
      const action = str(m.action) ?? str(m.type);
      if (action && /refund/.test(action)) return `Refund recorded${typeof m.amount === "number" ? ` · ${formatCurrency(m.amount)}` : ""}`;
      return `Payment confirmed · ${formatCurrency(orderTotalForBuyer(order))}`;
    }
    case "revision":
      return `${actor} requested revision ${typeof m.number === "number" ? m.number : order.revision_count}`;
    case "dispute": {
      const action = str(m.action) ?? str(m.event) ?? "";
      if (/resolve/.test(action)) return "Dispute resolved";
      if (/evidence/.test(action)) return `${actor} added evidence`;
      if (/chargeback/.test(action) || str(m.kind) === "chargeback") return "The buyer's bank opened a chargeback";
      return `${actor} opened a dispute`;
    }
    case "amount_mismatch":
      return isBuyer ? "A payment didn't match the order total and was refunded" : "A payment didn't match the order total and was refunded automatically";
    case "transfer_failed":
      return isBuyer ? null : "Payout attempt failed · Pinkquill is looking into it";
    case "system":
      return str(m.message) ?? str(m.note) ?? "Order updated";
    case "status_change":
    default: {
      if (!to) return str(m.message) ?? null;
      switch (to) {
        case "pending_acceptance": return `${actor} requested this order`;
        case "pending_payment": return e.from_status === "pending_acceptance" ? `${actor} accepted the request` : `${actor} placed the order`;
        case "paid": return e.from_status === "refund_requested" ? "Refund request declined · order resumed" : `Payment confirmed · ${formatCurrency(orderTotalForBuyer(order))}`;
        case "in_progress": return e.from_status === "revision_requested" ? `${actor} started the revision` : e.from_status === "refund_requested" ? "Refund request declined · work resumed" : `${actor} started work`;
        case "submitted": return `${actor} delivered${typeof m.version === "number" ? ` v${m.version}` : ""}${m.is_final ? " · final" : ""}`;
        case "revision_requested": return `${actor} requested a revision`;
        case "completed": return e.actor_id ? `${actor} approved the delivery · order complete` : "Auto-approved · order complete";
        case "processing": return `${actor} is preparing the order`;
        case "shipped": return `${actor} shipped the order${str(m.tracking_number) ? ` · ${m.tracking_number}` : ""}`;
        case "delivered": return e.actor_id ? `${actor} marked it delivered` : "Files delivered";
        case "cancelled": return `${actor} cancelled the order`;
        case "declined": return `${actor} declined the request`;
        case "refund_requested": return `${actor} requested a refund`;
        case "refunded": return "Refund completed";
        case "disputed": return `${actor} opened a dispute`;
        case "resolved": return "Dispute resolved";
        case "expired": return "Checkout expired";
        default: return `Status changed to ${getOrderStatusMeta(to).label}`;
      }
    }
  }
}

/** The Activity tab: the order's event log, newest first, in plain words. */
export default function OrderActivity({ order, events, loading, isBuyer }: OrderActivityProps) {
  if (loading && events.length === 0) {
    return <div className="rounded-2xl border border-border-light bg-surface h-40 animate-pulse" />;
  }
  const rows = events
    .map((e) => ({ id: e.id, at: e.created_at, text: describe(e, order, isBuyer) }))
    .filter((r): r is { id: string; at: string; text: string } => !!r.text)
    .reverse();

  if (rows.length === 0) {
    return (
      <section className="rounded-2xl border border-border-light bg-surface p-8 text-center">
        <p className="text-sm font-body text-muted">No activity yet.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border-light bg-surface p-5">
      <ol>
        {rows.map((r, i) => (
          <li key={r.id} className={`flex gap-4 ${i < rows.length - 1 ? "pb-4" : ""}`}>
            <div className="flex flex-col items-center">
              <span className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? "bg-purple-primary ring-4 ring-purple-primary/15" : "bg-skeleton"}`} />
              {i < rows.length - 1 && <span className="w-px flex-1 bg-border-strong mt-1" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-body text-ink">{r.text}</p>
              <p className="text-2xs font-ui text-muted tabular-nums mt-0.5">{shortDateTime(r.at)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
