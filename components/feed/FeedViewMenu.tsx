"use client";

import type { ReactElement } from "react";
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
      <line x1="5" y1="6" x2="19" y2="6" />
      <line x1="5" y1="10" x2="19" y2="10" />
      <line x1="5" y1="14" x2="19" y2="14" />
      <line x1="5" y1="18" x2="19" y2="18" />
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
      <rect x="4" y="4" width="7" height="7" rx="1.25" />
      <rect x="13" y="4" width="7" height="7" rx="1.25" />
      <rect x="4" y="13" width="7" height="7" rx="1.25" />
      <rect x="13" y="13" width="7" height="7" rx="1.25" />
    </svg>
  ),
  magazine: (
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
      <rect x="4" y="4" width="9" height="10" rx="1.25" />
      <rect x="15" y="4" width="5" height="6" rx="1.25" />
      <rect x="15" y="12" width="5" height="8" rx="1.25" />
      <rect x="4" y="16" width="9" height="4" rx="1.25" />
    </svg>
  ),
};

// Icon-only feed layout switcher. Renders as a fixed horizontal rail outside
// the main feed column, anchored to the right edge of the main area (just
// left of the right sidebar on desktop). Hidden on mobile.
export function FeedViewMenu() {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);

  return (
    <div
      className="fixed top-6 md:top-8 right-4 lg:right-[296px] z-20 hidden md:flex flex-row gap-1 p-1.5 rounded-full bg-surface/80 border border-border-light backdrop-blur-md shadow-sm"
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
  );
}
