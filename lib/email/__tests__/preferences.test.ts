// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { EMAIL_CATEGORIES, emailCategoryEnabled, emailCategoryForType, emailMasterEnabled, shouldEmail } from "@/lib/email/preferences";
import { NOTIFICATION_CATEGORIES } from "@/lib/utils/notificationCategories";
import { signUnsubscribe, unsubscribeUrl, verifyUnsubscribe } from "@/lib/email/unsubscribe";

describe("email preferences", () => {
  it("covers every in-app category plus messages", () => {
    const keys = new Set(EMAIL_CATEGORIES.map((c) => c.key));
    for (const c of NOTIFICATION_CATEGORIES) expect(keys.has(c.key), c.key).toBe(true);
    expect(keys.has("messages")).toBe(true);
  });

  it("defaults orders on for everyone and reactions off", () => {
    expect(emailCategoryEnabled({}, "orders")).toBe(true);
    expect(emailCategoryEnabled(null, "orders")).toBe(true);
    expect(emailCategoryEnabled(undefined, "comments")).toBe(true);
    expect(emailCategoryEnabled({}, "post_activity")).toBe(false);
    expect(emailCategoryEnabled({ post_activity: true }, "post_activity")).toBe(true);
    expect(emailCategoryEnabled({ orders: false }, "orders")).toBe(false);
  });

  it("honours the master switch and in-app mutes", () => {
    expect(emailMasterEnabled({})).toBe(true);
    expect(emailMasterEnabled({ all: false })).toBe(false);
    expect(shouldEmail({ all: false }, {}, "orders")).toBe(false);
    expect(shouldEmail({}, { orders: false }, "orders")).toBe(false);
    expect(shouldEmail({}, {}, "orders")).toBe(true);
    expect(shouldEmail({}, { messages: false }, "messages")).toBe(true); // messages has no in-app category
    expect(shouldEmail({}, {}, "unknown")).toBe(false);
  });

  it("maps notification types to email categories", () => {
    expect(emailCategoryForType("order_paid")?.key).toBe("orders");
    expect(emailCategoryForType("comment")?.key).toBe("comments");
    expect(emailCategoryForType("admire")?.key).toBe("post_activity");
    expect(emailCategoryForType("ops_alert")).toBeUndefined();
  });
});

describe("unsubscribe tokens", () => {
  const original = process.env.EMAIL_UNSUBSCRIBE_SECRET;
  beforeEach(() => { process.env.EMAIL_UNSUBSCRIBE_SECRET = "test-secret"; });
  afterEach(() => { if (original === undefined) delete process.env.EMAIL_UNSUBSCRIBE_SECRET; else process.env.EMAIL_UNSUBSCRIBE_SECRET = original; });

  it("signs and verifies per person and category", () => {
    const token = signUnsubscribe("user-1", "orders")!;
    expect(verifyUnsubscribe("user-1", "orders", token)).toBe(true);
    expect(verifyUnsubscribe("user-2", "orders", token)).toBe(false);
    expect(verifyUnsubscribe("user-1", "comments", token)).toBe(false);
    expect(verifyUnsubscribe("user-1", "orders", token.slice(0, -1))).toBe(false);
    expect(verifyUnsubscribe("user-1", "orders", "")).toBe(false);
  });

  it("builds a URL that verifies", () => {
    const url = new URL(unsubscribeUrl("https://www.pinkquill.com", "user-1", "comments")!);
    expect(url.pathname).toBe("/api/email/unsubscribe");
    expect(verifyUnsubscribe(url.searchParams.get("u")!, url.searchParams.get("c")!, url.searchParams.get("t")!)).toBe(true);
  });
});
