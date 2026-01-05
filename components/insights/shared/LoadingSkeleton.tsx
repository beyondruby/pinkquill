"use client";

interface LoadingSkeletonProps {
  type?: "card" | "chart" | "table" | "full";
}

export default function LoadingSkeleton({ type = "full" }: LoadingSkeletonProps) {
  if (type === "card") {
    return (
      <div className="bg-white rounded-2xl p-5 border border-black/[0.04] animate-pulse">
        <div className="h-4 w-24 bg-black/5 rounded mb-3" />
        <div className="h-8 w-20 bg-black/5 rounded" />
      </div>
    );
  }

  if (type === "chart") {
    return (
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04] animate-pulse">
        <div className="h-4 w-32 bg-black/5 rounded mb-4" />
        <div className="h-64 bg-black/5 rounded" />
      </div>
    );
  }

  if (type === "table") {
    return (
      <div className="bg-white rounded-2xl border border-black/[0.04] overflow-hidden animate-pulse">
        <div className="p-4 border-b border-black/[0.04]">
          <div className="h-4 w-32 bg-black/5 rounded" />
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="p-4 border-b border-black/[0.04] last:border-b-0 flex items-center gap-4">
            <div className="h-10 w-10 bg-black/5 rounded" />
            <div className="flex-1">
              <div className="h-4 w-48 bg-black/5 rounded mb-2" />
              <div className="h-3 w-24 bg-black/5 rounded" />
            </div>
            <div className="h-4 w-16 bg-black/5 rounded" />
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
        <div className="h-8 w-48 bg-black/5 rounded mb-2" />
        <div className="h-4 w-64 bg-black/5 rounded" />
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-black/[0.04]">
            <div className="h-4 w-24 bg-black/5 rounded mb-3" />
            <div className="h-8 w-20 bg-black/5 rounded" />
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
        <div className="h-4 w-32 bg-black/5 rounded mb-4" />
        <div className="h-64 bg-black/5 rounded" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
          <div className="h-4 w-32 bg-black/5 rounded mb-4" />
          <div className="h-48 bg-black/5 rounded" />
        </div>
        <div className="bg-white rounded-2xl p-6 border border-black/[0.04]">
          <div className="h-4 w-32 bg-black/5 rounded mb-4" />
          <div className="h-48 bg-black/5 rounded" />
        </div>
      </div>
    </div>
  );
}
