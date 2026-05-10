"use client";

interface LoadingSkeletonProps {
  type?: "card" | "chart" | "table" | "full";
}

export default function LoadingSkeleton({ type = "full" }: LoadingSkeletonProps) {
  if (type === "card") {
    return (
      <div className="bg-surface rounded-2xl p-5 border border-border-light animate-pulse">
        <div className="h-4 w-24 bg-skeleton rounded mb-3" />
        <div className="h-8 w-20 bg-skeleton rounded" />
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light animate-pulse">
        <div className="h-4 w-32 bg-skeleton rounded mb-4" />
        <div className="h-64 bg-skeleton rounded" />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="bg-surface rounded-2xl border border-border-light overflow-hidden animate-pulse">
        <div className="p-4 border-b border-border-light">
          <div className="h-4 w-32 bg-skeleton rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-border-light last:border-b-0 flex items-center gap-4">
            <div className="h-10 w-10 bg-skeleton rounded" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-skeleton rounded mb-2" />
              <div className="h-3 w-24 bg-skeleton rounded" />
            </div>
            <div className="h-4 w-16 bg-skeleton rounded" />
          </div>
        ))}
      </div>
    );
  }

  // Full page loading
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div>
        <div className="h-8 w-48 bg-skeleton rounded mb-2" />
        <div className="h-4 w-64 bg-skeleton rounded" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-surface rounded-2xl p-3.5 sm:p-5 border border-border-light">
            <div className="h-4 w-24 bg-skeleton rounded mb-3" />
            <div className="h-8 w-20 bg-skeleton rounded" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
        <div className="h-4 w-32 bg-skeleton rounded mb-4" />
        <div className="h-64 bg-skeleton rounded" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
          <div className="h-4 w-32 bg-skeleton rounded mb-4" />
          <div className="h-48 bg-skeleton rounded" />
        </div>
        <div className="bg-surface rounded-2xl p-4 sm:p-6 border border-border-light">
          <div className="h-4 w-32 bg-skeleton rounded mb-4" />
          <div className="h-48 bg-skeleton rounded" />
        </div>
      </div>
    </div>
  );
}
