"use client";

import { useMemo } from "react";
import type { Order, OrderDelivery, OrderRevision, OrderWorkroom } from "@/lib/types/store";
import { getOrderKind, TONE_CLASSES, type StatusTone } from "@/lib/utils/orderStatus";
import AttachmentGrid from "./AttachmentGrid";
import { personName, shortDate, shortDateTime } from "./orderFormat";

interface OrderDeliveriesProps {
  order: Order;
  workroom: OrderWorkroom | null;
  isBuyer: boolean;
  loading: boolean;
}

function chip(text: string, tone: StatusTone) {
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[tone].chip}`}>{text}</span>;
}

function deliveryStatus(d: OrderDelivery, isBuyer: boolean): [string, StatusTone] {
  switch (d.status) {
    case "accepted": return ["Approved", "emerald"];
    case "revision_requested": return ["Revision requested", "orange"];
    case "superseded": return ["Superseded", "neutral"];
    default: return [isBuyer ? "Awaiting your review" : "Awaiting review", "indigo"];
  }
}

/** The Deliveries tab: versions newest first, with each revision request in between. */
export default function OrderDeliveries({ order, workroom, isBuyer, loading }: OrderDeliveriesProps) {
  const kind = getOrderKind(order);
  const items = useMemo(() => {
    if (!workroom) return [];
    const list: Array<{ at: string; node: "delivery"; d: OrderDelivery } | { at: string; node: "revision"; r: OrderRevision }> = [];
    for (const d of workroom.deliveries) list.push({ at: d.delivered_at, node: "delivery", d });
    for (const r of workroom.revisions) if (r.status !== "withdrawn") list.push({ at: r.requested_at, node: "revision", r });
    return list.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [workroom]);

  if (kind !== "commission") {
    return (
      <section className="rounded-2xl border border-border-light bg-surface p-8 text-center">
        <p className="text-sm font-body text-muted">{kind === "digital" ? "Digital products are delivered at payment. Your files are on the Overview tab." : "Shipping for this order is tracked on the Overview tab."}</p>
      </section>
    );
  }

  if (loading && !workroom) {
    return <div className="rounded-2xl border border-border-light bg-surface h-40 animate-pulse" />;
  }

  if (items.length === 0) {
    const other = personName(order.seller, "The creator");
    return (
      <section className="rounded-2xl border border-border-light bg-surface p-10 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 mb-3" aria-hidden="true" />
        <p className="text-sm font-ui font-semibold text-ink">Nothing delivered yet</p>
        <p className="text-sm font-body text-muted mt-1">
          {isBuyer ? `${other} is working on it` : "Deliver from the action bar when it's ready"}
          {order.due_date ? ` · due ${shortDate(order.due_date)}` : ""}
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => {
        if (item.node === "revision") {
          const r = item.r;
          return (
            <section key={r.id} className={`rounded-2xl border p-5 ${TONE_CLASSES.orange.box}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="font-display text-base font-semibold text-ink">Revision {r.number}</span>
                {chip(r.status === "open" ? "Open" : "Addressed", r.status === "open" ? "orange" : "emerald")}
                <span className="ml-auto text-2xs font-body text-muted tabular-nums">{shortDateTime(r.requested_at)}</span>
              </div>
              {r.note && <p className="text-sm font-body text-ink/90 whitespace-pre-wrap">{r.note}</p>}
              {r.attachments.length > 0 && <AttachmentGrid orderId={order.id} attachments={r.attachments} size="sm" className="mt-3" />}
            </section>
          );
        }
        const d = item.d;
        const [statusLabel, tone] = deliveryStatus(d, isBuyer);
        const addresses = d.revision_id ? workroom?.revisions.find((r) => r.id === d.revision_id) : null;
        return (
          <section key={d.id} className="rounded-2xl border border-border-light bg-surface p-5">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="font-display text-base font-semibold text-ink">Delivery v{d.version}</span>
              {d.is_final && chip("Final", "purple")}
              {chip(statusLabel, tone)}
              {addresses && <span className="text-2xs font-ui text-muted">addresses revision {addresses.number}</span>}
              <span className="ml-auto text-2xs font-body text-muted tabular-nums">{shortDateTime(d.delivered_at)}</span>
            </div>
            <AttachmentGrid orderId={order.id} attachments={d.attachments} size="lg" />
            {d.note && <p className={`text-sm font-body text-ink/90 whitespace-pre-wrap ${d.attachments.length > 0 ? "mt-3" : ""}`}>{d.note}</p>}
          </section>
        );
      })}
    </div>
  );
}
