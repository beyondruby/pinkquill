"use client";

// Per-type BODY FORM for the classic card. This is where a post type earns
// its identity ("type is form, not colour"): a poem keeps its line breaks in
// a serif, a quote is a pull-quote with attribution, a journal carries its
// date/mood strip, editorial types get a deck + reading time. Thoughts and
// media-led types fall through to the plain truncated body.

import { useMemo } from "react";
import { formatDate } from "@/lib/utils/time";
import { stripHtml, stripHtmlPreserveLines } from "@/lib/utils/sanitize";
import { getPostTypeTheme } from "@/lib/feed-view/post-type-theme";
import { weatherIcons, moodIcons } from "./journalIcons";
import { TruncatedContent } from "./TruncatedContent";
import type { PostProps } from "./types";

const POEM_MAX_LINES = 12;
const QUOTE_MAX_CHARS = 360;
const EDITORIAL_MAX_CHARS = 1200;
const JOURNAL_MAX_CHARS = 320;
const THOUGHT_STATEMENT_MAX_CHARS = 220;

/** Read an optional string field from the post's free-form metadata jsonb. */
export function getPostMetaString(post: Pick<PostProps, "metadata">, key: string): string | null {
  const meta = post.metadata as unknown as Record<string, unknown> | null | undefined;
  const value = meta?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Estimated reading time in whole minutes (200 wpm). */
export function readingMinutes(html: string): number {
  const words = stripHtml(html).split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function wordCount(html: string): number {
  return stripHtml(html).split(/\s+/).filter(Boolean).length;
}

function titleCase(value: string): string {
  return value
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

/** Date · location · weather · mood — the journal's "entry header". */
export function JournalStrip({ post, className = "" }: { post: PostProps; className?: string }) {
  const weather = post.metadata?.weather;
  const temperature = post.metadata?.temperature;
  const mood = post.metadata?.mood;
  return (
    <div className={`journal-date ${className}`}>
      {post.createdAt && <span>{formatDate(post.createdAt)}</span>}
      {post.post_location && (
        <span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
          {post.post_location}
        </span>
      )}
      {(weather || temperature) && (
        <span>
          {weather && weatherIcons[weather]}
          {temperature}
          {temperature && weather ? " · " : ""}
          {weather && titleCase(weather)}
        </span>
      )}
      {mood && (
        <span>
          {moodIcons[mood] ?? moodIcons.reflective}
          {titleCase(mood)}
        </span>
      )}
    </div>
  );
}

interface FormBodyProps {
  post: PostProps;
  onReadMore: () => void;
  /** Alignment / spacing / drop-cap classes derived from post.styling. */
  className?: string;
}

function ContinueReading({ onReadMore, className = "continue-reading-link" }: { onReadMore: () => void; className?: string }) {
  return (
    <button
      type="button"
      className={className}
      onClick={(e) => {
        e.stopPropagation();
        onReadMore();
      }}
    >
      Continue reading
      {className !== "continue-reading-link" && <span aria-hidden="true">→</span>}
    </button>
  );
}

/** Short thoughts read as a statement in the display serif; longer ones as prose. */
function ThoughtBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const plain = useMemo(() => stripHtml(post.content), [post.content]);
  if (!plain) return null;
  if (!post.title && plain.length <= THOUGHT_STATEMENT_MAX_CHARS) {
    return <p className={`thought-content ${className}`}>{plain}</p>;
  }
  return <TruncatedContent content={post.content} onReadMore={onReadMore} className={className} />;
}

function PoemBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const { shown, truncated } = useMemo(() => {
    const lines = stripHtmlPreserveLines(post.content).split("\n");
    const truncated = lines.length > POEM_MAX_LINES;
    return { shown: (truncated ? lines.slice(0, POEM_MAX_LINES) : lines).join("\n"), truncated };
  }, [post.content]);
  if (!shown) return null;
  return (
    <div className="truncated-content-wrapper">
      <p className={`poem-body ${className}`}>{shown}</p>
      {truncated && <ContinueReading onReadMore={onReadMore} />}
    </div>
  );
}

/** Dated entry: excerpt in the muted serif, then "Continue reading →". */
function JournalBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const { text, truncated } = useMemo(() => {
    const plain = stripHtml(post.content);
    const truncated = plain.length > JOURNAL_MAX_CHARS;
    return { text: truncated ? plain.slice(0, JOURNAL_MAX_CHARS).trimEnd() + "…" : plain, truncated };
  }, [post.content]);
  return (
    <>
      <JournalStrip post={post} />
      {text && <p className={`journal-excerpt ${className}`}>{text}</p>}
      {(truncated || text.length > 0) && <ContinueReading onReadMore={onReadMore} className="journal-read-more" />}
    </>
  );
}

