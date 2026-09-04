// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EMAIL_TYPES, ORDER_EMAIL_TYPES, renderDmDigestEmail, renderNotificationEmail, type NotificationEmailInput } from "@/lib/email/templates";
import { NOTIFICATION_CATEGORIES } from "@/lib/utils/notificationCategories";
import { buildAuthTemplates } from "@/lib/email/auth-templates";

const urls = {
  base: "https://www.pinkquill.com",
  settings: "https://www.pinkquill.com/settings/notifications",
  unsubscribe: "https://www.pinkquill.com/api/email/unsubscribe?u=x&c=y&t=z",
};

function input(type: string, role: "buyer" | "seller" = "buyer", overrides: Partial<NotificationEmailInput> = {}): NotificationEmailInput {
  return {
    type,
    recipient: { name: "Hadi", email: "hadi@example.com" },
    actor: { name: "Poet", username: "poet", avatarUrl: null },
    content: "detail line",
    post: { id: "post-1", title: "Morning", type: "poem", excerpt: "There is a hush before the kettle sings" },
    comment: { id: "comment-1", content: "Lovely turn" },
    community: { name: "Night Writers", slug: "night-writers" },
    order: { id: "order-1", role, number: "PQ-20260903-0001", title: "Portrait sketch", amount: 4.75, currency: "usd", dueDate: "2026-09-10T12:00:00Z", listingType: "service" },
    urls,
    ...overrides,
  };
}

describe("notification email templates", () => {
  it("has copy for every in-app notification type", () => {
    const allTypes = NOTIFICATION_CATEGORIES.flatMap((c) => c.types);
    for (const type of allTypes) expect(EMAIL_TYPES.has(type), type).toBe(true);
    expect(ORDER_EMAIL_TYPES.has("order_paid")).toBe(true);
    expect(ORDER_EMAIL_TYPES.has("comment")).toBe(false);
  });

  it("renders every type for both roles without throwing", () => {
    for (const type of EMAIL_TYPES) {
      for (const role of ["buyer", "seller"] as const) {
        const out = renderNotificationEmail(input(type, role));
        expect(out, type).not.toBeNull();
        expect(out!.subject.length).toBeGreaterThan(3);
        expect(out!.html).toContain("PinkQuill");
        expect(out!.html).toContain("/api/email/unsubscribe?u=x&amp;c=y&amp;t=z");
        expect(out!.text).toContain("Email settings");
      }
    }
  });

  it("returns null for a type with no copy", () => {
    expect(renderNotificationEmail(input("ops_alert"))).toBeNull();
  });

  it("labels money by role and escapes user text", () => {
    const seller = renderNotificationEmail(input("order_paid", "seller", { content: "<b>hi</b>" }))!;
    expect(seller.html).toContain("You receive");
    expect(seller.html).toContain("$4.75");
    expect(seller.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(seller.html).not.toContain("<b>hi</b>");
    const buyer = renderNotificationEmail(input("order_delivered", "buyer"))!;
    expect(buyer.html).toContain("Total");
    expect(buyer.subject).toBe("Delivery ready: Portrait sketch");
    expect(buyer.html).toContain("/orders/order-1");
  });

  it("speaks to the right role on due-date reminders", () => {
    expect(renderNotificationEmail(input("order_late", "seller"))!.html).toContain("Two days past due");
    expect(renderNotificationEmail(input("order_late", "buyer"))!.html).toContain("Your order is two days late");
  });

  it("quotes the comment and deep-links to it", () => {
    const out = renderNotificationEmail(input("comment", "buyer", { order: null, content: "Your line breaks <do> work" }))!;
    expect(out.subject).toBe("Poet commented on your poem “Morning”");
    expect(out.html).toContain("Your line breaks &lt;do&gt; work");
    expect(out.html).toContain("/post/post-1?comment=comment-1");
    expect(out.text).toContain("> Your line breaks <do> work");
  });

  it("links follows to the studio and community requests to member settings", () => {
    expect(renderNotificationEmail(input("follow", "buyer", { order: null, post: null }))!.html).toContain("/studio/poet");
    expect(renderNotificationEmail(input("community_join_request", "buyer", { order: null }))!.html).toContain("/community/night-writers/settings/members");
  });

  it("falls back gracefully when the actor is missing", () => {
    const out = renderNotificationEmail(input("admire", "buyer", { actor: null, order: null }))!;
    expect(out.subject).toContain("Someone admired");
  });
});

describe("direct-message digest", () => {
  it("counts messages and previews the latest one", () => {
    const out = renderDmDigestEmail({
      recipient: { name: "Hadi", email: "hadi@example.com" },
      sender: { name: "Poet", username: "poet", avatarUrl: null },
      messages: [{ content: "hey", type: "text" }, { content: null, type: "voice" }],
      conversationUrl: "https://www.pinkquill.com/messages?conversation=c1",
      urls: { settings: urls.settings, unsubscribe: urls.unsubscribe },
    });
    expect(out.subject).toBe("Poet sent you 2 messages");
    expect(out.html).toContain("Sent a voice message");
    expect(out.html).toContain("/messages?conversation=c1");
  });
});

describe("auth templates", () => {
  it("keep the Supabase placeholders intact", () => {
    const templates = buildAuthTemplates();
    const byKey = Object.fromEntries(templates.map((t) => [t.key, t]));
    expect(byKey.confirmation.rendered.html).toContain("{{ .Token }}");
    expect(byKey.magic_link.rendered.html).toContain('href="{{ .ConfirmationURL }}"');
    expect(byKey.recovery.rendered.html).toContain('href="{{ .ConfirmationURL }}"');
    expect(byKey.email_change.rendered.html).toContain("{{ .NewEmail }}");
    expect(byKey.reauthentication.rendered.html).toContain("{{ .Token }}");
    for (const t of templates) expect(t.rendered.html).not.toContain("unsubscribe");
  });
});
