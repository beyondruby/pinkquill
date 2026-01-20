"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUnreadCount, useMarkAsRead, useUnreadMessagesCount } from "@/lib/hooks";
import NotificationPanel from "@/components/notifications/NotificationPanel";

export default function MobileHeader() {
  const pathname = usePathname();
  const { user, loading } = useAuth();

  // CRITICAL: Only fetch notification/message counts AFTER auth is fully loaded
  // This prevents cascading async operations during auth initialization
  const shouldFetchCounts = !loading && !!user;
  const { count: unreadCount } = useUnreadCount(shouldFetchCounts ? user?.id : undefined);
  const { count: unreadMessagesCount } = useUnreadMessagesCount(shouldFetchCounts ? user?.id : undefined);
  const { markAllAsRead } = useMarkAsRead();
  const [showNotifications, setShowNotifications] = useState(false);

  // Hide header on messages page (it has its own header)
  const isMessagesPage = pathname.startsWith("/messages");
  if (isMessagesPage) return null;

  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    if (user && unreadCount > 0) {
      await markAllAsRead(user.id);
    }
  };

  const totalUnread = unreadCount + unreadMessagesCount;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-b border-black/[0.06] md:hidden">
        <div className="flex items-center justify-between h-14 px-4">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-md shadow-purple-primary/20">
              <FontAwesomeIcon icon={faFeatherPointed} className="w-3.5 h-3.5 text-white" />
            </div>
            <h1 className="font-display text-base font-semibold text-ink">PinkQuill</h1>
          </Link>

          {/* Right side - Notifications & Messages */}
          <div className="flex items-center gap-1">
            {/* Messages */}
            {user && (
              <Link
                href="/messages"
                className="relative w-10 h-10 flex items-center justify-center rounded-full text-muted hover:text-purple-primary hover:bg-purple-primary/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {unreadMessagesCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white font-ui text-[0.6rem] font-semibold rounded-full flex items-center justify-center px-1">
                    {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                  </span>
                )}
              </Link>
            )}

            {/* Notifications */}
            {user ? (
              <button
                onClick={handleOpenNotifications}
                className="relative w-10 h-10 flex items-center justify-center rounded-full text-muted hover:text-purple-primary hover:bg-purple-primary/10 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-[16px] bg-red-500 text-white font-ui text-[0.6rem] font-semibold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded-full font-ui text-sm font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Notification Panel */}
      <NotificationPanel
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
      />
    </>
  );
}
