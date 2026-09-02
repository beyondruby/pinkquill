import { describe, expect, it } from "vitest";
import { buildSettlementQuote } from "@/lib/fx";

// $5.00 commission, 3.5% + $0.30 buyer fee → $5.48 total (Phase 1b/1c money model)
const base = {
  listingCurrency: "usd",
  rateAt: "2026-09-02T00:00:00Z",
  amountCents: 500,
  buyerFeeCents: 48,
  platformCents: 25,
  sellerCents: 475,
};

describe("buildSettlementQuote", () => {
  it("does not convert when settlement currency equals the listing currency", () => {
    const q = buildSettlementQuote({ ...base, settlementCurrency: "usd", rate: 1, buffer: 0.015 });
    expect(q.converted).toBe(false);
    expect(q.chargeCurrency).toBe("usd");
    expect(q.rate).toBe(1);
    expect(q.chargeAmountCents).toBe(548);
    expect(q.chargeFeeCents).toBe(48);
    expect(q.sellerCents).toBe(475);
    expect(q.buffer).toBe(0);
  });

  it("charges in CAD at the rate plus buffer and fixes the split at the mid-market rate", () => {
    const q = buildSettlementQuote({ ...base, settlementCurrency: "cad", rate: 1.3925, buffer: 0.015 });
    expect(q.converted).toBe(true);
    expect(q.chargeCurrency).toBe("cad");
    // 548 × 1.3925 × 1.015 = 774.53… → ceil → 775 (matches the live run in 03-progress)
    expect(q.chargeAmountCents).toBe(775);
    expect(q.chargeFeeCents).toBe(Math.ceil(48 * 1.3925 * 1.015));
    expect(q.sellerCents).toBe(Math.round(475 * 1.3925)); // 661
    expect(q.platformCents).toBe(Math.round(25 * 1.3925)); // 35
    expect(q.buyerFeeCents).toBe(Math.round(48 * 1.3925)); // 67
    // the buffer is whatever is left after the fixed split (lands in fx_reserve)
    expect(q.chargeAmountCents - (q.sellerCents + q.platformCents + q.buyerFeeCents)).toBeGreaterThanOrEqual(0);
  });

  it("never charges less than the converted split (buffer is non-negative)", () => {
    for (const rate of [0.5, 0.99, 1, 1.3925, 7.83, 150.2]) {
      for (const amount of [500, 1999, 123456]) {
        const fee = Math.round(amount * 0.035 + 30);
        const q = buildSettlementQuote({
          ...base, settlementCurrency: "cad", rate, buffer: 0.015,
          amountCents: amount, buyerFeeCents: fee, platformCents: Math.round(amount * 0.05), sellerCents: amount - Math.round(amount * 0.05),
        });
        expect(q.chargeAmountCents).toBeGreaterThanOrEqual(q.sellerCents + q.platformCents + q.buyerFeeCents);
        expect(q.chargeFeeCents).toBeLessThanOrEqual(q.chargeAmountCents);
      }
    }
  });

  it("treats a free order as unconverted with no fee", () => {
    const q = buildSettlementQuote({ ...base, settlementCurrency: "cad", rate: 1.3925, buffer: 0.015, amountCents: 0, buyerFeeCents: 0, platformCents: 0, sellerCents: 0 });
    expect(q.converted).toBe(false);
    expect(q.chargeAmountCents).toBe(0);
  });

  it("rejects an invalid rate when conversion is needed", () => {
    expect(() => buildSettlementQuote({ ...base, settlementCurrency: "cad", rate: 0, buffer: 0.015 })).toThrow(/Invalid exchange rate/);
  });
});
