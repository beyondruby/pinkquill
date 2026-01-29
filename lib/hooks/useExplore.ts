"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import type { Post, PostMedia, PaginationState, ReactionType, AggregateCount } from "../types";
import { getAggregateCount } from "../types";

// ============================================================================
// TYPES
// ============================================================================

export type ExploreTab =
  | "for-you"
  | "trending"
  | "communities"
  | "topics"
  | "poem"
  | "journal"
  | "thought"
  | "visual"
  | "essay"
  | "story"
  | "letter"
  | "quote";

interface UseExploreOptions {
  pageSize?: number;
  tab?: ExploreTab;
}

interface UseExploreReturn {
  posts: Post[];
  loading: boolean;
  error: string | null;
  pagination: PaginationState;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  activeTab: ExploreTab;
  setActiveTab: (tab: ExploreTab) => void;
}

interface UserInterests {
  admiredPostTypes: Map<string, number>;
  admiredAuthors: Set<string>;
  followingIds: Set<string>;
  recentAdmires: Set<string>;
}

// ============================================================================
// ALGORITHM WEIGHTS
// ============================================================================

const WEIGHTS = {
  // Engagement signals
  ADMIRES: 1.0,
  COMMENTS: 1.5,
  RELAYS: 2.0,

  // Relationship signals
  FOLLOWING_AUTHOR: 3.0,
  ADMIRED_AUTHOR_BEFORE: 2.0,

  // Content preference signals
  PREFERRED_TYPE: 1.5,

  // Time decay (posts lose score over time)
  TIME_DECAY_HOURS: 48, // Posts start decaying after 48 hours

  // Trending boost for recent viral content
  TRENDING_WINDOW_HOURS: 24,
  TRENDING_THRESHOLD: 10, // Min engagement for trending boost
  TRENDING_BOOST: 2.5,
};

const DEFAULT_PAGE_SIZE = 20;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate engagement score based on interactions
 */
function calculateEngagementScore(
  admiresCount: number,
  commentsCount: number,
  relaysCount: number
): number {
  return (
    admiresCount * WEIGHTS.ADMIRES +
    commentsCount * WEIGHTS.COMMENTS +
    relaysCount * WEIGHTS.RELAYS
  );
}

/**
 * Calculate time decay factor (exponential decay)
 * Returns 1.0 for very recent posts, approaches 0 for old posts
 */
function calculateTimeDecay(createdAt: string): number {
  const now = Date.now();
  const postTime = new Date(createdAt).getTime();
  const hoursOld = (now - postTime) / (1000 * 60 * 60);

  if (hoursOld < WEIGHTS.TIME_DECAY_HOURS) {
    return 1.0;
  }

  // Exponential decay after the threshold
  const decayFactor = Math.exp(-(hoursOld - WEIGHTS.TIME_DECAY_HOURS) / 72);
  return Math.max(0.1, decayFactor);
}

/**
 * Check if post is trending (high engagement in short time)
 */
function isTrending(
  admiresCount: number,
  commentsCount: number,
  relaysCount: number,
  createdAt: string
): boolean {
  const now = Date.now();
  const postTime = new Date(createdAt).getTime();
  const hoursOld = (now - postTime) / (1000 * 60 * 60);

  if (hoursOld > WEIGHTS.TRENDING_WINDOW_HOURS) {
    return false;
  }

  const totalEngagement = admiresCount + commentsCount + relaysCount;
  return totalEngagement >= WEIGHTS.TRENDING_THRESHOLD;
}

/**
 * Calculate final algorithm score for a post
 */
function calculatePostScore(
  post: {
    id: string;
    author_id: string;
    type: string;
    created_at: string;
    admires_count: number;
    comments_count: number;
    relays_count: number;
  },
  userInterests: UserInterests | null
): number {
  let score = 0;

  // Base engagement score
  const engagementScore = calculateEngagementScore(
    post.admires_count,
    post.comments_count,
    post.relays_count
  );
  score += engagementScore;

  // Time decay
  const timeDecay = calculateTimeDecay(post.created_at);
  score *= timeDecay;

  // Trending boost
  if (isTrending(post.admires_count, post.comments_count, post.relays_count, post.created_at)) {
    score *= WEIGHTS.TRENDING_BOOST;
  }

  // User-specific signals (if logged in)
  if (userInterests) {
    // Following boost
    if (userInterests.followingIds.has(post.author_id)) {
      score *= WEIGHTS.FOLLOWING_AUTHOR;
    }

    // Previously admired author boost
    if (userInterests.admiredAuthors.has(post.author_id)) {
      score *= WEIGHTS.ADMIRED_AUTHOR_BEFORE;
    }

    // Content type preference boost
    const typePreference = userInterests.admiredPostTypes.get(post.type) || 0;
    if (typePreference > 0) {
      score *= 1 + (typePreference / 10) * (WEIGHTS.PREFERRED_TYPE - 1);
    }
  }

  // Add some randomness to prevent stale feeds (shuffle factor)
  score *= 0.9 + Math.random() * 0.2;

  return score;
}

