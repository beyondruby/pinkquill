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
import type { PostProps, PostType } from "./PostCard/types";

// =============================================================================
// Shared interaction hook — keeps alternate cards lean. Heavy interactions
// (reactions, comments, share, full content) open the post modal on activate.
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
      .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined);
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
    [user, openAuthModal, isAdmired, post.id, post.authorId, notifyUpdate, toggleAdmire]
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
// Content helpers
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

// Type-specific editorial section label. Pure typography, no glyphs.
function getTypeMark(type: PostType): string {
  switch (type) {
    case "poem": return "Verse";
    case "quote": return "Quotation";
    case "journal": return "Journal entry";
    case "thought": return "A thought";
    case "essay": return "Essay";
    case "blog": return "Blog post";
    case "story": return "Short story";
    case "letter": return "A letter";
    case "audio": return "Voice note";
    case "video": return "Reel";
    case "visual": return "Visual";
  }
}

// Per-type bento spans for the 12-column grid view. Visual/video posts go
// wide when they have media; quote/poem prefer tall narrow columns; thought
// stays petite; long-form sits comfortable.
function getGridSpan(post: PostProps): string {
  const hasMedia =
    post.media && post.media.length > 0 && !post.contentWarning;
  switch (post.type) {
    case "visual":
    case "video":
      return hasMedia
        ? "col-span-2 row-span-2 sm:col-span-4 sm:row-span-2 lg:col-span-6 lg:row-span-3"
        : "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2";
    case "audio":
      return "col-span-2 row-span-1 sm:col-span-3 lg:col-span-4 lg:row-span-1";
    case "thought":
      return "col-span-2 row-span-1 sm:col-span-2 lg:col-span-3 lg:row-span-1";
    case "poem":
      return "col-span-2 row-span-2 sm:col-span-2 lg:col-span-3 lg:row-span-3";
    case "quote":
      return "col-span-2 row-span-2 sm:col-span-3 lg:col-span-3 lg:row-span-2";
    case "letter":
      return "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2";
    case "journal":
      return "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2";
    case "essay":
      return "col-span-2 row-span-2 sm:col-span-4 lg:col-span-5 lg:row-span-2";
    case "blog":
      return "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2";
    case "story":
      return "col-span-2 row-span-2 sm:col-span-3 lg:col-span-4 lg:row-span-2";
  }
}

// Per-type magazine col-spans.
function getMagazineSpan(post: PostProps): string {
  const hasMedia =
    post.media && post.media.length > 0 && !post.contentWarning;
  switch (post.type) {
    case "visual":
    case "video":
      return hasMedia ? "md:col-span-8" : "md:col-span-6";
    case "audio":
      return "md:col-span-8";
    case "thought":
      return "md:col-span-4";
    case "poem":
      return "md:col-span-4";
    case "quote":
      return "md:col-span-5";
    case "letter":
      return "md:col-span-5";
    case "journal":
      return "md:col-span-6";
    case "essay":
      return "md:col-span-7";
    case "blog":
      return "md:col-span-6";
    case "story":
      return "md:col-span-6";
  }
}

// =============================================================================
// Shared primitives
// =============================================================================

function TypeMark({ type, dark = false }: { type: PostType; dark?: boolean }) {
  const theme = getPostTypeTheme(type);
  return (
    <span
      className={`font-ui text-[0.62rem] font-semibold uppercase tracking-[0.22em] ${
        dark ? "text-white/85" : theme.tintText
      }`}
    >
      {getTypeMark(type)}
    </span>
  );
}

function AuthorLine({
  post,
  dark = false,
  showType = false,
}: {
  post: PostProps;
  dark?: boolean;
  showType?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 text-xs min-w-0 ${
        dark ? "text-white/82" : "text-muted"
      }`}
    >
      <Link
        href={`/studio/${post.author.handle.replace("@", "")}`}
        onClick={(e) => e.stopPropagation()}
        className="flex items-center gap-2 min-w-0"
        aria-label={`View ${post.author.name}'s studio`}
      >
        <div
          className={`relative h-6 w-6 shrink-0 overflow-hidden rounded-full border ${
            dark ? "border-white/30" : "border-border-light"
          } bg-surface`}
        >
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            fill
            className="object-cover"
            sizes="24px"
            quality={80}
          />
        </div>
        <span className={`truncate font-ui font-medium ${dark ? "text-white" : "text-ink"}`}>
          {post.author.name}
        </span>
      </Link>
      <span className={dark ? "text-white/60" : "text-muted"}>·</span>
      <span className="truncate">{post.timeAgo}</span>
      {showType && (
        <>
          <span className={dark ? "text-white/60" : "text-muted"}>·</span>
          <TypeMark type={post.type} dark={dark} />
        </>
      )}
    </div>
  );
}

