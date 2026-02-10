"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useSellerCommissions } from "@/lib/hooks/useCommissions";
import { useSellerStats } from "@/lib/hooks/useReviews";
import type { Product } from "@/lib/types/store";

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
  const { commissions, loading, error } = useSellerCommissions(userId);
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
      <div className="mb-6">
        <div className="relative overflow-hidden rounded-[28px] border border-black/[0.07] bg-white/90 p-5 sm:p-6">
          <div className="pointer-events-none absolute -top-20 -left-10 h-48 w-48 rounded-full bg-pink-vivid/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 -right-10 h-56 w-56 rounded-full bg-orange-warm/10 blur-3xl" />

          <div className="relative flex flex-col gap-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <MetricPill label="Total Services" value={stats.total.toString()} />
                  <MetricPill label="Active Listings" value={stats.active.toString()} />
                  <MetricPill
                    label="Creator Rating"
                    value={
                      <CreativePulse
                        rating={sellerStats?.total_reviews ? sellerStats.avg_rating : null}
                        reviews={sellerStats?.total_reviews ?? 0}
                        loading={sellerStatsLoading}
                      />
                    }
                  />
                  <MetricPill label="Avg Response Time" value={formatResponseTime(responseTimeHours)} />
                </div>
                <p className="text-sm font-body text-muted mt-3">
                  {isOwnProfile
                    ? "Your services here are visible across studio and marketplace."
                    : "Published services this creator currently offers."}
                </p>
              </div>

              {isOwnProfile && (
                <Link
                  href="/sell/service"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-ui font-semibold text-pink-vivid border border-pink-vivid/30 bg-white hover:bg-pink-50 transition-colors self-start"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Service
                </Link>
              )}
            </div>

            <div className="pt-4 border-t border-black/[0.06]">
              <p className="text-[11px] font-ui uppercase tracking-[0.16em] text-muted mb-2">Services Offered</p>
              <div className="flex flex-wrap gap-2">
                {stats.serviceLabels.length > 0 ? (
                  <>
                    {stats.serviceLabels.slice(0, 5).map((label) => (
                      <ServiceChip key={label} label={label} />
                    ))}
                    {stats.serviceLabels.length > 5 && <ServiceChip label={`+${stats.serviceLabels.length - 5} more`} subtle />}
                  </>
                ) : (
                  <p className="text-xs font-body text-muted">
                    Service specializations will appear here as this creator publishes listings.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-1.5 rounded-2xl border border-black/[0.07] bg-white p-1.5">
          <FilterButton
            active={filter === "all"}
            label="All"
            count={stats.total}
            onClick={() => setFilter("all")}
          />
          <FilterButton
            active={filter === "active"}
            label="Active"
            count={stats.active}
            onClick={() => setFilter("active")}
          />
          <FilterButton
            active={filter === "inactive"}
            label="Inactive"
            count={stats.inactive}
            onClick={() => setFilter("inactive")}
          />
        </div>

        <p className="text-xs font-ui text-muted">
          {filtered.length} visible service{filtered.length === 1 ? "" : "s"}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-black/[0.06] bg-white p-8 text-center">
          <p className="font-ui text-ink">No services in this filter yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((commission) => (
            <CommissionCard key={commission.id} commission={commission} />
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

function MetricPill({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-white/80 px-3.5 py-1.5">
      <span className="text-[11px] font-ui uppercase tracking-[0.12em] text-muted">{label}</span>
      <span className="text-sm font-ui font-semibold text-ink">{value}</span>
    </div>
  );
}

function CreativePulse({
  rating,
  reviews,
  loading,
}: {
  rating: number | null;
  reviews: number;
  loading: boolean;
}) {
  if (loading) {
    return <span className="inline-block h-4 w-14 rounded bg-gray-200/90 animate-pulse" />;
  }

  if (rating === null || reviews === 0) {
    return <span className="text-xs font-ui text-muted">New</span>;
  }

  const normalized = Math.max(0, Math.min(5, rating));
  const filledPulses = Math.round(normalized);

  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex items-end gap-1">
        {Array.from({ length: 5 }).map((_, index) => {
          const active = index < filledPulses;
          return (
            <span
              key={index}
              className={`w-[5px] rounded-full ${active ? "bg-gradient-to-t from-purple-primary via-pink-vivid to-orange-warm" : "bg-black/[0.15]"}`}
              style={{ height: `${8 + index * 2}px` }}
            />
          );
        })}
      </span>
      <span>{normalized.toFixed(1)}</span>
      <span className="text-xs text-muted">({reviews})</span>
    </span>
  );
}

function ServiceChip({ label, subtle = false }: { label: string; subtle?: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-ui ${
        subtle
          ? "border-black/[0.08] bg-white text-muted"
          : "border-pink-vivid/20 bg-gradient-to-r from-pink-50/90 to-orange-50/90 text-ink"
      }`}
    >
      <span className="max-w-[220px] truncate">{label}</span>
    </span>
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
      className={`px-4 py-2 rounded-xl text-sm font-ui transition-all ${
        active
          ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-sm"
          : "text-muted hover:text-ink hover:bg-gray-50"
      }`}
    >
      {label}
      <span className={`ml-1.5 text-xs ${active ? "text-white/80" : "text-muted"}`}>{count}</span>
    </button>
  );
}

function CommissionCard({ commission }: { commission: Product }) {
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

  return (
    <Link
      href={`/commissions/${commission.id}`}
      className="group relative rounded-[24px] border border-black/[0.06] overflow-hidden bg-white shadow-sm hover:shadow-xl hover:shadow-pink-vivid/15 hover:-translate-y-1 transition-all duration-300"
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

        <div className="absolute top-3 left-3 right-3 flex items-start justify-between gap-2">
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
  );
}

function MetaChip({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-ui font-medium bg-gray-100 text-gray-700">
      {label}
    </span>
  );
}
