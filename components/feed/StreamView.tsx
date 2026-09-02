"use client";

// =============================================================================
// STREAM — "catch up fast".
// One row per post, grouped by day. A row is the post's headline + who/what/
// when + counts. Activating a row expands it IN PLACE into the full classic
// card (so every action — reactions, relay, share, menu — is one tap away
// without leaving the list). For people who follow many creators and want
// to triage, not browse.
// =============================================================================

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import PostCard from "./PostCard";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import { PostTypeIcon } from "./PostTypeIcon";
import { HeartIcon, CommentIcon, PlayIcon } from "@/components/ui/Icons";
import { getPostTypeTheme } from "@/lib/feed-view/post-type-theme";
import { getExcerpt, stripHtmlPreserveLines } from "@/lib/utils/sanitize";
import { firstVisualMedia } from "./useTileActions";
import type { PostProps } from "./PostCard/types";
import type { Post } from "@/lib/types";

export interface FeedItem {
  original: Post;
  transformed: PostProps;
}

// ---------------------------------------------------------------------------
// Day grouping
// ---------------------------------------------------------------------------

function localDayKey(iso?: string): string {
  if (!iso) return "unknown";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "unknown";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayLabel(iso?: string): string {
  if (!iso) return "Earlier";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Earlier";
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

interface DayGroup {
  key: string;
  label: string;
  items: FeedItem[];
}

function groupByDay(items: FeedItem[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const item of items) {
    const key = localDayKey(item.transformed.createdAt);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, label: dayLabel(item.transformed.createdAt), items: [item] });
    }
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function StreamRow({
  post,
  expanded,
  onToggle,
  onPostDeleted,
}: {
  post: PostProps;
  expanded: boolean;
  onToggle: () => void;
  onPostDeleted?: (postId: string) => void;
}) {
  const theme = getPostTypeTheme(post.type);
  const cw = post.contentWarning;

  const { headline, excerpt } = useMemo(() => {
    if (cw) {
      return { headline: post.title || `Content warning: ${cw}`, excerpt: "" };
    }
    const lines = stripHtmlPreserveLines(post.content)
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (post.title) {
      return { headline: post.title, excerpt: getExcerpt(post.content, 120) };
    }
    const first = lines[0] || `${theme.label} by ${post.author.name}`;
    const rest = lines.slice(1).join(" ");
    return {
      headline: first.length > 140 ? first.slice(0, 140).trimEnd() + "…" : first,
      excerpt: rest.length > 120 ? rest.slice(0, 120).trimEnd() + "…" : rest,
    };
  }, [cw, post.content, post.title, post.author.name, theme.label]);

  const media = cw ? null : firstVisualMedia(post);
  const admires = post.stats?.reactions ?? post.stats?.admires ?? 0;
  const comments = post.stats?.comments ?? 0;
  const handle = post.author.handle.replace("@", "");

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onToggle();
      }
    },
    [onToggle]
  );

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${theme.label.toLowerCase()} by ${post.author.name}: ${headline}`}
        onClick={onToggle}
        onKeyDown={onKeyDown}
        className={`pq-stream-row ${expanded ? "is-open" : ""}`}
      >
        <Link
          href={`/studio/${handle}`}
          onClick={(e) => e.stopPropagation()}
          className="pq-stream-avatar"
          aria-label={`View ${post.author.name}'s studio`}
        >
          <Image src={post.author.avatar} alt="" fill className="object-cover" sizes="34px" quality={80} />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="pq-stream-headline">
            <PostTypeIcon type={post.type} className="w-3.5 h-3.5 shrink-0 text-muted" />
            <span className="truncate">{headline}</span>
          </div>
          <div className="pq-stream-meta">
            <span className="pq-stream-author">{post.author.name}</span>
            <span aria-hidden="true">·</span>
            <span>{theme.label}</span>
            <span aria-hidden="true">·</span>
            <span>{post.timeAgo}</span>
            {excerpt && (
              <>
                <span aria-hidden="true" className="hidden sm:inline">
                  —
                </span>
                <span className="pq-stream-excerpt hidden sm:inline">{excerpt}</span>
              </>
            )}
          </div>
        </div>

        {media && (
          <div className="pq-stream-thumb" aria-hidden="true">
            {media.media_type === "image" ? (
              <Image src={media.media_url} alt="" fill className="object-cover" sizes="48px" quality={60} />
            ) : (
              <>
                <video src={media.media_url} muted playsInline preload="metadata" className="absolute inset-0 h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-black/25 text-white">
                  <PlayIcon size="sm" />
                </span>
              </>
            )}
          </div>
        )}

        <div className="pq-stream-counts" aria-hidden="true">
          <span>
            <HeartIcon size="sm" />
            {admires}
          </span>
          <span>
            <CommentIcon size="sm" />
            {comments}
          </span>
        </div>

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`pq-stream-chevron ${expanded ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </div>

      {expanded && (
        <div className="pq-stream-expanded home-feed-modern">
          <PostCard post={post} onPostDeleted={onPostDeleted} disableRealtimeSubscriptions={true} />
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Feed
// ---------------------------------------------------------------------------

export function StreamFeed({
  items,
  onPostDeleted,
}: {
  items: FeedItem[];
  onPostDeleted?: (postId: string) => void;
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = useCallback((id: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const groups = useMemo(() => groupByDay(items), [items]);

  return (
    <div className="pq-stream">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2 className="pq-stream-day">
            <span>{group.label}</span>
          </h2>
          <ul className="pq-stream-list">
            {group.items.map(({ original, transformed }) => (
              <li key={original.id}>
                <ErrorBoundary
                  section={`StreamRow:${original.id}`}
                  fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
                >
                  <StreamRow
                    post={transformed}
                    expanded={open.has(original.id)}
                    onToggle={() => toggle(original.id)}
                    onPostDeleted={onPostDeleted}
                  />
                </ErrorBoundary>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default StreamFeed;
