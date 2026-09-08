import type { PostStyling } from "@/lib/types";
import { isDarkBackground } from "@/lib/utils/background";

/**
 * Text/border classes for a post rendered on its own styling background.
 * One derivation for the detail modal and the post page (profile audit 2e,
 * V-52: both files carried their own copy of these four ternaries).
 */
export interface PostPalette {
  hasBackground: boolean;
  hasDarkBg: boolean;
  text: string;
  muted: string;
  subtle: string;
  border: string;
}

export function getPostPalette(styling?: PostStyling | null): PostPalette {
  const hasBackground = Boolean(styling?.background);
  const hasDarkBg = isDarkBackground(styling?.background);
  return {
    hasBackground,
    hasDarkBg,
    text: hasBackground ? (hasDarkBg ? "text-white" : "text-[#1e1e1e]") : "text-ink",
    muted: hasBackground ? (hasDarkBg ? "text-white/70" : "text-[#4a4a4a]") : "text-muted",
    subtle: hasBackground ? (hasDarkBg ? "text-white/50" : "text-[#6b6b6b]") : "text-muted",
    border: hasBackground ? (hasDarkBg ? "border-white/15" : "border-black/10") : "border-border-light",
  };
}
