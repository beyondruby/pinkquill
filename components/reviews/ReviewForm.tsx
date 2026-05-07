"use client";

import { useCallback, useMemo, useState } from "react";
import { useSubmitReview } from "@/lib/hooks/useReviews";
import QuillIcon from "./QuillIcon";

interface ReviewFormProps {
  orderId: string;
  onSubmitted: () => void;
}

const HIGHLIGHT_OPTIONS = [
  "Creative Vision",
  "Communication",
  "Craftsmanship",
  "Speed",
  "Reliability",
  "Value",
] as const;

const QUILL_COPY: Record<number, string> = {
  1: "Rough Draft",
  2: "Early Sketch",
  3: "Solid Work",
  4: "Polished Piece",
  5: "Masterpiece",
};

function QuillInput({ value, onChange }: { value: number; onChange: (score: number) => void }) {
  const [hover, setHover] = useState(0);
  const active = hover || value;

  return (
    <div>
      <label className="block text-sm font-ui font-medium text-ink mb-2">
        Quill Score <span className="text-red-500">*</span>
      </label>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={score}
            type="button"
            onMouseEnter={() => setHover(score)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(score)}
            className={`w-9 h-9 rounded-full text-[15px] transition-colors ${
              score <= active
                ? "bg-pink-vivid/12 text-pink-vivid"
                : "text-purple-primary/35 hover:text-accent/70"
            }`}
            aria-label={`${score} quills`}
          >
            <QuillIcon className="h-4 w-4 mx-auto" gradient={score <= active} />
          </button>
        ))}
        <span className="text-sm font-ui text-ink/80 ml-2 min-w-[110px]">
          {value > 0 ? `${value}/5 · ${QUILL_COPY[value]}` : "Select a score"}
        </span>
      </div>
    </div>
  );
}

export default function ReviewForm({ orderId, onSubmitted }: ReviewFormProps) {
  const { submitReview, submitting, error } = useSubmitReview();

  const [quillScore, setQuillScore] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [highlights, setHighlights] = useState<string[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  const contentLength = useMemo(() => content.trim().length, [content]);

  const toggleHighlight = (value: string) => {
    setHighlights((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      if (prev.length >= 6) return prev;
      return [...prev, value];
    });
  };

  const handleSubmit = useCallback(async (event: React.FormEvent) => {
    event.preventDefault();
    setLocalError(null);

    if (quillScore === 0) {
      setLocalError("Pick a quill score before submitting.");
      return;
    }

    if (content.trim().length < 12) {
      setLocalError("Write at least 12 characters so your review is useful.");
      return;
    }

    const reviewId = await submitReview({
      order_id: orderId,
      quill_score: quillScore,
      title: title.trim() || undefined,
      content,
      highlights,
    });

    if (reviewId) {
      onSubmitted();
    }
  }, [quillScore, content, submitReview, orderId, title, highlights, onSubmitted]);

  const displayError = localError || error;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <QuillInput value={quillScore} onChange={setQuillScore} />

      <div>
        <label htmlFor="review-title" className="block text-sm font-ui font-medium text-ink mb-1">
          Short Title
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="A quick summary of your experience"
          maxLength={120}
          className="w-full px-4 py-3 rounded-xl border border-purple-primary/15 text-sm font-body text-ink placeholder-muted focus:outline-none focus:ring-2 focus:ring-pink-vivid/25"
        />
      </div>

      <div>
        <label htmlFor="review-content" className="block text-sm font-ui font-medium text-ink mb-1">
          Your Review
        </label>
        <textarea
          id="review-content"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Describe what was delivered, what stood out, and who this would be great for."
          rows={5}
          maxLength={3000}
          className="w-full px-4 py-3 rounded-xl border border-purple-primary/15 text-sm font-body text-ink placeholder-muted resize-none focus:outline-none focus:ring-2 focus:ring-pink-vivid/25"
        />
        <p className="text-xs text-muted mt-1">{contentLength}/3000 (minimum 12)</p>
      </div>

      <div>
        <p className="text-sm font-ui font-medium text-ink mb-2">Highlights</p>
        <div className="flex flex-wrap gap-2">
          {HIGHLIGHT_OPTIONS.map((option) => {
            const selected = highlights.includes(option);
            return (
              <button
                key={option}
                type="button"
                onClick={() => toggleHighlight(option)}
                className={`px-3 py-1.5 rounded-full text-xs font-ui border transition-colors ${
                  selected
                    ? "bg-pink-vivid/10 border-pink-vivid/30 text-pink-vivid"
                    : "bg-surface border-purple-primary/15 text-muted hover:text-ink"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {displayError && <p className="text-red-600 text-sm">{displayError}</p>}

      <button
        type="submit"
        disabled={submitting || quillScore === 0}
        className="w-full py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {submitting ? "Publishing..." : "Publish Review"}
      </button>
    </form>
  );
}
