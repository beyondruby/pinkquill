// Feed action glyphs after the quill-v6 reference (Font Awesome 6 shapes:
// heart / comment outlines, retweet, share-nodes, bookmark). Every icon is
// drawn into the same 20×20 box so the action row lines up optically —
// use these in the classic card instead of the stroke icons in ui/Icons.

import type { SVGProps } from "react";

interface GlyphProps extends Omit<SVGProps<SVGSVGElement>, "viewBox"> {
  /** Pixel size of the square box; defaults to the action-row size. */
  size?: number;
}

function Glyph({ size = 20, children, viewBox, className = "", ...rest }: GlyphProps & { viewBox: string; children: React.ReactNode }) {
  return (
    <svg
      viewBox={viewBox}
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
      className={`pq-glyph ${className}`}
      {...rest}
    >
      {children}
    </svg>
  );
}

/** far fa-heart */
export const HeartGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 512 512" {...p}>
    <path d="M244 84L255.1 96L267.1 84.02C300.6 51.37 347 36.51 392.6 44.1C461.5 55.58 512 115.2 512 185.1V190.9C512 232.4 494.8 272.1 464.4 300.4L283.7 469.1C276.2 476.1 266.3 480 256 480C245.7 480 235.8 476.1 228.3 469.1L47.59 300.4C17.23 272.1 0 232.4 0 190.9V185.1C0 115.2 50.52 55.58 119.4 44.1C164.1 36.51 211.4 51.37 244 84C243.1 84 244 84.01 244 84L244 84zM255.1 163.9L210.1 117.1C188.4 96.28 157.6 86.4 127.3 91.44C81.55 99.07 48 138.7 48 185.1V190.9C48 219.1 59.71 246.1 80.34 265.3L256 429.3L431.7 265.3C452.3 246.1 464 219.1 464 190.9V185.1C464 138.7 430.4 99.07 384.7 91.44C354.4 86.4 323.6 96.28 301.9 117.1L255.1 163.9z" />
  </Glyph>
);

/** far fa-comment */
export const CommentGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 512 512" {...p}>
    <path d="M512 240c0 114.9-114.6 208-256 208c-37.1 0-72.3-6.4-104.1-17.9c-11.9 8.7-31.3 20.6-54.3 30.6C73.6 471.1 44.7 480 16 480c-6.5 0-12.3-3.9-14.8-9.9c-2.5-6-1.1-12.8 3.4-17.4l0 0 0 0 0 0 0 0 .3-.3c.3-.3 .7-.7 1.3-1.4c1.1-1.2 2.8-3.1 4.9-5.7c4.1-5 9.6-12.4 15.2-21.6c10-16.6 19.5-38.4 21.4-62.9C17.7 326.8 0 285.1 0 240C0 125.1 114.6 32 256 32s256 93.1 256 208zM256 80C135.1 80 48 154.7 48 240c0 35.6 15.7 67.5 44.5 93.8c8.9 8.1 12.8 20.4 10.4 32.1c-3.9 19.8-10.3 39.8-18.9 57.6c22.2-7.8 40.7-17.7 53.7-26.9c9.2-6.5 21-8.1 31.6-4.2C197.5 400.2 225.9 400 256 400c120.9 0 208-74.7 208-160S376.9 80 256 80z" />
  </Glyph>
);

/** fas fa-retweet */
export const RelayGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 576 512" {...p}>
    <path d="M272 416c17.7 0 32-14.3 32-32s-14.3-32-32-32H160c-17.7 0-32-14.3-32-32V192h32c12.9 0 24.6-7.8 29.6-19.8s2.2-25.7-6.9-34.9l-64-64c-12.5-12.5-32.8-12.5-45.3 0l-64 64c-9.2 9.2-11.9 22.9-6.9 34.9s16.6 19.8 29.6 19.8l32 0 0 128c0 53 43 96 96 96H272zM304 96c-17.7 0-32 14.3-32 32s14.3 32 32 32l112 0c17.7 0 32 14.3 32 32l0 128H416c-12.9 0-24.6 7.8-29.6 19.8s-2.2 25.7 6.9 34.9l64 64c12.5 12.5 32.8 12.5 45.3 0l64-64c9.2-9.2 11.9-22.9 6.9-34.9s-16.6-19.8-29.6-19.8l-32 0V192c0-53-43-96-96-96L304 96z" />
  </Glyph>
);

