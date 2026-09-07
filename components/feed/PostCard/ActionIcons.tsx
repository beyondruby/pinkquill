// Feed action glyphs: one modern rounded-stroke set (heart, comment bubble,
// relay, share, bookmark) plus the media controls. Every icon is drawn on the
// same 24-unit grid with the same 2px round stroke, so the action row lines
// up optically at 20px. Use these in the classic card instead of ui/Icons.

import type { SVGProps } from "react";

interface GlyphProps extends SVGProps<SVGSVGElement> {
  /** Pixel size of the square box; defaults to the action-row size. */
  size?: number;
}

function Glyph({ size = 20, children, className = "", fill = "none", ...rest }: GlyphProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill}
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={`pq-glyph ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

export const HeartGlyph = ({ filled = false, ...p }: GlyphProps & { filled?: boolean }) => (
  <Glyph fill={filled ? "currentColor" : "none"} {...p}>
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </Glyph>
);

export const CommentGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
  </Glyph>
);

export const RelayGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="m2 9 3-3 3 3" />
    <path d="M13 18H7a2 2 0 0 1-2-2V6" />
    <path d="m22 15-3 3-3-3" />
    <path d="M11 6h6a2 2 0 0 1 2 2v10" />
  </Glyph>
);

export const ShareGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
    <path d="m16 6-4-4-4 4" />
    <path d="M12 2v13" />
  </Glyph>
);

export const BookmarkGlyph = ({ filled = false, ...p }: GlyphProps & { filled?: boolean }) => (
  <Glyph fill={filled ? "currentColor" : "none"} {...p}>
    <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
  </Glyph>
);

export const PlayGlyph = (p: GlyphProps) => (
  <Glyph fill="currentColor" strokeWidth={1} {...p}>
    <path d="M7 4.5v15a1 1 0 0 0 1.53.85l12-7.5a1 1 0 0 0 0-1.7l-12-7.5A1 1 0 0 0 7 4.5Z" />
  </Glyph>
);

export const ChevronLeftGlyph = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="m15 18-6-6 6-6" />
  </Glyph>
);

export const ChevronRightGlyph = (p: GlyphProps) => (
  <Glyph strokeWidth={2.5} {...p}>
    <path d="m9 18 6-6-6-6" />
  </Glyph>
);

export const ArrowRightGlyph = (p: GlyphProps) => (
  <Glyph {...p}>
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </Glyph>
);
