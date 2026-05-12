// Per-post-type visual personality. Used by the alternate feed views (compact,
// grid, magazine) to give each post type a distinct feel without breaking the
// design system. Opacities are kept low so tints layer cleanly over any brand
// theme (default/cream/sepia/noir/ocean/sunset).
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
  /** Solid (non-gradient) background — used for compact-view dots. */
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
    tintBg: "bg-gradient-to-br from-rose-400/12 via-fuchsia-300/8 to-pink-400/12",
    tintBorder: "border-rose-300/40",
    tintText: "text-rose-700/80 dark:text-rose-300/80",
    dotBg: "bg-rose-400/70",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
  journal: {
    label: "Journal",
    glyph: "◐",
    tintBg: "bg-gradient-to-br from-amber-300/14 via-orange-200/10 to-yellow-200/12",
    tintBorder: "border-amber-300/40",
    tintText: "text-amber-700/80 dark:text-amber-300/80",
    dotBg: "bg-amber-400/80",
    bodyClass: "font-body italic",
    titleClass: "font-display",
  },
  thought: {
    label: "Thought",
    glyph: "✸",
    tintBg: "bg-gradient-to-br from-sky-400/12 via-cyan-300/8 to-blue-300/12",
    tintBorder: "border-sky-300/40",
    tintText: "text-sky-700/80 dark:text-sky-300/80",
    dotBg: "bg-sky-400/80",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  visual: {
    label: "Visual",
    glyph: "◆",
    tintBg: "bg-gradient-to-br from-violet-400/14 via-purple-300/10 to-fuchsia-300/12",
    tintBorder: "border-violet-300/40",
    tintText: "text-violet-700/80 dark:text-violet-300/80",
    dotBg: "bg-violet-400/80",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  audio: {
    label: "Voice",
    glyph: "♪",
    tintBg: "bg-gradient-to-br from-pink-400/14 via-rose-300/10 to-fuchsia-300/12",
    tintBorder: "border-pink-300/40",
    tintText: "text-pink-700/80 dark:text-pink-300/80",
    dotBg: "bg-pink-400/80",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  video: {
    label: "Video",
    glyph: "▶",
    tintBg: "bg-gradient-to-br from-indigo-400/14 via-blue-300/10 to-sky-300/12",
    tintBorder: "border-indigo-300/40",
    tintText: "text-indigo-700/80 dark:text-indigo-300/80",
    dotBg: "bg-indigo-400/80",
    bodyClass: "font-ui",
    titleClass: "font-display",
  },
  essay: {
    label: "Essay",
    glyph: "§",
    tintBg: "bg-gradient-to-br from-emerald-300/14 via-teal-300/10 to-green-200/12",
    tintBorder: "border-emerald-300/40",
    tintText: "text-emerald-700/80 dark:text-emerald-300/80",
    dotBg: "bg-emerald-400/80",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  blog: {
    label: "Blog",
    glyph: "❖",
    tintBg: "bg-gradient-to-br from-teal-300/14 via-cyan-300/10 to-sky-200/12",
    tintBorder: "border-teal-300/40",
    tintText: "text-teal-700/80 dark:text-teal-300/80",
    dotBg: "bg-teal-400/80",
    bodyClass: "font-body",
    titleClass: "font-display",
  },
  story: {
    label: "Story",
    glyph: "✧",
    tintBg: "bg-gradient-to-br from-purple-400/14 via-pink-300/10 to-rose-300/12",
    tintBorder: "border-purple-300/40",
    tintText: "text-purple-700/80 dark:text-purple-300/80",
    dotBg: "bg-purple-400/80",
    bodyClass: "font-display",
    titleClass: "font-display",
  },
  letter: {
    label: "Letter",
    glyph: "✉",
    tintBg: "bg-gradient-to-br from-amber-200/14 via-yellow-200/10 to-orange-200/12",
    tintBorder: "border-amber-300/40",
    tintText: "text-amber-700/80 dark:text-amber-300/80",
    dotBg: "bg-amber-300/80",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
  quote: {
    label: "Quote",
    glyph: "“",
    tintBg: "bg-gradient-to-br from-rose-300/14 via-pink-300/10 to-fuchsia-300/12",
    tintBorder: "border-rose-300/40",
    tintText: "text-rose-700/80 dark:text-rose-300/80",
    dotBg: "bg-rose-300/80",
    bodyClass: "font-display italic",
    titleClass: "font-display italic",
  },
};

export function getPostTypeTheme(type: PostType): PostTypeTheme {
  return POST_TYPE_THEMES[type] ?? POST_TYPE_THEMES.thought;
}