/** fas fa-share-nodes (share-alt) */
export const ShareGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 448 512" {...p}>
    <path d="M352 224c53 0 96-43 96-96s-43-96-96-96s-96 43-96 96c0 4 .2 8 .7 11.9l-94.1 47C145.4 170.2 121.9 160 96 160c-53 0-96 43-96 96s43 96 96 96c25.9 0 49.4-10.2 66.6-26.9l94.1 47c-.5 3.9-.7 7.8-.7 11.9c0 53 43 96 96 96s96-43 96-96s-43-96-96-96c-25.9 0-49.4 10.2-66.6 26.9l-94.1-47c.5-3.9 .7-7.8 .7-11.9s-.2-8-.7-11.9l94.1-47C302.6 213.8 326.1 224 352 224z" />
  </Glyph>
);

/** far fa-bookmark / fas fa-bookmark */
export const BookmarkGlyph = ({ filled = false, ...p }: GlyphProps & { filled?: boolean }) => (
  <Glyph viewBox="0 0 384 512" {...p}>
    {filled ? (
      <path d="M0 48V487.7C0 501.1 10.9 512 24.3 512c5 0 9.9-1.5 14-4.4L192 400 345.7 507.6c4.1 2.9 9 4.4 14 4.4c13.4 0 24.3-10.9 24.3-24.3V48c0-26.5-21.5-48-48-48H48C21.5 0 0 21.5 0 48z" />
    ) : (
      <path d="M0 48C0 21.5 21.5 0 48 0l0 48V441.4l130.1-92.9c8.3-6 19.6-6 27.9 0L336 441.4V48H48V0H336c26.5 0 48 21.5 48 48V488c0 9-5 17.2-13 21.3s-17.6 3.4-24.9-1.8L192 397.5 37.9 507.5c-7.3 5.2-16.9 5.9-24.9 1.8S0 497 0 488V48z" />
    )}
  </Glyph>
);

/** fas fa-play */
export const PlayGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 384 512" {...p}>
    <path d="M73 39c-14.8-9.1-33.4-9.4-48.5-.9S0 62.6 0 80V432c0 17.4 9.4 33.4 24.5 41.9s33.7 8.1 48.5-.9L361 297c14.3-8.7 23-24.2 23-41s-8.7-32.2-23-41L73 39z" />
  </Glyph>
);

/** fas fa-chevron-left */
export const ChevronLeftGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 320 512" {...p}>
    <path d="M9.4 233.4c-12.5 12.5-12.5 32.8 0 45.3l192 192c12.5 12.5 32.8 12.5 45.3 0s12.5-32.8 0-45.3L77.3 256 246.6 86.6c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0l-192 192z" />
  </Glyph>
);

/** fas fa-chevron-right */
export const ChevronRightGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 320 512" {...p}>
    <path d="M310.6 233.4c12.5 12.5 12.5 32.8 0 45.3l-192 192c-12.5 12.5-32.8 12.5-45.3 0s-12.5-32.8 0-45.3L242.7 256 73.4 86.6c-12.5-12.5-12.5-32.8 0-45.3s32.8-12.5 45.3 0l192 192z" />
  </Glyph>
);

/** fas fa-arrow-right */
export const ArrowRightGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 448 512" {...p}>
    <path d="M438.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-160-160c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3L338.8 224 32 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l306.7 0L233.4 393.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l160-160z" />
  </Glyph>
);

/** fas fa-microphone — the voice-note banner */
export const MicrophoneGlyph = (p: GlyphProps) => (
  <Glyph viewBox="0 0 384 512" {...p}>
    <path d="M192 0C139 0 96 43 96 96V256c0 53 43 96 96 96s96-43 96-96V96c0-53-43-96-96-96zM64 216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 89.1 66.2 162.7 152 174.4V464H120c-13.3 0-24 10.7-24 24s10.7 24 24 24h72 72c13.3 0 24-10.7 24-24s-10.7-24-24-24H216V430.4c85.8-11.7 152-85.3 152-174.4V216c0-13.3-10.7-24-24-24s-24 10.7-24 24v40c0 70.7-57.3 128-128 128s-128-57.3-128-128V216z" />
  </Glyph>
);
