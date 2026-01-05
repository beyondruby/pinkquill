"use client";

interface TrendIndicatorProps {
  value: number;
  previousValue: number;
  suffix?: string;
  showPercentage?: boolean;
}

export default function TrendIndicator({
  value,
  previousValue,
  suffix = "",
  showPercentage = true,
}: TrendIndicatorProps) {
  const change = previousValue > 0 ? ((value - previousValue) / previousValue) * 100 : value > 0 ? 100 : 0;
  const isPositive = change > 0;
  const isNeutral = change === 0;

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-ui ${
        isNeutral
          ? "text-muted"
          : isPositive
          ? "text-green-500"
          : "text-red-500"
      }`}
    >
      {!isNeutral && (
        <svg
          className={`w-3 h-3 ${isPositive ? "" : "rotate-180"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      )}
      {showPercentage ? (
        <span>{Math.abs(change).toFixed(1)}%</span>
      ) : (
        <span>
          {isPositive ? "+" : ""}
          {change.toFixed(0)}
          {suffix}
        </span>
      )}
    </span>
  );
}
