"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

// ============================================================================
// TYPES
// ============================================================================

export type TimeRange = "7d" | "30d" | "90d" | "1y" | "all" | "custom";

export interface DateRange {
  start: Date;
  end: Date;
}

export interface TrafficSource {
  source: string;
  count: number;
  percentage: number;
}

export interface ViewerDemographics {
  followers: number;
  nonFollowers: number;
  followerPercentage: number;
}

export interface DailyStats {
  date: string;
  views: number;
  impressions: number;
  reactions: number;
  comments: number;
}

export interface ReactionBreakdown {
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
}

export interface TopContentItem {
  id: string;
  type: "post" | "take";
  title?: string;
  thumbnail?: string;
  postType?: string;
  views: number;
  engagement: number;
  engagementRate: number;
  createdAt: string;
}

export interface FollowerGrowthData {
  currentCount: number;
  netChange: number;
  gained: number;
  lost: number;
  percentageChange: number;
  history: { date: string; count: number; netChange: number }[];
}

export interface MemberGrowthData {
  currentCount: number;
  netChange: number;
  joined: number;
  left: number;
  percentageChange: number;
  history: { date: string; count: number; netChange: number }[];
}

export interface ContributorData {
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  postsCount: number;
  takesCount: number;
  reactionsReceived: number;
  commentsReceived: number;
}

// ============================================================================
// DASHBOARD SUMMARY
// ============================================================================

export interface InsightsSummary {
  totalViews: number;
  totalImpressions: number;
  totalReach: number;
  engagementRate: number;
  totalEngagement: number;
  engagementBreakdown: {
    reactions: number;
    comments: number;
    relays: number;
    saves: number;
  };
  followerGrowth: FollowerGrowthData;
  topContent: TopContentItem[];
  viewsByDay: DailyStats[];
  trafficSources: TrafficSource[];
  previousPeriod: {
    views: number;
    impressions: number;
    reach: number;
  };
  contentCount: {
    posts: number;
    takes: number;
    total: number;
  };
}

