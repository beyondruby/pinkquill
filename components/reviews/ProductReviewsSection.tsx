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
    <section className="pt-8 border-t border-black/[0.08]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-ui uppercase tracking-[0.14em] text-muted">Quill Reviews</h2>
          <p className="mt-2 text-sm font-body text-ink/80">
            Reviews from completed orders only.
          </p>
        </div>
        <div className="rounded-2xl border border-pink-vivid/20 bg-pink-50 px-4 py-3">
          <p className="text-xs font-ui uppercase tracking-wide text-pink-vivid">Average</p>
          <p className="font-display text-2xl text-ink leading-none mt-1">
            {average > 0 ? `${average.toFixed(1)} / 5 ✒` : "No score yet"}
          </p>
          <p className="text-xs font-ui text-muted mt-1">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {loading && (
        <div className="mt-5 space-y-3">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
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
        <div className="mt-5 space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-4 text-center">
          <button
            onClick={loadMore}
            className="inline-flex px-4 py-2 rounded-full border border-black/[0.1] text-xs font-ui font-semibold text-ink hover:border-pink-vivid/30 hover:text-pink-vivid transition-colors"
          >
            Load more reviews
          </button>
        </div>
      )}
    </section>
  );
}
