"use client";

import React from "react";
import type { CommunityFlair } from "@/lib/types";

interface FlairBadgeProps {
  flair: CommunityFlair;
  size?: "sm" | "md";
  onClick?: () => void;
  removable?: boolean;
  onRemove?: () => void;
}

/**
 * FlairBadge - Displays a flair tag with color and optional emoji
 */
export default function FlairBadge({
  flair,
  size = "sm",
  onClick,
  removable = false,
  onRemove,
}: FlairBadgeProps) {
  const sizeClasses = {
    sm: "text-xs px-2 py-0.5",
    md: "text-sm px-2.5 py-1",
  };

  // Calculate if the background color is light or dark for text contrast
  const isLightColor = (hexColor: string): boolean => {
    const hex = hexColor.replace("#", "");
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Using relative luminance formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5;
  };

  const textColorClass = isLightColor(flair.color)
    ? "text-gray-900"
    : "text-white";

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick();
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove?.();
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full font-ui font-medium ${sizeClasses[size]} ${textColorClass} ${onClick ? "cursor-pointer hover:opacity-80" : ""} transition-opacity`}
      style={{ backgroundColor: flair.color }}
      onClick={handleClick}
    >
      {flair.emoji && <span className="flex-shrink-0">{flair.emoji}</span>}
      <span className="truncate max-w-[100px]">{flair.name}</span>
      {removable && onRemove && (
        <button
          onClick={handleRemove}
          className={`ml-0.5 ${textColorClass} hover:opacity-70 transition-opacity`}
          aria-label="Remove flair"
        >
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}
    </span>
  );
}
