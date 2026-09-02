"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUpdateOrderStatus, useAcceptOrder, useDeclineOrder } from "@/lib/hooks/useOrders";
import { useRequestRefund, useApproveRefund, useDeclineRefund, useCancelOrder, useIssueRefund, useOrderActions } from "@/lib/hooks/useDisputes";
import DisputeModal from "./DisputeModal";
import type { Order, OrderStatus } from "@/lib/types/store";

interface OrderActionsProps {
  order: Order;
  onUpdate?: (order: Order) => void;
}

export default function OrderActions({ order, onUpdate }: OrderActionsProps) {
  const { user } = useAuth();
  const { updateStatus, updating, error } = useUpdateOrderStatus();
  const { acceptOrder, accepting } = useAcceptOrder();
  const { declineOrder, declining } = useDeclineOrder();
  const { requestRefund, loading: requestingRefund, error: requestRefundError } = useRequestRefund();
  const { approveRefund, loading: approvingRefund, error: approveRefundError } = useApproveRefund();
  const { declineRefund, loading: decliningRefund, error: declineRefundError } = useDeclineRefund();
  const { cancelOrder, loading: cancelling, error: cancelError } = useCancelOrder();
  const { issueRefund, loading: issuingRefund, error: issueRefundError } = useIssueRefund();
  // The server decides what is allowed (get_order_actions); the UI only renders it.
  const { actions } = useOrderActions(order.id, `${order.status}:${order.updated_at}`);
  const [deliveryNote, setDeliveryNote] = useState("");
  const [declineReason, setDeclineReason] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);
  const [showDispute, setShowDispute] = useState(false);
  const [showRefund, setShowRefund] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const isBuyer = !!user && user.id === order.buyer_id;
  const isSeller = !!user && user.id === order.seller_id;

  if (!isBuyer && !isSeller) return null;

  const handleAction = async (status: OrderStatus, options?: Record<string, string | string[] | undefined>) => {
    const result = await updateStatus(order.id, status, options);
    if (result && onUpdate) onUpdate(result);
  };

  const handleBuyerRefundRequest = async () => {
    const success = await requestRefund(order.id, refundReason || undefined);
    if (success) {
      setShowRefund(false);
      setRefundReason("");
      if (onUpdate) onUpdate({ ...order, status: "refund_requested", cancel_reason: refundReason || null });
    }
  };

  const handleSellerApproveRefund = async () => {
    const success = await approveRefund(order.id, refundReason || undefined);
    if (success) {
      setShowRefund(false);
      setRefundReason("");
      if (onUpdate) onUpdate({ ...order, status: "cancelled" });
    }
  };

  const handleSellerIssueRefund = async () => {
    const success = await issueRefund(order.id, undefined, refundReason || undefined);
    if (success) {
      setShowRefund(false);
      setRefundReason("");
      if (onUpdate) onUpdate({ ...order, status: "cancelled" });
    }
  };

  const handleCancel = async () => {
    const result = await cancelOrder(order.id, cancelReason || undefined);
    if (result) {
      setShowCancel(false);
      setCancelReason("");
      if (onUpdate) onUpdate({ ...order, status: result.outcome === "requested" ? "refund_requested" : "cancelled" });
    }
  };

  const isTerminal =
    ["completed", "cancelled", "refunded", "resolved", "declined"].includes(order.status)
    || (!isBuyer && order.status === "delivered");

  // ─── Terminal States ────────────────────────────────────────────
  if (isTerminal) return null;

  // ─── Pending Acceptance ─────────────────────────────────────────
  if (order.status === "pending_acceptance") {
    if (isBuyer) return null; // Banner handles buyer side

    return (
      <ActionCard accent="purple">
        <div className="flex items-center gap-3 mb-3">
          <ActionIcon color="purple" path="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          <div>
            <p className="text-sm font-ui font-semibold text-ink">New Order Request</p>
            <p className="text-xs font-body text-muted">Review and respond to this order</p>
          </div>
        </div>

        {order.brief && (
          <div className="p-3 rounded-xl border border-border-light bg-surface/80 mb-3">
            <p className="text-[11px] font-ui uppercase tracking-wider text-muted mb-1">Brief</p>
            <p className="text-sm font-body text-ink whitespace-pre-wrap">{order.brief}</p>
          </div>
        )}

        {order.seller_response_deadline && (
          <p className="text-xs font-body text-muted mb-3">
            Respond by {new Date(order.seller_response_deadline).toLocaleString()} or the order will auto-decline.
          </p>
        )}

        <div className="flex flex-wrap gap-2.5">
          <PrimaryButton
            onClick={async () => { const s = await acceptOrder(order.id); if (s && onUpdate) onUpdate({ ...order, status: "pending_payment" }); }}
            disabled={accepting || declining}
            loading={accepting}
            label="Accept Order"
          />
          {!showDecline ? (
            <SecondaryButton onClick={() => setShowDecline(true)} disabled={accepting || declining} label="Decline" variant="danger" />
          ) : (
            <div className="w-full space-y-2.5 mt-1">
              <textarea rows={2} value={declineReason} onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-red-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-red-200/50" />
              <div className="flex gap-2">
                <button
                  onClick={async () => { const s = await declineOrder(order.id, declineReason || undefined); if (s && onUpdate) onUpdate({ ...order, status: "declined", seller_decline_reason: declineReason || null }); }}
                  disabled={declining}
                  className="px-4 py-2 rounded-xl text-sm font-ui font-semibold text-white bg-red-500 disabled:opacity-60 hover:bg-red-600 transition-colors"
                >
                  {declining ? "Declining..." : "Confirm Decline"}
                </button>
                <button onClick={() => { setShowDecline(false); setDeclineReason(""); }} className="px-4 py-2 rounded-xl text-sm font-ui text-muted hover:text-ink transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </ActionCard>
    );
  }

  // ─── Disputed ───────────────────────────────────────────────────
  if (order.status === "disputed") {
    return (
      <ActionCard accent="red">
        <div className="flex items-center gap-3">
          <ActionIcon color="red" path="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          <div>
            <p className="text-sm font-ui font-semibold text-red-700">Dispute In Progress</p>
            <p className="text-xs font-body text-red-600/70">Actions are paused until the dispute is resolved.</p>
          </div>
        </div>
      </ActionCard>
    );
  }

  // ─── Refund Requested ───────────────────────────────────────────
  if (order.status === "refund_requested") {
    return (
      <ActionCard accent="orange">
        <div className="flex items-center gap-3 mb-3">
          <ActionIcon color="orange" path="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          <div>
            <p className="text-sm font-ui font-semibold text-orange-700">Refund Requested</p>
            <p className="text-xs font-body text-orange-600/70">
              {isBuyer
                ? "Waiting for the seller's response"
                : `Buyer requests a ${actions?.refund?.kind === "partial" ? "partial" : "full"} refund of $${((actions?.refund?.listing_amount_cents ?? Math.round(Number(order.amount) * 100)) / 100).toFixed(2)}`}
            </p>
          </div>
        </div>

        {order.cancel_reason && (
          <div className="p-3 rounded-xl border border-orange-200/50 bg-surface/60 mb-3">
            <p className="text-[11px] font-ui uppercase tracking-wider text-orange-500/60 mb-1">Reason</p>
            <p className="text-sm font-body text-orange-800">{order.cancel_reason}</p>
          </div>
        )}

        {isSeller && (
          <div className="flex flex-wrap gap-2.5">
            <button onClick={handleSellerApproveRefund} disabled={approvingRefund || decliningRefund}
              className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-orange-500 disabled:opacity-60 hover:bg-orange-600 transition-colors">
              {approvingRefund ? "Processing..." : "Approve Refund"}
            </button>
            <button
              onClick={async () => { const s = await declineRefund(order.id); if (s && onUpdate) onUpdate({ ...order, status: "paid" }); }}
              disabled={approvingRefund || decliningRefund}
              className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-orange-600 border border-orange-200 bg-surface hover:bg-orange-50 disabled:opacity-60 transition-colors">
              {decliningRefund ? "Declining..." : "Decline Request"}
            </button>
          </div>
        )}

        {approveRefundError && <p className="mt-2 text-sm text-red-500 font-body">{approveRefundError}</p>}
        {declineRefundError && <p className="mt-2 text-sm text-red-500 font-body">{declineRefundError}</p>}
      </ActionCard>
    );
  }

  // ─── Standard Actions ───────────────────────────────────────────
  const hasMainActions = !!(
    (isSeller && order.listing_type === "service" && ["paid", "revision_requested", "in_progress"].includes(order.status)) ||
    (isSeller && order.listing_type === "product" && order.status === "paid") ||
    (isBuyer && ["submitted", "delivered"].includes(order.status))
  );

  // Don't render if there are no actions to show (server-decided)
  const canCancel = actions ? actions.can_cancel : order.status === "pending_payment";
  const canRefund = actions ? (isSeller ? actions.can_issue_refund : actions.can_request_refund) : false;
  const canDispute = actions ? actions.can_open_dispute : false;
  const cancelMode = actions?.cancel_mode ?? "free";

  if (!hasMainActions && !canCancel && !canRefund && !canDispute && !order.auto_completion_at && !order.delivery_note && !order.tracking_number) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-border-light bg-surface p-5 sm:p-6 space-y-4">

      {/* ─── Seller Main Actions ──────────────────────────────── */}
      {isSeller && (
        <>
          {order.listing_type === "service" && (order.status === "paid" || order.status === "revision_requested") && (
            <PrimaryButton
              onClick={() => handleAction("in_progress")}
              disabled={updating}
              label={order.status === "revision_requested" ? "Start Revision" : "Start Work"}
            />
          )}

          {order.listing_type === "service" && order.status === "in_progress" && (
            <div className="space-y-3">
              <textarea rows={3} value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Add delivery summary, file links, and notes..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 transition-shadow" />
              <PrimaryButton onClick={() => handleAction("submitted", { deliveryNote })} disabled={updating} label="Submit Delivery" />
            </div>
          )}

          {order.listing_type === "product" && !order.shipping_address && order.status === "paid" && (
            <PrimaryButton onClick={() => handleAction("delivered")} disabled={updating} label="Mark as Delivered" />
          )}

          {order.listing_type === "product" && order.shipping_address && order.status === "paid" && (
            <div className="space-y-3">
              <input type="text" value={deliveryNote} onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Tracking number (optional)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 transition-shadow" />
              <PrimaryButton onClick={() => handleAction("shipped", { trackingNumber: deliveryNote || undefined })} disabled={updating} label="Mark as Shipped" />
            </div>
          )}

          {order.listing_type === "product" && order.shipping_address && order.status === "shipped" && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-purple-primary/[0.04] border border-purple-primary/15">
              <svg className="w-4 h-4 text-purple-primary shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm font-body text-purple-primary">Shipped — waiting for buyer to confirm delivery.</p>
            </div>
          )}
        </>
      )}

      {/* ─── Buyer Main Actions ───────────────────────────────── */}
      {isBuyer && (
        <>
          {order.status === "submitted" && (
            <div className="flex flex-wrap gap-2.5">
              <PrimaryButton onClick={() => handleAction("completed")} disabled={updating} label="Accept Delivery" />
              {(order.max_revisions == null || order.revision_count < order.max_revisions) && (
                <SecondaryButton
                  onClick={() => handleAction("revision_requested")}
                  disabled={updating}
                  label={`Request Revision${order.max_revisions ? ` (${order.revision_count}/${order.max_revisions})` : ""}`}
                />
              )}
            </div>
          )}

          {order.status === "delivered" && (
            <PrimaryButton onClick={() => handleAction("completed")} disabled={updating} label="Confirm Receipt" />
          )}
        </>
      )}

      {/* Auto-completion */}
      {order.auto_completion_at && isBuyer && (
        <AutoCompletionNotice deadline={order.auto_completion_at} />
      )}

      {/* Delivery note */}
      {order.delivery_note && (
        <InfoBlock label="Delivery Note" value={order.delivery_note} />
      )}

      {/* Tracking info */}
      {order.tracking_number && (
        <InfoBlock label="Tracking Number" value={order.tracking_number} />
      )}

      {/* ─── Secondary Actions ────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {canCancel && !showCancel && (
          <TextButton onClick={() => setShowCancel(true)} label="Cancel Order" color="red" />
        )}
        {canRefund && !showRefund && (
          <TextButton onClick={() => setShowRefund(true)} label={isSeller ? "Issue Refund" : "Request Refund"} color="orange" />
        )}
        {canDispute && (
          <TextButton onClick={() => setShowDispute(true)} label="Open Dispute" color="red" />
        )}
      </div>

      {/* Cancel flow */}
      {showCancel && (
        <InlineForm
          title={cancelMode === "request" ? "Ask the seller to cancel?" : cancelMode === "refund" ? "Cancel and refund this order?" : "Cancel this order?"}
          subtitle={cancelMode === "request"
            ? "Work has already started, so the seller decides. If they agree you get a full refund."
            : cancelMode === "refund"
              ? (isBuyer && actions?.is_late ? "This order is overdue, so you can cancel it. A full refund will be issued." : "A full refund will be issued to the buyer.")
              : undefined}
          placeholder="Reason for cancellation (optional)"
          value={cancelReason}
          onChange={setCancelReason}
          onConfirm={handleCancel}
          onCancel={() => { setShowCancel(false); setCancelReason(""); }}
          confirmLabel={cancelMode === "request" ? "Send Request" : "Confirm Cancel"}
          loading={cancelling}
          color="red"
        />
      )}

      {/* Refund flow */}
      {showRefund && (
        <InlineForm
          title={isSeller ? "Issue a refund to the buyer?" : "Request a refund from the seller?"}
          subtitle={isSeller
            ? `This refunds $${Number(order.total_amount ?? order.amount).toFixed(2)} to the buyer and cancels the order.`
            : "Your request will be sent to the seller for approval."
          }
          placeholder={isSeller ? "Reason for refund (visible to buyer)" : "Why are you requesting a refund?"}
          value={refundReason}
          onChange={setRefundReason}
          onConfirm={isSeller ? handleSellerIssueRefund : handleBuyerRefundRequest}
          onCancel={() => { setShowRefund(false); setRefundReason(""); }}
          confirmLabel={isSeller ? "Confirm Refund" : "Submit Request"}
          loading={requestingRefund || issuingRefund}
          color="orange"
        />
      )}

      {/* Dispute modal */}
      {showDispute && (
        <DisputeModal
          orderId={order.id}
          onSuccess={() => { setShowDispute(false); if (onUpdate) onUpdate({ ...order, status: "disputed" }); }}
          onClose={() => setShowDispute(false)}
        />
      )}

      {requestRefundError && <p className="text-sm text-red-500 font-body">{requestRefundError}</p>}
      {approveRefundError && <p className="text-sm text-red-500 font-body">{approveRefundError}</p>}
      {issueRefundError && <p className="text-sm text-red-500 font-body">{issueRefundError}</p>}
      {cancelError && <p className="text-sm text-red-500 font-body">{cancelError}</p>}
      {error && <p className="text-sm text-red-500 font-body">{error}</p>}
    </div>
  );
}

