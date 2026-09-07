"use client";

/**
 * ReactionBarFooter — the bottom row of the open reaction bar: a facepile
 * of up to three reactors and "See all 12 reactions". Tapping opens the
 * Reactions sheet (owned by the picker). Bound to the shared engagement
 * store; the batched summary is only requested while the bar is open and
 * the total is above zero.
 */

import type { RefObject, MouseEvent } from "react";
import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";
import type { ReactionCounts } from "@/lib/types";
import { DEFAULT_AVATAR } from "@/lib/utils/image";
import { ChevronRightIcon } from "@/components/ui/Icons";

interface ReactionBarFooterProps {
  kind: EngagementKind;
  id: string;
  counts: ReactionCounts;
  buttonRef: RefObject<HTMLButtonElement | null>;
  onOpen: (e: MouseEvent) => void;
}

export function describeReactionTotal(total: number, mine: boolean): string {
  if (total <= 0) return "Be the first to react";
  if (mine && total === 1) return "Only you so far";
  return `See all ${total.toLocaleString()} reaction${total === 1 ? "" : "s"}`;
}

export default function ReactionBarFooter({ kind, id, counts, buttonRef, onOpen }: ReactionBarFooterProps) {
  const r = useReaction(kind, id, { loadSummary: true });
  const total = counts.total;

  if (total <= 0) {
    return (
      <p className="reaction-bar-footer px-4 pb-2.5 pt-1 font-ui text-[0.72rem] text-muted text-center select-none">
        {describeReactionTotal(0, false)}
      </p>
    );
  }

  const faces = r.topReactors.slice(0, 3);
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      className="reaction-bar-footer group/footer flex w-full items-center gap-2.5 px-3 py-2 border-t border-border-light bg-subtle/60 hover:bg-subtle transition-colors text-left focus:outline-none focus-visible:bg-subtle"
      aria-label={`${describeReactionTotal(total, !!r.mine)}. Opens the list of everyone who reacted`}
    >
      {faces.length > 0 ? (
        <span className="flex -space-x-2 flex-shrink-0" aria-hidden="true">
          {faces.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={f.username}
              src={f.avatar_url || DEFAULT_AVATAR}
              alt=""
              className="w-6 h-6 rounded-full object-cover ring-2 ring-surface"
              style={{ zIndex: faces.length - i }}
            />
          ))}
        </span>
      ) : (
        <span className="flex -space-x-2 flex-shrink-0" aria-hidden="true">
          <span className="w-6 h-6 rounded-full bg-skeleton ring-2 ring-surface" />
          <span className="w-6 h-6 rounded-full bg-skeleton/70 ring-2 ring-surface" />
        </span>
      )}
      <span className="flex-1 min-w-0 font-ui text-[0.78rem] font-medium text-ink truncate">
        {describeReactionTotal(total, !!r.mine)}
      </span>
      <ChevronRightIcon className="w-4 h-4 text-muted flex-shrink-0 transition-transform group-hover/footer:translate-x-0.5" />
    </button>
  );
}
