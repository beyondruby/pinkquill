"use client";

import Image from "next/image";
import Link from "next/link";
import type { Review } from "@/lib/types/store";

const QUILL_TONE: Record<number, string> = {
  1: "Rough Draft",
  2: "Early Sketch",
  3: "Solid Work",
  4: "Polished Piece",
  5: "Masterpiece",
};
const REVIEW_ICON = "🪶";

function QuillMeter({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const iconSize = size === "md" ? "text-[15px]" : "text-[13px]";

  return (
    <span className={`inline-flex gap-1 ${iconSize}`} aria-label={`${score} out of 5 quills`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <span
          key={value}
          className={value <= score ? "text-pink-vivid" : "text-purple-primary/25"}
        >
          {REVIEW_ICON}
        </span>
      ))}
    </span>
  );
}

interface ReviewCardProps {
  review: Review;
}

export default function ReviewCard({ review }: ReviewCardProps) {
  const reviewer = review.reviewer;
  const score = Math.max(1, Math.min(5, Math.round(review.quill_score || 0)));

  return (
    <article className="py-4 border-b border-purple-primary/12 last:border-b-0">
      <div className="flex items-start gap-3">
        {reviewer?.avatar_url ? (
          <Image src={reviewer.avatar_url} alt="" width={40} height={40} className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
            <span className="text-xs font-ui font-bold text-white">
              {(reviewer?.display_name || reviewer?.username || "?")[0].toUpperCase()}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {reviewer ? (
              <Link
                href={`/studio/${reviewer.username}`}
                className="font-ui text-sm font-semibold text-ink hover:underline"
              >
                {reviewer.display_name || reviewer.username}
              </Link>
            ) : (
              <span className="font-ui text-sm font-semibold text-ink">Community Member</span>
            )}
            <span className="text-purple-primary/25">•</span>
            <QuillMeter score={score} />
            <span className="text-xs font-ui text-muted">
              {score}/5 {QUILL_TONE[score]}
            </span>
          </div>

          <p className="text-xs text-muted mt-1">
            {new Date(review.created_at).toLocaleDateString()}
            {review.order?.product?.title && (
              <> &middot; {review.order.product.title}</>
            )}
          </p>
        </div>
      </div>

      {review.title && (
        <h3 className="mt-3 font-ui font-semibold text-sm text-ink">{review.title}</h3>
      )}

      <p className="mt-2 font-body text-sm leading-relaxed text-ink/90 whitespace-pre-wrap">
        {review.content}
      </p>

      {(review.highlights || []).length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {(review.highlights || []).map((highlight) => (
            <span
              key={`${review.id}-${highlight}`}
              className="inline-flex items-center text-[11px] font-ui text-purple-primary/80"
            >
              #{highlight}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

export { QuillMeter };
