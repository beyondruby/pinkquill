"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useCommunityInsights, TimeRange, DateRange, CommunityInsights } from "@/lib/hooks/useInsights";
import DateRangePicker from "@/components/insights/DateRangePicker";
import MetricCard from "@/components/insights/cards/MetricCard";
import GrowthChart from "@/components/insights/charts/GrowthChart";
import LoadingSkeleton from "@/components/insights/shared/LoadingSkeleton";
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
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04] animate-pulse">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-gray-200" />
          <div className="flex-1">
            <div className="h-5 bg-gray-200 rounded w-1/2 mb-2" />
            <div className="h-4 bg-gray-100 rounded w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-20 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-xl bg-purple-primary/5 flex items-center justify-center">
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt={community.name}
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
    <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-purple-primary/5 flex items-center justify-center overflow-hidden">
            {community.avatar_url ? (
              <img
                src={community.avatar_url}
                alt={community.name}
                className="w-12 h-12 object-cover"
              />
            ) : (
              <svg className="w-6 h-6 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            )}
          </div>
          <div>
            <h3 className="font-ui text-lg text-ink">{community.name}</h3>
            <p className="font-body text-sm text-muted">
              {formatNumber(insights.memberGrowth.currentCount)} members
            </p>
          </div>
        </div>
        <Link
          href={`/community/${community.slug}`}
          className="font-ui text-sm text-purple-primary hover:underline"
        >
          View Community
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.pageViews)}</p>
          <p className="font-body text-xs text-muted">Page Views</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.uniqueVisitors)}</p>
          <p className="font-body text-xs text-muted">Unique Visitors</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl">
          <p className="font-ui text-xl text-ink">{formatNumber(insights.postsCreated)}</p>
          <p className="font-body text-xs text-muted">Posts Created</p>
        </div>
        <div className="text-center p-3 bg-gray-50 rounded-xl">
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

      {/* Top Contributors */}
      {insights.topContributors.length > 0 && (
        <div className="mt-6 pt-6 border-t border-black/[0.04]">
          <h4 className="font-ui text-sm font-medium text-ink mb-4">Top Contributors</h4>
          <div className="space-y-3">
            {insights.topContributors.slice(0, 5).map((contributor, index) => (
              <div key={contributor.userId} className="flex items-center gap-3">
                <span className="font-ui text-sm text-muted w-6">{index + 1}.</span>
                <div className="w-8 h-8 rounded-full bg-purple-primary/10 flex items-center justify-center overflow-hidden">
                  {contributor.avatarUrl ? (
                    <img
                      src={contributor.avatarUrl}
                      alt={contributor.displayName}
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

        const communityList = data
          ?.map((item: any) => item.community)
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Community Insights</h1>
            <p className="font-body text-muted mt-1">Analytics for communities you manage</p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (communities.length === 0) {
    return (
      <div>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl text-ink">Community Insights</h1>
            <p className="font-body text-muted mt-1">Analytics for communities you manage</p>
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-display text-3xl text-ink">Community Insights</h1>
          <p className="font-body text-muted mt-1">
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
