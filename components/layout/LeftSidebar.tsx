"use client";

import React, { useState, useRef, useEffect } from "react";
import { NavigationIcon } from "@/components/ui/NavigationIcon";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFeatherPointed } from "@fortawesome/free-solid-svg-icons";
import dynamic from "next/dynamic";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import SearchBar from "@/components/search/SearchBar";

const NotificationPanel = dynamic(() => import("@/components/notifications/NotificationPanel"), { ssr: false });
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";
import { QuickThemeToggle } from "@/components/theme/QuickThemeToggle";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";

const publicNavItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "compass", label: "Explore", href: "/explore" },
];

const authNavItems = [
  { icon: "home", label: "Home", href: "/" },
  { icon: "takes", label: "Takes", href: "/takes" },
  { icon: "compass", label: "Explore", href: "/explore" },
  { icon: "users", label: "Communities", href: "/community" },
  { icon: "shop", label: "Marketplace", href: "/shop" },
];

const icons: Record<string, React.ReactElement> = {
  "home": <NavigationIcon name="home" className="w-5 h-5 flex-shrink-0" />,
  "takes": <NavigationIcon name="takes" className="w-5 h-5 flex-shrink-0" />,
  "compass": <NavigationIcon name="compass" className="w-5 h-5 flex-shrink-0" />,
  "fire": <NavigationIcon name="fire" className="w-5 h-5 flex-shrink-0" />,
  "bookmark": <NavigationIcon name="bookmark" className="w-5 h-5 flex-shrink-0" />,
  "users": <NavigationIcon name="users" className="w-5 h-5 flex-shrink-0" />,
  "shop": <NavigationIcon name="shop" className="w-5 h-5 flex-shrink-0" />,
  "sparkles": <NavigationIcon name="sparkles" className="w-5 h-5 flex-shrink-0" />,
  "paper-plane": <NavigationIcon name="paper-plane" className="w-5 h-5 flex-shrink-0" />,
  "quill": <NavigationIcon name="quill" className="w-5 h-5 flex-shrink-0" />,
  "cart": <NavigationIcon name="shop" className="w-5 h-5 flex-shrink-0" />,
  "logout": <NavigationIcon name="logout" className="w-5 h-5 flex-shrink-0" />,
};

