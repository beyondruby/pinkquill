// =============================================================================
// FORMAT REGISTRY — the single declarative spine for the "Creative Formats"
// post system (see docs/POST_CREATION_BLUEPRINT.md).
//
// Each post Format is one blueprint declaring:
//   • category   — how it's experienced (Read / Seen / Watched / Heard)
//   • leadMedium — what drives its showcase
//   • options    — which composer (Page-2) modules it unlocks
//   • showcase   — how the feed renders it
//
// The composer renders a format's `options`; the feed renders its `showcase`.
// Adding a future format = adding one entry here — nothing else is rewired.
//
// This module is intentionally PostType-agnostic (its own PostFormatId superset)
// so it can introduce the new Sound/Voice formats without destabilising the
// existing PostType union and its exhaustive consumers.
// =============================================================================

import type { PostType } from "@/components/feed/PostCard/types";
import { getPostTypeTheme } from "./post-type-theme";

// The four human-facing categories — "how is this experienced?"
export type PostCategory = "read" | "seen" | "watched" | "heard";

// All formats: every existing PostType + the new Sound/Voice (uploaded audio).
export type PostFormatId = PostType | "sound" | "voice";

export type PostMedium = "text" | "image" | "video" | "audio";

// Composer modules a format can unlock on Page 2 (the "additional options").
export type ComposerModule =
  | "journalMeta" // mood · weather · entry date (existing JournalMetadata)
  | "spotify" // Spotify link (existing spotify_track)
  | "audioUpload" // NEW — uploaded music/sound file
  | "voiceUpload" // NEW — uploaded voice note
  | "poemForm" // optional: free verse / haiku / sonnet (later)
  | "subtitle" // optional essay/blog subtitle (later)
  | "attribution" // optional quote source (later)
  | "mediaGallery" // image gallery / album
  | "videoPoster"; // video thumbnail / poster

// Feed showcase treatments (how the card renders the format).
export type ShowcaseId =
  | "text"
  | "poem"
  | "journal"
  | "editorial"
  | "quote"
  | "gallery"
  | "video"
  | "spotify"
  | "audioPlayer"
  | "voice";

export interface CategoryMeta {
  id: PostCategory;
  label: string; // "Read" | "Seen" | "Watched" | "Heard"
  medium: PostMedium;
}

export const POST_CATEGORIES: Record<PostCategory, CategoryMeta> = {
  read: { id: "read", label: "Read", medium: "text" },
  seen: { id: "seen", label: "Seen", medium: "image" },
  watched: { id: "watched", label: "Watched", medium: "video" },
  heard: { id: "heard", label: "Heard", medium: "audio" },
};

export const CATEGORY_ORDER: PostCategory[] = ["read", "seen", "watched", "heard"];

export interface FormatSpec {
  id: PostFormatId;
  label: string;
  category: PostCategory;
  leadMedium: PostMedium;
  options: ComposerModule[];
  showcase: ShowcaseId;
  /** True for formats introduced by this revamp (Sound/Voice). */
  isNew?: boolean;
}

// Canonical label for existing PostTypes comes from post-type-theme (the single
// source of truth established in the layout revamp); Heard labels are set
// explicitly to avoid the theme's "Voice" label colliding with the new split.
const themed = (t: PostType): string => getPostTypeTheme(t).label;

export const FORMAT_SPECS: Record<PostFormatId, FormatSpec> = {
  // 📖 Read — text
  thought: { id: "thought", label: themed("thought"), category: "read", leadMedium: "text", options: [], showcase: "text" },
  poem: { id: "poem", label: themed("poem"), category: "read", leadMedium: "text", options: ["poemForm"], showcase: "poem" },
  journal: { id: "journal", label: themed("journal"), category: "read", leadMedium: "text", options: ["journalMeta"], showcase: "journal" },
  essay: { id: "essay", label: themed("essay"), category: "read", leadMedium: "text", options: ["subtitle"], showcase: "editorial" },
  blog: { id: "blog", label: themed("blog"), category: "read", leadMedium: "text", options: ["subtitle"], showcase: "editorial" },
  story: { id: "story", label: themed("story"), category: "read", leadMedium: "text", options: [], showcase: "editorial" },
  letter: { id: "letter", label: themed("letter"), category: "read", leadMedium: "text", options: [], showcase: "editorial" },
  quote: { id: "quote", label: themed("quote"), category: "read", leadMedium: "text", options: ["attribution"], showcase: "quote" },

  // 👁 Seen — image
  visual: { id: "visual", label: themed("visual"), category: "seen", leadMedium: "image", options: ["mediaGallery"], showcase: "gallery" },

  // ▶ Watched — video
  video: { id: "video", label: themed("video"), category: "watched", leadMedium: "video", options: ["videoPoster"], showcase: "video" },

  // 🎧 Heard — sound
  audio: { id: "audio", label: "Music", category: "heard", leadMedium: "audio", options: ["spotify"], showcase: "spotify" },
  sound: { id: "sound", label: "Sound", category: "heard", leadMedium: "audio", options: ["audioUpload"], showcase: "audioPlayer", isNew: true },
  voice: { id: "voice", label: "Voice", category: "heard", leadMedium: "audio", options: ["voiceUpload"], showcase: "voice", isNew: true },
};

export const DEFAULT_FORMAT: PostFormatId = "thought";

export function isPostFormatId(value: unknown): value is PostFormatId {
  return typeof value === "string" && value in FORMAT_SPECS;
}

export function getFormatSpec(id: string | null | undefined): FormatSpec {
  if (id && id in FORMAT_SPECS) return FORMAT_SPECS[id as PostFormatId];
  return FORMAT_SPECS[DEFAULT_FORMAT];
}

export function getCategoryOf(id: string | null | undefined): PostCategory {
  return getFormatSpec(id).category;
}

/** Formats belonging to a category, in registry order — for the Page-2 picker. */
export function getFormatsByCategory(category: PostCategory): FormatSpec[] {
  return Object.values(FORMAT_SPECS).filter((f) => f.category === category);
}
