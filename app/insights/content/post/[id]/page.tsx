"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { usePostInsights, TimeRange, DateRange } from "@/lib/hooks/useInsights";
import DateRangePicker from "@/components/insights/DateRangePicker";
import MetricCard from "@/components/insights/cards/MetricCard";
import ViewsChart from "@/components/insights/charts/ViewsChart";
import TrafficSourcesChart from "@/components/insights/charts/TrafficSourcesChart";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";
import EmptyState from "@/components/insights/shared/EmptyState";

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default function PostInsightsPage() {
  const params = useParams();
  const postId = params.id as string;
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();

  const { insights, post, loading, error } = usePostInsights(postId, timeRange, customRange);

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  if (loading) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/insights/content" className="font-ui text-sm text-muted hover:text-ink flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Content
          </Link>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error || !insights || !post) {
    return (
      <div>
        <div className="mb-6">
          <Link href="/insights/content" className="font-ui text-sm text-muted hover:text-ink flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Content
          </Link>
        </div>
        <EmptyState
          title="Post Not Found"
          description={error || "This post could not be found or you don't have permission to view its insights."}
          action={{ label: "View All Content", href: "/insights/content" }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Back Link */}
      <div className="mb-6">
        <Link href="/insights/content" className="font-ui text-sm text-muted hover:text-ink flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Content
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-xl bg-purple-primary/5 flex items-center justify-center flex-shrink-0">
            <svg className="w-7 h-7 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-display text-2xl text-ink">{post.title || "Untitled"}</h1>
            <p className="font-body text-muted mt-1">
              Published {new Date(post.createdAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <Link
              href={`/post/${postId}`}
              className="font-ui text-sm text-purple-primary hover:underline mt-2 inline-block"
            >
              View Post
            </Link>
          </div>
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
          label="Views"
          value={insights.views}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <MetricCard
          label="Reach"
          value={insights.reach}
          description="Unique viewers"
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
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          }
        />
        <MetricCard
          label="Avg. Read Time"
          value={formatDuration(insights.avgReadTime)}
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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

        {/* Audience Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
          <h3 className="font-ui text-sm font-medium text-ink mb-4">Audience Breakdown</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-primary/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">Followers</p>
                  <p className="font-body text-xs text-muted">People who follow you</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-ui text-lg text-ink">{formatNumber(insights.demographics.followers)}</p>
                <p className="font-body text-xs text-muted">
                  {insights.demographics.followerPercentage.toFixed(0)}%
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-pink-vivid/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </div>
                <div>
                  <p className="font-ui text-sm text-ink">Non-followers</p>
                  <p className="font-body text-xs text-muted">New audience reach</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-ui text-lg text-ink">{formatNumber(insights.demographics.nonFollowers)}</p>
                <p className="font-body text-xs text-muted">
                  {(100 - insights.demographics.followerPercentage).toFixed(0)}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Engagement Breakdown */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <h3 className="font-ui text-sm font-medium text-ink mb-4">Engagement Breakdown</h3>
        <div className="grid grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            </div>
            <p className="font-ui text-2xl text-ink">{formatNumber(insights.reactions.total)}</p>
            <p className="font-body text-xs text-muted">Admires</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-blue-50 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <p className="font-ui text-2xl text-ink">{formatNumber(insights.comments)}</p>
            <p className="font-body text-xs text-muted">Comments</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-green-50 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <p className="font-ui text-2xl text-ink">{formatNumber(insights.relays)}</p>
            <p className="font-body text-xs text-muted">Relays</p>
          </div>
          <div className="text-center">
            <div className="w-12 h-12 mx-auto rounded-xl bg-yellow-50 flex items-center justify-center mb-2">
              <svg className="w-6 h-6 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <p className="font-ui text-2xl text-ink">{formatNumber(insights.saves)}</p>
            <p className="font-body text-xs text-muted">Saves</p>
          </div>
        </div>
      </div>
    </div>
  );
}
