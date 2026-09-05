"use client";

import Link from "next/link";
import { forwardRef, type ReactNode } from "react";
import CommentItem from "@/components/feed/CommentItem";
import { SendIcon } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Loading";
import type { Comment } from "@/lib/types";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

interface DiscussionProps {
  /** Post comments rendered with the default CommentItem. Omit when passing `thread`. */
  comments?: Comment[];
  /**
   * A pre-rendered thread (Takes render their own comment item). `count`
   * drives the heading and empty state when this is used.
   */
  thread?: ReactNode;
  count?: number;
  loading: boolean;
  currentUserId?: string;
  currentUserAvatar?: string | null;
  signedIn: boolean;
  signInHref: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  submitting: boolean;
  onLike?: (commentId: string, isLiked: boolean) => void;
  onReply?: (parentId: string, content: string) => Promise<{ success: boolean; error?: string } | void>;
  onLoadReplies?: (commentId: string) => Promise<unknown>;
  onDelete?: (commentId: string) => void;
  canModerateDelete?: boolean;
  onModeratorDelete?: (commentId: string, reason?: string) => Promise<void>;
  /** Controls rendered in the header (a back or close button). */
  headerLeading?: ReactNode;
  headerTrailing?: ReactNode;
  className?: string;
}

/**
 * The conversation around a work: a count, the thread, and one place to
 * add to it. Guests see where to sign in. Used as a side card on the post
 * page and as the side/full-screen panel in the modal.
 */
const Discussion = forwardRef<HTMLInputElement, DiscussionProps>(function Discussion(
  {
    comments = [],
    thread,
    count: countProp,
    loading,
    currentUserId,
    currentUserAvatar,
    signedIn,
    signInHref,
    value,
    onValueChange,
    onSubmit,
    submitting,
    onLike,
    onReply,
    onLoadReplies,
    onDelete,
    canModerateDelete,
    onModeratorDelete,
    headerLeading,
    headerTrailing,
    className = "",
  },
  inputRef
) {
  const count = countProp ?? comments.length;
  return (
    <section className={`pq-discussion ${className}`.trim()} aria-label="Conversation">
      <header className="pq-discussion__head">
        {headerLeading}
        <h2 className="pq-discussion__title">
          Conversation{count > 0 && <span className="pq-tab__count">{count}</span>}
        </h2>
        {headerTrailing}
      </header>

      <div className="pq-discussion__list">
        {loading ? (
          <div className="pq-discussion__state" role="status" aria-label="Loading comments"><Spinner size="md" /></div>
        ) : count === 0 ? (
          <p className="pq-discussion__state">Nothing here yet. Say something kind, or something true.</p>
        ) : (
          <div className="pq-discussion__thread">
            {thread ?? comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                currentUserId={currentUserId}
                onLike={onLike ?? (() => {})}
                onReply={onReply ?? (async () => {})}
                onLoadReplies={onLoadReplies}
                onDelete={onDelete}
                canModerateDelete={canModerateDelete}
                onModeratorDelete={onModeratorDelete}
              />
            ))}
          </div>
        )}
      </div>

      {signedIn ? (
        <form
          className="pq-discussion__compose"
          onSubmit={(event) => {
            event.preventDefault();
            if (!submitting && value.trim()) onSubmit();
          }}
        >
          <img src={getOptimizedAvatarUrl(currentUserAvatar) || DEFAULT_AVATAR} alt="" className="pq-avatar pq-avatar--sm" width={32} height={32} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onValueChange(e.target.value)}
            placeholder="Add to the conversation…"
            aria-label="Add a comment"
            disabled={submitting}
            className="pq-discussion__input"
          />
          <button type="submit" className="pq-discussion__send" disabled={submitting || !value.trim()} aria-label="Send comment">
            {submitting ? <Spinner size="sm" /> : <SendIcon />}
          </button>
        </form>
      ) : (
        <p className="pq-discussion__signin">
          <Link href={signInHref} className="pq-button pq-button--sm pq-button--secondary">Sign in</Link>
          <span>to join the conversation</span>
        </p>
      )}
    </section>
  );
});

export default Discussion;
