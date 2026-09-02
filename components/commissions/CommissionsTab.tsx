"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useMemo,
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSellerCommissions } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import { useSellerProfile } from "@/lib/hooks/useSellerProfile";
import { useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import type { Product, ProductStatus } from "@/lib/types/store";
import QuillIcon from "@/components/reviews/QuillIcon";
import ActionMenu from "@/components/ui/ActionMenu";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { showToast } from "@/lib/utils/toast";
import CommissionReviewsPanel from "./CommissionReviewsPanel";
import AvailabilityPill from "./AvailabilityPill";

interface CommissionsTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

type StatusFilter = "all" | "active" | "inactive";
type PanelTab = "services" | "reviews_seller" | "reviews_buyer";

type SubTabConfig = {
  key: PanelTab;
  label: string;
};

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

export default function CommissionsTab({ userId, isOwnProfile, pageLoaded }: CommissionsTabProps) {
  const { commissions, loading, error, refetch } = useSellerCommissions(userId);
  const { stats: sellerStats } = useSellerStats(userId);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tablistId = useId();
  const { profile: sellerProfile } = useSellerProfile(userId);

  const panel = parsePanelTab(searchParams.get("commissionsView"), isOwnProfile);
  const filter = parseStatusFilter(searchParams.get("commissionsFilter"));

  const filtered = useMemo(() => {
    return commissions.filter((item) => {
      if (filter === "all") return true;
      if (filter === "active") return item.status === "active";
      return ["draft", "paused", "archived"].includes(item.status);
    });
  }, [commissions, filter]);

  const stats = useMemo(() => {
    const activeCount = commissions.filter((item) => item.status === "active").length;
    const inactiveCount = commissions.filter((item) => ["draft", "paused", "archived"].includes(item.status)).length;

    const configuredResponseTimes = commissions
      .map((item) => item.service_metadata?.response_time_hours)
      .filter((value): value is number => typeof value === "number" && value > 0);

    const avgConfiguredResponseHours = configuredResponseTimes.length
      ? configuredResponseTimes.reduce((sum, value) => sum + value, 0) / configuredResponseTimes.length
      : null;

    const serviceLabels = Array.from(
      new Set(
        commissions
          .map((item) => {
            const title = item.title?.trim();
            const subcategory = item.subcategory?.trim();
            const category = item.category?.trim();
            return title || subcategory || category || "";
          })
          .filter((label): label is string => Boolean(label))
      )
    );

    return {
      total: commissions.length,
      active: activeCount,
      inactive: inactiveCount,
      avgConfiguredResponseHours,
      serviceLabels,
    };
  }, [commissions]);

  const responseTimeHours =
    sellerStats && sellerStats.avg_response_time_hours > 0
      ? sellerStats.avg_response_time_hours
      : stats.avgConfiguredResponseHours;

  const hasServices = commissions.length > 0;

  const updateViewState = useCallback((next: { panel?: PanelTab; filter?: StatusFilter }) => {
    const params = new URLSearchParams(searchParams.toString());

    const nextPanel = next.panel ?? panel;
    const nextFilter = next.filter ?? filter;

    if (nextPanel === "services") {
      params.delete("commissionsView");
    } else {
      params.set("commissionsView", nextPanel);
    }

    if (nextFilter === "all") {
      params.delete("commissionsFilter");
    } else {
      params.set("commissionsFilter", nextFilter);
    }

    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [filter, panel, pathname, router, searchParams]);

  const tabConfig: SubTabConfig[] = useMemo(() => {
    const tabs: SubTabConfig[] = [
      { key: "services", label: "Services" },
      { key: "reviews_seller", label: "Reviews as Seller" },
    ];
    if (isOwnProfile) {
      tabs.push({ key: "reviews_buyer", label: "Reviews as Buyer" });
    }
    return tabs;
  }, [isOwnProfile]);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabConfig.findIndex((item) => item.key === panel);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight") {
      const next = tabConfig[(currentIndex + 1) % tabConfig.length];
      updateViewState({ panel: next.key });
      event.preventDefault();
    }

    if (event.key === "ArrowLeft") {
      const prev = tabConfig[(currentIndex - 1 + tabConfig.length) % tabConfig.length];
      updateViewState({ panel: prev.key });
      event.preventDefault();
    }

    if (event.key === "Home") {
      updateViewState({ panel: tabConfig[0].key });
      event.preventDefault();
    }

    if (event.key === "End") {
      updateViewState({ panel: tabConfig[tabConfig.length - 1].key });
      event.preventDefault();
    }
  };

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="space-y-3 mb-8">
          <div className="h-3 w-32 rounded bg-skeleton animate-pulse" />
          <div className="h-4 w-80 rounded bg-skeleton animate-pulse" />
          <div className="mt-5 h-[2.5px] rounded-full bg-skeleton animate-pulse" />
        </div>
        <div className="flex gap-0 border-b border-border-light mb-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="px-5 py-3">
              <div className="h-4 w-24 rounded bg-skeleton animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-3xl border border-red-200 bg-red-50/70 p-10 text-center">
          <p className="font-ui text-red-600">Failed to load commissions</p>
          <p className="text-sm font-body text-red-500/90 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      <section className="relative mb-8 rounded-2xl overflow-hidden">
        {/* Glass background with subtle brand gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/[0.04] via-surface to-pink-vivid/[0.04]" />
        <div className="absolute inset-0 border border-border-light rounded-2xl pointer-events-none" />
        {/* Soft decorative glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-pink-vivid/[0.06] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-purple-primary/[0.05] blur-3xl pointer-events-none" />

        <div className="relative p-5 sm:p-8">
          <div className="flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-ui uppercase tracking-[0.2em] text-pink-vivid/70">Commissions</p>
                {sellerProfile?.store_tagline ? (
                  <h2 className="font-display text-lg sm:text-xl text-ink mt-1.5 leading-snug truncate">{sellerProfile.store_tagline}</h2>
                ) : (
                  <h2 className="font-display text-lg sm:text-xl text-ink mt-1.5 leading-snug">Open for work</h2>
                )}
              </div>
              {/* Quill rating badge */}
              <div className="flex items-center gap-1.5 shrink-0">
                <QuillIcon className="h-5 w-5" gradient={Boolean(sellerStats?.total_reviews)} />
                <span className="font-display text-base sm:text-lg font-semibold text-ink leading-none">
                  {sellerStats?.total_reviews ? sellerStats.avg_quill_score.toFixed(1) : "--"}
                </span>
                <span className="text-muted text-[11px] font-body leading-none">
                  ({sellerStats?.total_reviews ?? 0})
                </span>
              </div>
            </div>

            {/* Stats — three vital signs of the studio (no box, just hairlines) */}
            <dl className="grid grid-cols-3 divide-x divide-border-light/70">
              <div className="pr-3 sm:pr-4 first:pl-0 flex flex-col gap-0.5 sm:gap-1">
                <dt className="font-ui text-[9px] sm:text-[10px] uppercase tracking-[0.16em] text-muted">Taking orders</dt>
                <dd className="font-display text-xl sm:text-2xl font-semibold text-ink leading-none">
                  {sellerProfile?.is_accepting_commissions ? "Yes" : "No"}
                </dd>
              </div>
              <div className="px-3 sm:px-4 flex flex-col gap-0.5 sm:gap-1">
                <dt className="font-ui text-[9px] sm:text-[10px] uppercase tracking-[0.16em] text-muted">Delivered projects</dt>
                <dd className="font-display text-xl sm:text-2xl font-semibold text-ink leading-none">
                  {sellerStats?.completed_orders ?? 0}
                </dd>
              </div>
              <div className="pl-3 sm:pl-4 flex flex-col gap-0.5 sm:gap-1">
                <dt className="font-ui text-[9px] sm:text-[10px] uppercase tracking-[0.16em] text-muted">Reply time</dt>
                <dd className="font-display text-xl sm:text-2xl font-semibold text-ink leading-none">
                  {formatResponseTime(responseTimeHours)}
                  {responseTimeHours ? (
                    <span className="ml-1 text-[9px] sm:text-[10px] font-ui font-medium uppercase tracking-wider text-muted">avg</span>
                  ) : null}
                </dd>
              </div>
            </dl>

            {/* Skills & Services */}
            {((sellerProfile?.skills?.length ?? 0) > 0 || (sellerProfile?.services?.length ?? 0) > 0) && (
              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-border-light">
                {(sellerProfile?.skills?.length ?? 0) > 0 && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-ui uppercase tracking-[0.15em] text-muted/80 mb-2">Skills</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sellerProfile!.skills.slice(0, 6).map((skill) => (
                        <span key={skill} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-ui font-medium text-purple-primary/80 bg-purple-primary/[0.06]">
                          {skill}
                        </span>
                      ))}
                      {sellerProfile!.skills.length > 6 && (
                        <span className="text-[11px] font-ui text-muted self-center">+{sellerProfile!.skills.length - 6}</span>
                      )}
                    </div>
                  </div>
                )}
                {(sellerProfile?.services?.length ?? 0) > 0 && (
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-ui uppercase tracking-[0.15em] text-muted/80 mb-2">Services</p>
                    <div className="flex flex-wrap gap-1.5">
                      {sellerProfile!.services.slice(0, 4).map((service) => (
                        <span key={service} className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-ui font-medium text-pink-vivid/80 bg-pink-vivid/[0.06]">
                          {service}
                        </span>
                      ))}
                      {sellerProfile!.services.length > 4 && (
                        <span className="text-[11px] font-ui text-muted self-center">+{sellerProfile!.services.length - 4}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mb-6">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          <div
            id={tablistId}
            role="tablist"
            aria-label="Commissions views"
            onKeyDown={handleTabKeyDown}
            className="flex items-center gap-1.5"
          >
            {tabConfig.map((item) => {
              const isActive = panel === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => updateViewState({ panel: item.key })}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap ${
                    isActive
                      ? "bg-pink-vivid/10 text-pink-vivid"
                      : "text-muted hover:text-ink hover:bg-subtle"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          {panel === "services" && (
            <div className="relative shrink-0 ml-auto">
              <ActionMenu
                widthClassName="w-44"
                buttonAriaLabel="Filter services"
                buttonClassName={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-ui font-medium transition-all duration-200 ${
                  filter !== "all"
                    ? "text-pink-vivid bg-pink-vivid/10"
                    : "text-muted hover:text-ink hover:bg-subtle"
                }`}
                trigger={
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeWidth={1.6} d="M2 4h12M4 8h8M6 12h4" />
                    </svg>
                    {filter !== "all" && <span className="capitalize">{filter}</span>}
                  </>
                }
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

      {panel === "services" && (
        <>
          {!hasServices && (
            <div className="rounded-3xl border border-border-light bg-subtle/40 px-6 py-14 md:py-16 text-center">
              <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-surface border border-border-light flex items-center justify-center">
                <svg className="w-5 h-5 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
                </svg>
              </div>

              <h3 className="font-display text-xl md:text-2xl text-ink mb-2">
                {isOwnProfile ? "No services posted yet" : "No services posted yet"}
              </h3>
              <p className="font-body text-muted text-[0.95rem] max-w-sm mx-auto mb-7 leading-relaxed">
                {isOwnProfile
                  ? "Shape your craft into a clear package — tiers, timelines, what's included — and clients will know exactly what they're hiring."
                  : "This creator hasn't opened up commissions yet. Slip back later to see what they offer."}
              </p>

              {isOwnProfile && (
                <Link
                  href="/sell/service"
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid hover:shadow-lg hover:shadow-pink-vivid/25 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add a service
                </Link>
              )}
            </div>
          )}

          {hasServices && filtered.length === 0 && (
            <div className="rounded-2xl border border-border-light bg-subtle/40 py-12 text-center">
              <p className="font-ui text-sm text-muted">Nothing in this filter just yet.</p>
            </div>
          )}

          {hasServices && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((commission, index) => (
                <CommissionCard key={commission.id} commission={commission} isOwnProfile={isOwnProfile} index={index} onRefetch={refetch} sellerAccepting={sellerProfile?.is_accepting_commissions ?? true} />
              ))}
            </div>
          )}
        </>
      )}

      {panel === "reviews_seller" && (
        <CommissionReviewsPanel userId={userId} role="seller" isOwnProfile={isOwnProfile} />
      )}

      {panel === "reviews_buyer" && isOwnProfile && (
        <CommissionReviewsPanel userId={userId} role="buyer" isOwnProfile={isOwnProfile} />
      )}
    </div>
  );
}

function formatResponseTime(hours: number | null): string {
  if (!hours || hours <= 0) return "--";
  if (hours < 1) return "<1h";
  if (hours < 24) {
    const roundedHours = Math.round(hours);
    return `${roundedHours}h`;
  }

  const days = Math.round(hours / 24);
  return `${days}d`;
}

function CommissionCard({
  commission,
  isOwnProfile,
  index,
  onRefetch,
  sellerAccepting = true,
}: {
  commission: Product;
  isOwnProfile: boolean;
  index: number;
  onRefetch: () => Promise<void>;
  sellerAccepting?: boolean;
}) {
  const router = useRouter();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const { deleteProduct, deleting } = useDeleteProduct();
  const { updateStatus, updating } = useUpdateProductStatus();

  const cover = commission.primary_image_url;
  const headline =
    typeof commission.service_metadata?.headline === "string"
      ? commission.service_metadata.headline
      : null;

  const minDelivery = (commission.pricing || [])
    .map((pkg) => pkg.delivery_days)
    .filter((value): value is number => typeof value === "number" && value > 0)
    .sort((a, b) => a - b)[0];

  const maxRevisions = (commission.pricing || [])
    .map((pkg) => pkg.revisions)
    .filter((value): value is number => typeof value === "number" && value >= 0)
    .sort((a, b) => b - a)[0];

  const packageCount = commission.pricing?.length || 0;
  const startingPrice = commission.min_price;

  const handleEdit = () => {
    router.push(`/sell/edit/${commission.id}`);
  };

  const handleShare = () => {
    const url = `${window.location.origin}/commissions/${commission.id}`;
    void navigator.clipboard.writeText(url);
  };

  const handleArchive = async () => {
    const newStatus: ProductStatus = commission.status === "archived" ? "active" : "archived";
    const success = await updateStatus(commission.id, newStatus);
    if (success) {
      await onRefetch();
    }
  };

  const handleActivate = async () => {
    const success = await updateStatus(commission.id, "active");
    if (success) {
      await onRefetch();
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      const result = await deleteProduct(commission.id);
      if (result?.outcome === "deleted") {
        showToast.success("Commission deleted");
        await onRefetch();
      } else if (result?.outcome === "archived") {
        showToast.info(
          "Commission archived",
          "This service has order history, so it was archived instead of permanently deleted."
        );
        await onRefetch();
      } else {
        showToast.error("Failed to delete commission", "Please try again");
      }
    } catch {
      showToast.error("Failed to delete commission", "Please try again");
    } finally {
      setShowDeleteModal(false);
    }
  };

  return (
    <div className="relative group">
      <Link
        href={`/commissions/${commission.id}`}
        className="block rounded-[24px] border border-purple-primary/12 overflow-hidden bg-surface shadow-sm hover:shadow-xl hover:shadow-pink-vivid/15 hover:-translate-y-1 transition-all duration-300"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-16 -right-14 w-40 h-40 rounded-full bg-pink-vivid/10 blur-2xl" />
        </div>

        <div className="aspect-[4/3] bg-gradient-to-br from-pink-50 to-violet-50 relative overflow-hidden">
          {cover ? (
            <Image
              src={cover}
              alt={commission.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 400px"
              className="object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-pink-vivid/40">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
              </svg>
            </div>
          )}

        </div>

        <div className="p-4">
          <p className="text-xs font-ui uppercase tracking-wider text-muted mb-1">{commission.category}</p>
          <h3 className="font-display text-lg leading-snug text-ink mb-2 line-clamp-2 group-hover:text-pink-vivid transition-colors">
            {commission.title}
          </h3>
          <p className="text-sm font-body text-muted line-clamp-2 min-h-[2.5rem]">
            {headline || "Outcome-focused service with clear package scope and transparent delivery."}
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            <AvailabilityPill listing={commission.commission_listing} sellerAccepting={sellerAccepting} />
            <MetaChip label={`${packageCount} package${packageCount === 1 ? "" : "s"}`} />
            <MetaChip label={minDelivery ? `${minDelivery} day delivery` : "Custom timeline"} />
            {maxRevisions !== undefined && <MetaChip label={`${maxRevisions} revision${maxRevisions === 1 ? "" : "s"}`} />}
          </div>

          <div className="mt-4 flex items-center justify-between">
            {startingPrice !== undefined ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-body text-muted">Starting at</span>
                <span className="font-display text-xl font-semibold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                  ${startingPrice.toLocaleString("en-US", { maximumFractionDigits: 2 })}
                </span>
              </div>
            ) : (
              <p className="text-sm font-body text-muted">Price on request</p>
            )}

            <span className="inline-flex items-center gap-1 text-xs font-ui font-semibold text-pink-vivid group-hover:text-accent transition-colors">
              View Service
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {isOwnProfile && (
        <div className="absolute top-3 right-3 z-10">
          <ActionMenu
            buttonClassName="w-8 h-8 rounded-full flex items-center justify-center bg-purple-primary/45 opacity-0 group-hover:opacity-100 hover:bg-pink-vivid/60 transition-all duration-200 text-white"
            buttonIconClassName="w-4 h-4"
            widthClassName="w-44"
            items={[
              {
                label: "Edit",
                onSelect: handleEdit,
                icon: (
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                ),
              },
              {
                label: "Copy Link",
                onSelect: handleShare,
                icon: (
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                    <path d="M16 6l-4-4-4 4" />
                    <path d="M12 2v13" />
                  </svg>
                ),
              },
              {
                label: "Activate",
                onSelect: () => void handleActivate(),
                tone: "success",
                hidden: commission.status === "active" || commission.status === "sold",
                disabled: updating,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
              },
              {
                label: commission.status === "archived" ? "Unarchive" : "Archive",
                onSelect: () => void handleArchive(),
                disabled: updating,
                icon: (
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                ),
              },
              {
                label: "Delete",
                onSelect: handleDeleteClick,
                tone: "danger",
                dividerBefore: true,
                disabled: deleting,
                icon: (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                ),
              },
            ]}
          />
        </div>
      )}

      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Close this commission for good?"
        description="The service will leave your studio and stop accepting new orders. If past clients are tied to it, we'll keep a quiet archive so their records hold."
        confirmText="Erase it"
        isDanger
        loading={deleting}
      />
    </div>
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-ui font-medium bg-rose-50 text-rose-700 border border-rose-100">
      {label}
    </span>
  );
}
