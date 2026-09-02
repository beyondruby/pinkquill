"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";
import { enrichPost, fetchUserPostFlags } from "@/lib/posts/enrich";
import type { Profile, Post, FollowUser, FollowStatus, FollowRequest, AggregateCount } from "../types";
import { getAggregateCount } from "../types";
import { createNotification } from "./useNotifications";
import { useUserEvent } from "@/components/providers/UserEventsProvider";
import { isAbortError } from "../utils/retry";

// ============================================================================
// useProfile - Fetch user profile and posts
// ============================================================================

interface UseProfileReturn {
  profile: Profile | null;
  posts: Post[];
  loading: boolean;
  error: string | null;
  isBlockedByUser: boolean;
  isPrivateAccount: boolean;
  refetch: () => Promise<void>;
}

export function useProfile(username: string, viewerId?: string): UseProfileReturn {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isBlockedByUser, setIsBlockedByUser] = useState(false);
  const [isPrivateAccount, setIsPrivateAccount] = useState(false);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Use ref for viewerId to avoid re-fetching entire profile when auth resolves
  const viewerIdRef = useRef(viewerId);
  viewerIdRef.current = viewerId;

  const fetchProfile = useCallback(async () => {
    if (!username) {
      // Reset loading so the profile page doesn't render a permanent
      // skeleton when the route param hasn't resolved yet.
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      setIsPrivateAccount(false);
      setIsBlockedByUser(false);
      setError(null);

      // Fetch profile
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("username", username)
        .abortSignal(signal)
        .single();

      if (!mountedRef.current || signal.aborted) return;

      if (profileError || !profileData) {
        if (profileError?.code === "PGRST116" || !profileData) {
          setError("User not found");
        } else {
          throw profileError;
        }
        return;
      }

      const currentViewerId = viewerIdRef.current;
      const isOwnProfile = currentViewerId && currentViewerId === profileData.id;

      // Check block status and follow status in parallel (both are independent)
      let viewerFollowsProfile = false;
      if (currentViewerId && !isOwnProfile) {
        const [blockResult, followResult] = await Promise.all([
          supabase
            .from("blocks")
            .select("id")
            .eq("blocker_id", profileData.id)
            .eq("blocked_id", currentViewerId)
            .abortSignal(signal)
            .maybeSingle(),
          supabase
            .from("follows")
            .select("status")
            .eq("follower_id", currentViewerId)
            .eq("following_id", profileData.id)
            .eq("status", "accepted")
            .abortSignal(signal)
            .maybeSingle(),
        ]);

        if (!mountedRef.current || signal.aborted) return;

        if (blockResult.data) {
          setIsBlockedByUser(true);
          setError("blocked");
          setLoading(false);
          return;
        }

        viewerFollowsProfile = !!followResult.data;
      }

      // Handle private accounts
      if (!isOwnProfile && profileData.is_private && !viewerFollowsProfile) {
        setIsPrivateAccount(true);

        setProfile({
          ...profileData,
          bio: null,
          tagline: null,
          role: null,
          education: null,
          location: null,
          languages: null,
          website: null,
          works_count: 0,
          followers_count: null,
          following_count: null,
          admires_count: 0,
        });
        setPosts([]);
        setLoading(false);
        return;
      }

      // Build posts query with visibility filter
      let postsQuery = supabase
        .from("posts")
        .select(
          `
          *,
          styling,
          post_location,
          metadata,
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
          community:communities (
            id,
            slug,
            name,
            avatar_url
          ),
          flair:community_flairs (
            id,
            community_id,
            name,
            color,
            emoji,
            position,
            created_at
          ),
          admires:admires(count),
          reactions:reactions(count),
          comments:comments(count),
          relays:relays(count)
        `
        )
        .eq("author_id", profileData.id)
        .eq("status", "published")
        .order("created_at", { ascending: false })
        .abortSignal(signal);

      // Apply visibility filter
      if (!isOwnProfile) {
        if (viewerFollowsProfile) {
          postsQuery = postsQuery.in("visibility", ["public", "followers"]);
        } else {
          postsQuery = postsQuery.eq("visibility", "public");
        }
      }

      // Fetch counts and posts
      const [followersResult, followingResult, postsData] = await Promise.all([
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("following_id", profileData.id)
          .eq("status", "accepted")
          .abortSignal(signal),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", profileData.id)
          .eq("status", "accepted")
          .abortSignal(signal),
        postsQuery,
      ]);

      if (!mountedRef.current || signal.aborted) return;

      const worksCount = postsData.data?.length || 0;

      // Calculate total admires
      let totalAdmires = 0;
      (postsData.data || []).forEach((post) => {
        totalAdmires += getAggregateCount(post.admires as AggregateCount[] | null);
      });

      setProfile({
        ...profileData,
        works_count: worksCount,
        followers_count: followersResult.count || 0,
        following_count: followingResult.count || 0,
        admires_count: totalAdmires,
      });

      // Viewer flags + row → Post through the shared enrichment helper.
      const postIds = (postsData.data || []).map((p) => p.id);
      const flags = await fetchUserPostFlags(currentViewerId, postIds, signal);
      if (!mountedRef.current || signal.aborted) return;
      const postsWithStats = (postsData.data || []).map((post) => enrichPost(post, flags));

      if (!mountedRef.current || signal.aborted) return;
      setPosts(postsWithStats as Post[]);
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      console.error("[useProfile] Error:", err);
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : "Failed to fetch profile");
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [username]);

  useEffect(() => {
    mountedRef.current = true;
    fetchProfile();

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchProfile]);

  return { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: fetchProfile };
}

