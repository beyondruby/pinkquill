"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrder, useUpdateOrderDraft } from "@/lib/hooks/useOrders";
import { useOrderReviews } from "@/lib/hooks/useReviews";
import { useOrderDispute } from "@/lib/hooks/useDisputes";
import { useConfirmDelivery } from "@/lib/hooks/useShipping";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewCard from "@/components/reviews/ReviewCard";
import OrderTimeline from "./OrderTimeline";
import OrderMessages from "./OrderMessages";
import OrderActions from "./OrderActions";
import DigitalDownloadSection from "./DigitalDownloadSection";
import ShippingTracker from "./ShippingTracker";
import TrackingInput from "./TrackingInput";
import DeliverySection from "./DeliverySection";
import { supabase } from "@/lib/supabase";
import type { Order, OrderStatus } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS, DISPUTE_RESOLUTION_LABELS } from "@/lib/types/store";

interface OrderViewProps {
  orderId: string;
}

type CommissionWorkspaceTab = "overview" | "requirements" | "delivery" | "activity" | "reviews";

const COMMISSION_WORKSPACE_TABS: Array<{ key: CommissionWorkspaceTab; label: string; hint: string }> = [
  { key: "overview", label: "Overview", hint: "Status, milestones, and next step" },
  { key: "requirements", label: "Requirements", hint: "Brief, scope, and due date" },
  { key: "delivery", label: "Delivery", hint: "Submit work and handle revisions" },
  { key: "activity", label: "Activity", hint: "Messages and order updates" },
  { key: "reviews", label: "Reviews", hint: "Mutual feedback after completion" },
];

function parseCommissionWorkspaceTab(value: string | null): CommissionWorkspaceTab | null {
  if (value === "overview") return "overview";
  if (value === "requirements") return "requirements";
  if (value === "delivery") return "delivery";
  if (value === "activity") return "activity";
  if (value === "reviews") return "reviews";
  return null;
}

function getDefaultCommissionTab(status: OrderStatus): CommissionWorkspaceTab {
  if (["pending_acceptance", "pending_payment", "paid"].includes(status)) return "requirements";
  if (["in_progress", "submitted", "revision_requested"].includes(status)) return "delivery";
  if (["disputed", "refund_requested", "resolved", "cancelled", "refunded"].includes(status)) return "activity";
  if (status === "completed") return "reviews";
  return "overview";
}

