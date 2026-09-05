"use client";

import { useState, useEffect, useMemo } from "react";
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

interface ManagedCommunityRow {
  community: Community | Community[] | null;
}

function normalizeCommunityRelation(
  community: Community | Community[] | null | undefined
): Community | null {
  if (!community) return null;
  const normalized = Array.isArray(community) ? community[0] ?? null : community;
  return normalized ? { ...normalized, member_count: normalized.member_count || 0 } : null;
}

function mergeCommunities(...lists: Community[][]): Community[] {
  const byId = new Map<string, Community>();

  lists.flat().forEach((community) => {
    if (!community?.id) return;
    byId.set(community.id, community);
  });

  return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function CommunityAvatar({
  community,
  size = 40,
}: {
  community: Pick<Community, "name" | "avatar_url">;
  size?: number;
}) {
  if (community.avatar_url) {
    return (
      <Image
        src={community.avatar_url}
        alt={community.name}
        width={size}
        height={size}
        sizes={`${size}px`}
        className="rounded-xl object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-xl bg-purple-primary/10 flex items-center justify-center flex-shrink-0 font-ui font-medium text-purple-primary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.4) }}
    >
      {(community.name || "?").charAt(0).toUpperCase()}
    </div>
  );
}

function MetricTile({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "positive" | "negative";
}) {
  const valueClass =
    tone === "positive"
      ? "text-green-500"
      : tone === "negative"
      ? "text-red-500"
      : "text-ink";
  return (
    <div className="rounded-xl bg-subtle p-3 sm:p-4">
      <p className={`font-display text-xl sm:text-2xl leading-tight ${valueClass}`}>{value}</p>
      <p className="font-body text-xs text-muted mt-1">{label}</p>
    </div>
  );
}

function CommunityDetailPanel({
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
      <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border-light">
        <div className="flex items-center gap-4 mb-6 animate-pulse">
          <div className="w-14 h-14 rounded-xl bg-skeleton" />
          <div className="flex-1">
            <div className="h-5 bg-skeleton rounded w-1/3 mb-2" />
            <div className="h-4 bg-skeleton rounded w-1/4" />
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-skeleton rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-52 bg-skeleton rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border-light">
        <div className="flex items-center gap-4 mb-2">
          <CommunityAvatar community={community} size={56} />
          <div>
            <h3 className="font-display text-xl text-ink">{community.name}</h3>
            <p className="font-body text-sm text-muted">Unable to load insights</p>
          </div>
        </div>
        <p className="font-body text-sm text-muted mt-4">
          {error || "We couldn't fetch insights for this community right now. Try a different range or check back shortly."}
        </p>
      </div>
    );
  }

  const memberMixTotal =
    (insights.memberVisitorMix?.members ?? 0) + (insights.memberVisitorMix?.nonMembers ?? 0);

  return (
    <div className="space-y-6">
      <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border-light">
        <div className="flex items-start justify-between gap-3 mb-6">
          <div className="flex items-center gap-4 min-w-0">
            <CommunityAvatar community={community} size={56} />
            <div className="min-w-0">
              <h3 className="font-display text-xl sm:text-2xl text-ink truncate">{community.name}</h3>
              <p className="font-body text-sm text-muted">
                {formatNumber(insights.memberGrowth.currentCount)} members
                {insights.memberGrowth.netChange !== 0 && (
                  <>
                    {" • "}
                    <span
                      className={
                        insights.memberGrowth.netChange > 0 ? "text-green-500" : "text-red-500"
                      }
                    >
                      {insights.memberGrowth.netChange > 0 ? "+" : ""}
                      {insights.memberGrowth.netChange} this period
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>
          <Link
            href={`/community/${community.slug}`}
            className="flex-shrink-0 px-3 py-1.5 rounded-full bg-subtle hover:bg-purple-primary/10 font-ui text-xs sm:text-sm text-ink hover:text-purple-primary transition-colors"
          >
            Open
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          <MetricTile label="Page Views" value={formatNumber(insights.pageViews)} />
          <MetricTile label="Unique Visitors" value={formatNumber(insights.uniqueVisitors)} />
          <MetricTile label="Posts" value={formatNumber(insights.postsCreated)} />
          <MetricTile label="Takes" value={formatNumber(insights.takesCreated)} />
          <MetricTile label="Interactions" value={formatNumber(insights.totalEngagement)} />
          <MetricTile
            label="Net Growth"
            value={`${insights.memberGrowth.netChange > 0 ? "+" : ""}${formatNumber(insights.memberGrowth.netChange)}`}
            tone={
              insights.memberGrowth.netChange > 0
                ? "positive"
                : insights.memberGrowth.netChange < 0
                ? "negative"
                : "default"
            }
          />
        </div>
      </div>

      <GrowthChart
        data={insights.memberGrowth}
        title="Member Growth"
        height={240}
        type="members"
      />

      {insights.memberVisitorMix && memberMixTotal > 0 && (
        <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border-light">
          <h4 className="font-ui text-sm font-medium text-ink mb-4">Visitor Mix</h4>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4">
            <div className="rounded-xl bg-subtle p-4">
              <p className="font-body text-xs text-muted">Members</p>
              <p className="font-display text-2xl text-ink mt-1">
                {formatNumber(insights.memberVisitorMix.members)}
              </p>
              <p className="font-body text-xs text-muted mt-1">
                {insights.memberVisitorMix.memberPercentage.toFixed(1)}%
              </p>
            </div>
            <div className="rounded-xl bg-subtle p-4">
              <p className="font-body text-xs text-muted">Discovery</p>
              <p className="font-display text-2xl text-ink mt-1">
                {formatNumber(insights.memberVisitorMix.nonMembers)}
              </p>
              <p className="font-body text-xs text-muted mt-1">
                {(100 - insights.memberVisitorMix.memberPercentage).toFixed(1)}%
              </p>
            </div>
          </div>
          <div className="h-2 rounded-full bg-subtle overflow-hidden flex">
            <div
              className="h-full bg-purple-primary"
              style={{ width: `${insights.memberVisitorMix.memberPercentage}%` }}
            />
            <div
              className="h-full bg-pink-vivid"
              style={{ width: `${100 - insights.memberVisitorMix.memberPercentage}%` }}
            />
          </div>
        </div>
      )}

      {insights.topContributors.length > 0 && (
        <div className="bg-surface rounded-2xl p-5 sm:p-6 border border-border-light">
          <h4 className="font-ui text-sm font-medium text-ink mb-4">Top Contributors</h4>
          <div className="space-y-3">
            {insights.topContributors.slice(0, 5).map((contributor, index) => (
              <div key={contributor.userId} className="flex items-center gap-3">
                <span className="font-ui text-sm text-muted w-5 text-right">{index + 1}</span>
                <div className="w-9 h-9 rounded-full bg-purple-primary/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {contributor.avatarUrl ? (
                    <Image
                      src={contributor.avatarUrl}
                      alt={contributor.displayName || contributor.username}
                      width={36}
                      height={36}
                      sizes="36px"
                      className="w-9 h-9 object-cover"
                    />
                  ) : (
                    <span className="font-ui text-xs text-purple-primary">
                      {(contributor.displayName || contributor.username || "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-ui text-sm text-ink truncate">
                    {contributor.displayName || contributor.username || "Unknown"}
                  </p>
                  {contributor.username && (
                    <p className="font-body text-xs text-muted truncate">@{contributor.username}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-ui text-sm text-ink">
                    {contributor.postsCount + contributor.takesCount}
                  </p>
                  <p className="font-body text-xs text-muted">contributions</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CommunitySelectorRail({
  communities,
  selectedId,
  onSelect,
}: {
  communities: Community[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <aside className="hidden lg:block w-72 flex-shrink-0">
      <div className="sticky top-[calc(var(--pq-topbar)+1rem)] space-y-1">
        <p className="font-ui text-xs font-medium text-muted px-3 mb-2">
          Your communities
        </p>
        {communities.map((community) => {
          const isActive = community.id === selectedId;
          return (
            <button
              key={community.id}
              type="button"
              onClick={() => onSelect(community.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                isActive ? "bg-subtle" : "hover:bg-subtle/60"
              }`}
            >
              <CommunityAvatar community={community} size={40} />
              <div className="flex-1 min-w-0">
                <p
                  className={`font-ui text-sm truncate ${
                    isActive ? "text-purple-primary font-medium" : "text-ink"
                  }`}
                >
                  {community.name}
                </p>
                <p className="font-body text-xs text-muted truncate">
                  {formatNumber(community.member_count)}{" "}
                  {community.member_count === 1 ? "member" : "members"}
                </p>
              </div>
              {isActive && (
                <span className="w-1.5 h-6 rounded-full bg-gradient-to-b from-purple-primary to-pink-vivid flex-shrink-0" />
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CommunitySelectorPills({
  communities,
  selectedId,
  onSelect,
}: {
  communities: Community[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="lg:hidden -mx-4 px-4 mb-4 overflow-x-auto scrollbar-hide">
      <div className="flex gap-2 min-w-max">
        {communities.map((community) => {
          const isActive = community.id === selectedId;
          return (
            <button
              key={community.id}
              type="button"
              onClick={() => onSelect(community.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md shadow-purple-primary/20"
                  : "bg-subtle text-ink hover:bg-subtle/80"
              }`}
            >
              <CommunityAvatar community={community} size={24} />
              <span className="font-ui text-sm font-medium">{community.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function InsightsCommunitiesPage() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  const [customRange, setCustomRange] = useState<DateRange | undefined>();
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchManagedCommunities() {
      if (!user?.id) {
        setCommunities([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);
      try {
        const [membershipResult, ownedResult] = await Promise.all([
          supabase
            .from("community_members")
            .select(`
              community:communities!community_members_community_id_fkey (
                id,
                name,
                slug,
                avatar_url
              )
            `)
            .eq("user_id", user.id)
            .eq("status", "active")
            .in("role", ["admin", "moderator"]),
          supabase
            .from("communities")
            .select("id, name, slug, avatar_url")
            .eq("created_by", user.id),
        ]);

        if (membershipResult.error && ownedResult.error) {
          throw membershipResult.error;
        }

        if (membershipResult.error) {
          console.warn("Unable to load managed community memberships:", membershipResult.error.message);
        }

        if (ownedResult.error) {
          console.warn("Unable to load owned communities:", ownedResult.error.message);
        }

        const memberCommunities = ((membershipResult.data || []) as ManagedCommunityRow[])
          .map((item) => normalizeCommunityRelation(item.community))
          .filter((community): community is Community => Boolean(community));

        const ownedCommunities = ((ownedResult.data || []) as Community[]).map((community) => ({
          ...community,
          member_count: community.member_count || 0,
        }));

        const merged = mergeCommunities(memberCommunities, ownedCommunities);

        if (merged.length > 0) {
          const ids = merged.map((c) => c.id);
          const { data: counts } = await supabase
            .from("community_members")
            .select("community_id")
            .in("community_id", ids)
            .eq("status", "active");

          if (counts) {
            const tally = new Map<string, number>();
            counts.forEach((row) => {
              tally.set(row.community_id, (tally.get(row.community_id) || 0) + 1);
            });
            merged.forEach((c) => {
              c.member_count = tally.get(c.id) || 0;
            });
          }
        }

        setCommunities(merged);
        setSelectedId((prev) => (prev && merged.some((c) => c.id === prev) ? prev : merged[0]?.id || ""));
      } catch (err) {
        console.error("Error fetching communities:", err);
        setLoadError("We could not load your managed communities. Please try again shortly.");
        setCommunities([]);
      } finally {
        setLoading(false);
      }
    }

    fetchManagedCommunities();
  }, [user]);

  const selectedCommunity = useMemo(
    () => communities.find((c) => c.id === selectedId) || communities[0],
    [communities, selectedId]
  );

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
            <p className="font-body text-sm sm:text-base text-muted mt-1">
              Analytics for communities you manage
            </p>
          </div>
        </div>
        <LoadingSkeleton />
      </div>
    );
  }

  if (communities.length === 0 || !selectedCommunity) {
    return (
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-display text-2xl sm:text-3xl text-ink">Community Insights</h1>
            <p className="font-body text-sm sm:text-base text-muted mt-1">
              Analytics for communities you manage
            </p>
          </div>
        </div>
        <EmptyState
          title={loadError ? "Unable to Load Communities" : "No Managed Communities Found"}
          description={
            loadError ||
            "Community insights appear for communities you created, administer, or moderate."
          }
          action={{ label: "Explore Communities", href: "/explore" }}
        />
      </div>
    );
  }

  const showSelector = communities.length > 1;

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl text-ink">Community Insights</h1>
          <p className="font-body text-sm sm:text-base text-muted mt-1">
            {showSelector
              ? `Analytics across ${communities.length} communities you manage`
              : "Analytics for the community you manage"}
          </p>
        </div>
        <DateRangePicker
          value={timeRange}
          customRange={customRange}
          onChange={handleTimeRangeChange}
        />
      </div>

      {showSelector && (
        <CommunitySelectorPills
          communities={communities}
          selectedId={selectedCommunity.id}
          onSelect={setSelectedId}
        />
      )}

      <div className="flex gap-6">
        {showSelector && (
          <CommunitySelectorRail
            communities={communities}
            selectedId={selectedCommunity.id}
            onSelect={setSelectedId}
          />
        )}
        <div className="flex-1 min-w-0">
          <CommunityDetailPanel
            key={selectedCommunity.id}
            community={selectedCommunity}
            timeRange={timeRange}
            customRange={customRange}
          />
        </div>
      </div>
    </div>
  );
}
