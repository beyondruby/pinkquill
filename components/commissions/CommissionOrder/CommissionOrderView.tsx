"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommissionOrder, useUpdateCommissionOrder } from "@/lib/hooks/useCommissions";
import type { PurchaseStatus } from "@/lib/types/store";

interface CommissionOrderViewProps {
  orderId: string;
}

const ORDER_FLOW: Array<{ key: PurchaseStatus; label: string; description: string }> = [
  { key: "paid", label: "Hired", description: "Buyer confirmed package" },
  { key: "in_progress", label: "In Progress", description: "Creator is working" },
  { key: "submitted", label: "Delivered", description: "Creator submitted delivery" },
  { key: "completed", label: "Completed", description: "Buyer accepted delivery" },
];

export default function CommissionOrderView({ orderId }: CommissionOrderViewProps) {
  const { user } = useAuth();
  const { order, loading, error, refetch } = useCommissionOrder(orderId);
  const { updateOrder, updating, error: updateError } = useUpdateCommissionOrder();

  const [deliveryNote, setDeliveryNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const isBuyer = !!user && user.id === order?.buyer_id;
  const isSeller = !!user && user.id === order?.product?.seller_id;

  const statusIndex = useMemo(() => {
    const idx = ORDER_FLOW.findIndex((step) => step.key === order?.status);
    return idx === -1 ? 0 : idx;
  }, [order?.status]);

  const performAction = async (status: PurchaseStatus, note?: string) => {
    if (!order) return;

    setActionError(null);
    const success = await updateOrder(order.id, {
      status,
      delivery_note: note,
    });

    if (!success) {
      setActionError("Could not update order status.");
      return;
    }

    await refetch();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !order || order.product?.listing_type !== "service") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-ink mb-3">Order not found</h1>
          <p className="font-body text-muted mb-6">You may not have permission to view this commission order.</p>
          <Link href="/shop?section=commissions" className="inline-flex px-5 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid">
            Back to Commissions
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <p className="text-xs font-ui uppercase tracking-wider text-pink-vivid mb-2">Commission Order</p>
          <h1 className="font-display text-3xl text-ink mb-2">{order.product?.title}</h1>
          <p className="text-sm font-body text-muted">
            Order #{order.id.slice(0, 8)} • Status: <span className="font-semibold text-ink capitalize">{order.status.replace("_", " ")}</span>
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Package" value={order.pricing?.variant_name || "Selected package"} />
            <Metric label="Amount" value={`$${order.amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`} />
            <Metric label="Due" value={order.due_date ? new Date(order.due_date).toLocaleDateString() : "Not set"} />
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl text-ink mb-4">Timeline</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {ORDER_FLOW.map((step, index) => (
              <div
                key={step.key}
                className={`rounded-xl border px-3 py-3 ${
                  index <= statusIndex
                    ? "border-pink-vivid/40 bg-pink-50/50"
                    : "border-black/[0.08]"
                }`}
              >
                <p className="text-xs font-ui uppercase tracking-wider text-muted">Step {index + 1}</p>
                <p className="font-ui font-semibold text-ink mt-1">{step.label}</p>
                <p className="text-xs font-body text-muted mt-1">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <h2 className="font-display text-2xl text-ink mb-3">Brief</h2>
          <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{order.brief || "No brief provided."}</p>
          {typeof order.requirements?.notes === "string" && order.requirements.notes.length > 0 && (
            <p className="font-body text-sm text-muted mt-4">
              <span className="font-semibold text-ink">Notes:</span> {order.requirements.notes}
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
          <h2 className="font-display text-2xl text-ink">Actions</h2>

          {isSeller && (order.status === "paid" || order.status === "revision_requested") && (
            <button
              onClick={() => performAction("in_progress")}
              disabled={updating}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              Start Work
            </button>
          )}

          {isSeller && order.status === "in_progress" && (
            <div className="space-y-3">
              <textarea
                rows={4}
                value={deliveryNote}
                onChange={(event) => setDeliveryNote(event.target.value)}
                placeholder="Add delivery summary, links, and notes for buyer review."
                className="w-full px-4 py-3 rounded-xl border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20"
              />
              <button
                onClick={() => performAction("submitted", deliveryNote)}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
              >
                Submit Delivery
              </button>
            </div>
          )}

          {isBuyer && order.status === "submitted" && (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => performAction("completed")}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
              >
                Mark Complete
              </button>
              <button
                onClick={() => performAction("revision_requested")}
                disabled={updating}
                className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-pink-vivid border border-pink-vivid/30 bg-pink-50 disabled:opacity-60"
              >
                Request Revision
              </button>
            </div>
          )}

          {order.delivery_note && (
            <div className="p-4 rounded-xl border border-black/[0.08] bg-gray-50/60">
              <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">Latest delivery note</p>
              <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{order.delivery_note}</p>
            </div>
          )}

          {(actionError || updateError) && (
            <p className="text-sm text-red-500 font-body">{actionError || updateError}</p>
          )}
        </section>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] px-3 py-2.5">
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className="font-ui font-semibold text-ink mt-1">{value}</p>
    </div>
  );
}
