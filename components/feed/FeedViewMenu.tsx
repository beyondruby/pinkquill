"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

const VIEW_ICONS: Record<FeedViewId, ReactElement> = {
  classic: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="1.5" />
    </svg>
  ),
  compact: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <circle cx="5.5" cy="7" r="1.25" />
      <line x1="10" y1="7" x2="19" y2="7" />
      <circle cx="5.5" cy="12" r="1.25" />
      <line x1="10" y1="12" x2="19" y2="12" />
      <circle cx="5.5" cy="17" r="1.25" />
      <line x1="10" y1="17" x2="19" y2="17" />
    </svg>
  ),
  grid: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="9" rx="1.25" />
      <rect x="13" y="4" width="7" height="6" rx="1.25" />
      <rect x="4" y="15" width="7" height="5" rx="1.25" />
      <rect x="13" y="12" width="7" height="8" rx="1.25" />
    </svg>
  ),
};

// Icon-only feed layout switcher. On desktop it renders as a fixed horizontal
// rail just left of the right sidebar. On mobile we collapse it into a single
// pill button that expands to the three options on tap — keeps the top-right
// of the feed visually clean while still being one tap away.
export function FeedViewMenu() {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (!wrapperRef.current) return;
      if (!wrapperRef.current.contains(e.target as Node)) {
        setMobileOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop: always-expanded rail */}
      <div
        className="fixed top-[calc(var(--pq-topbar)+0.75rem)] right-4 lg:right-[296px] z-20 hidden md:flex flex-row gap-1 p-1.5 rounded-full bg-surface/80 border border-border-light backdrop-blur-md shadow-sm"
        role="radiogroup"
        aria-label="Feed layout"
      >
        {views.map((v) => {
          const isActive = v.id === viewId;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isActive}
              aria-label={`${v.label} view`}
              title={v.label}
              onClick={() => setView(v.id as FeedViewId)}
              className={`w-9 h-9 inline-flex items-center justify-center rounded-full transition-colors ${
                isActive
                  ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-on-accent"
                  : "text-muted hover:text-ink hover:bg-accent/10"
              }`}
            >
              {VIEW_ICONS[v.id as FeedViewId]}
            </button>
          );
        })}
      </div>

      {/* Mobile: collapsed pill that expands on tap */}
      <div
        ref={wrapperRef}
        className="fixed top-[calc(var(--pq-topbar)+0.25rem)] right-2 z-20 md:hidden flex flex-row items-center gap-0.5 p-1 rounded-full bg-surface/80 border border-border-light backdrop-blur-md shadow-sm"
      >
        {mobileOpen ? (
          <div role="radiogroup" aria-label="Feed layout" className="flex flex-row gap-0.5">
            {views.map((v) => {
              const isActive = v.id === viewId;
              return (
                <button
                  key={v.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive}
                  aria-label={`${v.label} view`}
                  title={v.label}
                  onClick={() => {
                    setView(v.id as FeedViewId);
                    setMobileOpen(false);
                  }}
                  className={`w-7 h-7 inline-flex items-center justify-center rounded-full transition-colors ${
                    isActive
                      ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-on-accent"
                      : "text-muted hover:text-ink hover:bg-accent/10"
                  }`}
                >
                  {VIEW_ICONS[v.id as FeedViewId]}
                </button>
              );
            })}
          </div>
        ) : (
          <button
            type="button"
            aria-label="Change feed layout"
            aria-expanded={false}
            onClick={() => setMobileOpen(true)}
            className="w-7 h-7 inline-flex items-center justify-center rounded-full text-muted hover:text-ink hover:bg-accent/10"
          >
            {VIEW_ICONS[viewId]}
          </button>
        )}
      </div>
    </>
  );
}
