"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Order, OrderWorkroom, Review } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS, DISPUTE_RESOLUTION_LABELS } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderKind, TONE_CLASSES } from "@/lib/utils/orderStatus";
import type { OrderActions } from "@/lib/hooks/useDisputes";
import { useOrderDispute } from "@/lib/hooks/useDisputes";
import { useAddReferences } from "@/lib/hooks/useOrderWorkroom";
import type { OrderQueuePosition } from "@/lib/hooks/useCommissions";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewCard from "@/components/reviews/ReviewCard";
import Button from "@/components/ui/Button";
import AttachmentGrid from "./AttachmentGrid";
import DigitalDownloadSection from "./DigitalDownloadSection";
import ShippingTracker from "./ShippingTracker";
import { isOrderOpen, orderTotalForBuyer, personName, shortDate } from "./orderFormat";

interface OrderOverviewProps {
  order: Order;
  actions: OrderActions | null;
  isBuyer: boolean;
  userId?: string;
  workroom: OrderWorkroom | null;
  refetchWorkroom: () => Promise<void>;
  queue: OrderQueuePosition | null;
  reviews: { reviews: Review[]; myReview: Review | null; loading: boolean; refetch: () => void };
  reviewOpen: boolean;
  setReviewOpen: (open: boolean) => void;
}

