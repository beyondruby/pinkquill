"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useInsightsDashboard, TimeRange, DateRange } from "@/lib/hooks/useInsights";
import DateRangePicker from "@/components/insights/DateRangePicker";
import MetricCard from "@/components/insights/cards/MetricCard";
import ViewsChart from "@/components/insights/charts/ViewsChart";
import TrafficSourcesChart from "@/components/insights/charts/TrafficSourcesChart";
import GrowthChart from "@/components/insights/charts/GrowthChart";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";
import EmptyState from "@/components/insights/shared/EmptyState";

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

const postTypeLabels: Record<string, string> = {
  poem: "Poem",
  journal: "Journal",
  thought: "Thought",
  visual: "Visual",
  audio: "Audio",
  video: "Video",
  essay: "Essay",
  screenplay: "Screenplay",
  story: "Story",
  letter: "Letter",
  quote: "Quote",
};

export default function InsightsOverviewPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { insights, loading, error } = useInsightsDashboard(timeRange, customRange);

  // Auth guard - redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login?redirect=/insights");
    }
  }, [user, authLoading, router]);

  // Show loading while checking auth
  if (authLoading || !user) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Insights Overview</h1>
            <p className="font-body text-muted mt-1">Track your performance and growth</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  if (loading) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Insights Overview</h1>
            <p className="font-body text-muted mt-1">Track your performance and growth</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl text-ink mb-8">Insights Overview</h1>
        <EmptyState
          title="Error Loading Insights"
          description={error}
          action={{ label: "Try Again", onClick: () => window.location.reload() }}
        />
      </div>
    );
  }

  // Show empty state only if user has no content at all
  if (!insights || insights.contentCount.total === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Insights Overview</h1>
            <p className="font-body text-muted mt-1">Track your performance and growth</p>
          </div>
          <DateRangePicker
            value={timeRange}
            customRange={customRange}
            onChange={handleTimeRangeChange}
          />
        </div>
        <EmptyState
          title="No Content Yet"
          description="Start creating content to see your analytics here. Views, engagement, and growth metrics will appear once you publish your first post or take."
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
          <h1 className="font-display text-3xl text-ink">Insights Overview</h1>
          <p className="font-body text-muted mt-1">Track your performance and growth</p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Info message when user has content but no views yet */}
      {insights.totalViews === 0 && insights.contentCount.total > 0 && (
        <div className="mb-6 bg-purple-primary/5 border border-purple-primary/20 rounded-xl p-4 flex items-start gap-3">
          <svg className="w-5 h-5 text-purple-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-ui text-sm text-ink">
              You have {insights.contentCount.total} {insights.contentCount.total === 1 ? 'piece' : 'pieces'} of content
              {insights.contentCount.posts > 0 && insights.contentCount.takes > 0
                ? ` (${insights.contentCount.posts} ${insights.contentCount.posts === 1 ? 'post' : 'posts'}, ${insights.contentCount.takes} ${insights.contentCount.takes === 1 ? 'take' : 'takes'})`
                : insights.contentCount.posts > 0
                ? ` (${insights.contentCount.posts} ${insights.contentCount.posts === 1 ? 'post' : 'posts'})`
                : ` (${insights.contentCount.takes} ${insights.contentCount.takes === 1 ? 'take' : 'takes'})`
              }
            </p>
            <p className="font-body text-sm text-muted mt-1">
              Views will appear here as people engage with your content. Share your work to start growing your audience!
            </p>
          </div>
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Views"
          value={insights.totalViews}
          previousValue={insights.previousPeriod.views}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <MetricCard
          label="Reach"
          value={insights.totalReach}
          previousValue={insights.previousPeriod.reach}
          description="Unique accounts reached"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Engagement Rate"
          value={insights.engagementRate}
          format="percentage"
          description="Interactions / Reach"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Follower Growth"
          value={`${insights.followerGrowth.netChange >= 0 ? "+" : ""}${insights.followerGrowth.netChange}`}
          description={`${insights.followerGrowth.currentCount.toLocaleString()} total`}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          }
        />
      </div>

      {/* Views Chart */}
      <div className="mb-8">
        <ViewsChart data={insights.viewsByDay} title="Views Over Time" height={280} />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Traffic Sources */}
        <TrafficSourcesChart data={insights.trafficSources} title="Traffic Sources" height={250} />

        {/* Follower Growth */}
        <GrowthChart data={insights.followerGrowth} title="Follower Growth" height={250} />
      </div>

      {/* Top Content */}
      {insights.topContent.length > 0 && (
        <div className="bg-white rounded-2xl border border-black/[0.04] overflow-hidden">
          <div className="p-4 border-b border-black/[0.04] flex items-center justify-between">
            <h3 className="font-ui text-sm font-medium text-ink">Top Performing Content</h3>
            <Link
              href="/insights/content"
              className="font-ui text-xs text-purple-primary hover:underline"
            >
              View all
            </Link>
          </div>
          <div className="divide-y divide-black/[0.04]">
            {insights.topContent.slice(0, 5).map((item) => (
              <Link
                key={item.id}
                href={`/insights/content/${item.type}/${item.id}`}
                className="flex items-center gap-4 p-4 hover:bg-black/[0.01] transition-colors"
              >
                <div className="w-12 h-12 rounded-lg bg-purple-primary/5 flex items-center justify-center">
                  {item.type === "take" ? (
                    <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm text-ink truncate">
                    {item.title || "Untitled"}
                  </p>
                  <p className="font-body text-xs text-muted">
                    {item.type === "take" ? "Take" : item.postType ? postTypeLabels[item.postType] || item.postType : "Post"} • {new Date(item.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-sm text-ink">{formatNumber(item.views)} views</p>
                  <p className="font-body text-xs text-muted">
                    {item.engagementRate.toFixed(1)}% engagement
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
