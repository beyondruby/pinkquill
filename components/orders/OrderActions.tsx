"use client";

import { useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUpdateOrderStatus } from "@/lib/hooks/useOrders";
import type { Order, OrderStatus } from "@/lib/types/store";

interface OrderActionsProps {
  order: Order;
  onUpdate?: (order: Order) => void;
}

export default function OrderActions({ order, onUpdate }: OrderActionsProps) {
  const { user } = useAuth();
  const { updateStatus, updating, error } = useUpdateOrderStatus();
  const [deliveryNote, setDeliveryNote] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showCancel, setShowCancel] = useState(false);

  const isBuyer = !!user && user.id === order.buyer_id;
  const isSeller = !!user && user.id === order.seller_id;

  const handleAction = async (status: OrderStatus, options?: Record<string, string | string[] | undefined>) => {
    const result = await updateStatus(order.id, status, options);
    if (result && onUpdate) onUpdate(result);
  };

  // No actions for non-participants
  if (!isBuyer && !isSeller) return null;

  // No actions for terminal states
  if (["completed", "delivered", "cancelled", "refunded", "resolved"].includes(order.status)) {
    return (
      <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${
            ["completed", "delivered", "resolved"].includes(order.status)
              ? "bg-green-500"
              : "bg-red-400"
          }`} />
          <p className="text-sm font-ui font-semibold text-ink capitalize">
            {order.status.replace("_", " ")}
          </p>
        </div>
        {order.status === "completed" && order.completed_at && (
          <p className="text-xs font-body text-muted mt-2">
            Completed on {new Date(order.completed_at).toLocaleDateString()}
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

          {/* Mark Delivered (physical product) */}
          {order.listing_type === "product" && order.status === "shipped" && (
            <button
              onClick={() => handleAction("delivered")}
              disabled={updating}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              Mark as Delivered
            </button>
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
              {(order.max_revisions === null || order.revision_count < (order.max_revisions || 0)) && (
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

      {/* CANCEL (both roles, only early stages) */}
      {["pending_payment", "paid"].includes(order.status) && !showCancel && (
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