export function useInsightsDashboard(
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<InsightsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate, prevStartDate, prevEndDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      const rpcInsights = await getCreatorInsightsSummaryFromRpc(
        user.id,
        startDate,
        endDate,
        prevStartDate,
        prevEndDate
      );

      if (rpcInsights) {
        setInsights(rpcInsights);
        setLoading(false);
        return;
      }

      // Get user's posts and takes IDs
      const [postsResult, takesResult] = await Promise.all([
        supabase.from("posts").select("id").eq("author_id", user.id),
        supabase.from("takes").select("id").eq("author_id", user.id),
      ]);

      const postIds = (postsResult.data || []).map((p) => p.id);
      const takeIds = (takesResult.data || []).map((t) => t.id);

      if (postIds.length === 0 && takeIds.length === 0) {
        setInsights({
          totalViews: 0,
          totalImpressions: 0,
          totalReach: 0,
          engagementRate: 0,
          totalEngagement: 0,
          engagementBreakdown: {
            reactions: 0,
            comments: 0,
            relays: 0,
            saves: 0,
          },
          followerGrowth: {
            currentCount: 0,
            netChange: 0,
            gained: 0,
            lost: 0,
            percentageChange: 0,
            history: [],
          },
          topContent: [],
          viewsByDay: [],
          trafficSources: [],
          previousPeriod: { views: 0, impressions: 0, reach: 0 },
          contentCount: { posts: 0, takes: 0, total: 0 },
        });
        setLoading(false);
        return;
      }

      // Fetch all metrics in parallel
      const [
        postViewsResult,
        postImpressionsResult,
        takeViewsResult,
        takeImpressionsResult,
        followerHistoryResult,
        followerCountResult,
        prevPostViewsResult,
        prevTakeViewsResult,
      ] = await Promise.all([
        // Current period
        postIds.length > 0
          ? supabase
              .from("post_views")
              .select("viewer_id, session_id, view_date, source")
              .in("post_id", postIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("post_impressions")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_views")
              .select("viewer_id, session_id, view_date, source")
              .in("take_id", takeIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_impressions")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        supabase
          .from("follower_history")
          .select("date, net_change, gained, lost, follower_count")
          .eq("profile_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("follows")
          .select("id", { count: "exact", head: true })
          .eq("following_id", user.id)
          .eq("status", "accepted"),
        // Previous period for comparison
        postIds.length > 0
          ? supabase
              .from("post_views")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("view_date", prevStartDate)
              .lte("view_date", prevEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_views")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("view_date", prevStartDate)
              .lte("view_date", prevEndDate)
          : { count: 0 },
      ]);

      const postViews = postViewsResult.data || [];
      const takeViews = takeViewsResult.data || [];
      const followerHistory = followerHistoryResult.data || [];

      // Calculate totals
      const totalViews = postViews.length + takeViews.length;
      const totalImpressions =
        (postImpressionsResult.count || 0) + (takeImpressionsResult.count || 0);

      // Calculate unique viewers (reach)
      const uniqueViewers = new Set([
        ...postViews.map((v) => v.viewer_id || v.session_id),
        ...takeViews.map((v) => v.viewer_id || v.session_id),
      ]);
      const totalReach = uniqueViewers.size;

      // Get engagement data. The aggregate RPC above is the preferred path; this
      // fallback still includes posts, takes, reactions, saves, comments, and relays.
      const [
        postReactionResult,
        admireResult,
        commentResult,
        relayResult,
        saveResult,
        takeReactionResult,
        takeCommentResult,
        takeRelayResult,
        takeSaveResult,
      ] = await Promise.all([
        postIds.length > 0
          ? supabase
              .from("reactions")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        postIds.length > 0
          ? supabase
              .from("admires")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        postIds.length > 0
          ? supabase
              .from("comments")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        postIds.length > 0
          ? supabase
              .from("relays")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        postIds.length > 0
          ? supabase
              .from("saves")
              .select("id", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_reactions")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_comments")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_relays")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_saves")
              .select("id", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { count: 0 },
      ]);

      const engagementBreakdown = {
        reactions:
          (postReactionResult.count || 0) +
          (admireResult.count || 0) +
          (takeReactionResult.count || 0),
        comments: (commentResult.count || 0) + (takeCommentResult.count || 0),
        relays: (relayResult.count || 0) + (takeRelayResult.count || 0),
        saves: (saveResult.count || 0) + (takeSaveResult.count || 0),
      };
      const totalEngagement =
        engagementBreakdown.reactions +
        engagementBreakdown.comments +
        engagementBreakdown.relays +
        engagementBreakdown.saves;
      const engagementRate =
        totalReach > 0 ? (totalEngagement / totalReach) * 100 : 0;

      // Process follower growth
      const followerGrowth: FollowerGrowthData = {
        currentCount: followerCountResult.count || 0,
        netChange: followerHistory.reduce(
          (sum, h) => sum + (h.net_change || 0),
          0
        ),
        gained: followerHistory.reduce((sum, h) => sum + (h.gained || 0), 0),
        lost: followerHistory.reduce((sum, h) => sum + (h.lost || 0), 0),
        percentageChange: 0,
        history: followerHistory.map((h) => ({
          date: h.date,
          count: h.follower_count || 0,
          netChange: h.net_change || 0,
        })),
      };

      // Calculate views by day
      const viewsByDayMap = new Map<string, DailyStats>();
      [...postViews, ...takeViews].forEach((v) => {
        const date = v.view_date;
        const existing = viewsByDayMap.get(date) || {
          date,
          views: 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
        };
        existing.views += 1;
        viewsByDayMap.set(date, existing);
      });
      const viewsByDay = Array.from(viewsByDayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate traffic sources
      const sourceMap = new Map<string, number>();
      [...postViews, ...takeViews].forEach((v) => {
        const source = v.source || "direct";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });
      const trafficSources: TrafficSource[] = Array.from(
        sourceMap.entries()
      ).map(([source, count]) => ({
        source,
        count,
        percentage: totalViews > 0 ? (count / totalViews) * 100 : 0,
      }));

      // Get top content
      const topContent = await getTopContent(
        user.id,
        postIds,
        takeIds,
        startDate,
        endDate
      );

      setInsights({
        totalViews,
        totalImpressions,
        totalReach,
        engagementRate,
        totalEngagement,
        engagementBreakdown,
        followerGrowth,
        topContent,
        viewsByDay,
        trafficSources,
        previousPeriod: {
          views: (prevPostViewsResult.count || 0) + (prevTakeViewsResult.count || 0),
          impressions: 0,
          reach: 0,
        },
        contentCount: {
          posts: postIds.length,
          takes: takeIds.length,
          total: postIds.length + takeIds.length,
        },
      });
    } catch (err) {
      console.error("Error fetching insights:", err);
      setError("Failed to load insights");
    }

    setLoading(false);
  }, [user?.id, startDate, endDate, prevStartDate, prevEndDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { insights, loading, error, refetch: fetchInsights };
}

// ============================================================================
// POST INSIGHTS
// ============================================================================

export interface PostInsights {
  postId: string;
  views: number;
  impressions: number;
  reach: number;
  avgReadTime: number;
  engagementRate: number;
  reactions: ReactionBreakdown;
  comments: number;
  relays: number;
  saves: number;
  trafficSources: TrafficSource[];
  demographics: ViewerDemographics;
  viewsByDay: DailyStats[];
}

interface PostData {
  id: string;
  title?: string;
  type?: string;
  createdAt: string;
}

export function usePostInsights(
  postId: string,
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<PostInsights | null>(null);
  const [post, setPost] = useState<PostData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchInsights = useCallback(async () => {
    if (!user?.id || !postId) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      // Verify ownership and get post details
      const { data: postData } = await supabase
        .from("posts")
        .select("id, author_id, title, type, created_at")
        .eq("id", postId)
        .single();

      if (!postData || postData.author_id !== user.id) {
        setError("Post not found or access denied");
        setLoading(false);
        return;
      }

      setPost({
        id: postData.id,
        title: postData.title,
        type: postData.type,
        createdAt: postData.created_at,
      });

      // Fetch all metrics
      const [viewsResult, impressionsResult, reactionsResult, commentsResult, relaysResult, savesResult] =
        await Promise.all([
          supabase
            .from("post_views")
            .select(
              "viewer_id, session_id, view_date, read_time_seconds, is_follower, source"
            )
            .eq("post_id", postId)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("post_impressions")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("reactions")
            .select("reaction_type")
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("comments")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("relays")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("saves")
            .select("id", { count: "exact", head: true })
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
        ]);

      const views = viewsResult.data || [];
      const reactions = reactionsResult.data || [];

      // Calculate totals
      const totalViews = views.length;
      const totalImpressions = impressionsResult.count || 0;

      // Unique viewers
      const uniqueViewers = new Set(views.map((v) => v.viewer_id || v.session_id));
      const reach = uniqueViewers.size;

      // Average read time
      const readTimes = views.filter((v) => v.read_time_seconds > 0).map((v) => v.read_time_seconds);
      const avgReadTime = readTimes.length > 0 ? readTimes.reduce((a, b) => a + b, 0) / readTimes.length : 0;

      // Reactions breakdown
      const reactionBreakdown: ReactionBreakdown = {
        admire: reactions.filter((r) => r.reaction_type === "admire").length,
        snap: reactions.filter((r) => r.reaction_type === "snap").length,
        ovation: reactions.filter((r) => r.reaction_type === "ovation").length,
        support: reactions.filter((r) => r.reaction_type === "support").length,
        inspired: reactions.filter((r) => r.reaction_type === "inspired").length,
        applaud: reactions.filter((r) => r.reaction_type === "applaud").length,
        total: reactions.length,
      };

      const totalEngagement = reactionBreakdown.total + (commentsResult.count || 0) + (relaysResult.count || 0);
      const engagementRate = reach > 0 ? (totalEngagement / reach) * 100 : 0;

      // Demographics
      const followerViews = views.filter((v) => v.is_follower).length;
      const demographics: ViewerDemographics = {
        followers: followerViews,
        nonFollowers: totalViews - followerViews,
        followerPercentage: totalViews > 0 ? (followerViews / totalViews) * 100 : 0,
      };

      // Traffic sources
      const sourceMap = new Map<string, number>();
      views.forEach((v) => {
        const source = v.source || "direct";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });
      const trafficSources: TrafficSource[] = Array.from(sourceMap.entries()).map(
        ([source, count]) => ({
          source,
          count,
          percentage: totalViews > 0 ? (count / totalViews) * 100 : 0,
        })
      );

      // Views by day
      const viewsByDayMap = new Map<string, DailyStats>();
      views.forEach((v) => {
        const date = v.view_date;
        const existing = viewsByDayMap.get(date) || {
          date,
          views: 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
        };
        existing.views += 1;
        viewsByDayMap.set(date, existing);
      });
      const viewsByDay = Array.from(viewsByDayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setInsights({
        postId,
        views: totalViews,
        impressions: totalImpressions,
        reach,
        avgReadTime,
        engagementRate,
        reactions: reactionBreakdown,
        comments: commentsResult.count || 0,
        relays: relaysResult.count || 0,
        saves: savesResult.count || 0,
        trafficSources,
        demographics,
        viewsByDay,
      });
    } catch (err) {
      console.error("Error fetching post insights:", err);
      setError("Failed to load post insights");
    }

    setLoading(false);
  }, [user?.id, postId, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { insights, post, loading, error, refetch: fetchInsights };
}

// ============================================================================
// TAKE INSIGHTS
// ============================================================================

export interface TakeInsights extends Omit<PostInsights, "avgReadTime"> {
  takeId: string;
  avgWatchTime: number;
  totalWatchTime: number;
  completionRate: number;
  avgLoopCount: number;
}

interface TakeData {
  id: string;
  title?: string;
  createdAt: string;
}

export function useTakeInsights(
  takeId: string,
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<TakeInsights | null>(null);
  const [take, setTake] = useState<TakeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchInsights = useCallback(async () => {
    if (!user?.id || !takeId) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      // Verify ownership and get take details
      const { data: takeData } = await supabase
        .from("takes")
        .select("id, author_id, caption, created_at")
        .eq("id", takeId)
        .single();

      if (!takeData || takeData.author_id !== user.id) {
        setError("Take not found or access denied");
        setLoading(false);
        return;
      }

      setTake({
        id: takeData.id,
        title: takeData.caption,
        createdAt: takeData.created_at,
      });

      // Fetch all metrics
      const [viewsResult, impressionsResult, reactionsResult, commentsResult, relaysResult, savesResult] =
        await Promise.all([
          supabase
            .from("take_views")
            .select(
              "viewer_id, session_id, view_date, watch_time_seconds, completed, loop_count, is_follower, source"
            )
            .eq("take_id", takeId)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("take_impressions")
            .select("id", { count: "exact", head: true })
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("take_reactions")
            .select("reaction_type")
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("take_comments")
            .select("id", { count: "exact", head: true })
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("take_relays")
            .select("id", { count: "exact", head: true })
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
          supabase
            .from("take_saves")
            .select("id", { count: "exact", head: true })
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lt("created_at", exclusiveEndDate),
        ]);

      const views = viewsResult.data || [];
      const reactions = reactionsResult.data || [];

      // Calculate totals
      const totalViews = views.length;
      const totalImpressions = impressionsResult.count || 0;

      // Unique viewers
      const uniqueViewers = new Set(views.map((v) => v.viewer_id || v.session_id));
      const reach = uniqueViewers.size;

      // Watch time metrics
      const watchTimes = views.filter((v) => v.watch_time_seconds > 0).map((v) => v.watch_time_seconds);
      const avgWatchTime = watchTimes.length > 0 ? watchTimes.reduce((a, b) => a + b, 0) / watchTimes.length : 0;
      const totalWatchTime = watchTimes.reduce((a, b) => a + b, 0);

      // Completion rate
      const completedViews = views.filter((v) => v.completed).length;
      const completionRate = totalViews > 0 ? (completedViews / totalViews) * 100 : 0;

      // Loop count
      const loopCounts = views.filter((v) => v.loop_count > 0).map((v) => v.loop_count);
      const avgLoopCount = loopCounts.length > 0 ? loopCounts.reduce((a, b) => a + b, 0) / loopCounts.length : 1;

      // Reactions breakdown
      const reactionBreakdown: ReactionBreakdown = {
        admire: reactions.filter((r) => r.reaction_type === "admire").length,
        snap: reactions.filter((r) => r.reaction_type === "snap").length,
        ovation: reactions.filter((r) => r.reaction_type === "ovation").length,
        support: reactions.filter((r) => r.reaction_type === "support").length,
        inspired: reactions.filter((r) => r.reaction_type === "inspired").length,
        applaud: reactions.filter((r) => r.reaction_type === "applaud").length,
        total: reactions.length,
      };

      const totalEngagement = reactionBreakdown.total + (commentsResult.count || 0) + (relaysResult.count || 0);
      const engagementRate = reach > 0 ? (totalEngagement / reach) * 100 : 0;

      // Demographics
      const followerViews = views.filter((v) => v.is_follower).length;
      const demographics: ViewerDemographics = {
        followers: followerViews,
        nonFollowers: totalViews - followerViews,
        followerPercentage: totalViews > 0 ? (followerViews / totalViews) * 100 : 0,
      };

      // Traffic sources
      const sourceMap = new Map<string, number>();
      views.forEach((v) => {
        const source = v.source || "direct";
        sourceMap.set(source, (sourceMap.get(source) || 0) + 1);
      });
      const trafficSources: TrafficSource[] = Array.from(sourceMap.entries()).map(
        ([source, count]) => ({
          source,
          count,
          percentage: totalViews > 0 ? (count / totalViews) * 100 : 0,
        })
      );

      // Views by day
      const viewsByDayMap = new Map<string, DailyStats>();
      views.forEach((v) => {
        const date = v.view_date;
        const existing = viewsByDayMap.get(date) || {
          date,
          views: 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
        };
        existing.views += 1;
        viewsByDayMap.set(date, existing);
      });
      const viewsByDay = Array.from(viewsByDayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      setInsights({
        takeId,
        postId: takeId,
        views: totalViews,
        impressions: totalImpressions,
        reach,
        avgWatchTime,
        totalWatchTime,
        completionRate,
        avgLoopCount,
        engagementRate,
        reactions: reactionBreakdown,
        comments: commentsResult.count || 0,
        relays: relaysResult.count || 0,
        saves: savesResult.count || 0,
        trafficSources,
        demographics,
        viewsByDay,
      });
    } catch (err) {
      console.error("Error fetching take insights:", err);
      setError("Failed to load take insights");
    }

    setLoading(false);
  }, [user?.id, takeId, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { insights, take, loading, error, refetch: fetchInsights };
}

// ============================================================================
// PROFILE INSIGHTS
// ============================================================================

export interface AudienceLocationItem {
  location: string;
  count: number;
  percentage: number;
}

export interface AudienceBreakdown {
  totalFollowers: number;
  verifiedFollowers: number;
  followerCountries: AudienceLocationItem[];
  followerCities: AudienceLocationItem[];
  viewerCountries: AudienceLocationItem[];
  viewerCities: AudienceLocationItem[];
  locatedFollowers: number;
  locatedViewers: number;
  totalViewers: number;
  viewerMix: {
    followers: number;
    nonFollowers: number;
    followerPercentage: number;
  };
}

export interface ProfileInsights {
  profileViews: number;
  uniqueViewers: number;
  contentReach: number;
  contentImpressions: number;
  totalReactions: number;
  totalComments: number;
  totalSaves: number;
  followerGrowth: FollowerGrowthData;
  audience: AudienceBreakdown;
  topContent: TopContentItem[];
  viewsByDay: DailyStats[];
  bestPostingTimes: number[][];
}

export function useProfileInsights(
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<ProfileInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      // Fetch profile views
      const [
        profileViewsResult,
        followerHistoryResult,
        followerCountResult,
        audienceBreakdownResult,
      ] = await Promise.all([
          supabase
            .from("profile_views")
            .select("viewer_id, session_id, view_date")
            .eq("profile_id", user.id)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("follower_history")
            .select("date, net_change, gained, lost, follower_count")
            .eq("profile_id", user.id)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true }),
          supabase
            .from("follows")
            .select("id", { count: "exact", head: true })
            .eq("following_id", user.id)
            .eq("status", "accepted"),
          supabase.rpc("get_audience_breakdown", {
            p_profile_id: user.id,
            p_start_date: startDate,
            p_end_date: endDate,
            p_limit: 5,
          }),
        ]);

      const profileViews = profileViewsResult.data || [];
      const followerHistory = followerHistoryResult.data || [];

      // Get user's content
      const [postsResult, takesResult] = await Promise.all([
        supabase.from("posts").select("id").eq("author_id", user.id),
        supabase.from("takes").select("id").eq("author_id", user.id),
      ]);

      const postIds = (postsResult.data || []).map((p) => p.id);
      const takeIds = (takesResult.data || []).map((t) => t.id);

      // Fetch content metrics
      const [
        postViewsResult,
        takeViewsResult,
        postImpressionsResult,
        takeImpressionsResult,
        postReactionsResult,
        admireResult,
        commentResult,
        saveResult,
        takeReactionsResult,
        takeCommentsResult,
        takeSavesResult,
      ] = await Promise.all([
          postIds.length > 0
            ? supabase
                .from("post_views")
                .select("viewer_id, session_id")
                .in("post_id", postIds)
                .gte("view_date", startDate)
                .lte("view_date", endDate)
            : { data: [] },
          takeIds.length > 0
            ? supabase
                .from("take_views")
                .select("viewer_id, session_id")
                .in("take_id", takeIds)
                .gte("view_date", startDate)
                .lte("view_date", endDate)
            : { data: [] },
          postIds.length > 0
            ? supabase
                .from("post_impressions")
                .select("id", { count: "exact", head: true })
                .in("post_id", postIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          takeIds.length > 0
            ? supabase
                .from("take_impressions")
                .select("id", { count: "exact", head: true })
                .in("take_id", takeIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          postIds.length > 0
            ? supabase
                .from("reactions")
                .select("id", { count: "exact", head: true })
                .in("post_id", postIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          postIds.length > 0
            ? supabase
                .from("admires")
                .select("id", { count: "exact", head: true })
                .in("post_id", postIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          postIds.length > 0
            ? supabase
                .from("comments")
                .select("id", { count: "exact", head: true })
                .in("post_id", postIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          postIds.length > 0
            ? supabase
                .from("saves")
                .select("id", { count: "exact", head: true })
                .in("post_id", postIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          takeIds.length > 0
            ? supabase
                .from("take_reactions")
                .select("id", { count: "exact", head: true })
                .in("take_id", takeIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          takeIds.length > 0
            ? supabase
                .from("take_comments")
                .select("id", { count: "exact", head: true })
                .in("take_id", takeIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
          takeIds.length > 0
            ? supabase
                .from("take_saves")
                .select("id", { count: "exact", head: true })
                .in("take_id", takeIds)
                .gte("created_at", startDate)
                .lt("created_at", exclusiveEndDate)
            : { count: 0 },
        ]);

      const postViews = postViewsResult.data || [];
      const takeViews = takeViewsResult.data || [];

      // Unique viewers
      const uniqueProfileViewers = new Set(
        profileViews.map((v) => v.viewer_id || v.session_id)
      );
      const uniqueContentViewers = new Set([
        ...postViews.map((v) => v.viewer_id || v.session_id),
        ...takeViews.map((v) => v.viewer_id || v.session_id),
      ]);

      // Follower growth
      const followerGrowth: FollowerGrowthData = {
        currentCount: followerCountResult.count || 0,
        netChange: followerHistory.reduce(
          (sum, h) => sum + (h.net_change || 0),
          0
        ),
        gained: followerHistory.reduce((sum, h) => sum + (h.gained || 0), 0),
        lost: followerHistory.reduce((sum, h) => sum + (h.lost || 0), 0),
        percentageChange: 0,
        history: followerHistory.map((h) => ({
          date: h.date,
          count: h.follower_count || 0,
          netChange: h.net_change || 0,
        })),
      };

      // Views by day
      const viewsByDayMap = new Map<string, DailyStats>();
      profileViews.forEach((v) => {
        const date = v.view_date;
        const existing = viewsByDayMap.get(date) || {
          date,
          views: 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
        };
        existing.views += 1;
        viewsByDayMap.set(date, existing);
      });
      const viewsByDay = Array.from(viewsByDayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Top content
      const topContent = await getTopContent(
        user.id,
        postIds,
        takeIds,
        startDate,
        endDate
      );

      const audienceRaw = (audienceBreakdownResult.data ?? {}) as Partial<{
        totalFollowers: number;
        verifiedFollowers: number;
        followerCountries: AudienceLocationItem[];
        followerCities: AudienceLocationItem[];
        viewerCountries: AudienceLocationItem[];
        viewerCities: AudienceLocationItem[];
        locatedFollowers: number;
        locatedViewers: number;
        totalViewers: number;
        viewerMix: {
          followers: number;
          nonFollowers: number;
          followerPercentage: number;
        };
      }>;
      const audience: AudienceBreakdown = {
        totalFollowers: audienceRaw.totalFollowers ?? followerGrowth.currentCount,
        verifiedFollowers: audienceRaw.verifiedFollowers ?? 0,
        followerCountries: audienceRaw.followerCountries ?? [],
        followerCities: audienceRaw.followerCities ?? [],
        viewerCountries: audienceRaw.viewerCountries ?? [],
        viewerCities: audienceRaw.viewerCities ?? [],
        locatedFollowers: audienceRaw.locatedFollowers ?? 0,
        locatedViewers: audienceRaw.locatedViewers ?? 0,
        totalViewers: audienceRaw.totalViewers ?? 0,
        viewerMix: audienceRaw.viewerMix ?? {
          followers: 0,
          nonFollowers: 0,
          followerPercentage: 0,
        },
      };

      setInsights({
        profileViews: profileViews.length,
        uniqueViewers: uniqueProfileViewers.size,
        contentReach: uniqueContentViewers.size,
        contentImpressions: (postImpressionsResult.count || 0) + (takeImpressionsResult.count || 0),
        totalReactions:
          (postReactionsResult.count || 0) +
          (admireResult.count || 0) +
          (takeReactionsResult.count || 0),
        totalComments: (commentResult.count || 0) + (takeCommentsResult.count || 0),
        totalSaves: (saveResult.count || 0) + (takeSavesResult.count || 0),
        followerGrowth,
        audience,
        topContent,
        viewsByDay,
        bestPostingTimes: [], // TODO: Calculate from engagement data
      });
    } catch (err) {
      console.error("Error fetching profile insights:", err);
      setError("Failed to load profile insights");
    }

    setLoading(false);
  }, [user?.id, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { insights, loading, error, refetch: fetchInsights };
}

// ============================================================================
// COMMUNITY INSIGHTS
// ============================================================================

export interface CommunityInsights {
  communityId: string;
  pageViews: number;
  uniqueVisitors: number;
  memberGrowth: MemberGrowthData;
  postsCreated: number;
  takesCreated: number;
  totalEngagement: number;
  memberVisitorMix?: {
    members: number;
    nonMembers: number;
    memberPercentage: number;
  };
  topContributors: ContributorData[];
  viewsByDay: DailyStats[];
}

export function useCommunityInsights(
  communityId: string,
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<CommunityInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchInsights = useCallback(async () => {
    if (!user?.id || !communityId) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      const rpcInsights = await getCommunityInsightsSummaryFromRpc(
        communityId,
        startDate,
        endDate
      );

      if (rpcInsights) {
        setInsights(rpcInsights);
        setLoading(false);
        return;
      }

      // Verify creator/admin/mod access. Creator ownership is the source of
      // truth when the creator's community_members row is missing or hidden.
      const [membershipResult, communityResult] = await Promise.all([
        supabase
          .from("community_members")
          .select("role, status")
          .eq("community_id", communityId)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("communities")
          .select("created_by")
          .eq("id", communityId)
          .maybeSingle(),
      ]);

      const membership = membershipResult.data;
      const community = communityResult.data;
      const isOwner = community?.created_by === user.id;
      const isStaff =
        membership?.status === "active" &&
        ["admin", "moderator"].includes(membership.role || "");

      if (!isOwner && !isStaff) {
        setError("Access denied");
        setLoading(false);
        return;
      }

      // Fetch metrics
      const [
        viewsResult,
        memberHistoryResult,
        memberCountResult,
        postsResult,
        takesResult,
      ] = await Promise.all([
        supabase
          .from("community_views")
          .select("viewer_id, session_id, view_date, is_member")
          .eq("community_id", communityId)
          .gte("view_date", startDate)
          .lte("view_date", endDate),
        supabase
          .from("community_member_history")
          .select("date, joined, left, member_count")
          .eq("community_id", communityId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("community_members")
          .select("id", { count: "exact", head: true })
          .eq("community_id", communityId)
          .eq("status", "active"),
        supabase
          .from("posts")
          .select("id, author_id")
          .eq("community_id", communityId)
          .gte("created_at", startDate)
          .lt("created_at", exclusiveEndDate),
        supabase
          .from("takes")
          .select("id, author_id")
          .eq("community_id", communityId)
          .gte("created_at", startDate)
          .lt("created_at", exclusiveEndDate),
      ]);

      const views = viewsResult.data || [];
      const memberHistory = memberHistoryResult.data || [];
      const posts = postsResult.data || [];
      const takes = takesResult.data || [];
      const postIds = posts.map((post) => post.id);
      const takeIds = takes.map((take) => take.id);
      const postAuthorById = new Map(posts.map((post) => [post.id, post.author_id]));
      const takeAuthorById = new Map(takes.map((take) => [take.id, take.author_id]));

      // Unique visitors
      const uniqueVisitors = new Set(
        views.map((v) => v.viewer_id || v.session_id)
      );

      // Member growth
      const memberGrowth: MemberGrowthData = {
        currentCount: memberCountResult.count || 0,
        netChange: memberHistory.reduce(
          (sum, h) => sum + ((h.joined || 0) - (h.left || 0)),
          0
        ),
        joined: memberHistory.reduce((sum, h) => sum + (h.joined || 0), 0),
        left: memberHistory.reduce((sum, h) => sum + (h.left || 0), 0),
        percentageChange: 0,
        history: memberHistory.map((h) => ({
          date: h.date,
          count: h.member_count || 0,
          netChange: (h.joined || 0) - (h.left || 0),
        })),
      };

      // Views by day
      const viewsByDayMap = new Map<string, DailyStats>();
      views.forEach((v) => {
        const date = v.view_date;
        const existing = viewsByDayMap.get(date) || {
          date,
          views: 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
        };
        existing.views += 1;
        viewsByDayMap.set(date, existing);
      });
      const viewsByDay = Array.from(viewsByDayMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      const [
        postReactionsResult,
        admiresResult,
        commentsResult,
        relaysResult,
        savesResult,
        takeReactionsResult,
        takeCommentsResult,
        takeRelaysResult,
        takeSavesResult,
      ] = await Promise.all([
        postIds.length > 0
          ? supabase.from("reactions").select("post_id").in("post_id", postIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("admires").select("post_id").in("post_id", postIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("comments").select("post_id").in("post_id", postIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("relays").select("post_id").in("post_id", postIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase.from("saves").select("post_id").in("post_id", postIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase.from("take_reactions").select("take_id").in("take_id", takeIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase.from("take_comments").select("take_id").in("take_id", takeIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase.from("take_relays").select("take_id").in("take_id", takeIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase.from("take_saves").select("take_id").in("take_id", takeIds).gte("created_at", startDate).lt("created_at", exclusiveEndDate)
          : { data: [] },
      ]);

      const totalEngagement =
        (postReactionsResult.data?.length || 0) +
        (admiresResult.data?.length || 0) +
        (commentsResult.data?.length || 0) +
        (relaysResult.data?.length || 0) +
        (savesResult.data?.length || 0) +
        (takeReactionsResult.data?.length || 0) +
        (takeCommentsResult.data?.length || 0) +
        (takeRelaysResult.data?.length || 0) +
        (takeSavesResult.data?.length || 0);

      const contributorMap = new Map<string, ContributorData>();
      const ensureContributor = (userId: string | null | undefined) => {
        if (!userId) return null;
        const existing = contributorMap.get(userId);
        if (existing) return existing;
        const contributor: ContributorData = {
          userId,
          username: "",
          displayName: "",
          postsCount: 0,
          takesCount: 0,
          reactionsReceived: 0,
          commentsReceived: 0,
        };
        contributorMap.set(userId, contributor);
        return contributor;
      };

      posts.forEach((post) => {
        const contributor = ensureContributor(post.author_id);
        if (contributor) contributor.postsCount += 1;
      });
      takes.forEach((take) => {
        const contributor = ensureContributor(take.author_id);
        if (contributor) contributor.takesCount += 1;
      });

      const addPostReaction = (postId: string | null | undefined) => {
        const contributor = ensureContributor(postId ? postAuthorById.get(postId) : undefined);
        if (contributor) contributor.reactionsReceived += 1;
      };
      const addPostComment = (postId: string | null | undefined) => {
        const contributor = ensureContributor(postId ? postAuthorById.get(postId) : undefined);
        if (contributor) contributor.commentsReceived += 1;
      };
      const addTakeReaction = (takeId: string | null | undefined) => {
        const contributor = ensureContributor(takeId ? takeAuthorById.get(takeId) : undefined);
        if (contributor) contributor.reactionsReceived += 1;
      };
      const addTakeComment = (takeId: string | null | undefined) => {
        const contributor = ensureContributor(takeId ? takeAuthorById.get(takeId) : undefined);
        if (contributor) contributor.commentsReceived += 1;
      };

      (postReactionsResult.data || []).forEach((row: { post_id: string }) => addPostReaction(row.post_id));
      (admiresResult.data || []).forEach((row: { post_id: string }) => addPostReaction(row.post_id));
      (commentsResult.data || []).forEach((row: { post_id: string }) => addPostComment(row.post_id));
      (takeReactionsResult.data || []).forEach((row: { take_id: string }) => addTakeReaction(row.take_id));
      (takeCommentsResult.data || []).forEach((row: { take_id: string }) => addTakeComment(row.take_id));

      const authorIds = Array.from(contributorMap.keys());
      const profilesResult = authorIds.length > 0
        ? await supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .in("id", authorIds)
        : { data: [] };

      const profileById = new Map(
        (profilesResult.data || []).map((profile) => [profile.id, profile])
      );

      const topContributors = Array.from(contributorMap.values())
        .map((contributor) => {
          const profile = profileById.get(contributor.userId);
          return {
            ...contributor,
            username: profile?.username || "",
            displayName: profile?.display_name || profile?.username || "Unknown creator",
            avatarUrl: profile?.avatar_url || undefined,
          };
        })
        .sort((a, b) => {
          const contentDelta = b.postsCount + b.takesCount - (a.postsCount + a.takesCount);
          if (contentDelta !== 0) return contentDelta;
          const reactionDelta = b.reactionsReceived - a.reactionsReceived;
          if (reactionDelta !== 0) return reactionDelta;
          return b.commentsReceived - a.commentsReceived;
        })
        .slice(0, 10);

      setInsights({
        communityId,
        pageViews: views.length,
        uniqueVisitors: uniqueVisitors.size,
        memberGrowth,
        postsCreated: posts.length,
        takesCreated: takes.length,
        totalEngagement,
        memberVisitorMix: {
          members: views.filter((view) => view.is_member).length,
          nonMembers: views.filter((view) => !view.is_member).length,
          memberPercentage: views.length > 0
            ? Math.round((views.filter((view) => view.is_member).length / views.length) * 1000) / 10
            : 0,
        },
        topContributors,
        viewsByDay,
      });
    } catch (err) {
      console.error("Error fetching community insights:", err);
      setError("Failed to load community insights");
    }

    setLoading(false);
  }, [user?.id, communityId, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { insights, loading, error, refetch: fetchInsights };
}

// ============================================================================
// CONTENT LIST
// ============================================================================

export interface ContentItem {
  id: string;
  type: "post" | "take";
  title?: string;
  postType?: string;
  thumbnail?: string;
  createdAt: string;
  views: number;
  impressions: number;
  reactions: number;
  comments: number;
  relays: number;
  saves: number;
  engagementRate: number;
}

export function useContentInsights(
  timeRange: TimeRange,
  customRange?: DateRange
) {
  const { user } = useAuth();
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    return getDateRanges(timeRange, customRange);
  }, [timeRange, customRange]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- user?.id is intentionally more specific than user
  const fetchContent = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      const exclusiveEndDate = getExclusiveEndDate(endDate);
      // Get user's posts and takes with media
      const [postsResult, takesResult] = await Promise.all([
        supabase
          .from("posts")
          .select("id, title, type, created_at, media:post_media(media_url, media_type, position)")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("takes")
          .select("id, caption, created_at, thumbnail_url")
          .eq("author_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

      const posts = postsResult.data || [];
      const takes = takesResult.data || [];

      const postIds = posts.map((p) => p.id);
      const takeIds = takes.map((t) => t.id);

      // Fetch views, impressions, and all engagement types for all content.
      const [
        postViewsResult,
        takeViewsResult,
        postImpressionsResult,
        takeImpressionsResult,
        postReactionsResult,
        admiresResult,
        commentsResult,
        relaysResult,
        savesResult,
        takeReactionsResult,
        takeCommentsResult,
        takeRelaysResult,
        takeSavesResult,
      ] = await Promise.all([
        postIds.length > 0
          ? supabase
              .from("post_views")
              .select("post_id")
              .in("post_id", postIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_views")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("post_impressions")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_impressions")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("reactions")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("admires")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("comments")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("relays")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("saves")
              .select("post_id")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_reactions")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_comments")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_relays")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_saves")
              .select("take_id")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lt("created_at", exclusiveEndDate)
          : { data: [] },
      ]);

      // Count views per content
      const postViewCounts = new Map<string, number>();
      (postViewsResult.data || []).forEach((v) => {
        postViewCounts.set(v.post_id, (postViewCounts.get(v.post_id) || 0) + 1);
      });

      const takeViewCounts = new Map<string, number>();
      (takeViewsResult.data || []).forEach((v) => {
        takeViewCounts.set(v.take_id, (takeViewCounts.get(v.take_id) || 0) + 1);
      });

      const postImpressionCounts = new Map<string, number>();
      (postImpressionsResult.data || []).forEach((v) => {
        postImpressionCounts.set(v.post_id, (postImpressionCounts.get(v.post_id) || 0) + 1);
      });

      const takeImpressionCounts = new Map<string, number>();
      (takeImpressionsResult.data || []).forEach((v) => {
        takeImpressionCounts.set(v.take_id, (takeImpressionCounts.get(v.take_id) || 0) + 1);
      });

      const postReactionCounts = new Map<string, number>();
      (postReactionsResult.data || []).forEach((r: { post_id: string }) => {
        postReactionCounts.set(r.post_id, (postReactionCounts.get(r.post_id) || 0) + 1);
      });

      const admireCounts = new Map<string, number>();
      (admiresResult.data || []).forEach((a: { post_id: string }) => {
        admireCounts.set(a.post_id, (admireCounts.get(a.post_id) || 0) + 1);
      });

      const commentCounts = new Map<string, number>();
      (commentsResult.data || []).forEach((c: { post_id: string }) => {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
      });

      const relayCounts = new Map<string, number>();
      (relaysResult.data || []).forEach((r: { post_id: string }) => {
        relayCounts.set(r.post_id, (relayCounts.get(r.post_id) || 0) + 1);
      });

      const saveCounts = new Map<string, number>();
      (savesResult.data || []).forEach((s: { post_id: string }) => {
        saveCounts.set(s.post_id, (saveCounts.get(s.post_id) || 0) + 1);
      });

      const takeReactionCounts = new Map<string, number>();
      (takeReactionsResult.data || []).forEach((r: { take_id: string }) => {
        takeReactionCounts.set(r.take_id, (takeReactionCounts.get(r.take_id) || 0) + 1);
      });

      const takeCommentCounts = new Map<string, number>();
      (takeCommentsResult.data || []).forEach((c: { take_id: string }) => {
        takeCommentCounts.set(c.take_id, (takeCommentCounts.get(c.take_id) || 0) + 1);
      });

      const takeRelayCounts = new Map<string, number>();
      (takeRelaysResult.data || []).forEach((r: { take_id: string }) => {
        takeRelayCounts.set(r.take_id, (takeRelayCounts.get(r.take_id) || 0) + 1);
      });

      const takeSaveCounts = new Map<string, number>();
      (takeSavesResult.data || []).forEach((s: { take_id: string }) => {
        takeSaveCounts.set(s.take_id, (takeSaveCounts.get(s.take_id) || 0) + 1);
      });

      // Build content list
      type PostData = { id: string; title: string | null; type: string; created_at: string; media?: { media_type: string; media_url: string; position?: number }[] };
      type MediaItem = { media_type: string; media_url: string; position?: number };
      const contentItems: ContentItem[] = [
        ...posts.map((p: PostData) => {
          // Get first image from media array
          const media = p.media || [];
          const firstImage = media
              .filter((m: MediaItem) => m.media_type === "image")
              .sort((a: MediaItem, b: MediaItem) => (a.position || 0) - (b.position || 0))[0];
          const views = postViewCounts.get(p.id) || 0;
          const reactions = (postReactionCounts.get(p.id) || 0) + (admireCounts.get(p.id) || 0);
          const comments = commentCounts.get(p.id) || 0;
          const relays = relayCounts.get(p.id) || 0;
          const saves = saveCounts.get(p.id) || 0;
          const engagement = reactions + comments + relays + saves;
          return {
            id: p.id,
            type: "post" as const,
            title: p.title ?? undefined,
            postType: p.type,
            thumbnail: firstImage?.media_url,
            createdAt: p.created_at,
            views,
            impressions: postImpressionCounts.get(p.id) || 0,
            reactions,
            comments,
            relays,
            saves,
            engagementRate: views > 0 ? (engagement / views) * 100 : 0,
          };
        }),
        ...takes.map((t: { id: string; caption: string | null; thumbnail_url: string | null; created_at: string }) => {
          const views = takeViewCounts.get(t.id) || 0;
          const reactions = takeReactionCounts.get(t.id) || 0;
          const comments = takeCommentCounts.get(t.id) || 0;
          const relays = takeRelayCounts.get(t.id) || 0;
          const saves = takeSaveCounts.get(t.id) || 0;
          const engagement = reactions + comments + relays + saves;
          return {
            id: t.id,
            type: "take" as const,
            title: t.caption ?? undefined,
            thumbnail: t.thumbnail_url ?? undefined,
            createdAt: t.created_at,
            views,
            impressions: takeImpressionCounts.get(t.id) || 0,
            reactions,
            comments,
            relays,
            saves,
            engagementRate: views > 0 ? (engagement / views) * 100 : 0,
          };
        }),
      ];

      // Sort by views descending
      contentItems.sort((a, b) => b.views - a.views);

      setContent(contentItems);
    } catch (err) {
      console.error("Error fetching content insights:", err);
      setError("Failed to load content insights");
    }

    setLoading(false);
  }, [user?.id, startDate, endDate]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    fetchContent();
  }, [fetchContent]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { content, loading, error, refetch: fetchContent };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

type CreatorInsightsRpcPayload = Omit<InsightsSummary, "topContent" | "viewsByDay" | "trafficSources"> & {
  topContent?: TopContentItem[];
  viewsByDay?: DailyStats[];
  trafficSources?: TrafficSource[];
};

type CommunityInsightsRpcPayload = CommunityInsights;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeFollowerGrowth(value: unknown): FollowerGrowthData {
  const growth = isObject(value) ? value : {};
  const history = Array.isArray(growth.history)
    ? growth.history.filter(isObject).map((entry) => ({
        date: String(entry.date || ""),
        count: toNumber(entry.count),
        netChange: toNumber(entry.netChange),
      }))
    : [];

  return {
    currentCount: toNumber(growth.currentCount),
    netChange: toNumber(growth.netChange),
    gained: toNumber(growth.gained),
    lost: toNumber(growth.lost),
    percentageChange: toNumber(growth.percentageChange),
    history,
  };
}

function normalizeMemberGrowth(value: unknown): MemberGrowthData {
  const growth = isObject(value) ? value : {};
  const history = Array.isArray(growth.history)
    ? growth.history.filter(isObject).map((entry) => ({
        date: String(entry.date || ""),
        count: toNumber(entry.count),
        netChange: toNumber(entry.netChange),
      }))
    : [];

  return {
    currentCount: toNumber(growth.currentCount),
    netChange: toNumber(growth.netChange),
    joined: toNumber(growth.joined),
    left: toNumber(growth.left),
    percentageChange: toNumber(growth.percentageChange),
    history,
  };
}

function normalizeCreatorInsightsPayload(payload: unknown): InsightsSummary | null {
  if (!isObject(payload)) return null;

  const engagementBreakdown = isObject(payload.engagementBreakdown)
    ? payload.engagementBreakdown
    : {};
  const previousPeriod = isObject(payload.previousPeriod) ? payload.previousPeriod : {};
  const contentCount = isObject(payload.contentCount) ? payload.contentCount : {};

  return {
    totalViews: toNumber(payload.totalViews),
    totalImpressions: toNumber(payload.totalImpressions),
    totalReach: toNumber(payload.totalReach),
    engagementRate: toNumber(payload.engagementRate),
    totalEngagement: toNumber(payload.totalEngagement),
    engagementBreakdown: {
      reactions: toNumber(engagementBreakdown.reactions),
      comments: toNumber(engagementBreakdown.comments),
      relays: toNumber(engagementBreakdown.relays),
      saves: toNumber(engagementBreakdown.saves),
    },
    followerGrowth: normalizeFollowerGrowth(payload.followerGrowth),
    topContent: Array.isArray(payload.topContent)
      ? payload.topContent.filter(isObject).map((item) => ({
          id: String(item.id || ""),
          type: item.type === "take" ? "take" : "post",
          title: typeof item.title === "string" ? item.title : undefined,
          thumbnail: typeof item.thumbnail === "string" ? item.thumbnail : undefined,
          postType: typeof item.postType === "string" ? item.postType : undefined,
          views: toNumber(item.views),
          engagement: toNumber(item.engagement),
          engagementRate: toNumber(item.engagementRate),
          createdAt: String(item.createdAt || ""),
        }))
      : [],
    viewsByDay: Array.isArray(payload.viewsByDay)
      ? payload.viewsByDay.filter(isObject).map((item) => ({
          date: String(item.date || ""),
          views: toNumber(item.views),
          impressions: toNumber(item.impressions),
          reactions: toNumber(item.reactions),
          comments: toNumber(item.comments),
        }))
      : [],
    trafficSources: Array.isArray(payload.trafficSources)
      ? payload.trafficSources.filter(isObject).map((item) => ({
          source: String(item.source || "direct"),
          count: toNumber(item.count),
          percentage: toNumber(item.percentage),
        }))
      : [],
    previousPeriod: {
      views: toNumber(previousPeriod.views),
      impressions: toNumber(previousPeriod.impressions),
      reach: toNumber(previousPeriod.reach),
    },
    contentCount: {
      posts: toNumber(contentCount.posts),
      takes: toNumber(contentCount.takes),
      total: toNumber(contentCount.total),
    },
  };
}

function normalizeCommunityInsightsPayload(payload: unknown): CommunityInsights | null {
  if (!isObject(payload)) return null;
  const memberVisitorMix = isObject(payload.memberVisitorMix)
    ? {
        members: toNumber(payload.memberVisitorMix.members),
        nonMembers: toNumber(payload.memberVisitorMix.nonMembers),
        memberPercentage: toNumber(payload.memberVisitorMix.memberPercentage),
      }
    : undefined;

  return {
    communityId: String(payload.communityId || ""),
    pageViews: toNumber(payload.pageViews),
    uniqueVisitors: toNumber(payload.uniqueVisitors),
    memberGrowth: normalizeMemberGrowth(payload.memberGrowth),
    postsCreated: toNumber(payload.postsCreated),
    takesCreated: toNumber(payload.takesCreated),
    totalEngagement: toNumber(payload.totalEngagement),
    memberVisitorMix,
    topContributors: Array.isArray(payload.topContributors)
      ? payload.topContributors.filter(isObject).map((item) => ({
          userId: String(item.userId || ""),
          username: String(item.username || ""),
          displayName: typeof item.displayName === "string" ? item.displayName : undefined,
          avatarUrl: typeof item.avatarUrl === "string" ? item.avatarUrl : undefined,
          postsCount: toNumber(item.postsCount),
          takesCount: toNumber(item.takesCount),
          reactionsReceived: toNumber(item.reactionsReceived),
          commentsReceived: toNumber(item.commentsReceived),
        }))
      : [],
    viewsByDay: Array.isArray(payload.viewsByDay)
      ? payload.viewsByDay.filter(isObject).map((item) => ({
          date: String(item.date || ""),
          views: toNumber(item.views),
          impressions: toNumber(item.impressions),
          reactions: toNumber(item.reactions),
          comments: toNumber(item.comments),
        }))
      : [],
  };
}

async function getCreatorInsightsSummaryFromRpc(
  profileId: string,
  startDate: string,
  endDate: string,
  prevStartDate: string,
  prevEndDate: string
): Promise<InsightsSummary | null> {
  const { data, error } = await supabase.rpc("get_creator_insights_summary", {
    p_profile_id: profileId,
    p_start_date: startDate,
    p_end_date: endDate,
    p_prev_start_date: prevStartDate,
    p_prev_end_date: prevEndDate,
  });

  if (error) {
    console.warn("[insights] creator aggregate RPC unavailable:", error.message);
    return null;
  }

  return normalizeCreatorInsightsPayload(data as CreatorInsightsRpcPayload);
}

async function getCommunityInsightsSummaryFromRpc(
  communityId: string,
  startDate: string,
  endDate: string
): Promise<CommunityInsights | null> {
  const { data, error } = await supabase.rpc("get_community_insights_summary", {
    p_community_id: communityId,
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.warn("[insights] community aggregate RPC unavailable:", error.message);
    return null;
  }

  return normalizeCommunityInsightsPayload(data as CommunityInsightsRpcPayload);
}

function getDateRanges(timeRange: TimeRange, customRange?: DateRange) {
  const now = new Date();
  let startDate: string;
  let endDate: string = now.toISOString().split("T")[0];
  let prevStartDate: string;
  let prevEndDate: string;

  switch (timeRange) {
    case "7d":
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevStartDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevEndDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "30d":
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "90d":
      startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevStartDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevEndDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "1y":
      startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevStartDate = new Date(now.getTime() - 730 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevEndDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      break;
    case "all":
      startDate = "2020-01-01";
      prevStartDate = "2020-01-01";
      prevEndDate = "2020-01-01";
      break;
    case "custom":
      if (customRange) {
        startDate = customRange.start.toISOString().split("T")[0];
        endDate = customRange.end.toISOString().split("T")[0];
        const duration =
          customRange.end.getTime() - customRange.start.getTime();
        prevStartDate = new Date(customRange.start.getTime() - duration)
          .toISOString()
          .split("T")[0];
        prevEndDate = new Date(customRange.start.getTime())
          .toISOString()
          .split("T")[0];
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
        prevEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0];
      }
      break;
    default:
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevStartDate = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      prevEndDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
  }

  return { startDate, endDate, prevStartDate, prevEndDate };
}

function getExclusiveEndDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString();
}

async function getTopContent(
  userId: string,
  postIds: string[],
  takeIds: string[],
  startDate: string,
  endDate: string
): Promise<TopContentItem[]> {
  const topContent: TopContentItem[] = [];

  if (postIds.length > 0) {
    // Get post views
    const { data: postViews } = await supabase
      .from("post_views")
      .select("post_id")
      .in("post_id", postIds)
      .gte("view_date", startDate)
      .lte("view_date", endDate);

    // Count views per post
    const postViewCounts = new Map<string, number>();
    (postViews || []).forEach((v) => {
      postViewCounts.set(v.post_id, (postViewCounts.get(v.post_id) || 0) + 1);
    });

    // Get post details
    const { data: posts } = await supabase
      .from("posts")
      .select("id, title, type, created_at")
      .in("id", Array.from(postViewCounts.keys()));

    // Get engagement
    const { data: admires } = await supabase
      .from("admires")
      .select("post_id")
      .in("post_id", Array.from(postViewCounts.keys()));

    const admireCounts = new Map<string, number>();
    (admires || []).forEach((a) => {
      admireCounts.set(a.post_id, (admireCounts.get(a.post_id) || 0) + 1);
    });

    (posts || []).forEach((p) => {
      const views = postViewCounts.get(p.id) || 0;
      const engagement = admireCounts.get(p.id) || 0;
      topContent.push({
        id: p.id,
        type: "post",
        title: p.title,
        postType: p.type,
        views,
        engagement,
        engagementRate: views > 0 ? (engagement / views) * 100 : 0,
        createdAt: p.created_at,
      });
    });
  }

  if (takeIds.length > 0) {
    // Get take views
    const { data: takeViews } = await supabase
      .from("take_views")
      .select("take_id")
      .in("take_id", takeIds)
      .gte("view_date", startDate)
      .lte("view_date", endDate);

    // Count views per take
    const takeViewCounts = new Map<string, number>();
    (takeViews || []).forEach((v) => {
      takeViewCounts.set(v.take_id, (takeViewCounts.get(v.take_id) || 0) + 1);
    });

    // Get take details
    const { data: takes } = await supabase
      .from("takes")
      .select("id, caption, thumbnail_url, created_at")
      .in("id", Array.from(takeViewCounts.keys()));

    (takes || []).forEach((t) => {
      const views = takeViewCounts.get(t.id) || 0;
      topContent.push({
        id: t.id,
        type: "take",
        title: t.caption,
        thumbnail: t.thumbnail_url,
        views,
        engagement: 0,
        engagementRate: 0,
        createdAt: t.created_at,
      });
    });
  }

  // Sort by views and return top 10
  return topContent.sort((a, b) => b.views - a.views).slice(0, 10);
}
