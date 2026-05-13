"use client";

import { useState } from "react";
import { useProfileInsights, TimeRange, DateRange, AudienceLocationItem } from "@/lib/hooks/useInsights";
import dynamic from "next/dynamic";
import DateRangePicker from "@/components/insights/DateRangePicker";
import MetricCard from "@/components/insights/cards/MetricCard";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";

const GrowthChart = dynamic(() => import("@/components/insights/charts/GrowthChart"), { ssr: false });
import EmptyState from "@/components/insights/shared/EmptyState";

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  DE: "Germany", FR: "France", IT: "Italy", ES: "Spain", NL: "Netherlands",
  SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland", PL: "Poland",
  BR: "Brazil", MX: "Mexico", AR: "Argentina", CL: "Chile", CO: "Colombia",
  IN: "India", JP: "Japan", KR: "South Korea", CN: "China", SG: "Singapore",
  PH: "Philippines", ID: "Indonesia", TH: "Thailand", VN: "Vietnam",
  MY: "Malaysia", PK: "Pakistan", BD: "Bangladesh", AE: "UAE", SA: "Saudi Arabia",
  EG: "Egypt", ZA: "South Africa", NG: "Nigeria", KE: "Kenya", MA: "Morocco",
  TR: "Turkey", IR: "Iran", IL: "Israel", LB: "Lebanon", JO: "Jordan",
  RU: "Russia", UA: "Ukraine", CZ: "Czechia", AT: "Austria", BE: "Belgium",
  CH: "Switzerland", IE: "Ireland", PT: "Portugal", GR: "Greece", RO: "Romania",
  NZ: "New Zealand",
};

