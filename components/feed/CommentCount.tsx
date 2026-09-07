"use client";

/**
 * A read-only comment total bound to the shared engagement store (all rows,
 * top-level + replies). Seeded from the list row; moves the moment a
 * comment is added or deleted anywhere else in the tab.
 */

import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";

interface CommentCountProps {
  kind?: EngagementKind;
  id: string;
  /** Count from the list row; undefined = unknown (fetched). */
  total?: number;
  format?: (n: number) => string;
}

export default function CommentCount({ kind = "post", id, total, format }: CommentCountProps) {
  const reaction = useReaction(kind, id, { seed: { comments: total }, loadComments: true });
  const n = reaction.comments;
  return <>{format ? format(n) : n}</>;
}
