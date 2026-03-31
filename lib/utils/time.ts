/**
 * Shared time/date utility functions.
 * Eliminates duplication across Feed, PostCard, PostDetailModal, StudioProfile,
 * NotificationPanel, CollaborationInviteCard, and tag pages.
 */

/**
 * Returns a human-readable relative time string (e.g. "Just now", "5m ago", "3h ago", "2d ago").
 * Falls back to locale date string for dates older than 7 days.
 */
export function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

/**
 * Compact variant without "ago" suffix, used in tighter UI contexts.
 * Returns "just now", "5m", "3h", "2d", or short date like "Jan 5".
 */
export function getTimeAgoCompact(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Formats a date string as a long-form date (e.g. "January 5, 2026").
 */
export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Formats a date string as time only (e.g. "3:45 PM").
 */
export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
