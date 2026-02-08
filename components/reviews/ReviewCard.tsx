"use client";

import { useCallback, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useRespondToReview } from "@/lib/hooks/useReviews";
import type { Review } from "@/lib/types/store";

function Stars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const sizeClass = size === "md" ? "text-lg" : "text-sm";
  return (
    <span className={`${sizeClass} tracking-tight`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((star) => (
        <span key={star} className={star <= rating ? "text-yellow-400" : "text-gray-300"}>
          &#9733;
        </span>
      ))}
    </span>
  );
}

interface ReviewCardProps {
  review: Review;
  onResponseSubmitted?: () => void;
}

export default function ReviewCard({ review, onResponseSubmitted }: ReviewCardProps) {
  const { user } = useAuth();
  const { respond, responding, error: respondError } = useRespondToReview();
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseText, setResponseText] = useState("");

  const isReviewee = user?.id === review.reviewee_id;
  const canRespond = isReviewee && !review.seller_response && review.is_revealed;

  const handleRespond = useCallback(async () => {
    if (!responseText.trim()) return;
    const success = await respond(review.id, responseText.trim());
    if (success) {
      setShowResponseForm(false);
      onResponseSubmitted?.();
    }
  }, [review.id, responseText, respond, onResponseSubmitted]);

  // If review is not revealed and user is the reviewee, show placeholder
  if (!review.is_revealed && !isReviewee && user?.id !== review.reviewer_id) {
    return null;
  }

  const reviewer = review.reviewer;

  return (
    <div className="py-4 border-b border-black/[0.04] last:border-0">
      {/* Header */}
      <div className="flex items-start gap-3">
        {reviewer?.avatar_url ? (
          <Image src={reviewer.avatar_url} alt="" width={36} height={36} className="w-9 h-9 rounded-full" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
            <span className="text-xs font-ui font-bold text-white">
              {(reviewer?.display_name || reviewer?.username || "?")[0].toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {reviewer ? (
              <Link
                href={`/studio/${reviewer.username}`}
                className="font-ui text-sm font-semibold text-ink hover:underline"
              >
                {reviewer.display_name || reviewer.username}
              </Link>
            ) : (
              <span className="font-ui text-sm font-semibold text-ink">Anonymous</span>
            )}
            <Stars rating={review.rating} />
          </div>
          <p className="text-xs text-muted mt-0.5">
            {new Date(review.created_at).toLocaleDateString()}
            {review.order?.product?.title && (
              <> &middot; {review.order.product.title}</>
            )}
          </p>
        </div>
      </div>

      {/* Sub-ratings */}
      {(review.communication_rating || review.quality_rating || review.value_rating) && (
        <div className="flex gap-4 mt-2 ml-12 text-xs text-muted">
          {review.communication_rating && (
            <span>Communication: <Stars rating={review.communication_rating} /></span>
          )}
          {review.quality_rating && (
            <span>Quality: <Stars rating={review.quality_rating} /></span>
          )}
          {review.value_rating && (
            <span>Value: <Stars rating={review.value_rating} /></span>
          )}
        </div>
      )}

      {/* Content */}
      {review.content && (
        <p className="mt-2 ml-12 font-body text-sm text-ink/90 whitespace-pre-wrap">
          {review.content}
        </p>
      )}

      {/* Not revealed notice */}
      {!review.is_revealed && (
        <p className="mt-2 ml-12 text-xs text-muted italic">
          This review will be visible once the other party also submits their review (or after 14 days).
        </p>
      )}

      {/* Seller Response */}
      {review.seller_response && (
        <div className="mt-3 ml-12 bg-gray-50 rounded-xl p-3 border border-black/[0.04]">
          <p className="text-xs font-ui font-medium text-muted mb-1">Seller Response</p>
          <p className="font-body text-sm text-ink/90 whitespace-pre-wrap">{review.seller_response}</p>
          {review.seller_responded_at && (
            <p className="text-xs text-muted mt-1">
              {new Date(review.seller_responded_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Respond button */}
      {canRespond && !showResponseForm && (
        <button
          onClick={() => setShowResponseForm(true)}
          className="mt-2 ml-12 text-xs font-ui text-purple-primary hover:underline"
        >
          Respond to this review
        </button>
      )}

      {/* Response form */}
      {showResponseForm && (
        <div className="mt-3 ml-12 space-y-2">
          <textarea
            value={responseText}
            onChange={(e) => setResponseText(e.target.value)}
            placeholder="Write your response..."
            rows={3}
            maxLength={1000}
            className="w-full px-3 py-2 rounded-lg border border-black/[0.08] text-sm font-body text-ink placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-purple-primary/30"
          />
          {respondError && <p className="text-red-600 text-xs">{respondError}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleRespond}
              disabled={responding || !responseText.trim()}
              className="px-4 py-1.5 text-xs font-ui font-medium bg-purple-primary text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {responding ? "Sending..." : "Submit Response"}
            </button>
            <button
              onClick={() => setShowResponseForm(false)}
              className="px-4 py-1.5 text-xs font-ui text-muted hover:text-ink"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { Stars };
