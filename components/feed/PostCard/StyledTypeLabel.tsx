"use client";

import { memo } from "react";
import { PostTypeChip } from "@/components/feed/PostTypeChip";

interface StyledTypeLabelProps {
  type: string;
  className?: string;
}

// Kept as a named export for existing call sites — it is now a thin alias of
// the single canonical PostTypeChip (monochrome icon + label).
function StyledTypeLabelComponent({ type, className }: StyledTypeLabelProps) {
  return <PostTypeChip type={type} variant="label" size="md" className={className} />;
}

export const StyledTypeLabel = memo(StyledTypeLabelComponent);
export default StyledTypeLabel;