// ============================================================================
// useFollow - Follow/unfollow functionality
// ============================================================================

/**
 * Follow another user. Handles the private-account request flow (pending +
 * follow_request notification) and is the ONLY client path that should insert
 * into `follows`; a DB trigger additionally forces 'pending' for private
 * targets regardless of what a client sends.
 */
export async function followUserRecord(followerId: string, followingId: string): Promise<FollowStatus> {
  const { data: target } = await supabase.from("profiles").select("is_private").eq("id", followingId).single();
  const isPrivate = target?.is_private || false;
  const status: FollowStatus = isPrivate ? "pending" : "accepted";

  const { error } = await supabase.from("follows").insert({
    follower_id: followerId,
    following_id: followingId,
    status,
  });
  if (error) {
    console.error("[followUserRecord] Follow failed:", error.message);
    throw new Error(`Failed to follow: ${error.message}`);
  }

  await createNotification(followingId, followerId, isPrivate ? "follow_request" : "follow");
  return status;
}

export function useFollow() {
  const checkFollowStatus = async (followerId: string, followingId: string): Promise<FollowStatus> => {
    const { data, error } = await supabase
      .from("follows")
      .select("status")
      .eq("follower_id", followerId)
      .eq("following_id", followingId)
      .maybeSingle();

    if (error) {
      // Fallback for old schema without status column
      const { data: existsData } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", followerId)
        .eq("following_id", followingId)
        .maybeSingle();
      return existsData ? "accepted" : null;
    }

    return (data?.status as FollowStatus) || null;
  };

  const checkIsFollowing = async (followerId: string, followingId: string): Promise<boolean> => {
    const status = await checkFollowStatus(followerId, followingId);
    return status === "accepted";
  };

  const checkIsPrivate = async (userId: string): Promise<boolean> => {
    const { data } = await supabase.from("profiles").select("is_private").eq("id", userId).single();
    return data?.is_private || false;
  };

  const follow = (followerId: string, followingId: string): Promise<FollowStatus> =>
    followUserRecord(followerId, followingId);

  const unfollow = async (followerId: string, followingId: string): Promise<void> => {
    const { error } = await supabase.from("follows").delete().eq("follower_id", followerId).eq("following_id", followingId);
    if (error) {
      console.error("[useFollow] Failed to unfollow:", error.message);
      throw error;
    }
  };

  const acceptRequest = async (ownerId: string, requesterId: string): Promise<void> => {
    const { error } = await supabase
      .from("follows")
      .update({ status: "accepted" })
      .eq("follower_id", requesterId)
      .eq("following_id", ownerId)
      .eq("status", "pending");

    if (error) {
      console.error("[useFollow] Failed to accept follow request:", error.message);
      throw error;
    }

    await createNotification(requesterId, ownerId, "follow_request_accepted");
  };

  const declineRequest = async (ownerId: string, requesterId: string): Promise<void> => {
    const { error } = await supabase
      .from("follows")
      .delete()
      .eq("follower_id", requesterId)
      .eq("following_id", ownerId)
      .eq("status", "pending");

    if (error) {
      console.error("[useFollow] Failed to decline follow request:", error.message);
      throw error;
    }
  };

  const getPendingRequests = async (userId: string) => {
    const { data } = await supabase
      .from("follows")
      .select(
        `
        follower_id,
        requested_at,
        requester:profiles!follows_follower_id_fkey (
          id, username, display_name, avatar_url, bio
        )
      `
      )
      .eq("following_id", userId)
      .eq("status", "pending")
      .order("requested_at", { ascending: false });
    return data || [];
  };

  const toggle = async (followerId: string, followingId: string, isFollowing: boolean): Promise<void> => {
    if (isFollowing) {
      await unfollow(followerId, followingId);
    } else {
      await follow(followerId, followingId);
    }
  };

  return {
    checkFollowStatus,
    checkIsFollowing,
    checkIsPrivate,
    follow,
    unfollow,
    acceptRequest,
    declineRequest,
    getPendingRequests,
    toggle,
  };
}

