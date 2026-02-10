"use client";

import Link from "next/link";
import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSellerCommissions } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import { useDeleteProduct, useUpdateProductStatus } from "@/lib/hooks/useProducts";
import { SELLER_LEVEL_LABELS, type Product, type ProductStatus, type SellerLevel } from "@/lib/types/store";

interface CommissionsTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

type StatusFilter = "all" | "active" | "inactive";

const STATUS_LABEL: Record<Product["status"], string> = {
  draft: "Draft",
  active: "Active",
  sold: "Sold",
  paused: "Paused",
  archived: "Archived",
};

const STATUS_STYLES: Record<Product["status"], string> = {
  draft: "bg-slate-100 text-slate-700",
  active: "bg-emerald-100 text-emerald-700",
  sold: "bg-blue-100 text-blue-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-gray-100 text-gray-700",
};

export default function CommissionsTab({ userId, isOwnProfile, pageLoaded }: CommissionsTabProps) {
  const { commissions, loading, error, refetch } = useSellerCommissions(userId);
  const { stats: sellerStats, loading: sellerStatsLoading } = useSellerStats(userId);
  const [filter, setFilter] = useState<StatusFilter>("all");

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

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-3xl border border-black/[0.06] bg-white/90 p-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-black/[0.06] bg-gray-50/60 p-4 animate-pulse">
                <div className="aspect-[4/3] rounded-xl bg-gradient-to-br from-purple-50 to-pink-50" />
                <div className="mt-4 space-y-2">
                  <div className="h-3 w-1/3 rounded bg-gray-200" />
                  <div className="h-4 w-3/4 rounded bg-gray-200" />
                  <div className="h-4 w-1/2 rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="rounded-3xl border border-red-200 bg-red-50/60 p-10 text-center">
          <p className="font-ui text-red-600">Failed to load commissions</p>
          <p className="text-sm font-body text-red-500/90 mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (commissions.length === 0) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="relative rounded-[32px] border border-pink-100 bg-gradient-to-br from-pink-50/90 via-white to-orange-50/80 p-10 text-center overflow-hidden">
          <div className="absolute -top-16 -left-14 w-40 h-40 rounded-full bg-purple-primary/10 blur-2xl" />
          <div className="absolute -bottom-16 -right-14 w-44 h-44 rounded-full bg-orange-warm/15 blur-2xl" />

          <div className="relative">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-purple-primary/15 to-pink-vivid/15 flex items-center justify-center">
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
                className="inline-flex mt-7 items-center gap-2 px-6 py-3 rounded-full text-sm font-ui font-semibold text-white bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm hover:shadow-lg hover:shadow-pink-vivid/20 transition-all"
              >
                Add Service
              </Link>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      <div className="mb-8">
        <div className="relative overflow-hidden rounded-3xl border border-black/[0.06] bg-gradient-to-br from-white via-pink-50/40 to-purple-50/30 p-6 sm:p-8">
          <div className="pointer-events-none absolute -top-20 -right-20 h-48 w-48 rounded-full bg-pink-vivid/[0.06] blur-3xl" />
          <div className="pointer-events-none absolute -bottom-16 -left-16 h-40 w-40 rounded-full bg-purple-primary/[0.06] blur-3xl" />

          <div className="relative">
            {/* Top row: Score + Metrics */}
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10">
              {/* Quill Score */}
              <QuillScore
                rating={sellerStats?.total_reviews ? sellerStats.avg_rating : null}
                reviews={sellerStats?.total_reviews ?? 0}
                level={sellerStats?.seller_level as SellerLevel | undefined}
                loading={sellerStatsLoading}
              />

              {/* Metrics */}
              <div className="flex items-center gap-8 sm:gap-10">
                <div className="flex flex-col items-center">
                  <span className="font-display text-2xl font-bold text-ink leading-none">{stats.active}</span>
                  <span className="text-[10px] font-ui text-muted mt-1 uppercase tracking-wider">Active</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="font-display text-2xl font-bold text-ink leading-none">{formatResponseTime(responseTimeHours)}</span>
                  <span className="text-[10px] font-ui text-muted mt-1 uppercase tracking-wider">Response</span>
                </div>
                {sellerStats && sellerStats.completed_orders > 0 && (
                  <div className="flex flex-col items-center">
                    <span className="font-display text-2xl font-bold text-ink leading-none">{sellerStats.completed_orders}</span>
                    <span className="text-[10px] font-ui text-muted mt-1 uppercase tracking-wider">Completed</span>
                  </div>
                )}
                <div className="flex flex-col items-center">
                  <span className="font-display text-2xl font-bold text-ink leading-none">{stats.total}</span>
                  <span className="text-[10px] font-ui text-muted mt-1 uppercase tracking-wider">Services</span>
                </div>
              </div>
            </div>

            {/* Services offered */}
            {stats.serviceLabels.length > 0 && (
              <div className="mt-5 pt-5 border-t border-black/[0.05]">
                <p className="text-[10px] font-ui uppercase tracking-[0.16em] text-muted mb-2">Offered</p>
                <div className="flex flex-wrap gap-1.5">
                  {stats.serviceLabels.slice(0, 6).map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center rounded-full border border-pink-vivid/15 bg-white px-3 py-1 text-xs font-ui text-ink/80"
                    >
                      <span className="max-w-[200px] truncate">{label}</span>
                    </span>
                  ))}
                  {stats.serviceLabels.length > 6 && (
                    <span className="inline-flex items-center rounded-full border border-black/[0.06] bg-white px-3 py-1 text-xs font-ui text-muted">
                      +{stats.serviceLabels.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 mb-6 overflow-x-auto scrollbar-hide">
        <FilterButton active={filter === "all"} label="All" count={stats.total} onClick={() => setFilter("all")} />
        <FilterButton active={filter === "active"} label="Active" count={stats.active} onClick={() => setFilter("active")} />
        <FilterButton active={filter === "inactive"} label="Inactive" count={stats.inactive} onClick={() => setFilter("inactive")} />
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
          <p className="font-ui text-ink">No services in this filter yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((commission, index) => (
            <CommissionCard key={commission.id} commission={commission} isOwnProfile={isOwnProfile} index={index} onRefetch={refetch} />
          ))}
        </div>
      )}
    </div>
  );
}

