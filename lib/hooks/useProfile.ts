"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "../supabase";
import type { Profile, Post, PostMedia, FollowUser, FollowStatus, FollowRequest, NotificationType, AggregateCount } from "../types";
import { getAggregateCount } from "../types";

// ============================================================================
// Helper: Create notification
// ============================================================================

async function createNotification(
  userId: string,
  actorId: string,
  type: NotificationType,
  postId?: string,
  content?: string
) {
  if (userId === actorId) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    type,
    post_id: postId || null,
    content: content || null,
  });
}

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

  const fetchProfile = useCallback(async () => {
    if (!username) return;

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
        .single();

      if (profileError) {
        if (profileError.code === "PGRST116") {
          setError("User not found");
        } else {
          throw profileError;
        }
        return;
      }

      const isOwnProfile = viewerId && viewerId === profileData.id;

      // Check if blocked
      if (viewerId && !isOwnProfile) {
        const { data: blockData } = await supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", profileData.id)
          .eq("blocked_id", viewerId)
          .maybeSingle();

        if (blockData) {
          setIsBlockedByUser(true);
          setError("blocked");
          setLoading(false);
          return;
        }
      }

      // Check follow status
      let viewerFollowsProfile = false;
      if (viewerId && !isOwnProfile) {
        const { data: followCheck } = await supabase
          .from("follows")
          .select("status")
          .eq("follower_id", viewerId)
          .eq("following_id", profileData.id)
          .eq("status", "accepted")
          .maybeSingle();
        viewerFollowsProfile = !!followCheck;
      }

      // Handle private accounts
      if (!isOwnProfile && profileData.is_private && !viewerFollowsProfile) {
        setIsPrivateAccount(true);

        // Get follow counts
        const [followersResult, followingResult] = await Promise.all([
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("following_id", profileData.id)
            .eq("status", "accepted"),
          supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", profileData.id)
            .eq("status", "accepted"),
        ]);

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
          followers_count: followersResult.count || 0,
          following_count: followingResult.count || 0,
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
          admires:admires(count),
          comments:comments(count)
        `
        )
        .eq("author_id", profileData.id)
        .eq("status", "published")
        .order("created_at", { ascending: false });

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
          .eq("status", "accepted"),
        supabase
          .from("follows")
          .select("*", { count: "exact", head: true })
          .eq("follower_id", profileData.id)
          .eq("status", "accepted"),
        postsQuery,
      ]);

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

      // Transform posts
      const postsWithStats = (postsData.data || []).map((post) => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: getAggregateCount(post.admires as AggregateCount[] | null),
        comments_count: getAggregateCount(post.comments as AggregateCount[] | null),
        relays_count: 0,
        reactions_count: 0,
        user_has_admired: false,
        user_has_saved: false,
        user_has_relayed: false,
        user_reaction_type: null,
        // Creative styling fields
        styling: post.styling || null,
        post_location: post.post_location || null,
        metadata: post.metadata || null,
      }));

      setPosts(postsWithStats as Post[]);
    } catch (err) {
      console.error("[useProfile] Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch profile");
    } finally {
      setLoading(false);
    }
  }, [username, viewerId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: fetchProfile };
}

// ============================================================================
// useFollow - Follow/unfollow functionality
// ============================================================================

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

  const follow = async (followerId: string, followingId: string): Promise<FollowStatus> => {
    const isPrivate = await checkIsPrivate(followingId);

    const status = isPrivate ? "pending" : "accepted";
    const notificationType = isPrivate ? "follow_request" : "follow";

    const { error } = await supabase.from("follows").insert({
      follower_id: followerId,
      following_id: followingId,
      status,
    });

    if (error) {
      // Fallback for old schema
      await supabase.from("follows").insert({
        follower_id: followerId,
        following_id: followingId,
      });
      await createNotification(followingId, followerId, "follow");
      return "accepted";
    }

    await createNotification(followingId, followerId, notificationType);
    return status as FollowStatus;
  };

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

export function useFollowList(userId: string, type: "followers" | "following") {
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchList = useCallback(async () => {
    if (!userId) return;

    try {
      setLoading(true);

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
          .eq("status", "accepted");

        if (error) throw error;
        setUsers((data?.map((d) => d.follower) as unknown as FollowUser[]) || []);
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
          .eq("status", "accepted");

        if (error) throw error;
        setUsers((data?.map((d) => d.following) as unknown as FollowUser[]) || []);
      }
    } catch (err) {
      console.error("[useFollowList] Error:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, type]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { users, loading, refetch: fetchList };
}

// ============================================================================
// useFollowRequests - Manage follow requests for private accounts
// ============================================================================

export function useFollowRequests(userId?: string) {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(0);

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

      setRequests((data as unknown as FollowRequest[]) || []);
      setCount(data?.length || 0);
    } catch (err) {
      console.error("[useFollowRequests] Error:", err);
      setRequests([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [userId]);

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

      setRequests((prev) => prev.filter((r) => r.follower_id !== requesterId));
      setCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[useFollowRequests] decline Error:", err);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`follow-requests-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "follows",
          filter: `following_id=eq.${userId}`,
        },
        (payload) => {
          const newData = payload.new as { status?: string } | null;
          if (payload.eventType === "INSERT" && newData?.status === "pending") {
            fetchRequests();
          } else if (payload.eventType === "DELETE") {
            fetchRequests();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchRequests]);

  return { requests, loading, count, accept, decline, refetch: fetchRequests };
}
