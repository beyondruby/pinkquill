// =============================================================================
// POST TYPE THEME — the single source of truth for how a post type is named
// and *shaped* across the product (feed views, modal, notifications, share).
//
// Strategy (locked Sep 2026): "type is form, not colour".
//   • No per-type colour. Every type is signalled by ONE monochrome chip
//     (icon + label, see components/feed/PostTypeChip.tsx) so colour stays
//     free for brand, hover and active states, and dark mode stays clean.
//   • A type earns its identity through its FORM — how the body renders
//     (poem keeps line breaks in a serif, quote is a pull-quote, journal
//     carries its date/mood strip, editorial gets subtitle + reading time).
//   • Icons live in components/feed/PostTypeIcon.tsx (one stroke style).
//
// Do NOT re-introduce per-layout label/colour maps in components.
// =============================================================================

import type { PostType } from "@/components/feed/PostCard/types";

/** How a post body is rendered. Mirrors `showcase` in formats.ts. */
export type PostForm =
  | "text" // plain thought
  | "poem" // line-preserving verse
  | "journal" // dated entry with mood/weather strip
  | "editorial" // essay / blog / story / letter — title, deck, reading time
  | "quote" // pull-quote with attribution
  | "gallery" // media-first
  | "video" // poster + play
  | "music"; // Spotify / audio card

export interface PostTypeTheme {
  /** Canonical display label — "Poem", "Journal", "Thought"… */
  label: string;
  /** Conversational verb phrase for notifications / share cards ("wrote a"). */
  verb: string;
  /** Body treatment. */
  form: PostForm;
}

export const POST_TYPE_THEMES: Record<PostType, PostTypeTheme> = {
  thought: { label: "Thought", verb: "shared a", form: "text" },
  poem: { label: "Poem", verb: "wrote a", form: "poem" },
  journal: { label: "Journal", verb: "wrote in their", form: "journal" },
  essay: { label: "Essay", verb: "wrote an", form: "editorial" },
  blog: { label: "Blog", verb: "published a", form: "editorial" },
  story: { label: "Story", verb: "shared a", form: "editorial" },
  letter: { label: "Letter", verb: "wrote a", form: "editorial" },
  quote: { label: "Quote", verb: "shared a", form: "quote" },
  visual: { label: "Visual", verb: "shared a", form: "gallery" },
  video: { label: "Video", verb: "shared a", form: "video" },
  audio: { label: "Music", verb: "shared", form: "music" },
};

export const POST_TYPE_ORDER: PostType[] = [
  "thought",
  "poem",
  "journal",
  "essay",
  "blog",
  "story",
  "letter",
  "quote",
  "visual",
  "video",
  "audio",
];

export function getPostTypeTheme(type: PostType | string): PostTypeTheme {
  return POST_TYPE_THEMES[type as PostType] ?? POST_TYPE_THEMES.thought;
}

/** "wrote a poem", "shared a thought" — conversational, lower-case. */
export function getPostTypePhrase(type: PostType | string): string {
  const t = getPostTypeTheme(type);
  return `${t.verb} ${t.label.toLowerCase()}`;
}
