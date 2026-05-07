"use client";

import { useSellerStats } from "@/lib/hooks/useReviews";
import { QuillMeter } from "./ReviewCard";
import QuillIcon from "./QuillIcon";

interface SellerRatingProps {
  sellerId: string;
  compact?: boolean;
}

export default function SellerRating({ sellerId, compact = false }: SellerRatingProps) {
  const { stats, loading } = useSellerStats(sellerId);

  if (loading) {
    return <div className="h-5 w-24 bg-skeleton rounded animate-pulse" />;
  }

  if (!stats || stats.total_reviews === 0) {
    if (compact) return null;
    return <span className="text-xs font-ui text-muted">New creator</span>;
  }

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <QuillIcon className="h-3.5 w-3.5" gradient />
        <span className="font-ui text-sm font-semibold text-ink">
          {stats.avg_quill_score.toFixed(1)}
        </span>
        <span className="text-xs text-muted">({stats.total_reviews})</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        <QuillMeter score={Math.round(stats.avg_quill_score)} />
        <span className="font-ui text-sm font-semibold text-ink">
          {stats.avg_quill_score.toFixed(1)}
        </span>
        <span className="text-xs text-muted">
          ({stats.total_reviews} review{stats.total_reviews === 1 ? "" : "s"})
        </span>
      </div>

      <span className="text-xs text-muted">
        {stats.completed_orders} completed &middot; {stats.completion_rate}% completion
      </span>
    </div>
  );
}