function StatsRow({
  isAdmired,
  admireCount,
  commentCount,
  isSaved,
  onAdmire,
  onSave,
  dark = false,
}: {
  isAdmired: boolean;
  admireCount: number;
  commentCount: number;
  isSaved: boolean;
  onAdmire: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  dark?: boolean;
}) {
  const baseColor = dark ? "text-white/82" : "text-muted";
  const hoverColor = dark ? "hover:text-white" : "hover:text-accent-2";
  return (
    <div className={`flex items-center gap-3 text-xs ${baseColor}`}>
      <button
        type="button"
        onClick={onAdmire}
        aria-label={isAdmired ? "Remove admire" : "Admire post"}
        aria-pressed={isAdmired}
        className={`inline-flex items-center gap-1 transition-colors ${isAdmired ? "text-accent-2" : hoverColor}`}
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
        className={`inline-flex items-center gap-1 transition-colors ml-auto ${
          isSaved ? "text-accent" : dark ? "hover:text-white" : "hover:text-accent"
        }`}
      >
        <BookmarkIcon size="sm" filled={isSaved} />
      </button>
    </div>
  );
}

// =============================================================================
// COMPACT VIEW — per-type editorial row, no decorative glyphs.
// =============================================================================

export function CompactPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);

  // Per-type body treatment
  const isCentered = post.type === "poem" || post.type === "quote";
  const titleSpec = post.type === "poem" || post.type === "story" || post.type === "letter" || post.type === "quote";

  const bodyMax = post.type === "thought" || post.type === "quote" ? 240 : 200;
  const bodyText = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, bodyMax);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${getTypeMark(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`group relative w-full overflow-hidden rounded-2xl border ${theme.tintBorder} ${theme.tintBg} cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-px hover:shadow-[0_18px_38px_color-mix(in_oklab,var(--color-ink)_8%,transparent)]`}
    >
      <div className="grid grid-cols-[1fr_auto] gap-5 p-4 sm:p-5">
        <div className="min-w-0 flex flex-col gap-2.5">
          <div className="flex items-center gap-3 min-w-0">
            <TypeMark type={post.type} />
            <span className="h-px flex-1 max-w-16 bg-current opacity-20" aria-hidden="true" />
          </div>

          <div className={`min-w-0 ${isCentered ? "text-center mx-auto max-w-prose" : ""}`}>
            {post.title && (
              <h3
                className={`text-ink leading-snug line-clamp-2 ${
                  titleSpec
                    ? "font-display italic text-[1.1rem]"
                    : "font-display font-semibold text-[1.05rem]"
                }`}
              >
                {post.title}
              </h3>
            )}
            <p
              className={`mt-1 text-subdued leading-relaxed line-clamp-2 ${
                post.type === "essay" || post.type === "blog"
                  ? "font-body text-[0.92rem]"
                  : post.type === "poem" || post.type === "quote" || post.type === "letter" || post.type === "story"
                    ? "font-display italic text-[0.92rem]"
                    : "font-body text-[0.9rem]"
              }`}
            >
              {post.type === "essay" && !cw && bodyText.length > 0 ? (
                <>
                  <span className={`float-left mr-2 mt-1 font-display text-[2.2rem] leading-[0.8] ${theme.tintText}`}>
                    {bodyText.charAt(0)}
                  </span>
                  {bodyText.slice(1)}
                </>
              ) : post.type === "quote" && !cw ? (
                <>“{bodyText}”</>
              ) : (
                bodyText
              )}
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 pt-1">
            <AuthorLine post={post} />
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
          <div className="relative w-24 h-24 sm:w-32 sm:h-32 shrink-0 overflow-hidden rounded-xl bg-skeleton">
            {media.media_type === "image" ? (
              <Image
                src={media.media_url}
                alt={media.caption || ""}
                fill
                className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                sizes="(max-width: 640px) 96px, 128px"
                quality={80}
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
                  <span className="rounded-full bg-surface/90 px-2.5 py-0.5 font-ui text-[0.62rem] font-semibold uppercase tracking-[0.2em] text-ink">
                    Watch
                  </span>
                </div>
              </>
            )}
          </div>
        ) : null}
      </div>
    </article>
  );
}

