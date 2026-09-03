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

// ─── order / money screens (moved here in Phase 4a from components/orders/orderFormat.ts) ───

/** "Sep 12" — the year only appears when it differs from this year. */
export function shortDate(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Sep 12, 10:52" */
export function shortDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "September 12, 2026" — receipts and statements. */
export function longDate(value: string | null | undefined): string {
  return value ? formatDate(value) : "";
}

/** "Sep 12, 2026, 10:52 AM" */
export function longDateTime(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/** "in 9 days" / "today" / "2 days late" — relative to now, for deadlines. */
export function relativeDays(value: string, lateWord = "late"): { text: string; late: boolean } {
  const ms = new Date(value).getTime() - Date.now();
  const days = Math.round(ms / 86_400_000);
  if (ms < 0 && days === 0) return { text: "today", late: true };
  if (days === 0) return { text: "today", late: false };
  if (days === 1) return { text: "tomorrow", late: false };
  if (days < 0) return { text: `${-days} day${days === -1 ? "" : "s"} ${lateWord}`, late: true };
  return { text: `in ${days} days`, late: false };
}

/** "2d 23h" / "4h 12m" countdown to a deadline; "" when passed. */
export function countdown(value: string): string {
  const diff = new Date(value).getTime() - Date.now();
  if (diff <= 0) return "";
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes}m`;
}
