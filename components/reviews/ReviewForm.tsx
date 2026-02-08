"use client";

import { useCallback, useState } from "react";
import { useSubmitReview } from "@/lib/hooks/useReviews";

interface ReviewFormProps {
  orderId: string;
  onSubmitted: () => void;
}

function StarInput({
  label,
  value,
  onChange,
  required,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  const [hover, setHover] = useState(0);

  return (
    <div>
      <label className="block text-sm font-ui font-medium text-ink mb-1">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(star)}
            className="text-2xl transition-colors"
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          >
            <span className={star <= (hover || value) ? "text-yellow-400" : "text-gray-300"}>
              &#9733;
            </span>
          </button>
        ))}
        {value > 0 && (
          <span className="text-sm text-muted ml-2 self-center">{value}/5</span>
        )}
      </div>
    </div>
  );
}

export default function ReviewForm({ orderId, onSubmitted }: ReviewFormProps) {
  const { submitReview, submitting, error } = useSubmitReview();

  const [rating, setRating] = useState(0);
  const [communication, setCommunication] = useState(0);
  const [quality, setQuality] = useState(0);
  const [value, setValue] = useState(0);
  const [content, setContent] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (rating === 0) {
      setLocalError("Please select an overall rating.");
      return;
    }

    const reviewId = await submitReview({
      order_id: orderId,
      rating,
      communication_rating: communication || undefined,
      quality_rating: quality || undefined,
      value_rating: value || undefined,
      content: content.trim() || undefined,
    });

    if (reviewId) {
      onSubmitted();
    }
  }, [orderId, rating, communication, quality, value, content, submitReview, onSubmitted]);

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <StarInput label="Overall Rating" value={rating} onChange={setRating} required />

      <div className="grid grid-cols-3 gap-4">
        <StarInput label="Communication" value={communication} onChange={setCommunication} />
        <StarInput label="Quality" value={quality} onChange={setQuality} />
        <StarInput label="Value" value={value} onChange={setValue} />
      </div>

      <div>
        <label htmlFor="review-content" className="block text-sm font-ui font-medium text-ink mb-1">
          Your Review
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Share your experience..."
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 rounded-xl border border-black/[0.08] text-sm font-body text-ink placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-purple-primary/30"
        />
        <p className="text-xs text-muted mt-1">{content.length}/2000</p>
      </div>

      <p className="text-xs text-muted">
        Your review is blind &mdash; the other party won&apos;t see it until they also leave a review (or 14 days pass).
      </p>

      {displayError && (
        <p className="text-red-600 text-sm">{displayError}</p>
      )}

      <button
        type="submit"
        disabled={submitting || rating === 0}
        className="w-full py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </button>
    </form>
  );
}