function countryFlag(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return "";
  return String.fromCodePoint(
    ...code.split("").map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
}

function formatLocation(raw: string, mode: "country" | "city"): string {
  if (mode === "country" && /^[A-Z]{2}$/.test(raw)) {
    const name = COUNTRY_NAMES[raw] ?? raw;
    const flag = countryFlag(raw);
    return flag ? `${flag} ${name}` : name;
  }
  return raw;
}

function LocationList({
  items,
  mode,
  barColor,
}: {
  items: AudienceLocationItem[];
  mode: "country" | "city";
  barColor: string;
}) {
  return (
    <div className="space-y-3">
      {items.map((loc) => (
        <div key={loc.location}>
          <div className="flex items-center justify-between mb-1">
            <p className="font-ui text-sm text-ink truncate" title={loc.location}>
              {formatLocation(loc.location, mode)}
            </p>
            <p className="font-ui text-sm text-muted shrink-0 ml-2">
              {formatNumber(loc.count)} · {loc.percentage}%
            </p>
          </div>
          <div className="h-2 rounded-full bg-border-light overflow-hidden">
            <div
              className={`h-full ${barColor} rounded-full`}
              style={{ width: `${Math.max(loc.percentage, 2)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function InsightsAudiencePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [followerLocMode, setFollowerLocMode] = useState<"country" | "city">("country");
  const [viewerLocMode, setViewerLocMode] = useState<"country" | "city">("country");

  const { insights, loading, error } = useProfileInsights(timeRange, customRange);

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  if (loading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Audience Insights</h1>
            <p className="font-body text-sm sm:text-base text-muted mt-1">Understand your followers and reach</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-2xl sm:text-3xl text-ink mb-8">Audience Insights</h1>
        <EmptyState
          title="Error Loading Audience Data"
          description={error}
          action={{ label: "Try Again", onClick: () => window.location.reload() }}
        />
      </div>
    );
  }

  if (!insights) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Audience Insights</h1>
            <p className="font-body text-sm sm:text-base text-muted mt-1">Understand your followers and reach</p>
          </div>
          <DateRangePicker
            value={timeRange}
            customRange={customRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <EmptyState
          title="No Audience Data Yet"
          description="Start creating content and building your audience to see analytics here."
          action={{ label: "Create Post", href: "/create" }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink">Audience Insights</h1>
          <p className="font-body text-sm sm:text-base text-muted mt-1">Understand your followers and reach</p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        <MetricCard
          label="Total Followers"
          value={insights.followerGrowth.currentCount}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Net Growth"
          value={`${insights.followerGrowth.netChange >= 0 ? "+" : ""}${insights.followerGrowth.netChange}`}
          description={`${insights.followerGrowth.gained} gained, ${insights.followerGrowth.lost} lost`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
        <MetricCard
          label="Verified Followers"
          value={insights.audience.verifiedFollowers}
          description={
            insights.audience.totalFollowers > 0
              ? `${((insights.audience.verifiedFollowers / insights.audience.totalFollowers) * 100).toFixed(1)}% of followers`
              : "No followers yet"
          }
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Profile Views"
          value={insights.profileViews}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <MetricCard
          label="Unique Visitors"
          value={insights.uniqueViewers}
          description="Profile viewers"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
        <MetricCard
          label="Content Reach"
          value={insights.contentReach}
          description="Unique accounts reached"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          }
        />
      </div>

      {/* Follower Growth Chart */}
      <div className="mb-8">
        <GrowthChart
          data={insights.followerGrowth}
          title="Follower Growth"
          height={320}
          type="followers"
        />
      </div>

      {/* Growth Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Gained vs Lost */}
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
          <h3 className="font-ui text-sm font-medium text-ink mb-4">Follower Changes</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">New Followers</p>
                  <p className="font-body text-xs text-muted">People who started following you</p>
                </div>
              </div>
              <p className="font-ui text-xl text-green-500">+{formatNumber(insights.followerGrowth.gained)}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">Unfollows</p>
                  <p className="font-body text-xs text-muted">People who unfollowed you</p>
                </div>
              </div>
              <p className="font-ui text-xl text-red-500">-{formatNumber(insights.followerGrowth.lost)}</p>
            </div>
            <div className="pt-4 border-t border-border-light">
              <div className="flex items-center justify-between">
                <p className="font-ui text-sm text-ink font-medium">Net Change</p>
                <p className={`font-ui text-xl font-medium ${
                  insights.followerGrowth.netChange > 0
                    ? "text-green-500"
                    : insights.followerGrowth.netChange < 0
                    ? "text-red-500"
                    : "text-muted"
                }`}>
                  {insights.followerGrowth.netChange > 0 ? "+" : ""}
                  {formatNumber(insights.followerGrowth.netChange)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Engagement */}
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
          <h3 className="font-ui text-sm font-medium text-ink mb-4">Profile Engagement</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">Profile Views</p>
                  <p className="font-body text-xs text-muted">Times your profile was viewed</p>
                </div>
              </div>
              <p className="font-ui text-xl text-ink">{formatNumber(insights.profileViews)}</p>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                  <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">Unique Visitors</p>
                  <p className="font-body text-xs text-muted">Unique accounts that viewed you</p>
                </div>
              </div>
              <p className="font-ui text-xl text-ink">{formatNumber(insights.uniqueViewers)}</p>
            </div>
            {insights.profileViews > 0 && insights.followerGrowth.gained > 0 && (
              <div className="pt-4 border-t border-border-light">
                <div className="flex items-center justify-between">
                  <p className="font-ui text-sm text-ink">Follow Rate</p>
                  <p className="font-ui text-xl text-purple-primary">
                    {((insights.followerGrowth.gained / insights.profileViews) * 100).toFixed(1)}%
                  </p>
                </div>
                <p className="font-body text-xs text-muted mt-1">
                  Profile visitors who followed you
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Audience composition */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {(() => {
          const followerItems =
            followerLocMode === "country"
              ? insights.audience.followerCountries
              : insights.audience.followerCities;
          const unlocated = Math.max(
            0,
            insights.audience.totalFollowers - insights.audience.locatedFollowers
          );
          return (
            <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-ui text-sm font-medium text-ink">Top Follower Locations</h3>
                <div className="flex rounded-lg bg-border-light/50 p-0.5 text-xs">
                  {(["country", "city"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setFollowerLocMode(m)}
                      className={`px-2.5 py-1 rounded-md font-ui capitalize transition-colors ${
                        followerLocMode === m
                          ? "bg-surface text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <p className="font-body text-xs text-muted mb-4">
                Inferred from your followers&apos; last known location
              </p>
              {followerItems.length === 0 ? (
                <p className="font-body text-sm text-muted">
                  {insights.audience.totalFollowers === 0
                    ? "No followers yet."
                    : "Not enough location data for your followers yet."}
                </p>
              ) : (
                <>
                  <LocationList
                    items={followerItems}
                    mode={followerLocMode}
                    barColor="bg-purple-primary"
                  />
                  {unlocated > 0 && (
                    <p className="font-body text-xs text-muted pt-3 mt-3 border-t border-border-light">
                      {formatNumber(unlocated)} follower{unlocated === 1 ? "" : "s"} without
                      location data
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()}

        {(() => {
          const viewerItems =
            viewerLocMode === "country"
              ? insights.audience.viewerCountries
              : insights.audience.viewerCities;
          const unlocated = Math.max(
            0,
            insights.audience.totalViewers - insights.audience.locatedViewers
          );
          return (
            <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
              <div className="flex items-start justify-between gap-3 mb-1">
                <h3 className="font-ui text-sm font-medium text-ink">Top Visitor Locations</h3>
                <div className="flex rounded-lg bg-border-light/50 p-0.5 text-xs">
                  {(["country", "city"] as const).map((m) => (
                    <button
                      key={m}
                      onClick={() => setViewerLocMode(m)}
                      className={`px-2.5 py-1 rounded-md font-ui capitalize transition-colors ${
                        viewerLocMode === m
                          ? "bg-surface text-ink shadow-sm"
                          : "text-muted hover:text-ink"
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <p className="font-body text-xs text-muted mb-4">
                Derived from visitor IP at the time of view
              </p>
              {viewerItems.length === 0 ? (
                <p className="font-body text-sm text-muted">
                  {insights.audience.totalViewers === 0
                    ? "No visitors yet."
                    : "Location data isn't available for this period yet."}
                </p>
              ) : (
                <>
                  <LocationList
                    items={viewerItems}
                    mode={viewerLocMode}
                    barColor="bg-blue-500"
                  />
                  {unlocated > 0 && (
                    <p className="font-body text-xs text-muted pt-3 mt-3 border-t border-border-light">
                      {formatNumber(unlocated)} visitor{unlocated === 1 ? "" : "s"} without
                      location data
                    </p>
                  )}
                </>
              )}
            </div>
          );
        })()}
      </div>

      {/* Viewer mix */}
      {(insights.audience.viewerMix.followers > 0 || insights.audience.viewerMix.nonFollowers > 0) && (
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light mb-8">
          <h3 className="font-ui text-sm font-medium text-ink mb-1">Viewer Mix</h3>
          <p className="font-body text-xs text-muted mb-4">
            Share of profile views from followers vs non-followers
          </p>
          <div className="h-3 rounded-full bg-border-light overflow-hidden flex">
            <div
              className="h-full bg-purple-primary"
              style={{ width: `${insights.audience.viewerMix.followerPercentage}%` }}
            />
            <div
              className="h-full bg-blue-500"
              style={{ width: `${100 - insights.audience.viewerMix.followerPercentage}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-3">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-primary" />
              <span className="font-ui text-sm text-ink">
                Followers · {formatNumber(insights.audience.viewerMix.followers)}
              </span>
              <span className="font-body text-xs text-muted">
                ({insights.audience.viewerMix.followerPercentage}%)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="font-ui text-sm text-ink">
                Non-followers · {formatNumber(insights.audience.viewerMix.nonFollowers)}
              </span>
              <span className="font-body text-xs text-muted">
                ({(100 - insights.audience.viewerMix.followerPercentage).toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Best Posting Times Placeholder */}
      {insights.bestPostingTimes && insights.bestPostingTimes.length > 0 && (
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
          <h3 className="font-ui text-sm font-medium text-ink mb-4">Best Times to Post</h3>
          <p className="font-body text-sm text-muted">
            Based on when your audience is most active and engaged with your content.
          </p>
          <div className="mt-4 grid grid-cols-7 gap-2">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, dayIndex) => (
              <div key={day} className="text-center">
                <p className="font-ui text-xs text-muted mb-2">{day}</p>
                <div className="space-y-1">
                  {[9, 12, 15, 18, 21].map((hour) => {
                    const value = insights.bestPostingTimes[dayIndex]?.[hour] || 0;
                    const maxValue = Math.max(...insights.bestPostingTimes.flat());
                    const intensity = maxValue > 0 ? value / maxValue : 0;
                    return (
                      <div
                        key={hour}
                        className="h-6 rounded"
                        style={{
                          backgroundColor: `rgba(142, 68, 173, ${0.1 + intensity * 0.5})`,
                        }}
                        title={`${hour}:00 - ${value} interactions`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-4 mt-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(142, 68, 173, 0.1)" }} />
              <span className="font-body text-xs text-muted">Low</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: "rgba(142, 68, 173, 0.6)" }} />
              <span className="font-body text-xs text-muted">High</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