// ─── Sub-components ─────────────────────────────────────────────────

function ActionCard({ children, accent }: { children: React.ReactNode; accent: "purple" | "orange" | "red" }) {
  const borderMap = { purple: "border-purple-primary/15", orange: "border-orange-200/60", red: "border-red-200/60" };
  const bgMap = { purple: "bg-purple-50/30", orange: "bg-orange-50/30", red: "bg-red-50/30" };
  return (
    <div className={`rounded-2xl border ${borderMap[accent]} ${bgMap[accent]} p-5 sm:p-6`}>
      {children}
    </div>
  );
}

function ActionIcon({ color, path }: { color: "purple" | "orange" | "red"; path: string }) {
  const colorMap = { purple: "bg-purple-100 text-purple-primary", orange: "bg-orange-100 text-orange-500", red: "bg-red-100 text-red-500" };
  return (
    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${colorMap[color]}`}>
      <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={path} />
      </svg>
    </div>
  );
}

function PrimaryButton({ onClick, disabled, label, loading }: { onClick: () => void; disabled: boolean; label: string; loading?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="px-5 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60 hover:opacity-90 transition-opacity">
      {loading ? "Processing..." : label}
    </button>
  );
}

function SecondaryButton({ onClick, disabled, label, variant }: { onClick: () => void; disabled: boolean; label: string; variant?: "danger" }) {
  const base = variant === "danger"
    ? "text-red-600 border-red-200 bg-red-50 hover:bg-red-100"
    : "text-pink-vivid border-pink-vivid/25 bg-pink-50 hover:bg-pink-100";
  return (
    <button onClick={onClick} disabled={disabled}
      className={`px-5 py-2.5 rounded-xl text-sm font-ui font-semibold border disabled:opacity-60 transition-colors ${base}`}>
      {label}
    </button>
  );
}

function TextButton({ onClick, label, color }: { onClick: () => void; label: string; color: "red" | "orange" }) {
  const colorMap = { red: "text-red-400 hover:text-red-500", orange: "text-orange-400 hover:text-orange-500" };
  return (
    <button onClick={onClick} className={`text-sm font-ui transition-colors ${colorMap[color]}`}>
      {label}
    </button>
  );
}

function InlineForm({ title, subtitle, placeholder, value, onChange, onConfirm, onCancel, confirmLabel, loading, color }: {
  title: string; subtitle?: string; placeholder: string;
  value: string; onChange: (v: string) => void;
  onConfirm: () => void; onCancel: () => void;
  confirmLabel: string; loading: boolean;
  color: "red" | "orange";
}) {
  const borderMap = { red: "border-red-200", orange: "border-orange-200" };
  const bgMap = { red: "bg-red-50", orange: "bg-orange-50" };
  const btnMap = { red: "bg-red-500 hover:bg-red-600", orange: "bg-orange-500 hover:bg-orange-600" };
  return (
    <div className={`space-y-2.5 p-4 rounded-xl border ${borderMap[color]} ${bgMap[color]}`}>
      <p className={`text-sm font-ui font-semibold text-${color}-600`}>{title}</p>
      {subtitle && <p className={`text-xs font-body text-${color}-500/80`}>{subtitle}</p>}
      <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full px-3.5 py-2.5 rounded-xl border ${borderMap[color]} text-sm font-body focus:outline-none focus:ring-2 focus:ring-${color}-200/50`} />
      <div className="flex gap-2">
        <button onClick={onConfirm} disabled={loading}
          className={`px-4 py-2 rounded-xl text-sm font-ui font-semibold text-white ${btnMap[color]} disabled:opacity-60 transition-colors`}>
          {loading ? "Processing..." : confirmLabel}
        </button>
        <button onClick={onCancel} className="px-4 py-2 rounded-xl text-sm font-ui text-muted hover:text-ink transition-colors">
          Nevermind
        </button>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl border border-border-light bg-subtle">
      <p className="text-[11px] font-ui uppercase tracking-wider text-muted mb-1">{label}</p>
      <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function AutoCompletionNotice({ deadline }: { deadline: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const diff = new Date(deadline).getTime() - now;
  if (diff <= 0) {
    return (
      <div className="flex items-center gap-2.5 p-3 rounded-xl bg-yellow-50/80 border border-yellow-200/50">
        <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-ui text-yellow-700">Auto-completion imminent — this order will complete shortly.</p>
      </div>
    );
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const timeText = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;

  return (
    <div className="flex items-center gap-2.5 p-3 rounded-xl bg-yellow-50/80 border border-yellow-200/50">
      <svg className="w-4 h-4 text-yellow-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <div>
        <p className="text-sm font-ui text-yellow-700 font-medium">Auto-completes in {timeText}</p>
        <p className="text-xs font-body text-yellow-600/70">Take action before the deadline or the order completes automatically.</p>
      </div>
    </div>
  );
}
