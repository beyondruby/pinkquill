/**
 * Email preference model (site-wide email, Sep 2026).
 *
 * `profiles.email_preferences` is a flat JSONB object:
 *   { all?: boolean, orders?: boolean, comments?: boolean, ... }
 * An absent key means "use the default". `all: false` is the master switch
 * and mutes every category. In-app mutes (`profiles.notification_preferences`)
 * also silence the matching email category — a person who hid comments in
 * the panel does not want them in their inbox either.
 *
 * Categories mirror `NOTIFICATION_CATEGORIES` and add `messages` (direct
 * message digests, which are not notifications). Order emails default ON for
 * both buyers and sellers; reactions default OFF because one email per
 * admire is noise, everything else defaults ON.
 *
 * Pure module: no Supabase, no React, safe for the route, the UI and tests.
 */
import { NOTIFICATION_CATEGORIES, getNotificationCategoryKey } from "@/lib/utils/notificationCategories";

export type EmailPreferences = Record<string, boolean | undefined> | null | undefined;

export interface EmailCategory {
  key: string;
  label: string;
  /** What the emails are, in the person's own words. */
  description: string;
  defaultOn: boolean;
  /** True when the category is also an in-app notification category. */
  hasInApp: boolean;
  /** Minimum minutes between two emails about the same subject (post, community, conversation). */
  coalesceMinutes: number;
}

export const EMAIL_CATEGORIES: EmailCategory[] = [
  {
    key: "orders",
    label: "Orders & commissions",
    description: "Every step of an order you buy or sell: requests, payments, deliveries, revisions, due dates, refunds and disputes",
    defaultOn: true,
    hasInApp: true,
    coalesceMinutes: 0,
  },
  {
    key: "messages",
    label: "Direct messages",
    description: "A note when you have unread messages waiting for a while",
    defaultOn: true,
    hasInApp: false,
    coalesceMinutes: 60,
  },
  {
    key: "comments",
    label: "Comments & mentions",
    description: "Comments and replies on your work, likes on your comments, and mentions",
    defaultOn: true,
    hasInApp: true,
    coalesceMinutes: 30,
  },
  {
    key: "follows",
    label: "Follows",
    description: "New followers, follow requests and accepted requests",
    defaultOn: true,
    hasInApp: true,
    coalesceMinutes: 0,
  },
  {
    key: "communities",
    label: "Communities",
    description: "Invites, join requests, approvals, role changes and moderation notices",
    defaultOn: true,
    hasInApp: true,
    coalesceMinutes: 0,
  },
  {
    key: "collaborations",
    label: "Collaborations",
    description: "Collaboration invites and answers",
    defaultOn: true,
    hasInApp: true,
    coalesceMinutes: 0,
  },
  {
    key: "post_activity",
    label: "Post activity",
    description: "Reactions, relays and saves on your posts, at most one email per post every few hours",
    defaultOn: false,
    hasInApp: true,
    coalesceMinutes: 360,
  },
];

const BY_KEY = new Map(EMAIL_CATEGORIES.map((c) => [c.key, c]));

export function getEmailCategory(key: string): EmailCategory | undefined {
  return BY_KEY.get(key);
}

/** The email category a notification type belongs to (undefined = never emailed, e.g. ops_alert). */
export function emailCategoryForType(type: string): EmailCategory | undefined {
  const key = getNotificationCategoryKey(type);
  return key ? BY_KEY.get(key) : undefined;
}

/** Master switch: false only when the person explicitly turned all email off. */
export function emailMasterEnabled(prefs: EmailPreferences): boolean {
  return prefs?.all !== false;
}

/** The effective value of one category switch (explicit value or its default). */
export function emailCategoryEnabled(prefs: EmailPreferences, key: string): boolean {
  const category = BY_KEY.get(key);
  if (!category) return false;
  const explicit = prefs?.[key];
  return typeof explicit === "boolean" ? explicit : category.defaultOn;
}

/**
 * Should this person get an email for this category right now?
 * Master off → no. In-app category muted → no. Otherwise the category switch.
 */
export function shouldEmail(
  emailPrefs: EmailPreferences,
  inAppPrefs: Record<string, boolean | undefined> | null | undefined,
  key: string
): boolean {
  if (!emailMasterEnabled(emailPrefs)) return false;
  const category = BY_KEY.get(key);
  if (!category) return false;
  if (category.hasInApp && inAppPrefs?.[key] === false) return false;
  return emailCategoryEnabled(emailPrefs, key);
}

/** Categories that exist for both channels, in the order the settings page shows them. */
export function inAppCategoryFor(key: string) {
  return NOTIFICATION_CATEGORIES.find((c) => c.key === key);
}
