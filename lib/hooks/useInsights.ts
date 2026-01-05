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

  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
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
              .select("*")
              .in("post_id", postIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        postIds.length > 0
          ? supabase
              .from("post_impressions")
              .select("*")
              .in("post_id", postIds)
              .gte("created_at", startDate)
              .lte("created_at", endDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_views")
              .select("*")
              .in("take_id", takeIds)
              .gte("view_date", startDate)
              .lte("view_date", endDate)
          : { data: [] },
        takeIds.length > 0
          ? supabase
              .from("take_impressions")
              .select("*")
              .in("take_id", takeIds)
              .gte("created_at", startDate)
              .lte("created_at", endDate)
          : { data: [] },
        supabase
          .from("follower_history")
          .select("*")
          .eq("profile_id", user.id)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", user.id),
        // Previous period for comparison
        postIds.length > 0
          ? supabase
              .from("post_views")
              .select("*", { count: "exact", head: true })
              .in("post_id", postIds)
              .gte("view_date", prevStartDate)
              .lte("view_date", prevEndDate)
          : { count: 0 },
        takeIds.length > 0
          ? supabase
              .from("take_views")
              .select("*", { count: "exact", head: true })
              .in("take_id", takeIds)
              .gte("view_date", prevStartDate)
              .lte("view_date", prevEndDate)
          : { count: 0 },
      ]);

      const postViews = postViewsResult.data || [];
      const postImpressions = postImpressionsResult.data || [];
      const takeViews = takeViewsResult.data || [];
      const takeImpressions = takeImpressionsResult.data || [];
      const followerHistory = followerHistoryResult.data || [];

      // Calculate totals
      const totalViews = postViews.length + takeViews.length;
      const totalImpressions = postImpressions.length + takeImpressions.length;

      // Calculate unique viewers (reach)
      const uniqueViewers = new Set([
        ...postViews.map((v) => v.viewer_id || v.session_id),
        ...takeViews.map((v) => v.viewer_id || v.session_id),
      ]);
      const totalReach = uniqueViewers.size;

      // Get engagement data
      const [admireResult, commentResult, relayResult] = await Promise.all([
        supabase
          .from("admires")
          .select("*", { count: "exact", head: true })
          .in("post_id", postIds),
        supabase
          .from("comments")
          .select("*", { count: "exact", head: true })
          .in("post_id", postIds),
        supabase
          .from("relays")
          .select("*", { count: "exact", head: true })
          .in("post_id", postIds),
      ]);

      const totalEngagement =
        (admireResult.count || 0) +
        (commentResult.count || 0) +
        (relayResult.count || 0);
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

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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

  const fetchInsights = useCallback(async () => {
    if (!user?.id || !postId) return;

    setLoading(true);
    setError(null);

    try {
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
            .select("*")
            .eq("post_id", postId)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("post_impressions")
            .select("*")
            .eq("post_id", postId)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          supabase.from("reactions").select("*").eq("post_id", postId),
          supabase
            .from("comments")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId),
          supabase
            .from("relays")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId),
          supabase
            .from("saves")
            .select("*", { count: "exact", head: true })
            .eq("post_id", postId),
        ]);

      const views = viewsResult.data || [];
      const impressions = impressionsResult.data || [];
      const reactions = reactionsResult.data || [];

      // Calculate totals
      const totalViews = views.length;
      const totalImpressions = impressions.length;

      // Unique viewers
      const uniqueViewers = new Set(views.map((v) => v.viewer_id || v.session_id));
      const reach = uniqueViewers.size;

      // Average read time
      const readTimes = views.filter((v) => v.read_time_seconds > 0).map((v) => v.read_time_seconds);
      const avgReadTime = readTimes.length > 0 ? readTimes.reduce((a, b) => a + b, 0) / readTimes.length : 0;

      // Reactions breakdown
      const reactionBreakdown: ReactionBreakdown = {
        admire: reactions.filter((r) => r.type === "admire").length,
        snap: reactions.filter((r) => r.type === "snap").length,
        ovation: reactions.filter((r) => r.type === "ovation").length,
        support: reactions.filter((r) => r.type === "support").length,
        inspired: reactions.filter((r) => r.type === "inspired").length,
        applaud: reactions.filter((r) => r.type === "applaud").length,
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

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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

  const fetchInsights = useCallback(async () => {
    if (!user?.id || !takeId) return;

    setLoading(true);
    setError(null);

    try {
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
            .select("*")
            .eq("take_id", takeId)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("take_impressions")
            .select("*")
            .eq("take_id", takeId)
            .gte("created_at", startDate)
            .lte("created_at", endDate),
          supabase.from("take_reactions").select("*").eq("take_id", takeId),
          supabase
            .from("take_comments")
            .select("*", { count: "exact", head: true })
            .eq("take_id", takeId),
          supabase
            .from("take_relays")
            .select("*", { count: "exact", head: true })
            .eq("take_id", takeId),
          supabase
            .from("take_saves")
            .select("*", { count: "exact", head: true })
            .eq("take_id", takeId),
        ]);

      const views = viewsResult.data || [];
      const impressions = impressionsResult.data || [];
      const reactions = reactionsResult.data || [];

      // Calculate totals
      const totalViews = views.length;
      const totalImpressions = impressions.length;

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
        admire: reactions.filter((r) => r.type === "admire").length,
        snap: reactions.filter((r) => r.type === "snap").length,
        ovation: reactions.filter((r) => r.type === "ovation").length,
        support: reactions.filter((r) => r.type === "support").length,
        inspired: reactions.filter((r) => r.type === "inspired").length,
        applaud: reactions.filter((r) => r.type === "applaud").length,
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

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return { insights, take, loading, error, refetch: fetchInsights };
}

// ============================================================================
// PROFILE INSIGHTS
// ============================================================================

export interface ProfileInsights {
  profileViews: number;
  uniqueViewers: number;
  contentReach: number;
  contentImpressions: number;
  totalReactions: number;
  totalComments: number;
  totalSaves: number;
  followerGrowth: FollowerGrowthData;
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

  const fetchInsights = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch profile views
      const [profileViewsResult, followerHistoryResult, followerCountResult] =
        await Promise.all([
          supabase
            .from("profile_views")
            .select("*")
            .eq("profile_id", user.id)
            .gte("view_date", startDate)
            .lte("view_date", endDate),
          supabase
            .from("follower_history")
            .select("*")
            .eq("profile_id", user.id)
            .gte("date", startDate)
            .lte("date", endDate)
            .order("date", { ascending: true }),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", user.id),
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
      const [postViewsResult, takeViewsResult, admireResult, commentResult] =
        await Promise.all([
          postIds.length > 0
            ? supabase
                .from("post_views")
                .select("*")
                .in("post_id", postIds)
                .gte("view_date", startDate)
                .lte("view_date", endDate)
            : { data: [] },
          takeIds.length > 0
            ? supabase
                .from("take_views")
                .select("*")
                .in("take_id", takeIds)
                .gte("view_date", startDate)
                .lte("view_date", endDate)
            : { data: [] },
          postIds.length > 0
            ? supabase
                .from("admires")
                .select("*", { count: "exact", head: true })
                .in("post_id", postIds)
            : { count: 0 },
          postIds.length > 0
            ? supabase
                .from("comments")
                .select("*", { count: "exact", head: true })
                .in("post_id", postIds)
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

      setInsights({
        profileViews: profileViews.length,
        uniqueViewers: uniqueProfileViewers.size,
        contentReach: uniqueContentViewers.size,
        contentImpressions: postViews.length + takeViews.length,
        totalReactions: admireResult.count || 0,
        totalComments: commentResult.count || 0,
        totalSaves: 0,
        followerGrowth,
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

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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

  const fetchInsights = useCallback(async () => {
    if (!user?.id || !communityId) return;

    setLoading(true);
    setError(null);

    try {
      // Verify admin/mod access
      const { data: membership } = await supabase
        .from("community_members")
        .select("role")
        .eq("community_id", communityId)
        .eq("user_id", user.id)
        .single();

      if (!membership || !["admin", "moderator"].includes(membership.role)) {
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
          .select("*")
          .eq("community_id", communityId)
          .gte("view_date", startDate)
          .lte("view_date", endDate),
        supabase
          .from("community_member_history")
          .select("*")
          .eq("community_id", communityId)
          .gte("date", startDate)
          .lte("date", endDate)
          .order("date", { ascending: true }),
        supabase
          .from("community_members")
          .select("*", { count: "exact", head: true })
          .eq("community_id", communityId)
          .eq("status", "active"),
        supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .eq("community_id", communityId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
        supabase
          .from("takes")
          .select("*", { count: "exact", head: true })
          .eq("community_id", communityId)
          .gte("created_at", startDate)
          .lte("created_at", endDate),
      ]);

      const views = viewsResult.data || [];
      const memberHistory = memberHistoryResult.data || [];

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

      setInsights({
        communityId,
        pageViews: views.length,
        uniqueVisitors: uniqueVisitors.size,
        memberGrowth,
        postsCreated: postsResult.count || 0,
        takesCreated: takesResult.count || 0,
        totalEngagement: 0,
        topContributors: [],
        viewsByDay,
      });
    } catch (err) {
      console.error("Error fetching community insights:", err);
      setError("Failed to load community insights");
    }

    setLoading(false);
  }, [user?.id, communityId, startDate, endDate]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

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

  const fetchContent = useCallback(async () => {
    if (!user?.id) return;

    setLoading(true);
    setError(null);

    try {
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

      // Fetch views and engagement for all content
      const [postViewsResult, takeViewsResult, admiresResult, commentsResult] =
        await Promise.all([
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
            ? supabase.from("admires").select("post_id").in("post_id", postIds)
            : { data: [] },
          postIds.length > 0
            ? supabase.from("comments").select("post_id").in("post_id", postIds)
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

      const admireCounts = new Map<string, number>();
      (admiresResult.data || []).forEach((a) => {
        admireCounts.set(a.post_id, (admireCounts.get(a.post_id) || 0) + 1);
      });

      const commentCounts = new Map<string, number>();
      (commentsResult.data || []).forEach((c) => {
        commentCounts.set(c.post_id, (commentCounts.get(c.post_id) || 0) + 1);
      });

      // Build content list
      const contentItems: ContentItem[] = [
        ...posts.map((p: any) => {
          // Get first image from media array
          const media = p.media || [];
          const firstImage = media
            .filter((m: any) => m.media_type === "image")
            .sort((a: any, b: any) => (a.position || 0) - (b.position || 0))[0];
          return {
            id: p.id,
            type: "post" as const,
            title: p.title,
            postType: p.type,
            thumbnail: firstImage?.media_url,
            createdAt: p.created_at,
            views: postViewCounts.get(p.id) || 0,
            impressions: 0,
            reactions: admireCounts.get(p.id) || 0,
            comments: commentCounts.get(p.id) || 0,
            relays: 0,
            saves: 0,
            engagementRate: 0,
          };
        }),
        ...takes.map((t: any) => ({
          id: t.id,
          type: "take" as const,
          title: t.caption,
          thumbnail: t.thumbnail_url,
          createdAt: t.created_at,
          views: takeViewCounts.get(t.id) || 0,
          impressions: 0,
          reactions: 0,
          comments: 0,
          relays: 0,
          saves: 0,
          engagementRate: 0,
        })),
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

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  return { content, loading, error, refetch: fetchContent };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
