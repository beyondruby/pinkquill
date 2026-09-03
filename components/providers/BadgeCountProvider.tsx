"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUnreadCount, useUnreadMessagesCount } from "@/lib/hooks/useNotifications";
import { useStudioCart } from "@/lib/hooks/useStudioCart";
import { getMutedNotificationTypes } from "@/lib/utils/notificationCategories";

interface BadgeCountContextType {
  unreadNotifications: number;
  unreadMessages: number;
  cartCount: number;
  refetchNotifications: () => Promise<void>;
  refetchMessages: () => Promise<void>;
}

const BadgeCountContext = createContext<BadgeCountContextType | undefined>(undefined);

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleDeferredBadgeFetch(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 2500 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(callback, 1500);
  return () => window.clearTimeout(timer);
}

export function useBadgeCounts() {
  const context = useContext(BadgeCountContext);
  if (!context) {
    throw new Error("useBadgeCounts must be used within a BadgeCountProvider");
  }
  return context;
}

export function BadgeCountProvider({ children }: { children: ReactNode }) {
  const { user, profile, loading } = useAuth();
  const [badgeFetchReady, setBadgeFetchReady] = useState(false);
  const userId = user?.id;
  const mutedNotificationTypes = useMemo(
    () => getMutedNotificationTypes(profile?.notification_preferences),
    [profile?.notification_preferences]
  );

  /* eslint-disable react-hooks/set-state-in-effect -- badge counts are intentionally delayed until after primary content starts */
  useEffect(() => {
    setBadgeFetchReady(false);

    if (loading || !userId) {
      return;
    }

    return scheduleDeferredBadgeFetch(() => {
      setBadgeFetchReady(true);
    });
  }, [loading, userId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // CRITICAL: Only fetch counts after auth is fully loaded and the first
  // route paint has had a chance to request primary content.
  const shouldFetchCounts = badgeFetchReady && !loading && !!user;
  const { count: unreadNotifications, refetch: refetchNotifications } = useUnreadCount(
    shouldFetchCounts ? userId : undefined,
    mutedNotificationTypes
  );
  const { count: unreadMessages, refetch: refetchMessages } = useUnreadMessagesCount(
    shouldFetchCounts ? userId : undefined
  );
  const { count: cartCount } = useStudioCart();

  const value = useMemo(
    () => ({
      unreadNotifications,
      unreadMessages,
      cartCount,
      refetchNotifications,
      refetchMessages,
    }),
    [unreadNotifications, unreadMessages, cartCount, refetchNotifications, refetchMessages]
  );

  return (
    <BadgeCountContext.Provider value={value}>
      {children}
    </BadgeCountContext.Provider>
  );
}
