"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import type { Notification, NotificationType } from "../types";

// ============================================================================
// createNotification - Helper to create notifications
// ============================================================================

export async function createNotification(
  userId: string,
  actorId: string,
  type: NotificationType,
  postId?: string,
  content?: string,
  communityId?: string,
  commentId?: string
): Promise<boolean> {
  // Don't notify yourself
  if (userId === actorId) return true;

  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: userId,
      actor_id: actorId,
      type,
      post_id: postId || null,
      content: content || null,
      community_id: communityId || null,
      comment_id: commentId || null,
    });

    if (error) {
      // Log error but don't throw - notifications are non-critical
      console.error("[createNotification] Failed to create notification:", {
        type,
        userId,
        actorId,
        error: error.message,
      });
      return false;
    }

    return true;
  } catch (err: unknown) {
    // Catch network errors etc.
    const message = err instanceof Error ? err.message : String(err);
    console.error("[createNotification] Unexpected error:", message);
    return false;
  }
}

// ============================================================================
// useNotifications - Fetch and subscribe to notifications
// ============================================================================

const NOTIFICATIONS_PAGE_SIZE = 50;

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNotifications(userId?: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const fetchedRef = useRef(false);
  const loadingMoreRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const notificationSelect = `
    *,
    actor:profiles!notifications_actor_id_fkey (
      username,
      display_name,
      avatar_url
    ),
    post:posts (
      title,
      content,
      type
    ),
    community:communities (
      name,
      slug,
      avatar_url
    )
  `;

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    try {
      if (!fetchedRef.current) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(notificationSelect)
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATIONS_PAGE_SIZE);

      if (error) throw error;

      const results = data || [];
      setNotifications(results);
      setHasMore(results.length === NOTIFICATIONS_PAGE_SIZE);
      fetchedRef.current = true;
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "";
      if (!errMsg.includes("Failed to fetch") && !errMsg.includes("NetworkError")) {
        console.error("[useNotifications] Error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const loadMore = useCallback(async () => {
    if (!userId || !hasMore || loadingMoreRef.current) return;
    loadingMoreRef.current = true;

    try {
      const lastNotification = notifications[notifications.length - 1];
      if (!lastNotification) return;

      const { data, error } = await supabase
        .from("notifications")
        .select(notificationSelect)
        .eq("user_id", userId)
        .lt("created_at", lastNotification.created_at)
        .order("created_at", { ascending: false })
        .limit(NOTIFICATIONS_PAGE_SIZE);

      if (error) throw error;

      const results = data || [];
      setNotifications((prev) => [...prev, ...results]);
      setHasMore(results.length === NOTIFICATIONS_PAGE_SIZE);
    } catch (err: unknown) {
      console.error("[useNotifications] Error loading more:", err);
    } finally {
      loadingMoreRef.current = false;
    }
  }, [userId, hasMore, notifications]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId, fetchNotifications]);

  // Track the userId for which we have a subscription
  const subscribedUserIdRef = useRef<string | null>(null);

  // Real-time subscription
  useEffect(() => {
    if (!userId) {
      // Clean up any existing subscription when userId is cleared
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedUserIdRef.current = null;
      }
      return;
    }

    // If we already have a subscription for this user, don't create another
    if (channelRef.current && subscribedUserIdRef.current === userId) {
      return;
    }

    // Clean up previous subscription if userId changed
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // CRITICAL: Use stable channel name to prevent connection leaks
    const channelName = `notifications-realtime-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        async (payload) => {
          // Incremental update: Add new notification without refetching all
          const newNotif = payload.new as { id: string };

          // Fetch the actor, post, and community data for the new notification
          const { data: fullNotif } = await supabase
            .from("notifications")
            .select(`
              *,
              actor:profiles!notifications_actor_id_fkey (
                username,
                display_name,
                avatar_url
              ),
              post:posts (
                title,
                content,
                type
              ),
              community:communities (
                name,
                slug,
                avatar_url
              )
            `)
            .eq("id", newNotif.id)
            .single();

          if (fullNotif) {
            setNotifications((prev) => {
              // Avoid duplicates
              if (prev.some((n) => n.id === fullNotif.id)) return prev;
              // Add to beginning (most recent first), cap at 50
              return [fullNotif, ...prev].slice(0, 50);
            });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Incremental update: Update specific notification
          const updated = payload.new as { id: string; read?: boolean };
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? { ...n, ...updated } : n))
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          // Incremental update: Remove deleted notification
          const deleted = payload.old as { id: string };
          setNotifications((prev) => prev.filter((n) => n.id !== deleted.id));
        }
      )
      .subscribe();

    channelRef.current = channel;
    subscribedUserIdRef.current = userId;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedUserIdRef.current = null;
      }
    };
  }, [userId, fetchNotifications]);

  return { notifications, loading, hasMore, loadMore, refetch: fetchNotifications };
}

// ============================================================================
// useUnreadCount - Get unread notification count with real-time updates
// ============================================================================

interface UseUnreadCountReturn {
  count: number;
  refetch: () => Promise<void>;
}

export function useUnreadCount(userId?: string): UseUnreadCountReturn {
  const [count, setCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      const { count: unreadCount, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("read", false);

      if (error) {
        console.error("[useUnreadCount] Error fetching count:", error.message);
        return;
      }

      setCount(unreadCount || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUnreadCount] Unexpected error:", message);
    }
  }, [userId]);

  // Use ref to access latest fetchCount in subscription callback
  // This prevents channel recreation when fetchCount reference changes
  const fetchCountRef = useRef(fetchCount);
  useEffect(() => {
    fetchCountRef.current = fetchCount;
  }, [fetchCount]);

  // Initial fetch
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (userId) {
      fetchCount();
    }
  }, [userId, fetchCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Real-time subscription - only depends on userId to prevent channel recreation
  useEffect(() => {
    if (!userId) {
      // Clean up if userId becomes undefined
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Clean up previous channel if it exists
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channelName = `unread-count-realtime-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          // Use ref to get latest fetchCount
          fetchCountRef.current();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]); // Only userId - no fetchCount to prevent recreation

  return { count, refetch: fetchCount };
}

