"use client";

import { formatCurrency } from "@/lib/utils/currency";
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
import type { Order, OrderStatus } from "@/lib/types/store";
import { DISPUTE_REASON_LABELS, DISPUTE_RESOLUTION_LABELS } from "@/lib/types/store";

// ─── Types ──────────────────────────────────────────────────────────

interface OrderViewProps {
  orderId: string;
}

type OrderTab = "overview" | "activity" | "reviews";

// ─── Constants ──────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bgClass: string; textClass: string; icon: string }> = {
  pending_acceptance: { label: "Pending Approval", color: "#f59e0b", bgClass: "bg-amber-500/10", textClass: "text-amber-600", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
  pending_payment:    { label: "Awaiting Payment", color: "#8e44ad", bgClass: "bg-purple-500/10", textClass: "text-purple-600", icon: "M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" },
  paid:               { label: "Paid", color: "#8e44ad", bgClass: "bg-purple-primary/10", textClass: "text-purple-primary", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  in_progress:        { label: "In Progress", color: "#8e44ad", bgClass: "bg-purple-primary/10", textClass: "text-purple-primary", icon: "M13 10V3L4 14h7v7l9-11h-7z" },
  submitted:          { label: "Submitted", color: "#6366f1", bgClass: "bg-indigo-500/10", textClass: "text-indigo-600", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  revision_requested: { label: "Revision Requested", color: "#f59e0b", bgClass: "bg-amber-500/10", textClass: "text-amber-600", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  processing:         { label: "Processing", color: "#8e44ad", bgClass: "bg-purple-primary/10", textClass: "text-purple-primary", icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" },
  shipped:            { label: "Shipped", color: "#06b6d4", bgClass: "bg-cyan-500/10", textClass: "text-cyan-600", icon: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" },
  delivered:          { label: "Delivered", color: "#10b981", bgClass: "bg-emerald-500/10", textClass: "text-emerald-600", icon: "M5 13l4 4L19 7" },
  completed:          { label: "Completed", color: "#10b981", bgClass: "bg-emerald-500/10", textClass: "text-emerald-600", icon: "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" },
  cancelled:          { label: "Cancelled", color: "#777777", bgClass: "bg-skeleton/70", textClass: "text-muted", icon: "M6 18L18 6M6 6l12 12" },
  refund_requested:   { label: "Refund Requested", color: "#f97316", bgClass: "bg-orange-500/10", textClass: "text-orange-600", icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" },
  refunded:           { label: "Refunded", color: "#ef4444", bgClass: "bg-red-500/10", textClass: "text-red-500", icon: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" },
  disputed:           { label: "Disputed", color: "#ef4444", bgClass: "bg-red-500/10", textClass: "text-red-500", icon: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" },
  resolved:           { label: "Resolved", color: "#10b981", bgClass: "bg-emerald-500/10", textClass: "text-emerald-600", icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" },
  declined:           { label: "Declined", color: "#777777", bgClass: "bg-skeleton/70", textClass: "text-muted", icon: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" },
  expired:            { label: "Checkout Expired", color: "#777777", bgClass: "bg-skeleton/70", textClass: "text-muted", icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" },
};

function getDefaultTab(order: Order): OrderTab {
  if (order.status === "completed") return "reviews";
  if (["disputed", "resolved", "cancelled", "refunded"].includes(order.status)) return "activity";
  return "overview";
}

function getOrderTypeLabel(order: Order): string {
  if (order.listing_type === "service") return "Commission";
  if (order.product?.delivery_type === "digital") return "Digital Product";
  return "Physical Product";
}

function getOrderTypeIcon(order: Order): string {
  if (order.listing_type === "service") return "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z";
  if (order.product?.delivery_type === "digital") return "M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10";
  return "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4";
}

function formatDate(dateStr: string, includeTime = false): string {
  const d = new Date(dateStr);
  if (includeTime) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  }
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

// ─── Main Component ─────────────────────────────────────────────────

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
    name: "", line1: "", line2: "", city: "", state: "", postal_code: "", country: "",
  });
  const [briefDraft, setBriefDraft] = useState("");
  const [notesDraft, setNotesDraft] = useState("");
  const [dueDateDraft, setDueDateDraft] = useState("");

  const paymentParam = searchParams.get("payment");
  const tabParam = searchParams.get("tab") as OrderTab | null;

  // Redirect to dedicated checkout page if payment=start
  useEffect(() => {
    if (paymentParam === "start" && order?.status === "pending_payment" && user?.id === order.buyer_id) {
      router.replace(`/checkout/${orderId}`);
    }
  }, [paymentParam, order?.status, order?.buyer_id, user?.id, orderId, router]);

  // Refresh order if redirected back with payment=success
  useEffect(() => {
    if (paymentParam === "success" && order?.id && user?.id === order.buyer_id && !paymentSyncTriggeredRef.current) {
      paymentSyncTriggeredRef.current = true;
      void refetch();
    }
    if (paymentParam !== "success") {
      paymentSyncTriggeredRef.current = false;
    }
  }, [paymentParam, order?.id, order?.buyer_id, user?.id, refetch]);

  /* eslint-disable react-hooks/set-state-in-effect */
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
      const d = new Date(order.due_date);
      setDueDateDraft(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    } else {
      setDueDateDraft("");
    }
  }, [order]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Loading State ──────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="h-5 w-20 bg-skeleton/70 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-5">
              <div className="h-48 bg-skeleton/70 rounded-2xl animate-pulse" />
              <div className="h-64 bg-skeleton/70 rounded-2xl animate-pulse" />
            </div>
            <div className="space-y-5">
              <div className="h-56 bg-skeleton/70 rounded-2xl animate-pulse" />
              <div className="h-40 bg-skeleton/70 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Error State ────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-skeleton/70 flex items-center justify-center">
            <svg className="w-8 h-8 text-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-ink mb-2">Order not found</h1>
          <p className="font-body text-sm text-muted mb-6">
            This order doesn&apos;t exist or you don&apos;t have permission to view it.
          </p>
          <Link href="/orders" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid hover:opacity-90 transition-opacity">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back to Orders
          </Link>
        </div>
      </div>
    );
  }

  // ─── Derived State ──────────────────────────────────────────────
  const isBuyer = user?.id === order.buyer_id;
  const counterparty = isBuyer ? order.seller : order.buyer;
  const isCommission = order.listing_type === "service";
  const isDigital = !isCommission && order.product?.delivery_type === "digital";
  const isPhysical = !isCommission && !isDigital;
  const shippingCost = Number(order.shipping_cost || 0);
  const originalAmount = Number(order.original_amount ?? order.amount);
  const discountAmount = Number(order.discount_amount || 0);
  const subtotalAmount = Math.max(originalAmount - shippingCost, 0);
  const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.paid;
  const validTabs: OrderTab[] = ["overview", "activity", "reviews"];
  const activeTab = (tabParam && validTabs.includes(tabParam)) ? tabParam : getDefaultTab(order);
  const isCommissionDeliveryState = isCommission && ["in_progress", "revision_requested", "submitted", "completed", "delivered"].includes(order.status);
  const productImage = order.product?.media?.[0]?.media_url;

  const setActiveTab = (tab: OrderTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
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

    if (isPhysical) {
      if (!shippingDraft.name.trim() || !shippingDraft.line1.trim() || !shippingDraft.city.trim() || !shippingDraft.country.trim()) {
        setDraftValidationError("Shipping details are incomplete. Name, address, city, and country are required.");
        return;
      }
      payload.shipping_address = {
        name: shippingDraft.name.trim(), line1: shippingDraft.line1.trim(), line2: shippingDraft.line2.trim(),
        city: shippingDraft.city.trim(), state: shippingDraft.state.trim(),
        postal_code: shippingDraft.postal_code.trim(), country: shippingDraft.country.trim(),
      };
    }

    if (isCommission) {
      if (!briefDraft.trim()) { setDraftValidationError("Commission brief cannot be empty."); return; }
      payload.brief = briefDraft.trim();
      payload.requirements = { ...(order.requirements || {}), notes: notesDraft.trim() };
      if (dueDateDraft) {
        const parsedDueDate = new Date(`${dueDateDraft}T12:00:00Z`);
        if (Number.isNaN(parsedDueDate.getTime())) { setDraftValidationError("Please enter a valid due date."); return; }
        payload.due_date = parsedDueDate.toISOString();
      }
    }

    const success = await updateDraft(payload);
    if (!success) return;
    setDraftNotice("Order details saved.");
    await refetch();
  };

  // ─── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* ─── Breadcrumb ────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-sm font-ui text-muted mb-6">
          <Link href="/orders" className="hover:text-accent transition-colors">Orders</Link>
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          <span className="text-ink font-medium truncate max-w-[200px]">{order.order_number}</span>
        </nav>

        {/* ─── Hero Header ───────────────────────────────────────── */}
        <header className="mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div className="flex items-start gap-4 min-w-0">
              {/* Product thumbnail */}
              {productImage ? (
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden shrink-0 bg-skeleton/70 ring-1 ring-black/[0.06]">
                  <Image src={productImage} alt="" fill className="object-cover" />
                </div>
              ) : (
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl shrink-0 bg-gradient-to-br from-purple-100 to-pink-50 flex items-center justify-center ring-1 ring-black/[0.06]">
                  <svg className="w-7 h-7 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getOrderTypeIcon(order)} />
                  </svg>
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-display text-xl sm:text-2xl text-ink leading-tight mb-1 truncate">
                  {order.product?.title || "Order"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-body text-muted">{order.order_number}</span>
                  <span className="hidden sm:inline text-muted/40">|</span>
                  <span className="flex items-center gap-1.5 text-sm font-body text-muted">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={getOrderTypeIcon(order)} />
                    </svg>
                    {getOrderTypeLabel(order)}
                  </span>
                </div>
              </div>
            </div>

            {/* Status badge */}
            <div className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-full shrink-0 ${statusCfg.bgClass}`}>
              <svg className={`w-4 h-4 ${statusCfg.textClass}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={statusCfg.icon} />
              </svg>
              <span className={`text-sm font-ui font-semibold ${statusCfg.textClass}`}>{statusCfg.label}</span>
            </div>
          </div>

          {/* Key metrics strip */}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 border-t border-b border-border-light text-sm font-body">
            <div>
              <span className="text-muted">{isBuyer ? "Total paid" : "Order total"}</span>
              <span className="ml-1.5 font-semibold text-ink text-base">{formatCurrency(isBuyer ? Number(order.total_amount ?? order.amount) : order.amount)}</span>
            </div>
            {!isBuyer && (
              <div>
                <span className="text-muted">Your Earnings</span>
                <span className="ml-1.5 font-semibold text-emerald-600">{formatCurrency(order.seller_amount)}</span>
              </div>
            )}
            {isCommission && order.due_date && (
              <div>
                <span className="text-muted">Due</span>
                <span className="ml-1.5 font-semibold text-ink">{formatDate(order.due_date)}</span>
              </div>
            )}
            <div>
              <span className="text-muted">Ordered</span>
              <span className="ml-1.5 text-ink">{formatDate(order.created_at)}</span>
            </div>
            {counterparty && (
              <Link href={`/studio/${counterparty.username}`} className="ml-auto flex items-center gap-2 group">
                {counterparty.avatar_url ? (
                  <Image src={counterparty.avatar_url} alt="" width={28} height={28} className="w-7 h-7 rounded-full ring-1 ring-black/[0.06]" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-xs font-ui font-bold text-white">
                    {(counterparty.display_name || counterparty.username)[0].toUpperCase()}
                  </div>
                )}
                <span className="text-sm font-ui text-muted group-hover:text-accent transition-colors">
                  {counterparty.display_name || counterparty.username}
                  <span className="text-xs text-muted/60 ml-1">({isBuyer ? "seller" : "buyer"})</span>
                </span>
              </Link>
            )}
          </div>
        </header>

        {/* ─── Contextual Banners ────────────────────────────────── */}
        <BannerSection order={order} isBuyer={isBuyer} />

        {/* ─── Actions ───────────────────────────────────────────── */}
        <OrderActions order={order} onUpdate={() => refetch()} />

        {/* ─── Tab Navigation ────────────────────────────────────── */}
        <div className="mt-6 mb-5 border-b border-border-light">
          <nav className="flex gap-0">
            {([
              { key: "overview" as OrderTab, label: "Overview" },
              { key: "activity" as OrderTab, label: "Activity" },
              { key: "reviews" as OrderTab, label: "Reviews" },
            ]).map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`relative px-4 sm:px-5 py-3 text-sm font-ui font-medium transition-colors ${
                  activeTab === tab.key
                    ? "text-purple-primary"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* ─── Tab Content ───────────────────────────────────────── */}

        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN — Primary content */}
            <div className="lg:col-span-2 space-y-5">

              {/* Progress Timeline */}
              <Card>
                <CardHeader title="Order Progress" />
                <OrderTimeline order={order} />
              </Card>

              {/* Commission Delivery Section */}
              {isCommission && isCommissionDeliveryState && (
                <Card>
                  <CardHeader title="Delivery" />
                  <DeliverySection order={order} isSeller={!isBuyer} onUpdate={refetch} />
                </Card>
              )}

              {/* Digital Downloads */}
              {isDigital && ["completed", "delivered"].includes(order.status) && isBuyer && (
                <Card>
                  <CardHeader title="Downloads" subtitle="Your purchased files are ready" />
                  <DigitalDownloadSection orderId={order.id} />
                </Card>
              )}

              {/* Shipping Tracker */}
              {isPhysical && order.tracking_number && (
                <Card>
                  <CardHeader title="Shipment Tracking" />
                  <ShippingTracker order={order} />
                </Card>
              )}

              {/* Tracking Input (seller) */}
              {isPhysical && !isBuyer && !order.tracking_number &&
                ["paid", "in_progress", "processing"].includes(order.status) && (
                <Card>
                  <CardHeader title="Add Tracking" subtitle="Enter shipping details for the buyer" />
                  <TrackingInput orderId={order.id} onSuccess={refetch} />
                </Card>
              )}

              {/* Confirm Delivery (buyer: physical shipped) */}
              {isPhysical && order.status === "shipped" && isBuyer && (
                <ConfirmDeliveryCard orderId={order.id} onConfirm={refetch} />
              )}

              {/* Commission Brief */}
              {isCommission && order.brief && (order.status !== "pending_payment" || !isBuyer) && (
                <Card>
                  <CardHeader title="Commission Brief" />
                  <p className="font-body text-sm text-ink/90 whitespace-pre-wrap leading-relaxed">{order.brief}</p>
                  {order.requirements && Object.keys(order.requirements).length > 0 && (
                    <div className="mt-4 p-3.5 rounded-xl bg-subtle border border-border-light">
                      <p className="text-[11px] font-ui uppercase tracking-wider text-muted mb-2.5">Requirements</p>
                      <div className="space-y-1.5">
                        {Object.entries(order.requirements).map(([key, value]) => (
                          <div key={key} className="text-sm font-body text-ink/80">
                            <span className="font-semibold capitalize">{key}:</span>{" "}
                            {Array.isArray(value) ? value.join(", ") : String(value)}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Card>
              )}

              {/* Draft details (pre-payment editing) */}
              {order.status === "pending_payment" && isBuyer && (
                <Card>
                  <CardHeader title="Edit Details" subtitle="Confirm your details before checkout" />
                  <DraftEditor
                    isPhysical={isPhysical}
                    isCommission={isCommission}
                    shippingDraft={shippingDraft}
                    setShippingDraft={setShippingDraft}
                    briefDraft={briefDraft}
                    setBriefDraft={setBriefDraft}
                    dueDateDraft={dueDateDraft}
                    setDueDateDraft={setDueDateDraft}
                    notesDraft={notesDraft}
                    setNotesDraft={setNotesDraft}
                    draftValidationError={draftValidationError}
                    updateDraftError={updateDraftError}
                    draftNotice={draftNotice}
                    updatingDraft={updatingDraft}
                    onSave={handleSaveDraftDetails}
                  />
                </Card>
              )}

              {/* Dispute Banner */}
              <DisputeBanner orderId={order.id} orderStatus={order.status} />
            </div>

            {/* RIGHT COLUMN — Sidebar */}
            <div className="space-y-5">
              {/* Order Summary */}
              <Card>
                <CardHeader title="Summary" />
                <div className="space-y-3 text-sm font-body">
                  <SummaryRow label={isCommission ? "Commission" : "Product"} value={formatCurrency(subtotalAmount)} />
                  {isCommission && order.pricing?.variant_name && (
                    <SummaryRow label="Package" value={order.pricing.variant_name} />
                  )}
                  {!isCommission && order.quantity > 1 && (
                    <SummaryRow label="Quantity" value={String(order.quantity)} />
                  )}
                  {shippingCost > 0 && (
                    <SummaryRow label="Shipping" value={formatCurrency(shippingCost)} />
                  )}
                  {discountAmount > 0 && (
                    <SummaryRow label="Discount" value={`-${formatCurrency(discountAmount)}`} className="text-emerald-600" />
                  )}
                  {isBuyer && Number(order.buyer_fee || 0) > 0 && (
                    <SummaryRow label="Processing fee" value={formatCurrency(Number(order.buyer_fee))} muted />
                  )}
                  {!isBuyer && (
                    <SummaryRow label="Pinkquill fee" value={`-${formatCurrency(order.platform_fee)}`} muted />
                  )}
                  <div className="border-t border-border-light pt-3 flex justify-between font-semibold text-ink">
                    <span>{isBuyer ? "Total paid" : "You receive"}</span>
                    <span className="text-base">
                      {formatCurrency(isBuyer ? Number(order.total_amount ?? order.amount) : Number(order.seller_amount))}
                    </span>
                  </div>
                </div>
              </Card>

              {/* Counterparty Card */}
              {counterparty && (
                <Card>
                  <CardHeader title={isBuyer ? "Seller" : "Buyer"} />
                  <Link href={`/studio/${counterparty.username}`} className="flex items-center gap-3 group">
                    {counterparty.avatar_url ? (
                      <Image src={counterparty.avatar_url} alt="" width={44} height={44} className="w-11 h-11 rounded-full ring-1 ring-black/[0.06]" />
                    ) : (
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                        <span className="text-sm font-ui font-bold text-white">
                          {(counterparty.display_name || counterparty.username)[0].toUpperCase()}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-ui font-semibold text-ink group-hover:text-accent transition-colors">
                        {counterparty.display_name || counterparty.username}
                      </p>
                      <p className="text-xs font-body text-muted">@{counterparty.username}</p>
                    </div>
                  </Link>
                </Card>
              )}

              {/* Shipping Address */}
              {order.shipping_address && (order.status !== "pending_payment" || !isBuyer) && (
                <Card>
                  <CardHeader title="Shipping Address" />
                  <div className="font-body text-sm text-ink/80 space-y-0.5">
                    <p className="font-semibold text-ink">{order.shipping_address.name}</p>
                    <p>{order.shipping_address.line1}</p>
                    {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                    <p>
                      {order.shipping_address.city}
                      {order.shipping_address.state ? `, ${order.shipping_address.state}` : ""}{" "}
                      {order.shipping_address.postal_code}
                    </p>
                    <p>{order.shipping_address.country}</p>
                  </div>
                </Card>
              )}

              {/* Order Info */}
              <Card>
                <CardHeader title="Details" />
                <div className="space-y-2.5 text-sm">
                  <DetailRow label="Order ID" value={order.order_number} />
                  <DetailRow label="Date" value={formatDate(order.created_at)} />
                  <DetailRow label="Payment" value={order.payment_status === "paid" ? "Paid" : order.payment_status === "refunded" ? "Refunded" : "Pending"} />
                  {order.payment_provider && order.payment_provider !== "placeholder" && (
                    <DetailRow label="Provider" value={order.payment_provider.charAt(0).toUpperCase() + order.payment_provider.slice(1)} />
                  )}
                  {isCommission && order.max_revisions != null && (
                    <DetailRow label="Revisions" value={`${order.revision_count} / ${order.max_revisions}`} />
                  )}
                  {order.completed_at && (
                    <DetailRow label="Completed" value={formatDate(order.completed_at)} />
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "activity" && (
          <div className="max-w-3xl space-y-5">
            <DisputeBanner orderId={order.id} orderStatus={order.status} />
            <Card>
              <CardHeader title="Messages" subtitle="Communication between buyer and seller" />
              <OrderMessages orderId={orderId} />
            </Card>
          </div>
        )}

        {activeTab === "reviews" && (
          <div className="max-w-3xl">
            <OrderReviewSection order={order} userId={user?.id} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Reusable Primitives ────────────────────────────────────────────

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border-light bg-surface p-5 sm:p-6 ${className}`}>
      {children}
    </section>
  );
}

function CardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-base text-ink">{title}</h2>
      {subtitle && <p className="text-xs font-body text-muted mt-0.5">{subtitle}</p>}
    </div>
  );
}

function SummaryRow({ label, value, className = "", muted = false }: { label: string; value: string; className?: string; muted?: boolean }) {
  return (
    <div className={`flex justify-between ${className}`}>
      <span className={muted ? "text-muted/70" : "text-muted"}>{label}</span>
      <span className={muted ? "text-muted/70" : "text-ink"}>{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="font-ui text-muted">{label}</span>
      <span className="font-body text-ink text-right">{value}</span>
    </div>
  );
}

// ─── Banners ────────────────────────────────────────────────────────

function BannerSection({ order, isBuyer }: { order: Order; isBuyer: boolean }) {
  if (order.status === "pending_payment" && isBuyer) {
    return (
      <div className="rounded-2xl bg-gradient-to-r from-purple-primary/[0.06] to-pink-vivid/[0.06] border border-purple-primary/15 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg text-ink mb-1">Complete Your Payment</h2>
          <p className="text-sm font-body text-muted">
            Secure checkout powered by Stripe.
            {order.listing_type === "service" && " Funds are held until you approve delivery."}
          </p>
        </div>
        <Link href={`/checkout/${order.id}`} className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold text-sm hover:opacity-90 transition-opacity shadow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
          Pay {formatCurrency(order.amount)}
        </Link>
      </div>
    );
  }

  if (order.status === "pending_payment" && !isBuyer) {
    return (
      <div className="rounded-2xl border border-purple-primary/15 bg-purple-50/30 p-5 text-center">
        <p className="text-sm font-body text-muted">
          <span className="font-semibold text-ink">Awaiting payment</span> — the buyer hasn&apos;t completed checkout yet.
        </p>
      </div>
    );
  }

  if (order.status === "pending_acceptance" && isBuyer) {
    return (
      <div className="rounded-2xl border border-amber-200/60 bg-amber-50/40 p-5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <div>
          <p className="text-sm font-ui font-semibold text-amber-700">Awaiting Seller Approval</p>
          <p className="text-xs font-body text-amber-600/70 mt-0.5">
            You&apos;ll be notified once the seller responds.
            {order.seller_response_deadline && (
              <> Expected by {formatDate(order.seller_response_deadline, true)}.</>
            )}
          </p>
        </div>
      </div>
    );
  }

  return null;
}

// ─── Draft Editor ───────────────────────────────────────────────────

function DraftEditor({
  isPhysical, isCommission,
  shippingDraft, setShippingDraft,
  briefDraft, setBriefDraft,
  dueDateDraft, setDueDateDraft,
  notesDraft, setNotesDraft,
  draftValidationError, updateDraftError, draftNotice,
  updatingDraft, onSave,
}: {
  isPhysical: boolean; isCommission: boolean;
  shippingDraft: { name: string; line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
  setShippingDraft: React.Dispatch<React.SetStateAction<typeof shippingDraft>>;
  briefDraft: string; setBriefDraft: (v: string) => void;
  dueDateDraft: string; setDueDateDraft: (v: string) => void;
  notesDraft: string; setNotesDraft: (v: string) => void;
  draftValidationError: string | null; updateDraftError: string | null; draftNotice: string | null;
  updatingDraft: boolean; onSave: () => void;
}) {
  const inputClass = "w-full px-3.5 py-2.5 rounded-xl border border-border-light text-sm font-body focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-200 transition-shadow";

  return (
    <div className="space-y-4">
      {isPhysical && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <input placeholder="Full name" value={shippingDraft.name} onChange={(e) => setShippingDraft(p => ({ ...p, name: e.target.value }))} className={inputClass} />
          <input placeholder="Address line 1" value={shippingDraft.line1} onChange={(e) => setShippingDraft(p => ({ ...p, line1: e.target.value }))} className={inputClass} />
          <input placeholder="Address line 2 (optional)" value={shippingDraft.line2} onChange={(e) => setShippingDraft(p => ({ ...p, line2: e.target.value }))} className={inputClass} />
          <input placeholder="City" value={shippingDraft.city} onChange={(e) => setShippingDraft(p => ({ ...p, city: e.target.value }))} className={inputClass} />
          <input placeholder="State / Region" value={shippingDraft.state} onChange={(e) => setShippingDraft(p => ({ ...p, state: e.target.value }))} className={inputClass} />
          <input placeholder="Postal code" value={shippingDraft.postal_code} onChange={(e) => setShippingDraft(p => ({ ...p, postal_code: e.target.value }))} className={inputClass} />
          <input placeholder="Country" value={shippingDraft.country} onChange={(e) => setShippingDraft(p => ({ ...p, country: e.target.value }))} className={`${inputClass} sm:col-span-2`} />
        </div>
      )}
      {isCommission && (
        <div className="space-y-3">
          <textarea rows={5} value={briefDraft} onChange={(e) => setBriefDraft(e.target.value)}
            placeholder="Describe project goals, style, references, and deliverables."
            className={inputClass} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input type="date" value={dueDateDraft} onChange={(e) => setDueDateDraft(e.target.value)} className={inputClass} />
            <input value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} placeholder="Extra notes (optional)" className={inputClass} />
          </div>
        </div>
      )}

      {(draftValidationError || updateDraftError) && (
        <p className="text-sm font-body text-red-500">{draftValidationError || updateDraftError}</p>
      )}
      {draftNotice && <p className="text-sm font-body text-emerald-600">{draftNotice}</p>}

      <button onClick={onSave} disabled={updatingDraft}
        className="px-5 py-2.5 rounded-xl text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid disabled:opacity-60 hover:opacity-90 transition-opacity">
        {updatingDraft ? "Saving..." : "Save Details"}
      </button>
    </div>
  );
}

// ─── Review Section ─────────────────────────────────────────────────

const REVIEWABLE_STATUSES = new Set(["completed"]);

function OrderReviewSection({ order, userId }: { order: Order; userId?: string }) {
  const { reviews, myReview, loading, refetch } = useOrderReviews(
    REVIEWABLE_STATUSES.has(order.status) ? order.id : undefined,
    userId
  );
  const [showForm, setShowForm] = useState(false);

  if (!REVIEWABLE_STATUSES.has(order.status) || !userId) {
    return (
      <Card className="text-center py-10">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-subtle flex items-center justify-center">
          <svg className="w-6 h-6 text-muted/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <p className="text-sm font-body text-muted">Reviews are available once the order is completed.</p>
      </Card>
    );
  }

  if (loading) return null;

  const isBuyer = userId === order.buyer_id;
  const isSeller = userId === order.seller_id;
  const canLeaveReview = order.listing_type === "product" ? isBuyer : (isBuyer || isSeller);
  const hasReviewed = !!myReview;

  return (
    <Card>
      <CardHeader
        title="Reviews"
        subtitle={order.listing_type === "product"
          ? "Share your experience with this product"
          : "Both buyer and seller can review this order"}
      />

      {reviews.length > 0 && (
        <div className="mb-4 space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {canLeaveReview && !hasReviewed && !showForm && (
        <button onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl border-2 border-dashed border-purple-primary/25 text-purple-primary font-ui font-semibold text-sm hover:bg-purple-50/40 hover:border-accent/40 transition-all">
          Leave a Review
        </button>
      )}

      {canLeaveReview && !hasReviewed && showForm && (
        <ReviewForm orderId={order.id} onSubmitted={() => { setShowForm(false); refetch(); }} />
      )}

      {hasReviewed && canLeaveReview && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-200/40">
          <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="text-sm font-body text-emerald-700">Your review has been submitted.</p>
        </div>
      )}
    </Card>
  );
}

// ─── Dispute Banner ─────────────────────────────────────────────────

function DisputeBanner({ orderId, orderStatus }: { orderId: string; orderStatus: string }) {
  const { dispute, loading } = useOrderDispute(
    ["disputed", "resolved"].includes(orderStatus) ? orderId : undefined
  );

  if (loading || !dispute) return null;
  const isResolved = dispute.status === "resolved";

  return (
    <Card className={isResolved ? "border-emerald-200/60 bg-emerald-50/30" : "border-red-200/60 bg-red-50/30"}>
      <div className="flex items-center gap-2.5 mb-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isResolved ? "bg-emerald-100" : "bg-red-100"}`}>
          <svg className={`w-4 h-4 ${isResolved ? "text-emerald-600" : "text-red-500"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {isResolved ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            )}
          </svg>
        </div>
        <h2 className={`font-display text-base ${isResolved ? "text-emerald-700" : "text-red-700"}`}>
          {isResolved ? "Dispute Resolved" : "Dispute Open"}
        </h2>
      </div>
      <div className="space-y-2.5 ml-[42px]">
        <div>
          <p className={`text-[11px] font-ui uppercase tracking-wider ${isResolved ? "text-emerald-600/60" : "text-red-500/60"}`}>Reason</p>
          <p className={`text-sm font-body ${isResolved ? "text-emerald-800" : "text-red-800"}`}>
            {DISPUTE_REASON_LABELS[dispute.reason] || dispute.reason}
          </p>
        </div>
        <div>
          <p className={`text-[11px] font-ui uppercase tracking-wider ${isResolved ? "text-emerald-600/60" : "text-red-500/60"}`}>Description</p>
          <p className={`text-sm font-body ${isResolved ? "text-emerald-800" : "text-red-800"}`}>{dispute.description}</p>
        </div>
        {isResolved && dispute.resolution && (
          <div>
            <p className="text-[11px] font-ui uppercase tracking-wider text-emerald-600/60">Resolution</p>
            <p className="text-sm font-body text-emerald-800 font-semibold">
              {DISPUTE_RESOLUTION_LABELS[dispute.resolution] || dispute.resolution}
            </p>
            {dispute.resolution_notes && <p className="text-sm font-body text-emerald-700 mt-1">{dispute.resolution_notes}</p>}
            {dispute.refund_amount && <p className="text-sm font-body text-emerald-700 mt-1">Refund: {formatCurrency(dispute.refund_amount)}</p>}
          </div>
        )}
        <p className={`text-xs font-body ${isResolved ? "text-emerald-600/50" : "text-red-500/50"}`}>
          {isResolved && dispute.resolved_at
            ? `Resolved ${formatDate(dispute.resolved_at)}`
            : `Opened ${formatDate(dispute.created_at)}`}
        </p>
      </div>
    </Card>
  );
}

// ─── Confirm Delivery Card ──────────────────────────────────────────

function ConfirmDeliveryCard({ orderId, onConfirm }: { orderId: string; onConfirm: () => void }) {
  const { confirmDelivery, confirming } = useConfirmDelivery();
  const [confirmed, setConfirmed] = useState(false);

  const handleConfirm = async () => {
    const ok = await confirmDelivery(orderId);
    if (ok) { setConfirmed(true); onConfirm(); }
  };

  if (confirmed) {
    return (
      <Card className="border-emerald-200/60 bg-emerald-50/30 text-center">
        <div className="flex items-center justify-center gap-2">
          <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
          <p className="font-ui font-semibold text-emerald-700">Delivery confirmed!</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-emerald-200/60 bg-emerald-50/30">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
          </div>
          <div>
            <p className="font-ui font-semibold text-ink text-sm">Package Shipped</p>
            <p className="text-xs font-body text-muted">Received your order? Confirm to complete.</p>
          </div>
        </div>
        <button onClick={handleConfirm} disabled={confirming}
          className="shrink-0 px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-500 text-white rounded-xl font-ui font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60">
          {confirming ? "Confirming..." : "Confirm Delivery"}
        </button>
      </div>
    </Card>
  );
}