/** Essay / blog / story / letter: paragraphs in a scrolling well that fades out. */
function LongformBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const { paragraphs, truncated } = useMemo(() => {
    const full = stripHtmlPreserveLines(post.content);
    const truncated = full.length > EDITORIAL_MAX_CHARS;
    const shown = truncated ? full.slice(0, EDITORIAL_MAX_CHARS).trimEnd() + "…" : full;
    const paragraphs = shown
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    return { paragraphs, truncated };
  }, [post.content]);
  if (paragraphs.length === 0) return null;
  return (
    <>
      <div className="longform-content longform-fade">
        <div className={`longform-text ${className}`}>
          {paragraphs.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      </div>
      {(truncated || paragraphs.length > 0) && <ContinueReading onReadMore={onReadMore} className="longform-read-more" />}
    </>
  );
}

function QuoteBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const attribution = getPostMetaString(post, "attribution");
  const { text, truncated } = useMemo(() => {
    const plain = stripHtml(post.content);
    const truncated = plain.length > QUOTE_MAX_CHARS;
    return { text: truncated ? plain.slice(0, QUOTE_MAX_CHARS).trimEnd() + "…" : plain, truncated };
  }, [post.content]);
  if (!text) return null;
  return (
    <figure className={`pq-form-quote ${className}`}>
      <span aria-hidden="true" className="pq-quote-mark">
        “
      </span>
      <blockquote className="pq-quote-text">{text}</blockquote>
      {attribution && <figcaption className="pq-quote-attr">— {attribution}</figcaption>}
      {truncated && <ContinueReading onReadMore={onReadMore} />}
    </figure>
  );
}

function EditorialBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const subtitle = getPostMetaString(post, "subtitle");
  const words = useMemo(() => wordCount(post.content), [post.content]);
  return (
    <>
      {subtitle && <p className="pq-form-deck">{subtitle}</p>}
      {words > 120 && <div className="pq-form-readtime">{readingMinutes(post.content)} min read</div>}
      <LongformBody post={post} onReadMore={onReadMore} className={className} />
    </>
  );
}

export function FormBody({ post, onReadMore, className = "" }: FormBodyProps) {
  const form = getPostTypeTheme(post.type).form;
  if (!post.content && form !== "journal") return null;

  switch (form) {
    case "poem":
      return <PoemBody post={post} onReadMore={onReadMore} className={className} />;
    case "quote":
      return <QuoteBody post={post} onReadMore={onReadMore} className={className} />;
    case "journal":
      return <JournalBody post={post} onReadMore={onReadMore} className={className} />;
    case "editorial":
      return <EditorialBody post={post} onReadMore={onReadMore} className={className} />;
    case "gallery":
      return <TruncatedContent content={post.content} maxChars={220} onReadMore={onReadMore} className={`carousel-description ${className}`} />;
    case "text":
      return <ThoughtBody post={post} onReadMore={onReadMore} className={className} />;
    default:
      return <TruncatedContent content={post.content} onReadMore={onReadMore} className={className} />;
  }
}

export default FormBody;
