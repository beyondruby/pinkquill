"use client";

import React, { useMemo } from "react";
import { useCommissionReviews } from "@/lib/hooks/useReviews";
import type { ReviewRole } from "@/lib/types/store";
import ReviewCard from "@/components/reviews/ReviewCard";
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

  const roleTitle = role === "seller" ? "Reviews as Seller" : "Reviews as Buyer";

  if (loading) {
    return (
      <div className="py-2 space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-2xl bg-[#f5f5f5] p-6 sm:p-8 animate-pulse">
            <div className="flex items-start gap-5 sm:gap-8">
              <div className="shrink-0 flex flex-col items-center gap-2 w-16 sm:w-20">
                <div className="w-16 h-16 sm:w-[72px] sm:h-[72px] rounded-full bg-black/[0.06]" />
                <div className="h-3 w-12 rounded bg-black/[0.06]" />
              </div>
              <div className="flex-1 space-y-3">
                <div className="h-3 w-24 rounded bg-black/[0.06]" />
                <div className="h-4 w-full rounded bg-black/[0.06]" />
                <div className="h-4 w-3/4 rounded bg-black/[0.06]" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mb-6">
        <h3 className="font-display text-lg text-ink">{roleTitle}</h3>
        <span className="inline-flex items-center gap-1.5 text-sm font-ui">
          <QuillIcon className="h-4 w-4" gradient={average > 0} />
          <span className="font-semibold text-ink">{average > 0 ? average.toFixed(1) : "--"}</span>
          <span className="text-muted text-xs">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
        </span>
      </div>

      {error && <p className="text-sm font-body text-red-500">{error}</p>}

      {!error && reviews.length === 0 && (
        <div className="rounded-2xl bg-[#f5f5f5] p-8 text-center">
          <p className="text-sm font-body text-muted">
            {isOwnProfile
              ? `No ${role === "seller" ? "seller" : "buyer"} reviews yet.`
              : "No commission reviews available yet."}
          </p>
        </div>
      )}

      {reviews.length > 0 && (
        <div className="space-y-0">
          {reviews.map((review, index) => (
            <React.Fragment key={review.id}>
              <ReviewCard review={review} />
              {index < reviews.length - 1 && (
                <div className="py-3">
                  <div
                    className="h-[2px] rounded-full"
                    style={{ background: "linear-gradient(to right, #4F8BD9, #8B5CF6, #EC4899, #F97316, #F59E0B)" }}
                  />
                </div>
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="pt-2">
          <button
            onClick={loadMore}
            className="inline-flex px-0 py-1 text-xs font-ui font-semibold text-muted hover:text-ink transition-colors"
          >
            Load more reviews
          </button>
        </div>
      )}
    </section>
  );
}