export default function LeftSidebar() {
  const pathname = usePathname();
  const { user, profile, loading, signOut } = useAuth();

  // Sidebar collapse/expand state
  const [isExpanded, setIsExpanded] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const { unreadNotifications: unreadCount, unreadMessages: unreadMessagesCount, cartCount } = useBadgeCounts();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const router = useRouter();

  // Handle sidebar hover
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsExpanded(true);
  };

  const handleMouseLeave = () => {
    // Don't collapse if a menu is open (user might be clicking on menu items)
    if (showMenu || showCreateMenu) {
      return;
    }
    // Small delay before collapsing to prevent accidental collapse
    hoverTimeoutRef.current = setTimeout(() => {
      setIsExpanded(false);
    }, 150);
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const handleOpenNotifications = () => {
    setShowNotifications(true);
  };

  const createMenuItems: ActionMenuItem[] = [
    {
      label: "Post",
      onSelect: () => router.push("/create"),
      icon: icons.quill,
    },
    {
      label: "Product",
      onSelect: () => router.push("/sell"),
      icon: icons.shop,
    },
    {
      label: "Service",
      onSelect: () => router.push("/sell/service"),
      icon: (
        <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 7h8m-8 4h5m-5 4h6m6 2a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h5l2 2h7a2 2 0 012 2v8z" />
        </svg>
      ),
    },
  ];

  const moreMenuItems: ActionMenuItem[] = [
    { label: "Saved", href: "/saved", icon: icons.bookmark, sectionLabel: "Library" },
    {
      label: "Bag",
      href: "/cart",
      icon: icons.cart,
      meta: cartCount > 0 ? (
        <span className="min-w-[18px] h-[18px] rounded-full bg-pink-vivid px-1.5 text-[0.65rem] font-semibold text-white flex items-center justify-center">
          {cartCount > 99 ? "99+" : cartCount}
        </span>
      ) : undefined,
    },
    { label: "Orders", href: "/orders", icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ) },
    { label: "Insights", href: "/insights", icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ), sectionLabel: "Creator" },
    { label: "Seller Studio", href: "/seller/dashboard", icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h7v7H3V3zm11 0h7v4h-7V3zm0 7h7v11h-7V10zM3 13h7v8H3v-8z" />
      </svg>
    ) },
    { label: "Settings", href: "/settings", icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ), sectionLabel: "Support" },
    { label: "Help", href: "/help", icon: (
      <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ) },
  ];

  return (
    <>
      <nav
        ref={sidebarRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`hidden md:flex fixed left-0 top-0 bottom-0 bg-surface/95 backdrop-blur-xl border-r border-border-light flex-col p-4 z-[100] overflow-visible transition-all duration-300 ease-in-out ${
          isExpanded ? "w-[220px]" : "w-[72px]"
        }`}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <Link href="/" className={`flex items-center mb-6 ${isExpanded ? "gap-3 px-2" : "justify-center"}`}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm flex items-center justify-center shadow-lg shadow-purple-primary/20 flex-shrink-0">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-on-accent" />
          </div>
          <div className={`overflow-hidden transition-all duration-300 ${isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 absolute"}`}>
            <h1 className="font-display text-lg text-ink leading-tight whitespace-nowrap">PinkQuill</h1>
            <p className="font-body text-[0.6rem] text-muted italic whitespace-nowrap">Show your colors.</p>
          </div>
        </Link>

        {/* Search Bar - Only visible when expanded */}
        <div className={`transition-all duration-300 ${isExpanded ? "opacity-100 mb-4" : "opacity-0 h-0 overflow-hidden pointer-events-none"}`}>
          <SearchBar />
        </div>

        {/* Main Nav Items */}
        <div className="flex flex-col gap-1 flex-1">
          {(user ? authNavItems : publicNavItems).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative h-12 flex items-center rounded-xl transition-all duration-300 ${
                isExpanded ? "px-4 gap-3.5" : "justify-center px-0"
              } ${
                pathname === item.href
                  ? "text-accent-2 bg-pink-50 font-medium"
                  : "text-muted hover:text-accent hover:bg-purple-50"
              }`}
              title={!isExpanded ? item.label : undefined}
            >
              <div className="relative flex-shrink-0">
                {icons[item.icon]}
              </div>
              <span className={`font-ui text-[0.95rem] whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
              }`}>
                {item.label}
              </span>
            </Link>
          ))}

          {/* Authenticated-only items */}
          {user && (
            <>
              {/* Divider */}
              <div className={`h-px bg-border-light my-3 ${isExpanded ? "w-full" : "w-8 mx-auto"}`} />

              {/* Notifications Button */}
              <button
                onClick={handleOpenNotifications}
                className={`relative h-12 flex items-center rounded-xl transition-all duration-300 ${
                  isExpanded ? "px-4 gap-3.5 w-full" : "justify-center px-0"
                } ${
                  showNotifications
                    ? "text-accent-2 bg-pink-50 font-medium"
                    : "text-muted hover:text-accent hover:bg-purple-50"
                }`}
                aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
                aria-expanded={showNotifications}
                title={!isExpanded ? "Notifications" : undefined}
              >
                <div className="relative flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white font-ui text-[0.65rem] font-semibold rounded-full flex items-center justify-center px-1" aria-hidden="true">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </div>
                <span className={`font-ui text-[0.95rem] whitespace-nowrap transition-all duration-300 ${
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                }`}>
                  Notifications
                </span>
              </button>

              {/* Messages Link */}
              <Link
                href="/messages"
                className={`relative h-12 flex items-center rounded-xl transition-all duration-300 ${
                  isExpanded ? "px-4 gap-3.5" : "justify-center px-0"
                } ${
                  pathname.startsWith("/messages")
                    ? "text-accent-2 bg-pink-50 font-medium"
                    : "text-muted hover:text-accent hover:bg-purple-50"
                }`}
                aria-label={unreadMessagesCount > 0 ? `Messages, ${unreadMessagesCount} unread` : "Messages"}
                title={!isExpanded ? "Messages" : undefined}
              >
                <div className="relative flex-shrink-0">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {unreadMessagesCount > 0 && (
                    <span className="absolute -top-2 -right-2 min-w-[18px] h-[18px] bg-red-500 text-white font-ui text-[0.65rem] font-semibold rounded-full flex items-center justify-center px-1" aria-hidden="true">
                      {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                    </span>
                  )}
                </div>
                <span className={`font-ui text-[0.95rem] whitespace-nowrap transition-all duration-300 ${
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"
                }`}>
                  Messages
                </span>
              </Link>
            </>
          )}
        </div>

        {/* Create Button - Only for authenticated users */}
        {user && (
          <div className={`relative mt-auto ${isExpanded ? "" : "flex justify-center"}`}>
            <ActionMenu
              items={createMenuItems}
              label="Create"
              widthClassName="w-56"
              portal
              align="start"
              placement="top"
              onOpenChange={setShowCreateMenu}
              buttonAriaLabel="Create menu"
              buttonClassName={`bg-gradient-to-r from-purple-primary to-pink-vivid flex items-center justify-center text-on-accent shadow-lg shadow-pink-vivid/30 hover:scale-[1.02] hover:shadow-xl hover:shadow-pink-vivid/40 transition-all duration-300 ${
                isExpanded ? "w-full h-12 rounded-xl gap-2" : "w-10 h-10 rounded-full"
              }`}
              trigger={
                <>
                  <svg className={`flex-shrink-0 ${isExpanded ? "w-5 h-5" : "w-4 h-4"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  <span className={`font-ui text-[0.95rem] font-bold whitespace-nowrap transition-all duration-300 ${
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden absolute"
                  }`}>
                    Create
                  </span>
                  <svg className={`w-4 h-4 flex-shrink-0 transition-all duration-200 ${
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden absolute"
                  } ${showCreateMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              }
            />
          </div>
        )}

        {/* Profile & Menu - Authenticated users */}
        {loading || (user && !profile) ? (
          /* Loading placeholder while auth or profile is being loaded */
          <div className={`mt-3 ${isExpanded ? "" : "flex justify-center"}`}>
            <div className={`flex items-center ${isExpanded ? "gap-3 p-3" : "p-1"}`}>
              <div className={`rounded-full bg-skeleton animate-pulse flex-shrink-0 ${isExpanded ? "w-[38px] h-[38px]" : "w-9 h-9"}`} />
              <div className={`flex flex-col gap-1.5 transition-all duration-300 ${isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden absolute"}`}>
                <div className="w-24 h-4 bg-skeleton rounded animate-pulse" />
                <div className="w-16 h-3 bg-skeleton rounded animate-pulse" />
              </div>
            </div>
          </div>
        ) : user && profile ? (
          <div className={`mt-3 relative ${isExpanded ? "" : "flex flex-col items-center"}`}>
            <Link
              href={`/studio/${profile.username}`}
              className={`flex items-center cursor-pointer rounded-xl hover:bg-accent/5 transition-all duration-300 ${
                isExpanded ? "gap-3 p-3" : "p-1 justify-center"
              }`}
              title={!isExpanded ? profile.display_name || profile.username : undefined}
            >
              <img
                src={getOptimizedAvatarUrl(profile.avatar_url) || DEFAULT_AVATAR}
                alt="Profile"
                className={`rounded-full object-cover border-2 border-pink-vivid flex-shrink-0 ${
                  isExpanded ? "w-[38px] h-[38px]" : "w-9 h-9"
                }`}
              />
              <div className={`flex flex-col gap-0.5 transition-all duration-300 overflow-hidden ${
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 absolute"
              }`}>
                <span className="font-ui text-[0.9rem] font-medium text-ink whitespace-nowrap">
                  {profile.display_name || profile.username}
                </span>
                <span className="font-body text-[0.8rem] text-muted whitespace-nowrap">
                  @{profile.username}
                </span>
              </div>
            </Link>

            <ActionMenu
              items={moreMenuItems}
              label="More"
              widthClassName="w-60"
              portal
              align="start"
              placement="auto"
              onOpenChange={setShowMenu}
              buttonAriaLabel="More menu"
              buttonClassName={`flex items-center rounded-xl text-muted hover:text-accent hover:bg-accent/[0.06] transition-all duration-200 ${
                isExpanded ? "w-full gap-3.5 px-4 py-3 mt-1" : "w-9 h-9 justify-center mt-2"
              }`}
              trigger={
                <>
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                  <span className={`font-ui text-[0.95rem] whitespace-nowrap transition-all duration-300 ${
                    isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden absolute"
                  }`}>
                    More
                  </span>
                </>
              }
              footer={(close) => (
                <>
                  <QuickThemeToggle />
                  <div className="h-px bg-border-light mx-2 my-1.5" />
                  <button
                    onClick={() => {
                      close();
                      signOut();
                    }}
                    className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left font-ui text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <span className="flex h-5 w-5 items-center justify-center text-red-500">
                      {icons.logout}
                    </span>
                    <span className="font-medium">Log out</span>
                  </button>
                </>
              )}
            />
          </div>
        ) : (
          /* Sign In Button - Non-authenticated users */
          <div className={`mt-auto ${isExpanded ? "" : "flex justify-center"}`}>
            <Link
              href="/login"
              className={`flex items-center cursor-pointer rounded-xl hover:bg-accent/5 transition-all duration-300 ${
                isExpanded ? "gap-3 p-3" : "p-1"
              }`}
              title={!isExpanded ? "Sign In" : undefined}
            >
              <div className={`rounded-full bg-purple-50 flex items-center justify-center text-accent flex-shrink-0 ${
                isExpanded ? "w-[38px] h-[38px]" : "w-9 h-9"
              }`}>
                <svg className={`${isExpanded ? "w-5 h-5" : "w-4 h-4"}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className={`font-ui text-[0.9rem] font-medium text-accent whitespace-nowrap transition-all duration-300 ${
                isExpanded ? "opacity-100" : "opacity-0 w-0 overflow-hidden absolute"
              }`}>
                Sign In
              </span>
            </Link>
          </div>
        )}
      </nav>

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
