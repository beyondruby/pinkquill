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
  communityId?: string
) {
  // Don't notify yourself
  if (userId === actorId) return;

  await supabase.from("notifications").insert({
    user_id: userId,
    actor_id: actorId,
    type,
    post_id: postId || null,
    content: content || null,
    community_id: communityId || null,
  });
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
  const mountedRef = useRef(true);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  // Store userId in ref to avoid re-subscription on userId change
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchNotifications = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      if (mountedRef.current) {
        setNotifications([]);
        setLoading(false);
      }
      return;
    }

    try {
      if (!fetchedRef.current && mountedRef.current) {
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
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mountedRef.current) return;

      if (error) throw error;

      setNotifications(data || []);
      fetchedRef.current = true;
    } catch (err: any) {
      const errMsg = err?.message || "";
      if (!errMsg.includes("Failed to fetch") && !errMsg.includes("NetworkError")) {
        console.error("[useNotifications] Error:", err);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []); // Remove userId dependency - use ref instead

  // Initial fetch and cleanup
  useEffect(() => {
    mountedRef.current = true;
    fetchedRef.current = false;

    if (userId) {
      fetchNotifications();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchNotifications]);

  // Real-time subscription - separate effect with stable dependencies
  useEffect(() => {
    if (!userId) return;

    // Clean up any existing channel first
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

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
          if (mountedRef.current) {
            fetchNotifications();
          }
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
  }, [userId]); // Only depend on userId, not fetchNotifications

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
  const mountedRef = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchCount = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      if (mountedRef.current) setCount(0);
      return;
    }

    try {
      const { count: unreadCount } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", currentUserId)
        .eq("read", false);

      if (mountedRef.current) {
        setCount(unreadCount || 0);
      }
    } catch (err) {
      console.error("[useUnreadCount] Error:", err);
    }
  }, []); // No dependencies - use ref

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (userId) {
      fetchCount();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchCount]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;

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
          if (mountedRef.current) {
            fetchCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); // Only depend on userId

  return { count, refetch: fetchCount };
}

// ============================================================================
// useMarkAsRead - Mark notifications as read
// ============================================================================

export function useMarkAsRead() {
  const markAsRead = async (notificationId: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", notificationId);
  };

  const markAllAsRead = async (userId: string) => {
    await supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false);
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
  const mountedRef = useRef(true);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;

  const fetchCount = useCallback(async () => {
    const currentUserId = userIdRef.current;
    if (!currentUserId) {
      if (mountedRef.current) setCount(0);
      return;
    }

    try {
      // Get blocked users (both directions)
      const [blockedByResult, iBlockedResult] = await Promise.all([
        supabase.from("blocks").select("blocker_id").eq("blocked_id", currentUserId),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", currentUserId),
      ]);

      if (!mountedRef.current) return;

      const blockedUserIds = new Set<string>();
      (blockedByResult.data || []).forEach((b) => blockedUserIds.add(b.blocker_id));
      (iBlockedResult.data || []).forEach((b) => blockedUserIds.add(b.blocked_id));

      // Get conversations
      const { data: participations } = await supabase
        .from("conversation_participants")
        .select("conversation_id")
        .eq("user_id", currentUserId);

      if (!mountedRef.current) return;

      if (!participations || participations.length === 0) {
        setCount(0);
        return;
      }

      const conversationIds = participations.map((p) => p.conversation_id);

      // Get unread messages
      const { data: unreadMessages } = await supabase
        .from("messages")
        .select("sender_id")
        .in("conversation_id", conversationIds)
        .eq("is_read", false)
        .neq("sender_id", currentUserId);

      if (!mountedRef.current) return;

      // Filter out blocked users
      const filteredCount = (unreadMessages || []).filter((m) => !blockedUserIds.has(m.sender_id)).length;

      setCount(filteredCount);
    } catch (err) {
      console.error("[useUnreadMessagesCount] Error:", err);
    }
  }, []); // No dependencies - use ref

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true;

    if (userId) {
      fetchCount();
    }

    return () => {
      mountedRef.current = false;
    };
  }, [userId, fetchCount]);

  // Real-time subscription - separate effect
  useEffect(() => {
    if (!userId) return;

    const channelName = `unread-messages-count-${userId}`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "messages",
        },
        () => {
          if (mountedRef.current) {
            fetchCount();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]); // Only depend on userId

  return { count, refetch: fetchCount };
}