export default function OrderView({ orderId }: OrderViewProps) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { order, loading, error, refetch } = useOrder(orderId);
  const { updateDraft, updating: updatingDraft, error: updateDraftError } = useUpdateOrderDraft();
  const searchParams = useSearchParams();
  const paymentSyncTriggeredRef = useRef(false);
  const [draftNotice, setDraftNotice] = useState<string | null>(null);
  const [draftValidationError, setDraftValidationError] = useState<string | null>(null);
  const [shippingDraft, setShippingDraft] = useState({
    name: "",
    line1: "",
    line2: "",
    city: "",
    state: "",
    postal_code: "",
    country: "",
  });
  const [briefDraft, setBriefDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");

  const paymentParam = searchParams.get("payment");
  const commissionTabParam = parseCommissionWorkspaceTab(searchParams.get("stage"));

  // Redirect to dedicated checkout page if payment=start
  useEffect(() => {
    if (paymentParam === "start" && order?.status === "pending_payment" && user?.id === order.buyer_id) {
      router.replace(`/checkout/${orderId}`);
    }
  }, [paymentParam, order?.status, order?.buyer_id, user?.id, orderId, router]);

  // Sync payment if redirected back with payment=success
  useEffect(() => {
    if (paymentParam === "success" && order?.id && user?.id === order.buyer_id && !paymentSyncTriggeredRef.current) {
      paymentSyncTriggeredRef.current = true;
      void (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          await fetch("/api/payments/confirm", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
            },
            body: JSON.stringify({ order_id: order.id }),
          });
        } finally {
          await refetch();
        }
      })();
    }

    if (paymentParam !== "success") {
      paymentSyncTriggeredRef.current = false;
    }
  }, [paymentParam, order?.id, order?.buyer_id, user?.id, refetch]);

  useEffect(() => {
    if (!order) return;
    setShippingDraft({
      name: order.shipping_address?.name || "",
      line1: order.shipping_address?.line1 || "",
      line2: order.shipping_address?.line2 || "",
      city: order.shipping_address?.city || "",
      state: order.shipping_address?.state || "",
      postal_code: order.shipping_address?.postal_code || "",
      country: order.shipping_address?.country || "",
    });
    setBriefDraft(order.brief || "");
    setNotesDraft(typeof order.requirements?.notes === "string" ? order.requirements.notes : "");
    if (order.due_date) {
      const dueDate = new Date(order.due_date);
      const year = dueDate.getFullYear();
      const month = String(dueDate.getMonth() + 1).padStart(2, "0");
      const day = String(dueDate.getDate()).padStart(2, "0");
      setDueDateDraft(`${year}-${month}-${day}`);
    } else {
      setDueDateDraft("");
    }
  }, [order]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background py-10 px-4">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          <div className="h-52 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-64 bg-gray-100 rounded-2xl animate-pulse" />
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <h1 className="font-display text-3xl text-ink mb-3">Order not found</h1>
          <p className="font-body text-muted mb-6">
            This order doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <Link
            href="/orders"
            className="inline-flex px-5 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
          >
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyer_id;
  const counterparty = isBuyer ? order.seller : order.buyer;
  const isCommission = order.listing_type === "service";
  const isPhysicalProduct = !isCommission && order.product?.delivery_type !== "digital";
  const shippingCost = Number(order.shipping_cost || 0);
  const originalAmount = Number(order.original_amount ?? order.amount);
  const discountAmount = Number(order.discount_amount || 0);
  const subtotalAmount = Math.max(originalAmount - shippingCost, 0);
  const activeCommissionTab = isCommission
    ? commissionTabParam ?? getDefaultCommissionTab(order.status)
    : null;
  const activeCommissionTabMeta = activeCommissionTab
    ? COMMISSION_WORKSPACE_TABS.find((tab) => tab.key === activeCommissionTab) ?? null
    : null;
  const isCommissionDeliveryState = isCommission && ["in_progress", "revision_requested", "submitted", "completed", "delivered"].includes(order.status);
  const revisionRemaining = order.max_revisions == null
    ? null
    : Math.max(order.max_revisions - order.revision_count, 0);

  const updateCommissionTab = (nextTab: CommissionWorkspaceTab) => {
    if (!isCommission) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("stage", nextTab);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const handleSaveDraftDetails = async () => {
    if (!isBuyer) return;
    setDraftValidationError(null);
    setDraftNotice(null);

    const payload: {
      order_id: string;
      shipping_address?: typeof shippingDraft;
      brief?: string;
      requirements?: Record<string, unknown>;
      due_date?: string;
    } = { order_id: order.id };

    if (isPhysicalProduct) {
      if (!shippingDraft.name.trim() || !shippingDraft.line1.trim() || !shippingDraft.city.trim() || !shippingDraft.country.trim()) {
        setDraftValidationError("Shipping details are incomplete. Name, address, city, and country are required.");
        return;
      }
      payload.shipping_address = {
        name: shippingDraft.name.trim(),
        line1: shippingDraft.line1.trim(),
        line2: shippingDraft.line2.trim(),
        city: shippingDraft.city.trim(),
        state: shippingDraft.state.trim(),
        postal_code: shippingDraft.postal_code.trim(),
        country: shippingDraft.country.trim(),
      };
    }

    if (isCommission) {
      if (!briefDraft.trim()) {
        setDraftValidationError("Commission brief cannot be empty.");
        return;
      }
      payload.brief = briefDraft.trim();
      payload.requirements = {
        ...(order.requirements || {}),
        notes: notesDraft.trim(),
      };
      if (dueDateDraft) {
        const parsedDueDate = new Date(`${dueDateDraft}T12:00:00Z`);
        if (Number.isNaN(parsedDueDate.getTime())) {
          setDraftValidationError("Please enter a valid due date.");
          return;
        }
        payload.due_date = parsedDueDate.toISOString();
      }
    }

    const success = await updateDraft(payload);
    if (!success) return;

    setDraftNotice("Order details saved.");
    await refetch();
  };

  return (
    <div className="min-h-screen bg-background py-8 px-4">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-ui uppercase tracking-wider text-pink-vivid mb-2">
                {isCommission ? "Commission Order" : "Product Order"}
              </p>
              <h1 className="font-display text-2xl sm:text-3xl text-ink mb-1 truncate">
                {order.product?.title || "Order"}
              </h1>
              <p className="text-sm font-body text-muted">
                {order.order_number} &middot; Status:{" "}
                <span className="font-semibold text-ink capitalize">
                  {order.status.replace(/_/g, " ")}
                </span>
              </p>
            </div>

            {/* Counterparty */}
            {counterparty && (
              <Link
                href={`/studio/${counterparty.username}`}
                className="flex items-center gap-2.5 shrink-0"
              >
                {counterparty.avatar_url ? (
                  <Image
                    src={counterparty.avatar_url}
                    alt=""
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded-full"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                    <span className="text-xs font-ui font-bold text-white">
                      {(counterparty.display_name || counterparty.username)[0].toUpperCase()}
                    </span>
                  </div>
                )}
                <div>
                  <p className="text-xs font-ui text-muted">{isBuyer ? "Seller" : "Buyer"}</p>
                  <p className="text-sm font-ui font-semibold text-ink">
                    {counterparty.display_name || counterparty.username}
                  </p>
                </div>
              </Link>
            )}
          </div>

          {/* Metrics */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Amount" value={`$${order.amount.toFixed(2)}`} />
            {isCommission && (
              <Metric
                label="Package"
                value={order.pricing?.variant_name || "Selected"}
              />
            )}
            {isCommission && (
              <Metric
                label="Due"
                value={order.due_date ? new Date(order.due_date).toLocaleDateString() : "Not set"}
              />
            )}
            {!isCommission && order.quantity > 1 && (
              <Metric label="Quantity" value={`${order.quantity}`} />
            )}
            <Metric
              label="Ordered"
              value={new Date(order.created_at).toLocaleDateString()}
            />
            {isBuyer && (
              <Metric
                label="Platform Fee"
                value={`$${order.platform_fee.toFixed(2)}`}
              />
            )}
            {!isBuyer && (
              <Metric
                label="Your Earnings"
                value={`$${order.seller_amount.toFixed(2)}`}
              />
            )}
          </div>

          {(shippingCost > 0 || discountAmount > 0) && (
            <div className="mt-4 rounded-xl border border-black/[0.06] bg-black/[0.02] p-4 space-y-2 text-sm font-body">
              <div className="flex justify-between">
                <span className="text-muted">Subtotal</span>
                <span className="text-ink">${subtotalAmount.toFixed(2)}</span>
              </div>
              {shippingCost > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted">Shipping</span>
                  <span className="text-ink">${shippingCost.toFixed(2)}</span>
                </div>
              )}
              {discountAmount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Discount</span>
                  <span>-${discountAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t border-black/[0.06] pt-2 flex justify-between font-semibold text-ink">
                <span>Total</span>
                <span>${Number(order.amount).toFixed(2)}</span>
              </div>
            </div>
          )}
        </section>

        {/* Pending Acceptance Banner */}
        {order.status === "pending_acceptance" && isBuyer && (
          <section className={`rounded-2xl p-5 sm:p-6 text-center ${
            isCommission
              ? "border border-purple-primary/25 bg-purple-50/60"
              : "border border-amber-300/50 bg-amber-50"
          }`}>
            <h2 className="font-display text-xl text-ink mb-2">Awaiting Seller Approval</h2>
            <p className="text-sm font-body text-muted">
              The seller needs to review and accept your order before payment. You&apos;ll be notified once they respond.
              {order.seller_response_deadline && (
                <span className={`block mt-1 text-xs ${isCommission ? "text-purple-primary/80" : "text-amber-700"}`}>
                  Response expected by {new Date(order.seller_response_deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </p>
          </section>
        )}

        {/* Payment Required Banner */}
        {order.status === "pending_payment" && isBuyer && (
          <section className="rounded-2xl border-2 border-[var(--color-purple-primary)]/30 bg-purple-50 p-5 sm:p-6 text-center">
            <h2 className="font-display text-xl text-ink mb-2">Payment Required</h2>
            <p className="text-sm font-body text-muted mb-4">
              Complete your payment to activate this order.
              {order.listing_type === "service" && " Your payment will be held securely until you approve the delivery."}
            </p>
            <Link
              href={`/checkout/${order.id}`}
              className="inline-flex px-8 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
            >
              Pay ${Number(order.amount).toFixed(2)}
            </Link>
          </section>
        )}

        {order.status === "pending_payment" && isBuyer && (!isCommission || activeCommissionTab === "requirements") && (
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6 space-y-4">
            <h2 className="font-display text-xl text-ink">Order Details</h2>
            <p className="text-sm font-body text-muted">
              Confirm your details here before you continue to checkout.
            </p>

            {isPhysicalProduct && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <input
                  placeholder="Full name"
                  value={shippingDraft.name}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, name: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="Address line 1"
                  value={shippingDraft.line1}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, line1: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="Address line 2 (optional)"
                  value={shippingDraft.line2}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, line2: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="City"
                  value={shippingDraft.city}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, city: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="State / Region"
                  value={shippingDraft.state}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, state: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="Postal code"
                  value={shippingDraft.postal_code}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, postal_code: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <input
                  placeholder="Country"
                  value={shippingDraft.country}
                  onChange={(event) => setShippingDraft((prev) => ({ ...prev, country: event.target.value }))}
                  className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body sm:col-span-2"
                />
              </div>
            )}

            {isCommission && (
              <div className="space-y-3">
                <textarea
                  rows={5}
                  value={briefDraft}
                  onChange={(event) => setBriefDraft(event.target.value)}
                  placeholder="Describe project goals, style, references, and deliverables."
                  className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={dueDateDraft}
                    onChange={(event) => setDueDateDraft(event.target.value)}
                    className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                  />
                  <input
                    value={notesDraft}
                    onChange={(event) => setNotesDraft(event.target.value)}
                    placeholder="Extra notes (optional)"
                    className="px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body"
                  />
                </div>
              </div>
            )}

            {(draftValidationError || updateDraftError) && (
              <p className="text-sm font-body text-red-500">{draftValidationError || updateDraftError}</p>
            )}
            {draftNotice && (
              <p className="text-sm font-body text-green-600">{draftNotice}</p>
            )}

            <button
              onClick={handleSaveDraftDetails}
              disabled={updatingDraft}
              className="px-5 py-3 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60"
            >
              {updatingDraft ? "Saving..." : "Save Details"}
            </button>
          </section>
        )}

        {order.status === "pending_payment" && !isBuyer && (
          <section className={`rounded-2xl p-5 sm:p-6 text-center ${
            isCommission
              ? "border border-purple-primary/25 bg-purple-50/60"
              : "border border-yellow-300/50 bg-yellow-50"
          }`}>
            <h2 className="font-display text-lg text-ink mb-1">Awaiting Payment</h2>
            <p className="text-sm font-body text-muted">
              The buyer hasn&apos;t completed payment yet. You&apos;ll be notified when the order is active.
            </p>
          </section>
        )}

        {isCommission && activeCommissionTab && (
          <>
            <section className="rounded-2xl border border-black/[0.06] bg-white p-4 sm:p-5">
              <p className="text-[10px] font-ui uppercase tracking-[0.18em] text-purple-primary/70 mb-3">
                Order Workspace
              </p>
              <div className="flex items-center gap-5 overflow-x-auto scrollbar-hide border-b border-black/[0.08]">
                {COMMISSION_WORKSPACE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => updateCommissionTab(tab.key)}
                    className={`shrink-0 pb-2 text-sm font-ui transition-colors border-b-2 ${
                      activeCommissionTab === tab.key
                        ? "text-pink-vivid border-pink-vivid"
                        : "text-muted border-transparent hover:text-purple-primary"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-xs font-body text-muted">
                {activeCommissionTabMeta?.hint}
              </p>
            </section>

            <CommissionProcessGuide
              order={order}
              isBuyer={isBuyer}
              revisionRemaining={revisionRemaining}
              activeTab={activeCommissionTab}
              onOpenTab={updateCommissionTab}
            />
          </>
        )}

        {/* Timeline */}
        {(!isCommission || activeCommissionTab === "overview") && (
          <OrderTimeline order={order} />
        )}

        {/* Brief (commissions) */}
        {isCommission && activeCommissionTab === "requirements" && order.brief && (order.status !== "pending_payment" || !isBuyer) && (
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink mb-3">Brief</h2>
            <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{order.brief}</p>
            {order.requirements && Object.keys(order.requirements).length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-gray-50 border border-black/[0.06]">
                <p className="text-xs font-ui uppercase tracking-wider text-muted mb-2">Requirements</p>
                {Object.entries(order.requirements).map(([key, value]) => (
                  <div key={key} className="text-sm font-body text-ink/80 mb-1">
                    <span className="font-semibold">{key}:</span>{" "}
                    {Array.isArray(value) ? value.join(", ") : String(value)}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {isCommission && activeCommissionTab === "requirements" && !order.brief && (order.status !== "pending_payment" || !isBuyer) && (
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink mb-2">Requirements</h2>
            <p className="text-sm font-body text-muted">
              The order brief has not been provided yet. Ask for project details in the Activity tab before continuing.
            </p>
          </section>
        )}

        {/* Shipping Address (physical products) */}
        {order.shipping_address && (order.status !== "pending_payment" || !isBuyer) && (
          <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
            <h2 className="font-display text-xl text-ink mb-3">Shipping Address</h2>
            <div className="font-body text-sm text-ink/90">
              <p className="font-semibold">{order.shipping_address.name}</p>
              <p>{order.shipping_address.line1}</p>
              {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
              <p>
                {order.shipping_address.city}
                {order.shipping_address.state ? `, ${order.shipping_address.state}` : ""}{" "}
                {order.shipping_address.postal_code}
              </p>
              <p>{order.shipping_address.country}</p>
            </div>
          </section>
        )}

        {/* Digital Downloads */}
        {!isCommission && order.product?.delivery_type === "digital" &&
          ["completed", "delivered"].includes(order.status) && isBuyer && (
          <DigitalDownloadSection orderId={order.id} />
        )}

        {/* Shipping Tracker (physical products) */}
        {!isCommission && order.product?.delivery_type !== "digital" &&
          order.tracking_number && (
          <ShippingTracker order={order} />
        )}

        {/* Tracking Input (seller: physical products, not yet shipped) */}
        {!isCommission && order.product?.delivery_type !== "digital" &&
          !isBuyer && !order.tracking_number &&
          ["paid", "in_progress", "processing"].includes(order.status) && (
          <TrackingInput orderId={order.id} onSuccess={refetch} />
        )}

        {/* Confirm Delivery (buyer: physical shipped orders) */}
        {!isCommission && order.status === "shipped" && isBuyer && (
          <ConfirmDeliveryBanner orderId={order.id} onConfirm={refetch} />
        )}

        {/* Commission Delivery Section */}
        {isCommission && activeCommissionTab === "delivery" && isCommissionDeliveryState && (
          <DeliverySection order={order} isSeller={!isBuyer} onUpdate={refetch} />
        )}

        {/* Actions */}
        {(!isCommission || activeCommissionTab === "overview" || (activeCommissionTab === "delivery" && !isCommissionDeliveryState)) && (
          <OrderActions
            order={order}
            onUpdate={() => refetch()}
          />
        )}

        {/* Dispute Banner */}
        {(!isCommission || activeCommissionTab === "overview" || activeCommissionTab === "activity") && (
          <DisputeBanner orderId={order.id} orderStatus={order.status} />
        )}

        {/* Reviews */}
        {(!isCommission || activeCommissionTab === "reviews") && (
          <OrderReviewSection order={order} userId={user?.id} />
        )}

        {/* Messages */}
        {(!isCommission || activeCommissionTab === "activity") && (
          <OrderMessages orderId={orderId} />
        )}
      </div>
    </div>
  );
}

function CommissionProcessGuide({
  order,
  isBuyer,
  revisionRemaining,
  activeTab,
  onOpenTab,
}: {
  order: Order;
  isBuyer: boolean;
  revisionRemaining: number | null;
  activeTab: CommissionWorkspaceTab;
  onOpenTab: (tab: CommissionWorkspaceTab) => void;
}) {
  const phaseIndex = (() => {
    if (["pending_acceptance", "pending_payment"].includes(order.status)) return 0;
    if (["paid", "in_progress", "revision_requested"].includes(order.status)) return 1;
    if (order.status === "submitted") return 2;
    if (order.status === "completed") return 3;
    return 1;
  })();

  const nextStep = (() => {
    if (order.status === "pending_acceptance") {
      return {
        title: isBuyer ? "Waiting for seller approval" : "Review this order request",
        description: isBuyer
          ? "The seller needs to accept before payment starts the order."
          : "Accept or decline this request in Overview after checking the brief.",
        tab: "overview" as CommissionWorkspaceTab,
      };
    }
    if (order.status === "pending_payment") {
      return {
        title: isBuyer ? "Confirm requirements and pay" : "Waiting for buyer payment",
        description: isBuyer
          ? "Service platforms keep this step explicit so scope is locked before kickoff."
          : "Once payment clears, work starts and due dates begin.",
        tab: "requirements" as CommissionWorkspaceTab,
      };
    }
    if (["paid", "in_progress", "revision_requested"].includes(order.status)) {
      return {
        title: isBuyer ? "Track progress and clarify details" : "Deliver against the brief",
        description: isBuyer
          ? "Use Activity for questions and Delivery to review submissions."
          : "Use Delivery to submit files and notes clearly for buyer approval.",
        tab: isBuyer ? ("activity" as CommissionWorkspaceTab) : ("delivery" as CommissionWorkspaceTab),
      };
    }
    if (order.status === "submitted") {
      return {
        title: isBuyer ? "Review submission now" : "Await buyer review",
        description: isBuyer
          ? "Accept delivery or request revision from the Delivery tab."
          : "Stay available for revision requests and feedback in Activity.",
        tab: isBuyer ? ("delivery" as CommissionWorkspaceTab) : ("activity" as CommissionWorkspaceTab),
      };
    }
    if (order.status === "completed") {
      return {
        title: "Closeout and feedback",
        description: "Leave a review to complete the service workflow.",
        tab: "reviews" as CommissionWorkspaceTab,
      };
    }
    return {
      title: "Track order updates",
      description: "Use Activity for the latest messages and order events.",
      tab: "activity" as CommissionWorkspaceTab,
    };
  })();

  const phases = ["Requirements", "Workroom", "Delivery", "Closeout"];

  return (
    <section className="rounded-2xl border border-purple-primary/15 bg-white p-5 sm:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <p className="text-[10px] font-ui uppercase tracking-[0.18em] text-purple-primary/70">Process Guide</p>
          <h2 className="font-display text-xl text-ink mt-1">{nextStep.title}</h2>
          <p className="text-sm font-body text-muted mt-1">{nextStep.description}</p>
        </div>
        {activeTab !== nextStep.tab && (
          <button
            type="button"
            onClick={() => onOpenTab(nextStep.tab)}
            className="inline-flex px-4 py-2 rounded-full text-xs font-ui font-semibold text-purple-primary border border-purple-primary/25 hover:border-pink-vivid/40 hover:text-pink-vivid transition-colors"
          >
            Open {COMMISSION_WORKSPACE_TABS.find((tab) => tab.key === nextStep.tab)?.label}
          </button>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {phases.map((label, index) => {
          const isDone = index < phaseIndex;
          const isCurrent = index === phaseIndex;
          return (
            <div
              key={label}
              className={`rounded-xl border px-3 py-2 text-xs font-ui ${
                isDone
                  ? "border-pink-vivid/30 bg-pink-50/50 text-pink-vivid"
                  : isCurrent
                    ? "border-purple-primary/30 bg-purple-50/60 text-purple-primary"
                    : "border-black/[0.08] text-muted"
              }`}
            >
              {label}
            </div>
          );
        })}
      </div>

      {order.max_revisions != null && (
        <p className="mt-3 text-xs font-body text-muted">
          Revisions remaining: {revisionRemaining}
        </p>
      )}
    </section>
  );
}

const REVIEWABLE_STATUSES = new Set(["completed"]);

function OrderReviewSection({ order, userId }: { order: Order; userId?: string }) {
  const { reviews, myReview, loading, refetch } = useOrderReviews(
    REVIEWABLE_STATUSES.has(order.status) ? order.id : undefined,
    userId
  );
  const [showForm, setShowForm] = useState(false);

  if (!REVIEWABLE_STATUSES.has(order.status) || !userId) return null;
  if (loading) return null;

  const isBuyer = userId === order.buyer_id;
  const isSeller = userId === order.seller_id;
  const canLeaveReview = order.listing_type === "product" ? isBuyer : (isBuyer || isSeller);
  const hasReviewed = !!myReview;

  return (
    <section id="reviews" className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
      <h2 className="font-display text-xl text-ink mb-1">Quill Reviews</h2>
      <p className="text-sm font-body text-muted mb-4">
        {order.listing_type === "product"
          ? "Buyers can leave a review after this order is completed."
          : "After completion, both buyer and seller can review each other."}
      </p>

      {/* Existing reviews */}
      {reviews.length > 0 && (
        <div className="mb-4 space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Leave a review */}
      {canLeaveReview && !hasReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-purple-primary/30 text-purple-primary font-ui font-semibold text-sm hover:bg-purple-50/50 transition-colors"
        >
          Leave a Quill Review
        </button>
      )}

      {canLeaveReview && !hasReviewed && showForm && (
        <ReviewForm
          orderId={order.id}
          onSubmitted={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {!canLeaveReview && (
        <p className="text-sm font-body text-muted">
          Only the buyer can review completed product orders.
        </p>
      )}

      {hasReviewed && canLeaveReview && (
        <p className="text-sm font-body text-muted">
          Your review is live on this order.
        </p>
      )}
    </section>
  );
}

function DisputeBanner({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const { dispute, loading } = useOrderDispute(
    ["disputed", "resolved"].includes(orderStatus) ? orderId : undefined
  );

  if (loading || !dispute) return null;

  const isResolved = dispute.status === "resolved";

  return (
    <section className={`rounded-2xl border-2 p-5 sm:p-6 ${
      isResolved
        ? "border-green-200 bg-green-50"
        : "border-red-200 bg-red-50"
    }`}>
      <div className="flex items-center gap-2 mb-3">
        <svg className={`w-5 h-5 ${isResolved ? "text-green-600" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {isResolved ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          )}
        </svg>
        <h2 className={`font-display text-lg ${isResolved ? "text-green-700" : "text-red-700"}`}>
          {isResolved ? "Dispute Resolved" : "Dispute Open"}
        </h2>
      </div>

      <div className="space-y-2">
        <div>
          <span className={`text-xs font-ui uppercase tracking-wider ${isResolved ? "text-green-600/70" : "text-red-500/70"}`}>
            Reason
          </span>
          <p className={`text-sm font-body ${isResolved ? "text-green-800" : "text-red-800"}`}>
            {DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}
          </p>
        </div>

        <div>
          <span className={`text-xs font-ui uppercase tracking-wider ${isResolved ? "text-green-600/70" : "text-red-500/70"}`}>
            Description
          </span>
          <p className={`text-sm font-body ${isResolved ? "text-green-800" : "text-red-800"}`}>
            {dispute.description}
          </p>
        </div>

        {isResolved && dispute.resolution && (
          <div>
            <span className="text-xs font-ui uppercase tracking-wider text-green-600/70">
              Resolution
            </span>
            <p className="text-sm font-body text-green-800 font-semibold">
              {DISPUTE_RESOLUTION_LABELS[dispute.resolution] || dispute.resolution}
            </p>
            {dispute.resolution_notes && (
              <p className="text-sm font-body text-green-700 mt-1">{dispute.resolution_notes}</p>
            )}
            {dispute.refund_amount && (
              <p className="text-sm font-body text-green-700 mt-1">
                Refund amount: ${dispute.refund_amount.toFixed(2)}
              </p>
            )}
          </div>
        )}

        <p className={`text-xs font-body ${isResolved ? "text-green-600/60" : "text-red-500/60"}`}>
          {isResolved && dispute.resolved_at
            ? `Resolved on ${new Date(dispute.resolved_at).toLocaleDateString()}`
            : `Opened on ${new Date(dispute.created_at).toLocaleDateString()}`
          }
        </p>
      </div>
    </section>
  );
}

function ConfirmDeliveryBanner({ orderId, onConfirm }: { orderId: string; onConfirm: () => void }) {
  const { confirmDelivery, confirming } = useConfirmDelivery();
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = async () => {
    const ok = await confirmDelivery(orderId);
    if (ok) {
      setConfirmed(true);
      onConfirm();
    }
  };

  if (confirmed) {
    return (
      <section className="rounded-2xl border border-green-200 bg-green-50 p-5 text-center">
        <p className="font-ui font-semibold text-green-700">Delivery confirmed! Order complete.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border-2 border-emerald-300/50 bg-emerald-50 p-5 sm:p-6 text-center">
      <h2 className="font-display text-xl text-ink mb-2">Package Shipped!</h2>
      <p className="text-sm font-body text-muted mb-4">
        Have you received your order? Confirm delivery to complete the order.
      </p>
      <button
        onClick={handleConfirm}
        disabled={confirming}
        className="inline-flex px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
      >
        {confirming ? "Confirming..." : "Confirm Delivery"}
      </button>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] px-3 py-2.5">
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className="font-ui font-semibold text-ink mt-1 truncate">{value}</p>
    </div>
  );
}
