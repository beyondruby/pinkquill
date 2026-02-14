"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import NotificationPanel from "@/components/notifications/NotificationPanel";

export default function MobileHeader() {
  const pathname = usePathname();
  const { user } = useAuth();

  const { unreadNotifications: unreadCount, unreadMessages: unreadMessagesCount } = useBadgeCounts();
  const [showNotifications, setShowNotifications] = useState(false);

  // Hide header on messages page (it has its own header)
  const isMessagesPage = pathname.startsWith("/messages");
  if (isMessagesPage) return null;

  const handleOpenNotifications = () => {
    setShowNotifications(true);
  };

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
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <defs><linearGradient id="cg-mh-msg" x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset=".5" stopColor="#EC4899" /><stop offset="1" stopColor="#F97316" /></linearGradient></defs>
                  <path d="M8 3.5C4.5 3.5 2 6 2 9c0 1.4.5 2.6 1.4 3.6L2 16l2.8-1.3c.7.5 1.6.8 2.5.8.7 0 1.3-.1 1.9-.3" stroke="url(#cg-mh-msg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M15 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5c.8 0 1.5-.1 2.2-.4L21 19l-1.5-3c.7-1 1.1-2.2 1.1-3.5 0-3-2.4-5.5-5.6-5.5z" stroke="url(#cg-mh-msg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M12 10.5h6M12 13h4" stroke="url(#cg-mh-msg)" strokeWidth="1.8" strokeLinecap="round" />
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
      {showNotifications && (
        <NotificationPanel
          isOpen={showNotifications}
          onClose={() => setShowNotifications(false)}
        />
      )}
    </>
  );
}
