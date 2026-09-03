"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useOrder, useOrderEvents } from "@/lib/hooks/useOrders";
import { useOrderReviews } from "@/lib/hooks/useReviews";
import { useOrderActions } from "@/lib/hooks/useDisputes";
import { useOrderQueuePosition } from "@/lib/hooks/useCommissions";
import { useOrderWorkroom } from "@/lib/hooks/useOrderWorkroom";
import { getOrderKind, getOrderStatusMeta, TONE_CLASSES } from "@/lib/utils/orderStatus";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import { ChevronRightIcon } from "@/components/ui/Icons";
import OrderProgress from "./OrderProgress";
import OrderActionBar from "./OrderActionBar";
import OrderOverview from "./OrderOverview";
import OrderDeliveries from "./OrderDeliveries";
import OrderMessages from "./OrderMessages";
import OrderActivity from "./OrderActivity";
import { counterparty, personName } from "./orderFormat";

type OrderTab = "overview" | "deliveries" | "messages" | "activity";
const TABS: OrderTab[] = ["overview", "deliveries", "messages", "activity"];

/**
 * /orders/[id] — the one order page (Phase 3a). Same page for buyer and
 * seller; every button comes from get_order_actions(); every status word
 * comes from lib/utils/orderStatus.
 */
export default function OrderPage({ orderId }: { orderId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { order, loading, error, refetch } = useOrder(orderId);
  const isCommission = order?.listing_type === "service";
  const { actions, refetch: refetchActions } = useOrderActions(order?.id, `${order?.status}:${order?.updated_at}`);
  const { workroom, loading: workroomLoading, refetch: refetchWorkroom } = useOrderWorkroom(order?.id, isCommission);
  const { events, loading: eventsLoading, refetch: refetchEvents } = useOrderEvents(order?.id);
  const queue = useOrderQueuePosition(order?.id, isCommission && ["pending_acceptance", "pending_payment", "paid"].includes(order?.status ?? ""));
  const reviews = useOrderReviews(order?.status === "completed" ? order.id : undefined, user?.id);
  const [reviewOpen, setReviewOpen] = useState(false);
  const paymentSynced = useRef(false);
  // Countdown facts ("auto-approves in 2d 23h") re-render once a minute.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const paymentParam = searchParams.get("payment");
  const tabParam = searchParams.get("tab");

  // A buyer landing here with payment=start goes straight to checkout.
  useEffect(() => {
    if (paymentParam === "start" && order?.status === "pending_payment" && user?.id === order.buyer_id) router.replace(`/checkout/${orderId}`);
  }, [paymentParam, order?.status, order?.buyer_id, user?.id, orderId, router]);

  // Back from checkout: re-read once so the webhook's result shows.
  useEffect(() => {
    if (paymentParam === "success" && order?.id && !paymentSynced.current) { paymentSynced.current = true; void refetch(); }
    if (paymentParam !== "success") paymentSynced.current = false;
  }, [paymentParam, order?.id, refetch]);

  const refreshAll = useCallback(() => {
    void refetch();
    void refetchActions();
    void refetchWorkroom();
    void refetchEvents();
  }, [refetch, refetchActions, refetchWorkroom, refetchEvents]);

  const setTab = (tab: OrderTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  if (loading && !order) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="h-4 w-32 bg-skeleton/70 rounded animate-pulse mb-6" />
          <div className="flex gap-5 mb-6"><div className="w-24 h-24 rounded-2xl bg-skeleton/70 animate-pulse" /><div className="flex-1 space-y-3"><div className="h-6 w-2/3 bg-skeleton/70 rounded animate-pulse" /><div className="h-4 w-1/2 bg-skeleton/70 rounded animate-pulse" /></div></div>
          <div className="h-44 bg-skeleton/70 rounded-2xl animate-pulse mb-6" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5"><div className="lg:col-span-2 h-64 bg-skeleton/70 rounded-2xl animate-pulse" /><div className="h-64 bg-skeleton/70 rounded-2xl animate-pulse" /></div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-sm text-center">
          <h1 className="font-display text-2xl text-ink mb-2">Order not found</h1>
          <p className="font-body text-sm text-muted mb-6">This order doesn&apos;t exist or you don&apos;t have permission to view it.</p>
          <Button onClick={() => router.push("/orders")}>Back to orders</Button>
        </div>
      </div>
    );
  }

  const isBuyer = user?.id === order.buyer_id;
  const other = counterparty(order, isBuyer);
  const kind = getOrderKind(order);
  const meta = getOrderStatusMeta(order.status);
  const image = order.product?.primary_image_url || order.product?.media?.[0]?.media_url;
  const activeTab: OrderTab = TABS.includes(tabParam as OrderTab) ? (tabParam as OrderTab) : "overview";
  const openRevision = workroom?.revisions.find((r) => r.status === "open") ?? null;
  const deliveryCount = workroom?.deliveries.length ?? 0;
  const crumbs = isBuyer ? [["Orders", "/orders"]] : [["Seller studio", "/seller/dashboard"], ["Orders", "/seller/orders"]];
  const packageMeta = kind === "commission"
    ? [order.pricing?.variant_name ? `${order.pricing.variant_name} package` : "Commission", order.pricing?.delivery_days ? `${order.pricing.delivery_days}-day delivery` : null, order.max_revisions != null ? `${order.max_revisions} revision${order.max_revisions === 1 ? "" : "s"}` : null]
    : [kind === "physical" ? "Physical product" : "Digital product", order.quantity > 1 ? `× ${order.quantity}` : null];

  const tabLabel: Record<OrderTab, string> = { overview: "Overview", deliveries: "Deliveries", messages: "Messages", activity: "Activity" };
  const visibleTabs = TABS.filter((t) => t !== "deliveries" || kind === "commission");

  return (
    <div className="min-h-screen bg-background pb-36 md:pb-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-4 sm:pt-6">
        {/* Breadcrumbs by role */}
        <nav className="flex items-center gap-1.5 text-xs font-ui text-muted" aria-label="Breadcrumb">
          {crumbs.map(([label, href]) => (
            <span key={href} className="flex items-center gap-1.5">
              <Link href={href} className="hover:text-accent transition-colors">{label}</Link>
              <ChevronRightIcon className="w-3 h-3" />
            </span>
          ))}
          <span className="text-ink font-medium tabular-nums">{order.order_number}</span>
        </nav>

        {/* Header: photo first */}
        <header className="mt-4 sm:mt-5">
          <div className="sm:hidden relative rounded-2xl overflow-hidden aspect-[16/9] bg-gradient-to-br from-purple-50 to-pink-50">
            {image && <Image src={image} alt="" fill className="object-cover" sizes="100vw" />}
            <span className={`absolute left-3 top-3 px-2.5 py-1 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[meta.tone].chip}`}>{meta.label}</span>
          </div>
          <div className="flex items-start gap-5 mt-3 sm:mt-0">
            <div className="hidden sm:block relative w-24 h-24 rounded-2xl overflow-hidden shrink-0 bg-gradient-to-br from-purple-50 to-pink-50">
              {image && <Image src={image} alt="" fill className="object-cover" sizes="96px" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="font-display text-lg sm:text-2xl font-semibold text-ink leading-snug sm:truncate">{order.product?.title || "Order"}</h1>
                  <p className="text-xs sm:text-sm font-body text-muted mt-1">{packageMeta.filter(Boolean).join(" · ")}</p>
                </div>
                <span className={`hidden sm:inline-flex shrink-0 px-2.5 py-1 rounded-full border text-2xs font-ui font-semibold ${TONE_CLASSES[meta.tone].chip}`}>{meta.label}</span>
              </div>
              {other && (
                <div className="flex items-center justify-between gap-3 mt-3 sm:mt-4">
                  <Link href={`/studio/${other.username}`} className="flex items-center gap-2.5 min-w-0 group">
                    <Avatar src={other.avatar_url} alt="" size={32} />
                    <span className="min-w-0">
                      <span className="block text-sm font-ui font-semibold text-ink truncate group-hover:text-accent transition-colors">{personName(other)}</span>
                      <span className="block text-2xs font-body text-muted">@{other.username} · {isBuyer ? "creator" : "buyer"}</span>
                    </span>
                  </Link>
                  <Button variant="secondary" size="sm" onClick={() => setTab("messages")}>Message</Button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Progress + the single action bar */}
        <section className="mt-5 rounded-2xl border border-border-light bg-surface p-4 sm:p-5">
          <OrderProgress order={order} actions={actions} isBuyer={isBuyer} openRevision={openRevision} />
          <OrderActionBar
            order={order}
            actions={actions}
            isBuyer={isBuyer}
            workroom={workroom}
            hasReviewed={!!reviews.myReview}
            onChanged={refreshAll}
            onLeaveReview={() => { setTab("overview"); setReviewOpen(true); setTimeout(() => document.getElementById("reviews")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
            onDownloadFiles={() => { setTab("overview"); setTimeout(() => document.getElementById("files")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }}
          />
        </section>

        {/* Tabs */}
        <div className="mt-6 border-b border-border-light">
          <nav className="flex gap-5 sm:gap-6" role="tablist">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setTab(tab)}
                className={`relative py-3 text-sm font-ui transition-colors ${activeTab === tab ? "text-purple-primary font-semibold" : "text-muted hover:text-ink"}`}
              >
                {tabLabel[tab]}
                {tab === "deliveries" && deliveryCount > 0 && <span className="ml-1.5 px-1.5 rounded-full bg-subtle text-muted text-3xs tabular-nums">{deliveryCount}</span>}
                {activeTab === tab && <span className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />}
              </button>
            ))}
          </nav>
        </div>

        <div className="py-5">
          {activeTab === "overview" && (
            <OrderOverview
              order={order}
              actions={actions}
              isBuyer={isBuyer}
              userId={user?.id}
              workroom={workroom}
              refetchWorkroom={refetchWorkroom}
              queue={queue}
              reviews={reviews}
              reviewOpen={reviewOpen}
              setReviewOpen={setReviewOpen}
            />
          )}
          {activeTab === "deliveries" && <OrderDeliveries order={order} workroom={workroom} isBuyer={isBuyer} loading={workroomLoading} />}
          {activeTab === "messages" && <OrderMessages orderId={order.id} />}
          {activeTab === "activity" && <OrderActivity order={order} events={events} loading={eventsLoading} isBuyer={isBuyer} />}
        </div>
      </div>
    </div>
  );
}