// ============================================================================
// useFollowList - Get followers or following list
// ============================================================================

export function useFollowList(userId: string, type: "followers" | "following", pageSize = 30) {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(async (pageNum: number) => {
    if (!userId) {
      setLoading(false);
      return;
    }

    // Abort any in-flight request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      setLoading(true);
      const from = pageNum * pageSize;
      const to = (pageNum + 1) * pageSize - 1;

      if (type === "followers") {
        const { data, error } = await supabase
          .from("follows")
          .select(
            `
            follower:profiles!follows_follower_id_fkey (
              id,
              username,
              display_name,
              avatar_url,
              bio,
              is_verified
            )
          `
          )
          .eq("following_id", userId)
          .eq("status", "accepted")
          .range(from, to)
          .abortSignal(signal);

        if (!mountedRef.current || signal.aborted) return;
        if (error) throw error;
        const newUsers = (data?.map((d) => d.follower) as unknown as FollowUser[]) || [];
        setHasMore(newUsers.length === pageSize);
        setUsers((prev) => pageNum === 0 ? newUsers : [...prev, ...newUsers]);
      } else {
        const { data, error } = await supabase
          .from("follows")
          .select(
            `
            following:profiles!follows_following_id_fkey (
              id,
              username,
              display_name,
              avatar_url,
              bio,
              is_verified
            )
          `
          )
          .eq("follower_id", userId)
          .eq("status", "accepted")
          .range(from, to)
          .abortSignal(signal);

        if (!mountedRef.current || signal.aborted) return;
        if (error) throw error;
        const newUsers = (data?.map((d) => d.following) as unknown as FollowUser[]) || [];
        setHasMore(newUsers.length === pageSize);
        setUsers((prev) => pageNum === 0 ? newUsers : [...prev, ...newUsers]);
      }
    } catch (err: unknown) {
      if (isAbortError(err)) return;
      console.error("[useFollowList] Error:", err);
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId, type, pageSize]);

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const refetch = useCallback(() => {
    setPage(0);
    fetchPage(0);
  }, [fetchPage]);

  useEffect(() => {
    mountedRef.current = true;
    fetchPage(page);

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchPage, page]);

  // Reset page when userId or type changes
  useEffect(() => {
    setPage(0);
    setUsers([]);
    setHasMore(false);
  }, [userId, type]);

  return { users, loading, hasMore, loadMore, refetch };
}

// ============================================================================
// useFollowRequests - Manage follow requests for private accounts
// ============================================================================

