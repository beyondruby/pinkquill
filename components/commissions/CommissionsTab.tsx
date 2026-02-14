"use client";

import Link from "next/link";
import {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useId,
  useState,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useSellerCommissions } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import { useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import type { Product, ProductStatus } from "@/lib/types/store";
import QuillIcon from "@/components/reviews/QuillIcon";
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
  helper: string;
  icon: "services" | "seller_reviews" | "buyer_reviews";
  count: string;
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
      {
        key: "services",
        label: "Services",
        helper: "Browse active offerings",
        icon: "services",
        count: String(stats.total),
      },
      {
        key: "reviews_seller",
        label: "Reviews as Seller",
        helper: "How clients rate delivery",
        icon: "seller_reviews",
        count: String(sellerStats?.total_reviews ?? 0),
      },
    ];

    if (isOwnProfile) {
      tabs.push({
        key: "reviews_buyer",
        label: "Reviews as Buyer",
        helper: "Feedback from collaborators",
        icon: "buyer_reviews",
        count: "--",
      });
    }

    return tabs;
  }, [isOwnProfile, sellerStats?.total_reviews, stats.total]);

  const activeTabMeta = tabConfig.find((item) => item.key === panel) ?? tabConfig[0];

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
          <div className="h-3 w-32 rounded bg-black/[0.05] animate-pulse" />
          <div className="h-4 w-80 rounded bg-black/[0.05] animate-pulse" />
          <div className="mt-5 h-[2.5px] rounded-full bg-black/[0.05] animate-pulse" />
        </div>
        <div className="flex gap-0 border-b border-black/[0.05] mb-6">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="px-5 py-3">
              <div className="h-4 w-24 rounded bg-black/[0.05] animate-pulse" />
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
      <section className="relative mb-8 rounded-2xl border border-black/[0.06] bg-[#fafafa] p-6 sm:p-8">
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-ui uppercase tracking-[0.2em] text-muted">Commissions Studio</p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <span className="inline-flex items-center gap-1.5 font-ui">
              <QuillIcon className="h-4 w-4" gradient={Boolean(sellerStats?.total_reviews)} />
              <span className="font-semibold text-ink">{sellerStats?.total_reviews ? sellerStats.avg_quill_score.toFixed(1) : "--"}</span>
              <span className="text-muted text-xs">({sellerStats?.total_reviews ?? 0} reviews)</span>
            </span>
            <span className="text-muted/30">|</span>
            <span className="text-muted">{stats.active} active service{stats.active !== 1 ? "s" : ""}</span>
            <span className="text-muted/30">|</span>
            <span className="text-muted">{sellerStats?.completed_orders ?? 0} completed</span>
            <span className="text-muted/30">|</span>
            <span className="text-muted">{formatResponseTime(responseTimeHours)} avg response</span>
          </div>
          {stats.serviceLabels.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-1">
              {stats.serviceLabels.slice(0, 4).map((label) => (
                <span key={label} className="inline-flex px-2.5 py-0.5 rounded-full text-[11px] font-ui text-muted bg-black/[0.04]">
                  {label}
                </span>
              ))}
              {stats.serviceLabels.length > 4 && (
                <span className="text-[11px] font-ui text-muted self-center">+{stats.serviceLabels.length - 4} more</span>
              )}
            </div>
          )}
        </div>
        <div className="mt-5 h-[2.5px] rounded-full" style={{ background: "linear-gradient(to right, #4F8BD9, #8B5CF6, #EC4899, #F97316, #F59E0B)" }} />
      </section>

      <section className="mb-6">
        <div
          id={tablistId}
          role="tablist"
          aria-label="Commissions views"
          onKeyDown={handleTabKeyDown}
          className="flex gap-0 overflow-x-auto scrollbar-hide border-b border-black/[0.08]"
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
                className={`relative shrink-0 px-5 py-3 font-ui text-[13px] transition-colors ${
                  isActive ? "text-ink font-medium" : "text-muted hover:text-ink"
                }`}
              >
                <span className="flex items-center gap-2">
                  <TabIcon icon={item.icon} active={isActive} />
                  <span>{item.label}</span>
                  <span className={`text-[11px] ${isActive ? "text-ink/40" : "text-muted/60"}`}>{item.count}</span>
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 inset-x-0 h-[2.5px] rounded-t-full"
                    style={{ background: "linear-gradient(to right, #4F8BD9, #8B5CF6, #EC4899, #F97316, #F59E0B)" }}
                  />
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-xs font-body text-muted">{activeTabMeta?.helper}</p>
      </section>

      {panel === "services" && (
        <>
          <section className="mb-6">
            <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
              <FilterButton active={filter === "all"} label="All services" count={stats.total} onClick={() => updateViewState({ filter: "all" })} />
              <FilterButton active={filter === "active"} label="Active" count={stats.active} onClick={() => updateViewState({ filter: "active" })} />
              <FilterButton active={filter === "inactive"} label="Inactive" count={stats.inactive} onClick={() => updateViewState({ filter: "inactive" })} />
            </div>
          </section>

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
            <div className="rounded-2xl border border-purple-primary/15 bg-white p-8 text-center">
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

function TabIcon({ icon, active }: { icon: "services" | "seller_reviews" | "buyer_reviews"; active: boolean }) {
  const tone = active ? "text-ink" : "text-muted";

  if (icon === "seller_reviews") {
    return <QuillIcon className="h-3.5 w-3.5" gradient={active} />;
  }

  if (icon === "buyer_reviews") {
    return (
      <svg className={`h-3.5 w-3.5 ${tone}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
        <circle cx="7" cy="6.5" r="2.5" strokeWidth="1.6" />
        <circle cx="13" cy="7.5" r="2.1" strokeWidth="1.6" />
        <path d="M3.5 15.5c.5-2.1 2.3-3.5 4.5-3.5h.8c2.2 0 4 1.4 4.5 3.5" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg className={`h-3.5 w-3.5 ${tone}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M3 6.5h14" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M4 6.5v7.6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6.5" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8 4.5h4l1 2H7l1-2Z" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function FilterButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs transition-colors whitespace-nowrap ${
        active
          ? "bg-ink/[0.07] text-ink font-medium"
          : "text-muted hover:text-ink hover:bg-black/[0.03]"
      }`}
    >
      {label}
      <span className={`ml-1 ${active ? "text-ink/50" : "text-muted/60"}`}>{count}</span>
    </button>
  );
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
        setConfirmDelete(false);
      }
    };

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleEdit = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/sell/edit/${commission.id}`);
    setMenuOpen(false);
  };

  const handleShare = (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/commissions/${commission.id}`;
    navigator.clipboard.writeText(url);
    setMenuOpen(false);
  };

  const handleArchive = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus: ProductStatus = commission.status === "archived" ? "active" : "archived";
    const success = await updateStatus(commission.id, newStatus);
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
  };

  const handleActivate = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await updateStatus(commission.id, "active");
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
  };

  const handleDelete = async (e: ReactMouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    const success = await deleteProduct(commission.id);
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
    setConfirmDelete(false);
  };

  return (
    <div className="relative group">
      <Link
        href={`/commissions/${commission.id}`}
        className="block rounded-[24px] border border-purple-primary/12 overflow-hidden bg-white shadow-sm hover:shadow-xl hover:shadow-pink-vivid/15 hover:-translate-y-1 transition-all duration-300"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-16 -right-14 w-40 h-40 rounded-full bg-pink-vivid/10 blur-2xl" />
        </div>

        <div className="aspect-[4/3] bg-gradient-to-br from-pink-50 to-violet-50 relative overflow-hidden">
          {cover ? (
            <img src={cover} alt={commission.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
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

            <span className="inline-flex items-center gap-1 text-xs font-ui font-semibold text-pink-vivid group-hover:text-purple-primary transition-colors">
              View Service
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {isOwnProfile && (
        <div ref={menuRef} className="absolute top-3 right-3 z-10">
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuOpen(!menuOpen);
              setConfirmDelete(false);
            }}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200
              ${menuOpen
                ? "bg-white shadow-md"
                : "bg-purple-primary/45 opacity-0 group-hover:opacity-100 hover:bg-pink-vivid/60"
              }`}
          >
            <svg className={`w-4 h-4 ${menuOpen ? "text-muted" : "text-white"}`} viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-purple-primary/15 overflow-hidden z-20">
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-purple-50/60 transition-colors"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>

              <button
                onClick={handleShare}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-purple-50/60 transition-colors"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                  <path d="M16 6l-4-4-4 4" />
                  <path d="M12 2v13" />
                </svg>
                Copy Link
              </button>

              {commission.status !== "active" && commission.status !== "sold" && (
                <button
                  onClick={handleActivate}
                  disabled={updating}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-emerald-600 hover:bg-emerald-50 transition-colors disabled:opacity-50"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {updating ? "Activating..." : "Activate"}
                </button>
              )}

              <button
                onClick={handleArchive}
                disabled={updating}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-purple-50/60 transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {updating ? "Updating..." : commission.status === "archived" ? "Unarchive" : "Archive"}
              </button>

              <button
                onClick={handleDelete}
                disabled={deleting}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors disabled:opacity-50
                  ${confirmDelete ? "bg-red-50 text-red-600" : "text-red-500 hover:bg-red-50"}`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                {deleting ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete"}
              </button>
            </div>
          )}
        </div>
      )}
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
