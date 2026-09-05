"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import SearchBar from "@/components/search/SearchBar";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";
import { NavIcon, countLabel, formatCount } from "./navigation";

const NotificationPanel = dynamic(() => import("@/components/notifications/NotificationPanel"), { ssr: false });

/**
 * One top bar for every width. Search is always visible (no hover rail to
 * discover), notifications open a trailing panel, and on phones the brand and
 * Messages live here because the bottom bar has no room for them.
 */
export default function TopBar() {
  const pathname = usePathname();
  const { user, profile } = useAuth();
  const { unreadNotifications, unreadMessages } = useBadgeCounts();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <>
      <header className="pq-topbar">
        <Link href="/" className="pq-topbar__brand" aria-label="Pinkquill home">
          <img src="/icon.svg" alt="" width={30} height={30} />
        </Link>

        <div className="pq-topbar__search">
          <SearchBar />
        </div>

        <div className="pq-topbar__actions">
          {user ? (
            <>
              <Link
                href="/messages"
                className="pq-icon-button md:hidden"
                aria-label={countLabel("Messages", unreadMessages)}
              >
                <NavIcon name="message" />
                {unreadMessages > 0 && <span className="pq-topbar__dot" aria-hidden="true">{formatCount(unreadMessages)}</span>}
              </Link>
              <button
                type="button"
                className="pq-icon-button"
                onClick={() => setShowNotifications(true)}
                aria-label={countLabel("Notifications", unreadNotifications)}
                aria-expanded={showNotifications}
                aria-haspopup="dialog"
              >
                <NavIcon name="bell" />
                {unreadNotifications > 0 && <span className="pq-topbar__dot" aria-hidden="true">{formatCount(unreadNotifications)}</span>}
              </button>
              {profile && (
                <Link
                  href={`/studio/${profile.username}`}
                  className="pq-topbar__avatar"
                  aria-label="My studio"
                >
                  <img
                    src={getOptimizedAvatarUrl(profile.avatar_url) || DEFAULT_AVATAR}
                    alt=""
                    className="pq-avatar pq-avatar--sm"
                    width={32}
                    height={32}
                  />
                </Link>
              )}
            </>
          ) : (
            <Link href={`/login?redirect=${encodeURIComponent(pathname)}`} className="pq-topbar__signin pq-button pq-button--sm pq-button--primary">
              Sign in
            </Link>
          )}
        </div>
      </header>

      {showNotifications && (
        <NotificationPanel isOpen={showNotifications} onClose={() => setShowNotifications(false)} />
      )}
    </>
  );
}
