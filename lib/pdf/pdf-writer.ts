/**
 * A very small PDF writer (Phase 4c follow-up): Letter pages, the two
 * standard Helvetica faces (no embedding, so nothing to bundle), filled
 * rectangles, lines and left/right/centre-aligned text. Enough for an
 * invoice; deliberately nothing more. Coordinates are top-down in points.
 */

export type Rgb = [number, number, number];

const LETTER = { width: 612, height: 792 };

// Helvetica AFM advance widths for WinAnsi 32–126 (per 1000 em).
const HELVETICA: number[] = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];
const HELVETICA_BOLD: number[] = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Replace characters WinAnsi cannot hold with plain equivalents. */
export function toWinAnsi(input: string): string {
  return input
    .replace(/—|–/g, "-")
    .replace(/−/g, "-")
    .replace(/→/g, "->")
    .replace(/‘|’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/[^\x20-\x7e¡-ÿ·]/g, "?");
}

function escapePdf(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

export function textWidth(text: string, size: number, bold = false): number {
  const table = bold ? HELVETICA_BOLD : HELVETICA;
  let w = 0;
  for (const ch of toWinAnsi(text)) {
    const code = ch.charCodeAt(0);
    w += code >= 32 && code <= 126 ? table[code - 32] : code === 0xb7 ? 278 : 556;
  }
  return (w / 1000) * size;
}

interface TextOptions { size?: number; bold?: boolean; color?: Rgb; align?: "left" | "right" | "center" }

export class PdfDocument {
  private pages: string[][] = [[]];
  readonly width = LETTER.width;
  readonly height = LETTER.height;

  private get ops() { return this.pages[this.pages.length - 1]; }

  newPage() { this.pages.push([]); }

  private rgb([r, g, b]: Rgb) { return `${(r / 255).toFixed(3)} ${(g / 255).toFixed(3)} ${(b / 255).toFixed(3)}`; }

  rect(x: number, y: number, w: number, h: number, fill: Rgb) {
    this.ops.push(`${this.rgb(fill)} rg ${x.toFixed(2)} ${(this.height - y - h).toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)} re f`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color: Rgb, width = 0.75) {
    this.ops.push(`${this.rgb(color)} RG ${width} w ${x1.toFixed(2)} ${(this.height - y1).toFixed(2)} m ${x2.toFixed(2)} ${(this.height - y2).toFixed(2)} l S`);
  }

  /** Draw one line of text with its baseline at `y`. Returns the width drawn. */
  text(x: number, y: number, value: string, { size = 10, bold = false, color = [31, 26, 38], align = "left" }: TextOptions = {}): number {
    const clean = toWinAnsi(value);
    const w = textWidth(clean, size, bold);
    const startX = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${this.rgb(color)} rg 1 0 0 1 ${startX.toFixed(2)} ${(this.height - y).toFixed(2)} Tm (${escapePdf(clean)}) Tj ET`);
    return w;
  }

  /** Word-wrap `value` into lines no wider than `maxWidth`, draw them `lineHeight` apart, return the y after the last line. */
  paragraph(x: number, y: number, value: string, maxWidth: number, opts: TextOptions & { lineHeight?: number } = {}): number {
    const size = opts.size ?? 10;
    const lineHeight = opts.lineHeight ?? size * 1.4;
    const words = toWinAnsi(value).split(/\s+/).filter(Boolean);
    let line = "";
    let cursor = y;
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (textWidth(candidate, size, opts.bold) > maxWidth && line) {
        this.text(x, cursor, line, opts);
        cursor += lineHeight;
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) { this.text(x, cursor, line, opts); cursor += lineHeight; }
    return cursor;
  }

  /** Serialise to a PDF 1.4 byte buffer. */
  toBuffer(): Buffer {
    const objects: string[] = [];
    const add = (body: string) => { objects.push(body); return objects.length; };
    const fontRegular = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>");
    const fontBold = add("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>");
    const pagesId = objects.length + 1 + this.pages.length * 2; // reserved after content+page objects
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const stream = ops.join("\n");
      const contentId = add(`<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`);
      const pageId = add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${this.width} ${this.height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R >> >> /Contents ${contentId} 0 R >>`);
      pageIds.push(pageId);
    }
    const realPagesId = add(`<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`);
    if (realPagesId !== pagesId) throw new Error("PDF object numbering drifted");
    const catalogId = add(`<< /Type /Catalog /Pages ${pagesId} 0 R >>`);

    let out = "%PDF-1.4\n%âãÏÓ\n";
    const offsets: number[] = [];
    objects.forEach((body, i) => {
      offsets.push(Buffer.byteLength(out, "latin1"));
      out += `${i + 1} 0 obj\n${body}\nendobj\n`;
    });
    const xref = Buffer.byteLength(out, "latin1");
    out += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const off of offsets) out += `${String(off).padStart(10, "0")} 00000 n \n`;
    out += `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    return Buffer.from(out, "latin1");
  }
}
