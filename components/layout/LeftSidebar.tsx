"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed } from "@fortawesome/free-solid-svg-icons";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUnreadCount, useMarkAsRead, useUnreadMessagesCount } from "@/lib/hooks";
import NotificationPanel from "@/components/notifications/NotificationPanel";
import SearchBar from "@/components/search/SearchBar";

const publicNavItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "compass", label: "Explore", href: "/explore" },
];

const authNavItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "takes", label: "Takes", href: "/takes" },
  { icon: "compass", label: "Explore", href: "/explore" },
  { icon: "bookmark", label: "Saved", href: "/saved" },
  { icon: "users", label: "Communities", href: "/community" },
];

const icons: Record<string, React.ReactElement> = {
  home: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  takes: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {/* Clapperboard body */}
      <rect x="3" y="8" width="18" height="13" rx="2" />
      {/* Clapper top bar */}
      <path d="M3 8l3-5h12l3 5" />
      {/* Diagonal stripes */}
      <path d="M7 3l2 5M11 3l2 5M15 3l2 5" />
      {/* Play triangle hint */}
      <path d="M10 14l4 2.5-4 2.5v-5" fill="currentColor" stroke="none" />
    </svg>
  ),
  compass: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
    </svg>
  ),
  fire: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
    </svg>
  ),
  bookmark: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  ),
  users: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  sparkles: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  "paper-plane": (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  ),
  quill: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/>
      <line x1="17.5" y1="15" x2="9" y2="15"/>
    </svg>
  ),
  logout: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  ),
};

