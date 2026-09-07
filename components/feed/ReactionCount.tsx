"use client";

/**
 * A read-only reaction total bound to the shared engagement store, for
 * tiles and rows that show a number but have no picker (profile grid,
 * saved page, stream rows). Seeded from the list row; updates the moment
 * the same post is reacted to anywhere else in the tab.
 */

import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";
import type { ReactionType } from "@/lib/types";

interface ReactionCountProps {
  kind?: EngagementKind;
  id: string;
  /** Total from the list row; undefined = unknown (fetched). */
  total?: number;
  /** Viewer's reaction from the list row; undefined = unknown (fetched). */
  mine?: ReactionType | null;
  format?: (n: number) => string;
}

export default function ReactionCount({ kind = "post", id, total, mine, format }: ReactionCountProps) {
  const reaction = useReaction(kind, id, { seed: { total, mine } });
  const n = reaction.counts.total;
  return <>{format ? format(n) : n}</>;
}