export function useFollowRequests(userId?: string) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);

  const fetchRequests = useCallback(async () => {
    if (!userId) {
      setRequests([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("follows")
        .select(
          `
          follower_id,
          requested_at,
          requester:profiles!follows_follower_id_fkey (
            id, username, display_name, avatar_url, bio
          )
        `
        )
        .eq("following_id", userId)
        .eq("status", "pending")
        .order("requested_at", { ascending: false });

      if (error) {
        // Handle schema not migrated
        const errMsg = error.message || "";
        if (errMsg.includes("status") || errMsg.includes("requested_at") || error.code === "42703") {
          setRequests([]);
          setCount(0);
          return;
        }
        throw error;
      }

      if (!mountedRef.current) return;
      setRequests((data as unknown as FollowRequest[]) || []);
      setCount(data?.length || 0);
    } catch (err) {
      console.error("[useFollowRequests] Error:", err);
      if (mountedRef.current) {
        setRequests([]);
        setCount(0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  // Use ref to access latest fetchRequests in subscription callback
  const fetchRequestsRef = useRef(fetchRequests);
  useEffect(() => {
    fetchRequestsRef.current = fetchRequests;
  }, [fetchRequests]);

  const accept = async (requesterId: string) => {
    if (!userId) return;

    try {
      // Update status to accepted
      const { error } = await supabase
        .from("follows")
        .update({ status: "accepted" })
        .eq("follower_id", requesterId)
        .eq("following_id", userId);

      if (error) {
        // Try delete + insert as fallback
        const { error: deleteError } = await supabase.from("follows").delete().eq("follower_id", requesterId).eq("following_id", userId);
        if (deleteError) console.warn("[useFollowRequests] Fallback delete failed:", deleteError.message);

        const { error: insertError } = await supabase.from("follows").insert({
          follower_id: requesterId,
          following_id: userId,
          status: "accepted",
        });
        if (insertError) throw insertError;
      }

      await createNotification(requesterId, userId, "follow_request_accepted");

      const { error: markReadError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("actor_id", requesterId)
        .eq("type", "follow_request")
        .eq("read", false);

      if (markReadError) {
        console.warn("[useFollowRequests] Failed to mark follow request notification as read:", markReadError.message);
      }

      setRequests((prev) => prev.filter((r) => r.follower_id !== requesterId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[useFollowRequests] accept Error:", err);
    }
  };

  const decline = async (requesterId: string) => {
    if (!userId) return;

    try {
      const { error } = await supabase.from("follows").delete().eq("follower_id", requesterId).eq("following_id", userId);
      if (error) throw error;

      const { error: markReadError } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", userId)
        .eq("actor_id", requesterId)
        .eq("type", "follow_request")
        .eq("read", false);

      if (markReadError) {
        console.warn("[useFollowRequests] Failed to mark declined follow request notification as read:", markReadError.message);
      }

      setRequests((prev) => prev.filter((r) => r.follower_id !== requesterId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[useFollowRequests] decline Error:", err);
    }
  };

  // Initial fetch with cleanup
  useEffect(() => {
    mountedRef.current = true;
    fetchRequests();

    return () => {
      mountedRef.current = false;
    };
  }, [fetchRequests]);

  // Live updates flow through the per-user broadcast channel. Trigger fires
  // on every follow row INSERT/UPDATE/DELETE involving this user; we only
  // refetch when the change could affect the pending-requests list.
  useUserEvent("follow_change", (payload) => {
    if (!userId) return;
    // We only care about rows where this user is the followee (the side that
    // sees the request). UPDATE on a row where this user is the follower
    // (e.g., they were accepted) is handled elsewhere.
    if (payload.following_id !== userId) return;

    if (payload.op === "INSERT" && payload.status === "pending") {
      fetchRequestsRef.current();
      return;
    }
    if (payload.op === "UPDATE" || payload.op === "DELETE") {
      fetchRequestsRef.current();
    }
  });

  return { requests, loading, count, accept, decline, refetch: fetchRequests };
}
