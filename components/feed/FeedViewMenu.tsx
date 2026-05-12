"use client";

import { useMemo } from "react";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

// Compact dropdown menu — sits at the right edge of the feed, separate from
// the content. Trigger shows the current view name; the menu lists the rest.
export function FeedViewMenu() {
  const { viewId, setView } = useFeedView();
  const current = FEED_VIEWS[viewId];

  const items: ActionMenuItem[] = useMemo(
    () =>
      Object.values(FEED_VIEWS).map((v) => ({
        label: v.label,
        description: v.description,
        onSelect: () => setView(v.id as FeedViewId),
        tone: v.id === viewId ? ("accent" as const) : ("default" as const),
      })),
    [viewId, setView]
  );

  return (
    <ActionMenu
      items={items}
      label="Feed layout"
      description="Choose how the home feed is arranged."
      widthClassName="w-64"
      align="end"
      portal
      buttonAriaLabel="Change feed layout"
      trigger={
        <span className="inline-flex items-center gap-2 rounded-full border border-border-light bg-surface/80 px-3.5 py-1.5 text-xs font-ui font-medium text-ink backdrop-blur-md transition-colors hover:border-accent/40">
          <span className="text-muted uppercase tracking-[0.2em] text-[0.6rem]">
            View
          </span>
          <span className="font-semibold">{current.label}</span>
          <svg
            className="w-3 h-3 text-muted"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 4.5 L6 7.5 L9 4.5" />
          </svg>
        </span>
      }
    />
  );
}
