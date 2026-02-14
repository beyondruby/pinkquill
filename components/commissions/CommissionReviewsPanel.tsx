"use client";

import { useMemo } from "react";
import { useCommissionReviews } from "@/lib/hooks/useReviews";
import type { ReviewRole } from "@/lib/types/store";
import ReviewCard from "@/components/reviews/ReviewCard";

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
      <div className="rounded-[30px] border border-purple-primary/15 bg-gradient-to-br from-white via-rose-50/25 to-violet-50/25 p-6 sm:p-8">
        <div className="h-6 w-44 rounded bg-pink-100/70 animate-pulse" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-28 rounded-2xl bg-purple-100/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[30px] border border-purple-primary/15 bg-gradient-to-br from-white via-rose-50/20 to-violet-50/20 p-6 sm:p-8">
      <div className="pointer-events-none absolute -top-16 -right-14 h-44 w-44 rounded-full bg-pink-vivid/10 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-20 -left-16 h-44 w-44 rounded-full bg-purple-primary/10 blur-2xl" />

      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5">
          <div>
            <p className="text-[10px] font-ui uppercase tracking-[0.2em] text-purple-primary/75">
              {role === "seller" ? "Delivery Reputation" : "Collaboration Reputation"}
            </p>
            <h3 className="font-display text-2xl text-ink mt-2">{roleTitle}</h3>
            <p className="text-sm font-body text-muted mt-1">
              Commission feedback from completed services only.
            </p>
          </div>

          <div className="rounded-2xl border border-pink-vivid/20 bg-white/90 px-4 py-3">
            <p className="text-xs font-ui uppercase tracking-wide text-pink-vivid">Quill Average</p>
            <p className="font-display text-2xl text-ink leading-none mt-1">
              {average > 0 ? `${average.toFixed(1)} / 5 ✒` : "No score yet"}
            </p>
            <p className="text-xs font-ui text-muted mt-1">
              {reviews.length} review{reviews.length === 1 ? "" : "s"}
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap gap-2">
          <span className="inline-flex items-center rounded-full border border-purple-primary/20 bg-white/80 px-3 py-1 text-[11px] font-ui text-purple-primary">
            {role === "seller" ? "Client to Creator" : "Creator to Client"}
          </span>
          <span className="inline-flex items-center rounded-full border border-pink-vivid/20 bg-pink-50/80 px-3 py-1 text-[11px] font-ui text-pink-vivid">
            Completed commissions only
          </span>
        </div>

        {error && <p className="text-sm font-body text-red-500 mb-4">{error}</p>}

        {!error && reviews.length === 0 && (
          <div className="rounded-2xl border border-purple-primary/15 bg-white/80 p-5">
            <p className="text-sm font-body text-muted">
              {isOwnProfile
                ? `You do not have any ${role === "seller" ? "seller" : "buyer"} reviews yet.`
                : "No commission reviews available yet."}
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
          <div className="pt-4 text-center">
            <button
              onClick={loadMore}
              className="inline-flex px-4 py-2 rounded-full border border-purple-primary/20 bg-white text-xs font-ui font-semibold text-purple-primary hover:border-pink-vivid/40 hover:text-pink-vivid transition-colors"
            >
              Load more reviews
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
