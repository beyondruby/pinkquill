"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";

export type UserEventType =
  | "dm_unread_change"
  | "notification_change"
  | "follow_change";

export interface DmUnreadChangePayload {
  op: "INSERT" | "UPDATE" | "DELETE";
  conversation_id: string;
  sender_id: string;
  message_id: string;
  is_read: boolean | null;
  /** Prior read state (UPDATE/DELETE only) — lets clients apply a delta. */
  was_read?: boolean | null;
  /** Preview fields (INSERT only). */
  created_at?: string;
  content?: string;
  message_type?: "text" | "voice" | "media" | null;
  voice_duration?: number | null;
  media_type?: "image" | "video" | null;
}

export interface NotificationChangePayload {
  op: "INSERT" | "UPDATE" | "DELETE";
  id: string;
  type?: string;
  read?: boolean;
  /** Prior read state (UPDATE/DELETE only). */
  was_read?: boolean | null;
}

export interface FollowChangePayload {
  op: "INSERT" | "UPDATE" | "DELETE";
  follower_id: string;
  following_id: string;
  status?: "pending" | "accepted";
}

export type UserEventPayloadMap = {
  dm_unread_change: DmUnreadChangePayload;
  notification_change: NotificationChangePayload;
  follow_change: FollowChangePayload;
};

type Handler<T extends UserEventType> = (payload: UserEventPayloadMap[T]) => void;

interface UserEventsContextValue {
  subscribe: <T extends UserEventType>(type: T, handler: Handler<T>) => () => void;
}

const UserEventsContext = createContext<UserEventsContextValue | null>(null);

const EVENT_TYPES: UserEventType[] = [
  "dm_unread_change",
  "notification_change",
  "follow_change",
];

export function UserEventsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  // One Set<Handler> per event type. Stored in a ref so handler add/remove
  // never re-renders the provider or re-creates the channel.
  const handlersRef = useRef<Map<UserEventType, Set<Handler<UserEventType>>>>(
    (() => {
      const m = new Map<UserEventType, Set<Handler<UserEventType>>>();
      for (const t of EVENT_TYPES) m.set(t, new Set());
      return m;
    })()
  );

  const channelRef = useRef<RealtimeChannel | null>(null);
  const subscribedUserIdRef = useRef<string | null>(null);

  const subscribe = useCallback(
    <T extends UserEventType>(type: T, handler: Handler<T>) => {
      const set = handlersRef.current.get(type) as Set<Handler<T>> | undefined;
      if (!set) return () => undefined;
      set.add(handler);
      return () => {
        set.delete(handler);
      };
    },
    []
  );

  useEffect(() => {
    // Tear down when signed out.
    if (!userId) {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedUserIdRef.current = null;
      }
      return;
    }

    // Idempotent: if we already have the right channel, do nothing.
    if (channelRef.current && subscribedUserIdRef.current === userId) {
      return;
    }

    // User changed → tear down old channel.
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const emit = <T extends UserEventType>(type: T, payload: UserEventPayloadMap[T]) => {
      const set = handlersRef.current.get(type) as Set<Handler<T>> | undefined;
      if (!set || set.size === 0) return;
      for (const fn of set) {
        try {
          fn(payload);
        } catch (err) {
          console.error(`[UserEvents] handler for ${type} threw:`, err);
        }
      }
    };

    const topic = `user-events:${userId}`;
    const channel = supabase
      .channel(topic, { config: { private: true } })
      .on("broadcast", { event: "dm_unread_change" }, ({ payload }) => {
        emit("dm_unread_change", payload as DmUnreadChangePayload);
      })
      .on("broadcast", { event: "notification_change" }, ({ payload }) => {
        emit("notification_change", payload as NotificationChangePayload);
      })
      .on("broadcast", { event: "follow_change" }, ({ payload }) => {
        emit("follow_change", payload as FollowChangePayload);
      })
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.error(`[UserEvents] channel ${topic} status: ${status}`);
        }
      });

    channelRef.current = channel;
    subscribedUserIdRef.current = userId;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        subscribedUserIdRef.current = null;
      }
    };
  }, [userId]);

  const value = useMemo<UserEventsContextValue>(() => ({ subscribe }), [subscribe]);

  return (
    <UserEventsContext.Provider value={value}>
      {children}
    </UserEventsContext.Provider>
  );
}

export function useUserEvent<T extends UserEventType>(
  type: T,
  handler: Handler<T>
): void {
  const ctx = useContext(UserEventsContext);
  const handlerRef = useRef(handler);

  useEffect(() => {
    handlerRef.current = handler;
  }, [handler]);

  useEffect(() => {
    if (!ctx) return;
    return ctx.subscribe(type, ((payload) => handlerRef.current(payload)) as Handler<T>);
  }, [ctx, type]);
}
