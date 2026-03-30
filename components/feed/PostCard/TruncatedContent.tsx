"use client";

import { memo, useMemo } from "react";
import { stripHtml, getExcerpt } from "@/lib/utils/sanitize";

interface TruncatedContentProps {
  content: string;
  maxChars?: number;
  onReadMore: () => void;
  className?: string;
  isPoem?: boolean;
}

function TruncatedContentComponent({
  content,
  maxChars = 250,
  onReadMore,
  className = "",
  isPoem = false,
}: TruncatedContentProps) {
  // Memoize expensive text processing
  const { plainText, truncatedText, isTruncated } = useMemo(() => {
    const plain = stripHtml(content);
    const truncated = getExcerpt(content, maxChars);
    return {
      plainText: plain,
      truncatedText: truncated,
      isTruncated: plain.length > maxChars,
    };
  }, [content, maxChars]);

  return (
    <div className="truncated-content-wrapper">
      <p
        className={`post-content-text ${isPoem ? "text-center italic" : ""} ${className}`}
      >
        {isTruncated ? truncatedText : plainText}
      </p>
      {isTruncated && (
        <button
          className="continue-reading-link"
          onClick={(e) => {
            e.stopPropagation();
            onReadMore();
          }}
        >
          Continue reading
        </button>
      )}
    </div>
  );
}

export const TruncatedContent = memo(TruncatedContentComponent);
export default TruncatedContent;
