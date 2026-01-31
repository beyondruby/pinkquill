"use client";

import { memo, useMemo } from "react";
import Link from "next/link";

interface HashtagsDisplayProps {
  hashtags: string[];
  maxDisplay?: number;
}

function HashtagsDisplayComponent({
  hashtags,
  maxDisplay = 4,
}: HashtagsDisplayProps) {
  const { visibleTags, remainingCount } = useMemo(() => {
    return {
      visibleTags: hashtags.slice(0, maxDisplay),
      remainingCount: Math.max(0, hashtags.length - maxDisplay),
    };
  }, [hashtags, maxDisplay]);

  if (hashtags.length === 0) return null;

  return (
    <div className="hashtags-display" onClick={(e) => e.stopPropagation()}>
      {visibleTags.map((tag) => (
        <Link
          key={tag}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="hashtag-link"
        >
          #{tag}
        </Link>
      ))}
      {remainingCount > 0 && (
        <span className="hashtags-more">+{remainingCount}</span>
      )}
    </div>
  );
}

export const HashtagsDisplay = memo(HashtagsDisplayComponent);
export default HashtagsDisplay;
