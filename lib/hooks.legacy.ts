/**
 * Legacy Hooks
 *
 * This file contains hooks that have not yet been migrated to the modular hooks system.
 * These hooks are still actively used and exported via lib/hooks.ts
 *
 * Contents:
 * - Community hooks (useCommunity, useCommunities, etc.)
 * - Search hook (useSearch)
 * - Collaboration hooks (useCollaborators, useMentions, etc.)
 * - User search hook (useUserSearch)
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "./supabase";
import { createNotification } from "./hooks/useNotifications";
import type {
  Post,
  Community,
  CommunityMember,
  CommunityRule,
  CommunityTag,
  JoinRequest,
  CommunityInvitation,
} from "./types";

// Re-export community types for backwards compatibility
export type {
  Community,
  CommunityMember,
  CommunityRule,
  CommunityTag,
  JoinRequest,
  CommunityInvitation,
} from "./types";

// ============================================
// COMMUNITY HOOKS
// ============================================

// Fetch a single community by slug
export function useCommunity(slug: string, userId?: string) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [rules, setRules] = useState<CommunityRule[]>([]);
  const [tags, setTags] = useState<CommunityTag[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const fetchCommunity = useCallback(async () => {
    if (!slug) return;

    const currentFetchId = ++fetchIdRef.current;

    try {
      setLoading(true);
      setError(null);

      // Fetch community
      const { data: communityData, error: communityError } = await supabase
        .from("communities")
        .select(`
          *,
          creator:profiles!communities_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("slug", slug)
        .single();

      if (currentFetchId !== fetchIdRef.current) return;

      if (communityError) {
        if (communityError.code === 'PGRST116') {
          setError("Community not found");
        } else {
          throw communityError;
        }
        return;
      }

      // Fetch counts/membership in parallel, but tolerate secondary query failures.
      // This prevents transient errors from showing a false "community not found" state.
      const [membersResult, postsResult, userMemberResult, pendingRequestResult, pendingInvitationResult, rulesResult, tagsResult] = await Promise.allSettled([
        supabase.from("community_members").select("*", { count: "exact", head: true }).eq("community_id", communityData.id).eq("status", "active"),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("community_id", communityData.id),
        userId ? supabase.from("community_members").select("role, status").eq("community_id", communityData.id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_join_requests").select("id").eq("community_id", communityData.id).eq("user_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_invitations").select("id").eq("community_id", communityData.id).eq("invitee_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("community_rules").select("*").eq("community_id", communityData.id).order("rule_number", { ascending: true }),
        supabase.from("community_tags").select("*").eq("community_id", communityData.id),
      ]);

      if (currentFetchId !== fetchIdRef.current) return;

      type SettledPayload<T = unknown> = {
        data?: T | null;
        error?: { message?: string } | null;
        count?: number | null;
      };

      const logSettledError = (queryName: string, result: PromiseSettledResult<SettledPayload>) => {
        if (result.status === "rejected") {
          console.error(`[useCommunity] ${queryName} query rejected:`, result.reason);
          return;
        }
        if (result.value.error) {
          console.error(`[useCommunity] ${queryName} query error:`, result.value.error);
        }
      };

      const getSettledData = <T,>(
        result: PromiseSettledResult<SettledPayload<T>>,
        fallback: T
      ): T => {
        if (result.status !== "fulfilled") return fallback;
        if (result.value.error) return fallback;
        return (result.value.data as T | null | undefined) ?? fallback;
      };

      const getSettledCount = (result: PromiseSettledResult<SettledPayload>, fallback = 0): number => {
        if (result.status !== "fulfilled") return fallback;
        if (result.value.error) return fallback;
        return result.value.count ?? fallback;
      };

      logSettledError("members", membersResult);
      logSettledError("posts", postsResult);
      logSettledError("user membership", userMemberResult);
      logSettledError("pending join request", pendingRequestResult);
      logSettledError("pending invitation", pendingInvitationResult);
      logSettledError("rules", rulesResult);
      logSettledError("tags", tagsResult);

      const userMemberData = getSettledData<{ role: 'admin' | 'moderator' | 'member'; status: 'active' | 'muted' | 'banned' } | null>(userMemberResult, null);
      const pendingRequestData = getSettledData<{ id: string } | null>(pendingRequestResult, null);
      const pendingInvitationData = getSettledData<{ id: string } | null>(pendingInvitationResult, null);
      const rulesData = getSettledData<CommunityRule[]>(rulesResult, []);
      const tagsData = getSettledData<CommunityTag[]>(tagsResult, []);

      setCommunity({
        ...communityData,
        member_count: getSettledCount(membersResult),
        post_count: getSettledCount(postsResult),
        is_member: !!userMemberData && userMemberData.status === 'active',
        user_role: userMemberData?.role || null,
        user_status: userMemberData?.status || null,
        has_pending_request: !!pendingRequestData,
        has_pending_invitation: !!pendingInvitationData,
        pending_invitation_id: pendingInvitationData?.id || undefined,
      });

      setRules(rulesData);
      setTags(tagsData);
    } catch (err: unknown) {
      if (currentFetchId !== fetchIdRef.current) return;
      console.error("[useCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch community");
    } finally {
      if (currentFetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [slug, userId]);

  useEffect(() => {
    fetchCommunity();
  }, [fetchCommunity]);

  return { community, rules, tags, loading, error, refetch: fetchCommunity };
}

// Fetch list of communities
export function useCommunities(userId?: string, filter?: 'all' | 'joined' | 'created') {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchCommunities = useCallback(async () => {
    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      let query = supabase
        .from("communities")
        .select(`
          *,
          creator:profiles!communities_created_by_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false });

      // Apply filter
      if (filter === 'created' && userId) {
        query = query.eq('created_by', userId);
      }

      const { data: communitiesData, error: communitiesError } = await query;

      if (!mountedRef.current) return;
      if (communitiesError) throw communitiesError;

      if (!communitiesData || communitiesData.length === 0) {
        setCommunities([]);
        return;
      }

      // If filter is 'joined', we need to filter by membership
      let filteredCommunities = communitiesData;
      if (filter === 'joined' && userId) {
        const { data: memberships } = await supabase
          .from("community_members")
          .select("community_id")
          .eq("user_id", userId)
          .eq("status", "active");

        if (!mountedRef.current) return;

        const joinedIds = new Set((memberships || []).map(m => m.community_id));
        filteredCommunities = communitiesData.filter(c => joinedIds.has(c.id));
      }

      // Get counts for all communities
      const communityIds = filteredCommunities.map(c => c.id);

      const [membersResult, postsResult, userMemberships] = await Promise.all([
        supabase.from("community_members").select("community_id").in("community_id", communityIds).eq("status", "active"),
        supabase.from("posts").select("community_id").in("community_id", communityIds),
        userId ? supabase.from("community_members").select("community_id, role, status").eq("user_id", userId).in("community_id", communityIds) : Promise.resolve({ data: [] }),
      ]);

      if (!mountedRef.current) return;

      // Count members and posts per community
      const memberCounts: Record<string, number> = {};
      const postCounts: Record<string, number> = {};
      const userRoles: Record<string, { role: string; status: string }> = {};

      (membersResult.data || []).forEach(m => {
        memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
      });
      (postsResult.data || []).forEach(p => {
        if (p.community_id) {
          postCounts[p.community_id] = (postCounts[p.community_id] || 0) + 1;
        }
      });
      (userMemberships.data || []).forEach(m => {
        userRoles[m.community_id] = { role: m.role, status: m.status };
      });

      const enrichedCommunities = filteredCommunities.map(c => ({
        ...c,
        member_count: memberCounts[c.id] || 0,
        post_count: postCounts[c.id] || 0,
        is_member: !!userRoles[c.id] && userRoles[c.id].status === 'active',
        user_role: userRoles[c.id]?.role as 'admin' | 'moderator' | 'member' | null || null,
        user_status: userRoles[c.id]?.status as 'active' | 'muted' | 'banned' | null || null,
      }));

      setCommunities(enrichedCommunities);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useCommunities] Error:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch communities");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId, filter]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCommunities();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchCommunities]);

  return { communities, loading, error, refetch: fetchCommunities };
}

// Discover communities (for explore/browse)
export function useDiscoverCommunities(options?: { category?: string; tag?: string; limit?: number }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [trending, setTrending] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const limit = options?.limit ?? 20;

  useEffect(() => {
    mountedRef.current = true;

    const fetchCommunities = async () => {
      try {
        setLoading(true);
        setError(null);

        let query = supabase
          .from("communities")
          .select(`
            *,
            creator:profiles!communities_created_by_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("privacy", "public")
          .limit(limit);

        // Filter by tag if provided
        if (options?.tag) {
          const { data: taggedCommunities } = await supabase
            .from("community_tags")
            .select("community_id")
            .ilike("tag", `%${options.tag}%`);

          if (!mountedRef.current) return;

          if (taggedCommunities && taggedCommunities.length > 0) {
            const communityIds = taggedCommunities.map(t => t.community_id);
            query = query.in("id", communityIds);
          } else {
            setCommunities([]);
            setLoading(false);
            return;
          }
        }

        const { data, error: fetchError } = await query;

        if (!mountedRef.current) return;
        if (fetchError) throw fetchError;

        if (!data || data.length === 0) {
          setCommunities([]);
          return;
        }

        // Get member counts
        const communityIds = data.map(c => c.id);
        const { data: membersData } = await supabase
          .from("community_members")
          .select("community_id")
          .in("community_id", communityIds)
          .eq("status", "active");

        if (!mountedRef.current) return;

        const memberCounts: Record<string, number> = {};
        (membersData || []).forEach(m => {
          memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
        });

        const enrichedCommunities = data.map(c => ({
          ...c,
          member_count: memberCounts[c.id] || 0,
        }));

        // Sort by member count (most popular first)
        enrichedCommunities.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));

        setCommunities(enrichedCommunities);
        // Set trending as top 6 by member count
        setTrending(enrichedCommunities.slice(0, 6));
      } catch (err: unknown) {
        console.error("[useDiscoverCommunities] Error:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Failed to discover communities");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchCommunities();

    return () => {
      mountedRef.current = false;
    };
  }, [options?.category, options?.tag, limit]);

  return { communities, trending, loading, error };
}

// Get suggested communities for a user
export function useSuggestedCommunities(userId?: string, limit: number = 10) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchSuggestions = async () => {
      try {
        setLoading(true);

        // Get communities user is already a member of
        let joinedIds: Set<string> = new Set();
        if (userId) {
          const { data: memberships } = await supabase
            .from("community_members")
            .select("community_id")
            .eq("user_id", userId);

          if (!mountedRef.current) return;
          joinedIds = new Set((memberships || []).map(m => m.community_id));
        }

        // Fetch public communities
        const { data, error } = await supabase
          .from("communities")
          .select(`
            *,
            creator:profiles!communities_created_by_fkey (
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("privacy", "public")
          .limit(limit * 2); // Fetch more to account for filtering

        if (!mountedRef.current) return;
        if (error) throw error;

        // Filter out joined communities
        const notJoined = (data || []).filter(c => !joinedIds.has(c.id));

        // Get member counts for sorting
        if (notJoined.length > 0) {
          const communityIds = notJoined.map(c => c.id);
          const { data: membersData } = await supabase
            .from("community_members")
            .select("community_id")
            .in("community_id", communityIds)
            .eq("status", "active");

          if (!mountedRef.current) return;

          const memberCounts: Record<string, number> = {};
          (membersData || []).forEach(m => {
            memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
          });

          const enriched = notJoined.map(c => ({
            ...c,
            member_count: memberCounts[c.id] || 0,
          }));

          // Sort by member count and take limit
          enriched.sort((a, b) => (b.member_count || 0) - (a.member_count || 0));
          setCommunities(enriched.slice(0, limit));
        } else {
          setCommunities([]);
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useSuggestedCommunities] Error:", err);
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    };

    fetchSuggestions();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [userId, limit]);

  return { communities, loading };
}

// Fetch community members
export function useCommunityMembers(communityId: string, options?: { role?: string; status?: string }) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchMembers = useCallback(async () => {
    if (!communityId) return;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);

      let query = supabase
        .from("community_members")
        .select(`
          *,
          profile:profiles!community_members_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url,
            is_verified
          )
        `)
        .eq("community_id", communityId)
        .order("joined_at", { ascending: true });

      if (options?.role) {
        query = query.eq("role", options.role);
      }
      if (options?.status) {
        query = query.eq("status", options.status);
      }

      const { data, error } = await query;

      if (!mountedRef.current) return;
      if (error) throw error;
      setMembers(data || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useCommunityMembers] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [communityId, options?.role, options?.status]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMembers();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchMembers]);

  return { members, loading, refetch: fetchMembers };
}

// Helper function to get start date for time range
function getTimeRangeStart(timeRange: 'today' | 'week' | 'month' | 'year' | 'all'): Date | null {
  const now = new Date();
  switch (timeRange) {
    case 'today':
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
    case 'week':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    case 'month':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    case 'year':
      return new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
    case 'all':
    default:
      return null;
  }
}

// Calculate hot score using Reddit-style algorithm
function calculateHotScore(admiresCount: number, commentsCount: number, relaysCount: number, createdAt: string): number {
  const hoursAge = Math.max(0, (Date.now() - new Date(createdAt).getTime()) / 3600000);
  const engagementScore = admiresCount + (commentsCount * 2) + (relaysCount * 1.5);
  return engagementScore / Math.pow(hoursAge + 2, 1.5);
}

// Fetch posts for a community
export function useCommunityPosts(
  communityId: string,
  userId?: string,
  sortBy: 'newest' | 'top' | 'hot' = 'newest',
  options?: { timeRange?: 'today' | 'week' | 'month' | 'year' | 'all'; flairId?: string }
) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [pinnedPostIds, setPinnedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch pinned post IDs
  const fetchPinnedPostIds = async () => {
    if (!communityId) return [];
    try {
      const { data, error } = await supabase
        .from("community_pinned_posts")
        .select("post_id, position")
        .eq("community_id", communityId)
        .order("position", { ascending: true });

      if (error) throw error;
      return (data || []).map(p => p.post_id);
    } catch (err) {
      console.error("[useCommunityPosts] Error fetching pinned posts:", err);
      return [];
    }
  };

  const fetchPosts = useCallback(async (pageNum: number = 0, append: boolean = false) => {
    if (!communityId) return;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      setError(null);

      // First fetch pinned post IDs
      const currentPinnedIds = await fetchPinnedPostIds();
      if (!mountedRef.current) return;
      setPinnedPostIds(currentPinnedIds);

      let query = supabase
        .from("posts")
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          media:post_media (
            id,
            media_url,
            media_type,
            caption,
            position
          ),
          flair:community_flairs (
            id,
            community_id,
            name,
            color,
            emoji,
            position,
            created_at
          )
        `)
        .eq("community_id", communityId)
        .eq("status", "published");

      // Apply time range filter for 'top' sort
      if (sortBy === 'top' && options?.timeRange && options.timeRange !== 'all') {
        const startDate = getTimeRangeStart(options.timeRange);
        if (startDate) {
          query = query.gte("created_at", startDate.toISOString());
        }
      }

      // Apply flair filter if specified
      if (options?.flairId) {
        query = query.eq("flair_id", options.flairId);
      }

      // Apply pagination
      query = query.range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      // For hot and top, we still order by created_at initially, then re-sort in memory
      // For newest, we just order by created_at
      query = query.order("created_at", { ascending: false });

      const { data, error: fetchError } = await query;

      if (!mountedRef.current) return;
      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        if (!append) setPosts([]);
        setHasMore(false);
        return;
      }

      // Get engagement counts for sorting
      const postIds = data.map(p => p.id);
      const [admiresResult, commentsResult, relaysResult, reactionsResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("relays").select("post_id").in("post_id", postIds),
        supabase.from("reactions").select("post_id, reaction_type").in("post_id", postIds),
      ]);

      if (!mountedRef.current) return;

      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};
      const relaysCounts: Record<string, number> = {};
      const reactionsCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach(a => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach(c => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });
      (relaysResult.data || []).forEach(r => {
        relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
      });
      (reactionsResult.data || []).forEach(r => {
        reactionsCounts[r.post_id] = (reactionsCounts[r.post_id] || 0) + 1;
      });

      // Check user interactions if logged in
      let userAdmires: Set<string> = new Set();
      let userSaves: Set<string> = new Set();
      let userRelays: Set<string> = new Set();
      const userReactions: Record<string, string> = {};

      if (userId) {
        const [userAdmiresResult, userSavesResult, userRelaysResult, userReactionsResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("reactions").select("post_id, reaction_type").eq("user_id", userId).in("post_id", postIds),
        ]);

        if (!mountedRef.current) return;

        userAdmires = new Set((userAdmiresResult.data || []).map(a => a.post_id));
        userSaves = new Set((userSavesResult.data || []).map(s => s.post_id));
        userRelays = new Set((userRelaysResult.data || []).map(r => r.post_id));
        (userReactionsResult.data || []).forEach(r => {
          userReactions[r.post_id] = r.reaction_type;
        });
      }

      const enrichedPosts = data.map(post => ({
        ...post,
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: relaysCounts[post.id] || 0,
        reactions_count: reactionsCounts[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
        user_reaction_type: userReactions[post.id] || null,
      }));

      // Sort by engagement for 'top' or hot score for 'hot'
      if (sortBy === 'top') {
        enrichedPosts.sort((a, b) => {
          const aScore = a.admires_count + a.comments_count * 2;
          const bScore = b.admires_count + b.comments_count * 2;
          return bScore - aScore;
        });
      } else if (sortBy === 'hot') {
        enrichedPosts.sort((a, b) => {
          const aScore = calculateHotScore(a.admires_count, a.comments_count, a.relays_count, a.created_at);
          const bScore = calculateHotScore(b.admires_count, b.comments_count, b.relays_count, b.created_at);
          return bScore - aScore;
        });
      }

      // Separate pinned posts from regular posts
      const pinned = enrichedPosts
        .filter(p => currentPinnedIds.includes(p.id))
        .sort((a, b) => currentPinnedIds.indexOf(a.id) - currentPinnedIds.indexOf(b.id));
      const regular = enrichedPosts.filter(p => !currentPinnedIds.includes(p.id));

      // Only set pinned posts on initial load (page 0)
      if (pageNum === 0) {
        setPinnedPosts(pinned);
      }

      if (append) {
        setPosts(prev => [...prev, ...regular]);
      } else {
        setPosts(regular);
      }

      setHasMore(data.length === pageSize);
      setPage(pageNum);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useCommunityPosts] Error:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch posts");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [communityId, sortBy, userId, options?.timeRange, options?.flairId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPosts(0, false);

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPosts]);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchPosts(page + 1, true);
    }
  }, [fetchPosts, loading, hasMore, page]);

  return { posts, pinnedPosts, loading, error, loadMore, hasMore, refetch: () => fetchPosts(0, false) };
}

// Join/leave community
export function useJoinCommunity() {
  const [isJoining, setIsJoining] = useState(false);

  const join = async (communityId: string, userId: string) => {
    setIsJoining(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: userId,
          role: "member",
          status: "active",
        });

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[join] Error:", err);
      return { success: false, error: err };
    } finally {
      setIsJoining(false);
    }
  };

  const leave = async (communityId: string, userId: string) => {
    setIsJoining(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[leave] Error:", err);
      return { success: false, error: err };
    } finally {
      setIsJoining(false);
    }
  };

  const requestJoin = async (communityId: string, userId: string, message?: string) => {
    setIsJoining(true);
    try {
      const { error } = await supabase
        .from("community_join_requests")
        .insert({
          community_id: communityId,
          user_id: userId,
          message: message || null,
          status: "pending",
        });

      if (error) throw error;

      // Notify all admins and moderators of the community about the join request
      const { data: admins } = await supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", communityId)
        .in("role", ["admin", "moderator"]);

      if (admins && admins.length > 0) {
        const notificationContent = message
          ? `Join request: "${message.substring(0, 100)}${message.length > 100 ? '...' : ''}"`
          : "Someone wants to join your community";

        await Promise.all(
          admins.map((admin) =>
            createNotification(
              admin.user_id,
              userId,
              "community_join_request",
              undefined,
              notificationContent,
              communityId
            )
          )
        );
      }

      return { success: true };
    } catch (err) {
      console.error("[requestJoin] Error:", err);
      return { success: false, error: err };
    } finally {
      setIsJoining(false);
    }
  };

  const cancelRequest = async (communityId: string, userId: string) => {
    setIsJoining(true);
    try {
      const { error } = await supabase
        .from("community_join_requests")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .eq("status", "pending");

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[cancelRequest] Error:", err);
      return { success: false, error: err };
    } finally {
      setIsJoining(false);
    }
  };

  return { join, leave, requestJoin, cancelRequest, isJoining };
}

// Community invitations for a user
export function useCommunityInvitations(userId?: string) {
  const [invitations, setInvitations] = useState<CommunityInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchInvitations = useCallback(async () => {
    if (!userId) {
      setInvitations([]);
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("community_invitations")
        .select(`
          *,
          community:communities (
            name,
            slug,
            avatar_url
          ),
          inviter:profiles!community_invitations_inviter_id_fkey (
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });

      if (!mountedRef.current) return;
      if (error) throw error;
      setInvitations(data || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useCommunityInvitations] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchInvitations();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchInvitations]);

  const accept = async (invitationId: string, communityId: string) => {
    if (!userId) return { success: false };

    try {
      // Update invitation status
      await supabase
        .from("community_invitations")
        .update({ status: "accepted", responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      // Add user as member
      await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: userId,
          role: "member",
          status: "active",
        });

      return { success: true };
    } catch (err) {
      console.error("[accept] Error:", err);
      return { success: false, error: err };
    }
  };

  const decline = async (invitationId: string) => {
    try {
      await supabase
        .from("community_invitations")
        .update({ status: "declined", responded_at: new Date().toISOString() })
        .eq("id", invitationId);

      return { success: true };
    } catch (err) {
      console.error("[decline] Error:", err);
      return { success: false, error: err };
    }
  };

  return { invitations, loading, accept, decline, refetch: fetchInvitations };
}

// Join requests for a community (for admins/mods)
export function useJoinRequests(communityId: string) {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!communityId) return;

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("community_join_requests")
        .select(`
          *,
          profile:profiles!community_join_requests_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq("community_id", communityId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (!mountedRef.current) return;
      if (error) throw error;
      setRequests(data || []);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      console.error("[useJoinRequests] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [communityId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchRequests();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchRequests]);

  const approve = async (requestId: string, visitorUserId: string, reviewerId: string) => {
    try {
      // Update request status
      await supabase
        .from("community_join_requests")
        .update({
          status: "approved",
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      // Add user as member
      await supabase
        .from("community_members")
        .insert({
          community_id: communityId,
          user_id: visitorUserId,
          role: "member",
          status: "active",
        });

      // Notify the user
      await createNotification(visitorUserId, reviewerId, 'community_join_approved', undefined, undefined, communityId);

      return { success: true };
    } catch (err) {
      console.error("[approve] Error:", err);
      return { success: false, error: err };
    }
  };

  const reject = async (requestId: string, reviewerId: string) => {
    try {
      await supabase
        .from("community_join_requests")
        .update({
          status: "rejected",
          reviewed_by: reviewerId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      return { success: true };
    } catch (err) {
      console.error("[reject] Error:", err);
      return { success: false, error: err };
    }
  };

  return { requests, loading, approve, reject, refetch: fetchRequests };
}

// Create a new community
export function useCreateCommunity() {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async (data: {
    name: string;
    slug: string;
    description?: string;
    privacy?: 'public' | 'private';
    topics?: string[];
    avatar_url?: string;
    cover_url?: string;
    tags?: { tag: string; tag_type: string }[];
    rules?: { title: string; description: string }[];
  }, userId: string) => {
    setCreating(true);
    setError(null);

    try {
      // Create the community
      const { data: community, error: createError } = await supabase
        .from("communities")
        .insert({
          name: data.name,
          slug: data.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
          description: data.description || null,
          privacy: data.privacy || 'public',
          topics: data.topics || [],
          avatar_url: data.avatar_url || null,
          cover_url: data.cover_url || null,
          created_by: userId,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Add creator as admin
      await supabase
        .from("community_members")
        .insert({
          community_id: community.id,
          user_id: userId,
          role: "admin",
          status: "active",
        });

      // Add tags if provided
      if (data.tags && data.tags.length > 0) {
        const tagsData = data.tags.map(t => ({
          community_id: community.id,
          tag: t.tag,
          tag_type: t.tag_type,
        }));
        await supabase.from("community_tags").insert(tagsData);
      }

      // Add rules if provided
      if (data.rules && data.rules.length > 0) {
        const rulesData = data.rules.map((rule, index) => ({
          community_id: community.id,
          rule_number: index + 1,
          title: rule.title,
          description: rule.description || null,
        }));
        await supabase.from("community_rules").insert(rulesData);
      }

      return { success: true, community };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to create community";
      console.error("[create] Error:", err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setCreating(false);
    }
  };

  return { create, creating, error };
}

// Update a community
export function useUpdateCommunity() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // SECURITY: Helper to verify user has admin/moderator permissions
  const verifyPermission = async (communityId: string): Promise<{ userId: string } | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error("Not authenticated");
    }

    // Check if user is admin or moderator of this community
    const { data: membership } = await supabase
      .from("community_members")
      .select("role")
      .eq("community_id", communityId)
      .eq("user_id", user.id)
      .single();

    if (!membership || !["admin", "moderator"].includes(membership.role)) {
      throw new Error("You don't have permission to modify this community");
    }

    return { userId: user.id };
  };

  const update = async (communityId: string, data: Partial<{
    name: string;
    description: string;
    privacy: 'public' | 'private';
    topics: string[];
    avatar_url: string;
    cover_url: string;
  }>) => {
    setUpdating(true);
    setError(null);

    try {
      // SECURITY: Verify user has permission to update this community
      await verifyPermission(communityId);

      const { error: updateError } = await supabase
        .from("communities")
        .update({
          ...data,
          updated_at: new Date().toISOString(),
        })
        .eq("id", communityId);

      if (updateError) throw updateError;

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update community";
      console.error("[update] Error:", err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setUpdating(false);
    }
  };

  const updateRules = async (communityId: string, rules: { title: string; description: string }[]) => {
    setUpdating(true);
    setError(null);

    try {
      // SECURITY: Verify user has permission to update rules
      await verifyPermission(communityId);

      // Delete existing rules
      await supabase
        .from("community_rules")
        .delete()
        .eq("community_id", communityId);

      // Insert new rules
      if (rules.length > 0) {
        const rulesData = rules.map((rule, index) => ({
          community_id: communityId,
          rule_number: index + 1,
          title: rule.title,
          description: rule.description || null,
        }));

        const { error: insertError } = await supabase
          .from("community_rules")
          .insert(rulesData);

        if (insertError) throw insertError;
      }

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to update rules";
      console.error("[updateRules] Error:", err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setUpdating(false);
    }
  };

  return { update, updateRules, updating, error };
}

// Delete a community
export function useDeleteCommunity() {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteCommunity = async (communityId: string) => {
    setDeleting(true);
    setError(null);

    try {
      // SECURITY: Verify user is admin of this community (only admins can delete)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("Not authenticated");
      }

      const { data: membership } = await supabase
        .from("community_members")
        .select("role")
        .eq("community_id", communityId)
        .eq("user_id", user.id)
        .single();

      if (!membership || membership.role !== "admin") {
        throw new Error("Only community admins can delete communities");
      }

      // Delete in order: rules, tags, members, join requests, invitations, posts (set community_id to null), then community
      await Promise.all([
        supabase.from("community_rules").delete().eq("community_id", communityId),
        supabase.from("community_tags").delete().eq("community_id", communityId),
        supabase.from("community_members").delete().eq("community_id", communityId),
        supabase.from("community_join_requests").delete().eq("community_id", communityId),
        supabase.from("community_invitations").delete().eq("community_id", communityId),
      ]);

      // Remove community reference from posts (don't delete the posts)
      await supabase
        .from("posts")
        .update({ community_id: null })
        .eq("community_id", communityId);

      // Finally delete the community
      const { error: deleteError } = await supabase
        .from("communities")
        .delete()
        .eq("id", communityId);

      if (deleteError) throw deleteError;

      return { success: true };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Failed to delete community";
      console.error("[deleteCommunity] Error:", err);
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setDeleting(false);
    }
  };

  return { delete: deleteCommunity, deleting, error };
}

// Import moderator permissions types
import type { ModeratorPermissions } from './types';
import { DEFAULT_MODERATOR_PERMISSIONS, FULL_MODERATOR_PERMISSIONS } from './types';

// Community moderation actions
export function useCommunityModeration(communityId: string) {
  const [loading, setLoading] = useState(false);

  const updateMemberRole = async (
    userId: string,
    role: 'admin' | 'moderator' | 'member',
    actorId: string,
    permissions?: ModeratorPermissions
  ) => {
    setLoading(true);
    try {
      const updateData: { role: string; permissions?: ModeratorPermissions | null } = { role };

      // Set permissions based on role
      if (role === 'moderator') {
        updateData.permissions = permissions || DEFAULT_MODERATOR_PERMISSIONS;
      } else if (role === 'member') {
        // Clear permissions when demoting to member
        updateData.permissions = null;
      }
      // Admins don't need permissions stored - they have all permissions implicitly

      const { error } = await supabase
        .from("community_members")
        .update(updateData)
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;

      // Build notification content
      let notificationContent = `Your role has been changed to ${role}`;
      if (role === 'moderator' && permissions) {
        const enabledPermissions = Object.entries(permissions)
          .filter(([_, enabled]) => enabled)
          .map(([key]) => key.replace('can_', '').replace(/_/g, ' '));
        if (enabledPermissions.length > 0) {
          notificationContent += `. You can: ${enabledPermissions.join(', ')}`;
        }
      }

      // Notify the user of role change
      await createNotification(userId, actorId, 'community_role_change', undefined, notificationContent, communityId);

      return { success: true };
    } catch (err) {
      console.error("[updateMemberRole] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Update moderator permissions without changing role
  const updateModeratorPermissions = async (userId: string, permissions: ModeratorPermissions) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .update({ permissions })
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .eq("role", "moderator");

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[updateModeratorPermissions] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Get moderator permissions for a user
  const getModeratorPermissions = async (userId: string): Promise<ModeratorPermissions | null> => {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select("role, permissions")
        .eq("community_id", communityId)
        .eq("user_id", userId)
        .single();

      if (error || !data) return null;

      // Admins have full permissions
      if (data.role === 'admin') {
        return FULL_MODERATOR_PERMISSIONS;
      }

      // Moderators have stored permissions
      if (data.role === 'moderator') {
        return data.permissions || DEFAULT_MODERATOR_PERMISSIONS;
      }

      // Members have no permissions
      return null;
    } catch (err) {
      console.error("[getModeratorPermissions] Error:", err);
      return null;
    }
  };

  // Check if a user has a specific permission
  const hasPermission = async (userId: string, permission: keyof ModeratorPermissions): Promise<boolean> => {
    const permissions = await getModeratorPermissions(userId);
    if (!permissions) return false;
    return permissions[permission] === true;
  };

  // Delete a post from the community
  const deletePost = async (postId: string, reason?: string): Promise<{ success: boolean; error?: unknown }> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      // Check if user has permission
      const canDelete = await hasPermission(user.id, 'can_delete_posts');
      if (!canDelete) {
        return { success: false, error: 'You do not have permission to delete posts' };
      }

      // Get post info for audit log
      const { data: post } = await supabase
        .from("posts")
        .select("author_id")
        .eq("id", postId)
        .single();

      // Log the deletion (must succeed before we delete the post)
      const { error: auditError } = await supabase.from("community_content_deletions").insert({
        community_id: communityId,
        content_type: 'post',
        content_id: postId,
        content_author_id: post?.author_id,
        deleted_by: user.id,
        reason: reason || null,
      });

      if (auditError) {
        console.error("[deletePost] Audit log failed:", auditError);
        return { success: false, error: 'Failed to create audit log for deletion' };
      }

      // Delete the post
      const { error } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("community_id", communityId);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error("[deletePost] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Delete a comment from a community post
  const deleteComment = async (commentId: string, postId?: string, reason?: string): Promise<{ success: boolean; error?: unknown }> => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { success: false, error: 'Not authenticated' };

      // Check if user has permission
      const canDelete = await hasPermission(user.id, 'can_delete_comments');
      if (!canDelete) {
        return { success: false, error: 'You do not have permission to delete comments' };
      }

      // Get comment info (including post_id if not provided)
      const { data: comment } = await supabase
        .from("comments")
        .select("user_id, post_id")
        .eq("id", commentId)
        .single();

      if (!comment) {
        return { success: false, error: 'Comment not found' };
      }

      // Use the post_id from comment if not explicitly provided
      const effectivePostId = postId || comment.post_id;

      // Verify the post belongs to this community
      const { data: post } = await supabase
        .from("posts")
        .select("id")
        .eq("id", effectivePostId)
        .eq("community_id", communityId)
        .single();

      if (!post) {
        return { success: false, error: 'Post not found in this community' };
      }

      // Log the deletion
      await supabase.from("community_content_deletions").insert({
        community_id: communityId,
        content_type: 'comment',
        content_id: commentId,
        content_author_id: comment.user_id,
        deleted_by: user.id,
        reason: reason || null,
      });

      // Delete the comment
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId)
        .eq("post_id", effectivePostId);

      if (error) throw error;

      return { success: true };
    } catch (err) {
      console.error("[deleteComment] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  const updateMemberStatus = async (
    userId: string,
    status: 'active' | 'muted' | 'banned',
    actorId: string,
    options?: {
      mutedUntil?: Date;
      muteReason?: string;
      bannedUntil?: Date;
      banReason?: string;
    }
  ) => {
    setLoading(true);
    try {
      const updateData: {
        status: string;
        muted_until?: string | null;
        mute_reason?: string | null;
        banned_until?: string | null;
        ban_reason?: string | null;
      } = { status };

      if (status === 'muted') {
        updateData.muted_until = options?.mutedUntil ? options.mutedUntil.toISOString() : null;
        updateData.mute_reason = options?.muteReason || null;
      } else {
        updateData.muted_until = null;
        updateData.mute_reason = null;
      }

      if (status === 'banned') {
        updateData.banned_until = options?.bannedUntil ? options.bannedUntil.toISOString() : null;
        updateData.ban_reason = options?.banReason || null;
      } else {
        updateData.banned_until = null;
        updateData.ban_reason = null;
      }

      const { error } = await supabase
        .from("community_members")
        .update(updateData)
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;

      // Build notification content with duration/reason info
      let notificationContent: string | undefined;
      if (status === 'muted') {
        const parts: string[] = [];
        if (options?.mutedUntil) {
          const duration = formatDuration(options.mutedUntil);
          parts.push(`You have been muted for ${duration}`);
        } else {
          parts.push("You have been muted indefinitely");
        }
        if (options?.muteReason) {
          parts.push(`Reason: ${options.muteReason}`);
        }
        notificationContent = parts.join(". ");
      } else if (status === 'banned') {
        const parts: string[] = [];
        if (options?.bannedUntil) {
          const duration = formatDuration(options.bannedUntil);
          parts.push(`You have been banned for ${duration}`);
        } else {
          parts.push("You have been permanently banned");
        }
        if (options?.banReason) {
          parts.push(`Reason: ${options.banReason}`);
        }
        notificationContent = parts.join(". ");
      }

      // Notify the user
      const notificationType = status === 'muted' ? 'community_muted' : status === 'banned' ? 'community_banned' : undefined;
      if (notificationType) {
        await createNotification(userId, actorId, notificationType, undefined, notificationContent, communityId);
      }

      return { success: true };
    } catch (err) {
      console.error("[updateMemberStatus] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Helper to format duration in a human-readable way
  const formatDuration = (until: Date): string => {
    const now = new Date();
    const diffMs = until.getTime() - now.getTime();
    const diffHours = Math.round(diffMs / (1000 * 60 * 60));
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 24) {
      return `${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
    } else if (diffDays < 7) {
      return `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    } else if (diffDays < 30) {
      const weeks = Math.round(diffDays / 7);
      return `${weeks} week${weeks !== 1 ? 's' : ''}`;
    } else {
      const months = Math.round(diffDays / 30);
      return `${months} month${months !== 1 ? 's' : ''}`;
    }
  };

  const removeMember = async (userId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .delete()
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[removeMember] Error:", err);
      return { success: false, error: err };
    } finally {
      setLoading(false);
    }
  };

  // Helper functions that auto-fetch actorId from auth
  const promoteUser = async (userId: string, role: 'moderator' | 'admin', permissions?: ModeratorPermissions) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberRole(userId, role, user.id, permissions);
  };

  const demoteUser = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberRole(userId, 'member', user.id);
  };

  const muteUser = async (userId: string, options?: { mutedUntil?: Date; reason?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberStatus(userId, 'muted', user.id, {
      mutedUntil: options?.mutedUntil,
      muteReason: options?.reason,
    });
  };

  const banUser = async (userId: string, options?: { bannedUntil?: Date; reason?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberStatus(userId, 'banned', user.id, {
      bannedUntil: options?.bannedUntil,
      banReason: options?.reason,
    });
  };

  const unmuteUser = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberStatus(userId, 'active', user.id);
  };

  const unbanUser = async (userId: string) => {
    // When unbanning, we remove the member entirely so they can rejoin
    return removeMember(userId);
  };

  const checkExpiredMutes = async () => {
    try {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from("community_members")
        .update({ status: 'active', muted_until: null })
        .eq("community_id", communityId)
        .eq("status", "muted")
        .lt("muted_until", now);

      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error("[checkExpiredMutes] Error:", err);
      return { success: false, error: err };
    }
  };

  const inviteUser = async (inviterId: string, inviteeId: string) => {
    try {
      const { error } = await supabase
        .from("community_invitations")
        .insert({
          community_id: communityId,
          inviter_id: inviterId,
          invitee_id: inviteeId,
          status: 'pending',
        });

      if (error) throw error;

      // Notify the invitee
      await createNotification(inviteeId, inviterId, 'community_invite', undefined, undefined, communityId);

      return { success: true };
    } catch (err) {
      console.error("[inviteUser] Error:", err);
      return { success: false, error: err };
    }
  };

  return {
    updateMemberRole,
    updateMemberStatus,
    removeMember,
    promoteUser,
    demoteUser,
    muteUser,
    banUser,
    unmuteUser,
    unbanUser,
    checkExpiredMutes,
    inviteUser,
    updateModeratorPermissions,
    getModeratorPermissions,
    hasPermission,
    deletePost,
    deleteComment,
    loading,
  };
}

// ============================================
// SEARCH
// ============================================

export interface SearchResultProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface SearchResultCommunity {
  id: string;
  slug: string;
  name: string;
  avatar_url: string | null;
  member_count: number;
}

export interface SearchResultTag {
  tag: string;
  community_count: number;
}

export interface SearchResults {
  profiles: SearchResultProfile[];
  communities: SearchResultCommunity[];
  tags: SearchResultTag[];
}

export function useSearch(query: string, options?: { debounceMs?: number; limit?: number }) {
  const [results, setResults] = useState<SearchResults>({ profiles: [], communities: [], tags: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const debounceMs = options?.debounceMs ?? 300;
  const limit = options?.limit ?? 5;

  useEffect(() => {
    mountedRef.current = true;

    // Don't search if query is too short
    if (!query || query.trim().length < 2) {
      setResults({ profiles: [], communities: [], tags: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const timeoutId = setTimeout(async () => {
      try {
        const searchQuery = query.trim();

        // Run all searches in parallel
        const [profilesResult, communitiesResult, tagsResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url")
            .or(`username.ilike.%${searchQuery}%,display_name.ilike.%${searchQuery}%`)
            .limit(limit),
          supabase
            .from("communities")
            .select("id, slug, name, avatar_url")
            .eq("privacy", "public")
            .or(`name.ilike.%${searchQuery}%,description.ilike.%${searchQuery}%`)
            .limit(limit),
          supabase
            .from("community_tags")
            .select("tag")
            .ilike("tag", `%${searchQuery}%`)
            .limit(limit * 2),
        ]);

        if (!mountedRef.current) return;

        const profiles = (profilesResult.data || []) as SearchResultProfile[];

        const communities = communitiesResult.data || [];
        let enrichedCommunities: SearchResultCommunity[] = [];

        if (communities.length > 0) {
          const communityIds = communities.map(c => c.id);
          const { data: membersData } = await supabase
            .from("community_members")
            .select("community_id")
            .in("community_id", communityIds)
            .eq("status", "active");

          if (!mountedRef.current) return;

          const memberCounts: Record<string, number> = {};
          (membersData || []).forEach(m => {
            memberCounts[m.community_id] = (memberCounts[m.community_id] || 0) + 1;
          });

          enrichedCommunities = communities.map(c => ({
            ...c,
            member_count: memberCounts[c.id] || 0,
          }));
        }

        const tagCounts: Record<string, number> = {};
        (tagsResult.data || []).forEach(t => {
          tagCounts[t.tag] = (tagCounts[t.tag] || 0) + 1;
        });

        const tags: SearchResultTag[] = Object.entries(tagCounts)
          .map(([tag, count]) => ({ tag, community_count: count }))
          .slice(0, limit);

        if (mountedRef.current) {
          setResults({ profiles, communities: enrichedCommunities, tags });
        }
      } catch (err: unknown) {
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useSearch] Error:", err);
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "Search failed");
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }, debounceMs);

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [query, debounceMs, limit]);

  return { results, loading, error };
}

// ============================================
// COLLABORATOR & MENTION TYPES
// ============================================

export type CollaboratorStatus = 'pending' | 'accepted' | 'declined';

export interface Collaborator {
  id: string;
  post_id: string;
  user_id: string;
  status: CollaboratorStatus;
  invited_at: string;
  responded_at: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Mention {
  id: string;
  post_id: string;
  user_id: string;
  created_at: string;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CollaborationInvite {
  id: string;
  post_id: string;
  user_id: string;
  status: CollaboratorStatus;
  invited_at: string;
  post: {
    id: string;
    title: string | null;
    type: string;
    content: string;
    status: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}

// ============================================
// COLLABORATOR HOOKS
// ============================================

export function useCollaborators(postId?: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCollaborators = useCallback(async () => {
    if (!postId) {
      setCollaborators([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_collaborators')
        .select(`
          *,
          user:profiles!post_collaborators_user_id_fkey (
            id,
            username,
            display_name,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('invited_at', { ascending: true });

      if (!mountedRef.current) return;
      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error('[useCollaborators] Error:', err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [postId]);

  // Keep ref updated for subscription callback
  const fetchCollaboratorsRef = useRef(fetchCollaborators);
  useEffect(() => {
    fetchCollaboratorsRef.current = fetchCollaborators;
  }, [fetchCollaborators]);

  useEffect(() => {
    mountedRef.current = true;
    fetchCollaborators();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchCollaborators]);

  // Subscription - only depends on postId
  useEffect(() => {
    if (!postId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`collaborators-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_collaborators', filter: `post_id=eq.${postId}` }, () => {
        fetchCollaboratorsRef.current();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [postId]);

  const inviteCollaborator = async (userId: string, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase.from('post_collaborators').insert({ post_id: postId, user_id: userId, status: 'pending' });
      if (error) throw error;
      await createNotification(userId, authorId, 'collaboration_invite', postId);
      return { success: true };
    } catch (err) {
      console.error('[inviteCollaborator] Error:', err);
      return { success: false, error: err };
    }
  };

  const removeCollaborator = async (userId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase.from('post_collaborators').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('[removeCollaborator] Error:', err);
      return { success: false, error: err };
    }
  };

  const respondToInvite = async (userId: string, accept: boolean, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase
        .from('post_collaborators')
        .update({ status: accept ? 'accepted' : 'declined', responded_at: new Date().toISOString() })
        .eq('post_id', postId)
        .eq('user_id', userId);
      if (error) throw error;
      await createNotification(authorId, userId, accept ? 'collaboration_accepted' : 'collaboration_declined', postId);
      return { success: true };
    } catch (err) {
      console.error('[respondToInvite] Error:', err);
      return { success: false, error: err };
    }
  };

  return { collaborators, loading, inviteCollaborator, removeCollaborator, respondToInvite, refetch: fetchCollaborators };
}

export function useCollaborationInvites(userId?: string) {
  const [invites, setInvites] = useState<CollaborationInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchInvites = useCallback(async () => {
    if (!userId) { setInvites([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_collaborators')
        .select(`*, post:posts (id, title, type, content, status, author:profiles!posts_author_id_fkey (id, username, display_name, avatar_url))`)
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('invited_at', { ascending: false });

      if (!mountedRef.current) return;
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) { setInvites([]); return; }
        throw error;
      }
      setInvites(data || []);
    } catch (err) {
      console.error('[useCollaborationInvites] Error:', err);
      if (mountedRef.current) setInvites([]);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  // Keep ref updated for subscription callback
  const fetchInvitesRef = useRef(fetchInvites);
  useEffect(() => {
    fetchInvitesRef.current = fetchInvites;
  }, [fetchInvites]);

  useEffect(() => {
    mountedRef.current = true;
    fetchInvites();
    return () => { mountedRef.current = false; };
  }, [fetchInvites]);

  // Subscription - only depends on userId
  useEffect(() => {
    if (!userId) return;

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`collab-invites-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_collaborators', filter: `user_id=eq.${userId}` }, () => { fetchInvitesRef.current(); })
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]);

  const accept = async (postId: string, authorId: string) => {
    if (!userId) return { success: false };
    try {
      const { error } = await supabase.from('post_collaborators').update({ status: 'accepted', responded_at: new Date().toISOString() }).eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
      await createNotification(authorId, userId, 'collaboration_accepted', postId);
      return { success: true };
    } catch (err) {
      console.error('[accept] Error:', err);
      return { success: false, error: err };
    }
  };

  const decline = async (postId: string, authorId: string) => {
    if (!userId) return { success: false };
    try {
      const { error } = await supabase.from('post_collaborators').update({ status: 'declined', responded_at: new Date().toISOString() }).eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
      await createNotification(authorId, userId, 'collaboration_declined', postId);
      return { success: true };
    } catch (err) {
      console.error('[decline] Error:', err);
      return { success: false, error: err };
    }
  };

  return { invites, loading, accept, decline, refetch: fetchInvites };
}

export function usePendingCollaborations(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchPending = useCallback(async () => {
    if (!userId) { setPosts([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('posts')
        .select(`*, author:profiles!posts_author_id_fkey (username, display_name, avatar_url), media:post_media (id, media_url, media_type, caption, position), collaborators:post_collaborators (status, user:profiles!post_collaborators_user_id_fkey (id, username, display_name, avatar_url))`)
        .eq('author_id', userId)
        .eq('status', 'draft')
        .order('created_at', { ascending: false });

      if (!mountedRef.current) return;
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[usePendingCollaborations] Error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPending();
    return () => { mountedRef.current = false; };
  }, [fetchPending]);

  return { posts, loading, refetch: fetchPending };
}

// ============================================
// MENTION HOOKS
// ============================================

export function useMentions(postId?: string) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchMentions = useCallback(async () => {
    if (!postId) { setMentions([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_mentions')
        .select(`*, user:profiles!post_mentions_user_id_fkey (id, username, display_name, avatar_url)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (!mountedRef.current) return;
      if (error) throw error;
      setMentions(data || []);
    } catch (err) {
      console.error('[useMentions] Error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMentions();
    return () => { mountedRef.current = false; };
  }, [fetchMentions]);

  const addMention = async (userId: string, authorId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase.from('post_mentions').insert({ post_id: postId, user_id: userId });
      if (error) throw error;
      await createNotification(userId, authorId, 'mention', postId);
      return { success: true };
    } catch (err) {
      console.error('[addMention] Error:', err);
      return { success: false, error: err };
    }
  };

  const removeMention = async (userId: string) => {
    if (!postId) return { success: false, error: 'No post ID' };
    try {
      const { error } = await supabase.from('post_mentions').delete().eq('post_id', postId).eq('user_id', userId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('[removeMention] Error:', err);
      return { success: false, error: err };
    }
  };

  return { mentions, loading, addMention, removeMention, refetch: fetchMentions };
}

export function useMentionedPosts(userId?: string) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);

  const fetchMentioned = useCallback(async () => {
    if (!userId) { setPosts([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data: mentionData, error: mentionError } = await supabase.from('post_mentions').select('post_id').eq('user_id', userId);

      if (!mountedRef.current) return;
      if (mentionError) throw mentionError;
      if (!mentionData || mentionData.length === 0) { setPosts([]); setLoading(false); return; }

      const postIds = mentionData.map(m => m.post_id);
      const { data, error } = await supabase
        .from('posts')
        .select(`*, author:profiles!posts_author_id_fkey (username, display_name, avatar_url), media:post_media (id, media_url, media_type, caption, position)`)
        .in('id', postIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false });

      if (!mountedRef.current) return;
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[useMentionedPosts] Error:', err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchMentioned();
    return () => { mountedRef.current = false; };
  }, [fetchMentioned]);

  return { posts, loading, refetch: fetchMentioned };
}

// ============================================
// USER SEARCH HOOK (for people picker)
// ============================================

export interface SearchableUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

export function useUserSearch(currentUserId?: string) {
  const [results, setResults] = useState<SearchableUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SearchableUser[]>([]);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  const fetchSuggestions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase.from('follows').select(`following:profiles!follows_following_id_fkey (id, username, display_name, avatar_url, is_verified)`).eq('follower_id', currentUserId).limit(20);
      if (!mountedRef.current) return;
      if (error) throw error;
      setSuggestions(data?.map(d => d.following as unknown as SearchableUser) || []);
    } catch (err) {
      console.error('[fetchSuggestions] Error:', err);
    }
  }, [currentUserId]);

  useEffect(() => {
    mountedRef.current = true;
    fetchSuggestions();
    return () => { mountedRef.current = false; };
  }, [fetchSuggestions]);

  const search = useCallback(async (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const blockedUsers: Set<string> = new Set();
        if (currentUserId) {
          const [blockedBy, iBlocked] = await Promise.all([
            supabase.from('blocks').select('blocker_id').eq('blocked_id', currentUserId),
            supabase.from('blocks').select('blocked_id').eq('blocker_id', currentUserId),
          ]);
          if (!mountedRef.current) return;
          (blockedBy.data || []).forEach(b => blockedUsers.add(b.blocker_id));
          (iBlocked.data || []).forEach(b => blockedUsers.add(b.blocked_id));
        }
        const { data, error } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_verified').or(`username.ilike.%${query.toLowerCase()}%,display_name.ilike.%${query.toLowerCase()}%`).limit(20);
        if (!mountedRef.current) return;
        if (error) throw error;
        setResults((data || []).filter(u => u.id !== currentUserId && !blockedUsers.has(u.id)));
      } catch (err) {
        console.error('[useUserSearch] Error:', err);
        if (mountedRef.current) setResults([]);
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }, 300);
  }, [currentUserId]);

  useEffect(() => { return () => { if (debounceRef.current) clearTimeout(debounceRef.current); }; }, []);

  return { results, loading, search, suggestions };
}

// ============================================
// HELPER: Batch save collaborators and mentions
// ============================================

export async function saveCollaboratorsAndMentions(
  postId: string,
  authorId: string,
  collaborators: { id: string; role?: string }[],
  mentionIds: string[],
  hasCollaborators: boolean
): Promise<{ success: boolean; collaboratorsAdded: boolean; notificationsSent: boolean; error?: unknown }> {
  let collaboratorsAdded = false;
  let notificationsSent = false;

  try {
    if (hasCollaborators && collaborators.length > 0) {
      await supabase.from('posts').update({ status: 'draft' }).eq('id', postId);
    }

    if (collaborators.length > 0) {
      const { error: collabError } = await supabase.from('post_collaborators').insert(collaborators.map(c => ({ post_id: postId, user_id: c.id, status: 'pending' as const, role: c.role || null }))).select();
      if (!collabError) {
        collaboratorsAdded = true;
        const results = await Promise.all(collaborators.map(c => createNotification(c.id, authorId, 'collaboration_invite', postId)));
        notificationsSent = results.some(r => r === true);
      }
    }

    if (mentionIds.length > 0) {
      const { error: mentionError } = await supabase.from('post_mentions').insert(mentionIds.map(userId => ({ post_id: postId, user_id: userId }))).select();
      if (!mentionError) {
        await Promise.all(mentionIds.map(userId => createNotification(userId, authorId, 'mention', postId)));
      }
    }

    return { success: true, collaboratorsAdded, notificationsSent };
  } catch (err) {
    console.error('[saveCollaboratorsAndMentions] Error:', err);
    return { success: false, collaboratorsAdded, notificationsSent, error: err };
  }
}

// ============================================
// HELPER: Fetch posts with collaborators for profile
// ============================================

export async function fetchCollaboratedPosts(userId: string) {
  try {
    const { data: collabData, error: collabError } = await supabase.from('post_collaborators').select('post_id').eq('user_id', userId).eq('status', 'accepted');
    if (collabError) {
      if (collabError.code === '42P01' || collabError.message?.includes('does not exist')) return [];
      throw collabError;
    }
    if (!collabData || collabData.length === 0) return [];
    const { data: posts, error: postsError } = await supabase
      .from('posts')
      .select(`*, author:profiles!posts_author_id_fkey (username, display_name, avatar_url), media:post_media (id, media_url, media_type, caption, position), collaborators:post_collaborators (status, user:profiles!post_collaborators_user_id_fkey (id, username, display_name, avatar_url))`)
      .in('id', collabData.map(c => c.post_id))
      .eq('status', 'published')
      .order('created_at', { ascending: false });
    if (postsError) throw postsError;
    return posts || [];
  } catch (err) {
    console.error('[fetchCollaboratedPosts] Error:', err);
    return [];
  }
}