function formatResponseTime(hours: number | null): string {
  if (!hours || hours <= 0) return "--";
  if (hours < 1) return "<1 hour";
  if (hours < 24) {
    const roundedHours = Math.round(hours);
    return `${roundedHours} hour${roundedHours === 1 ? "" : "s"}`;
  }

  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}

function QuillScore({
  rating,
  reviews,
  level,
  loading,
}: {
  rating: number | null;
  reviews: number;
  level?: SellerLevel;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 shrink-0">
        <div className="w-[80px] h-[80px] rounded-full bg-black/[0.04] animate-pulse" />
        <div className="h-3 w-14 rounded bg-black/[0.04] animate-pulse" />
      </div>
    );
  }

  const hasRating = rating !== null && reviews > 0;
  const normalized = hasRating ? Math.max(0, Math.min(5, rating)) : 0;

  const size = 80;
  const strokeWidth = 4.5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const arcLength = circumference * 0.75;
  const filledLength = hasRating ? arcLength * (normalized / 5) : 0;
  const rotation = 135;

  if (!hasRating) {
    return (
      <div className="flex flex-col items-center gap-1.5 shrink-0">
        <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
          <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="absolute inset-0">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(0,0,0,0.05)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={`${arcLength} ${circumference}`}
              transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
            />
          </svg>
          <svg className="w-5 h-5 text-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </div>
        <span className="text-[11px] font-ui text-muted">New creator</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="rgba(0,0,0,0.05)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${arcLength} ${circumference}`}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
          <defs>
            <linearGradient id="qs-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#8e44ad" />
              <stop offset="100%" stopColor="#ff007f" />
            </linearGradient>
          </defs>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="url(#qs-grad)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${filledLength} ${circumference}`}
            transform={`rotate(${rotation} ${size / 2} ${size / 2})`}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold leading-none text-ink">
            {normalized.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="flex flex-col items-center">
        <span className="text-[11px] font-ui text-muted">
          {reviews} review{reviews === 1 ? "" : "s"}
        </span>
        {level && level !== "new" && (
          <span className="text-[10px] font-ui font-medium text-pink-vivid">
            {SELLER_LEVEL_LABELS[level]}
          </span>
        )}
      </div>
    </div>
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
      className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap ${
        active
          ? "bg-pink-vivid/10 text-pink-vivid"
          : "text-muted hover:text-ink hover:bg-black/[0.03]"
      }`}
    >
      {label}
      <span className={`ml-1 ${active ? "text-pink-vivid/60" : "text-muted/60"}`}>{count}</span>
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

  // Close menu when clicking outside
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

  const handleEdit = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    router.push(`/sell/edit/${commission.id}`);
    setMenuOpen(false);
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/commissions/${commission.id}`;
    navigator.clipboard.writeText(url);
    setMenuOpen(false);
  };

  const handleArchive = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newStatus: ProductStatus = commission.status === "archived" ? "active" : "archived";
    const success = await updateStatus(commission.id, newStatus);
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
  };

  const handleActivate = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const success = await updateStatus(commission.id, "active");
    if (success) {
      await onRefetch();
    }
    setMenuOpen(false);
  };

  const handleDelete = async (e: React.MouseEvent) => {
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
        className="block rounded-[24px] border border-black/[0.06] overflow-hidden bg-white shadow-sm hover:shadow-xl hover:shadow-pink-vivid/15 hover:-translate-y-1 transition-all duration-300"
        style={{ animationDelay: `${index * 50}ms` }}
      >
        <div className="absolute inset-0 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="absolute -top-16 -right-14 w-40 h-40 rounded-full bg-pink-vivid/10 blur-2xl" />
        </div>

        <div className="aspect-[4/3] bg-gradient-to-br from-pink-50 to-orange-50 relative overflow-hidden">
          {cover ? (
            <img src={cover} alt={commission.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-pink-vivid/40">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
              </svg>
            </div>
          )}

          <div className={`absolute top-3 left-3 ${isOwnProfile ? "right-14" : "right-3"} flex items-start justify-between gap-2`}>
            <span className="px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold bg-white/90 text-purple-primary">
              Commission
            </span>
            <span className={`px-2.5 py-1 rounded-full text-[11px] font-ui font-semibold ${STATUS_STYLES[commission.status]}`}>
              {STATUS_LABEL[commission.status]}
            </span>
          </div>
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

            <span className="inline-flex items-center gap-1 text-xs font-ui font-semibold text-pink-vivid group-hover:text-orange-warm transition-colors">
              View Service
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </span>
          </div>
        </div>
      </Link>

      {/* 3-dot menu — positioned same as product cards */}
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
                : "bg-black/40 opacity-0 group-hover:opacity-100 hover:bg-black/60"
              }`}
          >
            <svg className={`w-4 h-4 ${menuOpen ? "text-muted" : "text-white"}`} viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {menuOpen && (
            <div className="absolute top-full right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-20">
              {/* Edit */}
              <button
                onClick={handleEdit}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                </svg>
                Edit
              </button>

              {/* Share */}
              <button
                onClick={handleShare}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Copy Link
              </button>

              {/* Activate (only for inactive) */}
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

              {/* Archive/Unarchive */}
              <button
                onClick={handleArchive}
                disabled={updating}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors disabled:opacity-50"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                {updating ? "Updating..." : commission.status === "archived" ? "Unarchive" : "Archive"}
              </button>

              {/* Delete */}
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
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-ui font-medium bg-gray-100 text-gray-700">
      {label}
    </span>
  );
}
