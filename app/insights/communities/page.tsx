"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunityInsights, TimeRange, DateRange } from "@/lib/hooks/useInsights";
import dynamic from "next/dynamic";
import DateRangePicker from "@/components/insights/DateRangePicker";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";

const GrowthChart = dynamic(() => import("@/components/insights/charts/GrowthChart"), { ssr: false });
import EmptyState from "@/components/insights/shared/EmptyState";
import { supabase } from "@/lib/supabase";

interface Community {
  id: string;
  name: string;
  slug: string;
  avatar_url: string | null;
  member_count: number;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function CommunityInsightsCard({
  community,
  timeRange,
  customRange,
}: {
  community: Community;
  timeRange: TimeRange;
  customRange?: DateRange;
}) {
  const { insights, loading, error } = useCommunityInsights(community.id, timeRange, customRange);

  if (loading) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-border-light animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-skeleton" />
          <div className="flex-1">
            <div className="h-5 bg-skeleton rounded w-1/2 mb-2" />
            <div className="h-4 bg-skeleton rounded w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-skeleton rounded-xl" />
          <div className="h-20 bg-skeleton rounded-xl" />
          <div className="h-20 bg-skeleton rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-surface rounded-2xl p-6 border border-border-light">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-primary/5 flex items-center justify-center">
            {community.avatar_url ? (
              <Image
                src={community.avatar_url}
                alt={community.name}
                width={48}
                height={48}
                sizes="48px"
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">{community.name}</h3>
            <p className="font-body text-sm text-muted">Unable to load insights</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <div className="w-12 h-12 rounded-xl bg-purple-primary/5 flex items-center justify-center overflow-hidden">
            {community.avatar_url ? (
              <Image
                src={community.avatar_url}
                alt={community.name}
                width={48}
                height={48}
                sizes="48px"
                className="w-12 h-12 object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-ui text-base sm:text-lg text-ink truncate">{community.name}</h3>
            <p className="font-body text-sm text-muted">
              {formatNumber(insights.memberGrowth.currentCount)} members
            </p>
          </div>
        </div>
        <Link
          href={`/community/${community.slug}`}
          className="flex-shrink-0 font-ui text-xs sm:text-sm text-purple-primary hover:underline whitespace-nowrap"
        >
          View
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.pageViews)}</p>
          <p className="font-body text-xs text-muted">Page Views</p>
        </div>
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.uniqueVisitors)}</p>
          <p className="font-body text-xs text-muted">Unique Visitors</p>
        </div>
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.postsCreated)}</p>
          <p className="font-body text-xs text-muted">Posts Created</p>
        </div>
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.takesCreated)}</p>
          <p className="font-body text-xs text-muted">Takes Created</p>
        </div>
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.totalEngagement)}</p>
          <p className="font-body text-xs text-muted">Interactions</p>
        </div>
        <div className="text-center p-3 bg-subtle rounded-xl">
          <p className={`font-ui text-xl ${
            insights.memberGrowth.netChange > 0
              ? "text-green-500"
              : insights.memberGrowth.netChange < 0
              ? "text-red-500"
              : "text-ink"
          }`}>
            {insights.memberGrowth.netChange > 0 ? "+" : ""}
            {formatNumber(insights.memberGrowth.netChange)}
          </p>
          <p className="font-body text-xs text-muted">Net Growth</p>
        </div>
      </div>

      {/* Member Growth Chart */}
      <GrowthChart
        data={insights.memberGrowth}
        title="Member Growth"
        height={200}
        type="members"
      />

      {insights.memberVisitorMix && insights.pageViews > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-subtle p-3">
            <p className="font-body text-xs text-muted">Member visits</p>
            <p className="font-ui text-lg text-ink">{formatNumber(insights.memberVisitorMix.members)}</p>
          </div>
          <div className="rounded-xl bg-subtle p-3">
            <p className="font-body text-xs text-muted">Discovery visits</p>
            <p className="font-ui text-lg text-ink">{formatNumber(insights.memberVisitorMix.nonMembers)}</p>
          </div>
        </div>
      )}

      {/* Top Contributors */}
      {insights.topContributors.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border-light">
          <h4 className="font-ui text-sm font-medium text-ink mb-4">Top Contributors</h4>
          <div className="space-y-3">
            {insights.topContributors.slice(0, 5).map((contributor, index) => (
              <div key={contributor.userId} className="flex items-center gap-3">
                <span className="font-ui text-sm text-muted w-6">{index + 1}.</span>
                <div className="w-8 h-8 rounded-full bg-purple-primary/10 flex items-center justify-center overflow-hidden">
                  {contributor.avatarUrl ? (
                    <Image
                      src={contributor.avatarUrl}
                      alt={contributor.displayName || contributor.username}
                      width={32}
                      height={32}
                      sizes="32px"
                      className="w-8 h-8 object-cover"
                    />
                  ) : (
                    <span className="font-ui text-xs text-purple-primary">
                      {(contributor.displayName || contributor.username || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm text-ink truncate">{contributor.displayName}</p>
                </div>
                <div className="text-right">
                  <p className="font-ui text-sm text-ink">{contributor.postsCount}</p>
                  <p className="font-body text-xs text-muted">posts</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function InsightsCommunitiesPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchManagedCommunities() {
      if (!user) return;

      try {
        const { data, error } = await supabase
          .from("community_members")
          .select(`
            community:communities (
              id,
              name,
              slug,
              avatar_url,
              member_count
            )
          `)
          .eq("user_id", user.id)
          .in("role", ["admin", "moderator"]);

        if (error) throw error;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const communityList = (data as any[])
          ?.map((item) => {
            // Supabase may return array or single object depending on relationship
            const c = Array.isArray(item.community) ? item.community[0] : item.community;
            return c as Community | null;
          })
          .filter(Boolean) as Community[];

        setCommunities(communityList || []);
      } catch (err) {
        console.error("Error fetching communities:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchManagedCommunities();
  }, [user]);

  const handleTimeRangeChange = (range: TimeRange, custom?: DateRange) => {
    setTimeRange(range);
    setCustomRange(custom);
  };

  if (loading) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Community Insights</h1>
            <p className="font-body text-sm sm:text-base text-muted mt-1">Analytics for communities you manage</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Community Insights</h1>
            <p className="font-body text-sm sm:text-base text-muted mt-1">Analytics for communities you manage</p>
          </div>
        </div>
        <EmptyState
          title="No Communities to Manage"
          description="You don't manage any communities yet. Community insights are available for admins and moderators."
          action={{ label: "Explore Communities", href: "/explore" }}
        />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink">Community Insights</h1>
          <p className="font-body text-sm sm:text-base text-muted mt-1">
            Analytics for {communities.length} {communities.length === 1 ? "community" : "communities"} you manage
          </p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {/* Community Cards */}
      <div className="space-y-6">
        {communities.map((community) => (
          <CommunityInsightsCard
            key={community.id}
            community={community}
            timeRange={timeRange}
            customRange={customRange}
          />
        ))}
      </div>
    </div>
  );
}
