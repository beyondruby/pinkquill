import type { NotificationType } from "@/lib/types";

/**
 * Groups the app's ~35 notification types into 6 categories a person can
 * reasonably reason about, for the /settings/notifications preferences page.
 * Stored as `profiles.notification_preferences` (JSONB, category key ->
 * `false` means muted; an absent key means "on", the default for everyone).
 */

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  types: NotificationType[];
}

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  {
    key: "post_activity",
    label: "Post activity",
    description: "Reactions, relays, and saves on your posts",
    types: ["admire", "snap", "ovation", "support", "inspired", "applaud", "relay", "save"],
  },
  {
    key: "comments",
    label: "Comments & mentions",
    description: "Comments, replies, comment likes, and mentions",
    types: ["comment", "reply", "comment_like", "mention"],
  },
  {
    key: "follows",
    label: "Follows",
    description: "New followers and follow requests",
    types: ["follow", "follow_request", "follow_request_accepted"],
  },
  {
    key: "communities",
    label: "Communities",
    description: "Invites, join requests, role changes, and moderation notices",
    types: [
      "community_invite",
      "community_join_request",
      "community_join_approved",
      "community_role_change",
      "community_muted",
      "community_banned",
      "community_warning",
    ],
  },
  {
    key: "collaborations",
    label: "Collaborations",
    description: "Collaboration invites and responses",
    types: [
      "collaboration_invite",
      "collaboration_accepted",
      "collaboration_declined",
      "collaboration_removed",
    ],
  },
  {
    key: "orders",
    label: "Orders & commissions",
    description: "Order status, due dates, messages, reviews, and disputes",
    types: [
      "order_pending_acceptance",
      "order_accepted",
      "order_declined",
      "order_placed",
      "order_paid",
      "order_started",
      "order_delivered",
      "order_completed",
      "revision_requested",
      "order_cancelled",
      "review_received",
      "order_message",
      "order_disputed",
      "dispute_resolved",
      "refund_requested",
      "refund_declined",
      "refund_approved",
      "order_refunded",
      "order_cancel_requested",
      "order_expired",
      "order_payment_failed",
      "order_transfer_failed",
      "chargeback_opened",
      "chargeback_closed",
      "order_due_soon",
      "order_due",
      "order_late",
      "extension_requested",
      "extension_accepted",
      "extension_declined",
    ],
  },
];

const TYPE_TO_CATEGORY: Record<string, string> = {};
for (const category of NOTIFICATION_CATEGORIES) {
  for (const type of category.types) {
    TYPE_TO_CATEGORY[type] = category.key;
  }
}

export function getNotificationCategoryKey(type: string): string | undefined {
  return TYPE_TO_CATEGORY[type];
}

/** Category keys explicitly muted (`false`) in a profile's preferences. */
export function getMutedCategories(preferences: Record<string, boolean> | null | undefined): Set<string> {
  if (!preferences) return new Set();
  return new Set(Object.entries(preferences).filter(([, enabled]) => enabled === false).map(([key]) => key));
}

/** Notification types to exclude from fetches/counts given a profile's preferences. */
export function getMutedNotificationTypes(preferences: Record<string, boolean> | null | undefined): NotificationType[] {
  const muted = getMutedCategories(preferences);
  if (muted.size === 0) return [];
  return NOTIFICATION_CATEGORIES.filter((c) => muted.has(c.key)).flatMap((c) => c.types);
}
