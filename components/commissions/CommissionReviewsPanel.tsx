"use client";

import { useMemo } from "react";
import { useCommissionReviews } from "@/lib/hooks/useReviews";
import type { ReviewRole } from "@/lib/types/store";
import ReviewCard, { QuillMeter } from "@/components/reviews/ReviewCard";
import QuillIcon from "@/components/reviews/QuillIcon";

interface CommissionReviewsPanelProps {
  userId: string;
  role: ReviewRole;
  isOwnProfile: boolean;
}

export default function CommissionReviewsPanel({
  userId,
  role,
  isOwnProfile,
}: CommissionReviewsPanelProps) {
  const { reviews, loading, error, hasMore, loadMore } = useCommissionReviews(userId, role, 8);

  const average = useMemo(() => {
    if (reviews.length === 0) return 0;
    const total = reviews.reduce((sum, review) => sum + review.quill_score, 0);
    return Math.round((total / reviews.length) * 10) / 10;
  }, [reviews]);

  const roundedAverage = Math.max(1, Math.min(5, Math.round(average)));
  const roleTitle = role === "seller" ? "Reviews as Seller" : "Reviews as Buyer";

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl border border-border-light bg-surface p-5 sm:p-6 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-skeleton shrink-0" />
              <div className="space-y-2">
                <div className="h-3 w-28 rounded bg-skeleton" />
                <div className="h-2.5 w-20 rounded bg-skeleton" />
              </div>
            </div>
            <div className="mt-4 space-y-2 pl-5">
              <div className="h-3.5 w-full rounded bg-skeleton" />
              <div className="h-3.5 w-4/5 rounded bg-skeleton" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section>
      {/* Heading row — title left, calm aggregate right (no tone word on the average) */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <QuillIcon className="h-4 w-4" gradient />
          <h3 className="text-base font-ui uppercase tracking-[0.14em] text-muted">{roleTitle}</h3>
        </div>

        {reviews.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="font-display text-lg text-ink tabular-nums leading-none">
              {average.toFixed(1)}
            </span>
            <QuillMeter score={roundedAverage} />
            <span className="text-xs font-body text-muted">
              · {reviews.length} review{reviews.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-body text-muted">
          <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm3.78 5.22a.75.75 0 0 0-1.06 0L7 8.94 5.28 7.22a.75.75 0 0 0-1.06 1.06l2.25 2.25a.75.75 0 0 0 1.06 0l4.25-4.25a.75.75 0 0 0 0-1.06Z" />
          </svg>
          From completed commissions
        </p>
      )}

      {error && <p className="mt-5 text-sm font-body text-red-500">{error}</p>}

      {!error && reviews.length === 0 && (
        <div className="mt-5 rounded-2xl border border-border-light bg-subtle/40 px-6 py-10 text-center">
          <QuillIcon className="h-6 w-6 mx-auto mb-3 text-muted/30" />
          <p className="text-sm font-body text-muted">
            {isOwnProfile
              ? `No ${role === "seller" ? "seller" : "buyer"} reviews yet.`
              : "No commission reviews available yet."}
          </p>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="mt-6 space-y-4">
          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="mt-6 text-center">
          <button
            onClick={loadMore}
            className="inline-flex items-center gap-1.5 text-xs font-ui font-semibold text-pink-vivid hover:text-accent transition-colors"
          >
            Read more reviews
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      )}
    </section>
  );
}
