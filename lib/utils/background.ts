/**
 * Shared background/color utility functions for post styling.
 * Eliminates duplication across PostCard, PostDetailModal, and post/[id]/page.
 */

import type { PostBackground } from "@/lib/types";

/**
 * Calculate relative luminance of a hex color (0 = black, 1 = white).
 */
export function getLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length < 6) return 1;
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/**
 * Extract hex color values from a CSS gradient or pattern string.
 */
export function extractColorsFromGradient(gradient: string): string[] {
  const hexPattern = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g;
  return gradient.match(hexPattern) || [];
}

/**
 * Determine whether a PostBackground is visually dark (for choosing text color).
 * Uses a 0.5 luminance threshold for solid/gradient and 0.4 for patterns.
 * Image backgrounds are always treated as dark.
 */
export function isDarkBackground(background?: PostBackground): boolean {
  if (!background) return false;

  if (background.type === "solid") {
    return getLuminance(background.value) < 0.5;
  }

  if (background.type === "image") return true;

  if (background.type === "gradient") {
    const colors = extractColorsFromGradient(background.value);
    if (colors.length === 0) return false;
    const avgLuminance =
      colors.reduce((sum, color) => sum + getLuminance(color), 0) /
      colors.length;
    return avgLuminance < 0.5;
  }

  if (background.type === "pattern") {
    const colors = extractColorsFromGradient(background.value);
    if (colors.length === 0) return false;
    const avgLuminance =
      colors.reduce((sum, color) => sum + getLuminance(color), 0) /
      colors.length;
    return avgLuminance < 0.4;
  }

  return false;
}

/**
 * Generate inline CSS for a PostBackground (used in card previews).
 */
export function getBackgroundPreviewStyle(
  background?: PostBackground
): React.CSSProperties {
  if (!background) return {};

  switch (background.type) {
    case "solid":
      return { backgroundColor: background.value };
    case "gradient":
      return { background: background.value };
    case "pattern":
      return {
        background: background.value,
        backgroundSize: background.value.includes("notebook")
          ? "100% 24px"
          : background.value.includes("dots") ||
            background.value.includes("grid")
          ? "20px 20px"
          : "auto",
      };
    case "image":
      return {
        backgroundImage: `url(${background.imageUrl || background.value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    default:
      return {};
  }
}

/**
 * Generate inline CSS for a PostBackground (used in full post detail views).
 * Handles more pattern subtypes than the preview variant.
 */
export function getBackgroundStyle(
  background?: PostBackground
): React.CSSProperties {
  if (!background) return {};

  switch (background.type) {
    case "solid":
      return { backgroundColor: background.value };
    case "gradient":
      return { background: background.value };
    case "pattern": {
      const patternValue = background.value;
      let backgroundSize = "auto";
      if (
        patternValue.includes("dots") ||
        patternValue.includes("radial-gradient(circle at 1px")
      ) {
        backgroundSize = "20px 20px";
      } else if (
        patternValue.includes("grid") ||
        patternValue.includes("linear-gradient(rgba")
      ) {
        backgroundSize = "20px 20px";
      } else if (patternValue.includes("notebook")) {
        backgroundSize = "100% 24px";
      }
      return {
        background: patternValue,
        backgroundSize,
      };
    }
    case "image":
      return {
        backgroundImage: `url(${background.imageUrl || background.value})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      };
    default:
      return {};
  }
}
