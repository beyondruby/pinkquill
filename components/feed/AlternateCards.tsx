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
import { AudioPlayer } from "@/components/feed/AudioPlayer";
import type { PostProps, PostType, MediaItem } from "./PostCard/types";

// =============================================================================
// UNIFIED ALTERNATE FEED LAYOUTS — compact, grid, magazine.
//
// Strategy (one system, not 11 bespoke per-type treatments):
//  • Every card is a NEUTRAL canvas (surface + full subtle border). No per-type
//    background washes — keeps the feed calm and unmistakably on-brand.
//  • A post's TYPE is signalled by ONE consistent accent: a small glyph+label
//    chip whose glyph carries the type's colour. Identity without clutter.
//  • Card SIZE is driven by CONTENT (has media / short vs long), never by an
//    arbitrary per-type span map.
//  • Terminology comes from the single source of truth (post-type-theme.ts) so
//    "Poem" is "Poem" everywhere — never "Verse"/"Reel".
//
// The three layouts differ only in DENSITY & SCALE (scan row → gallery tile →
// editorial card), each matched to a distinct user intent.
// =============================================================================

// -----------------------------------------------------------------------------
// Shared interaction hook — heavy interactions open the post modal on activate.
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Content helpers
// -----------------------------------------------------------------------------

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

// -----------------------------------------------------------------------------
// Sound / Voice showcase helpers (Heard category)
// -----------------------------------------------------------------------------

// post.type is typed as the existing PostType union, but the DB/registry also
// emits the new "sound"/"voice" formats — compare via string to stay aligned
// with the format registry without widening the shared PostType.
const AUDIO_FORMATS = new Set(["sound", "voice", "audio"]);

function isAudioFormat(type: PostType): boolean {
  return AUDIO_FORMATS.has(type as string);
}

function firstMediaOfType(post: PostProps, kind: MediaItem["media_type"]) {
  if (!post.media || post.media.length === 0) return null;
  return (
    [...post.media]
      .sort((a, b) => a.position - b.position)
      .find((m) => m.media_type === kind) ?? null
  );
}

/** The audio showcase body for a sound/voice post, or null to fall back to
 * normal text/card rendering (no audio attached, or not an audio format). */
function AudioShowcase({ post }: { post: PostProps }): React.JSX.Element | null {
  if (!isAudioFormat(post.type)) return null;
  const audio = firstMediaOfType(post, "audio");
  if (!audio) return null;

  // "voice" → compact; "sound"/"audio" → album-art card with cover.
  if ((post.type as string) === "voice") {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <AudioPlayer src={audio.media_url} title={post.title} variant="voice" />
      </div>
    );
  }

  const cover = firstMediaOfType(post, "image");
  return (
    <div onClick={(e) => e.stopPropagation()}>
      <AudioPlayer
        src={audio.media_url}
        title={post.title}
        cover={cover?.media_url ?? null}
        variant="card"
      />
    </div>
  );
}

/** Whether this post should render the audio showcase as its body. */
function hasAudioShowcase(post: PostProps): boolean {
  return isAudioFormat(post.type) && firstMediaOfType(post, "audio") !== null;
}

/** Canonical display name — single source of truth. */
function typeLabel(type: PostType): string {
  return getPostTypeTheme(type).label;
}

/** A post reads as "compact" (small tile / no stats row) when it's a short,
 * title-less micro-post. Content-driven, not a per-type special case. */
function isMicroPost(post: PostProps, body: string): boolean {
  return !post.title && body.length > 0 && body.length < 140;
}

// -----------------------------------------------------------------------------
// Shared primitives
// -----------------------------------------------------------------------------

/** The ONE accent: glyph (type colour) + canonical label. Calm by design. */
function TypeChip({ type, dark = false }: { type: PostType; dark?: boolean }) {
  const theme = getPostTypeTheme(type);
  return (
    <span className="inline-flex items-center gap-1.5 font-ui text-[0.66rem] font-semibold uppercase tracking-[0.18em]">
      <span aria-hidden="true" className={`text-[0.8rem] leading-none ${dark ? "text-white/90" : theme.tintText}`}>
        {theme.glyph}
      </span>
      <span className={dark ? "text-white/85" : "text-subdued"}>{theme.label}</span>
    </span>
  );
}

