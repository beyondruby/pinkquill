"use client";

import Image from "next/image";
import Link from "next/link";
import type { Review } from "@/lib/types/store";
import QuillIcon from "./QuillIcon";

const QUILL_TONE: Record<number, string> = {
  1: "Rough Draft",
  2: "Early Sketch",
  3: "Solid Work",
  4: "Polished Piece",
  5: "Masterpiece",
};

function QuillMeter({ score, size = "sm" }: { score: number; size?: "sm" | "md" }) {
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span className="inline-flex gap-0.5" aria-label={`${score} out of 5 quills`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <QuillIcon
          key={value}
          className={`${iconSize} ${value <= score ? "" : "text-black/10"}`}
          gradient={value <= score}
        />
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
  const displayName = reviewer?.display_name || reviewer?.username || "Anonymous";

  const parts = displayName.trim().split(/\s+/);
  const shortName =
    parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : displayName;

  const formattedDate = new Date(review.created_at)
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
    .replace(/\//g, ".");

  return (
    <article className="rounded-2xl bg-surface/60 border border-border-light p-5 sm:p-6 transition-colors hover:border-border-light">
      <div className="flex items-start gap-4">
        {/* Compact avatar + name */}
        <div className="shrink-0 flex flex-col items-center gap-1.5 w-12">
          {reviewer?.avatar_url ? (
            <Image
              src={reviewer.avatar_url}
              alt=""
              width={44}
              height={44}
              className="w-11 h-11 rounded-full object-cover"
            />
          ) : (
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
              <span className="text-sm font-ui font-bold text-white">
                {displayName[0].toUpperCase()}
              </span>
            </div>
          )}
          {reviewer ? (
            <Link
              href={`/studio/${reviewer.username}`}
              className="font-ui text-[11px] font-medium text-muted hover:text-pink-vivid transition-colors text-center leading-tight truncate max-w-[52px]"
            >
              {shortName}
            </Link>
          ) : (
            <span className="font-ui text-[11px] font-medium text-muted text-center leading-tight">
              Anon
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Score row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-2.5">
            <QuillMeter score={score} />
            <span className="text-xs font-ui font-medium text-pink-vivid">{QUILL_TONE[score]}</span>
            <span className="text-muted/30">&middot;</span>
            <span className="text-[11px] font-body text-muted">{formattedDate}</span>
            {review.order?.product?.title && (
              <>
                <span className="text-muted/30">&middot;</span>
                <span className="text-[11px] font-body text-muted truncate">{review.order.product.title}</span>
              </>
            )}
          </div>

          {/* Title */}
          {review.title && (
            <h3 className="font-ui font-semibold text-sm text-ink mb-1.5">{review.title}</h3>
          )}

          {/* Body */}
          <p className="font-body text-[14px] leading-relaxed text-ink/80 whitespace-pre-wrap">
            {review.content}
          </p>

          {/* Highlights */}
          {(review.highlights || []).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(review.highlights || []).map((highlight) => (
                <span
                  key={`${review.id}-${highlight}`}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-ui font-medium text-purple-primary/80 bg-purple-primary/[0.06]"
                >
                  {highlight}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export { QuillMeter };
