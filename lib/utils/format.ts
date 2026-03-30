/**
 * Centralized formatting utilities
 * Replaces duplicate getTimeAgo, formatCount, getPostTypeLabel across components
 */

/**
 * Format a timestamp into a relative time string
 * @param dateString - ISO date string or Date
 * @returns Relative time like "Just now", "5m ago", "2h ago", "3d ago", or "Jan 15"
 */
export function getTimeAgo(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Compact version of getTimeAgo without "ago" suffix
 * Used in tight UI spaces like comment timestamps
 */
export function getTimeAgoCompact(dateString: string | Date): string {
  const date = typeof dateString === "string" ? new Date(dateString) : dateString;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/**
 * Format a number for compact display
 * @param num - Number to format
 * @returns Formatted string like "1.2K", "3.5M", or "456"
 */
export function formatCount(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toString();
}

/**
 * Format a number with locale-aware separators for detailed display
 * Falls back to compact format for large numbers
 */
export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return (num / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  }
  if (num >= 1_000) {
    return (num / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
  }
  return num.toLocaleString();
}

/**
 * Post type display labels
 */
export const POST_TYPE_LABELS: Record<string, string> = {
  poem: "Poem",
  journal: "Journal",
  thought: "Thought",
  visual: "Visual",
  audio: "Audio",
  video: "Video",
  essay: "Essay",
  screenplay: "Screenplay",
  story: "Story",
  letter: "Letter",
  quote: "Quote",
};

/**
 * Get display label for a post type
 */
export function getPostTypeLabel(type: string): string {
  return POST_TYPE_LABELS[type] || type;
}

/**
 * Post type action labels (used in "shared a thought", "wrote a poem")
 */
export const POST_TYPE_ACTION_LABELS: Record<string, string> = {
  thought: "shared a thought",
  poem: "wrote a poem",
  journal: "wrote in their journal",
  essay: "wrote an essay",
  story: "shared a story",
  letter: "wrote a letter",
  screenplay: "wrote a screenplay",
  quote: "shared a quote",
  visual: "shared a visual story",
  audio: "recorded a voice note",
  video: "shared a video",
};
