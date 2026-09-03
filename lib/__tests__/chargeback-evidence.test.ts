// @vitest-environment node
import { describe, expect, it } from "vitest";
import { draftEvidenceText, isEvidenceFileField, normalizeEvidenceText, type EvidencePack } from "@/lib/admin/chargeback-evidence";

const pack: EvidencePack = {
  order: { order_number: "PQ-1", listing_type: "service", status: "completed", amount: 50, currency: "usd", total_amount: 52.05, created_at: "2026-08-01T10:00:00Z", started_at: "2026-08-01T12:00:00Z", submitted_at: "2026-08-05T09:00:00Z", completed_at: "2026-08-06T09:00:00Z", due_date: "2026-08-08T00:00:00Z", brief: "A portrait of my dog", requirements: {} },
  product: { title: "Pet portrait", description: "Digital painting, one subject." },
  pricing: { variant_name: "Standard", delivery_days: 7, revisions: 1, package_features: ["High-res file", "Commercial use"] },
  buyer: { username: "buyer1", display_name: "Bea", email: "bea@example.com" },
  seller: { username: "artist", display_name: "Ann", email: null } as unknown as EvidencePack["seller"],
  messages: [
    { role: "buyer", at: "2026-08-01T10:05:00Z", text: "Here is the photo" },
    { role: "system", at: "2026-08-01T10:06:00Z", text: "Payment confirmed" },
    { role: "seller", at: "2026-08-01T11:00:00Z", text: "Got it, <starting> now" },
  ],
  deliveries: [{ version: 1, at: "2026-08-05T09:00:00Z", files: 2, status: "accepted" }],
  evidenceItems: [{ role: "seller", at: "2026-08-10T00:00:00Z", text: "The buyer approved the final file.", attachments: [{ path: "orders/x/final.png", name: "final.png" }] }],
};

describe("chargeback evidence draft", () => {
  it("fills Stripe's text fields from the order", () => {
    const d = draftEvidenceText(pack);
    expect(d.product_description).toContain("Pet portrait");
    expect(d.product_description).toContain("Standard · 7-day delivery · 1 revision");
    expect(d.product_description).toContain("52.05 USD");
    expect(d.customer_communication).toContain("Bea: Here is the photo");
    expect(d.customer_communication).toContain("Ann: Got it");
    expect(d.customer_communication).not.toContain("Payment confirmed");
    expect(d.access_activity_log).toContain("Delivery v1 submitted 2026-08-05 09:00 UTC (2 files, accepted)");
    expect(d.uncategorized_text).toContain("approved the delivery");
    expect(d.uncategorized_text).toContain("The buyer approved the final file.");
    expect(d.service_date).toBe("2026-08-05");
    expect(d.customer_name).toBe("Bea");
    expect(d.customer_email_address).toBe("bea@example.com");
  });

  it("normalizes edited text: unknown keys dropped, blanks dropped, long text clipped", () => {
    const n = normalizeEvidenceText({ product_description: "  x  ", bogus: "y", uncategorized_text: "", customer_communication: "a".repeat(20_000) });
    expect(n).toEqual({ product_description: "x", customer_communication: expect.stringContaining("(truncated)") });
    expect(n.customer_communication!.length).toBeLessThanOrEqual(15_000);
  });

  it("knows Stripe's file fields", () => {
    expect(isEvidenceFileField("uncategorized_file")).toBe(true);
    expect(isEvidenceFileField("evidence")).toBe(false);
  });
});
