"use client";

/**
 * "View all 12 comments" under a feed card (Instagram). Bound to the shared
 * engagement store, so it follows adds/deletes anywhere in the tab.
 */

import { useReaction } from "@/lib/engagement/reactions";
import type { EngagementKind } from "@/lib/engagement/store";

interface ViewCommentsLinkProps {
  kind?: EngagementKind;
  id: string;
  /** Count from the list row; undefined = unknown (fetched). */
  total?: number;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

export default function ViewCommentsLink({ kind = "post", id, total, onClick, disabled = false, className = "" }: ViewCommentsLinkProps) {
  const r = useReaction(kind, id, { seed: { comments: total }, loadComments: true });
  const n = r.comments;
  if (n <= 0) return null;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={disabled}
      className={`block font-ui text-[0.85rem] text-muted hover:text-ink transition-colors disabled:cursor-default ${className}`}
    >
      {n === 1 ? "View 1 comment" : `View all ${n.toLocaleString()} comments`}
    </button>
  );
}
