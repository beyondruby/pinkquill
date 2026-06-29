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

function relativeTime(dateString: string): string {
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return "";

  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const day = 86400;

  if (seconds < day) return "today";
  if (seconds < day * 2) return "yesterday";
  if (seconds < day * 7) return `${Math.floor(seconds / day)} days ago`;
  if (seconds < day * 30) {
    const weeks = Math.floor(seconds / (day * 7));
    return `${weeks} week${weeks === 1 ? "" : "s"} ago`;
  }
  if (seconds < day * 365) {
    const months = Math.floor(seconds / (day * 30));
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }
  return new Date(dateString).toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

interface ReviewCardProps {
  review: Review;
  /** Show what the review was left on. Redundant on a single product's own page. */
  showProduct?: boolean;
}

export default function ReviewCard({ review, showProduct = true }: ReviewCardProps) {
  const reviewer = review.reviewer;
  const score = Math.max(1, Math.min(5, Math.round(review.quill_score || 0)));
  const displayName = reviewer?.display_name || reviewer?.username || "Anonymous";

  const parts = displayName.trim().split(/\s+/);
  const shortName =
    parts.length > 1
      ? `${parts[0]} ${parts[parts.length - 1][0]}.`
      : displayName;

  const highlights = review.highlights || [];
  const productTitle = review.order?.product?.title;

  return (
    <article className="group relative rounded-2xl border border-border-light bg-surface p-5 sm:p-6 transition-colors hover:border-border-strong/50">
      {/* Person — front and center */}
      <header className="flex items-center gap-3">
        {reviewer?.avatar_url ? (
          <Image
            src={reviewer.avatar_url}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover ring-1 ring-border-light shrink-0"
          />
        ) : (
          <div className="h-11 w-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shrink-0">
            <span className="text-base font-ui font-bold text-white">
              {displayName[0].toUpperCase()}
            </span>
          </div>
        )}
        <div className="min-w-0">
          {reviewer ? (
            <Link
              href={`/studio/${reviewer.username}`}
              className="block font-ui text-[15px] font-semibold text-ink hover:text-pink-vivid transition-colors truncate"
            >
              {shortName}
            </Link>
          ) : (
            <span className="block font-ui text-[15px] font-semibold text-ink">Anonymous</span>
          )}
          <span className="text-[11px] font-body text-muted">
            reviewed {relativeTime(review.created_at)}
            {showProduct && productTitle ? (
              <>
                {" · "}
                <span className="text-ink/55">{productTitle}</span>
              </>
            ) : null}
          </span>
        </div>
      </header>

      {/* The words — the hero of the card */}
      <blockquote className="relative mt-4 pl-5">
        <span
          aria-hidden="true"
          className="absolute -top-2 left-0 font-display text-3xl leading-none text-pink-vivid/25 select-none"
        >
          &ldquo;
        </span>
        {review.title && (
          <p className="font-ui font-semibold text-[15px] text-ink mb-1">{review.title}</p>
        )}
        <p className="font-body text-[15px] leading-relaxed text-ink/85 whitespace-pre-wrap">
          {review.content}
        </p>
      </blockquote>

      {/* Quiet footer — score + what they highlighted */}
      <footer className="mt-4 flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <span className="inline-flex items-center gap-1.5">
          <QuillMeter score={score} />
          <span className="text-[11px] font-ui font-medium text-pink-vivid">{QUILL_TONE[score]}</span>
        </span>

        {highlights.length > 0 && (
          <>
            <span className="text-muted/30" aria-hidden="true">&middot;</span>
            <div className="flex flex-wrap gap-1.5">
              {highlights.map((highlight) => (
                <span
                  key={`${review.id}-${highlight}`}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-ui font-medium text-purple-primary/80 bg-purple-primary/[0.06]"
                >
                  {highlight}
                </span>
              ))}
            </div>
          </>
        )}
      </footer>
    </article>
  );
}

export { QuillMeter, QUILL_TONE };
