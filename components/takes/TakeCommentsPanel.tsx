"use client";

/**
 * Comments side panel for the takes feed — a thin shell over the shared
 * comments hook and CommentItem (Phase 2), so takes get paging, one-level
 * threading, optimistic adds and the same counts as everywhere else.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useComments, COMMENT_MAX_LENGTH } from "@/lib/hooks/useComments";
import { useReaction } from "@/lib/engagement/reactions";
import { CommentIcon } from "@/components/ui/Icons";
import CommentItem from "@/components/feed/CommentItem";
import { actionToast } from "@/lib/utils/toast";

interface TakeCommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  takeId: string;
  authorId?: string | null;
}

export default function TakeCommentsPanel({ isOpen, onClose, takeId, authorId }: TakeCommentsPanelProps) {
  const { user, profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    comments,
    loading,
    hasMore,
    loadingMore,
    loadMore,
    addComment,
    toggleLike,
    deleteComment,
    fetchReplies,
  } = useComments("take", takeId, { authorId, live: true });
  const reaction = useReaction("take", takeId, { loadComments: true, live: true });
  const commentsCount = reaction.comments;
  const isOwner = !!user && !!authorId && user.id === authorId;

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const text = input.trim();
      if (!text || submitting) return;
      setSubmitting(true);
      setInput("");
      const result = await addComment(text);
      if (!result.success) {
        setInput(text);
        actionToast.genericError("post comment");
      }
      setSubmitting(false);
    },
    [input, submitting, addComment]
  );

  const handleReply = useCallback(
    (parentId: string, content: string, replyToUserId: string | null) =>
      addComment(content, { parentId, replyToUserId }),
    [addComment]
  );
  const handleLike = useCallback((commentId: string) => void toggleLike(commentId), [toggleLike]);
  const handleDelete = useCallback((commentId: string) => void deleteComment(commentId), [deleteComment]);

  return (
    <>
      {isOpen && (
        <div className="take-comments-backdrop fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose} />
      )}

      <div
        className={`take-comments-panel fixed z-50 flex flex-col bg-surface md:bg-canvas transform transition-transform duration-300 ease-out inset-x-0 bottom-0 h-[85vh] rounded-t-3xl md:inset-auto md:top-0 md:right-0 md:h-full md:w-[380px] md:rounded-none ${
          isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"
        }`}
      >
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-black/20" />
        </div>

        <div className="px-5 py-4 md:p-5 border-b border-border-light bg-surface md:bg-surface/60 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-muted"
              aria-label="Close comments"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="font-ui text-base md:text-[0.8rem] font-semibold md:font-medium text-ink md:text-muted">
              Comments
            </span>
            <span className="font-ui text-sm text-muted">{commentsCount > 0 && `(${commentsCount})`}</span>
          </div>
          <button
            onClick={onClose}
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
            aria-label="Close comments"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {!loading && comments.length === 0 && (
            <div className="text-center py-12 md:py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-skeleton/60 flex items-center justify-center">
                <CommentIcon size="lg" className="w-8 h-8" />
              </div>
              <p className="font-ui text-[0.95rem] text-ink mb-1">No comments yet</p>
              <p className="font-body text-sm text-muted">Start the conversation!</p>
            </div>
          )}

          <div className="space-y-4 md:space-y-5">
            {comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                kind="take"
                contentId={takeId}
                currentUserId={user?.id}
                canDeleteAny={isOwner}
                onLike={handleLike}
                onReply={handleReply}
                onLoadReplies={fetchReplies}
                onDelete={handleDelete}
              />
            ))}
            {hasMore && !loading && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="w-full py-2 rounded-full font-ui text-[0.8rem] text-purple-primary hover:bg-purple-primary/5 transition-colors disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more comments"}
              </button>
            )}
          </div>
        </div>

        {user ? (
          <div
            className="p-3 md:p-4 bg-surface border-t border-border-light flex gap-2.5 items-center"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          >
            {profile?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={profile.username} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {profile?.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <div className="flex-1 flex items-center bg-subtle rounded-full px-4 focus-within:bg-surface focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Add a comment..."
                  maxLength={COMMENT_MAX_LENGTH}
                  disabled={submitting}
                  className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || submitting}
                aria-label="Post comment"
                className="w-10 h-10 md:w-[42px] md:h-[42px] rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </form>
          </div>
        ) : (
          <div
            className="p-4 bg-surface border-t border-border-light text-center"
            style={{ paddingBottom: "calc(16px + env(safe-area-inset-bottom, 0px))" }}
          >
            <p className="font-ui text-[0.9rem] text-muted">
              <Link href="/login" className="text-purple-primary hover:underline">
                Sign in
              </Link>{" "}
              to comment
            </p>
          </div>
        )}
      </div>
    </>
  );
}
