"use client";

import { useSellerReviews } from "@/lib/hooks/useReviews";
import ReviewCard from "./ReviewCard";

interface ReviewsListProps {
  sellerId: string;
}

export default function ReviewsList({ sellerId }: ReviewsListProps) {
  const { reviews, loading, hasMore, loadMore } = useSellerReviews(sellerId);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-skeleton rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (reviews.length === 0) {
    return (
      <p className="text-sm font-body text-muted py-4">No reviews yet.</p>
    );
  }

  return (
    <div>
      {reviews.map((review) => (
        <ReviewCard key={review.id} review={review} />
      ))}
      {hasMore && (
        <div className="pt-4 text-center">
          <button
            onClick={loadMore}
            className="text-sm font-ui text-purple-primary hover:underline"
          >
            Load more reviews
          </button>
        </div>
      )}
    </div>
  );
}
