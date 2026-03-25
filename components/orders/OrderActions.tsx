"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUpdateOrderStatus, useAcceptOrder, useDeclineOrder } from "@/lib/hooks/useOrders";
import { useRequestRefund } from "@/lib/hooks/useDisputes";
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
  const { requestRefund, loading: refunding, error: refundError } = useRequestRefund();
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

  const handleAction = async (status: OrderStatus, options?: Record<string, string | string[] | undefined>) => {
    const result = await updateStatus(order.id, status, options);
    if (result && onUpdate) onUpdate(result);
  };

  const handleRefund = async () => {
    const success = await requestRefund(order.id, refundReason || undefined);
    if (success) {
      setShowRefund(false);
      if (onUpdate) onUpdate({ ...order, status: "refunded", payment_status: "refunded" });
    }
  };

  // No actions for non-participants
  if (!isBuyer && !isSeller) return null;

  const isTerminal =
    ["completed", "cancelled", "refunded", "resolved", "declined"].includes(order.status)
    || (!isBuyer && order.status === "delivered");

  // Terminal states
  if (isTerminal) {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            ["completed", "delivered", "resolved"].includes(order.status)
              ? "bg-green-500"
              : "bg-red-400"
          }`} />
          <p className="text-sm font-ui font-semibold text-ink capitalize">
            {order.status.replace(/_/g, " ")}
          </p>
        </div>
        {order.status === "completed" && order.completed_at && (
          <p className="text-xs font-body text-muted mt-2">
            Completed on {new Date(order.completed_at).toLocaleDateString()}
          </p>
        )}
        {order.status === "declined" && (
          <div className="mt-2">
            {order.seller_decline_reason && (
              <p className="text-sm font-body text-muted">
                <span className="font-semibold">Reason:</span> {order.seller_decline_reason}
              </p>
            )}
            <p className="text-xs font-body text-muted mt-1">
              Declined on {order.seller_declined_at ? new Date(order.seller_declined_at).toLocaleDateString() : "N/A"}
            </p>
          </div>
        )}
      </section>
    );
  }

  // Pending acceptance state (buyer sees waiting, seller sees accept/decline via dashboard)
  if (order.status === "pending_acceptance") {
    if (isBuyer) {
      return (
        <section className="rounded-2xl border-2 border-amber-200 bg-amber-50 p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h2 className="font-display text-lg text-amber-700">Awaiting Seller Approval</h2>
          </div>
          <p className="text-sm font-body text-amber-600/80">
            The seller is reviewing your order. You&apos;ll be notified once they accept or decline.
          </p>
          {order.seller_response_deadline && (
            <p className="text-xs font-body text-amber-600/60 mt-2">
              Response expected by {new Date(order.seller_response_deadline).toLocaleString()}
            </p>
          )}
        </section>
      );
    }
    // Seller sees accept/decline inline
    return (
      <section className="rounded-2xl border-2 border-purple-primary/20 bg-purple-50/40 p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="font-display text-lg text-purple-primary">New Order Request</h2>
        </div>
        <p className="text-sm font-body text-ink/70">
          A buyer has placed an order that requires your approval before proceeding.
        </p>
        {order.brief && (
          <div className="p-3 rounded-xl border border-black/[0.08] bg-white/80">
            <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Brief</p>
            <p className="text-sm font-body text-ink whitespace-pre-wrap">{order.brief}</p>
          </div>
        )}
        {order.seller_response_deadline && (
          <p className="text-xs font-body text-muted">
            Respond by {new Date(order.seller_response_deadline).toLocaleString()} or the order will auto-decline.
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={async () => {
              const success = await acceptOrder(order.id);
              if (success && onUpdate) onUpdate({ ...order, status: "pending_payment" });
            }}
            disabled={accepting || declining}
            className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
          >
            {accepting ? "Accepting..." : "Accept Order"}
          </button>
          {!showDecline ? (
            <button
              onClick={() => setShowDecline(true)}
              disabled={accepting || declining}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-red-600 border border-red-200 bg-red-50 disabled:opacity-60"
            >
              Decline
            </button>
          ) : (
            <div className="w-full space-y-2">
              <textarea
                rows={2}
                value={declineReason}
                onChange={(e) => setDeclineReason(e.target.value)}
                placeholder="Reason for declining (optional)"
                className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-red-200"
              />
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    const success = await declineOrder(order.id, declineReason || undefined);
                    if (success && onUpdate) onUpdate({ ...order, status: "declined", seller_decline_reason: declineReason || null });
                  }}
                  disabled={declining}
                  className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-red-500 disabled:opacity-60"
                >
                  {declining ? "Declining..." : "Confirm Decline"}
                </button>
                <button
                  onClick={() => { setShowDecline(false); setDeclineReason(""); }}
                  className="px-4 py-2.5 rounded-xl text-sm font-ui text-muted"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  // Disputed state
  if (order.status === "disputed") {
    return (
      <section className="rounded-2xl border-2 border-red-200 bg-red-50 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <h2 className="font-display text-lg text-red-700">Dispute Open</h2>
        </div>
        <p className="text-sm font-body text-red-600/80">
          This order is currently under dispute. Actions are paused until the dispute is resolved.
        </p>
      </section>
    );
  }

  // Refund requested state
  if (order.status === "refund_requested") {
    return (
      <section className="rounded-2xl border-2 border-orange-200 bg-orange-50 p-5 sm:p-6">
        <div className="flex items-center gap-2 mb-2">
          <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
          </svg>
          <h2 className="font-display text-lg text-orange-700">Refund Requested</h2>
        </div>
        <p className="text-sm font-body text-orange-600/80">
          A refund has been requested for this order. It is being processed.
        </p>
        {order.cancel_reason && (
          <p className="text-sm font-body text-orange-700 mt-2">
            <span className="font-semibold">Reason:</span> {order.cancel_reason}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
      <h2 className="font-display text-xl text-ink">Actions</h2>

      {/* SELLER ACTIONS */}
      {isSeller && (
        <>
          {/* Start Work (commission) */}
          {order.listing_type === "service" && (order.status === "paid" || order.status === "revision_requested") && (
            <button
              onClick={() => handleAction("in_progress")}
              disabled={updating}
              className="w-full sm:w-auto px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              {order.status === "revision_requested" ? "Start Revision" : "Start Work"}
            </button>
          )}

          {/* Submit Delivery (commission) */}
          {order.listing_type === "service" && order.status === "in_progress" && (
            <div className="space-y-3">
              <textarea
                rows={4}
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Add delivery summary, links to files, and notes for buyer review..."
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
              />
              <button
                onClick={() => handleAction("submitted", { deliveryNote })}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
              >
                Submit Delivery
              </button>
            </div>
          )}

          {/* Deliver Digital Product */}
          {order.listing_type === "product" && !order.shipping_address && order.status === "paid" && (
            <button
              onClick={() => handleAction("delivered")}
              disabled={updating}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              Deliver Digital Order
            </button>
          )}

          {/* Ship Order (physical product) */}
          {order.listing_type === "product" && order.shipping_address && order.status === "paid" && (
            <div className="space-y-3">
              <input
                type="text"
                value={deliveryNote}
                onChange={(e) => setDeliveryNote(e.target.value)}
                placeholder="Tracking number (optional)"
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
              />
              <button
                onClick={() => handleAction("shipped", { trackingNumber: deliveryNote || undefined })}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
              >
                Mark as Shipped
              </button>
            </div>
          )}

          {/* Physical product shipped: seller sees status, buyer confirms delivery via ConfirmDeliveryBanner */}
          {order.listing_type === "product" && order.shipping_address && order.status === "shipped" && (
            <div className="p-4 rounded-xl border border-blue-200 bg-blue-50">
              <p className="text-sm font-ui font-semibold text-blue-700">Order Shipped</p>
              <p className="text-xs font-body text-blue-600/80 mt-1">
                Waiting for the buyer to confirm delivery.
              </p>
            </div>
          )}
        </>
      )}

      {/* BUYER ACTIONS */}
      {isBuyer && (
        <>
          {/* Accept/Revision (commission submitted) */}
          {order.status === "submitted" && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => handleAction("completed")}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
              >
                Accept Delivery
              </button>
              {(order.max_revisions == null || order.revision_count < order.max_revisions) && (
                <button
                  onClick={() => handleAction("revision_requested")}
                  disabled={updating}
                  className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-pink-vivid border border-pink-vivid/30 bg-pink-50 disabled:opacity-60"
                >
                  Request Revision
                  {order.max_revisions && (
                    <span className="ml-1 text-xs opacity-70">
                      ({order.revision_count}/{order.max_revisions})
                    </span>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Accept Delivery (physical product delivered) */}
          {order.status === "delivered" && (
            <button
              onClick={() => handleAction("completed")}
              disabled={updating}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              Confirm Receipt
            </button>
          )}
        </>
      )}

      {/* AUTO-COMPLETION COUNTDOWN */}
      {order.auto_completion_at && isBuyer && (
        <AutoCompletionCountdown deadline={order.auto_completion_at} />
      )}

      {/* CANCEL (both roles, only early stages) */}
      {order.status === "pending_payment" && !showCancel && (
        <button
          onClick={() => setShowCancel(true)}
          className="text-sm font-ui text-red-500 hover:text-red-600"
        >
          Cancel Order
        </button>
      )}

      {showCancel && (
        <div className="space-y-3 p-4 rounded-xl border border-red-200 bg-red-50">
          <p className="text-sm font-ui font-semibold text-red-600">Cancel this order?</p>
          <textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason for cancellation (optional)"
            className="w-full px-4 py-2.5 rounded-xl border border-red-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-red-200"
          />
          <div className="flex gap-2">
            <button
              onClick={() => handleAction("cancelled", { cancelReason: cancelReason || undefined })}
              disabled={updating}
              className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-red-500 disabled:opacity-60"
            >
              Confirm Cancel
            </button>
            <button
              onClick={() => { setShowCancel(false); setCancelReason(""); }}
              className="px-4 py-2.5 rounded-xl text-sm font-ui text-muted"
            >
              Nevermind
            </button>
          </div>
        </div>
      )}

      {/* REFUND (buyer OR seller, post-payment non-disputed) */}
      {(isBuyer || isSeller) && ["paid", "completed", "delivered", "in_progress", "submitted", "shipped"].includes(order.status) && !showRefund && (
        <button
          onClick={() => setShowRefund(true)}
          className="text-sm font-ui text-orange-500 hover:text-orange-600"
        >
          {isSeller ? "Issue Refund" : "Request Refund"}
        </button>
      )}

      {showRefund && (
        <div className="space-y-3 p-4 rounded-xl border border-orange-200 bg-orange-50">
          <p className="text-sm font-ui font-semibold text-orange-600">
            {isSeller ? "Issue a refund to the buyer?" : "Request a refund?"}
          </p>
          {isSeller && (
            <p className="text-xs font-body text-orange-500/80">
              This will refund ${Number(order.amount).toFixed(2)} to the buyer and cancel the order.
            </p>
          )}
          <textarea
            rows={2}
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            placeholder={isSeller ? "Reason for refund (visible to buyer)" : "Reason for refund (optional)"}
            className="w-full px-4 py-2.5 rounded-xl border border-orange-200 text-sm font-body focus:outline-none focus:ring-2 focus:ring-orange-200"
          />
          <div className="flex gap-2">
            <button
              onClick={handleRefund}
              disabled={refunding}
              className="px-4 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-orange-500 disabled:opacity-60"
            >
              {refunding ? "Processing..." : isSeller ? "Confirm Refund" : "Request Refund"}
            </button>
            <button
              onClick={() => { setShowRefund(false); setRefundReason(""); }}
              className="px-4 py-2.5 rounded-xl text-sm font-ui text-muted"
            >
              Nevermind
            </button>
          </div>
          {refundError && <p className="text-sm text-red-500 font-body">{refundError}</p>}
        </div>
      )}

      {/* DISPUTE (both roles, post-payment active orders) */}
      {!["pending_payment", "cancelled", "refunded", "disputed", "resolved", "refund_requested"].includes(order.status) && (
        <button
          onClick={() => setShowDispute(true)}
          className="text-sm font-ui text-red-400 hover:text-red-500"
        >
          Open Dispute
        </button>
      )}

      {showDispute && (
        <DisputeModal
          orderId={order.id}
          onSuccess={() => {
            setShowDispute(false);
            if (onUpdate) onUpdate({ ...order, status: "disputed" });
          }}
          onClose={() => setShowDispute(false)}
        />
      )}

      {/* Delivery note display */}
      {order.delivery_note && (
        <div className="p-4 rounded-xl border border-black/[0.08] bg-gray-50/60">
          <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Delivery Note</p>
          <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{order.delivery_note}</p>
        </div>
      )}

      {/* Tracking info */}
      {order.tracking_number && (
        <div className="p-4 rounded-xl border border-black/[0.08] bg-gray-50/60">
          <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Tracking Number</p>
          <p className="font-ui font-semibold text-ink">{order.tracking_number}</p>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-500 font-body">{error}</p>
      )}
    </section>
  );
}

// ============================================================================
// Auto-Completion Countdown
// ============================================================================

function AutoCompletionCountdown({ deadline }: { deadline: string }) {
  const deadlineDate = new Date(deadline);
  const now = new Date();
  const diff = deadlineDate.getTime() - now.getTime();

  if (diff <= 0) {
    return (
      <div className="p-4 rounded-xl border border-yellow-300 bg-yellow-50">
        <p className="text-sm font-ui font-semibold text-yellow-700">
          Auto-completion deadline has passed — this order will be completed shortly.
        </p>
      </div>
    );
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  let timeText: string;
  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;
    timeText = `${days}d ${remHours}h`;
  } else {
    timeText = `${hours}h ${minutes}m`;
  }

  return (
    <div className="p-4 rounded-xl border border-yellow-300 bg-yellow-50">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-ui font-semibold text-yellow-700">
          Auto-completes in {timeText}
        </p>
      </div>
      <p className="text-xs font-body text-yellow-600/80">
        If you don&apos;t take action before the deadline, this order will be automatically marked as completed.
      </p>
    </div>
  );
}
