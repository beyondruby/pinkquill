"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import type { Notification, NotificationType } from "../types";
import { isRetryableError, retryWithBackoff } from "../utils/retry";
import { useUserEvent } from "@/components/providers/UserEventsProvider";

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

interface UseNotificationsReturn {
  notifications: Notification[];
  loading: boolean;
  refetch: () => Promise<void>;
}

export function useNotifications(userId?: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

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

      const { data, error } = await retryWithBackoff(
        () =>
          supabase
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
            .limit(50),
        {
          attempts: 3,
          shouldRetry: isRetryableError,
        }
      );

      if (error) throw error;

      setNotifications(data || []);
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

  // Initial fetch - only depends on userId to prevent double-fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    } else {
      // Without an explicit reset, loading stays true forever when the
      // hook is mounted before auth resolves.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Live updates flow through the shared per-user broadcast channel
  // (UserEventsProvider). DB triggers send `notification_change` events with
  // {op, id, type, read}; we patch state in place for UPDATE/DELETE and
  // hydrate the full row on INSERT.
  useUserEvent("notification_change", async (payload) => {
    if (!userId) return;
    if (payload.op === "DELETE") {
      setNotifications((prev) => prev.filter((n) => n.id !== payload.id));
      return;
    }
    if (payload.op === "UPDATE") {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === payload.id
            ? { ...n, read: payload.read ?? n.read }
            : n
        )
      );
      return;
    }

    const { data: fullNotif } = await supabase
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
      .eq("id", payload.id)
      .single();

    if (fullNotif) {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === fullNotif.id)) return prev;
        return [fullNotif, ...prev].slice(0, 50);
      });
    }
  });

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

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }

    try {
      const { count: unreadCount, error } = await retryWithBackoff(
        () =>
          supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("read", false),
        {
          attempts: 3,
          shouldRetry: isRetryableError,
        }
      );

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

  // Initial fetch
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (userId) {
      fetchCount();
    } else {
      setCount(0);
    }
  }, [userId, fetchCount]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Live updates: every notification change updates the unread count locally
  // without an extra DB round-trip. Triggered by the per-user broadcast
  // channel managed by UserEventsProvider.
  useUserEvent("notification_change", (payload) => {
    if (!userId) return;
    if (payload.op === "INSERT") {
      if (payload.read !== true) {
        setCount((c) => c + 1);
      }
      return;
    }
    if (payload.op === "DELETE") {
      // We don't know whether the deleted row was unread; refetch is the
      // safest correction.
      fetchCount();
      return;
    }
    if (payload.op === "UPDATE" && typeof payload.read === "boolean") {
      // Read-state flip: ±1; otherwise no change. We can't know the prior
      // state from the payload alone, so refetch on any read flip.
      fetchCount();
    }
  });

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
// useUnreadMessagesCount - Unread count for DMs + community chat inbox
// Optimized: Caches blocked users, keeps DM incremental updates, debounces refetches
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

// Backstop refetch interval for community-chat unread counts. Community
// updates no longer use realtime (the global subscription was a major source
// of egress); instead, the count syncs on window focus and on this interval.
const COMMUNITY_UNREAD_REFETCH_INTERVAL_MS = 60_000;

