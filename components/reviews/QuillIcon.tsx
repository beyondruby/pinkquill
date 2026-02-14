"use client";

import { useId } from "react";

interface QuillIconProps {
  className?: string;
  gradient?: boolean;
}

export default function QuillIcon({ className, gradient = false }: QuillIconProps) {
  const gradientId = useId();

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      {gradient && (
        <defs>
          <linearGradient id={gradientId} x1="4" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="var(--color-purple-primary)" />
            <stop offset="100%" stopColor="var(--color-pink-vivid)" />
          </linearGradient>
        </defs>
      )}
      <path
        d="M20.24 3.76a5.5 5.5 0 0 0-7.78 0L4 12.22V20h7.78l8.46-8.46a5.5 5.5 0 0 0 0-7.78Z"
        stroke={gradient ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 8 2 22"
        stroke={gradient ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M17.5 15H9"
        stroke={gradient ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 11H5"
        stroke={gradient ? `url(#${gradientId})` : "currentColor"}
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
