// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase", () => ({ supabase: { from: vi.fn(), rpc: vi.fn(), auth: { getUser: vi.fn() }, storage: { from: vi.fn() } } }));
vi.mock("../useProducts", () => ({ useSellerProducts: vi.fn() }));

import { listingPayload } from "../useCommissions";
import type { CommissionWizardState } from "@/lib/types/store";

const base: CommissionWizardState = {
  category: "illustration", subcategory: "concept_art", title: "  Portrait  ", headline: " Fast turnaround ", description: "Ink portraits ",
  mediaPreviews: [], packages: [
    { id: "p1", tier: "basic", name: " Sketch ", description: "Line art", price: 20, deliveryDays: 0, revisions: -1, features: ["Line art ", " "] },
    { id: "p2", tier: "standard", name: "", description: "", price: null, deliveryDays: 7, revisions: 2, features: [] },
  ],
  requirements: [], faqs: [{ question: "Q ", answer: " A" }, { question: "", answer: "x" }], keywords: ["Portrait", "ink"], includes: [" File ", ""], excludes: [],
  intakeFields: [{ id: "f1", key: "k", label: "Describe the subject", help_text: "", field_type: "long_text", options: [], required: true }],
  availability: "open", opensAt: "", slotsTotal: null, leadTimeDays: 2, turnaroundStarts: "payment", terms: "", acceptsCustomQuotes: false,
} as unknown as CommissionWizardState;

describe("listingPayload (what save_commission_listing receives)", () => {
  it("trims, normalizes numbers and keeps the package list intact for the database to judge", () => {
    const p = listingPayload(base, [{ url: "https://x/a.png", media_type: "image", is_primary: true }], "draft");
    expect(p.title).toBe("Portrait");
    expect(p.headline).toBe("Fast turnaround");
    expect(p.status).toBe("draft");
    expect(p.settings).toMatchObject({ availability: "open", opens_at: null, slots_total: null, lead_time_days: 2, turnaround_starts: "payment", accepts_custom_quotes: false });
    expect(p.packages[0]).toMatchObject({ tier: "basic", name: "Sketch", price: 20, delivery_days: 1, revisions: 0, features: ["Line art"] });
    expect(p.packages[1]).toMatchObject({ name: "", price: null });
    expect(p.faqs).toEqual([{ question: "Q", answer: "A" }]);
    expect(p.includes).toEqual(["File"]);
    expect(p.intake_fields[0]).toMatchObject({ id: "f1", label: "Describe the subject", field_type: "long_text", required: true });
    expect(p.media).toEqual([{ url: "https://x/a.png", media_type: "image", is_primary: true }]);
  });

  it("omits media and status when not given, so an update keeps what it has", () => {
    const p = listingPayload(base, null);
    expect("media" in p).toBe(false);
    expect("status" in p).toBe(false);
  });

  it("refuses a scheduled listing without an opening date", () => {
    expect(() => listingPayload({ ...base, availability: "scheduled", opensAt: "" }, null)).toThrow(/date this commission opens/);
    const p = listingPayload({ ...base, availability: "scheduled", opensAt: "2026-10-01" }, null);
    expect(p.settings.opens_at).toMatch(/^2026-(09-30|10-01)T/);
  });
});
