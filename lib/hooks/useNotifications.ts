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
  } catch (err: any) {
    // Catch network errors etc.
    console.error("[createNotification] Unexpected error:", err?.message || err);
    return false;
  }
}

// ============================================================================
// useNotifications - Fetch and subscribe to notifications
// ============================================================================

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useNotifications(userId?: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      if (!fetchedRef.current) {
        setLoading(true);
      }

      const { data, error } = await supabase
        .from("notifications")
        .select(
          `
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
        `
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
      fetchedRef.current = true;
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (!errMsg.includes("Failed to fetch") && !errMsg.includes("NetworkError")) {
        console.error("[useNotifications] Error:", err);
      }
    } finally {
      setLoading(false);
    }
  }, [userId]);

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
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          fetchNotifications();
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

  return { notifications, loading, refetch: fetchNotifications };
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
    } catch (err: any) {
      console.error("[useUnreadCount] Unexpected error:", err?.message || err);
    }
  }, [userId]);

  // Use ref to access latest fetchCount in subscription callback
  // This prevents channel recreation when fetchCount reference changes
  const fetchCountRef = useRef(fetchCount);
  useEffect(() => {
    fetchCountRef.current = fetchCount;
  }, [fetchCount]);

  // Initial fetch
  useEffect(() => {
    if (userId) {
      fetchCount();
    }
  }, [userId, fetchCount]);

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
  const markAsRead = async (notificationId: string): Promise<boolean> => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
    if (error) {
      console.error("[useMarkAsRead] Failed to mark notification as read:", error.message);
      return false;
    }
    return true;
  };

  const markAllAsRead = async (userId: string): Promise<boolean> => {
    const { error } = await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
    if (error) {
      console.error("[useMarkAsRead] Failed to mark all notifications as read:", error.message);
      return false;
    }
    return true;
  };

  return { markAsRead, markAllAsRead };
}

// ============================================================================
// useUnreadMessagesCount - Unread messages count (filtered for blocks)
// ============================================================================

interface UseUnreadMessagesCountReturn {
  count: number;
  refetch: () => Promise<void>;
}

export function useUnreadMessagesCount(userId?: string): UseUnreadMessagesCountReturn {
  const [count, setCount] = useState(0);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fetchedRef = useRef(false);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      // Get blocked users (both directions)
      const [blockedByResult, iBlockedResult] = await Promise.all([
        supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
      ]);

      const blockedUserIds = new Set<string>();
      (blockedByResult.data || []).forEach((b) => blockedUserIds.add(b.blocker_id));
      (iBlockedResult.data || []).forEach((b) => blockedUserIds.add(b.blocked_id));

      // Get conversations
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", userId);

      if (!participations || participations.length === 0) {
        setCount(0);
        fetchedRef.current = true;
        return;
      }

      const conversationIds = participations.map((p) => p.conversation_id);

      // Get unread messages
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("sender_id")
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .neq("sender_id", userId);

      // Filter out blocked users
      const filteredCount = (unreadMessages || []).filter((m) => !blockedUserIds.has(m.sender_id)).length;

      setCount(filteredCount);
      fetchedRef.current = true;
    } catch (err: any) {
      console.error("[useUnreadMessagesCount] Error:", err?.message || err);
    }
  }, [userId]);

  // Use ref to access latest fetchCount in subscription callback
  const fetchCountRef = useRef(fetchCount);
  useEffect(() => {
    fetchCountRef.current = fetchCount;
  }, [fetchCount]);

  // Initial fetch - separate from subscription
  useEffect(() => {
    if (userId && !fetchedRef.current) {
      fetchCount();
    }
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

    // Debounce rapid message updates
    let debounceTimer: NodeJS.Timeout | null = null;
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchCountRef.current();
      }, 300);
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
