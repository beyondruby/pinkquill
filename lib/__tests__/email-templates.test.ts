// @vitest-environment node
import { describe, expect, it } from "vitest";
import { ORDER_EMAIL_TYPES, renderOrderEmail } from "@/lib/email/templates";

const base = {
  recipientName: "Hadi",
  actorName: "Poet",
  orderUrl: "https://www.pinkquill.com/orders/abc",
  settingsUrl: "https://www.pinkquill.com/settings/notifications",
  order: { number: "PQ-20260903-0001", title: "Portrait sketch", amount: 4.75, currency: "usd", dueDate: "2026-09-10T12:00:00Z", listingType: "service" },
};

describe("order email templates", () => {
  it("renders every mapped type for both roles without throwing", () => {
    for (const type of ORDER_EMAIL_TYPES) {
      for (const role of ["buyer", "seller"] as const) {
        const out = renderOrderEmail({ ...base, type, role, content: "detail line" });
        expect(out, type).not.toBeNull();
        expect(out!.subject.length).toBeGreaterThan(3);
        expect(out!.html).toContain("Open");
        expect(out!.text).toContain(base.orderUrl);
      }
    }
  });

  it("returns null for a type with no copy", () => {
    expect(renderOrderEmail({ ...base, type: "admire", role: "buyer", content: null })).toBeNull();
  });

  it("labels money by role and escapes user text", () => {
    const seller = renderOrderEmail({ ...base, type: "order_paid", role: "seller", content: "<b>hi</b>" })!;
    expect(seller.html).toContain("You receive");
    expect(seller.html).toContain("$4.75");
    expect(seller.html).toContain("&lt;b&gt;hi&lt;/b&gt;");
    expect(seller.html).not.toContain("<b>hi</b>");
    const buyer = renderOrderEmail({ ...base, type: "order_delivered", role: "buyer", content: null })!;
    expect(buyer.html).toContain("Total");
    expect(buyer.subject).toBe("Delivery ready: Portrait sketch");
  });

  it("speaks to the right role on due-date reminders", () => {
    expect(renderOrderEmail({ ...base, type: "order_late", role: "seller", content: null })!.html).toContain("Two days past due");
    expect(renderOrderEmail({ ...base, type: "order_late", role: "buyer", content: null })!.html).toContain("Your order is two days late");
  });
});
