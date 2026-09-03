// @vitest-environment node
import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PdfDocument, textWidth, toWinAnsi } from "@/lib/pdf/pdf-writer";
import { DEFAULT_ISSUER, renderInvoicePdf } from "@/lib/invoice/render-invoice";

describe("pdf writer", () => {
  it("produces a well-formed single-page PDF with both fonts and a valid xref", () => {
    const pdf = new PdfDocument();
    pdf.text(54, 60, "Hello (world) \\ test", { bold: true });
    pdf.rect(54, 80, 100, 20, [248, 247, 252]);
    pdf.line(54, 110, 200, 110, [236, 231, 242]);
    const buf = pdf.toBuffer();
    const s = buf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.endsWith("%%EOF\n")).toBe(true);
    expect(s).toContain("/BaseFont /Helvetica-Bold");
    expect(s).toContain("/Count 1");
    expect(s).toContain("Hello \\(world\\) \\\\ test");
    // startxref points at the xref table
    const startxref = Number(s.match(/startxref\n(\d+)\n/)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    // every offset in the table points at "N 0 obj"
    const offsets = [...s.matchAll(/^(\d{10}) 00000 n /gm)].map((m) => Number(m[1]));
    for (const off of offsets) expect(s.slice(off)).toMatch(/^\d+ 0 obj/);
  });

  it("sanitises characters WinAnsi cannot hold and measures Helvetica", () => {
    expect(toWinAnsi("Sketch — 7-day · “yes” → done…")).toBe('Sketch - 7-day · "yes" -> done...');
    expect(textWidth("$5.48", 10)).toBeCloseTo((556 * 4 + 278) / 100, 2);
    expect(textWidth("iii", 10)).toBeLessThan(textWidth("WWW", 10));
  });
});

describe("invoice renderer", () => {
  it("renders a branded invoice and writes a sample for eyeballing", () => {
    const buf = renderInvoicePdf({
      invoiceNumber: "PQ-20260903-1209", orderId: "db8238aa-82d7-4cac-bc1b-3379e9ea15e7", issuedAt: "2026-09-03T12:39:39Z", paidAt: "2026-09-03T12:39:39Z", status: "Approved", currency: "usd",
      buyer: { name: "Hadi Itani", username: "hadi", email: "buyer@example.com" }, creator: { name: "poet", username: "poet" }, issuer: DEFAULT_ISSUER,
      lines: [{ description: "Customer editing & sensitivity reading - Basic package", detail: "7-day delivery · 1 revision", quantity: 1, unitAmount: 5, amount: 5 }],
      shipping: 0, discount: 0, processingFee: 0.48, tax: 0, total: 5.48,
      charged: { amountCents: 755, currency: "cad", rate: 1.3782 },
      payment: { method: "Card via Stripe", reference: "ch_3S2xample", at: "2026-09-03T12:39:39Z" },
      refunds: [],
    });
    const s = buf.toString("latin1");
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("TAX INVOICE");
    expect(s).toContain("PQ-20260903-1209");
    expect(s).toContain("Total paid");
    expect(s).toContain("$5.48");
    expect(s).toContain("CA$7.55");
    expect(buf.length).toBeGreaterThan(2000);
    const dir = process.env.INVOICE_SAMPLE_DIR;
    if (dir) { mkdirSync(dir, { recursive: true }); writeFileSync(`${dir}/invoice-sample.pdf`, buf); }
  });
});
