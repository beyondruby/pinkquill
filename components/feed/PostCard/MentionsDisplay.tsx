"use client";

import { memo, useMemo } from "react";
import Link from "next/link";
import type { MentionInfo } from "./types";

interface MentionsDisplayProps {
  mentions: MentionInfo[];
  maxDisplay?: number;
}

function MentionsDisplayComponent({
  mentions,
  maxDisplay = 3,
}: MentionsDisplayProps) {
  const { visibleMentions, remainingCount } = useMemo(() => {
    return {
      visibleMentions: mentions.slice(0, maxDisplay),
      remainingCount: Math.max(0, mentions.length - maxDisplay),
    };
  }, [mentions, maxDisplay]);

  if (mentions.length === 0) return null;

  return (
    <div className="mentions-display" onClick={(e) => e.stopPropagation()}>
      <span className="mentions-label">with</span>
      {visibleMentions.map((mention, index) => (
        <span key={mention.user.id}>
          <Link
            href={`/studio/${mention.user.username}`}
            className="mention-link"
          >
            @{mention.user.username}
          </Link>
          {index < visibleMentions.length - 1 && (
            <span className="mention-separator">, </span>
          )}
        </span>
      ))}
      {remainingCount > 0 && (
        <span className="mentions-more">+{remainingCount} more</span>
      )}
    </div>
  );
}

export const MentionsDisplay = memo(MentionsDisplayComponent);
export default MentionsDisplay;
