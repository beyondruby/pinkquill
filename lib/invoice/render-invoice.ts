/**
 * The tax invoice PDF (Phase 4c follow-up). One page, PinkQuill branding,
 * the same numbers the order page and the receipt show. Pure: takes data,
 * returns bytes — the route gathers the data, the unit test renders a sample.
 */
import { PdfDocument, type Rgb } from "@/lib/pdf/pdf-writer";

export interface InvoiceIssuer {
  name: string;
  lines: string[];
  tax_note: string;
}

export const DEFAULT_ISSUER: InvoiceIssuer = {
  name: "PinkQuill",
  lines: ["Merchant of record", "www.pinkquill.com"],
  tax_note: "No sales tax was charged on this invoice.",
};

export interface InvoiceData {
  invoiceNumber: string;
  orderId: string;
  issuedAt: string;
  paidAt: string | null;
  status: string;
  currency: string;
  buyer: { name: string; username: string | null; email: string | null };
  creator: { name: string; username: string | null };
  issuer: InvoiceIssuer;
  lines: Array<{ description: string; detail?: string | null; quantity: number; unitAmount: number; amount: number }>;
  shipping: number;
  discount: number;
  processingFee: number;
  tax: number;
  total: number;
  charged: { amountCents: number; currency: string; rate: number | null } | null;
  payment: { method: string; reference: string | null; at: string | null };
  refunds: Array<{ kind: string; amount: number; currency: string; at: string; reason: string | null }>;
}

const INK: Rgb = [31, 26, 38];
const MUTED: Rgb = [122, 111, 136];
const PURPLE: Rgb = [142, 68, 173];
const LINE: Rgb = [236, 231, 242];
const BAND: Rgb = [248, 247, 252];

function money(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
  }
}

function longDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function dateTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC" }) + " UTC";
}

