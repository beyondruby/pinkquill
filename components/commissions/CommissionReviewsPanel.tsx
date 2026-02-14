"use client";

import { useMemo } from "react";
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
      <div className="py-2">
        <div className="h-6 w-44 rounded bg-pink-100/70 animate-pulse" />
        <div className="mt-4 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-20 rounded-xl bg-purple-100/60 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section>
      <div className="pb-3 border-b border-purple-primary/12">
        <p className="text-[10px] font-ui uppercase tracking-[0.2em] text-purple-primary/75">
          {role === "seller" ? "Delivery Reputation" : "Collaboration Reputation"}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <h3 className="font-display text-2xl text-ink">{roleTitle}</h3>
          <span className="text-purple-primary/30">•</span>
          <span className="inline-flex items-center gap-1.5 text-sm font-ui text-pink-vivid">
            <QuillIcon className="h-3.5 w-3.5" gradient={average > 0} />
            {average > 0 ? `${average.toFixed(1)} / 5` : "No score yet"}
          </span>
          <span className="text-sm font-body text-muted">
            {reviews.length} review{reviews.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="text-sm font-body text-muted mt-1">
          {role === "seller" ? "Client to creator feedback" : "Creator to client feedback"} from completed commissions.
        </p>
      </div>

      {error && <p className="text-sm font-body text-red-500 mt-4">{error}</p>}

      {!error && reviews.length === 0 && (
        <p className="text-sm font-body text-muted mt-4">
          {isOwnProfile
            ? `You do not have any ${role === "seller" ? "seller" : "buyer"} reviews yet.`
            : "No commission reviews available yet."}
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
