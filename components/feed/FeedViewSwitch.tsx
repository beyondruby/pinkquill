"use client";

import { useRef, type KeyboardEvent, type ReactElement } from "react";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { FEED_VIEWS, type FeedViewId } from "@/lib/feed-view/registry";

const VIEW_ICONS: Record<FeedViewId, ReactElement> = {
  classic: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="16" height="6.5" rx="1.5" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="1.5" />
    </svg>
  ),
  compact: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />
    </svg>
  ),
  grid: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="4" width="7" height="9" rx="1.25" />
      <rect x="13" y="4" width="7" height="6" rx="1.25" />
      <rect x="4" y="15" width="7" height="5" rx="1.25" />
      <rect x="13" y="12" width="7" height="8" rx="1.25" />
    </svg>
  ),
};

/**
 * The three feed layouts as a labelled segmented control that lives in the
 * page toolbar (it used to float over the feed as an icon-only pill). Arrow
 * keys move between options; the choice persists through FeedViewProvider.
 */
export function FeedViewSwitch() {
  const { viewId, setView } = useFeedView();
  const views = Object.values(FEED_VIEWS);
  const groupRef = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const ids = views.map((v) => v.id as FeedViewId);
    const index = ids.indexOf(viewId);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % ids.length;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + ids.length) % ids.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = ids.length - 1;
    if (next === null) return;
    event.preventDefault();
    setView(ids[next]);
    groupRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']")[next]?.focus();
  };

  return (
    <div ref={groupRef} role="radiogroup" aria-label="Feed layout" className="pq-view-switch" onKeyDown={onKeyDown}>
      {views.map((v) => {
        const active = v.id === viewId;
        return (
          <button
            key={v.id}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            title={v.description}
            onClick={() => setView(v.id as FeedViewId)}
            className="pq-view-switch__option"
          >
            {VIEW_ICONS[v.id as FeedViewId]}
            <span className="pq-view-switch__label">{v.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default FeedViewSwitch;
