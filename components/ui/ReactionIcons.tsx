"use client";

import React, { useId } from "react";
import type { ReactionType } from "@/lib/types";

/**
 * Shared reaction icons with gradient fills.
 * Uses useId() to generate unique gradient IDs, preventing conflicts when
 * multiple instances are rendered on the same page.
 */

interface ReactionIconProps {
  type: ReactionType;
  className?: string;
}

/**
 * Individual reaction icon component with unique gradient IDs
 */
export function ReactionIcon({ type, className = "w-full h-full" }: ReactionIconProps) {
  const id = useId();
  const gradientId = `${type}Grad${id}`;

  const icons: Record<ReactionType, React.ReactNode> = {
    admire: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff007f" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        <path
          d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
          fill={`url(#${gradientId})`}
        />
      </svg>
    ),
    snap: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8e44ad" />
            <stop offset="100%" stopColor="#ff007f" />
          </linearGradient>
        </defs>
        <path d="M12 2C12 2 10 4 10 6C10 8 12 8 12 8" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M8.5 8C8.5 7 9 6 10 6C11 6 11.5 7 11.5 8V12" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M11.5 9C11.5 8 12 7 13 7C14 7 14.5 8 14.5 9V12" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M14.5 10C14.5 9 15 8 16 8C17 8 17.5 9 17.5 10V14C17.5 17 15.5 20 12 21C8.5 20 6.5 17 6.5 14V11C6.5 10 7 9 8 9C9 9 9.5 10 9.5 11" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M4 4L6 6M20 4L18 6M12 1V3" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    ovation: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff9f43" />
            <stop offset="100%" stopColor="#ff007f" />
          </linearGradient>
        </defs>
        <circle cx="12" cy="4" r="2.5" fill={`url(#${gradientId})`} />
        <path d="M12 7V14M12 14L8 20M12 14L16 20" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M12 9L7 5M12 9L17 5" stroke={`url(#${gradientId})`} strokeWidth="2" strokeLinecap="round" />
        <path d="M4 3L5 4M20 3L19 4M4 7H5M19 7H20" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    support: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8e44ad" />
            <stop offset="50%" stopColor="#ff007f" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        <path d="M7 13C5.5 13 4 14.5 4 16C4 17.5 5 19 7 20H11C13 20 14.5 18.5 14.5 17" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M17 13C18.5 13 20 14.5 20 16C20 17.5 19 19 17 20H13C11 20 9.5 18.5 9.5 17" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" fill="none" />
        <path d="M12 11l-.725-.66C9.4 8.736 8 7.64 8 6.25 8 5.06 8.92 4 10.25 4c.74 0 1.46.405 1.75 1.045C12.29 4.405 13.01 4 13.75 4 15.08 4 16 5.06 16 6.25c0 1.39-1.4 2.486-3.275 4.09L12 11z" fill={`url(#${gradientId})`} />
      </svg>
    ),
    inspired: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff007f" />
            <stop offset="50%" stopColor="#8e44ad" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        <path d="M12 2C8.69 2 6 4.69 6 8C6 10.22 7.21 12.16 9 13.19V15C9 15.55 9.45 16 10 16H14C14.55 16 15 15.55 15 15V13.19C16.79 12.16 18 10.22 18 8C18 4.69 15.31 2 12 2Z" fill={`url(#${gradientId})`} />
        <path d="M10 18H14M10 20H14M11 16V18M13 16V18" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M3 8H4M20 8H21M5.5 3.5L6.5 4.5M18.5 3.5L17.5 4.5" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    applaud: (
      <svg viewBox="0 0 24 24" fill="none" className={className}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#8e44ad" />
            <stop offset="100%" stopColor="#ff9f43" />
          </linearGradient>
        </defs>
        <path d="M6 12C4.5 12 3 13.5 3 15.5C3 17.5 4.5 19 6 19L10 19C10 19 11 17 10 15L8 13C7.5 12.5 7 12 6 12Z" fill={`url(#${gradientId})`} opacity="0.9" />
        <path d="M18 12C19.5 12 21 13.5 21 15.5C21 17.5 19.5 19 18 19L14 19C14 19 13 17 14 15L16 13C16.5 12.5 17 12 18 12Z" fill={`url(#${gradientId})`} opacity="0.9" />
        <path d="M12 8V6M9 9L7.5 7.5M15 9L16.5 7.5M12 4V3" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M10.5 13L12 11L13.5 13" stroke={`url(#${gradientId})`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  };

  return icons[type];
}

/**
 * Outline heart icon for when no reaction is selected
 */
export function OutlineHeartIcon({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
        stroke="currentColor"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

/**
 * Reaction labels for display
 */
export const REACTION_LABELS: Record<ReactionType, string> = {
  admire: "Admire",
  snap: "Snap",
  ovation: "Ovation",
  support: "Support",
  inspired: "Inspired",
  applaud: "Applaud",
};

/**
 * All reaction types in display order
 */
export const REACTION_TYPES: ReactionType[] = [
  "admire",
  "snap",
  "ovation",
  "support",
  "inspired",
  "applaud",
];

/**
 * Get the display label for a reaction type
 */
export function getReactionLabel(type: ReactionType): string {
  return REACTION_LABELS[type];
}
