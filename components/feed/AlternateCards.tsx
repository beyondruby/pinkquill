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
import type { PostProps } from "./PostCard/types";

// =============================================================================
// Shared hook — alternate cards are presentational; heavy interactions
// (reactions, comments, share, full content) happen in the post modal that
// opens on card activation. Local state stays in sync with modal updates so
// admire/save reflect correctly when the user reacts inside the modal then
// returns to the feed.
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
// Helpers
// =============================================================================

function firstMedia(post: PostProps) {
  if (!post.media || post.media.length === 0) return null;
  return [...post.media].sort((a, b) => a.position - b.position)[0];
}

function hasContentWarning(post: PostProps) {
  return Boolean(post.contentWarning);
}

function plainPreview(content: string, max: number): string {
  if (!content) return "";
  const stripped = content
    .replace(/[*_~`>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (stripped.length <= max) return stripped;
  return stripped.slice(0, max).trimEnd() + "…";
}

// =============================================================================
// CompactPostCard — dense single-column row
// =============================================================================

export function CompactPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = hasContentWarning(post);
  const isAudio = post.type === "audio";
  const isVideo = post.type === "video";

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `Post by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group w-full flex gap-3 p-3 rounded-xl border border-border-light bg-surface hover:border-accent/30 hover:shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <Link
        href={`/studio/${post.author.handle.replace("@", "")}`}
        onClick={(e) => e.stopPropagation()}
        className="flex-shrink-0 self-start"
        aria-label={`View ${post.author.name}'s studio`}
      >
        <div className="relative w-9 h-9 rounded-full overflow-hidden border border-border-light">
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            fill
            className="object-cover"
            sizes="36px"
            quality={80}
          />
        </div>
      </Link>

      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5 mb-0.5 text-xs">
          <span className="font-ui font-semibold text-ink truncate">
            {post.author.name}
          </span>
          <span className="text-muted truncate">{post.typeLabel}</span>
          <span className="text-muted">·</span>
          <span className="text-muted whitespace-nowrap">{post.timeAgo}</span>
        </div>

        {post.title && (
          <h3 className="font-display text-[0.95rem] font-semibold text-ink leading-snug mb-0.5 line-clamp-1">
            {post.title}
          </h3>
        )}
        <p className="font-body text-sm text-subdued line-clamp-2 leading-snug">
          {cw ? (
            <span className="italic text-muted">
              Content warning: {post.contentWarning}
            </span>
          ) : (
            plainPreview(post.content, 180)
          )}
        </p>

        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted">
          <button
            type="button"
            onClick={actions.onAdmire}
            aria-label={actions.isAdmired ? "Remove admire" : "Admire post"}
            aria-pressed={actions.isAdmired}
            className="inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            <HeartIcon size="sm" filled={actions.isAdmired} />
            <span className="tabular-nums">{actions.admireCount}</span>
          </button>
          <span className="inline-flex items-center gap-1">
            <CommentIcon size="sm" />
            <span className="tabular-nums">{actions.commentCount}</span>
          </span>
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className="inline-flex items-center gap-1 hover:text-accent transition-colors ml-auto"
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        </div>
      </div>

      {media && !cw && (
        <div className="flex-shrink-0 relative w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-skeleton">
          {media.media_type === "image" ? (
            <Image
              src={media.media_url}
              alt={media.caption || ""}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 64px, 80px"
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <PlayIcon size="sm" className="text-white drop-shadow" />
              </div>
            </>
          )}
        </div>
      )}
      {!media && (isAudio || isVideo) && (
        <div className="flex-shrink-0 w-16 h-16 sm:w-20 sm:h-20 rounded-lg bg-skeleton flex items-center justify-center">
          <span className="text-muted text-xs uppercase tracking-wide">
            {isAudio ? "Audio" : "Video"}
          </span>
        </div>
      )}
    </article>
  );
}

// =============================================================================
// GridPostCard — square media-first tile
// =============================================================================

export function GridPostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = hasContentWarning(post);
  const extraMediaCount =
    post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMediaTile = Boolean(media) && !cw;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `Post by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group relative rounded-2xl overflow-hidden border border-border-light bg-surface hover:border-accent/30 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      <div className="relative aspect-square w-full overflow-hidden">
        {showsMediaTile ? (
          media!.media_type === "image" ? (
            <Image
              src={media!.media_url}
              alt={media!.caption || ""}
              fill
              className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
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
              <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                <PlayIcon size="lg" className="text-white drop-shadow-lg" />
              </div>
            </>
          )
        ) : (
          <div
            className={`absolute inset-0 flex flex-col justify-between p-4 ${
              cw ? "bg-amber-500/5" : "bg-gradient-to-br from-surface to-skeleton"
            }`}
          >
            <span className="font-ui text-[0.7rem] uppercase tracking-widest text-muted">
              {post.typeLabel}
            </span>
            <div>
              {post.title && (
                <h3 className="font-display text-base font-semibold text-ink line-clamp-3 leading-snug mb-1">
                  {post.title}
                </h3>
              )}
              <p className="font-body text-xs text-subdued line-clamp-4 leading-snug">
                {cw
                  ? `Content warning: ${post.contentWarning}`
                  : plainPreview(post.content, 200)}
              </p>
            </div>
          </div>
        )}

        {extraMediaCount > 0 && showsMediaTile && (
          <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[0.65rem] font-ui font-medium">
            +{extraMediaCount}
          </div>
        )}

        {showsMediaTile && (
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className="absolute top-2 left-2 w-8 h-8 rounded-full bg-black/55 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        )}
      </div>

      <div className="px-3 pt-2 pb-3 flex items-center gap-2">
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
            className="inline-flex items-center gap-0.5 hover:text-accent transition-colors"
          >
            <HeartIcon size="sm" filled={actions.isAdmired} />
            <span className="tabular-nums">{actions.admireCount}</span>
          </button>
        </div>
      </div>
    </article>
  );
}

// =============================================================================
// MagazinePostCard — variable-height card for masonry layout
// =============================================================================

export function MagazinePostCard({ post }: { post: PostProps }) {
  const actions = useCardActions(post);
  const media = firstMedia(post);
  const cw = hasContentWarning(post);
  const extraMediaCount =
    post.media && post.media.length > 1 ? post.media.length - 1 : 0;
  const showsMedia = Boolean(media) && !cw;

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={post.title || `Post by ${post.author.name}`}
      onClick={actions.onCardActivate}
      onKeyDown={actions.onKeyDown}
      className="group break-inside-avoid mb-4 rounded-2xl overflow-hidden border border-border-light bg-surface hover:border-accent/30 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent/40"
    >
      {showsMedia && (
        <div className="relative w-full overflow-hidden bg-skeleton">
          {media!.media_type === "image" ? (
            <Image
              src={media!.media_url}
              alt={media!.caption || ""}
              width={800}
              height={600}
              className="w-full h-auto object-cover transition-transform duration-300 group-hover:scale-[1.02]"
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
                <PlayIcon size="lg" className="text-white drop-shadow-lg" />
              </div>
            </div>
          )}
          {extraMediaCount > 0 && (
            <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-black/55 text-white text-[0.65rem] font-ui font-medium">
              +{extraMediaCount}
            </div>
          )}
        </div>
      )}

      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Link
            href={`/studio/${post.author.handle.replace("@", "")}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
            aria-label={`View ${post.author.name}'s studio`}
          >
            <div className="relative w-7 h-7 rounded-full overflow-hidden border border-border-light">
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                fill
                className="object-cover"
                sizes="28px"
                quality={80}
              />
            </div>
          </Link>
          <div className="flex-1 min-w-0 text-xs">
            <div className="font-ui font-medium text-ink truncate">
              {post.author.name}
            </div>
            <div className="text-muted truncate">
              {post.typeLabel} · {post.timeAgo}
            </div>
          </div>
        </div>

        {post.title && (
          <h3 className="font-display text-lg font-semibold text-ink leading-snug mb-1.5 line-clamp-2">
            {post.title}
          </h3>
        )}
        <p className="font-body text-sm text-subdued leading-relaxed line-clamp-5">
          {cw
            ? `Content warning: ${post.contentWarning}`
            : plainPreview(post.content, 300)}
        </p>

        <div className="flex items-center gap-3 mt-3 text-xs text-muted">
          <button
            type="button"
            onClick={actions.onAdmire}
            aria-label={actions.isAdmired ? "Remove admire" : "Admire post"}
            aria-pressed={actions.isAdmired}
            className="inline-flex items-center gap-1 hover:text-accent transition-colors"
          >
            <HeartIcon size="sm" filled={actions.isAdmired} />
            <span className="tabular-nums">{actions.admireCount}</span>
          </button>
          <span className="inline-flex items-center gap-1">
            <CommentIcon size="sm" />
            <span className="tabular-nums">{actions.commentCount}</span>
          </span>
          <button
            type="button"
            onClick={actions.onSave}
            aria-label={actions.isSaved ? "Remove save" : "Save post"}
            aria-pressed={actions.isSaved}
            className="inline-flex items-center gap-1 hover:text-accent transition-colors ml-auto"
          >
            <BookmarkIcon size="sm" filled={actions.isSaved} />
          </button>
        </div>
      </div>
    </article>
  );
}
