"use client";

import Link from "next/link";
import Image from "next/image";
import {
  useMemo,
  useRef,
  useEffect,
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
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const filterMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showFilterMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterMenuRef.current && !filterMenuRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showFilterMenu]);

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
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/[0.04] via-white to-pink-vivid/[0.04]" />
        <div className="absolute inset-0 border border-border-light rounded-2xl pointer-events-none" />
        {/* Soft decorative glow */}
        <div className="absolute -top-20 -right-20 w-48 h-48 rounded-full bg-pink-vivid/[0.06] blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-purple-primary/[0.05] blur-3xl pointer-events-none" />

        <div className="relative p-6 sm:p-8">
          <div className="flex flex-col gap-5">
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[11px] font-ui uppercase tracking-[0.2em] text-pink-vivid/70">Commissions</p>
                {sellerProfile?.store_tagline ? (
                  <h2 className="font-display text-xl text-ink mt-1.5 leading-snug">{sellerProfile.store_tagline}</h2>
                ) : (
                  <h2 className="font-display text-xl text-ink mt-1.5 leading-snug">Open for work</h2>
                )}
              </div>
              {/* Quill rating badge */}
              <div className="flex items-center gap-2 shrink-0 px-3 py-2 rounded-xl bg-surface/70 backdrop-blur-sm border border-border-light">
                <QuillIcon className="h-5 w-5" gradient={Boolean(sellerStats?.total_reviews)} />
                <span className="font-display text-lg font-semibold text-ink leading-none">
                  {sellerStats?.total_reviews ? sellerStats.avg_quill_score.toFixed(1) : "--"}
                </span>
                <span className="text-muted text-[11px] font-body leading-none">
                  ({sellerStats?.total_reviews ?? 0})
                </span>
              </div>
            </div>

            {/* Stats row as subtle chips */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-ui font-medium text-muted bg-surface/60 border border-border-light">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                {stats.active} active
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-ui font-medium text-muted bg-surface/60 border border-border-light">
                {sellerStats?.completed_orders ?? 0} completed
              </span>
              <span className="inline-flex items-center px-3 py-1 rounded-full text-[12px] font-ui font-medium text-muted bg-surface/60 border border-border-light">
                {formatResponseTime(responseTimeHours)} avg response
              </span>
            </div>

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
            <div className="relative shrink-0 ml-auto" ref={filterMenuRef}>
              <button
                type="button"
                onClick={() => setShowFilterMenu(!showFilterMenu)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-ui font-medium transition-all duration-200 ${
                  filter !== "all"
                    ? "text-pink-vivid bg-pink-vivid/10"
                    : "text-muted hover:text-ink hover:bg-subtle"
                }`}
                title="Filter services"
              >
                <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeWidth={1.6} d="M2 4h12M4 8h8M6 12h4" />
                </svg>
                {filter !== "all" && <span className="capitalize">{filter}</span>}
              </button>
              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1 w-40 rounded-xl bg-surface border border-border-light shadow-lg shadow-black/[0.06] z-20 py-1 animate-fadeIn">
                  {([
                    { value: "all" as StatusFilter, label: "All services" },
                    { value: "active" as StatusFilter, label: "Active" },
                    { value: "inactive" as StatusFilter, label: "Inactive" },
                  ]).map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        updateViewState({ filter: option.value });
                        setShowFilterMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm font-ui transition-colors ${
                        filter === option.value ? "text-pink-vivid bg-pink-vivid/[0.06]" : "text-ink hover:bg-skeleton/60"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {panel === "services" && (
        <>
          {!hasServices && (
            <div className="relative rounded-[32px] border border-pink-vivid/20 bg-gradient-to-br from-pink-50/90 via-white to-violet-50/85 p-10 text-center overflow-hidden">
              <div className="absolute -top-16 -left-14 w-40 h-40 rounded-full bg-purple-primary/12 blur-2xl" />
              <div className="absolute -bottom-16 -right-14 w-44 h-44 rounded-full bg-pink-vivid/16 blur-2xl" />

              <div className="relative">
                <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
                  <svg className="w-8 h-8 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
                  </svg>
                </div>

                <h3 className="font-display text-2xl text-ink mb-3">
                  {isOwnProfile ? "Launch your first commission" : "No commissions yet"}
                </h3>
                <p className="font-body text-muted max-w-md mx-auto">
                  {isOwnProfile
                    ? "Package your expertise into clear service tiers and turn your studio into a high-conversion storefront."
                    : "This creator has not published commission services yet."}
                </p>

                {isOwnProfile && (
                  <Link
                    href="/sell/service"
                    className="inline-flex mt-7 items-center gap-2 px-6 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary to-pink-vivid hover:shadow-lg hover:shadow-pink-vivid/20 transition-all"
                  >
                    Add Service
                  </Link>
                )}
              </div>
            </div>
          )}

          {hasServices && filtered.length === 0 && (
            <div className="rounded-2xl border border-purple-primary/15 bg-surface p-8 text-center">
              <p className="font-ui text-purple-primary">No services in this filter yet.</p>
            </div>
          )}

          {hasServices && filtered.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
              {filtered.map((commission, index) => (
                <CommissionCard key={commission.id} commission={commission} isOwnProfile={isOwnProfile} index={index} onRefetch={refetch} />
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
}: {
  commission: Product;
  isOwnProfile: boolean;
  index: number;
  onRefetch: () => Promise<void>;
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
        title="Delete Commission?"
        description="This action cannot be undone. This will permanently delete your commission listing and remove its associated data. If the service has order history, it will be archived instead."
        confirmText="Delete"
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
