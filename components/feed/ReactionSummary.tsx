"use client";

/**
 * ReactionSummary — the Instagram-style line under the action row: a
 * facepile of up to three reactors (people you follow first) and
 * "poet and 12 others reacted" with the names in bold. Tapping opens the
 * Reactions sheet. Bound to the shared engagement store, so it moves with
 * the picker and with live events.
 */

import { useState } from "react";
import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";
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
    parts.push({ text: `${total.toLocaleString()} reaction${total === 1 ? "" : "s"}`, strong: true });
  } else {
    parts.push({ text: names[0], strong: true });
    if (names.length === 2) parts.push({ text: rest > 0 ? ", " : " and ", strong: false }, { text: names[1], strong: true });
    if (rest > 0) parts.push({ text: " and ", strong: false }, { text: `${rest.toLocaleString()} other${rest === 1 ? "" : "s"}`, strong: true });
    parts.push({ text: " reacted", strong: false });
  }
  return { parts, text: parts.map((p) => p.text).join("") };
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100";

export default function ReactionSummary({ kind = "post", id, className = "", dark = false }: ReactionSummaryProps) {
  const r = useReaction(kind, id, { loadSummary: true });
  const [open, setOpen] = useState(false);
  const total = r.counts.total;
  if (!id || total <= 0) return null;

  const faces = r.topReactors.slice(0, 3);
  const first = faces[0];
  const line = describeReactors(total, !!r.mine, first ? first.display_name || first.username : null);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={`${line.text}. See who reacted`}
        className={`reaction-summary group/summary flex items-center gap-2 min-w-0 font-ui text-[0.85rem] leading-tight text-left ${
          dark ? "text-white/85" : "text-ink"
        } ${className}`}
      >
        {faces.length > 0 && (
          <span className="flex -space-x-2 flex-shrink-0" aria-hidden="true">
            {faces.map((f, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={f.username}
                src={f.avatar_url || DEFAULT_AVATAR}
                alt=""
                className={`w-5 h-5 rounded-full object-cover ring-2 ${dark ? "ring-black/60" : "ring-surface"}`}
                style={{ zIndex: faces.length - i }}
              />
            ))}
          </span>
        )}
        <span className="truncate">
          {line.parts.map((part, i) =>
            part.strong ? (
              <span key={i} className="font-semibold">
                {part.text}
              </span>
            ) : (
              <span key={i} className={dark ? "text-white/70" : "text-ink/80"}>
                {part.text}
              </span>
            )
          )}
        </span>
      </button>
      {open && <ReactionsSheet kind={kind} id={id} isOpen={open} onClose={() => setOpen(false)} counts={r.counts} />}
    </>
  );
}
