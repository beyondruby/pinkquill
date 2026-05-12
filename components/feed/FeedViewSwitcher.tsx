"use client";

import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

export function FeedViewSwitcher({ className = "" }: { className?: string }) {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);

  return (
    <div
      className={`w-full max-w-xl border-y border-border-light bg-surface/70 backdrop-blur-md ${className}`}
      role="radiogroup"
      aria-label="Feed layout"
    >
      <div className="grid grid-cols-4">
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
              className={`relative h-10 px-2 font-ui text-[0.72rem] sm:text-xs font-semibold uppercase transition-colors ${
                isActive
                  ? "text-ink"
                  : "text-muted hover:text-ink"
              }`}
            >
              <span className="relative z-10 truncate">{v.label}</span>
              {isActive && (
                <span
                  className="absolute inset-x-3 bottom-0 h-[2px] rounded-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
