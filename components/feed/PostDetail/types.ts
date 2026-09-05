import type { PostStyling, CommunityFlair } from "@/lib/types";
import { isDarkBackground } from "@/lib/utils/background";

export interface DetailPerson {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export interface DetailMedia {
  id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  caption: string | null;
  position: number;
}

export interface DetailJournalMetadata {
  weather?: string;
  temperature?: string;
  mood?: string;
  timeOfDay?: string;
}

export interface DetailSpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album?: string;
  albumArt?: string;
  externalUrl?: string;
}

/**
 * The one shape both the post page and the post modal render. Each surface
 * keeps its own data source and handlers; only presentation is shared.
 */
export interface DetailPost {
  id: string;
  authorId?: string;
  author: { name: string; handle: string; avatar: string };
  type: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media: DetailMedia[];
  image?: string;
  mentions?: DetailPerson[];
  hashtags?: string[];
  collaborators?: { role?: string | null; user: DetailPerson }[];
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: DetailJournalMetadata | null;
  spotify_track?: DetailSpotifyTrack | null;
  flair?: CommunityFlair | null;
}

/** Text tone over a creator-chosen background. Default surfaces use tokens. */
export interface DetailTone {
  hasBackground: boolean;
  dark: boolean;
  text: string;
  muted: string;
  line: string;
}

export function getDetailTone(styling?: PostStyling | null): DetailTone {
  const hasBackground = Boolean(styling?.background);
  const dark = hasBackground && isDarkBackground(styling?.background);
  if (!hasBackground) {
    return { hasBackground, dark: false, text: "text-ink", muted: "text-subdued", line: "border-line" };
  }
  return dark
    ? { hasBackground, dark, text: "text-white", muted: "text-white/75", line: "border-white/15" }
    : { hasBackground, dark, text: "text-[#1e1e1e]", muted: "text-[#4a4a4a]", line: "border-black/10" };
}

export function alignmentClass(styling?: PostStyling | null) {
  return { left: "text-left", center: "text-center", right: "text-right", justify: "text-justify" }[styling?.textAlignment || "left"];
}

export function lineSpacingClass(styling?: PostStyling | null) {
  return { normal: "leading-relaxed", relaxed: "leading-[2]", loose: "leading-[2.5]" }[styling?.lineSpacing || "normal"];
}