export function renderInvoicePdf(d: InvoiceData): Buffer {
  const pdf = new PdfDocument();
  const L = 54, R = pdf.width - 54, W = R - L;
  let y = 64;

  // ── header ──
  pdf.text(L, y, "PinkQuill", { size: 22, bold: true, color: PURPLE });
  pdf.text(R, y - 8, "TAX INVOICE", { size: 8, bold: true, color: MUTED, align: "right" });
  pdf.text(R, y + 8, d.invoiceNumber, { size: 12, bold: true, align: "right" });
  pdf.text(R, y + 22, `Issued ${longDate(d.issuedAt)}`, { size: 9, color: MUTED, align: "right" });
  pdf.text(R, y + 34, `Status ${d.status}`, { size: 9, color: MUTED, align: "right" });
  y += 52;
  pdf.line(L, y, R, y, LINE);
  y += 26;

  // ── parties ──
  const col2 = L + W / 2 + 12;
  pdf.text(L, y, "BILLED TO", { size: 7.5, bold: true, color: MUTED });
  pdf.text(col2, y, "FROM", { size: 7.5, bold: true, color: MUTED });
  y += 14;
  pdf.text(L, y, d.buyer.name, { size: 10.5, bold: true });
  pdf.text(col2, y, d.issuer.name, { size: 10.5, bold: true });
  let yl = y + 13, yr = y + 13;
  if (d.buyer.username) { pdf.text(L, yl, `@${d.buyer.username}`, { size: 9, color: MUTED }); yl += 12; }
  if (d.buyer.email) { pdf.text(L, yl, d.buyer.email, { size: 9, color: MUTED }); yl += 12; }
  for (const line of d.issuer.lines) { pdf.text(col2, yr, line, { size: 9, color: MUTED }); yr += 12; }
  pdf.text(col2, yr, `On behalf of ${d.creator.name}${d.creator.username ? ` (@${d.creator.username})` : ""}`, { size: 9, color: MUTED }); yr += 12;
  y = Math.max(yl, yr) + 18;

  // ── line items ──
  const cQty = L + W * 0.62, cUnit = L + W * 0.79, cAmt = R;
  pdf.rect(L, y - 11, W, 20, BAND);
  pdf.text(L + 10, y + 3, "DESCRIPTION", { size: 7.5, bold: true, color: MUTED });
  pdf.text(cQty, y + 3, "QTY", { size: 7.5, bold: true, color: MUTED, align: "right" });
  pdf.text(cUnit, y + 3, "UNIT", { size: 7.5, bold: true, color: MUTED, align: "right" });
  pdf.text(cAmt - 10, y + 3, "AMOUNT", { size: 7.5, bold: true, color: MUTED, align: "right" });
  y += 26;
  for (const line of d.lines) {
    const after = pdf.paragraph(L + 10, y, line.description, W * 0.55, { size: 10, bold: true });
    pdf.text(cQty, y, String(line.quantity), { size: 10, align: "right" });
    pdf.text(cUnit, y, money(line.unitAmount, d.currency), { size: 10, align: "right" });
    pdf.text(cAmt - 10, y, money(line.amount, d.currency), { size: 10, align: "right" });
    let ny = after;
    if (line.detail) { ny = pdf.paragraph(L + 10, ny - 3, line.detail, W * 0.55, { size: 8.5, color: MUTED }); }
    y = ny + 6;
    pdf.line(L, y - 2, R, y - 2, LINE, 0.5);
    y += 12;
  }

  // ── totals ──
  const labelX = cUnit - 110, valueX = cAmt - 10;
  const row = (label: string, value: string, opts: { bold?: boolean; muted?: boolean; size?: number } = {}) => {
    pdf.text(labelX, y, label, { size: opts.size ?? 9.5, bold: opts.bold, color: opts.muted ? MUTED : INK });
    pdf.text(valueX, y, value, { size: opts.size ?? 9.5, bold: opts.bold, color: opts.muted ? MUTED : INK, align: "right" });
    y += (opts.size ?? 9.5) + 6;
  };
  const subtotal = d.lines.reduce((s, l) => s + l.amount, 0);
  row("Subtotal", money(subtotal, d.currency), { muted: true });
  if (d.shipping > 0) row("Shipping", money(d.shipping, d.currency), { muted: true });
  if (d.discount > 0) row("Discount", `-${money(d.discount, d.currency)}`, { muted: true });
  if (d.processingFee > 0) row("Processing fee", money(d.processingFee, d.currency), { muted: true });
  row("Tax", money(d.tax, d.currency), { muted: true });
  y += 2;
  pdf.line(labelX, y - 6, R, y - 6, LINE);
  y += 6;
  row("Total paid", money(d.total, d.currency), { bold: true, size: 12 });
  if (d.charged && d.charged.currency.toLowerCase() !== d.currency.toLowerCase()) {
    pdf.text(valueX, y, `Charged ${money(d.charged.amountCents / 100, d.charged.currency)}${d.charged.rate ? ` at 1 ${d.currency.toUpperCase()} = ${d.charged.rate.toFixed(4)} ${d.charged.currency.toUpperCase()}` : ""}`, { size: 8.5, color: MUTED, align: "right" });
    y += 14;
  }
  const totalRefunded = d.refunds.reduce((s, r) => s + r.amount, 0);
  if (totalRefunded > 0) {
    row(totalRefunded >= d.total ? "Refunded in full" : "Refunded", `-${money(totalRefunded, d.currency)}`, { muted: true });
  }
  y += 14;

  // ── payment ──
  pdf.text(L, y, "PAYMENT", { size: 7.5, bold: true, color: MUTED });
  y += 14;
  const pay: Array<[string, string]> = [["Method", d.payment.method], ["Date", dateTime(d.payment.at ?? d.paidAt)], ["Reference", d.payment.reference ?? d.invoiceNumber]];
  const colW = W / 3;
  pay.forEach(([k, v], i) => {
    pdf.text(L + colW * i, y, k, { size: 8.5, color: MUTED });
    pdf.text(L + colW * i, y + 13, v, { size: 9.5 });
  });
  y += 36;

  // ── refunds ──
  if (d.refunds.length) {
    pdf.text(L, y, "REFUNDS", { size: 7.5, bold: true, color: MUTED });
    y += 14;
    for (const r of d.refunds) {
      pdf.text(L, y, `${r.kind === "full" ? "Full refund" : "Partial refund"} · ${longDate(r.at)}${r.reason ? ` · ${r.reason}` : ""}`, { size: 9.5 });
      pdf.text(valueX, y, `-${money(r.amount, r.currency)}`, { size: 9.5, align: "right" });
      y += 14;
    }
    y += 8;
  }

  // ── footer ──
  const fy = pdf.height - 64;
  pdf.line(L, fy - 14, R, fy - 14, LINE);
  pdf.paragraph(L, fy, `${d.issuer.name} is the merchant of record for this purchase; the creator is paid their share after the work is approved. ${d.issuer.tax_note}`, W, { size: 8, color: MUTED, lineHeight: 11 });
  pdf.text(L, fy + 26, `Order page: www.pinkquill.com/orders/${d.orderId}`, { size: 8, color: MUTED });
  pdf.text(R, fy + 26, `Generated ${dateTime(new Date().toISOString())}`, { size: 8, color: MUTED, align: "right" });

  return pdf.toBuffer();
}
