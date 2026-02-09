"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrder } from "@/lib/hooks/useOrders";
import { useOrderReviews } from "@/lib/hooks/useReviews";
import { useOrderDispute } from "@/lib/hooks/useDisputes";
import CheckoutModal from "@/components/checkout/CheckoutModal";
import ReviewForm from "@/components/reviews/ReviewForm";
import ReviewCard from "@/components/reviews/ReviewCard";
import OrderTimeline from "./OrderTimeline";
import OrderMessages from "./OrderMessages";
import OrderActions from "./OrderActions";
import type { Order } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS, DISPUTE_RESOLUTION_LABELS } from "@/lib/types/store";

interface OrderViewProps {
  orderId: string;
}

export default function OrderView({ orderId }: OrderViewProps) {
  const { user } = useAuth();
  const { order, loading, error, refetch } = useOrder(orderId);
  const searchParams = useSearchParams();
  const [showCheckout, setShowCheckout] = useState(false);

  // Auto-open checkout if redirected back with payment=success
  const paymentParam = searchParams.get("payment");
  useEffect(() => {
    if (paymentParam === "start" && order?.status === "pending_payment" && user?.id === order.buyer_id) {
      setShowCheckout(true);
    }
    if (paymentParam === "success") {
      refetch();
    }
  }, [paymentParam, order?.status, order?.buyer_id, user?.id, refetch]);

  const handlePaymentSuccess = useCallback(() => {
    setShowCheckout(false);
    refetch();
  }, [refetch]);

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
        </section>

        {/* Payment Required Banner */}
        {order.status === "pending_payment" && isBuyer && (
          <section className="rounded-2xl border-2 border-[var(--color-purple-primary)]/30 bg-purple-50 p-5 sm:p-6 text-center">
            <h2 className="font-display text-xl text-ink mb-2">Payment Required</h2>
            <p className="text-sm font-body text-muted mb-4">
              Complete your payment to activate this order.
              {order.listing_type === "service" && " Your payment will be held securely until you approve the delivery."}
            </p>
            <button
              onClick={() => setShowCheckout(true)}
              className="px-8 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity"
            >
              Pay ${Number(order.amount).toFixed(2)}
            </button>
          </section>
        )}

        {order.status === "pending_payment" && !isBuyer && (
          <section className="rounded-2xl border border-yellow-300/50 bg-yellow-50 p-5 sm:p-6 text-center">
            <h2 className="font-display text-lg text-ink mb-1">Awaiting Payment</h2>
            <p className="text-sm font-body text-muted">
              The buyer hasn&apos;t completed payment yet. You&apos;ll be notified when the order is active.
            </p>
          </section>
        )}

        {/* Checkout Modal */}
        {showCheckout && order && (
          <CheckoutModal
            order={order}
            onSuccess={handlePaymentSuccess}
            onClose={() => setShowCheckout(false)}
          />
        )}

        {/* Timeline */}
        <OrderTimeline order={order} />

        {/* Brief (commissions) */}
        {isCommission && order.brief && (
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

        {/* Shipping Address (physical products) */}
        {order.shipping_address && (
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

        {/* Actions */}
        <OrderActions
          order={order}
          onUpdate={() => refetch()}
        />

        {/* Dispute Banner */}
        <DisputeBanner orderId={order.id} orderStatus={order.status} />

        {/* Reviews */}
        <OrderReviewSection order={order} userId={user?.id} />

        {/* Messages */}
        <OrderMessages orderId={orderId} />
      </div>
    </div>
  );
}

const REVIEWABLE_STATUSES = new Set(["completed", "delivered", "resolved"]);

function OrderReviewSection({ order, userId }: { order: Order; userId?: string }) {
  const { reviews, myReview, loading, refetch } = useOrderReviews(
    REVIEWABLE_STATUSES.has(order.status) ? order.id : undefined,
    userId
  );
  const [showForm, setShowForm] = useState(false);

  if (!REVIEWABLE_STATUSES.has(order.status) || !userId) return null;
  if (loading) return null;

  const hasReviewed = !!myReview;

  return (
    <section className="rounded-2xl border border-black/[0.06] bg-white p-5 sm:p-6">
      <h2 className="font-display text-xl text-ink mb-4">Reviews</h2>

      {/* Existing reviews */}
      {reviews.length > 0 && (
        <div className="mb-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              onResponseSubmitted={refetch}
            />
          ))}
        </div>
      )}

      {/* Leave a review */}
      {!hasReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-purple-primary/30 text-purple-primary font-ui font-semibold text-sm hover:bg-purple-50/50 transition-colors"
        >
          Leave a Review
        </button>
      )}

      {!hasReviewed && showForm && (
        <ReviewForm
          orderId={order.id}
          onSubmitted={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      {hasReviewed && reviews.length === 0 && (
        <p className="text-sm font-body text-muted">
          Your review has been submitted. It will be visible once the other party also reviews (or after 14 days).
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

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-black/[0.08] px-3 py-2.5">
      <p className="text-xs font-ui uppercase tracking-wider text-muted">{label}</p>
      <p className="font-ui font-semibold text-ink mt-1 truncate">{value}</p>
    </div>
  );
}
