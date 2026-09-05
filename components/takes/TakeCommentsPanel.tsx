"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import { useTakeComments } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import Sheet from "@/components/ui/Sheet";
import TakeCommentItem from "@/components/takes/TakeCommentItem";
import { SendIcon } from "@/components/ui/Icons";
import { Spinner } from "@/components/ui/Loading";
import { getOptimizedAvatarUrl, DEFAULT_AVATAR } from "@/lib/utils/image";

interface TakeCommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  takeId: string;
}

/**
 * The conversation beside a playing Take: a trailing panel on desktop, the
 * full screen on phones (shared Sheet, so Escape, focus and scroll lock
 * behave like every other overlay and it always sits above the video).
 * Comment items are the same ones the Take page and modal render.
 */
export default function TakeCommentsPanel({ isOpen, onClose, takeId }: TakeCommentsPanelProps) {
  const { user, profile } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { comments, loading, error, addComment, toggleLike, deleteComment } = useTakeComments(takeId, user?.id);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;
    setSubmitting(true);
    await addComment(input.trim());
    setInput("");
    setSubmitting(false);
  }, [input, submitting, addComment]);

  const count = comments.length;

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      title="Conversation"
      subtitle={count > 0 ? `${count} ${count === 1 ? "comment" : "comments"}` : undefined}
      presentation="panel"
      initialFocus={() => inputRef.current}
      bodyClassName="pq-take-comments__body"
      footer={
        user ? (
          <form className="pq-discussion__compose pq-take-comments__compose" onSubmit={handleSubmit}>
            <img src={getOptimizedAvatarUrl(profile?.avatar_url) || DEFAULT_AVATAR} alt="" className="pq-avatar pq-avatar--sm" width={32} height={32} />
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Add to the conversation…"
              aria-label="Add a comment"
              disabled={submitting}
              className="pq-discussion__input"
            />
            <button type="submit" className="pq-discussion__send" disabled={submitting || !input.trim()} aria-label="Send comment">
              {submitting ? <Spinner size="sm" /> : <SendIcon />}
            </button>
          </form>
        ) : (
          <p className="pq-discussion__signin pq-take-comments__compose">
            <Link href="/login?redirect=%2Ftakes" className="pq-button pq-button--sm pq-button--secondary">Sign in</Link>
            <span>to join the conversation</span>
          </p>
        )
      }
    >
      {loading ? (
        <div className="pq-discussion__state" role="status" aria-label="Loading comments"><Spinner size="md" /></div>
      ) : error ? (
        <p className="pq-discussion__state" role="alert">The conversation didn&rsquo;t load. Try again in a moment.</p>
      ) : count === 0 ? (
        <p className="pq-discussion__state">Nothing here yet. Say something kind, or something true.</p>
      ) : (
        <div className="pq-discussion__thread">
          {comments.map((comment) => (
            <TakeCommentItem
              key={comment.id}
              comment={comment}
              currentUserId={user?.id}
              onLike={toggleLike}
              onReply={(content, parentId) => addComment(content, parentId)}
              onDelete={deleteComment}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
