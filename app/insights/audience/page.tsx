"use client";

import { useState } from "react";
import { useProfileInsights, TimeRange, DateRange } from "@/lib/hooks/useInsights";
import DateRangePicker from "@/components/insights/DateRangePicker";
import MetricCard from "@/components/insights/cards/MetricCard";
import GrowthChart from "@/components/insights/charts/GrowthChart";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";
import EmptyState from "@/components/insights/shared/EmptyState";

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export default function InsightsAudiencePage() {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { insights, loading, error } = useProfileInsights(timeRange, customRange);

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Audience Insights</h1>
            <p className="font-body text-muted mt-1">Understand your followers and reach</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink mb-8">Audience Insights</h1>
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Audience Insights</h1>
            <p className="font-body text-muted mt-1">Understand your followers and reach</p>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Audience Insights</h1>
          <p className="font-body text-muted mt-1">Understand your followers and reach</p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
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
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Gained vs Lost */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
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
            <div className="pt-4 border-t border-black/[0.04]">
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
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
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
              <div className="pt-4 border-t border-black/[0.04]">
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

      {/* Best Posting Times Placeholder */}
      {insights.bestPostingTimes && insights.bestPostingTimes.length > 0 && (
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
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
