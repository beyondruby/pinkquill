"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useToggleAdmire, useToggleSave, createNotification } from "@/lib/hooks";
import { useTrackPostImpression } from "@/lib/hooks/useTracking";
import {
  HeartIcon,
  CommentIcon,
  BookmarkIcon,
  PlayIcon,
} from "@/components/ui/Icons";
import { actionToast } from "@/lib/utils/toast";
import { stripHtml, getExcerpt } from "@/lib/utils/sanitize";
import { getPostTypeTheme } from "@/lib/feed-view/post-type-theme";
import type { PostProps } from "./PostCard/types";

// =============================================================================
// Shared interaction hook — keeps alternate cards lean. Heavy interactions
// (reactions, comments, share, full content) open the post modal on activate.
// Local state stays in sync with modal updates so a like-in-modal flows back
// to the card's heart icon.
// =============================================================================

function useCardActions(post: PostProps) {
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { openPostModal, subscribeToUpdates, notifyUpdate } = useModal();
  const { toggle: toggleAdmire } = useToggleAdmire();
  const { toggle: toggleSave } = useToggleSave();

  const [isAdmired, setIsAdmired] = useState(post.isAdmired || false);
  const [admireCount, setAdmireCount] = useState(post.stats?.admires ?? 0);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const commentCount = post.stats?.comments ?? 0;

  useTrackPostImpression(post.id, "feed");

  useEffect(() => {
    const unsub = subscribeToUpdates((update) => {
      if (update.postId !== post.id) return;
      if (update.field === "admires") {
        setIsAdmired(update.isActive);
        setAdmireCount((n) => Math.max(0, n + update.countChange));
      } else if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });
    return unsub;
  }, [post.id, subscribeToUpdates]);

  const onCardActivate = useCallback(() => {
    const mappedMentions = (post.mentions || [])
      .map((m) => m.user)
      .filter(
        (u): u is NonNullable<typeof u> => u !== null && u !== undefined
      );
    openPostModal({
      ...post,
      isAdmired,
      isSaved,
      stats: {
        admires: admireCount,
        comments: commentCount,
        relays: post.stats?.relays ?? 0,
      },
      mentions: mappedMentions,
      hashtags: post.hashtags || [],
      collaborators: post.collaborators || [],
    });
  }, [post, isAdmired, isSaved, admireCount, commentCount, openPostModal]);

  const onAdmire = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!user) {
        openAuthModal();
        return;
      }
      const next = !isAdmired;
      setIsAdmired(next);
      setAdmireCount((c) => Math.max(0, c + (next ? 1 : -1)));
      notifyUpdate({
        postId: post.id,
        field: "admires",
        isActive: next,
        countChange: next ? 1 : -1,
      });
      try {
        await toggleAdmire(post.id, user.id, isAdmired);
        if (next && post.authorId !== user.id) {
          await createNotification(post.authorId, user.id, "admire", post.id);
        }
      } catch {
        setIsAdmired(!next);
        setAdmireCount((c) => Math.max(0, c + (next ? -1 : 1)));
        actionToast.reactionError();
      }
    },
    [
      user,
      openAuthModal,
      isAdmired,
      post.id,
      post.authorId,
      notifyUpdate,
      toggleAdmire,
    ]
  );

  const onSave = useCallback(
    async (e: React.MouseEvent | React.KeyboardEvent) => {
      e.stopPropagation();
      if (!user) {
        openAuthModal();
        return;
      }
      const next = !isSaved;
      setIsSaved(next);
      notifyUpdate({
        postId: post.id,
        field: "saves",
        isActive: next,
        countChange: 0,
      });
      try {
        await toggleSave(post.id, user.id, isSaved);
        if (next) actionToast.postSaved();
        else actionToast.postUnsaved();
        if (next && post.authorId !== user.id) {
          await createNotification(post.authorId, user.id, "save", post.id);
        }
      } catch {
        setIsSaved(!next);
        actionToast.genericError("save post");
      }
    },
    [user, openAuthModal, isSaved, post.id, post.authorId, notifyUpdate, toggleSave]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onCardActivate();
      }
    },
    [onCardActivate]
  );

  return {
    isAdmired,
    admireCount,
    isSaved,
    commentCount,
    onCardActivate,
    onAdmire,
    onSave,
    onKeyDown,
  };
}

