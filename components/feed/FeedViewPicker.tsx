"use client";

import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

interface PreviewProps {
  isActive: boolean;
}

function ClassicPreview({ isActive }: PreviewProps) {
  const bar = isActive ? "bg-on-accent/85" : "bg-muted/40";
  const card = isActive ? "bg-on-accent/15 border-on-accent/30" : "bg-skeleton border-border-light";
  return (
    <div className="flex flex-col gap-1.5 w-full h-full p-2">
      <div className={`flex-1 rounded-md border ${card} p-1.5 flex flex-col gap-1`}>
        <div className={`h-1 w-3/5 rounded ${bar}`} />
        <div className={`h-1 w-4/5 rounded ${bar}`} />
        <div className={`h-1 w-2/5 rounded ${bar}`} />
      </div>
      <div className={`flex-1 rounded-md border ${card} p-1.5 flex flex-col gap-1`}>
        <div className={`h-1 w-3/5 rounded ${bar}`} />
        <div className={`h-1 w-4/5 rounded ${bar}`} />
      </div>
    </div>
  );
}

function StreamPreview({ isActive }: PreviewProps) {
  const bar = isActive ? "bg-on-accent/85" : "bg-muted/40";
  const soft = isActive ? "bg-on-accent/40" : "bg-muted/20";
  const dot = isActive ? "bg-on-accent/60" : "bg-muted/35";
  return (
    <div className="flex flex-col gap-1.5 w-full h-full p-2 justify-center">
      <div className={`h-0.5 w-1/4 rounded ${soft}`} />
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className={`w-3 h-3 rounded-full ${dot} flex-shrink-0`} />
          <div className="flex-1 flex flex-col gap-0.5">
            <div className={`h-1 rounded ${bar}`} style={{ width: `${55 + (i % 3) * 12}%` }} />
            <div className={`h-0.5 rounded ${soft}`} style={{ width: `${35 + (i % 2) * 10}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function GalleryPreview({ isActive }: PreviewProps) {
  const tile = isActive ? "bg-on-accent/25 border-on-accent/40" : "bg-skeleton border-border-light";
  const heights = [
    ["45%", "30%"],
    ["25%", "50%"],
    ["38%", "36%"],
  ];
  return (
    <div className="grid grid-cols-3 gap-1 w-full h-full p-2">
      {heights.map((col, i) => (
        <div key={i} className="flex flex-col gap-1 h-full">
          {col.map((h, j) => (
            <div key={j} className={`rounded border ${tile}`} style={{ height: h }} />
          ))}
        </div>
      ))}
    </div>
  );
}

const PREVIEWS: Record<FeedViewId, (props: PreviewProps) => React.JSX.Element> =
  {
    classic: ClassicPreview,
    compact: StreamPreview,
    grid: GalleryPreview,
  };

export function FeedViewPicker() {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {views.map((v) => {
        const Preview = PREVIEWS[v.id as FeedViewId];
        const isActive = v.id === viewId;
        return (
          <button
            key={v.id}
            type="button"
            onClick={() => setView(v.id as FeedViewId)}
            aria-pressed={isActive}
            className={`text-left rounded-2xl border p-3 transition-all ${
              isActive
                ? "border-accent bg-gradient-to-br from-purple-primary to-pink-vivid text-on-accent shadow-md"
                : "border-border-light bg-surface hover:border-accent/40"
            }`}
          >
            <div
              className={`aspect-[5/3] w-full rounded-lg overflow-hidden mb-3 ${
                isActive
                  ? "bg-on-accent/10 border border-on-accent/20"
                  : "bg-background border border-border-light"
              }`}
            >
              <Preview isActive={isActive} />
            </div>
            <div
              className={`font-ui text-sm font-semibold mb-0.5 ${
                isActive ? "text-on-accent" : "text-ink"
              }`}
            >
              {v.label}
            </div>
            <div
              className={`font-body text-xs leading-snug ${
                isActive ? "text-on-accent/85" : "text-muted"
              }`}
            >
              {v.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}
