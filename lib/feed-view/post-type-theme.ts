// Per-post-type visual personality. Used by the alternate feed views (compact,
// grid, magazine) to give each post type a distinct feel without breaking the
// design system. The classes below resolve to CSS variables in globals.css,
// so the alternate feed never leaks one-off Tailwind hues outside the active
// Pinkquill theme.
//
// Memory rule: NO accent-line boxes (no border-l/-t/-r/-b-N). All themes use a
// full subtle background and a full matching border.

import type { PostType } from "@/components/feed/PostCard/types";

export interface PostTypeTheme {
  /** Short display label, used for badges. */
  label: string;
  /** Single-character/glyph icon — keeps tiles light and avoids extra SVG cost. */
  glyph: string;
  /** Full background tint class — gradient for richer treatments. */
  tintBg: string;
  /** Full matching subtle border class (no accent lines). */
  tintBorder: string;
  /** Subdued text color for badges / type label. */
  tintText: string;
  /** Solid token background — used for compact-view marks. */
  dotBg: string;
  /** Optional family hint for the body preview ("serif" | "ui" | "italic"). */
  bodyClass: string;
  /** Optional family hint for the title. */
  titleClass: string;
}

export const POST_TYPE_THEMES: Record<PostType, PostTypeTheme> = {
  poem: {
    label: "Poem",
    glyph: "✦",
    tintBg: "pq-type-wash-primary",
    tintBorder: "pq-type-border-primary",
    tintText: "pq-type-text-primary",
    dotBg: "pq-type-fill-primary",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
  journal: {
    label: "Journal",
    glyph: "◐",
    tintBg: "pq-type-wash-warm",
    tintBorder: "pq-type-border-warm",
    tintText: "pq-type-text-warm",
    dotBg: "pq-type-fill-warm",
    bodyClass: "font-body italic",
    titleClass: "font-display",
  },
  thought: {
    label: "Thought",
    glyph: "✸",
    tintBg: "pq-type-wash-soft",
    tintBorder: "pq-type-border-soft",
    tintText: "pq-type-text-soft",
    dotBg: "pq-type-fill-soft",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  visual: {
    label: "Visual",
    glyph: "◆",
    tintBg: "pq-type-wash-primary",
    tintBorder: "pq-type-border-primary",
    tintText: "pq-type-text-primary",
    dotBg: "pq-type-fill-primary",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  audio: {
    label: "Voice",
    glyph: "♪",
    tintBg: "pq-type-wash-secondary",
    tintBorder: "pq-type-border-secondary",
    tintText: "pq-type-text-secondary",
    dotBg: "pq-type-fill-secondary",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  video: {
    label: "Video",
    glyph: "▶",
    tintBg: "pq-type-wash-primary",
    tintBorder: "pq-type-border-primary",
    tintText: "pq-type-text-primary",
    dotBg: "pq-type-fill-primary",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  essay: {
    label: "Essay",
    glyph: "§",
    tintBg: "pq-type-wash-soft",
    tintBorder: "pq-type-border-soft",
    tintText: "pq-type-text-soft",
    dotBg: "pq-type-fill-soft",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  blog: {
    label: "Blog",
    glyph: "❖",
    tintBg: "pq-type-wash-soft",
    tintBorder: "pq-type-border-soft",
    tintText: "pq-type-text-soft",
    dotBg: "pq-type-fill-soft",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  story: {
    label: "Story",
    glyph: "✧",
    tintBg: "pq-type-wash-secondary",
    tintBorder: "pq-type-border-secondary",
    tintText: "pq-type-text-secondary",
    dotBg: "pq-type-fill-secondary",
    bodyClass: "font-display",
    titleClass: "font-display",
  },
  letter: {
    label: "Letter",
    glyph: "✉",
    tintBg: "pq-type-wash-warm",
    tintBorder: "pq-type-border-warm",
    tintText: "pq-type-text-warm",
    dotBg: "pq-type-fill-warm",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
  quote: {
    label: "Quote",
    glyph: "“",
    tintBg: "pq-type-wash-secondary",
    tintBorder: "pq-type-border-secondary",
    tintText: "pq-type-text-secondary",
    dotBg: "pq-type-fill-secondary",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
};

export function getPostTypeTheme(type: PostType): PostTypeTheme {
  return POST_TYPE_THEMES[type] ?? POST_TYPE_THEMES.thought;
}
