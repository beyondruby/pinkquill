"use client";

import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

interface IconProps {
  className?: string;
}

function ClassicIcon({ className = "w-[18px] h-[18px]" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="16" height="6" rx="1.5" />
      <rect x="4" y="14" width="16" height="6" rx="1.5" />
    </svg>
  );
}

function CompactIcon({ className = "w-[18px] h-[18px]" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
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

function GridIcon({ className = "w-[18px] h-[18px]" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="7" rx="1.25" />
      <rect x="13" y="4" width="7" height="7" rx="1.25" />
      <rect x="4" y="13" width="7" height="7" rx="1.25" />
      <rect x="13" y="13" width="7" height="7" rx="1.25" />
    </svg>
  );
}

function MagazineIcon({ className = "w-[18px] h-[18px]" }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="7" height="9" rx="1.25" />
      <rect x="13" y="4" width="7" height="5" rx="1.25" />
      <rect x="4" y="15" width="7" height="5" rx="1.25" />
      <rect x="13" y="11" width="7" height="9" rx="1.25" />
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
      className={`inline-flex items-center gap-1 p-1 rounded-full border border-border-light bg-surface/80 backdrop-blur shadow-[0_4px_14px_rgba(15,15,15,0.04)] ${className}`}
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
            className={`relative inline-flex items-center gap-1.5 h-8 px-3 rounded-full font-ui text-xs font-medium transition-all ${
              isActive
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-on-accent shadow-[0_6px_16px_rgba(168,85,247,0.35)]"
                : "text-muted hover:text-ink hover:bg-skeleton/60"
            }`}
          >
            <Icon />
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}
