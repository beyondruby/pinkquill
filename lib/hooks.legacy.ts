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
import type { Post } from "./types";

// ============================================
// COMMUNITY TYPES
// ============================================

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  privacy: 'public' | 'private';
  topics: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  post_count?: number;
  is_member?: boolean;
  user_role?: 'admin' | 'moderator' | 'member' | null;
  user_status?: 'active' | 'muted' | 'banned' | null;
  has_pending_request?: boolean;
  has_pending_invitation?: boolean;
  pending_invitation_id?: string;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'banned';
  muted_until: string | null;
  joined_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface CommunityRule {
  id: string;
  community_id: string;
  rule_number: number;
  title: string;
  description: string | null;
}

export interface CommunityTag {
  id: string;
  community_id: string;
  tag: string;
  tag_type: 'genre' | 'theme' | 'type' | 'custom';
}

export interface JoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  message: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_id: string;
  status: 'pending' | 'accepted' | 'declined';
  created_at: string;
  responded_at: string | null;
  community: {
    name: string;
    slug: string;
    avatar_url: string | null;
  };
  inviter: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

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

  const fetchCommunity = async () => {
    if (!slug) return;

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

      if (communityError) {
        if (communityError.code === 'PGRST116') {
          setError("Community not found");
        } else {
          throw communityError;
        }
        return;
      }

      // Fetch counts and user membership in parallel
      const [membersResult, postsResult, userMemberResult, pendingRequestResult, pendingInvitationResult, rulesResult, tagsResult] = await Promise.all([
        supabase.from("community_members").select("*", { count: "exact", head: true }).eq("community_id", communityData.id).eq("status", "active"),
        supabase.from("posts").select("*", { count: "exact", head: true }).eq("community_id", communityData.id),
        userId ? supabase.from("community_members").select("role, status").eq("community_id", communityData.id).eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_join_requests").select("id").eq("community_id", communityData.id).eq("user_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        userId ? supabase.from("community_invitations").select("id").eq("community_id", communityData.id).eq("invitee_id", userId).eq("status", "pending").maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("community_rules").select("*").eq("community_id", communityData.id).order("rule_number", { ascending: true }),
        supabase.from("community_tags").select("*").eq("community_id", communityData.id),
      ]);

      setCommunity({
        ...communityData,
        member_count: membersResult.count || 0,
        post_count: postsResult.count || 0,
        is_member: !!userMemberResult.data && userMemberResult.data.status === 'active',
        user_role: userMemberResult.data?.role || null,
        user_status: userMemberResult.data?.status || null,
        has_pending_request: !!pendingRequestResult.data,
        has_pending_invitation: !!pendingInvitationResult.data,
        pending_invitation_id: pendingInvitationResult.data?.id || undefined,
      });

      setRules(rulesResult.data || []);
      setTags(tagsResult.data || []);
    } catch (err) {
      console.error("[useCommunity] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch community");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunity();
  }, [slug, userId]);

  return { community, rules, tags, loading, error, refetch: fetchCommunity };
}

// Fetch list of communities
export function useCommunities(userId?: string, filter?: 'all' | 'joined' | 'created') {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .order("created_at", { ascending: false });

      // Apply filter
      if (filter === 'created' && userId) {
        query = query.eq('created_by', userId);
      }

      const { data: communitiesData, error: communitiesError } = await query;

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
    } catch (err) {
      console.error("[useCommunities] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch communities");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommunities();
  }, [userId, filter]);

  return { communities, loading, error, refetch: fetchCommunities };
}

// Discover communities (for explore/browse)
export function useDiscoverCommunities(options?: { category?: string; tag?: string; limit?: number }) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [trending, setTrending] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const limit = options?.limit ?? 20;

  useEffect(() => {
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
      } catch (err) {
        console.error("[useDiscoverCommunities] Error:", err);
        setError(err instanceof Error ? err.message : "Failed to discover communities");
      } finally {
        setLoading(false);
      }
    };

    fetchCommunities();
  }, [options?.category, options?.tag, limit]);

  return { communities, trending, loading, error };
}

// Get suggested communities for a user
export function useSuggestedCommunities(userId?: string, limit: number = 10) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      } catch (err) {
        console.error("[useSuggestedCommunities] Error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSuggestions();
  }, [userId, limit]);

  return { communities, loading };
}