function AuthorLine({ post, dark = false }: { post: PostProps; dark?: boolean }) {
  return (
    <div className={`flex items-center gap-2 text-xs min-w-0 ${dark ? "text-white/82" : "text-muted"}`}>
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

/** Media thumbnail with a consistent "Watch" affordance for video. */
function MediaThumb({
  media,
  className,
  rounded = "rounded-xl",
}: {
  media: NonNullable<ReturnType<typeof firstMedia>>;
  className: string;
  rounded?: string;
}) {
  return (
    <div className={`relative shrink-0 overflow-hidden ${rounded} bg-skeleton ${className}`}>
      {media.media_type === "image" ? (
        <Image
          src={media.media_url}
          alt={media.caption || ""}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
          sizes="160px"
          quality={80}
        />
      ) : (
        <>
          <video
            src={media.media_url}
            muted
            playsInline
            preload="metadata"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-surface/95 text-ink shadow">
              <PlayIcon size="sm" className="translate-x-[1px]" />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

// Shared card shell — neutral canvas, consistent hover, focus ring, a11y.
const CARD_BASE =
  "group relative overflow-hidden rounded-2xl border border-border-light bg-surface cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/35 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_18px_40px_color-mix(in_oklab,var(--color-ink)_9%,transparent)]";

// =============================================================================
// COMPACT — "catch up fast". Uniform scan rows; identical structure per type.
// =============================================================================

export function CompactPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const audioShowcase = !cw && hasAudioShowcase(post);
  const showThumb = Boolean(media) && !cw && !audioShowcase;
  const body = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, 180);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${typeLabel(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`${CARD_BASE} w-full`}
    >
      <div className="flex gap-4 p-4 sm:p-[18px]">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <TypeChip type={post.type} />
          {post.title && !audioShowcase && (
            <h3 className="font-display text-[1.05rem] font-semibold leading-snug text-ink line-clamp-1">
              {post.title}
            </h3>
          )}
          {audioShowcase ? (
            <AudioShowcase post={post} />
          ) : (
            body && (
              <p className="font-body text-[0.9rem] leading-relaxed text-subdued line-clamp-2">
                {body}
              </p>
            )
          )}
          <div className="mt-auto flex items-center justify-between gap-3 pt-1.5">
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

        {showThumb && (
          <MediaThumb
            media={media!}
            className="h-[88px] w-[88px] self-center sm:h-[104px] sm:w-[104px]"
          />
        )}
      </div>
    </article>
  );
}

// =============================================================================
// GRID — "browse by vibe". Gallery mosaic; media leads, text posts are tidy
// typographic tiles. ONE structure for media, ONE for text. Content-driven size.
// =============================================================================

function getGridSpan(hasMedia: boolean, micro: boolean): string {
  if (hasMedia) {
    return "col-span-2 row-span-2 sm:col-span-3 sm:row-span-2 lg:col-span-4 lg:row-span-2";
  }
  if (micro) {
    return "col-span-2 row-span-1 sm:col-span-3 sm:row-span-1 lg:col-span-4 lg:row-span-1";
  }
  return "col-span-2 row-span-2 sm:col-span-3 sm:row-span-2 lg:col-span-4 lg:row-span-2";
}

export function GridPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const audioShowcase = !cw && hasAudioShowcase(post);
  const showsMedia = Boolean(media) && !cw && !audioShowcase;
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const body = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, 200);
  const micro = !showsMedia && !audioShowcase && isMicroPost(post, body);
  // Audio showcases use the same comfortable footprint as a standard text tile.
  const span = getGridSpan(showsMedia, micro);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${typeLabel(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`${CARD_BASE} ${span}`}
    >
      {audioShowcase ? (
        <GridAudioTile post={post} actions={actions} />
      ) : showsMedia ? (
        <GridMediaTile post={post} media={media!} extraMediaCount={extraMediaCount} actions={actions} />
      ) : (
        <GridTextTile post={post} body={body} micro={micro} actions={actions} />
      )}
    </article>
  );
}

function GridAudioTile({
  post,
  actions,
}: {
  post: PostProps;
  actions: ReturnType<typeof useCardActions>;
}) {
  return (
    <div className="absolute inset-0 flex flex-col bg-surface p-4 sm:p-5">
      <TypeChip type={post.type} />
      <div className="mt-3 flex-1">
        <AudioShowcase post={post} />
      </div>
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

function GridMediaTile({
  post,
  media,
  extraMediaCount,
  actions,
}: {
  post: PostProps;
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
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center bg-black/28">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-surface/95 text-ink shadow-lg">
                <PlayIcon size="md" className="translate-x-[1px]" />
              </div>
            </div>
          </>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/82 via-black/25 to-transparent" />
      </div>

      <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
        <span className="rounded-md bg-black/45 px-2 py-1 backdrop-blur-md">
          <TypeChip type={post.type} dark />
        </span>
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
          <h3 className="mb-2 font-display text-base font-semibold leading-tight line-clamp-2 drop-shadow-sm sm:text-lg">
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

function GridTextTile({
  post,
  body,
  micro,
  actions,
}: {
  post: PostProps;
  body: string;
  micro: boolean;
  actions: ReturnType<typeof useCardActions>;
}) {
  // Micro post (short, title-less): chip + statement + author. Compact, calm.
  if (micro) {
    return (
      <div className="absolute inset-0 flex flex-col justify-between bg-surface p-4">
        <TypeChip type={post.type} />
        <p className="font-display text-[1.02rem] leading-snug text-ink line-clamp-3">{body}</p>
        <AuthorLine post={post} />
      </div>
    );
  }

  // Standard text tile: one structure for every long-form / titled type.
  return (
    <div className="absolute inset-0 flex flex-col bg-surface p-4 sm:p-5">
      <TypeChip type={post.type} />
      {post.title && (
        <h3 className="mt-2.5 font-display text-[1.05rem] font-semibold leading-snug text-ink line-clamp-2">
          {post.title}
        </h3>
      )}
      <p className="mt-1.5 flex-1 font-body text-[0.88rem] leading-relaxed text-subdued line-clamp-4">
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
// MAGAZINE — "lean-back editorial browse". Larger curated cards; ONE media
// structure, ONE text structure; generous, consistent chrome.
// =============================================================================

function getMagazineSpan(hasMedia: boolean, micro: boolean): string {
  if (hasMedia) return "md:col-span-8";
  if (micro) return "md:col-span-4";
  return "md:col-span-6";
}

export function MagazinePostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = Boolean(post.contentWarning);
  const audioShowcase = !cw && hasAudioShowcase(post);
  const showsMedia = Boolean(media) && !cw && !audioShowcase;
  const extraMediaCount = post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const body = cw
    ? `Content warning: ${post.contentWarning}`
    : preview(post.content, 320);
  const micro = !showsMedia && !audioShowcase && isMicroPost(post, body);
  const span = getMagazineSpan(showsMedia, micro);

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `${typeLabel(post.type)} by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className={`${CARD_BASE} ${span}`}
    >
      {showsMedia && (
        <div className="relative aspect-[16/10] w-full overflow-hidden bg-skeleton">
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
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black/24">
                <div className="grid h-14 w-14 place-items-center rounded-full bg-surface/95 text-ink shadow-lg">
                  <PlayIcon size="md" className="translate-x-[1px]" />
                </div>
              </div>
            </>
          )}
          <span className="absolute left-3 top-3 rounded-md bg-black/45 px-2 py-1 backdrop-blur-md">
            <TypeChip type={post.type} dark />
          </span>
          {extraMediaCount > 0 && (
            <span className="absolute right-3 top-3 rounded-md border border-white/25 bg-black/45 px-2 py-1 font-ui text-[0.62rem] font-semibold text-white backdrop-blur-md">
              +{extraMediaCount}
            </span>
          )}
        </div>
      )}

      <div className={micro ? "p-6" : "p-5 sm:p-6"}>
        {!showsMedia && <TypeChip type={post.type} />}
        {post.title && !audioShowcase && (
          <h3 className="mt-3 mb-2 font-display text-xl font-semibold leading-tight text-ink line-clamp-2 sm:text-2xl">
            {post.title}
          </h3>
        )}
        {audioShowcase ? (
          <div className="mt-3">
            <AudioShowcase post={post} />
          </div>
        ) : (
          <p
            className={`leading-relaxed text-subdued ${
              micro
                ? "mt-3 font-display text-lg leading-snug text-ink line-clamp-4"
                : "font-body text-[0.95rem] line-clamp-5"
            } ${post.title || showsMedia ? "" : "mt-3"}`}
          >
            {body}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-border-light/70 pt-4">
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
    </article>
  );
}
