"use client";

import { useSellerStats } from "@/lib/hooks/useReviews";
import { SELLER_LEVEL_LABELS, type SellerLevel } from "@/lib/types/store";

const LEVEL_COLORS: Record<SellerLevel, string> = {
  new: "bg-gray-100 text-gray-600",
  rising: "bg-blue-100 text-blue-700",
  established: "bg-purple-100 text-purple-700",
  top: "bg-yellow-100 text-yellow-700",
  pro: "bg-gradient-to-r from-purple-primary to-pink-vivid text-white",
};

interface SellerRatingProps {
  sellerId: string;
  compact?: boolean;
}

export default function SellerRating({ sellerId, compact = false }: SellerRatingProps) {
  const { stats, loading } = useSellerStats(sellerId);

  if (loading) {
    return <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />;
  }

  if (!stats || stats.total_reviews === 0) {
    if (compact) return null;
    return (
      <span className="text-xs font-ui text-muted">New seller</span>
    );
  }

  const level = stats.seller_level as SellerLevel;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="text-yellow-400 text-sm">&#9733;</span>
        <span className="font-ui text-sm font-semibold text-ink">
          {stats.avg_rating.toFixed(1)}
        </span>
        <span className="text-xs text-muted">
          ({stats.total_reviews})
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Stars + rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <span
            key={star}
            className={`text-sm ${star <= Math.round(stats.avg_rating) ? "text-yellow-400" : "text-gray-300"}`}
          >
            &#9733;
          </span>
        ))}
        <span className="font-ui text-sm font-semibold text-ink ml-1">
          {stats.avg_rating.toFixed(1)}
        </span>
        <span className="text-xs text-muted">
          ({stats.total_reviews} review{stats.total_reviews !== 1 ? "s" : ""})
        </span>
      </div>

      {/* Level badge */}
      {level !== "new" && (
        <span className={`text-[10px] font-ui font-semibold px-2.5 py-1 rounded-full ${LEVEL_COLORS[level]}`}>
          {SELLER_LEVEL_LABELS[level]}
        </span>
      )}

      {/* Stats */}
      <span className="text-xs text-muted">
        {stats.completed_orders} orders &middot; {stats.completion_rate}% completion
      </span>
    </div>
  );
}
