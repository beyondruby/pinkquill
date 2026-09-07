"use client";

// =============================================================================
// GALLERY — "browse by eye".
// A masonry wall. Media posts show at their natural aspect ratio; text posts
// become typographic cards whose FORM comes from the post type (a poem reads
// as a small print, a quote as a card, a thought as a statement). Balanced
// columns, no empty tiles. Save-first interaction; tapping a tile opens the
// full post. For inspiration seekers and visual browsers.
// =============================================================================

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import { PostTypeChip } from "./PostTypeChip";
import { HeartIcon, BookmarkIcon, PlayIcon } from "@/components/ui/Icons";
import { getPostTypeTheme, type PostForm } from "@/lib/feed-view/post-type-theme";
import { getExcerpt, stripHtml, stripHtmlPreserveLines } from "@/lib/utils/sanitize";
import { formatDate } from "@/lib/utils/time";
import { getPostMetaString, readingMinutes, wordCount } from "./PostCard/FormBody";
import { useTileActions, firstVisualMedia } from "./useTileActions";
import type { FeedItem } from "./StreamView";
import type { PostProps, MediaItem } from "./PostCard/types";

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function useColumnCount(): number {
  const [count, setCount] = useState(3);
  useEffect(() => {
    const queries = [window.matchMedia("(min-width: 1280px)"), window.matchMedia("(min-width: 640px)")];
    const update = () => setCount(queries[0].matches ? 4 : queries[1].matches ? 3 : 2);
    update();
    queries.forEach((q) => q.addEventListener("change", update));
    return () => queries.forEach((q) => q.removeEventListener("change", update));
  }, []);
  return count;
}

const RATIO_MIN = 0.62;
const RATIO_MAX = 1.5;
const clampRatio = (r: number) => Math.min(RATIO_MAX, Math.max(RATIO_MIN, r));

/** Rough tile height in column-width units, for balanced column assignment. */
function estimateHeight(post: PostProps): number {
  const media = firstVisualMedia(post);
  const art = !media && post.spotify_track?.albumArt;
  const form = getPostTypeTheme(post.type).form;
  let h = 0.32; // footer + paddings
  if (post.contentWarning) return h + 0.3;
  if (media) h += 1 / 0.8 + (post.title ? 0.16 : 0);
  else if (art) h += 1 + 0.2;
  else {
    const chars = stripHtml(post.content).length;
    if (form === "poem") {
      const lines = stripHtmlPreserveLines(post.content).split("\n").length;
      h += Math.min(lines, 8) * 0.085 + 0.2;
    } else {
      h += Math.min(chars, 420) / 420 * 0.7 + 0.18;
    }
    if (post.title) h += 0.16;
  }
  return h;
}

function distribute(items: FeedItem[], columns: number): FeedItem[][] {
  const cols: FeedItem[][] = Array.from({ length: columns }, () => []);
  const heights = new Array<number>(columns).fill(0);
  for (const item of items) {
    let target = 0;
    for (let i = 1; i < columns; i++) if (heights[i] < heights[target] - 0.01) target = i;
    cols[target].push(item);
    heights[target] += estimateHeight(item.transformed);
  }
  return cols;
}

// ---------------------------------------------------------------------------
// Tile pieces
// ---------------------------------------------------------------------------

function TileMedia({ media, post, extraCount }: { media: MediaItem; post: PostProps; extraCount: number }) {
  const [ratio, setRatio] = useState<number | null>(null);
  return (
    <div className="pq-tile-media" style={{ aspectRatio: String(clampRatio(ratio ?? 0.8)) }}>
      {media.media_type === "image" ? (
        <Image
          src={media.media_url}
          alt={media.caption || post.title || ""}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, (max-width: 1280px) 33vw, 25vw"
          quality={75}
          onLoad={(e) => {
            const img = e.currentTarget;
            if (img.naturalWidth && img.naturalHeight) setRatio(img.naturalWidth / img.naturalHeight);
          }}
        />
      ) : (
        <>
          <video
            src={media.media_url}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              if (v.videoWidth && v.videoHeight) setRatio(v.videoWidth / v.videoHeight);
            }}
          />
          <div className="pq-tile-play" aria-hidden="true">
            <span>
              <PlayIcon size="md" className="translate-x-[1px]" />
            </span>
          </div>
        </>
      )}
      <span className="pq-tile-chip">
        <PostTypeChip type={post.type} variant="caps" size="xs" className="text-white/95" />
      </span>
      {extraCount > 0 && <span className="pq-tile-more">+{extraCount}</span>}
    </div>
  );
}

function TileArt({ src, post }: { src: string; post: PostProps }) {
  return (
    <div className="pq-tile-media" style={{ aspectRatio: "1" }}>
      <Image src={src} alt={post.spotify_track?.album || post.title || ""} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" quality={75} />
      <span className="pq-tile-chip">
        <PostTypeChip type={post.type} variant="caps" size="xs" className="text-white/95" />
      </span>
    </div>
  );
}

