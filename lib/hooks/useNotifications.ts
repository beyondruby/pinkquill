"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "../supabase";
import type { Notification, NotificationType } from "../types";
import { isRetryableError, retryWithBackoff } from "../utils/retry";
import { useUserEvent } from "@/components/providers/UserEventsProvider";
import { usePollOnFocus } from "./usePollOnFocus";

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

export function useNotifications(userId?: string, mutedTypes?: NotificationType[]): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);
  const mutedTypesKey = (mutedTypes || []).join(",");

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
        () => {
          let query = supabase
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

          if (mutedTypesKey) {
            query = query.not("type", "in", `(${mutedTypesKey})`);
          }

          return query;
        },
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
  }, [userId, mutedTypesKey]);

  // Initial fetch - depends on userId + muted categories to prevent double-fetch
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    } else {
      // Without an explicit reset, loading stays true forever when the
      // hook is mounted before auth resolves.
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, mutedTypesKey]);

  // Live updates flow through the shared per-user broadcast channel
  // (UserEventsProvider). DB triggers send `notification_change` events with
  // {op, id, type, read}; we patch state in place for UPDATE/DELETE and
  // hydrate the full row on INSERT (skipping types the user has muted).
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

    if (payload.type && mutedTypes?.includes(payload.type as NotificationType)) {
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

export function useUnreadCount(userId?: string, mutedTypes?: NotificationType[]): UseUnreadCountReturn {
  const [count, setCount] = useState(0);
  const mutedTypesKey = (mutedTypes || []).join(",");
  const fetchingRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    if (fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { count: unreadCount, error } = await retryWithBackoff(
        () => {
          let query = supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .eq("user_id", userId)
            .eq("read", false);

          if (mutedTypesKey) {
            query = query.not("type", "in", `(${mutedTypesKey})`);
          }

          return query;
        },
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
    } finally {
      fetchingRef.current = false;
    }
  }, [userId, mutedTypesKey]);

  // Corrective refetch for events whose prior state is unknown. Debounced so
  // a burst (e.g. bulk delete) costs one request, not one per row.
  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null;
      fetchCount();
    }, 500);
  }, [fetchCount]);

  useEffect(() => {
    return () => {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, []);

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

  // Live updates: the DB trigger only emits read-state flips and includes the
  // prior state, so every event is a local ±1 — no HEAD request per event.
  // (Opening the panel marks N rows read → N events → N decrements → 0 requests.)
  useUserEvent("notification_change", (payload) => {
    if (!userId) return;
    if (payload.type && mutedTypes?.includes(payload.type as NotificationType)) {
      return;
    }
    if (payload.op === "INSERT") {
      if (payload.read !== true) {
        setCount((c) => c + 1);
      }
      return;
    }
    if (payload.op === "DELETE") {
      if (payload.was_read === false) {
        setCount((c) => Math.max(0, c - 1));
      } else if (payload.was_read == null) {
        scheduleRefetch();
      }
      return;
    }
    if (payload.op === "UPDATE") {
      if (payload.was_read === false && payload.read === true) {
        setCount((c) => Math.max(0, c - 1));
      } else if (payload.was_read === true && payload.read === false) {
        setCount((c) => c + 1);
      } else if (payload.was_read == null && typeof payload.read === "boolean") {
        scheduleRefetch();
      }
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

interface DmUnreadSummary {
  unread_count: number;
  conversation_ids: string[];
  blocked_user_ids: string[];
}

export function useUnreadMessagesCount(userId?: string): UseUnreadMessagesCountReturn {
  const [count, setCount] = useState(0);
  const mountedRef = useRef(true);
  const isFetchingRef = useRef(false);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const conversationIdsRef = useRef<Set<string>>(new Set());
  const blockedUsersRef = useRef<Set<string>>(new Set());
  const dmUnreadCountRef = useRef(0);
  const communityUnreadCountRef = useRef(0);

  // Reset when the user changes so state never leaks between accounts.
  useEffect(() => {
    conversationIdsRef.current = new Set();
    blockedUsersRef.current = new Set();
    dmUnreadCountRef.current = 0;
    communityUnreadCountRef.current = 0;
    if (!userId) {
      setCount(0);
    }
  }, [userId]);

  const syncTotalCount = useCallback(() => {
    if (!mountedRef.current) return;
    setCount(dmUnreadCountRef.current + communityUnreadCountRef.current);
  }, []);

  // DM half: one aggregate RPC (block-aware, auth.uid()-scoped) replaces
  // blocks×2 → conversation_participants → HEAD messages.
  const fetchDmSummary = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_dm_unread_summary");
    if (!mountedRef.current) return;
    if (error) {
      console.error("[useUnreadMessagesCount] Error fetching DM summary:", error.message);
      return;
    }
    const summary = (data || {}) as Partial<DmUnreadSummary>;
    conversationIdsRef.current = new Set(summary.conversation_ids || []);
    blockedUsersRef.current = new Set(summary.blocked_user_ids || []);
    dmUnreadCountRef.current = Number(summary.unread_count || 0);
  }, [userId]);

  // Community half: no realtime for this (by design); refreshed on focus.
  const fetchCommunityUnreadCount = useCallback(async () => {
    if (!userId) return;
    const { data, error } = await supabase.rpc("get_community_chat_unread_count", {
      p_user_id: userId,
    });
    if (!mountedRef.current) return;
    if (error) {
      console.error("[useUnreadMessagesCount] Error fetching community unread count:", error.message);
      return;
    }
    communityUnreadCountRef.current = Number(data || 0);
  }, [userId]);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    try {
      await Promise.all([fetchDmSummary(), fetchCommunityUnreadCount()]);
      syncTotalCount();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error("[useUnreadMessagesCount] Error:", message);
    } finally {
      isFetchingRef.current = false;
    }
  }, [userId, fetchDmSummary, fetchCommunityUnreadCount, syncTotalCount]);

  const scheduleDmRefetch = useCallback(() => {
    if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    refetchTimerRef.current = setTimeout(async () => {
      refetchTimerRef.current = null;
      await fetchDmSummary();
      syncTotalCount();
    }, 500);
  }, [fetchDmSummary, syncTotalCount]);

  useEffect(() => {
    mountedRef.current = true;
    if (userId) {
      fetchCount();
    }
    return () => {
      mountedRef.current = false;
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
    };
  }, [userId, fetchCount]);

  // DM unread updates arrive on the per-user broadcast channel. The trigger
  // carries the prior read state, so every event is a local delta; the only
  // refetch is for a conversation we have never seen.
  useUserEvent("dm_unread_change", (payload) => {
    if (!userId) return;

    const { op, conversation_id, sender_id, is_read, was_read } = payload;

    if (!conversationIdsRef.current.has(conversation_id)) {
      scheduleDmRefetch();
      return;
    }

    if (sender_id === userId) return;
    if (blockedUsersRef.current.has(sender_id)) return;

    let delta = 0;
    if (op === "INSERT") {
      if (is_read !== true) delta = 1;
    } else if (op === "DELETE") {
      if (was_read === false) delta = -1;
    } else if (op === "UPDATE") {
      if (was_read === false && is_read === true) delta = -1;
      else if (was_read === true && is_read === false) delta = 1;
    }

    if (delta !== 0) {
      dmUnreadCountRef.current = Math.max(0, dmUnreadCountRef.current + delta);
      syncTotalCount();
    }
  });

  // Focus/visibility refresh, throttled (30s). Replaces the 60s interval and
  // the unthrottled focus listeners: 10k idle tabs no longer generate a
  // baseline of ~500 requests/s for a badge.
  usePollOnFocus(fetchCount, 30_000);

  return { count, refetch: fetchCount };
}
