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
          className={`${iconSize} ${value <= score ? "" : "text-ink/15"}`}
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

  const productTitle = review.order?.product?.title;

  return (
    <article className="group relative rounded-2xl border border-border-light bg-surface p-5 sm:p-6 transition-colors hover:border-border-strong/50">
      {/* Faint quill watermark — a quiet brand flourish */}
      <QuillIcon
        className="pointer-events-none absolute right-5 top-5 h-9 w-9 text-ink/[0.04] transition-colors group-hover:text-pink-vivid/10"
        gradient={false}
      />

      {/* Header: identity + rating */}
      <header className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          {reviewer?.avatar_url ? (
            <Image
              src={reviewer.avatar_url}
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover ring-1 ring-border-light shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
              <span className="text-sm font-ui font-bold text-white">
                {displayName[0].toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            {reviewer ? (
              <Link
                href={`/studio/${reviewer.username}`}
                className="block font-ui text-sm font-semibold text-ink hover:text-pink-vivid transition-colors truncate"
              >
                {shortName}
              </Link>
            ) : (
              <span className="block font-ui text-sm font-semibold text-ink">Anonymous</span>
            )}
            <span className="text-[11px] font-body text-muted">{formattedDate}</span>
          </div>
        </div>

        <div className="flex flex-col items-end gap-1 shrink-0">
          <QuillMeter score={score} />
          <span className="text-[11px] font-ui font-medium text-pink-vivid">{QUILL_TONE[score]}</span>
        </div>
      </header>

      {/* Body */}
      <div className="mt-4">
        {review.title && (
          <h3 className="font-ui font-semibold text-sm text-ink mb-1.5">{review.title}</h3>
        )}
        <p className="font-body text-[14px] leading-relaxed text-ink/80 whitespace-pre-wrap">
          {review.content}
        </p>

        {/* Highlights */}
        {(review.highlights || []).length > 0 && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
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

      {/* Footer: what was reviewed */}
      {productTitle && (
        <footer className="mt-4 pt-3 border-t border-border-light">
          <span className="text-[11px] font-body text-muted truncate block">
            on <span className="text-ink/70">{productTitle}</span>
          </span>
        </footer>
      )}
    </article>
  );
}

export { QuillMeter, QUILL_TONE };