function TileText({ post, form, hasMedia }: { post: PostProps; form: PostForm; hasMedia: boolean }) {
  if (post.contentWarning) {
    return <p className="pq-tile-cw">Content warning · {post.contentWarning}</p>;
  }

  // Media-led tile: the image speaks; keep a caption-sized title only.
  if (hasMedia) {
    if (post.title) return <h3 className="pq-tile-title line-clamp-2">{post.title}</h3>;
    if (form === "music" && post.spotify_track) {
      return (
        <p className="pq-tile-text line-clamp-2">
          {post.spotify_track.name} — {post.spotify_track.artist}
        </p>
      );
    }
    return null;
  }

  const plain = stripHtml(post.content);

  switch (form) {
    case "poem": {
      const lines = stripHtmlPreserveLines(post.content).split("\n");
      const shown = lines.slice(0, 8).join("\n");
      return (
        <>
          {post.title && <h3 className="pq-tile-title line-clamp-2">{post.title}</h3>}
          <p className="pq-tile-poem line-clamp-[8]">{shown}</p>
        </>
      );
    }
    case "quote": {
      const attribution = getPostMetaString(post, "attribution");
      return (
        <>
          <blockquote className="pq-tile-quote line-clamp-6">{plain}</blockquote>
          {attribution && <p className="pq-tile-attr">— {attribution}</p>}
        </>
      );
    }
    case "journal":
      return (
        <>
          {post.createdAt && <div className="pq-tile-date">{formatDate(post.createdAt)}</div>}
          {post.title && <h3 className="pq-tile-title line-clamp-2">{post.title}</h3>}
          {plain && <p className="pq-tile-serif line-clamp-6">{getExcerpt(post.content, 260)}</p>}
        </>
      );
    case "editorial": {
      const deck = getPostMetaString(post, "subtitle");
      const words = wordCount(post.content);
      return (
        <>
          {post.title && <h3 className="pq-tile-title line-clamp-3">{post.title}</h3>}
          {deck && <p className="pq-tile-deck line-clamp-2">{deck}</p>}
          {plain && <p className="pq-tile-serif line-clamp-4">{getExcerpt(post.content, 220)}</p>}
          {words > 120 && <div className="pq-tile-readtime">{readingMinutes(post.content)} min read</div>}
        </>
      );
    }
    case "music":
      return (
        <>
          {post.title && <h3 className="pq-tile-title line-clamp-2">{post.title}</h3>}
          {post.spotify_track && (
            <p className="pq-tile-text line-clamp-2">
              {post.spotify_track.name} — {post.spotify_track.artist}
            </p>
          )}
          {plain && <p className="pq-tile-text line-clamp-3">{getExcerpt(post.content, 160)}</p>}
        </>
      );
    default: {
      // Thought (and any media type that arrived without media).
      const micro = !post.title && plain.length > 0 && plain.length <= 140;
      if (micro) return <p className="pq-tile-statement">{plain}</p>;
      return (
        <>
          {post.title && <h3 className="pq-tile-title line-clamp-3">{post.title}</h3>}
          {plain && <p className="pq-tile-text line-clamp-5">{getExcerpt(post.content, 240)}</p>}
        </>
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Tile
// ---------------------------------------------------------------------------

function GalleryTile({ post }: { post: PostProps }) {
  const actions = useTileActions(post);
  const theme = getPostTypeTheme(post.type);
  const cw = Boolean(post.contentWarning);
  const media = cw ? null : firstVisualMedia(post);
  const art = !cw && !media ? post.spotify_track?.albumArt ?? null : null;
  const hasMedia = Boolean(media || art);
  const visualCount = (post.media || []).filter((m) => m.media_type !== "audio").length;
  const extraCount = Math.max(0, visualCount - 1);
  const handle = post.author.handle.replace("@", "");

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={`${theme.label} by ${post.author.name}${post.title ? `: ${post.title}` : ""}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="pq-tile group"
    >
      {media ? <TileMedia media={media} post={post} extraCount={extraCount} /> : art ? <TileArt src={art} post={post} /> : null}

      <div className="pq-tile-body">
        {!hasMedia && <PostTypeChip type={post.type} variant="caps" size="xs" />}
        <TileText post={post} form={theme.form} hasMedia={hasMedia} />
      </div>

      <footer className="pq-tile-foot">
        <Link
          href={`/studio/${handle}`}
          onClick={(e) => e.stopPropagation()}
          className="pq-tile-author"
          aria-label={`View ${post.author.name}'s studio`}
        >
          <span className="pq-tile-avatar">
            <Image src={post.author.avatar} alt="" fill className="object-cover" sizes="22px" quality={60} />
          </span>
          <strong>{post.author.name}</strong>
          <span aria-hidden="true">·</span>
          <span className="shrink-0">{post.timeAgo}</span>
        </Link>
        <div className="pq-tile-actions">
          <button
            type="button"
            onClick={actions.onAdmire}
            aria-label={actions.isAdmired ? "Remove admire" : "Admire post"}
            aria-pressed={actions.isAdmired}
          >
            <HeartIcon size="sm" filled={actions.isAdmired} />
            <span>{actions.admireCount}</span>
          </button>
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className="is-save"
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        </div>
      </footer>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export function GalleryFeed({ items }: { items: FeedItem[] }) {
  const columns = useColumnCount();
  const distributed = useMemo(() => distribute(items, columns), [items, columns]);

  return (
    <div className="pq-gallery" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {distributed.map((col, i) => (
        <div key={i} className="pq-gallery-col">
          {col.map(({ original, transformed }) => (
            <ErrorBoundary
              key={original.id}
              section={`GalleryTile:${original.id}`}
              fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
            >
              <GalleryTile post={transformed} />
            </ErrorBoundary>
          ))}
        </div>
      ))}
    </div>
  );
}

export default GalleryFeed;