export function useUnreadMessagesCount(userId?: string): UseUnreadMessagesCountReturn {
  const [count, setCount] = useState(0);
  const fetchedRef = useRef(false);
  const mountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const blockedUsersRef = useRef<Set<string>>(new Set());
  const dmUnreadCountRef = useRef(0);
  const communityUnreadCountRef = useRef(0);

  // Reset cache refs when user changes so a stale state never leaks between accounts.
  useEffect(() => {
    fetchedRef.current = false;
    conversationIdsRef.current = new Set();
    blockedUsersRef.current = new Set();
    dmUnreadCountRef.current = 0;
    communityUnreadCountRef.current = 0;
    if (!userId) {
      setCount(0);
    }
  }, [userId]);

  // Fetch blocked users with caching
  const getBlockedUsers = useCallback(async (): Promise<Set<string>> => {
    if (!userId) return new Set();

    // Clear cache entries for other users to prevent cross-user leakage
    // (e.g., User A logs out, User B logs in within the TTL window)
    for (const key of blockedUsersCacheByUser.keys()) {
      if (key !== userId) {
        blockedUsersCacheByUser.delete(key);
      }
    }

    // Check cache
    const cached = blockedUsersCacheByUser.get(userId);
    if (cached && (Date.now() - cached.fetchedAt < BLOCKED_USERS_CACHE_TTL_MS)) {
      return cached.userIds;
    }

    try {
      // Fetch both directions in parallel
      const [blockedByResult, iBlockedResult] = await retryWithBackoff(
        () =>
          Promise.all([
            supabase.from("blocks").select("blocker_id").eq("blocked_id", userId),
            supabase.from("blocks").select("blocked_id").eq("blocker_id", userId),
          ]),
        {
          attempts: 3,
          shouldRetry: isRetryableError,
        }
      );

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

  const syncTotalCount = useCallback(() => {
    if (!mountedRef.current) return;
    setCount(dmUnreadCountRef.current + communityUnreadCountRef.current);
  }, []);

  const fetchCommunityUnreadCount = useCallback(async (): Promise<number> => {
    if (!userId) return 0;

    try {
      const { data, error } = await retryWithBackoff(
        () =>
          supabase.rpc("get_community_chat_unread_count", {
            p_user_id: userId,
          }),
        {
          attempts: 3,
          shouldRetry: isRetryableError,
        }
      );

      if (error) {
        console.error("[useUnreadMessagesCount] Error fetching community unread count:", error.message);
        return communityUnreadCountRef.current;
      }

      return Number(data || 0);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUnreadMessagesCount] Unexpected community unread count error:", message);
      return communityUnreadCountRef.current;
    }
  }, [userId]);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      fetchedRef.current = false;
      conversationIdsRef.current = new Set();
      blockedUsersRef.current = new Set();
      dmUnreadCountRef.current = 0;
      communityUnreadCountRef.current = 0;
      return;
    }

    if (isFetchingRef.current) {
      return;
    }
    isFetchingRef.current = true;

    try {
      // Get blocked users (uses cache)
      const blockedUserIds = await getBlockedUsers();
      blockedUsersRef.current = blockedUserIds;

      // Get conversations where user is participant
      const { data: participations, error: participationsError } = await retryWithBackoff(
        () =>
          supabase
            .from("conversation_participants")
            .select("conversation_id")
            .eq("user_id", userId),
        {
          attempts: 3,
          shouldRetry: isRetryableError,
        }
      );

      if (!mountedRef.current) return;
      if (participationsError) throw participationsError;

      let filteredCount = 0;
      if (!participations || participations.length === 0) {
        conversationIdsRef.current = new Set();
      } else {
        const conversationIds = participations.map((p) => p.conversation_id);
        conversationIdsRef.current = new Set(conversationIds);

        // Build blocked user IDs array for Supabase filter
        const blockedArray = Array.from(blockedUserIds);

        if (blockedArray.length > 0) {
          // Use count query with server-side blocked user filtering
          const { count: unreadCount, error } = await retryWithBackoff(
            () =>
              supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("is_read", false)
                .in("conversation_id", conversationIds)
                .neq("sender_id", userId)
                .not("sender_id", "in", `(${blockedArray.join(",")})`),
            {
              attempts: 3,
              shouldRetry: isRetryableError,
            }
          );

          if (!mountedRef.current) return;
          if (error) throw error;

          filteredCount = unreadCount || 0;
        } else {
          // No blocked users -- simple count query without block filter
          const { count: unreadCount, error } = await retryWithBackoff(
            () =>
              supabase
                .from("messages")
                .select("*", { count: "exact", head: true })
                .eq("is_read", false)
                .in("conversation_id", conversationIds)
                .neq("sender_id", userId),
            {
              attempts: 3,
              shouldRetry: isRetryableError,
            }
          );

          if (!mountedRef.current) return;
          if (error) throw error;

          filteredCount = unreadCount || 0;
        }
      }

      const communityUnreadCount = await fetchCommunityUnreadCount();
      if (!mountedRef.current) return;

      dmUnreadCountRef.current = filteredCount;
      communityUnreadCountRef.current = communityUnreadCount;
      syncTotalCount();
      fetchedRef.current = true;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUnreadMessagesCount] Error:", message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [userId, getBlockedUsers, fetchCommunityUnreadCount, syncTotalCount]);

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

  // DM unread updates flow through the per-user broadcast channel. The
  // database trigger fans out only to conversation participants other than
  // the sender, so each event is already targeted — no global table stream.
  useUserEvent("dm_unread_change", (payload) => {
    if (!userId) return;

    const { op, conversation_id, sender_id, is_read } = payload;

    // Conversation we don't know about yet (e.g., user was just added or a
    // brand-new conversation). Refetch to pick up the new participant row
    // and recompute the count.
    if (!conversationIdsRef.current.has(conversation_id)) {
      fetchCountRef.current();
      return;
    }

    if (sender_id === userId) return;
    if (blockedUsersRef.current.has(sender_id)) return;

    if (op === "INSERT") {
      if (is_read !== true) {
        dmUnreadCountRef.current += 1;
        syncTotalCount();
      }
      return;
    }

    if (op === "DELETE") {
      if (is_read === false) {
        dmUnreadCountRef.current = Math.max(0, dmUnreadCountRef.current - 1);
        syncTotalCount();
      } else {
        // Unknown prior unread state — refetch to stay correct.
        fetchCountRef.current();
      }
      return;
    }

    // UPDATE: we don't get the prior is_read in the payload, so any toggle
    // of read state requires a corrective refetch. This is rare compared to
    // INSERT, so the cost is minimal.
    fetchCountRef.current();
  });

  // Community chat unread: no realtime. Sync on tab focus and on a slow
  // interval. Active community chat views (per-thread channels) update their
  // own UIs in real-time; this is just the navbar badge.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;

    const refetchOnFocus = () => {
      if (document.visibilityState === "visible" && mountedRef.current) {
        fetchCountRef.current();
      }
    };

    const interval = window.setInterval(() => {
      if (mountedRef.current && document.visibilityState === "visible") {
        fetchCountRef.current();
      }
    }, COMMUNITY_UNREAD_REFETCH_INTERVAL_MS);

    document.addEventListener("visibilitychange", refetchOnFocus);
    window.addEventListener("focus", refetchOnFocus);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refetchOnFocus);
      window.removeEventListener("focus", refetchOnFocus);
    };
  }, [userId]);

  return { count, refetch: fetchCount };
}
