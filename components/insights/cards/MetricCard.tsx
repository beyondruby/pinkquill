"use client";

import TrendIndicator from "../shared/TrendIndicator";

interface MetricCardProps {
  label: string;
  value: number | string;
  previousValue?: number;
  format?: "number" | "percentage" | "time";
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  description?: string;
}

function formatValue(value: number | string, format: string): string {
  if (typeof value === "string") return value;

  switch (format) {
    case "number":
      if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
      if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
      return value.toLocaleString();
    case "percentage":
      return `${value.toFixed(1)}%`;
    case "time":
      if (value >= 3600) return `${Math.floor(value / 3600)}h ${Math.floor((value % 3600) / 60)}m`;
      if (value >= 60) return `${Math.floor(value / 60)}m ${Math.floor(value % 60)}s`;
      return `${Math.floor(value)}s`;
    default:
      return value.toString();
  }
}

export default function MetricCard({
  label,
  value,
  previousValue,
  format = "number",
  icon,
  description,
}: MetricCardProps) {
  const numericValue = typeof value === "number" ? value : 0;

  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.04] hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <span className="font-ui text-sm text-muted">{label}</span>
        {icon && <span className="text-purple-primary/60">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="font-display text-3xl text-ink">
          {formatValue(value, format)}
        </span>
        {previousValue !== undefined && (
          <TrendIndicator value={numericValue} previousValue={previousValue} />
        )}
      </div>
      {description && (
        <p className="font-body text-xs text-muted mt-2">{description}</p>
      )}
    </div>
  );
}
