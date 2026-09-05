"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Sheet from "@/components/ui/Sheet";
import { CREATE_CHOICES, NavIcon, bottomBarDestinations, isDestinationActive } from "./navigation";

const MobileMoreSheet = dynamic(() => import("./MobileMoreSheet"), { ssr: false });

/**
 * Phone bottom bar: Home, Explore, Create, Takes, More. Create opens the same
 * three existing choices the desktop menu offers instead of jumping straight
 * to the post composer. Guests get Sign in where Create would be.
 */
export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const ctx = { signedIn: !!user, username: profile?.username };
  const [home, explore, takes] = bottomBarDestinations(ctx);
  const moreActive = !moreOpen && (
    pathname.startsWith("/community") || pathname.startsWith("/shop") || pathname.startsWith("/saved") ||
    pathname.startsWith("/cart") || pathname.startsWith("/orders") || pathname.startsWith("/settings") ||
    pathname.startsWith("/insights") || pathname.startsWith("/seller") || pathname.startsWith("/help") ||
    pathname.startsWith("/pending-collaborations") || (!!profile && pathname.startsWith(`/studio/${profile.username}`))
  );

  const tab = (dest: typeof home) => (
    <Link
      key={dest.id}
      href={dest.href}
      className="pq-bottom-nav__item"
      aria-current={isDestinationActive(dest, pathname) ? "page" : undefined}
    >
      <NavIcon name={dest.icon} />
      <span>{dest.label}</span>
    </Link>
  );

  return (
    <>
      <nav className="pq-bottom-nav" aria-label="Mobile navigation">
        {tab(home)}
        {tab(explore)}
        {user ? (
          <button
            type="button"
            className="pq-bottom-nav__create"
            aria-label="Create"
            aria-haspopup="dialog"
            aria-expanded={createOpen}
            onClick={() => setCreateOpen(true)}
          >
            <NavIcon name="plus" />
          </button>
        ) : null}
        {tab(takes)}
        {!user && (
          <Link
            href={`/login?redirect=${encodeURIComponent(pathname)}`}
            className="pq-bottom-nav__item"
            aria-current={pathname === "/login" ? "page" : undefined}
          >
            <NavIcon name="studio" />
            <span>Sign in</span>
          </Link>
        )}
        <button
          type="button"
          className="pq-bottom-nav__item"
          aria-haspopup="dialog"
          aria-expanded={moreOpen}
          aria-current={moreActive ? "page" : undefined}
          onClick={() => setMoreOpen(true)}
        >
          <NavIcon name="more" />
          <span>More</span>
        </button>
      </nav>

      <MobileMoreSheet isOpen={moreOpen} onClose={() => setMoreOpen(false)} />

      <Sheet isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Create" subtitle="What would you like to share?">
        <div className="grid gap-2">
          {CREATE_CHOICES.map((choice) => (
            <button
              key={choice.href}
              type="button"
              className="pq-choice"
              onClick={() => {
                setCreateOpen(false);
                router.push(choice.href);
              }}
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="pq-menu__icon" style={{ color: "var(--color-action-ink)" }}><NavIcon name={choice.icon} className="w-5 h-5" /></span>
                <span className="min-w-0">
                  <span className="block font-ui text-[0.9375rem] font-medium text-ink">{choice.label}</span>
                  <span className="block font-body text-xs text-subdued">{choice.description}</span>
                </span>
              </span>
              <NavIcon name="back" className="rotate-180" />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
