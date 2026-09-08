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

// Icon-only feed layout switcher. On desktop it is a rail: at md it sits at
// the top of the feed column (there is no room beside the 580px column, F-19),
// at lg it is fixed just left of the right sidebar. On mobile the same control
// lives in the mobile header's action row (`variant="header"`), so it no
// longer floats over the first card. Every button is a 40px target (F-30).
interface FeedViewMenuProps {
  /** Server-known view for the first paint, before the provider has read its cookie (F-23). */
  viewId?: FeedViewId;
  variant?: "rail" | "header";
}

export function FeedViewMenu({ viewId: viewOverride, variant = "rail" }: FeedViewMenuProps) {
  const { viewId: providerViewId, setView, isReady } = useFeedView();
  const viewId = !isReady && viewOverride ? viewOverride : providerViewId;
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

  if (variant === "header") {
    return (
      <div ref={wrapperRef} className="md:hidden flex items-center">
        {mobileOpen ? (
          <div role="radiogroup" aria-label="Feed layout" className="flex flex-row items-center gap-0.5 p-0.5 rounded-full bg-surface/80 border border-border-light">
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
                  className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
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
            className="w-10 h-10 inline-flex items-center justify-center rounded-full text-muted hover:text-accent hover:bg-purple-50 transition-colors"
          >
            {VIEW_ICONS[viewId]}
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="hidden md:flex sticky top-4 z-20 ml-auto w-max mb-4 lg:fixed lg:top-8 lg:right-[296px] lg:ml-0 lg:mb-0 flex-row gap-1 p-1.5 rounded-full bg-surface/80 border border-border-light backdrop-blur-md shadow-sm"
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
            className={`w-10 h-10 inline-flex items-center justify-center rounded-full transition-colors ${
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
  );
}