function Card({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return <section id={id} className={`rounded-2xl border border-border-light bg-surface p-5 ${className}`}>{children}</section>;
}

function CardTitle({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
      {right}
    </div>
  );
}

function Row({ label, value, strong = false, muted = false }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "pt-2 border-t border-border-light font-ui font-semibold text-ink" : ""}`}>
      <span className={strong ? "" : muted ? "text-muted/80" : "text-muted"}>{label}</span>
      <span className={`tabular-nums text-right ${strong ? "text-base" : muted ? "text-muted/80" : "text-ink"}`}>{value}</span>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{children}</p>;
}

// ─── cards ──────────────────────────────────────────────────────────

function DisputeCard({ order, actions, isBuyer }: { order: Order; actions: OrderActions | null; isBuyer: boolean }) {
  const { dispute, loading } = useOrderDispute(order.id);
  if (loading || !dispute) return null;
  const resolved = dispute.status === "resolved";
  const opener = dispute.initiated_by === (isBuyer ? order.buyer_id : order.seller_id) ? "You" : personName(isBuyer ? order.seller : order.buyer, "The other side");
  return (
    <Card className={resolved ? TONE_CLASSES.emerald.box : TONE_CLASSES.red.box}>
      <CardTitle title={resolved ? "Dispute resolved" : "Dispute"} right={<span className={`px-2.5 py-0.5 rounded-full border text-2xs font-ui font-semibold ${resolved ? TONE_CLASSES.emerald.chip : TONE_CLASSES.red.chip}`}>{resolved ? "Resolved" : dispute.status.replace(/_/g, " ")}</span>} />
      <div className="space-y-3 text-sm font-body">
        <div><Label>Reason</Label><p className="text-ink mt-0.5">{DISPUTE_REASON_LABELS[dispute.reason] ?? dispute.reason}</p></div>
        <div><Label>Opened by</Label><p className="text-ink mt-0.5">{opener} · {shortDate(dispute.created_at)}</p></div>
        <div><Label>What was said</Label><p className="text-ink mt-0.5 whitespace-pre-wrap">{dispute.description}</p></div>
        {actions?.dispute && actions.dispute.evidence_count > 0 && (
          <div><Label>Evidence</Label><p className="text-ink mt-0.5">{actions.dispute.evidence_count} item{actions.dispute.evidence_count === 1 ? "" : "s"} added</p></div>
        )}
        {resolved && dispute.resolution && (
          <div>
            <Label>Outcome</Label>
            <p className="text-ink font-ui font-semibold mt-0.5">{DISPUTE_RESOLUTION_LABELS[dispute.resolution] ?? dispute.resolution}{dispute.refund_amount ? ` · ${formatCurrency(dispute.refund_amount)} refunded` : ""}</p>
            {dispute.resolution_notes && <p className="text-ink/90 mt-1 whitespace-pre-wrap">{dispute.resolution_notes}</p>}
            {dispute.resolved_at && <p className="text-xs text-muted mt-1">Resolved {shortDate(dispute.resolved_at)}</p>}
          </div>
        )}
      </div>
    </Card>
  );
}

function RefundRequestCard({ order, actions, isBuyer }: { order: Order; actions: OrderActions; isBuyer: boolean }) {
  const r = actions.refund;
  if (!r) return null;
  const amount = r.listing_amount_cents != null ? r.listing_amount_cents / 100 : orderTotalForBuyer(order);
  const remaining = Math.max(Number(order.seller_amount) - amount, 0);
  return (
    <Card className={TONE_CLASSES.orange.box}>
      <CardTitle title="Refund request" right={<span className={`px-2.5 py-0.5 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES.orange.chip}`}>{r.kind === "partial" ? "Partial" : "Full"} · {formatCurrency(amount)}</span>} />
      {r.reason && <p className="text-sm font-body text-ink whitespace-pre-wrap">&ldquo;{r.reason}&rdquo;</p>}
      <p className="text-xs font-body text-muted mt-2">
        {r.kind === "partial"
          ? (isBuyer ? `If approved, ${formatCurrency(amount)} returns to your card and the order continues.` : `If you approve, ${formatCurrency(amount)} leaves your share and the order continues at ${formatCurrency(remaining)} to you.`)
          : (isBuyer ? `If approved, ${formatCurrency(amount)} returns to your card and the order is cancelled.` : "If you approve, the buyer gets everything back and the order is cancelled.")}
      </p>
    </Card>
  );
}

function ReviewsCard({ order, isBuyer, userId, reviews, reviewOpen, setReviewOpen }: Pick<OrderOverviewProps, "order" | "isBuyer" | "userId" | "reviews" | "reviewOpen" | "setReviewOpen">) {
  const canReview = !!userId && (order.listing_type === "product" ? isBuyer : true);
  const other = personName(isBuyer ? order.seller : order.buyer, isBuyer ? "the creator" : "the buyer");
  if (reviews.loading) return null;
  return (
    <Card id="reviews">
      <CardTitle title="Reviews" right={reviews.reviews.length === 0 ? <span className="text-2xs font-ui text-muted">Hidden until both post</span> : undefined} />
      {reviews.reviews.length > 0 && (
        <div className="space-y-3 mb-3">{reviews.reviews.map((review) => <ReviewCard key={review.id} review={review} />)}</div>
      )}
      {canReview && !reviews.myReview && !reviewOpen && (
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-body text-muted">{order.listing_type === "product" ? "How was the product?" : `How was working with ${other}? Reviews reveal together.`}</p>
          <Button variant="secondary" size="sm" onClick={() => setReviewOpen(true)}>Write a review</Button>
        </div>
      )}
      {canReview && !reviews.myReview && reviewOpen && (
        <ReviewForm orderId={order.id} onSubmitted={() => { setReviewOpen(false); reviews.refetch(); }} />
      )}
      {reviews.myReview && (
        <p className="text-sm font-body text-muted">Your review is in.{reviews.reviews.length === 0 ? " It shows once the other side reviews too, or after 14 days." : ""}</p>
      )}
    </Card>
  );
}

function BriefCard({ order, isBuyer, workroom, refetchWorkroom }: Pick<OrderOverviewProps, "order" | "isBuyer" | "workroom" | "refetchWorkroom">) {
  const { addReferences, loading: adding, error } = useAddReferences();
  const answers = workroom?.intake_answers ?? [];
  const references = workroom?.references ?? [];
  const legacy = answers.length === 0 && order.requirements && Object.keys(order.requirements).length > 0
    ? Object.entries(order.requirements).filter(([, v]) => v != null && String(v).trim() !== "")
    : [];
  const canAdd = isBuyer && isOrderOpen(order) && references.length < 20;
  if (!order.brief && answers.length === 0 && legacy.length === 0 && references.length === 0 && !canAdd) return null;

  const answerText = (a: OrderWorkroom["intake_answers"][number]) =>
    a.value_text ?? (Array.isArray(a.value_json) ? (a.value_json as unknown[]).map(String).join(", ") : a.value_json != null ? String(a.value_json) : "—");

  return (
    <Card>
      <CardTitle title="Brief" />
      {order.brief && <p className="text-sm font-body text-ink/90 leading-relaxed whitespace-pre-wrap">{order.brief}</p>}
      {(answers.length > 0 || legacy.length > 0) && (
        <dl className={`grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 ${order.brief ? "mt-4" : ""}`}>
          {answers.map((a) => (
            <div key={a.id} className="border-t border-border-light pt-2">
              <dt className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{a.label}</dt>
              <dd className="text-sm font-body text-ink mt-0.5 whitespace-pre-wrap">{answerText(a)}</dd>
            </div>
          ))}
          {legacy.map(([k, v]) => (
            <div key={k} className="border-t border-border-light pt-2">
              <dt className="font-ui text-2xs uppercase tracking-[0.12em] text-muted capitalize">{k.replace(/_/g, " ")}</dt>
              <dd className="text-sm font-body text-ink mt-0.5 whitespace-pre-wrap">{Array.isArray(v) ? v.join(", ") : String(v)}</dd>
            </div>
          ))}
        </dl>
      )}
      {(references.length > 0 || canAdd) && (
        <div className={order.brief || answers.length > 0 || legacy.length > 0 ? "mt-5" : ""}>
          <div className="flex items-center justify-between gap-3 mb-2.5">
            <Label>References{references.length > 0 ? ` · ${references.length}` : ""}</Label>
            {canAdd && (
              <label className="text-xs font-ui font-semibold text-purple-primary cursor-pointer hover:underline">
                {adding ? "Uploading…" : "+ Add files"}
                <input type="file" multiple className="sr-only" disabled={adding} onChange={async (e) => {
                  const files = Array.from(e.target.files ?? []);
                  e.target.value = "";
                  if (files.length === 0) return;
                  const result = await addReferences(order.id, files);
                  if (result) await refetchWorkroom();
                }} />
              </label>
            )}
          </div>
          {error && <p className="text-xs font-body text-red-600 mb-2">{error}</p>}
          {references.length > 0 ? <AttachmentGrid orderId={order.id} attachments={references} size="sm" /> : <p className="text-sm font-body text-muted">No reference files.</p>}
        </div>
      )}
    </Card>
  );
}

function ShipmentCards({ order }: { order: Order }) {
  const a = order.shipping_address;
  return (
    <>
      {order.tracking_number && (
        <Card>
          <CardTitle title="Shipment" />
          <ShippingTracker order={order} />
        </Card>
      )}
      {a && (
        <Card>
          <CardTitle title="Ships to" />
          <p className="text-sm font-body text-ink">
            <span className="font-ui font-semibold">{a.name}</span><br />
            {a.line1}{a.line2 ? <><br />{a.line2}</> : null}<br />
            {a.city}{a.state ? `, ${a.state}` : ""} {a.postal_code}<br />
            {a.country}
          </p>
        </Card>
      )}
    </>
  );
}

// ─── overview ───────────────────────────────────────────────────────

export default function OrderOverview(props: OrderOverviewProps) {
  const { order, actions, isBuyer, workroom, queue } = props;
  const kind = getOrderKind(order);
  const [copied, setCopied] = useState(false);

  const shipping = Number(order.shipping_cost || 0);
  const original = Number(order.original_amount ?? order.amount);
  const discount = Number(order.discount_amount || 0);
  const subtotal = Math.max(original - shipping, 0);
  const buyerFee = Number(order.buyer_fee || 0);
  const paid = ["paid", "partially_refunded", "refunded"].includes(order.payment_status);

  const details: Array<[string, string]> = [["Order", order.order_number], ["Ordered", shortDate(order.created_at)]];
  if (order.seller_accepted_at) details.push(["Accepted", shortDate(order.seller_accepted_at)]);
  details.push(["Payment", order.payment_status === "paid" ? "Paid · card" : order.payment_status === "refunded" ? "Refunded" : order.payment_status === "partially_refunded" ? "Partially refunded" : order.payment_status === "failed" ? "Card declined" : "Not yet paid"]);
  if (kind === "commission" && order.due_date && isOrderOpen(order)) details.push(["Due", shortDate(order.due_date)]);
  if (order.submitted_at) details.push(["Delivered", shortDate(order.submitted_at)]);
  if (order.shipped_at) details.push(["Shipped", shortDate(order.shipped_at)]);
  if (order.completed_at) details.push(["Approved", shortDate(order.completed_at)]);
  if (kind === "commission" && order.max_revisions != null) details.push(["Revisions", `${order.revision_count} of ${order.max_revisions} used`]);
  if (queue && queue.total_active > 1 && ["pending_acceptance", "pending_payment", "paid"].includes(order.status)) details.push(["Queue", `${queue.position} of ${queue.total_active}${queue.slots_total ? ` · ${queue.slots_total} slot${queue.slots_total === 1 ? "" : "s"}` : ""}`]);

  const left: ReactNode[] = [];
  if (["disputed", "resolved"].includes(order.status)) left.push(<DisputeCard key="dispute" order={order} actions={actions} isBuyer={isBuyer} />);
  if (order.status === "refund_requested" && actions?.refund) left.push(<RefundRequestCard key="refund" order={order} actions={actions} isBuyer={isBuyer} />);
  if (order.status === "completed") left.push(<ReviewsCard key="reviews" {...props} />);
  if (kind === "commission") left.push(<BriefCard key="brief" order={order} isBuyer={isBuyer} workroom={workroom} refetchWorkroom={props.refetchWorkroom} />);
  if (kind === "physical") left.push(<ShipmentCards key="ship" order={order} />);
  if (kind === "digital" && isBuyer && ["delivered", "completed"].includes(order.status)) {
    // DigitalDownloadSection draws its own card, so it is not wrapped in one.
    left.push(<div key="files" id="files"><DigitalDownloadSection orderId={order.id} /></div>);
  }
  if (kind === "digital" && order.buyer_note) left.push(<Card key="note"><CardTitle title="Note from the buyer" /><p className="text-sm font-body text-ink/90 whitespace-pre-wrap">{order.buyer_note}</p></Card>);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <div className="lg:col-span-2 space-y-5">{left}</div>
      <div className="space-y-5">
        <Card>
          <CardTitle title="Summary" right={paid ? (
            isBuyer
              ? <Link href={`/orders/${order.id}/receipt`} className="text-2xs font-ui font-semibold text-purple-primary hover:underline">Invoice · PDF</Link>
              : actions?.payout?.id ? <Link href={`/seller/payouts/${actions.payout.id}`} className="text-2xs font-ui font-semibold text-purple-primary hover:underline">Payout statement</Link> : null
          ) : undefined} />
          <div className="space-y-2 text-sm font-body">
            <Row label={kind === "commission" ? (order.pricing?.variant_name ? `${order.pricing.variant_name} package` : "Commission") : order.quantity > 1 ? `Product × ${order.quantity}` : "Product"} value={formatCurrency(subtotal)} />
            {shipping > 0 && <Row label="Shipping" value={formatCurrency(shipping)} />}
            {discount > 0 && <Row label="Discount" value={`−${formatCurrency(discount)}`} />}
            {isBuyer && buyerFee > 0 && <Row label="Processing fee" value={formatCurrency(buyerFee)} muted />}
            {!isBuyer && <Row label="Pinkquill fee · 5%" value={`−${formatCurrency(order.platform_fee)}`} muted />}
            <Row strong label={isBuyer ? (paid ? "Total paid" : "Total") : "You receive"} value={formatCurrency(isBuyer ? orderTotalForBuyer(order) : Number(order.seller_amount))} />
            {order.charge_currency && order.charge_currency !== order.currency && paid && (
              <p className="text-2xs font-body text-muted">
                {isBuyer
                  ? `Charged as ${formatCurrency(Number(order.charge_amount_cents ?? 0) / 100, order.charge_currency)}`
                  : `Paid out as ${formatCurrency(Number(order.seller_amount_charge_cents ?? 0) / 100, order.charge_currency)} at 1 ${order.currency.toUpperCase()} = ${Number(order.fx_rate ?? 1).toFixed(4)} ${order.charge_currency.toUpperCase()}`}
              </p>
            )}
            {!isBuyer && paid && (
              <Row label="Payout" value={actions?.payout?.status === "sent" ? `Sent${actions.payout.sent_at ? ` ${shortDate(actions.payout.sent_at)}` : ""}` : actions?.payout?.status === "pending" ? `Releases ${actions.release_at ? shortDate(actions.release_at) : "7 days after approval"}` : actions?.payout?.status === "blocked" ? "Held" : actions?.payout?.status === "failed" ? "Failed" : actions?.payout?.status === "reversed" ? "Reversed" : order.status === "completed" ? "Scheduling" : "After approval"} muted />
            )}
            {order.payment_status === "partially_refunded" && <p className="text-2xs font-body text-muted">Part of this order was refunded.</p>}
          </div>
        </Card>
        <Card>
          <CardTitle title="Details" right={
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(order.order_number); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="text-2xs font-ui font-semibold text-purple-primary hover:underline">{copied ? "Copied" : "Copy #"}</button>
          } />
          <div className="space-y-2 text-sm font-body">{details.map(([k, v]) => <Row key={k} label={k} value={v} />)}</div>
        </Card>
      </div>
    </div>
  );
}
