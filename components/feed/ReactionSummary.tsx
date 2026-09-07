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
  /** On a dark post background (detail modal). */
  dark?: boolean;
}

export interface ReactorLine {
  /** Bold parts (names / "N others") and plain parts, in order. */
  parts: Array<{ text: string; strong: boolean }>;
  text: string;
}

export function describeReactors(total: number, mine: boolean, topName: string | null): ReactorLine {
  const names: string[] = [];
  if (mine) names.push("You");
  if (topName) names.push(topName);
  const rest = total - names.length;
  const parts: ReactorLine["parts"] = [];
  if (names.length === 0) {
    parts.push({ text: `${total}`, strong: true }, { text: ` reaction${total === 1 ? "" : "s"}`, strong: false });
  } else {
    parts.push({ text: names[0], strong: true });
    if (names.length === 2) parts.push({ text: rest > 0 ? ", " : " and ", strong: false }, { text: names[1], strong: true });
    if (rest > 0) parts.push({ text: " and ", strong: false }, { text: `${rest} other${rest === 1 ? "" : "s"}`, strong: true });
    parts.push({ text: " reacted", strong: false });
  }
  return { parts, text: parts.map((p) => p.text).join("") };
}

export default function ReactionSummary({ kind = "post", id, className = "", dark = false }: ReactionSummaryProps) {
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
  const line = describeReactors(total, !!r.mine, r.summaryLoaded ? topName : null);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${line.text}. See who reacted`}
        className={`group/summary flex items-center gap-2 min-w-0 font-ui text-[0.8rem] leading-none text-left transition-colors ${
          dark ? "text-white/75 hover:text-white" : "text-muted hover:text-ink"
        } ${className}`}
      >
        {top.length > 0 && (
          <span className="flex -space-x-1.5 flex-shrink-0" aria-hidden="true">
            {top.map((o, i) => (
              <span
                key={o.type}
                className={`w-[18px] h-[18px] rounded-full flex items-center justify-center ring-2 ${
                  dark ? "bg-black/60 ring-black/40" : "bg-surface ring-surface"
                }`}
                style={{ zIndex: top.length - i }}
              >
                <span className="w-[13px] h-[13px]">{getReactionIcon(o.type)}</span>
              </span>
            ))}
          </span>
        )}
        <span className="truncate">
          {line.parts.map((part, i) =>
            part.strong ? (
              <span key={i} className={`font-medium ${dark ? "text-white" : "text-ink"} group-hover/summary:underline`}>
                {part.text}
              </span>
            ) : (
              <span key={i}>{part.text}</span>
            )
          )}
        </span>
      </button>
      {open && <ReactionsSheet kind={kind} id={id} isOpen={open} onClose={() => setOpen(false)} counts={r.counts} />}
    </>
  );
}