// =============================================================================
// Content helpers — strip the rich-text HTML that posts store so previews
// don't leak raw <p class="..."> markup. Falls back to a regex strip if the
// sanitize module's DOMPurify is unavailable (e.g. older test envs).
// =============================================================================

function safeStripHtml(content: string): string {
  if (!content) return "";
  try {
    return stripHtml(content);
  } catch {
    return content
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }
}

function preview(content: string, max: number): string {
  if (!content) return "";
  try {
    return getExcerpt(content, max);
  } catch {
    const text = safeStripHtml(content);
    return text.length <= max ? text : text.slice(0, max).trimEnd() + "…";
  }
}

function firstMedia(post: PostProps) {
  if (!post.media || post.media.length === 0) return null;
  return [...post.media].sort((a, b) => a.position - b.position)[0];
}

// =============================================================================
// Small primitives shared across views
// =============================================================================

function TypeBadge({ type, className = "" }: { type: PostProps["type"]; className?: string }) {
  const theme = getPostTypeTheme(type);
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border backdrop-blur-sm bg-surface/80 ${theme.tintBorder} ${theme.tintText} font-ui text-[0.65rem] uppercase tracking-wider ${className}`}
    >
      <span className="text-[0.8em] leading-none" aria-hidden="true">{theme.glyph}</span>
      {theme.label}
    </span>
  );
}

function StatsRow({
  isAdmired,
  admireCount,
  commentCount,
  isSaved,
  onAdmire,
  onSave,
  align = "between",
  size = "sm",
}: {
  isAdmired: boolean;
  admireCount: number;
  commentCount: number;
  isSaved: boolean;
  onAdmire: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  align?: "between" | "start";
  size?: "sm" | "xs";
}) {
  const textSize = size === "xs" ? "text-[0.7rem]" : "text-xs";
  return (
    <div
      className={`flex items-center gap-3 ${textSize} text-muted ${align === "between" ? "" : ""}`}
    >
      <button
        type="button"
        onClick={onAdmire}
        aria-label={isAdmired ? "Remove admire" : "Admire post"}
        aria-pressed={isAdmired}
        className={`inline-flex items-center gap-1 transition-colors ${isAdmired ? "text-pink-vivid" : "hover:text-pink-vivid"}`}
      >
        <HeartIcon size="sm" filled={isAdmired} />
        <span className="tabular-nums">{admireCount}</span>
      </button>
      <span className="inline-flex items-center gap-1">
        <CommentIcon size="sm" />
        <span className="tabular-nums">{commentCount}</span>
      </span>
      <button
        type="button"
        onClick={onSave}
        aria-label={isSaved ? "Remove save" : "Save post"}
        aria-pressed={isSaved}
        className={`inline-flex items-center gap-1 transition-colors ml-auto ${isSaved ? "text-accent" : "hover:text-accent"}`}
      >
        <BookmarkIcon size="sm" filled={isSaved} />
      </button>
    </div>
  );
}

// =============================================================================
// CompactPostCard — dense single-column row. Type-colored glyph on left,
// title + 2-line preview, small thumbnail on right.
// =============================================================================

export function CompactPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${theme.label} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group w-full flex items-stretch gap-3 p-3 rounded-2xl border border-border-light bg-surface hover:border-accent/40 hover:shadow-[0_8px_24px_rgba(15,15,15,0.06)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {/* Type rail */}
      <div
        className={`flex-shrink-0 w-9 self-stretch rounded-xl border ${theme.tintBorder} ${theme.tintBg} flex items-center justify-center`}
        aria-hidden="true"
      >
        <span className={`text-base ${theme.tintText} font-display leading-none`}>
          {theme.glyph}
        </span>
      </div>

      {/* Author + body */}
      <div className="flex-1 min-w-0 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs min-w-0">
          <Link
            href={`/studio/${post.author.handle.replace("@", "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            <div className="relative w-5 h-5 rounded-full overflow-hidden border border-border-light">
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                fill
                className="object-cover"
                sizes="20px"
                quality={80}
              />
            </div>
          </Link>
          <span className="font-ui font-semibold text-ink truncate">
            {post.author.name}
          </span>
          <span className={`uppercase tracking-wider font-ui text-[0.65rem] ${theme.tintText}`}>
            · {theme.label}
          </span>
          <span className="text-muted">·</span>
          <span className="text-muted whitespace-nowrap">{post.timeAgo}</span>
        </div>

        {post.title && (
          <h3 className={`text-[0.98rem] font-semibold text-ink leading-snug line-clamp-1 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-sm text-subdued leading-snug line-clamp-2 ${theme.bodyClass}`}>
          {cw ? (
            <span className="italic text-muted">
              Content warning · {post.contentWarning}
            </span>
          ) : (
            preview(post.content, 200)
          )}
        </p>

        <StatsRow
          isAdmired={actions.isAdmired}
          admireCount={actions.admireCount}
          commentCount={actions.commentCount}
          isSaved={actions.isSaved}
          onAdmire={actions.onAdmire}
          onSave={actions.onSave}
        />
      </div>

      {/* Thumbnail */}
      {media && !cw ? (
        <div className="flex-shrink-0 relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-skeleton">
          {media.media_type === "image" ? (
            <Image
              src={media.media_url}
              alt={media.caption || ""}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 80px, 96px"
              quality={75}
            />
          ) : (
            <>
              <video
                src={media.media_url}
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <PlayIcon size="sm" className="text-white drop-shadow" />
              </div>
            </>
          )}
        </div>
      ) : null}
    </article>
  );
}

// =============================================================================
// GridPostCard — square media-first tile. Each post type gets a different
// typography tile when there's no media (or when there's a content warning).
// =============================================================================

export function GridPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${theme.label} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group relative rounded-2xl overflow-hidden border border-border-light bg-surface hover:shadow-[0_18px_40px_rgba(15,15,15,0.12)] hover:border-accent/40 hover:-translate-y-0.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {showsMedia ? (
          <>
            {media!.media_type === "image" ? (
              <Image
                src={media!.media_url}
                alt={media!.caption || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                quality={80}
              />
            ) : (
              <>
                <video
                  src={media!.media_url}
                  muted
                  playsInline
                  preload="metadata"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                    <PlayIcon size="md" className="text-ink translate-x-[1px]" />
                  </div>
                </div>
              </>
            )}

            {/* Bottom gradient overlay for legibility */}
            <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 via-black/30 to-transparent pointer-events-none" />

            {/* Title over image */}
            {post.title && (
              <div className="absolute inset-x-0 bottom-0 p-3">
                <h3 className={`text-white text-base font-semibold leading-snug line-clamp-2 drop-shadow ${theme.titleClass}`}>
                  {post.title}
                </h3>
              </div>
            )}

            <TypeBadge type={post.type} className="absolute top-2 left-2" />
            <div className="absolute top-2 right-2 flex items-center gap-1.5">
              {extraMediaCount > 0 && (
                <div className="px-2 py-0.5 rounded-full bg-black/55 text-white text-[0.65rem] font-ui font-medium backdrop-blur-sm">
                  +{extraMediaCount}
                </div>
              )}
              <button
                type="button"
                onClick={actions.onSave}
                aria-label={actions.isSaved ? "Remove save" : "Save post"}
                aria-pressed={actions.isSaved}
                className={`w-8 h-8 rounded-full flex items-center justify-center bg-black/55 text-white backdrop-blur-sm transition-opacity ${
                  actions.isSaved
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus:opacity-100"
                }`}
              >
                <BookmarkIcon size="sm" filled={actions.isSaved} />
              </button>
            </div>
          </>
        ) : (
          // Typography tile — per-type personality
          <>
            <TypeArtTile post={post} />
            <button
              type="button"
              onClick={actions.onSave}
              aria-label={actions.isSaved ? "Remove save" : "Save post"}
              aria-pressed={actions.isSaved}
              className={`absolute top-2 right-2 w-8 h-8 rounded-full flex items-center justify-center bg-surface/90 border border-border-light text-ink transition-opacity ${
                actions.isSaved
                  ? "opacity-100"
                  : "opacity-0 group-hover:opacity-100 focus:opacity-100"
              }`}
            >
              <BookmarkIcon size="sm" filled={actions.isSaved} />
            </button>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center gap-2 border-t border-border-light/60">
        <Link
          href={`/studio/${post.author.handle.replace("@", "")}`}
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0"
          aria-label={`View ${post.author.name}'s studio`}
        >
          <div className="relative w-6 h-6 rounded-full overflow-hidden border border-border-light">
            <Image
              src={post.author.avatar}
              alt={post.author.name}
              fill
              className="object-cover"
              sizes="24px"
              quality={80}
            />
          </div>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="font-ui text-xs font-medium text-ink truncate">
            {post.author.name}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted">
          <button
            type="button"
            onClick={actions.onAdmire}
            aria-label={actions.isAdmired ? "Remove admire" : "Admire post"}
            aria-pressed={actions.isAdmired}
            className={`inline-flex items-center gap-0.5 transition-colors ${actions.isAdmired ? "text-pink-vivid" : "hover:text-pink-vivid"}`}
          >
            <HeartIcon size="sm" filled={actions.isAdmired} />
            <span className="tabular-nums">{actions.admireCount}</span>
          </button>
          <span className="inline-flex items-center gap-0.5">
            <CommentIcon size="sm" />
            <span className="tabular-nums">{actions.commentCount}</span>
          </span>
        </div>
      </div>
    </article>
  );
}

// =============================================================================
// TypeArtTile — per-post-type typography treatment for text-only / cw posts
// =============================================================================

function TypeArtTile({ post }: { post: PostProps }) {
  const theme = getPostTypeTheme(post.type);
  const cw = Boolean(post.contentWarning);
  const text = cw
    ? `Content warning · ${post.contentWarning}`
    : preview(post.content, 180);

  // Specialised treatments
  if (post.type === "quote") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-5 flex flex-col justify-center`}>
        <span
          className={`absolute top-1 left-3 text-[7rem] leading-none ${theme.tintText} font-display select-none opacity-60`}
          aria-hidden="true"
        >
          “
        </span>
        <p className={`relative text-ink text-base leading-snug line-clamp-6 ${theme.bodyClass} text-center`}>
          {text}
        </p>
      </div>
    );
  }

  if (post.type === "poem") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-5 flex flex-col items-center justify-center text-center`}>
        <span className={`block mb-2 text-xl ${theme.tintText}`} aria-hidden="true">{theme.glyph}</span>
        {post.title && (
          <h3 className={`text-base text-ink font-semibold leading-snug line-clamp-1 mb-1 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-[0.85rem] text-subdued leading-relaxed line-clamp-5 ${theme.bodyClass}`}>
          {text}
        </p>
      </div>
    );
  }

  if (post.type === "audio") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-4 flex flex-col items-center justify-center`}>
        <div className="flex items-end gap-1 h-10 mb-3" aria-hidden="true">
          {[6, 14, 22, 16, 28, 18, 24, 10, 18, 14].map((h, i) => (
            <span
              key={i}
              className="w-1 rounded-full bg-pink-vivid/70"
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        {post.title && (
          <h3 className={`text-base text-ink font-semibold leading-snug line-clamp-2 text-center mb-1 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <span className={`font-ui text-[0.7rem] uppercase tracking-wider ${theme.tintText}`}>
          Voice note
        </span>
      </div>
    );
  }

  if (post.type === "letter") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-5 flex flex-col`}>
        <span className={`font-ui text-[0.7rem] uppercase tracking-widest mb-2 ${theme.tintText}`}>
          {theme.glyph} A letter
        </span>
        {post.title && (
          <h3 className={`text-ink text-base font-semibold leading-snug line-clamp-1 mb-1 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-[0.85rem] text-subdued leading-relaxed line-clamp-6 ${theme.bodyClass}`}>
          {text}
        </p>
      </div>
    );
  }

  // Default typography tile (essay, blog, story, thought, journal, visual w/o media)
  return (
    <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-4 flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <span className={`font-ui text-[0.7rem] uppercase tracking-widest ${theme.tintText}`}>
          {theme.glyph} {theme.label}
        </span>
      </div>
      <div>
        {post.title && (
          <h3 className={`text-ink text-[1.05rem] font-semibold leading-snug line-clamp-3 mb-1.5 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-xs text-subdued leading-relaxed line-clamp-4 ${theme.bodyClass}`}>
          {text}
        </p>
      </div>
    </div>
  );
}

// =============================================================================
// MagazinePostCard — variable-height masonry card. Media at top (natural
// aspect), body with type chip + title + serif preview, footer with stats.
// =============================================================================

export function MagazinePostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;

  // Quote-special: oversized quote glyph as backdrop, no media even if present.
  if (post.type === "quote" && !showsMedia) {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={post.title || `Quote by ${post.author.name}`}
        onClick={actions.onCardActivate}
        onKeyDown={actions.onKeyDown}
        className={`group break-inside-avoid mb-4 rounded-2xl overflow-hidden border ${theme.tintBorder} ${theme.tintBg} hover:shadow-[0_14px_36px_rgba(15,15,15,0.1)] hover:-translate-y-0.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 relative`}
      >
        <span
          className={`absolute -top-6 left-2 text-[8rem] leading-none ${theme.tintText} font-display select-none opacity-50`}
          aria-hidden="true"
        >
          “
        </span>
        <div className="relative p-5 pt-12">
          <p className={`text-ink text-lg leading-snug ${theme.bodyClass} line-clamp-6 mb-4`}>
            {cw ? `Content warning · ${post.contentWarning}` : preview(post.content, 300)}
          </p>
          <MagazineFooter post={post} actions={actions} />
        </div>
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${theme.label} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group break-inside-avoid mb-4 rounded-2xl overflow-hidden border border-border-light bg-surface hover:shadow-[0_14px_36px_rgba(15,15,15,0.1)] hover:border-accent/40 hover:-translate-y-0.5 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
    >
      {showsMedia && (
        <div className="relative w-full overflow-hidden bg-skeleton">
          {media!.media_type === "image" ? (
            <Image
              src={media!.media_url}
              alt={media!.caption || ""}
              width={800}
              height={600}
              className="w-full h-auto object-cover transition-transform duration-500 group-hover:scale-[1.02]"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              quality={80}
            />
          ) : (
            <div className="relative aspect-video">
              <video
                src={media!.media_url}
                muted
                playsInline
                preload="metadata"
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-lg">
                  <PlayIcon size="md" className="text-ink translate-x-[1px]" />
                </div>
              </div>
            </div>
          )}
          <TypeBadge type={post.type} className="absolute top-2 left-2" />
          {extraMediaCount > 0 && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[0.65rem] font-ui font-medium backdrop-blur-sm">
              +{extraMediaCount}
            </div>
          )}
        </div>
      )}

      <div className="p-5">
        {!showsMedia && (
          <div className="mb-3">
            <TypeBadge type={post.type} />
          </div>
        )}

        {post.title && (
          <h3 className={`text-lg font-semibold text-ink leading-snug mb-2 line-clamp-2 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-sm text-subdued leading-relaxed line-clamp-5 ${theme.bodyClass}`}>
          {cw
            ? `Content warning · ${post.contentWarning}`
            : preview(post.content, 300)}
        </p>

        <div className="mt-4 pt-4 border-t border-border-light/70">
          <MagazineFooter post={post} actions={actions} />
        </div>
      </div>
    </article>
  );
}

function MagazineFooter({
  post,
  actions,
}: {
  post: PostProps;
  actions: ReturnType<typeof useCardActions>;
}) {
  return (
    <div className="flex items-center gap-3">
      <Link
        href={`/studio/${post.author.handle.replace("@", "")}`}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0"
        aria-label={`View ${post.author.name}'s studio`}
      >
        <div className="relative w-8 h-8 rounded-full overflow-hidden border border-border-light">
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            fill
            className="object-cover"
            sizes="32px"
            quality={80}
          />
        </div>
      </Link>
      <div className="flex-1 min-w-0 text-xs">
        <div className="font-ui font-semibold text-ink truncate">
          {post.author.name}
        </div>
        <div className="text-muted truncate">{post.timeAgo}</div>
      </div>
      <StatsRow
        isAdmired={actions.isAdmired}
        admireCount={actions.admireCount}
        commentCount={actions.commentCount}
        isSaved={actions.isSaved}
        onAdmire={actions.onAdmire}
        onSave={actions.onSave}
        size="xs"
      />
    </div>
  );
}