// ============================================================================
// useExplore HOOK
// ============================================================================

export function useExplore(userId?: string, options: UseExploreOptions = {}): UseExploreReturn {
  const { pageSize = DEFAULT_PAGE_SIZE, tab: initialTab = "for-you" } = options;

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ExploreTab>(initialTab);
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    pageSize,
    hasMore: true,
  });

  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const userInterestsRef = useRef<UserInterests | null>(null);

  // Fetch user interests for personalization
  const fetchUserInterests = useCallback(async (): Promise<UserInterests | null> => {
    if (!userId) return null;

    try {
      // Fetch user's admires to understand preferences
      const [admiresResult, followsResult] = await Promise.all([
        supabase
          .from("admires")
          .select(`
            post_id,
            post:posts (
              type,
              author_id
            )
          `)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(100),
        supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", userId)
          .eq("status", "accepted"),
      ]);

      const admiredPostTypes = new Map<string, number>();
      const admiredAuthors = new Set<string>();
      const recentAdmires = new Set<string>();

      (admiresResult.data || []).forEach((admire: any) => {
        recentAdmires.add(admire.post_id);
        if (admire.post) {
          const postType = admire.post.type;
          const authorId = admire.post.author_id;

          admiredPostTypes.set(postType, (admiredPostTypes.get(postType) || 0) + 1);
          admiredAuthors.add(authorId);
        }
      });

      const followingIds = new Set(
        (followsResult.data || []).map((f) => f.following_id)
      );

      return {
        admiredPostTypes,
        admiredAuthors,
        followingIds,
        recentAdmires,
      };
    } catch (err) {
      console.error("[useExplore] Failed to fetch user interests:", err);
      return null;
    }
  }, [userId]);

  // Main fetch function
  const fetchPosts = useCallback(
    async (page: number, append: boolean = false) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;

      try {
        if (!append) {
          setLoading(true);
        }
        setError(null);

        // Fetch user interests if not cached
        if (userId && !userInterestsRef.current) {
          userInterestsRef.current = await fetchUserInterests();
        }

        // Build query based on tab
        let query = supabase
          .from("posts")
          .select(
            `
            *,
            styling,
            post_location,
            metadata,
            author:profiles!posts_author_id_fkey (
              id,
              username,
              display_name,
              avatar_url,
              is_verified,
              is_private
            ),
            media:post_media (
              id,
              media_url,
              media_type,
              caption,
              position
            ),
            community:communities (
              id,
              slug,
              name,
              avatar_url
            ),
            admires:admires(count),
            comments:comments(count),
            relays:relays(count)
          `,
            { count: "exact" }
          )
          .eq("status", "published")
          .eq("visibility", "public");

        // Filter by post type or community
        if (activeTab === "communities") {
          // Only posts from public communities
          query = query.not("community_id", "is", null);
        } else if (["poem", "journal", "thought", "visual", "essay", "story", "letter", "quote"].includes(activeTab)) {
          query = query.eq("type", activeTab);
        }

        // For algorithmic tabs, fetch more posts to score and sort
        // Using 1.5x multiplier to balance algorithm quality with efficiency
        const fetchLimit = activeTab === "for-you" || activeTab === "trending" || activeTab === "communities"
          ? Math.ceil(pageSize * 1.5)
          : pageSize;

        // Exclude user's own posts for discovery
        if (userId) {
          query = query.neq("author_id", userId);
        }

        const { data: postsData, error: queryError } = await query
          .order("created_at", { ascending: false })
          .limit(fetchLimit);

        if (queryError) throw queryError;
        if (!mountedRef.current) return;

        // Get post IDs for batch fetching
        const postIds = (postsData || []).map((p) => p.id);

        // Batch fetch user interactions if logged in
        let userAdmires = new Set<string>();
        let userSaves = new Set<string>();
        let userRelays = new Set<string>();
        let userReactions = new Map<string, string>();

        if (userId && postIds.length > 0) {
          const [admiresResult, savesResult, relaysResult, reactionsResult] = await Promise.all([
            supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
            supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
            supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
            supabase.from("reactions").select("post_id, reaction_type").eq("user_id", userId).in("post_id", postIds),
          ]);

          userAdmires = new Set((admiresResult.data || []).map((a) => a.post_id));
          userSaves = new Set((savesResult.data || []).map((s) => s.post_id));
          userRelays = new Set((relaysResult.data || []).map((r) => r.post_id));
          (reactionsResult.data || []).forEach((r) => {
            userReactions.set(r.post_id, r.reaction_type);
          });
        }

        // Batch fetch collaborators and mentions
        let collaboratorsByPost = new Map<string, any[]>();
        let mentionsByPost = new Map<string, any[]>();
        let hashtagsByPost = new Map<string, string[]>();

        if (postIds.length > 0) {
          const [collaboratorsResult, mentionsResult, tagsResult] = await Promise.all([
            supabase
              .from("post_collaborators")
              .select(`
                post_id,
                status,
                role,
                user:profiles!post_collaborators_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .in("post_id", postIds)
              .eq("status", "accepted"),
            supabase
              .from("post_mentions")
              .select(`
                post_id,
                user:profiles!post_mentions_user_id_fkey (
                  id,
                  username,
                  display_name,
                  avatar_url
                )
              `)
              .in("post_id", postIds),
            supabase
              .from("post_tags")
              .select(`
                post_id,
                tag:tags(name)
              `)
              .in("post_id", postIds),
          ]);

          (collaboratorsResult.data || []).forEach((c) => {
            if (!collaboratorsByPost.has(c.post_id)) {
              collaboratorsByPost.set(c.post_id, []);
            }
            collaboratorsByPost.get(c.post_id)!.push({
              status: c.status,
              role: c.role,
              user: c.user,
            });
          });

          (mentionsResult.data || []).forEach((m) => {
            if (!mentionsByPost.has(m.post_id)) {
              mentionsByPost.set(m.post_id, []);
            }
            mentionsByPost.get(m.post_id)!.push({ user: m.user });
          });

          (tagsResult.data || []).forEach((t: any) => {
            const tagName = t.tag?.name;
            if (tagName) {
              if (!hashtagsByPost.has(t.post_id)) {
                hashtagsByPost.set(t.post_id, []);
              }
              hashtagsByPost.get(t.post_id)!.push(tagName);
            }
          });
        }

        // Transform posts with all data
        let transformedPosts: Post[] = (postsData || []).map((post) => ({
          id: post.id,
          author_id: post.author_id,
          type: post.type,
          title: post.title,
          content: post.content,
          visibility: post.visibility,
          status: post.status,
          content_warning: post.content_warning,
          created_at: post.created_at,
          community_id: post.community_id,
          author: post.author,
          media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
          community: post.community,
          admires_count: getAggregateCount(post.admires as AggregateCount[] | null),
          comments_count: getAggregateCount(post.comments as AggregateCount[] | null),
          relays_count: getAggregateCount(post.relays as AggregateCount[] | null),
          reactions_count: 0,
          user_has_admired: userAdmires.has(post.id),
          user_has_saved: userSaves.has(post.id),
          user_has_relayed: userRelays.has(post.id),
          user_reaction_type: (userReactions.get(post.id) as ReactionType | undefined) || null,
          collaborators: collaboratorsByPost.get(post.id) || [],
          mentions: mentionsByPost.get(post.id) || [],
          hashtags: hashtagsByPost.get(post.id) || [],
          // Creative styling fields
          styling: post.styling || null,
          post_location: post.post_location || null,
          metadata: post.metadata || null,
        }));

        // Apply algorithm scoring and sorting
        if (activeTab === "for-you") {
          // Score and sort by personalized algorithm
          transformedPosts = transformedPosts
            .map((post) => ({
              ...post,
              _score: calculatePostScore(
                {
                  id: post.id,
                  author_id: post.author_id,
                  type: post.type,
                  created_at: post.created_at,
                  admires_count: post.admires_count,
                  comments_count: post.comments_count,
                  relays_count: post.relays_count,
                },
                userInterestsRef.current
              ),
            }))
            .sort((a, b) => (b._score ?? 0) - (a._score ?? 0))
            .map(({ _score, ...post }) => post as Post);
        } else if (activeTab === "trending") {
          // Filter and sort by trending score (high engagement + recency)
          const now = Date.now();
          transformedPosts = transformedPosts
            .filter((post) => {
              const hoursOld = (now - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
              return hoursOld < 72; // Only posts from last 72 hours
            })
            .map((post) => ({
              ...post,
              _trendingScore: calculateEngagementScore(
                post.admires_count,
                post.comments_count,
                post.relays_count
              ) / Math.max(1, (now - new Date(post.created_at).getTime()) / (1000 * 60 * 60)),
            }))
            .sort((a, b) => (b._trendingScore ?? 0) - (a._trendingScore ?? 0))
            .map(({ _trendingScore, ...post }) => post as Post);
        } else if (activeTab === "communities") {
          // Algorithm for community posts discovery
          // Prioritizes: engagement, user interests, recency, variety
          transformedPosts = transformedPosts
            .map((post) => {
              let score = 0;

              // Base engagement score
              score += calculateEngagementScore(
                post.admires_count,
                post.comments_count,
                post.relays_count
              );

              // Time decay for freshness
              score *= calculateTimeDecay(post.created_at);

              // Trending boost for viral community posts
              if (isTrending(post.admires_count, post.comments_count, post.relays_count, post.created_at)) {
                score *= WEIGHTS.TRENDING_BOOST;
              }

              // User interest signals
              if (userInterestsRef.current) {
                // Boost posts from authors user has engaged with
                if (userInterestsRef.current.admiredAuthors.has(post.author_id)) {
                  score *= 1.5;
                }

                // Boost posts of types user prefers
                const typePreference = userInterestsRef.current.admiredPostTypes.get(post.type) || 0;
                if (typePreference > 0) {
                  score *= 1 + (typePreference / 20);
                }
              }

              // Add randomness for variety
              score *= 0.85 + Math.random() * 0.3;

              return { ...post, _communityScore: score };
            })
            .sort((a, b) => (b._communityScore ?? 0) - (a._communityScore ?? 0))
            .map(({ _communityScore, ...post }) => post as Post);
        }

        // Paginate the results
        const startIndex = page * pageSize;
        const paginatedPosts = transformedPosts.slice(startIndex, startIndex + pageSize);

        if (!mountedRef.current) return;

        // Update state
        if (append) {
          setPosts((prev) => [...prev, ...paginatedPosts]);
        } else {
          setPosts(paginatedPosts);
        }

        setPagination({
          page,
          pageSize,
          hasMore: startIndex + pageSize < transformedPosts.length,
          total: transformedPosts.length,
        });
      } catch (err) {
        console.error("[useExplore] Error:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch posts");
        }
      } finally {
        fetchingRef.current = false;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [userId, pageSize, activeTab, fetchUserInterests]
  );

  // Load more posts
  const loadMore = useCallback(async () => {
    if (!pagination.hasMore || fetchingRef.current) return;
    await fetchPosts(pagination.page + 1, true);
  }, [fetchPosts, pagination.hasMore, pagination.page]);

  // Refresh posts
  const refresh = useCallback(async () => {
    userInterestsRef.current = null; // Clear cached interests
    await fetchPosts(0, false);
  }, [fetchPosts]);

  // Handle tab change
  const handleTabChange = useCallback((tab: ExploreTab) => {
    setActiveTab(tab);
    setPosts([]);
    setPagination({ page: 0, pageSize, hasMore: true });
  }, [pageSize]);

  // Initial fetch and refetch on tab change
  useEffect(() => {
    mountedRef.current = true;
    fetchPosts(0);

    return () => {
      mountedRef.current = false;
    };
  }, [fetchPosts, activeTab]);

  return {
    posts,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    activeTab,
    setActiveTab: handleTabChange,
  };
}

// NOTE: useTrendingTags has been moved to useTags.ts to avoid duplication
// Import from there: import { useTrendingTags } from "./useTags";
