"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import { QuickThemeToggle } from "@/components/theme/QuickThemeToggle";

interface MobileMoreSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MoreItem {
  label: string;
  href: string;
  icon: React.ReactElement;
  meta?: React.ReactNode;
  section?: string;
}

const baseIconClass = "w-5 h-5 flex-shrink-0";

export default function MobileMoreSheet({ isOpen, onClose }: MobileMoreSheetProps) {
  const { user, profile, signOut } = useAuth();
  const { cartCount } = useBadgeCounts();

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const items: MoreItem[] = [
    {
      section: "Discover",
      label: "Communities",
      href: "/community",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
    },
    {
      label: "Marketplace",
      href: "/shop",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      section: "Library",
      label: "Saved",
      href: "/saved",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      ),
    },
    {
      label: "Bag",
      href: "/cart",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
      meta:
        cartCount > 0 ? (
          <span className="min-w-[20px] h-[20px] rounded-full bg-pink-vivid px-1.5 text-[0.65rem] font-semibold text-white flex items-center justify-center">
            {cartCount > 99 ? "99+" : cartCount}
          </span>
        ) : undefined,
    },
    {
      label: "Orders",
      href: "/orders",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
      ),
    },
    {
      section: "Creator",
      label: "Insights",
      href: "/insights",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      ),
    },
    {
      label: "Seller Dashboard",
      href: "/seller/dashboard",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M3 3h7v7H3V3zm11 0h7v4h-7V3zm0 7h7v11h-7V10zM3 13h7v8H3v-8z" />
        </svg>
      ),
    },
    {
      section: "Support",
      label: "Settings",
      href: "/settings",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      ),
    },
    {
      label: "Help",
      href: "/help",
      icon: (
        <svg className={baseIconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[110] animate-fadeIn md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        className="fixed inset-y-0 right-0 w-[88vw] max-w-[360px] bg-surface z-[120] flex flex-col shadow-2xl md:hidden"
        style={{ animation: "slideInRight 250ms ease-out" }}
        role="dialog"
        aria-label="More menu"
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}</style>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border-light">
          <h2 className="font-display text-lg text-ink">More</h2>
          <button
            onClick={onClose}
            aria-label="Close more menu"
            className="w-9 h-9 rounded-full text-muted hover:text-ink hover:bg-skeleton/70 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Profile chip */}
        {user && profile && (
          <Link
            href={`/studio/${profile.username}`}
            onClick={onClose}
            className="flex items-center gap-3 px-5 py-4 border-b border-border-light hover:bg-subtle/40 transition-colors"
          >
            <img
              src={profile.avatar_url || "/default-avatar.png"}
              alt=""
              className="w-11 h-11 rounded-full object-cover border-2 border-pink-vivid"
            />
            <div className="min-w-0 flex-1">
              <p className="font-ui text-[0.95rem] font-medium text-ink truncate">
                {profile.display_name || profile.username}
              </p>
              <p className="font-body text-xs text-muted truncate">
                @{profile.username}
              </p>
            </div>
            <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        {/* Items */}
        <nav className="flex-1 overflow-y-auto py-2">
          {items.map((item, i) => {
            const previous = items[i - 1];
            const showSection =
              item.section && (!previous || previous.section !== item.section);
            return (
              <div key={item.href}>
                {showSection && (
                  <p className="px-5 pt-4 pb-1.5 font-ui text-[0.65rem] font-semibold uppercase tracking-wider text-muted">
                    {item.section}
                  </p>
                )}
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3.5 px-5 py-3 text-ink hover:bg-subtle/60 transition-colors"
                >
                  <span className="text-muted">{item.icon}</span>
                  <span className="flex-1 font-ui text-[0.95rem]">{item.label}</span>
                  {item.meta}
                </Link>
              </div>
            );
          })}

          {/* Theme toggle */}
          <div className="px-3 mt-3 border-t border-border-light pt-3">
            <QuickThemeToggle />
          </div>

          {/* Sign out */}
          {user && (
            <button
              onClick={() => {
                onClose();
                signOut();
              }}
              className="mt-1 w-full flex items-center gap-3.5 px-5 py-3 text-red-600 hover:bg-red-50 transition-colors"
            >
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              <span className="flex-1 text-left font-ui text-[0.95rem] font-medium">Log out</span>
            </button>
          )}
        </nav>
      </div>
    </>
  );
}
