"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import type { Order, OrderWorkroom } from "@/lib/types/store";
import { formatCurrency } from "@/lib/utils/currency";
import { getOrderKind } from "@/lib/utils/orderStatus";
import type { OrderActions } from "@/lib/hooks/useDisputes";
import { useApproveRefund, useDeclineRefund } from "@/lib/hooks/useDisputes";
import { useAcceptOrder, useUpdateOrderStatus } from "@/lib/hooks/useOrders";
import { useRespondExtension, useWithdrawExtension } from "@/lib/hooks/useTimeline";
import { actionToast, showToast } from "@/lib/utils/toast";
import OrderSheets, { type SheetKind } from "./OrderSheets";
import { countdown, orderTotalForBuyer, personName, relativeDays, shortDate, shortDateTime } from "./orderFormat";

interface OrderActionBarProps {
  order: Order;
  actions: OrderActions | null;
  isBuyer: boolean;
  workroom: OrderWorkroom | null;
  /** True once the current user has left their review (hides "Leave a review"). */
  hasReviewed: boolean;
  /** Re-read order, actions, workroom and events after a write. */
  onChanged: () => void;
  onLeaveReview: () => void;
  onDownloadFiles: () => void;
}

interface Btn { label: string; onClick: () => void; variant?: "primary" | "secondary"; loading?: boolean; disabled?: boolean }

/** One sentence that says what is happening and who the order is waiting on. */
function hintFor(order: Order, actions: OrderActions | null, isBuyer: boolean, workroom: OrderWorkroom | null): string {
  const other = personName(isBuyer ? order.seller : order.buyer, isBuyer ? "the creator" : "the buyer");
  const kind = getOrderKind(order);
  const due = order.due_date ? shortDate(order.due_date) : null;
  const late = order.due_date ? relativeDays(order.due_date) : null;
  const ext = actions?.extension;
  if (ext && ["paid", "in_progress", "revision_requested"].includes(order.status)) {
    const days = Math.max(1, Math.round((new Date(ext.new_due_date).getTime() - new Date(ext.old_due_date ?? ext.requested_at).getTime()) / 86_400_000));
    return isBuyer
      ? `${other} asked for ${days} more day${days === 1 ? "" : "s"} · due ${shortDate(ext.new_due_date)} if you accept`
      : `Waiting for ${other} to answer your request for ${days} more day${days === 1 ? "" : "s"}`;
  }
  switch (order.status) {
    case "pending_acceptance":
      return isBuyer
        ? `Waiting for ${other} to accept${order.seller_response_deadline ? ` · by ${shortDateTime(order.seller_response_deadline)}` : ""}`
        : `Accept or decline${order.seller_response_deadline ? ` by ${shortDateTime(order.seller_response_deadline)} or it auto-declines` : ""}`;
    case "pending_payment":
      return isBuyer ? "Your card is charged now; the creator is paid after you approve the work." : `Waiting for ${other} to pay`;
    case "paid":
      return kind === "commission"
        ? (isBuyer ? `${other} hasn't started yet${due ? ` · due ${due}` : ""}` : `Start when you're ready${due ? ` · due ${due}` : ""}`)
        : (isBuyer ? `Waiting for ${other} to ship` : "Add tracking once it's on its way");
    case "processing":
      return isBuyer ? `${other} is preparing your order` : "Add tracking once it's on its way";
    case "in_progress":
      if (late?.late) return isBuyer ? `${late.text} · you can cancel for a full refund` : `${late.text} · the buyer can cancel for a full refund`;
      return isBuyer ? `${other} is working${due ? ` · due ${due}` : ""}` : `Deliver when it's ready${due ? ` · due ${due}` : ""}`;
    case "revision_requested": {
      const n = order.revision_count;
      return isBuyer ? `Revision ${n} sent · waiting for ${other}` : `Revision ${n}${order.max_revisions ? ` of ${order.max_revisions}` : ""}${due ? ` · due ${due}` : ""}`;
    }
    case "submitted":
    case "delivered": {
      const auto = actions?.auto_complete_at ?? order.auto_completion_at;
      const when = auto ? `${shortDate(auto)}${countdown(auto) ? ` (${countdown(auto)})` : ""}` : null;
      if (kind === "digital") return isBuyer ? `Your files are ready${when ? ` · auto-approves ${when}` : ""}` : `Delivered at payment${when ? ` · auto-approves ${when}` : ""}`;
      return isBuyer ? `Review the delivery${when ? ` · auto-approves ${when} if you do nothing` : ""}` : `Waiting for ${other} to review${when ? ` · auto-approves ${when}` : ""}`;
    }
    case "shipped":
      return isBuyer ? `On its way${order.tracking_number ? ` · ${order.tracking_number}` : ""}` : `Shipped${order.shipped_at ? ` ${shortDate(order.shipped_at)}` : ""} · mark it delivered when it arrives`;
    case "completed": {
      const sent = actions?.payout?.status === "sent";
      const rel = actions?.release_at ? shortDate(actions.release_at) : null;
      const payout = sent ? (isBuyer ? "creator paid" : "paid out") : rel ? (isBuyer ? `creator is paid ${rel}` : `payout releases ${rel}`) : null;
      return `Approved${order.completed_at ? ` ${shortDate(order.completed_at)}` : ""}${payout ? ` · ${payout}` : ""}`;
    }
    case "refund_requested":
      return actions?.can_decide_refund ? "A partial refund comes out of your share; a full one cancels the order." : `Waiting for ${other} to answer the refund request`;
    case "disputed":
      return actions?.dispute?.evidence_due_by ? `Paused · add evidence by ${shortDate(actions.dispute.evidence_due_by)}` : "Paused while Pinkquill reviews both sides";
    case "cancelled":
      return isBuyer ? (order.payment_status === "refunded" ? `${formatCurrency(orderTotalForBuyer(order))} back on your card in 5–10 days` : "Nothing was charged") : (order.payment_status === "refunded" ? `${formatCurrency(orderTotalForBuyer(order))} refunded to the buyer` : "Nothing was charged");
    case "refunded":
      return "Refunded in full";
    case "declined":
      return isBuyer ? "The creator declined this request. Nothing was charged." : "You declined this request.";
    case "expired":
      return "Checkout expired. Nothing was charged.";
    case "resolved":
      return "Dispute resolved";
    default:
      return workroom ? "" : "";
  }
}

