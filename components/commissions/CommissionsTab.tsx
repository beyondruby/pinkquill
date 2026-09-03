"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useId, useMemo, useState, type KeyboardEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommissionAvailability, useSellerCommissions } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import { useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import { getOrCreateConversation } from "@/lib/messaging/conversations";
import type { Product, ProductStatus } from "@/lib/types/store";
import { COMMISSION_CATEGORIES, getCommissionSubcategoryLabel } from "@/lib/commissions/categories";
import { formatCurrency } from "@/lib/utils/currency";
import { QuillMeter } from "@/components/reviews/ReviewCard";
import ActionMenu from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import Sheet from "@/components/ui/Sheet";
import { showToast } from "@/lib/utils/toast";
import CommissionReviewsPanel from "./CommissionReviewsPanel";
import AvailabilityPill, { describeAvailability } from "./AvailabilityPill";
import RequestSheet from "./RequestSheet";

/**
 * The studio's Commissions tab (Phase 3b). One header card that exists only
 * when the profile sells, with the numbers a buyer wants and two actions;
 * service cards below. Nothing here reads seller_profiles (owner-only):
 * the seller-level switch comes through get_commission_availability, the
 * rest from the listings and completed orders.
 */

interface CommissionsTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

type StatusFilter = "all" | "active" | "inactive";
type PanelTab = "services" | "reviews_seller" | "reviews_buyer";

function parsePanelTab(value: string | null, isOwnProfile: boolean): PanelTab {
  if (value === "reviews_seller") return "reviews_seller";
  if (value === "reviews_buyer" && isOwnProfile) return "reviews_buyer";
  return "services";
}

function parseStatusFilter(value: string | null): StatusFilter {
  if (value === "active") return "active";
  if (value === "inactive") return "inactive";
  return "all";
}

const PILL_TONE: Record<ReturnType<typeof describeAvailability>["tone"], string> = {
  open: "bg-emerald-50 text-emerald-700 border-emerald-200",
  limited: "bg-amber-50 text-amber-700 border-amber-200",
  waitlist: "bg-purple-50 text-purple-700 border-purple-200",
  closed: "bg-subtle text-muted border-border-strong",
};

export function categoryLabel(product: Pick<Product, "category" | "subcategory">): string {
  return [COMMISSION_CATEGORIES[product.category]?.name || product.category, product.subcategory ? getCommissionSubcategoryLabel(product.category, product.subcategory) : null]
    .filter(Boolean)
    .join(" · ");
}

function deliveryRange(listings: Product[]): [number, number] | null {
  const days = listings.flatMap((l) => (l.pricing ?? []).map((p) => p.delivery_days).filter((d): d is number => typeof d === "number" && d > 0));
  if (days.length === 0) return null;
  return [Math.min(...days), Math.max(...days)];
}

function formatDays(range: [number, number] | null): string | null {
  if (!range) return null;
  return range[0] === range[1] ? `${range[0]} day${range[0] === 1 ? "" : "s"}` : `${range[0]}–${range[1]} days`;
}

/** Roll the listings' availability up into one pill for the header card. */
function rollUpAvailability(listings: Product[], sellerAccepting: boolean): { label: string; tone: keyof typeof PILL_TONE } {
  if (!sellerAccepting) return { label: "Not taking orders", tone: "closed" };
  const states = listings.map((l) => describeAvailability(l.commission_listing, true));
  if (states.length === 0) return { label: "Open", tone: "open" };
  let slotsOpen = 0, slotsTotal = 0, hasSlots = false, anyOpen = false, anyWaitlist = false;
  for (const l of listings) {
    const cl = l.commission_listing;
    const st = describeAvailability(cl, true);
    if (st.tone === "waitlist") anyWaitlist = true;
    if (cl && cl.slots_total != null && (cl.availability === "open" || cl.availability === "scheduled")) {
      hasSlots = true;
      slotsTotal += cl.slots_total;
      slotsOpen += Math.max(cl.slots_total - (cl.slots_used ?? 0), 0);
    } else if (st.tone === "open" || st.tone === "limited") {
      anyOpen = true;
    }
  }
  if (hasSlots && slotsOpen > 0) return { label: `${slotsOpen} of ${slotsTotal} slot${slotsTotal === 1 ? "" : "s"} open`, tone: slotsOpen === 1 ? "limited" : "open" };
  if (anyOpen) return { label: "Open", tone: "open" };
  if (anyWaitlist) return { label: "Waitlist", tone: "waitlist" };
  if (hasSlots) return { label: "Slots full", tone: "closed" };
  const opens = listings.map((l) => l.commission_listing?.opens_at).filter((d): d is string => !!d && new Date(d).getTime() > Date.now()).sort()[0];
  if (opens) return { label: `Opens ${new Date(opens).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`, tone: "closed" };
  return { label: "Closed", tone: "closed" };
}

