"use client";

import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

interface IconProps {
  className?: string;
}

function ClassicIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
    </svg>
  );
}

function CompactIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="20" y2="18" />
    </svg>
  );
}

function GridIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1" />
      <rect x="13" y="4" width="7" height="7" rx="1" />
      <rect x="4" y="13" width="7" height="7" rx="1" />
      <rect x="13" y="13" width="7" height="7" rx="1" />
    </svg>
  );
}

function MagazineIcon({ className = "w-4 h-4" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="9" rx="1" />
      <rect x="13" y="4" width="7" height="5" rx="1" />
      <rect x="4" y="15" width="7" height="5" rx="1" />
      <rect x="13" y="11" width="7" height="9" rx="1" />
    </svg>
  );
}

const ICONS: Record<FeedViewId, (props: IconProps) => React.JSX.Element> = {
  classic: ClassicIcon,
  compact: CompactIcon,
  grid: GridIcon,
  magazine: MagazineIcon,
};

export function FeedViewSwitcher({ className = "" }: { className?: string }) {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);

  return (
    <div
      className={`inline-flex items-center gap-0.5 p-0.5 rounded-full border border-border-light bg-surface ${className}`}
      role="radiogroup"
      aria-label="Feed layout"
    >
      {views.map((v) => {
        const Icon = ICONS[v.id as FeedViewId];
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
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              isActive
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-on-accent"
                : "text-muted hover:text-ink hover:bg-skeleton"
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        );
      })}
    </div>
  );
}
