"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTakeComments } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";

interface TakeCommentsProps {
  isOpen: boolean;
  onClose: () => void;
  takeId: string;
}

// Format relative time
function formatTime(date: string): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return `${Math.floor(diff / 604800)}w`;
}

export default function TakeComments({ isOpen, onClose, takeId }: TakeCommentsProps) {
  const { user } = useAuth();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    comments,
    loading,
    error,
    addComment,
    toggleLike,
    deleteComment,
  } = useTakeComments(takeId, user?.id);

  // Handle dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      dialog.showModal();
      inputRef.current?.focus();
    } else {
      dialog.close();
    }
  }, [isOpen]);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    setSubmitting(true);
    await addComment(input.trim());
    setInput("");
    setSubmitting(false);
  }, [input, submitting, addComment]);

  const handleDelete = useCallback(async (commentId: string) => {
    if (confirm("Delete this comment?")) {
      await deleteComment(commentId);
    }
  }, [deleteComment]);

  return (
    <dialog ref={dialogRef} className="take-comments-modal" onClick={(e) => {
      if (e.target === dialogRef.current) onClose();
    }}>
      <div className="take-comments-content">
        {/* Header */}
        <div className="take-comments-header">
          <h2>Comments</h2>
          <button className="take-comments-close" onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="take-comments-list">
          {loading && (
            <div className="take-comments-loading">
              <div className="take-comments-spinner" />
            </div>
          )}

          {error && (
            <div className="take-comments-error">
              <p>Failed to load comments</p>
            </div>
          )}

          {!loading && !error && comments.length === 0 && (
            <div className="take-comments-empty">
              <p>No comments yet</p>
              <p className="take-comments-empty-sub">Be the first to comment!</p>
            </div>
          )}

          {comments.map((comment) => (
            <div key={comment.id} className="take-comment">
              <Link href={`/studio/${comment.author.username}`} className="take-comment-avatar">
                {comment.author.avatar_url ? (
                  <img src={getOptimizedAvatarUrl(comment.author.avatar_url, 32)} alt={comment.author.username} loading="lazy" />
                ) : (
                  <div className="take-comment-avatar-placeholder">
                    {comment.author.username[0]?.toUpperCase()}
                  </div>
                )}
              </Link>

              <div className="take-comment-body">
                <div className="take-comment-header">
                  <Link href={`/studio/${comment.author.username}`} className="take-comment-username">
                    @{comment.author.username}
                  </Link>
                  <span className="take-comment-time">{formatTime(comment.created_at)}</span>
                </div>

                <p className="take-comment-text">{comment.content}</p>

                <div className="take-comment-actions">
                  <button
                    className={`take-comment-like ${comment.is_liked ? "active" : ""}`}
                    onClick={() => toggleLike(comment.id)}
                  >
                    <svg viewBox="0 0 24 24" fill={comment.is_liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                    </svg>
                    {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
                  </button>

                  {comment.user_id === user?.id && (
                    <button
                      className="take-comment-delete"
                      onClick={() => handleDelete(comment.id)}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        {user ? (
          <form className="take-comments-input" onSubmit={handleSubmit}>
            <input
              ref={inputRef}
              type="text"
              placeholder="Add a comment..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={submitting}
            />
            <button type="submit" disabled={!input.trim() || submitting}>
              {submitting ? "..." : "Post"}
            </button>
          </form>
        ) : (
          <div className="take-comments-login">
            <Link href="/login">Log in to comment</Link>
          </div>
        )}
      </div>
    </dialog>
  );
}
