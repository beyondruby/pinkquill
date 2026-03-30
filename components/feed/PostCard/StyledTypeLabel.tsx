"use client";

import { memo } from "react";
import { postTypeStyles, iconColorMap } from "./constants";

interface StyledTypeLabelProps {
  type: string;
}

function StyledTypeLabelComponent({ type }: StyledTypeLabelProps) {
  const style = postTypeStyles[type];
  if (!style) return <span>{type}</span>;

  return (
    <span className="inline-flex items-center gap-1">
      {style.prefix}{" "}
      <span
        className={`inline-flex items-center gap-1 font-medium bg-gradient-to-r ${style.gradient} bg-clip-text text-transparent`}
      >
        <span style={{ color: iconColorMap[type] || "#8e44ad" }}>
          {style.icon}
        </span>
        {style.label}
      </span>
    </span>
  );
}

export const StyledTypeLabel = memo(StyledTypeLabelComponent);
export default StyledTypeLabel;
