// The ONE way a post type is shown anywhere in the product: a monochrome
// icon + canonical label. Colour is inherited (default: muted ink) so the chip
// never competes with content or brand. See lib/feed-view/post-type-theme.ts.
import { getPostTypeTheme, getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { PostTypeIcon } from "./PostTypeIcon";
import type { PostType } from "./PostCard/types";

interface PostTypeChipProps {
  type: PostType | string;
  /**
   * "label"  — sentence case, sits inline with names/dates (modal, tiles).
   * "caps"   — small caps with tracking, for tiles and rows (stream, gallery).
   * "phrase" — "shared a thought" beside the author's name (classic card
   *            header); no icon, the verb carries the type.
   */
  variant?: "label" | "caps" | "phrase";
  size?: "xs" | "sm" | "md";
  /** Icon only (label still available to assistive tech). */
  iconOnly?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<PostTypeChipProps["size"]>, { text: string; icon: string; gap: string }> = {
  xs: { text: "text-[0.66rem]", icon: "w-3 h-3", gap: "gap-1" },
  sm: { text: "text-[0.72rem]", icon: "w-3.5 h-3.5", gap: "gap-1.5" },
  md: { text: "text-[0.82rem]", icon: "w-4 h-4", gap: "gap-1.5" },
};

export function PostTypeChip({
  type,
  variant = "label",
  size = "sm",
  iconOnly = false,
  className = "",
}: PostTypeChipProps) {
  const theme = getPostTypeTheme(type);
  const s = SIZE[size];
  if (variant === "phrase") {
    return (
      <span className={`whitespace-nowrap font-ui font-light ${s.text} ${className || "text-muted"}`} title={theme.label}>
        {getPostTypePhrase(type)}
      </span>
    );
  }
  const typography =
    variant === "caps"
      ? "font-ui font-medium"
      : "font-ui font-normal";
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap ${s.gap} ${s.text} ${typography} ${className || "text-muted"}`}
      title={theme.label}
    >
      <PostTypeIcon type={type} className={`${s.icon} shrink-0`} />
      {iconOnly ? <span className="sr-only">{theme.label}</span> : <span>{theme.label}</span>}
    </span>
  );
}

export default PostTypeChip;
