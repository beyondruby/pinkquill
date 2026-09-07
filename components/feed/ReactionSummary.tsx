"use client";

/**
 * ReactionSummary — the card line under the actions: the top reaction
 * icons plus "poet and 12 others reacted". Tapping opens the Reactions
 * sheet. Bound to the shared engagement store, so it moves with the
 * picker and with live events.
 */

import { useState } from "react";
import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";
import { getReactionIcon, REACTION_OPTIONS } from "./ReactionPicker";
import ReactionsSheet from "./ReactionsSheet";

interface ReactionSummaryProps {
  kind?: EngagementKind;
  id: string;
  className?: string;
}

export function describeReactors(total: number, mine: boolean, topName: string | null): string {
  const names: string[] = [];
  if (mine) names.push("You");
  if (topName) names.push(topName);
  const rest = total - names.length;
  if (names.length === 0) return `${total} reaction${total === 1 ? "" : "s"}`;
  let who = names.length === 2 && rest > 0 ? `${names[0]}, ${names[1]}` : names.join(" and ");
  if (rest > 0) who += ` and ${rest} other${rest === 1 ? "" : "s"}`;
  return `${who} reacted`;
}

export default function ReactionSummary({ kind = "post", id, className = "" }: ReactionSummaryProps) {
  const r = useReaction(kind, id, { loadSummary: true });
  const [open, setOpen] = useState(false);
  const total = r.counts.total;
  if (!id || total <= 0) return null;

  const top = r.countsLoaded
    ? REACTION_OPTIONS.filter((o) => r.counts[o.type] > 0)
        .sort((a, b) => r.counts[b.type] - r.counts[a.type])
        .slice(0, 3)
    : [];
  const topName = r.topReactor ? r.topReactor.display_name || r.topReactor.username : null;
  const text = describeReactors(total, !!r.mine, r.summaryLoaded ? topName : null);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${text}. See who reacted`}
        className={`flex items-center gap-1.5 font-ui text-[0.8rem] text-muted hover:text-ink transition-colors ${className}`}
      >
        {top.length > 0 && (
          <span className="flex -space-x-1" aria-hidden="true">
            {top.map((o) => (
              <span key={o.type} className="w-4 h-4 rounded-full bg-surface ring-1 ring-surface flex items-center justify-center">
                <span className="w-3.5 h-3.5">{getReactionIcon(o.type)}</span>
              </span>
            ))}
          </span>
        )}
        <span className="truncate">{text}</span>
      </button>
      {open && <ReactionsSheet kind={kind} id={id} isOpen={open} onClose={() => setOpen(false)} counts={r.counts} />}
    </>
  );
}