export default function LeftSidebar() {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();

  // CRITICAL: Only fetch notification/message counts AFTER auth is fully loaded
  // This prevents cascading async operations during auth initialization
  const shouldFetchCounts = !loading && !!user;
  const { count: unreadCount } = useUnreadCount(shouldFetchCounts ? user?.id : undefined);
  const { count: unreadMessagesCount } = useUnreadMessagesCount(shouldFetchCounts ? user?.id : undefined);
  const { markAllAsRead } = useMarkAsRead();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleOpenNotifications = async () => {
    setShowNotifications(true);
    // Mark all as read when opening
    if (user && unreadCount > 0) {
      await markAllAsRead(user.id);
    }
  };

  return (
    <>
      <nav className="hidden md:flex fixed left-0 top-0 bottom-0 w-[220px] bg-white/95 backdrop-blur-xl border-r border-border-light flex-col p-6 z-[100] overflow-visible" aria-label="Main navigation">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-lg shadow-purple-primary/20">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="font-display text-lg text-ink leading-tight">PinkQuill</h1>
            <p className="font-body text-[0.6rem] text-muted italic">Show your colors.</p>
          </div>
        </Link>

        {/* Search Bar */}
        <SearchBar />

        {/* Main Nav Items */}
        <div className="flex flex-col gap-1 flex-1">
          {(user ? authNavItems : publicNavItems).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative w-full h-12 flex items-center gap-3.5 px-4 rounded-xl transition-all duration-300 ${
                pathname === item.href
                  ? "text-pink-vivid bg-pink-vivid/10 font-medium"
                  : "text-muted hover:text-purple-primary hover:bg-purple-primary/10"
              }`}
            >
              {icons[item.icon]}
              <span className="font-ui text-[0.95rem]">{item.label}</span>
            </Link>
          ))}

          {/* Authenticated-only items */}
          {user && (
            <>
              {/* Divider */}
              <div className="w-full h-px bg-border-light my-3" />

              {/* Notifications Button */}
              <button
                onClick={handleOpenNotifications}
                className={`relative w-full h-12 flex items-center gap-3.5 px-4 rounded-xl transition-all duration-300 ${
                  showNotifications
                    ? "text-pink-vivid bg-pink-vivid/10 font-medium"
                    : "text-muted hover:text-purple-primary hover:bg-purple-primary/10"
                }`}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                aria-expanded={showNotifications}
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white font-ui text-[0.65rem] font-semibold rounded-full flex items-center justify-center px-1" aria-hidden="true">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className="font-ui text-[0.95rem]">Notifications</span>
              </button>

              {/* Messages Link */}
              <Link
                href="/messages"
                className={`relative w-full h-12 flex items-center gap-3.5 px-4 rounded-xl transition-all duration-300 ${
                  pathname === "/messages"
                    ? "text-pink-vivid bg-pink-vivid/10 font-medium"
                    : "text-muted hover:text-purple-primary hover:bg-purple-primary/10"
                }`}
                aria-label={unreadMessagesCount > 0 ? `Messages, ${unreadMessagesCount} unread` : "Messages"}
              >
                <div className="relative">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white font-ui text-[0.65rem] font-semibold rounded-full flex items-center justify-center px-1" aria-hidden="true">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
                <span className="font-ui text-[0.95rem]">Messages</span>
              </Link>
            </>
          )}
        </div>

      {/* Create Button - Only for authenticated users */}
      {user && (
        <Link
          href="/create"
          className="w-full h-12 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-xl flex items-center justify-center gap-2 text-white shadow-lg shadow-pink-vivid/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-vivid/40 transition-all duration-300 mt-auto"
        >
          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
            <line x1="16" y1="8" x2="2" y2="22"/>
            <line x1="17.5" y1="15" x2="9" y2="15"/>
          </svg>
          <span className="font-ui text-[0.95rem] font-bold">Create</span>
        </Link>
      )}

      {/* Profile & Menu - Authenticated users */}
      {loading ? (
        /* Loading placeholder while auth state is being determined */
        <div className="mt-3">
          <div className="flex items-center gap-3 p-3">
            <div className="w-[38px] h-[38px] rounded-full bg-gray-200 animate-pulse" />
            <div className="flex flex-col gap-1.5">
              <div className="w-24 h-4 bg-gray-200 rounded animate-pulse" />
              <div className="w-16 h-3 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>
      ) : user && profile ? (
        <div className="mt-3 relative" ref={menuRef}>
          <Link
            href={`/studio/${profile.username}`}
            className="flex items-center gap-3 p-3 cursor-pointer rounded-xl hover:bg-purple-primary/5 transition-all duration-300"
          >
            <img
              src={profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
              alt="Profile"
              className="w-[38px] h-[38px] rounded-full object-cover border-2 border-pink-vivid"
            />
            <div className="flex flex-col gap-0.5">
              <span className="font-ui text-[0.9rem] font-medium text-ink">
                {profile.display_name || profile.username}
              </span>
              <span className="font-body text-[0.8rem] text-muted">
                @{profile.username}
              </span>
            </div>
          </Link>

          {/* More Button */}
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-full flex items-center gap-3.5 px-4 py-3 mt-1 rounded-xl text-muted hover:text-purple-primary hover:bg-purple-primary/[0.06] transition-all duration-200"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="font-ui text-[0.95rem]">More</span>
          </button>

          {/* Dropdown Menu */}
          {showMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-2 p-1.5 rounded-2xl bg-white/95 backdrop-blur-xl shadow-xl shadow-black/[0.08] border border-black/[0.06] z-50 animate-fadeIn">
              <Link
                href="/insights"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink/80 hover:text-purple-primary hover:bg-purple-primary/[0.06] transition-all duration-200"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <span className="font-ui text-[0.9rem]">Insights</span>
              </Link>

              <Link
                href="/settings"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink/80 hover:text-purple-primary hover:bg-purple-primary/[0.06] transition-all duration-200"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="font-ui text-[0.9rem]">Settings</span>
              </Link>

              <Link
                href="/help"
                onClick={() => setShowMenu(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink/80 hover:text-purple-primary hover:bg-purple-primary/[0.06] transition-all duration-200"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-ui text-[0.9rem]">Help</span>
              </Link>

              <div className="my-1.5 mx-2 h-px bg-black/[0.06]" />

              <button
                onClick={() => {
                  setShowMenu(false);
                  signOut();
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink/80 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
              >
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                <span className="font-ui text-[0.9rem]">Log out</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        /* Sign In Button - Non-authenticated users */
        <Link
          href="/login"
          className="flex items-center gap-3 p-3 mt-auto cursor-pointer rounded-xl hover:bg-purple-primary/5 transition-all duration-300"
        >
          <div className="w-[38px] h-[38px] rounded-full bg-purple-primary/10 flex items-center justify-center text-purple-primary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <span className="font-ui text-[0.9rem] font-medium text-purple-primary">
            Sign In
          </span>
        </Link>
      )}
    </nav>

    {/* Notification Panel */}
    <NotificationPanel
      isOpen={showNotifications}
      onClose={() => setShowNotifications(false)}
    />
    </>
  );
}