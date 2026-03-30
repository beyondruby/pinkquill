"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUnreadCount, useUnreadMessagesCount } from "@/lib/hooks";
import { useStudioCart } from "@/lib/hooks/useStudioQueue";

interface BadgeCountContextType {
  unreadNotifications: number;
  unreadMessages: number;
  cartCount: number;
  refetchNotifications: () => Promise<void>;
  refetchMessages: () => Promise<void>;
}

const BadgeCountContext = createContext<BadgeCountContextType | undefined>(undefined);

export function useBadgeCounts() {
  const context = useContext(BadgeCountContext);
  if (!context) {
    throw new Error("useBadgeCounts must be used within a BadgeCountProvider");
  }
  return context;
}

export function BadgeCountProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // CRITICAL: Only fetch counts AFTER auth is fully loaded
  // This prevents cascading async operations during auth initialization
  const shouldFetchCounts = !loading && !!user;
  const { count: unreadNotifications, refetch: refetchNotifications } = useUnreadCount(
    shouldFetchCounts ? user?.id : undefined
  );
  const { count: unreadMessages, refetch: refetchMessages } = useUnreadMessagesCount(
    shouldFetchCounts ? user?.id : undefined
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
