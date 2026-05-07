"use client";

import { useMemo } from "react";
import { useProductReviews } from "@/lib/hooks/useReviews";
import ReviewCard from "./ReviewCard";
import QuillIcon from "./QuillIcon";
import { QuillMeter } from "./ReviewCard";

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
    <section className="mt-10">
      {/* Header card */}
      <div className="relative rounded-2xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/[0.04] via-white to-pink-vivid/[0.04]" />
        <div className="absolute inset-0 border border-border-light rounded-2xl pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-36 h-36 rounded-full bg-pink-vivid/[0.05] blur-3xl pointer-events-none" />

        <div className="relative px-6 py-5 flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <QuillIcon className="h-4 w-4" gradient />
              <h2 className="font-display text-lg text-ink">Quill Reviews</h2>
            </div>
            <p className="text-xs font-body text-muted flex items-center gap-1.5">
              <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" /></svg>
              {reviews.length} verified review{reviews.length !== 1 ? "s" : ""} from completed orders
            </p>
          </div>

          {average > 0 && (
            <div className="flex flex-col items-center gap-1.5 shrink-0">
              <span className="font-display text-2xl font-bold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent leading-none">
                {average.toFixed(1)}
              </span>
              <QuillMeter score={Math.round(average)} size="sm" />
            </div>
          )}
        </div>
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="rounded-2xl border border-border-light bg-surface/60 p-5 sm:p-6 animate-pulse">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-skeleton shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="h-3 w-32 rounded bg-skeleton" />
                  <div className="h-4 w-full rounded bg-skeleton" />
                  <div className="h-4 w-3/4 rounded bg-skeleton" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-4 text-sm font-body text-red-500">{error}</p>}

      {!loading && !error && reviews.length === 0 && (
        <div className="rounded-2xl border border-border-light bg-surface/60 p-8 text-center">
          <QuillIcon className="h-6 w-6 mx-auto mb-3 text-muted/30" />
          <p className="text-sm font-body text-muted">
            No reviews yet. Reviews appear after orders are completed.
          </p>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-5 text-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-xs font-ui font-semibold text-pink-vivid bg-pink-vivid/[0.06] hover:bg-pink-vivid/10 transition-colors"
          >
            Load more reviews
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
