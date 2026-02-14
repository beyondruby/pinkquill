"use client";

import { useMemo } from "react";
import { useProductReviews } from "@/lib/hooks/useReviews";
import ReviewCard from "./ReviewCard";

interface ProductReviewsSectionProps {
  productId: string;
}

export default function ProductReviewsSection({ productId }: ProductReviewsSectionProps) {
  const { reviews, loading, error, hasMore, loadMore } = useProductReviews(productId, 6);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.quill_score, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  return (
    <section className="pt-8 border-t border-purple-primary/12">
      <div className="pb-3 border-b border-purple-primary/12">
        <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Quill Reviews</h2>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-ui text-pink-vivid">
            {average > 0 ? `🪶 ${average.toFixed(1)} / 5` : "No score yet"}
          </span>
          <span className="text-sm font-body text-muted">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="mt-1 text-sm font-body text-ink/80">Reviews from completed orders only.</p>
      </div>

      {loading && (
        <div className="mt-5 space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-purple-100/60 animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm font-body text-red-500">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <p className="mt-4 text-sm font-body text-muted">
          This product has no completed-order reviews yet.
        </p>
      )}

      {reviews.length > 0 && (
        <div className="mt-2">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-4">
          <button
            onClick={loadMore}
            className="inline-flex px-0 py-1 text-xs font-ui font-semibold text-purple-primary hover:text-pink-vivid transition-colors"
          >
            Load more reviews
          </button>
        </div>
      )}
    </section>
  );
}