export default function OrderActionBar({ order, actions, isBuyer, workroom, hasReviewed, onChanged, onLeaveReview, onDownloadFiles }: OrderActionBarProps) {
  const router = useRouter();
  const [sheet, setSheet] = useState<SheetKind | null>(null);
  const { acceptOrder, accepting, error: acceptError } = useAcceptOrder();
  const { updateStatus, updating, error: updateError } = useUpdateOrderStatus();
  const { approveRefund, loading: approving, error: approveError } = useApproveRefund();
  const { declineRefund, loading: decliningRefund, error: declineRefundError } = useDeclineRefund();
  const { respondExtension, loading: responding, error: respondError } = useRespondExtension();
  const { withdrawExtension, loading: withdrawing } = useWithdrawExtension();
  const kind = getOrderKind(order);
  const hint = hintFor(order, actions, isBuyer, workroom);

  const run = async (work: () => Promise<boolean | object | null>, success: string) => {
    const result = await work();
    if (result) { showToast.success(success); onChanged(); return; }
    // The hooks keep the RPC's sentence; map it to one readable toast.
    actionToast.orderError([updateError, acceptError, approveError, declineRefundError, respondError].find(Boolean));
  };

  const primary: Btn[] = [];
  const secondary: Btn[] = [];
  const overflow: ActionMenuItem[] = [];
  const busy = accepting || updating || approving || decliningRefund || Boolean(responding) || withdrawing;

  if (actions) {
    if (actions.can_accept) primary.push({ label: "Accept request", loading: accepting, disabled: busy, onClick: () => run(() => acceptOrder(order.id), "Request accepted — waiting for payment") });
    if (actions.can_decline) secondary.push({ label: "Decline", disabled: busy, onClick: () => setSheet("decline") });
    if (actions.can_pay) primary.push({ label: `Pay ${formatCurrency(orderTotalForBuyer(order))}`, onClick: () => router.push(`/checkout/${order.id}`) });
    if (actions.can_start) primary.push({ label: order.status === "revision_requested" ? "Start revision" : "Start work", loading: updating, disabled: busy, onClick: () => run(() => updateStatus(order.id, "in_progress"), order.status === "revision_requested" ? "Revision started" : "Work started") });
    if (actions.can_deliver) primary.push({ label: "Deliver work", disabled: busy, onClick: () => setSheet("deliver") });
    if (actions.can_ship) primary.push({ label: "Add tracking", disabled: busy, onClick: () => setSheet("tracking") });
    if (actions.can_mark_delivered) primary.push({ label: "Mark as delivered", loading: updating, disabled: busy, onClick: () => run(() => updateStatus(order.id, "delivered"), "Marked as delivered") });
    if (actions.can_accept_delivery) {
      if (kind === "digital") primary.push({ label: "Download files", onClick: onDownloadFiles });
      primary.push({ label: kind === "commission" ? "Approve delivery" : "Confirm receipt", loading: updating, disabled: busy, variant: kind === "digital" ? "secondary" : "primary", onClick: () => run(() => updateStatus(order.id, "completed"), kind === "commission" ? "Delivery approved — thank you" : "Order complete — thank you") });
    }
    if (actions.can_respond_extension && actions.extension) {
      const ext = actions.extension;
      primary.push({ label: `Accept new date · ${shortDate(ext.new_due_date)}`, loading: responding === "accept", disabled: busy, onClick: () => run(() => respondExtension(ext.id, true), `New due date agreed: ${shortDate(ext.new_due_date)}`) });
      secondary.push({ label: "Keep original date", loading: responding === "decline", disabled: busy, onClick: () => run(() => respondExtension(ext.id, false), "Kept the original due date") });
    }
    if (actions.can_request_extension && order.due_date) secondary.push({ label: "Ask for more time", disabled: busy, onClick: () => setSheet("extension") });
    if (actions.can_request_revision) secondary.push({ label: `Request revision${actions.revisions_left != null ? ` · ${actions.revisions_left} left` : ""}`, disabled: busy, onClick: () => setSheet("revision") });
    if (actions.can_decide_refund) {
      primary.push({ label: `Approve ${actions.refund?.listing_amount_cents != null ? formatCurrency(actions.refund.listing_amount_cents / 100) + " " : ""}refund`, loading: approving, disabled: busy, onClick: () => run(() => approveRefund(order.id), "Refund approved") });
      secondary.push({ label: "Decline", loading: decliningRefund, disabled: busy, onClick: () => run(() => declineRefund(order.id), "Refund request declined") });
    }
    if (actions.can_add_evidence) secondary.push({ label: "Add evidence", onClick: () => setSheet("evidence") });
    if (order.status === "completed" && !hasReviewed) primary.push({ label: "Leave a review", onClick: onLeaveReview });

    if (actions.can_cancel) {
      const label = actions.cancel_mode === "request" ? "Ask to cancel" : actions.cancel_mode === "refund" ? "Cancel and refund" : "Cancel order";
      overflow.push({ label, tone: "danger", onSelect: () => setSheet("cancel") });
    }
    if (actions.extension?.mine) overflow.push({ label: "Withdraw time request", onSelect: () => run(() => withdrawExtension(actions.extension!.id), "Request withdrawn") });
    if (actions.can_request_refund) overflow.push({ label: "Request a refund", tone: "warning", onSelect: () => setSheet("refund") });
    if (actions.can_issue_refund && order.status !== "refund_requested") overflow.push({ label: "Issue a refund", tone: "warning", onSelect: () => setSheet("refund") });
    if (actions.can_open_dispute) overflow.push({ label: "Open a dispute", tone: "danger", onSelect: () => setSheet("dispute") });
    if (isBuyer && kind === "commission" && ["pending_acceptance", "pending_payment"].includes(order.status)) overflow.push({ label: "Edit brief", onSelect: () => setSheet("brief"), dividerBefore: overflow.length > 0 });
  }

  const renderButtons = (fullWidth: boolean) => (
    <>
      {secondary.map((b) => (
        <Button key={b.label} variant="secondary" size="md" onClick={b.onClick} disabled={b.disabled} loading={b.loading} fullWidth={fullWidth} className={fullWidth ? "min-w-0" : ""}>{b.label}</Button>
      ))}
      {primary.map((b) => (
        <Button key={b.label} variant={b.variant ?? "primary"} size="md" onClick={b.onClick} disabled={b.disabled} loading={b.loading} fullWidth={fullWidth} className={fullWidth ? "min-w-0" : ""}>{b.label}</Button>
      ))}
      {overflow.length > 0 && (
        <ActionMenu
          items={overflow}
          buttonAriaLabel="More order actions"
          buttonClassName="w-10 h-10 rounded-full bg-subtle text-muted hover:text-ink inline-flex items-center justify-center shrink-0 transition-colors"
          placement="top"
          portal
        />
      )}
    </>
  );

  const nothing = primary.length === 0 && secondary.length === 0 && overflow.length === 0;

  return (
    <>
      {/* Desktop: a row inside the progress card */}
      <div className="hidden md:flex items-center justify-between gap-4 mt-4 pt-4 border-t border-border-light">
        <p className="text-sm font-body text-muted min-w-0 truncate">{hint}</p>
        {!nothing && <div className="flex items-center gap-2 shrink-0">{renderButtons(false)}</div>}
      </div>

      {/* Phone: docked above the app's bottom nav */}
      {(!nothing || hint) && (
        <div className="md:hidden fixed inset-x-0 bottom-16 z-(--z-sticky) bg-surface/95 backdrop-blur-xl border-t border-border-light px-4 pt-3 pb-3">
          {hint && <p className="text-xs font-body text-muted mb-2.5 truncate">{hint}</p>}
          {!nothing && <div className="flex items-center gap-2">{renderButtons(true)}</div>}
        </div>
      )}

      <OrderSheets
        kind={sheet}
        order={order}
        actions={actions}
        isBuyer={isBuyer}
        workroom={workroom}
        onClose={() => setSheet(null)}
        onDone={(message) => { setSheet(null); showToast.success(message); onChanged(); }}
      />
    </>
  );
}