export default function CommissionsTab({ userId, isOwnProfile, pageLoaded }: CommissionsTabProps) {
  const { user } = useAuth();
  const { commissions, loading, error, refetch } = useSellerCommissions(userId);
  const { stats } = useSellerStats(userId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tablistId = useId();

  const active = useMemo(() => commissions.filter((c) => c.status === "active"), [commissions]);
  // The seller-level switch is only readable through the availability RPC; one call on the first active listing is enough.
  const { availability: probe } = useCommissionAvailability(active[0]?.id);
  const sellerAccepting = probe ? probe.seller_accepting : true;

  const panel = parsePanelTab(searchParams.get("commissionsView"), isOwnProfile);
  const filter = parseStatusFilter(searchParams.get("commissionsFilter"));

  const [chooserOpen, setChooserOpen] = useState(false);
  const [requesting, setRequesting] = useState<Product | null>(null);
  const [messaging, setMessaging] = useState(false);

  const filtered = useMemo(() => commissions.filter((item) => {
    if (!isOwnProfile) return item.status === "active";
    if (filter === "all") return true;
    if (filter === "active") return item.status === "active";
    return ["draft", "paused", "archived"].includes(item.status);
  }), [commissions, filter, isOwnProfile]);

  const updateViewState = useCallback((next: { panel?: PanelTab; filter?: StatusFilter }) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextPanel = next.panel ?? panel;
    const nextFilter = next.filter ?? filter;
    if (nextPanel === "services") params.delete("commissionsView"); else params.set("commissionsView", nextPanel);
    if (nextFilter === "all") params.delete("commissionsFilter"); else params.set("commissionsFilter", nextFilter);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filter, panel, pathname, router, searchParams]);

  const tabConfig: Array<{ key: PanelTab; label: string }> = useMemo(() => {
    const tabs: Array<{ key: PanelTab; label: string }> = [{ key: "services", label: "Services" }, { key: "reviews_seller", label: "Reviews" }];
    if (isOwnProfile) tabs.push({ key: "reviews_buyer", label: "Reviews as buyer" });
    return tabs;
  }, [isOwnProfile]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const i = tabConfig.findIndex((t) => t.key === panel);
    if (i === -1) return;
    const go = (n: number) => { updateViewState({ panel: tabConfig[n].key }); event.preventDefault(); };
    if (event.key === "ArrowRight") go((i + 1) % tabConfig.length);
    if (event.key === "ArrowLeft") go((i - 1 + tabConfig.length) % tabConfig.length);
    if (event.key === "Home") go(0);
    if (event.key === "End") go(tabConfig.length - 1);
  };

  const requireSignIn = () => {
    if (user) return true;
    router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    return false;
  };

  const openRequest = () => {
    if (!requireSignIn()) return;
    if (active.length === 1) setRequesting(active[0]);
    else setChooserOpen(true);
  };

  const startMessage = async () => {
    if (!requireSignIn() || messaging) return;
    setMessaging(true);
    try {
      const conversationId = await getOrCreateConversation(userId);
      router.push(`/messages?conversation=${conversationId}`);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      showToast.error("Couldn't open the conversation", "Please try again");
      setMessaging(false);
    }
  };

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="h-40 rounded-2xl bg-skeleton/60 animate-pulse mb-5" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">{[1, 2, 3].map((i) => <div key={i} className="h-64 rounded-2xl bg-skeleton/60 animate-pulse" />)}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-2xl border border-red-200 bg-red-50/60 p-8 text-center">
          <p className="font-ui text-red-700">Failed to load commissions</p>
          <p className="text-sm font-body text-red-600/90 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  const hasActive = active.length > 0;
  const pill = rollUpAvailability(active, sellerAccepting);
  const fromPrice = active.map((l) => l.min_price).filter((p): p is number => typeof p === "number").sort((a, b) => a - b)[0];
  const turnaround = formatDays(deliveryRange(active));
  const facts: Array<[string, React.ReactNode]> = [];
  if (fromPrice != null) facts.push(["From", formatCurrency(fromPrice)]);
  if (turnaround) facts.push(["Turnaround", turnaround]);
  if (stats && stats.total_reviews > 0) facts.push(["Rating", <span key="r" className="inline-flex items-center gap-1.5">{stats.avg_quill_score.toFixed(1)} <QuillMeter score={Math.max(1, Math.min(5, Math.round(stats.avg_quill_score)))} /><span className="text-muted text-xs font-body">({stats.total_reviews})</span></span>]);
  if (stats && stats.completed_orders > 0) facts.push(["Completed", String(stats.completed_orders)]);
  if (stats && stats.avg_response_time_hours > 0) facts.push(["Replies", stats.avg_response_time_hours < 1 ? "under 1h" : stats.avg_response_time_hours < 24 ? `~${Math.round(stats.avg_response_time_hours)}h` : `~${Math.round(stats.avg_response_time_hours / 24)}d`]);
  const canRequest = hasActive && sellerAccepting && !isOwnProfile;

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      {/* Header card: only when the profile sells */}
      {hasActive ? (
        <section className="rounded-2xl border border-border-light bg-surface p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">Commissions</p>
              <p className="font-display text-lg font-semibold text-ink mt-0.5">{active.length === 1 ? "1 service" : `${active.length} services`}{!sellerAccepting ? " · paused" : ""}</p>
            </div>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-2xs font-ui font-semibold ${PILL_TONE[pill.tone]}`}>{pill.label}</span>
          </div>
          {facts.length > 0 && (
            <dl className="mt-4 grid grid-cols-3 sm:grid-cols-5 gap-x-4 gap-y-3">
              {facts.map(([k, v]) => (
                <div key={k} className="min-w-0"><dt className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{k}</dt><dd className="text-sm font-ui font-semibold text-ink mt-0.5 tabular-nums truncate">{v}</dd></div>
              ))}
            </dl>
          )}
          {!sellerAccepting && !isOwnProfile && (
            <p className="text-sm font-body text-muted mt-4">This creator isn&apos;t taking new requests right now. You can still send a message.</p>
          )}
          <div className="mt-4 flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {isOwnProfile ? (
              <>
                <Button onClick={() => router.push("/sell/service")}>Add a service</Button>
                <Button variant="secondary" onClick={() => router.push("/seller/settings")}>Edit availability</Button>
              </>
            ) : (
              <>
                {canRequest && <Button onClick={openRequest}>Request a commission</Button>}
                <Button variant="secondary" onClick={startMessage} loading={messaging} loadingText="Opening…">Message</Button>
              </>
            )}
          </div>
        </section>
      ) : isOwnProfile ? (
        <section className="rounded-2xl border border-border-light bg-subtle/60 px-6 py-12 text-center">
          <p className="font-display text-lg font-semibold text-ink">No services yet</p>
          <p className="text-sm font-body text-muted mt-1 max-w-[36ch] mx-auto">Turn what you do into a package with tiers, timelines and what&apos;s included.</p>
          <div className="mt-5"><Button onClick={() => router.push("/sell/service")}>Add a service</Button></div>
        </section>
      ) : null}

      {/* Sub-tabs */}
      {(hasActive || isOwnProfile) && (
        <section className="mt-5 mb-4">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
            <div id={tablistId} role="tablist" aria-label="Commissions views" onKeyDown={handleTabKeyDown} className="flex items-center gap-1.5">
              {tabConfig.map((item) => {
                const isActive = panel === item.key;
                return (
                  <button key={item.key} type="button" role="tab" aria-selected={isActive} onClick={() => updateViewState({ panel: item.key })}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-colors whitespace-nowrap ${isActive ? "bg-pink-vivid/10 text-pink-vivid" : "text-muted hover:text-ink hover:bg-subtle"}`}>
                    {item.label}
                  </button>
                );
              })}
            </div>
            {panel === "services" && isOwnProfile && (
              <div className="relative shrink-0 ml-auto">
                <ActionMenu
                  widthClassName="w-44"
                  buttonAriaLabel="Filter services"
                  buttonClassName={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-ui font-medium transition-colors ${filter !== "all" ? "text-pink-vivid bg-pink-vivid/10" : "text-muted hover:text-ink hover:bg-subtle"}`}
                  trigger={<><span>Filter</span>{filter !== "all" && <span className="capitalize">· {filter}</span>}</>}
                  items={[
                    { label: "All", onSelect: () => updateViewState({ filter: "all" }), tone: filter === "all" ? "accent" : "default" },
                    { label: "Active", onSelect: () => updateViewState({ filter: "active" }), tone: filter === "active" ? "accent" : "default" },
                    { label: "Inactive", onSelect: () => updateViewState({ filter: "inactive" }), tone: filter === "inactive" ? "accent" : "default" },
                  ]}
                />
              </div>
            )}
          </div>
        </section>
      )}

      {panel === "services" && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((commission) => (
            <CommissionCard key={commission.id} commission={commission} isOwnProfile={isOwnProfile} onRefetch={refetch} sellerAccepting={sellerAccepting} />
          ))}
        </div>
      )}
      {panel === "services" && isOwnProfile && commissions.length > 0 && filtered.length === 0 && (
        <div className="rounded-2xl border border-border-light bg-subtle/40 py-10 text-center"><p className="font-ui text-sm text-muted">Nothing in this filter.</p></div>
      )}

      {panel === "reviews_seller" && <CommissionReviewsPanel userId={userId} role="seller" isOwnProfile={isOwnProfile} />}
      {panel === "reviews_buyer" && isOwnProfile && <CommissionReviewsPanel userId={userId} role="buyer" isOwnProfile={isOwnProfile} />}

      {/* Several listings: pick one first */}
      <Sheet isOpen={chooserOpen} onClose={() => setChooserOpen(false)} title="Which service?" subtitle="Pick one to start a request.">
        <div className="space-y-2">
          {active.map((c) => (
            <button key={c.id} type="button" onClick={() => { setChooserOpen(false); setRequesting(c); }} className="w-full flex items-center gap-3 rounded-2xl border border-border-light p-3 text-left hover:border-border-strong transition-colors">
              <div className="relative w-14 h-14 rounded-xl overflow-hidden bg-gradient-to-br from-purple-50 to-pink-50 shrink-0">
                {c.primary_image_url && <Image src={c.primary_image_url} alt="" fill className="object-cover" sizes="56px" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-ui font-semibold text-ink truncate">{c.title}</p>
                <p className="text-2xs font-body text-muted">{categoryLabel(c)}{c.min_price != null ? ` · from ${formatCurrency(c.min_price)}` : ""}</p>
              </div>
              <AvailabilityPill listing={c.commission_listing} sellerAccepting={sellerAccepting} />
            </button>
          ))}
        </div>
      </Sheet>

      {requesting && (
        <RequestSheet product={requesting} isOpen onClose={() => setRequesting(null)} />
      )}
    </div>
  );
}

function CommissionCard({ commission, isOwnProfile, onRefetch, sellerAccepting }: { commission: Product; isOwnProfile: boolean; onRefetch: () => Promise<void>; sellerAccepting: boolean }) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const { deleteProduct, deleting } = useDeleteProduct();
  const { updateStatus, updating } = useUpdateProductStatus();

  const cover = commission.primary_image_url;
  const headline = typeof commission.service_metadata?.headline === "string" && commission.service_metadata.headline.trim() ? commission.service_metadata.headline : null;
  const days = formatDays(deliveryRange([commission]));
  const inactive = commission.status !== "active";

  const setStatus = async (status: ProductStatus) => {
    const ok = await updateStatus(commission.id, status);
    if (ok) await onRefetch();
  };

  const handleDeleteConfirm = async () => {
    try {
      const result = await deleteProduct(commission.id);
      if (result?.outcome === "deleted") { showToast.success("Commission deleted"); await onRefetch(); }
      else if (result?.outcome === "archived") { showToast.info("Commission archived", "This service has order history, so it was archived instead of deleted."); await onRefetch(); }
      else showToast.error("Failed to delete commission", "Please try again");
    } catch {
      showToast.error("Failed to delete commission", "Please try again");
    } finally {
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="relative">
      <Link href={`/commissions/${commission.id}`} className={`block rounded-2xl border border-border-light bg-surface overflow-hidden hover:border-border-strong transition-colors ${inactive ? "opacity-70" : ""}`}>
        <div className="relative aspect-[4/3] bg-gradient-to-br from-purple-50 to-pink-50">
          {cover && <Image src={cover} alt={commission.title} fill sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px" className="object-cover" />}
          <span className="absolute left-3 top-3">
            {inactive
              ? <span className="inline-flex items-center px-2.5 py-1 rounded-full border text-[0.65rem] font-ui font-semibold uppercase tracking-wide bg-subtle text-muted border-border-light">{commission.status}</span>
              : <AvailabilityPill listing={commission.commission_listing} sellerAccepting={sellerAccepting} />}
          </span>
        </div>
        <div className="p-4">
          <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted truncate">{categoryLabel(commission)}</p>
          <h3 className="font-display text-base font-semibold text-ink leading-snug mt-1 line-clamp-2">{commission.title}</h3>
          {headline && <p className="text-sm font-body text-muted mt-1 line-clamp-2">{headline}</p>}
          <div className="mt-3 flex items-baseline justify-between gap-3">
            {commission.min_price != null
              ? <span className="text-sm font-body text-muted">From <span className="font-display text-lg font-semibold text-ink tabular-nums">{formatCurrency(commission.min_price)}</span></span>
              : <span className="text-sm font-body text-muted">Price on request</span>}
            {days && <span className="text-xs font-ui text-muted">{days}</span>}
          </div>
        </div>
      </Link>

      {isOwnProfile && (
        <div className="absolute top-3 right-3 z-10">
          <ActionMenu
            buttonClassName="w-8 h-8 rounded-full flex items-center justify-center bg-surface/90 text-ink shadow-sm hover:bg-surface transition-colors"
            buttonIconClassName="w-4 h-4"
            widthClassName="w-44"
            items={[
              { label: "Edit", onSelect: () => router.push(`/sell/edit/${commission.id}`) },
              { label: "Copy link", onSelect: () => { void navigator.clipboard.writeText(`${window.location.origin}/commissions/${commission.id}`); showToast.success("Link copied"); } },
              { label: "Activate", onSelect: () => void setStatus("active"), tone: "success", hidden: commission.status === "active" || commission.status === "sold", disabled: updating },
              { label: commission.status === "archived" ? "Unarchive" : "Archive", onSelect: () => void setStatus(commission.status === "archived" ? "active" : "archived"), disabled: updating },
              { label: "Delete", onSelect: () => setShowDeleteModal(true), tone: "danger", dividerBefore: true, disabled: deleting },
            ]}
          />
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete this service?"
        description="It leaves your studio and stops taking requests. If past orders are tied to it, it is archived instead."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />
    </div>
  );
}
