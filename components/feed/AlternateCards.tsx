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
      className={`inline-flex items-center px-2 py-1 rounded-md border bg-surface/90 backdrop-blur-md ${theme.tintBorder} ${theme.tintText} font-ui text-[0.64rem] font-semibold uppercase ${className}`}
    >
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
  size = "sm",
}: {
  isAdmired: boolean;
  admireCount: number;
  commentCount: number;
  isSaved: boolean;
  onAdmire: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  size?: "sm" | "xs";
}) {
  const textSize = size === "xs" ? "text-[0.68rem]" : "text-xs";
  return (
    <div className={`flex items-center gap-3 ${textSize} text-muted`}>
      <button
        type="button"
        onClick={onAdmire}
        aria-label={isAdmired ? "Remove admire" : "Admire post"}
        aria-pressed={isAdmired}
        className={`inline-flex items-center gap-1 transition-colors ${isAdmired ? "text-accent-2" : "hover:text-accent-2"}`}
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
// CompactPostCard — a dense manuscript row with restrained brand marks.
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
      className={`group w-full rounded-lg border bg-surface/95 ${theme.tintBorder} shadow-[0_1px_0_color-mix(in_oklab,var(--color-ink)_4%,transparent)] transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-px hover:shadow-[0_18px_38px_color-mix(in_oklab,var(--color-ink)_9%,transparent)]`}
    >
      <div className="flex items-stretch gap-3 p-3 sm:p-3.5">
        <div className="flex w-10 shrink-0 flex-col items-center gap-2 pt-0.5" aria-hidden="true">
          <span className={`grid h-8 w-8 place-items-center rounded-md border ${theme.tintBg} ${theme.tintBorder} ${theme.tintText} font-display text-base leading-none`}>
            {theme.glyph}
          </span>
          <span className={`h-full w-px ${theme.dotBg} opacity-30`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs min-w-0">
            <Link
              href={`/studio/${post.author.handle.replace("@", "")}`}
              onClick={(e) => e.stopPropagation()}
              className="flex-shrink-0"
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
            <span className="font-ui font-semibold text-ink truncate">
              {post.author.name}
            </span>
            <span className={`font-ui text-[0.64rem] uppercase ${theme.tintText}`}>
              {theme.label}
            </span>
            <span className="text-muted whitespace-nowrap">{post.timeAgo}</span>
          </div>

          <div className="mt-1.5 grid gap-1">
            {post.title && (
              <h3 className={`text-[1rem] font-semibold text-ink leading-snug line-clamp-1 ${theme.titleClass}`}>
                {post.title}
              </h3>
            )}
            <p className={`text-sm text-subdued leading-relaxed line-clamp-2 ${theme.bodyClass}`}>
              {cw ? (
                <span className="italic text-muted">
                  Content warning: {post.contentWarning}
                </span>
              ) : (
                preview(post.content, 220)
              )}
            </p>
          </div>

          <div className="mt-2.5">
            <StatsRow
              isAdmired={actions.isAdmired}
              admireCount={actions.admireCount}
              commentCount={actions.commentCount}
              isSaved={actions.isSaved}
              onAdmire={actions.onAdmire}
              onSave={actions.onSave}
            />
          </div>
        </div>

        {media && !cw ? (
          <div className="flex-shrink-0 relative w-20 h-24 sm:w-28 sm:h-28 rounded-lg overflow-hidden bg-skeleton">
            {media.media_type === "image" ? (
              <Image
                src={media.media_url}
                alt={media.caption || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                sizes="(max-width: 640px) 80px, 112px"
                quality={78}
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/28">
                  <div className="grid h-8 w-8 place-items-center rounded-md bg-surface/90 text-ink shadow-sm">
                    <PlayIcon size="sm" className="translate-x-[1px]" />
                  </div>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

const GRID_TILE_CLASSES = [
  "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4",
  "col-span-2 row-span-2 sm:col-span-3 lg:col-span-3",
  "col-span-2 row-span-1 sm:col-span-3 lg:col-span-3",
  "col-span-2 row-span-2 sm:col-span-3 lg:col-span-2",
  "col-span-2 row-span-1 sm:col-span-6 lg:col-span-4",
  "col-span-2 row-span-2 sm:col-span-3 lg:col-span-3",
];

const MAGAZINE_CARD_CLASSES = [
  "md:col-span-7",
  "md:col-span-5",
  "md:col-span-4",
  "md:col-span-4",
  "md:col-span-4",
  "md:col-span-6",
  "md:col-span-6",
];

// =============================================================================
// GridPostCard — a dense art-wall tile with editorial overlays.
// =============================================================================

export function GridPostCard({
  post,
  index = 0,
}: {
  post: PostProps;
  index?: number;
}) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;
  const tileClass = GRID_TILE_CLASSES[index % GRID_TILE_CLASSES.length];
  const headline = post.title || (cw ? `Content warning: ${post.contentWarning}` : preview(post.content, 120));

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${theme.label} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`group relative ${tileClass} rounded-lg overflow-hidden border border-border-light bg-surface cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_20px_48px_color-mix(in_oklab,var(--color-ink)_14%,transparent)]`}
    >
      <div className="absolute inset-0">
        {showsMedia ? (
          <>
            {media!.media_type === "image" ? (
              <Image
                src={media!.media_url}
                alt={media!.caption || ""}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                quality={82}
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
                <div className="absolute inset-0 flex items-center justify-center bg-black/24">
                  <div className="grid h-11 w-11 place-items-center rounded-md bg-surface/90 text-ink shadow-lg">
                    <PlayIcon size="md" className="translate-x-[1px]" />
                  </div>
                </div>
              </>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/76 via-black/22 to-black/8" />
          </>
        ) : (
          <TypeArtTile post={post} />
        )}
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-2.5">
        <TypeBadge type={post.type} />
        <div className="flex items-center gap-1.5">
          {extraMediaCount > 0 && (
            <span className="rounded-md border border-white/20 bg-black/45 px-2 py-1 font-ui text-[0.64rem] font-semibold text-white backdrop-blur-md">
              +{extraMediaCount}
            </span>
          )}
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className={`grid h-8 w-8 place-items-center rounded-md border backdrop-blur-md transition-opacity ${
              showsMedia
                ? "border-white/20 bg-black/45 text-white"
                : "border-border-light bg-surface/90 text-ink"
            } ${actions.isSaved ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"}`}
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        </div>
      </div>

      <div className={`absolute inset-x-0 bottom-0 p-3 ${showsMedia ? "text-white" : "text-ink"}`}>
        <h3 className={`text-base sm:text-lg font-semibold leading-tight line-clamp-2 ${theme.titleClass}`}>
          {headline}
        </h3>
        <div className={`mt-2 flex items-center gap-2 text-xs ${showsMedia ? "text-white/82" : "text-muted"}`}>
          <Link
            href={`/studio/${post.author.handle.replace("@", "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2 min-w-0"
            aria-label={`View ${post.author.name}'s studio`}
          >
            <div className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-white/25 bg-surface">
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                fill
                className="object-cover"
                sizes="24px"
                quality={80}
              />
            </div>
            <span className="truncate font-ui font-medium">{post.author.name}</span>
          </Link>
          <span className="ml-auto inline-flex items-center gap-2">
            <button
              type="button"
              onClick={actions.onAdmire}
              aria-label={actions.isAdmired ? "Remove admire" : "Admire post"}
              aria-pressed={actions.isAdmired}
              className={`inline-flex items-center gap-1 transition-colors ${actions.isAdmired ? "text-accent-2" : "hover:text-accent-2"}`}
            >
              <HeartIcon size="sm" filled={actions.isAdmired} />
              <span className="tabular-nums">{actions.admireCount}</span>
            </button>
            <span className="inline-flex items-center gap-1">
              <CommentIcon size="sm" />
              <span className="tabular-nums">{actions.commentCount}</span>
            </span>
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
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, 180);

  if (post.type === "quote") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-5 flex flex-col justify-center`}>
        <span
          className={`absolute -top-4 left-2 text-[7rem] leading-none ${theme.tintText} font-display select-none opacity-30`}
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
              className={`w-1 rounded-full ${theme.dotBg} opacity-75`}
              style={{ height: `${h}px` }}
            />
          ))}
        </div>
        {post.title && (
          <h3 className={`text-base text-ink font-semibold leading-snug line-clamp-2 text-center mb-1 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <span className={`font-ui text-[0.68rem] uppercase ${theme.tintText}`}>
          Voice note
        </span>
      </div>
    );
  }

  if (post.type === "letter") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-5 flex flex-col`}>
        <span className={`font-ui text-[0.68rem] uppercase mb-2 ${theme.tintText}`}>
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

  return (
    <div className={`absolute inset-0 ${theme.tintBg} border ${theme.tintBorder} p-4 flex flex-col justify-between`}>
      <div className="flex items-center justify-between">
        <span className={`font-ui text-[0.68rem] uppercase ${theme.tintText}`}>
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
// MagazinePostCard — editorial spread card with measured contrast.
// =============================================================================

export function MagazinePostCard({
  post,
  index = 0,
}: {
  post: PostProps;
  index?: number;
}) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;
  const cardClass = MAGAZINE_CARD_CLASSES[index % MAGAZINE_CARD_CLASSES.length];
  const isLead = index % MAGAZINE_CARD_CLASSES.length === 0;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${theme.label} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`group ${cardClass} overflow-hidden rounded-lg border border-border-light bg-surface/95 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_20px_46px_color-mix(in_oklab,var(--color-ink)_11%,transparent)]`}
    >
      {showsMedia ? (
        <div className={`relative w-full overflow-hidden bg-skeleton ${isLead ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
          {media!.media_type === "image" ? (
            <Image
              src={media!.media_url}
              alt={media!.caption || ""}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-[1.025]"
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={84}
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/24">
                <div className="grid h-12 w-12 place-items-center rounded-md bg-surface/90 text-ink shadow-lg">
                  <PlayIcon size="md" className="translate-x-[1px]" />
                </div>
              </div>
            </>
          )}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            <TypeBadge type={post.type} />
            {extraMediaCount > 0 && (
              <span className="rounded-md border border-white/20 bg-black/45 px-2 py-1 font-ui text-[0.64rem] font-semibold text-white backdrop-blur-md">
                +{extraMediaCount}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className={`relative min-h-52 overflow-hidden ${isLead ? "min-h-72" : ""}`}>
          <TypeArtTile post={post} />
        </div>
      )}

      <div className="p-4 sm:p-5">
        {!showsMedia && (
          <div className="mb-3">
            <TypeBadge type={post.type} />
          </div>
        )}
        {post.title && (
          <h3 className={`${isLead ? "text-2xl" : "text-xl"} font-semibold text-ink leading-tight mb-2 line-clamp-2 ${theme.titleClass}`}>
            {post.title}
          </h3>
        )}
        <p className={`text-sm text-subdued leading-relaxed ${isLead ? "line-clamp-6" : "line-clamp-4"} ${theme.bodyClass}`}>
          {cw
            ? `Content warning: ${post.contentWarning}`
            : preview(post.content, isLead ? 360 : 260)}
        </p>

        <div className="mt-4 border-t border-border-light/70 pt-4">
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
