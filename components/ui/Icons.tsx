// Unified Icon Library for Quill
// All icons use consistent sizing and styling

import React from "react";

interface IconProps {
  size?: "sm" | "md" | "lg";
  filled?: boolean;
  className?: string;
}

const sizeMap = {
  sm: "0.875rem",
  md: "1.05rem",
  lg: "1.25rem",
};

// ============================================================================
// ACTION ICONS - Used for post/take interactions
// ============================================================================

export const HeartIcon = ({ size = "md", filled = false, className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
    />
  </svg>
);

export const CommentIcon = ({ size = "md", className = "" }: IconProps) => {
  const gradId = React.useId();
  return (
    <svg
      style={{ width: sizeMap[size], height: sizeMap[size] }}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
    >
      <defs>
        <linearGradient id={gradId} x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset=".5" stopColor="#EC4899" />
          <stop offset="1" stopColor="#F97316" />
        </linearGradient>
      </defs>
      <path
        d="M8 3.5C4.5 3.5 2 6 2 9c0 1.4.5 2.6 1.4 3.6L2 16l2.8-1.3c.7.5 1.6.8 2.5.8.7 0 1.3-.1 1.9-.3"
        stroke={`url(#${gradId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5c.8 0 1.5-.1 2.2-.4L21 19l-1.5-3c.7-1 1.1-2.2 1.1-3.5 0-3-2.4-5.5-5.6-5.5z"
        stroke={`url(#${gradId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10.5h6M12 13h4"
        stroke={`url(#${gradId})`}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
};

export const RelayIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

export const ShareIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 6l-4-4-4 4"
    />
    <path
      strokeLinecap="round"
      strokeWidth={2}
      d="M12 2v13"
    />
  </svg>
);

export const BookmarkIcon = ({ size = "md", filled = false, className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill={filled ? "currentColor" : "none"}
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
    />
  </svg>
);

export const SendIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
);

// ============================================================================
// MENU/UTILITY ICONS
// ============================================================================

export const EllipsisIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z"
    />
  </svg>
);

export const TrashIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

export const EditIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
    />
  </svg>
);

export const FlagIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
    />
  </svg>
);

export const BlockIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636"
    />
  </svg>
);

export const CloseIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

// ============================================================================
// NAVIGATION ICONS
// ============================================================================

export const ChevronLeftIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 19l-7-7 7-7"
    />
  </svg>
);

export const ChevronRightIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);

export const ArrowRightIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M14 5l7 7m0 0l-7 7m7-7H3"
    />
  </svg>
);

// ============================================================================
// MEDIA ICONS
// ============================================================================

export const PlayIcon = ({ size = "lg", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path d="M8 5v14l11-7z" />
  </svg>
);

export const PauseIcon = ({ size = "lg", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
  </svg>
);

export const VolumeOnIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.536 8.464a5 5 0 010 7.072M18.364 5.636a9 9 0 010 12.728M6 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h2l4-4v14l-4-4z"
    />
  </svg>
);

export const VolumeOffIcon = ({ size = "md", className = "" }: IconProps) => (
  <svg
    style={{ width: sizeMap[size], height: sizeMap[size] }}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    className={className}
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
    />
  </svg>
);

// ============================================================================
// LEGACY ICONS OBJECT - For components using object-style icons
// ============================================================================

export const icons = {
  heart: <HeartIcon />,
  heartFilled: <HeartIcon filled />,
  comment: <CommentIcon />,
  relay: <RelayIcon />,
  share: <ShareIcon />,
  bookmark: <BookmarkIcon />,
  bookmarkFilled: <BookmarkIcon filled />,
  send: <SendIcon />,
  close: <CloseIcon />,
  moreHorizontal: <EllipsisIcon />,
  trash: <TrashIcon />,
  edit: <EditIcon />,
  flag: <FlagIcon />,
  block: <BlockIcon />,
  chevronLeft: <ChevronLeftIcon />,
  chevronRight: <ChevronRightIcon />,
  play: <PlayIcon />,
  pause: <PauseIcon />,
  volumeOn: <VolumeOnIcon />,
  volumeOff: <VolumeOffIcon />,
};