// Fetch community members
export function useCommunityMembers(communityId: string, options?: { role?: string; status?: string }) {
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMembers = async () => {
    if (!communityId) return;

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

      if (error) throw error;
      setMembers(data || []);
    } catch (err) {
      console.error("[useCommunityMembers] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [communityId, options?.role, options?.status]);

  return { members, loading, refetch: fetchMembers };
}

// Fetch posts for a community
export function useCommunityPosts(communityId: string, userId?: string, sortBy: 'newest' | 'top' = 'newest') {
  const [posts, setPosts] = useState<Post[]>([]);
  const [pinnedPosts, setPinnedPosts] = useState<Post[]>([]);
  const [pinnedPostIds, setPinnedPostIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const pageSize = 20;

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

  const fetchPosts = async (pageNum: number = 0, append: boolean = false) => {
    if (!communityId) return;

    try {
      setLoading(true);
      setError(null);

      // First fetch pinned post IDs
      const currentPinnedIds = await fetchPinnedPostIds();
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
          )
        `)
        .eq("community_id", communityId)
        .eq("status", "published")
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (sortBy === 'newest') {
        query = query.order("created_at", { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        if (!append) setPosts([]);
        setHasMore(false);
        return;
      }

      // Get engagement counts for sorting by 'top'
      const postIds = data.map(p => p.id);
      const [admiresResult, commentsResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
      ]);

      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach(a => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach(c => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });

      // Check user interactions if logged in
      let userAdmires: Set<string> = new Set();
      let userSaves: Set<string> = new Set();

      if (userId) {
        const [userAdmiresResult, userSavesResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
        ]);

        userAdmires = new Set((userAdmiresResult.data || []).map(a => a.post_id));
        userSaves = new Set((userSavesResult.data || []).map(s => s.post_id));
      }

      let enrichedPosts = data.map(post => ({
        ...post,
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: false,
      }));

      // Sort by engagement if 'top'
      if (sortBy === 'top') {
        enrichedPosts.sort((a, b) => {
          const aScore = a.admires_count + a.comments_count * 2;
          const bScore = b.admires_count + b.comments_count * 2;
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
    } catch (err) {
      console.error("[useCommunityPosts] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch posts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(0, false);
  }, [communityId, sortBy, userId]);

  const loadMore = () => {
    if (!loading && hasMore) {
      fetchPosts(page + 1, true);
    }
  };

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

  const fetchInvitations = async () => {
    if (!userId) {
      setInvitations([]);
      setLoading(false);
      return;
    }

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

      if (error) throw error;
      setInvitations(data || []);
    } catch (err) {
      console.error("[useCommunityInvitations] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvitations();
  }, [userId]);

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

  const fetchRequests = async () => {
    if (!communityId) return;

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

      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("[useJoinRequests] Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [communityId]);

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

// Community moderation actions
export function useCommunityModeration(communityId: string) {
  const [loading, setLoading] = useState(false);

  const updateMemberRole = async (userId: string, role: 'admin' | 'moderator' | 'member', actorId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from("community_members")
        .update({ role })
        .eq("community_id", communityId)
        .eq("user_id", userId);

      if (error) throw error;

      // Notify the user of role change
      await createNotification(userId, actorId, 'community_role_change', undefined, `Your role has been changed to ${role}`, communityId);

      return { success: true };
    } catch (err) {
      console.error("[updateMemberRole] Error:", err);
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
      bannedUntil?: Date;
      reason?: string;
    }
  ) => {
    setLoading(true);
    try {
      const updateData: {
        status: string;
        muted_until?: string | null;
        banned_until?: string | null;
        ban_reason?: string | null;
      } = { status };

      if (status === 'muted' && options?.mutedUntil) {
        updateData.muted_until = options.mutedUntil.toISOString();
      } else {
        updateData.muted_until = null;
      }

      if (status === 'banned') {
        updateData.banned_until = options?.bannedUntil ? options.bannedUntil.toISOString() : null;
        updateData.ban_reason = options?.reason || null;
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
        if (options?.mutedUntil) {
          const duration = formatDuration(options.mutedUntil);
          notificationContent = `You have been muted for ${duration}`;
        } else {
          notificationContent = "You have been muted indefinitely";
        }
      } else if (status === 'banned') {
        const parts: string[] = [];
        if (options?.bannedUntil) {
          const duration = formatDuration(options.bannedUntil);
          parts.push(`You have been banned for ${duration}`);
        } else {
          parts.push("You have been permanently banned");
        }
        if (options?.reason) {
          parts.push(`Reason: ${options.reason}`);
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
  const promoteUser = async (userId: string, role: 'moderator' | 'admin') => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberRole(userId, role, user.id);
  };

  const demoteUser = async (userId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberRole(userId, 'member', user.id);
  };

  const muteUser = async (userId: string, mutedUntil?: Date) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberStatus(userId, 'muted', user.id, { mutedUntil });
  };

  const banUser = async (userId: string, options?: { bannedUntil?: Date; reason?: string }) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'Not authenticated' };
    return updateMemberStatus(userId, 'banned', user.id, {
      bannedUntil: options?.bannedUntil,
      reason: options?.reason,
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

  return { updateMemberRole, updateMemberStatus, removeMember, promoteUser, demoteUser, muteUser, banUser, unmuteUser, unbanUser, checkExpiredMutes, inviteUser, loading };
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

  const debounceMs = options?.debounceMs ?? 300;
  const limit = options?.limit ?? 5;

  useEffect(() => {
    // Don't search if query is too short
    if (!query || query.trim().length < 2) {
      setResults({ profiles: [], communities: [], tags: [] });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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

        setResults({ profiles, communities: enrichedCommunities, tags });
      } catch (err) {
        console.error("[useSearch] Error:", err);
        setError(err instanceof Error ? err.message : "Search failed");
      } finally {
        setLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
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

      if (error) throw error;
      setCollaborators(data || []);
    } catch (err) {
      console.error('[useCollaborators] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  useEffect(() => {
    if (!postId) return;

    const channel = supabase
      .channel(`collaborators-${postId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_collaborators', filter: `post_id=eq.${postId}` }, () => {
        fetchCollaborators();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [postId, fetchCollaborators]);

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
      if (error) {
        if (error.code === '42P01' || error.message?.includes('does not exist')) { setInvites([]); return; }
        throw error;
      }
      setInvites(data || []);
    } catch (err) {
      console.error('[useCollaborationInvites] Error:', err);
      setInvites([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchInvites(); }, [fetchInvites]);

  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`collab-invites-${userId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_collaborators', filter: `user_id=eq.${userId}` }, () => { fetchInvites(); })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchInvites]);

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
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[usePendingCollaborations] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  return { posts, loading, refetch: fetchPending };
}

// ============================================
// MENTION HOOKS
// ============================================

export function useMentions(postId?: string) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMentions = useCallback(async () => {
    if (!postId) { setMentions([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('post_mentions')
        .select(`*, user:profiles!post_mentions_user_id_fkey (id, username, display_name, avatar_url)`)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMentions(data || []);
    } catch (err) {
      console.error('[useMentions] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { fetchMentions(); }, [fetchMentions]);

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

  const fetchMentioned = useCallback(async () => {
    if (!userId) { setPosts([]); setLoading(false); return; }
    try {
      setLoading(true);
      const { data: mentionData, error: mentionError } = await supabase.from('post_mentions').select('post_id').eq('user_id', userId);
      if (mentionError) throw mentionError;
      if (!mentionData || mentionData.length === 0) { setPosts([]); setLoading(false); return; }
      const postIds = mentionData.map(m => m.post_id);
      const { data, error } = await supabase
        .from('posts')
        .select(`*, author:profiles!posts_author_id_fkey (username, display_name, avatar_url), media:post_media (id, media_url, media_type, caption, position)`)
        .in('id', postIds)
        .eq('status', 'published')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setPosts(data || []);
    } catch (err) {
      console.error('[useMentionedPosts] Error:', err);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { fetchMentioned(); }, [fetchMentioned]);

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

  const fetchSuggestions = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const { data, error } = await supabase.from('follows').select(`following:profiles!follows_following_id_fkey (id, username, display_name, avatar_url, is_verified)`).eq('follower_id', currentUserId).limit(20);
      if (error) throw error;
      setSuggestions(data?.map(d => d.following as unknown as SearchableUser) || []);
    } catch (err) {
      console.error('[fetchSuggestions] Error:', err);
    }
  }, [currentUserId]);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const search = useCallback(async (query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setLoading(false); return; }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        let blockedUsers: Set<string> = new Set();
        if (currentUserId) {
          const [blockedBy, iBlocked] = await Promise.all([
            supabase.from('blocks').select('blocker_id').eq('blocked_id', currentUserId),
            supabase.from('blocks').select('blocked_id').eq('blocker_id', currentUserId),
          ]);
          (blockedBy.data || []).forEach(b => blockedUsers.add(b.blocker_id));
          (iBlocked.data || []).forEach(b => blockedUsers.add(b.blocked_id));
        }
        const { data, error } = await supabase.from('profiles').select('id, username, display_name, avatar_url, is_verified').or(`username.ilike.%${query.toLowerCase()}%,display_name.ilike.%${query.toLowerCase()}%`).limit(20);
        if (error) throw error;
        setResults((data || []).filter(u => u.id !== currentUserId && !blockedUsers.has(u.id)));
      } catch (err) {
        console.error('[useUserSearch] Error:', err);
        setResults([]);
      } finally {
        setLoading(false);
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