// =============================================================================
// GRID VIEW — bento mosaic. Per-type spans, per-type editorial treatments.
// =============================================================================

export function GridPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;
  const span = getGridSpan(post);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${getTypeMark(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`group relative ${span} overflow-hidden rounded-2xl border ${
        showsMedia ? "border-border-light bg-surface" : `${theme.tintBorder}`
      } cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_12%,transparent)]`}
    >
      {showsMedia ? (
        <GridMediaTile
          post={post}
          theme={theme}
          media={media!}
          extraMediaCount={extraMediaCount}
          actions={actions}
        />
      ) : (
        <GridTextTile post={post} actions={actions} />
      )}
    </article>
  );
}

function GridMediaTile({
  post,
  media,
  extraMediaCount,
  actions,
}: {
  post: PostProps;
  theme: ReturnType<typeof getPostTypeTheme>;
  media: NonNullable<ReturnType<typeof firstMedia>>;
  extraMediaCount: number;
  actions: ReturnType<typeof useCardActions>;
}) {
  return (
    <>
      <div className="absolute inset-0">
        {media.media_type === "image" ? (
          <Image
            src={media.media_url}
            alt={media.caption || ""}
            fill
            className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            quality={82}
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
              <div className="grid h-12 w-12 place-items-center rounded-full bg-surface/95 text-ink shadow-lg">
                <PlayIcon size="md" className="translate-x-[1px]" />
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/30 to-transparent" />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <div className="rounded-md bg-black/45 px-2 py-1 backdrop-blur-md">
          <TypeMark type={post.type} dark />
        </div>
        <div className="flex items-center gap-1.5">
          {extraMediaCount > 0 && (
            <span className="rounded-md border border-white/25 bg-black/45 px-2 py-1 font-ui text-[0.62rem] font-semibold text-white backdrop-blur-md">
              +{extraMediaCount}
            </span>
          )}
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className={`grid h-8 w-8 place-items-center rounded-full border border-white/25 bg-black/45 text-white backdrop-blur-md transition-opacity ${
              actions.isSaved ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100"
            }`}
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        {post.title && (
          <h3 className="font-display text-base sm:text-lg font-semibold leading-tight line-clamp-2 drop-shadow-sm mb-2">
            {post.title}
          </h3>
        )}
        <div className="flex items-center justify-between gap-3">
          <AuthorLine post={post} dark />
          <StatsRow
            isAdmired={actions.isAdmired}
            admireCount={actions.admireCount}
            commentCount={actions.commentCount}
            isSaved={actions.isSaved}
            onAdmire={actions.onAdmire}
            onSave={actions.onSave}
            dark
          />
        </div>
      </div>
    </>
  );
}

// Per-type editorial typography for text-only grid tiles.
function GridTextTile({
  post,
  actions,
}: {
  post: PostProps;
  actions: ReturnType<typeof useCardActions>;
}) {
  const theme = getPostTypeTheme(post.type);
  const cw = Boolean(post.contentWarning);
  const body = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, post.type === "thought" ? 220 : 260);

  // QUOTE — oversized opening quote watermark, italic centered body, attribution
  if (post.type === "quote") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
        <span
          className={`pointer-events-none absolute -top-3 left-3 font-display select-none ${theme.tintText} opacity-30`}
          style={{ fontSize: "9rem", lineHeight: 1 }}
          aria-hidden="true"
        >
          “
        </span>
        <div className="relative flex-1 flex items-center justify-center text-center">
          <p className="font-display italic text-ink text-[1.05rem] leading-snug line-clamp-6 px-3">
            {body}
          </p>
        </div>
        <div className="relative flex items-center justify-between gap-3 pt-3 border-t border-current/10">
          <AuthorLine post={post} />
          <StatsRow {...actions} onAdmire={actions.onAdmire} onSave={actions.onSave} />
        </div>
      </div>
    );
  }

  // POEM — centered italic verse, type mark at top, hairline divider
  if (post.type === "poem") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col items-center text-center`}>
        <div className="flex flex-col items-center gap-2 mb-3">
          <TypeMark type="poem" />
          <span className={`h-px w-8 bg-current opacity-30 ${theme.tintText}`} aria-hidden="true" />
        </div>
        {post.title && (
          <h3 className="font-display italic text-ink text-lg font-semibold leading-snug line-clamp-2 mb-2">
            {post.title}
          </h3>
        )}
        <p className="font-display italic text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
          {body}
        </p>
        <div className="mt-3 w-full">
          <AuthorLine post={post} />
        </div>
      </div>
    );
  }

  // THOUGHT — tiny but expressive, no title needed, body as a single
  // typographic statement
  if (post.type === "thought") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-4 flex flex-col justify-between`}>
        <TypeMark type="thought" />
        <p className="font-display text-ink text-[1.05rem] leading-snug line-clamp-3">
          {body}
        </p>
        <AuthorLine post={post} />
      </div>
    );
  }

  // AUDIO — voice-note card with a thin gradient bar (no waveform icons)
  if (post.type === "audio") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-4 flex flex-col gap-3`}>
        <div className="flex items-center justify-between gap-2">
          <TypeMark type="audio" />
          <span className={`rounded-full border ${theme.tintBorder} px-2 py-0.5 font-ui text-[0.6rem] uppercase tracking-[0.2em] ${theme.tintText}`}>
            Listen
          </span>
        </div>
        <div className="flex-1 flex flex-col justify-center">
          {post.title && (
            <h3 className="font-display text-ink text-base font-semibold leading-snug line-clamp-2 mb-2">
              {post.title}
            </h3>
          )}
          <span
            className={`block h-1 w-full rounded-full ${theme.dotBg} opacity-40`}
            aria-hidden="true"
          />
        </div>
        <AuthorLine post={post} />
      </div>
    );
  }

  // LETTER — "Dear …" stationery vibe
  if (post.type === "letter") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
        <div className="flex items-center gap-3 mb-3">
          <TypeMark type="letter" />
          <span className={`h-px flex-1 bg-current opacity-25 ${theme.tintText}`} aria-hidden="true" />
        </div>
        {post.title && (
          <h3 className="font-display italic text-ink text-lg font-semibold leading-snug line-clamp-2 mb-2">
            {post.title}
          </h3>
        )}
        <p className="font-display italic text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
          {body}
        </p>
        <div className="mt-3 flex items-center justify-between gap-3">
          <AuthorLine post={post} />
          <span className={`font-display italic text-xs ${theme.tintText}`}>— Yours</span>
        </div>
      </div>
    );
  }

  // ESSAY — drop-cap opener, body type, lots of space
  if (post.type === "essay") {
    const opener = body.charAt(0);
    const rest = body.slice(1);
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
        <div className="flex items-center gap-3 mb-3">
          <TypeMark type="essay" />
          <span className={`h-px flex-1 bg-current opacity-25 ${theme.tintText}`} aria-hidden="true" />
        </div>
        {post.title && (
          <h3 className="font-display text-ink text-lg font-semibold leading-snug line-clamp-2 mb-2">
            {post.title}
          </h3>
        )}
        <p className="font-body text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
          <span className={`float-left mr-2 mt-1 font-display text-[2.6rem] leading-[0.78] ${theme.tintText}`}>
            {opener}
          </span>
          {rest}
        </p>
        <div className="mt-3">
          <AuthorLine post={post} />
        </div>
      </div>
    );
  }

  // STORY — italic display title, body, narrative feel
  if (post.type === "story") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
        <TypeMark type="story" />
        {post.title && (
          <h3 className="mt-3 font-display italic text-ink text-lg font-semibold leading-snug line-clamp-2 mb-2">
            {post.title}
          </h3>
        )}
        <p className="font-display text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
          {body}
        </p>
        <div className="mt-3">
          <AuthorLine post={post} />
        </div>
      </div>
    );
  }

  // JOURNAL — dated entry feel
  if (post.type === "journal") {
    return (
      <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
        <div className="flex items-center gap-3 mb-3">
          <TypeMark type="journal" />
          <span className={`text-[0.62rem] font-ui uppercase tracking-[0.22em] ${theme.tintText}`}>
            · {post.timeAgo}
          </span>
        </div>
        {post.title && (
          <h3 className="font-display text-ink text-base font-semibold leading-snug line-clamp-2 mb-2">
            {post.title}
          </h3>
        )}
        <p className="font-body italic text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
          {body}
        </p>
        <div className="mt-3">
          <AuthorLine post={post} />
        </div>
      </div>
    );
  }

  // BLOG, VISUAL (no media), VIDEO (no thumbnail) — generic editorial tile
  return (
    <div className={`absolute inset-0 ${theme.tintBg} p-5 flex flex-col`}>
      <div className="flex items-center gap-3 mb-3">
        <TypeMark type={post.type} />
        <span className={`h-px flex-1 bg-current opacity-25 ${theme.tintText}`} aria-hidden="true" />
      </div>
      {post.title && (
        <h3 className="font-display text-ink text-lg font-semibold leading-snug line-clamp-2 mb-2">
          {post.title}
        </h3>
      )}
      <p className="font-body text-subdued text-sm leading-relaxed line-clamp-5 flex-1">
        {body}
      </p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <AuthorLine post={post} />
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
  );
}

// =============================================================================
// MAGAZINE VIEW — long-form editorial cards in a 12-col grid, per-type span,
// per-type treatment.
// =============================================================================

export function MagazinePostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const theme = getPostTypeTheme(post.type);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;
  const span = getMagazineSpan(post);
  const body = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, 320);

  // QUOTE — pull-quote treatment with oversized opening mark
  if (post.type === "quote" && !showsMedia) {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={post.title || `Quotation by ${post.author.name}`}
        onClick={actions.onCardActivate}
        onKeyDown={actions.onKeyDown}
        className={`group ${span} relative overflow-hidden rounded-2xl border ${theme.tintBorder} ${theme.tintBg} cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_10%,transparent)]`}
      >
        <span
          className={`pointer-events-none absolute -top-4 left-4 font-display select-none ${theme.tintText} opacity-25`}
          style={{ fontSize: "11rem", lineHeight: 1 }}
          aria-hidden="true"
        >
          “
        </span>
        <div className="relative p-6 sm:p-8">
          <TypeMark type="quote" />
          <p className="mt-4 font-display italic text-ink text-xl sm:text-2xl leading-snug line-clamp-6">
            {body}
          </p>
          <div className="mt-6 pt-4 border-t border-current/10">
            <MagazineFooter post={post} actions={actions} />
          </div>
        </div>
      </article>
    );
  }

  // POEM — centered verse spread
  if (post.type === "poem" && !showsMedia) {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={post.title || `Verse by ${post.author.name}`}
        onClick={actions.onCardActivate}
        onKeyDown={actions.onKeyDown}
        className={`group ${span} relative overflow-hidden rounded-2xl border ${theme.tintBorder} ${theme.tintBg} cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_10%,transparent)]`}
      >
        <div className="p-6 sm:p-8 flex flex-col items-center text-center">
          <div className="flex flex-col items-center gap-2 mb-4">
            <TypeMark type="poem" />
            <span className={`h-px w-10 bg-current opacity-30 ${theme.tintText}`} aria-hidden="true" />
          </div>
          {post.title && (
            <h3 className="font-display italic text-ink text-xl sm:text-2xl font-semibold leading-snug line-clamp-2 mb-3">
              {post.title}
            </h3>
          )}
          <p className="font-display italic text-subdued text-base leading-loose line-clamp-6 mb-6">
            {body}
          </p>
          <div className="w-full pt-4 border-t border-current/10">
            <MagazineFooter post={post} actions={actions} />
          </div>
        </div>
      </article>
    );
  }

  // THOUGHT — small statement card
  if (post.type === "thought" && !showsMedia) {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={`A thought by ${post.author.name}`}
        onClick={actions.onCardActivate}
        onKeyDown={actions.onKeyDown}
        className={`group ${span} relative overflow-hidden rounded-2xl border ${theme.tintBorder} ${theme.tintBg} cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_10%,transparent)]`}
      >
        <div className="p-6">
          <TypeMark type="thought" />
          <p className="mt-3 font-display text-ink text-lg leading-snug line-clamp-4">
            {body}
          </p>
          <div className="mt-5 pt-4 border-t border-current/10">
            <MagazineFooter post={post} actions={actions} />
          </div>
        </div>
      </article>
    );
  }

  // AUDIO — voice-note feature with no waveform glyphs
  if (post.type === "audio" && !showsMedia) {
    return (
      <article
        role="button"
        tabIndex={0}
        aria-label={`Voice note by ${post.author.name}`}
        onClick={actions.onCardActivate}
        onKeyDown={actions.onKeyDown}
        className={`group ${span} relative overflow-hidden rounded-2xl border ${theme.tintBorder} ${theme.tintBg} cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_10%,transparent)]`}
      >
        <div className="p-6 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <TypeMark type="audio" />
            <span className={`rounded-full border ${theme.tintBorder} px-3 py-1 font-ui text-[0.62rem] uppercase tracking-[0.22em] ${theme.tintText}`}>
              Press to listen
            </span>
          </div>
          {post.title && (
            <h3 className="font-display text-ink text-xl font-semibold leading-snug line-clamp-2">
              {post.title}
            </h3>
          )}
          <span className={`block h-1 w-full rounded-full ${theme.dotBg} opacity-40`} aria-hidden="true" />
          <MagazineFooter post={post} actions={actions} />
        </div>
      </article>
    );
  }

  // Default — long-form editorial card (essay, blog, story, letter, journal,
  // visual/video without media)
  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${getTypeMark(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`group ${span} relative overflow-hidden rounded-2xl border border-border-light bg-surface cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:shadow-[0_22px_48px_color-mix(in_oklab,var(--color-ink)_10%,transparent)]`}
    >
      {showsMedia && (
        <div className="relative w-full overflow-hidden bg-skeleton aspect-[16/10]">
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
                <div className="grid h-14 w-14 place-items-center rounded-full bg-surface/95 text-ink shadow-lg">
                  <PlayIcon size="md" className="translate-x-[1px]" />
                </div>
              </div>
            </>
          )}
          <div className="absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 backdrop-blur-md">
            <TypeMark type={post.type} dark />
          </div>
          {extraMediaCount > 0 && (
            <span className="absolute right-3 top-3 rounded-md border border-white/25 bg-black/45 px-2 py-1 font-ui text-[0.62rem] font-semibold text-white backdrop-blur-md">
              +{extraMediaCount}
            </span>
          )}
        </div>
      )}

      <div className="p-5 sm:p-6">
        {!showsMedia && (
          <div className="mb-3 flex items-center gap-3">
            <TypeMark type={post.type} />
            <span className={`h-px flex-1 max-w-12 bg-current opacity-25 ${theme.tintText}`} aria-hidden="true" />
          </div>
        )}
        {post.title && (
          <h3
            className={`text-ink leading-tight mb-2 line-clamp-2 ${
              post.type === "story" || post.type === "letter"
                ? "font-display italic text-xl sm:text-2xl font-semibold"
                : "font-display text-xl sm:text-2xl font-semibold"
            }`}
          >
            {post.title}
          </h3>
        )}
        <p
          className={`text-subdued leading-relaxed line-clamp-5 ${
            post.type === "letter" || post.type === "story" || post.type === "journal"
              ? "font-display italic text-[0.95rem]"
              : "font-body text-[0.95rem]"
          }`}
        >
          {post.type === "essay" && body.length > 1 ? (
            <>
              <span className={`float-left mr-2 mt-1 font-display text-[3rem] leading-[0.78] ${theme.tintText}`}>
                {body.charAt(0)}
              </span>
              {body.slice(1)}
            </>
          ) : (
            body
          )}
        </p>

        <div className="mt-5 pt-4 border-t border-border-light/70">
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
    <div className="flex items-center justify-between gap-3">
      <AuthorLine post={post} />
      <StatsRow
        isAdmired={actions.isAdmired}
        admireCount={actions.admireCount}
        commentCount={actions.commentCount}
        isSaved={actions.isSaved}
        onAdmire={actions.onAdmire}
        onSave={actions.onSave}
      />
    </div>
  );
}