// ============================================================================
// useMarkAsRead - Mark notifications as read
// ============================================================================

export function useMarkAsRead() {
  const markAsRead = async (notificationId: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
    if (error) {
      console.error("[useMarkAsRead] Failed to mark notification as read:", error.message);
    }
  };

  const markAllAsRead = async (userId: string) => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    if (error) {
      console.error("[useMarkAsRead] Failed to mark all notifications as read:", error.message);
    }
  };

  return { markAsRead, markAllAsRead };
}

// ============================================================================
// useUnreadMessagesCount - Unread messages count (filtered for blocks)
// Optimized: Caches blocked users, uses longer debounce, more efficient queries
// ============================================================================

interface UseUnreadMessagesCountReturn {
  count: number;
  refetch: () => Promise<void>;
}

// Cache blocked users for 5 minutes to avoid refetching on every message
const BLOCKED_USERS_CACHE_TTL_MS = 5 * 60 * 1000;

interface BlockedUsersCache {
  userIds: Set<string>;
  fetchedAt: number;
}

// Module-level cache for blocked users (persists across hook instances)
const blockedUsersCacheByUser = new Map<string, BlockedUsersCache>();

export function useUnreadMessagesCount(userId?: string): UseUnreadMessagesCountReturn {
  const [count, setCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);

  // Fetch blocked users with caching
  const getBlockedUsers = useCallback(async (): Promise<Set<string>> => {
    if (!userId) return new Set();

    // Check cache
    const cached = blockedUsersCacheByUser.get(userId);
    if (cached && (Date.now() - cached.fetchedAt < BLOCKED_USERS_CACHE_TTL_MS)) {
      return cached.userIds;
    }

    try {
      // Fetch both directions in parallel
      const [blockedByResult, iBlockedResult] = await Promise.all([
        supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
      ]);

      const blockedUserIds = new Set<string>();
      (blockedByResult.data || []).forEach((b) => blockedUserIds.add(b.blocker_id));
      (iBlockedResult.data || []).forEach((b) => blockedUserIds.add(b.blocked_id));

      // Update cache
      blockedUsersCacheByUser.set(userId, {
        userIds: blockedUserIds,
        fetchedAt: Date.now(),
      });

      return blockedUserIds;
    } catch (err) {
      console.error("[useUnreadMessagesCount] Error fetching blocked users:", err);
      return cached?.userIds || new Set();
    }
  }, [userId]);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      // Get blocked users (uses cache)
      const blockedUserIds = await getBlockedUsers();

      // Optimized: Single query to get unread count by joining tables
      // Get conversations where user is participant
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!mountedRef.current) return;

      if (!participations || participations.length === 0) {
        setCount(0);
        fetchedRef.current = true;
        return;
      }

      const conversationIds = participations.map((p) => p.conversation_id);

      // Get unread count - only fetch sender_id for filtering (minimal data)
      const { data: unreadMessages, error } = await supabase
        .from("messages")
        .select("sender_id")
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .neq("sender_id", userId);

      if (!mountedRef.current) return;
      if (error) throw error;

      // Filter out blocked users (this is fast since blockedUserIds is a Set)
      let filteredCount = 0;
      const messages = unreadMessages || [];
      for (let i = 0; i < messages.length; i++) {
        if (!blockedUserIds.has(messages[i].sender_id)) {
          filteredCount++;
        }
      }

      setCount(filteredCount);
      fetchedRef.current = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUnreadMessagesCount] Error:", message);
    }
  }, [userId, getBlockedUsers]);

  // Use ref to access latest fetchCount in subscription callback
  const fetchCountRef = useRef(fetchCount);
  useEffect(() => {
    fetchCountRef.current = fetchCount;
  }, [fetchCount]);

  // Initial fetch - separate from subscription
  useEffect(() => {
    mountedRef.current = true;
    if (userId && !fetchedRef.current) {
      fetchCount();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchCount]);

  // Real-time subscription - only depends on userId
  useEffect(() => {
    if (!userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      return;
    }

    // Clean up previous channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    // Debounce rapid message updates - increased to 1000ms to reduce database load
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (mountedRef.current) {
          fetchCountRef.current();
        }
      }, 1000); // Increased from 300ms to 1000ms
    };

    const channelName = `unread-messages-count-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        debouncedFetch
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
        },
        debouncedFetch
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [userId]); // Only userId - prevents channel recreation

  return { count, refetch: fetchCount };
}
