"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { useTakeComments, TakeComment } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";

interface TakeCommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  takeId: string;
}

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

// Report reasons
const REPORT_REASONS = [
  "Spam",
  "Harassment",
  "Hate speech",
  "Inappropriate content",
  "Other",
];

// Single Comment Item Component (recursive for replies)
function CommentItem({
  comment,
  user,
  onToggleLike,
  onDelete,
  onReply,
  onReport,
  isReply = false,
}: {
  comment: TakeComment;
  user: any;
  onToggleLike: (id: string) => void;
  onDelete: (id: string) => void;
  onReply: (parentId: string, content: string) => void;
  onReport: (id: string, reason: string) => void;
  isReply?: boolean;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isOwner = user?.id === comment.user_id;

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

  const handleSubmitReply = async () => {
    if (!replyText.trim() || submittingReply) return;

    setSubmittingReply(true);
    await onReply(comment.id, replyText.trim());
    setReplyText("");
    setShowReplyInput(false);
    setShowReplies(true);
    setSubmittingReply(false);
  };

  const handleReport = async () => {
    if (!reportReason) return;

    setReportSubmitting(true);
    await onReport(comment.id, reportReason);
    setReportSubmitting(false);
    setReportSubmitted(true);
    setTimeout(() => {
      setShowReportModal(false);
      setReportSubmitted(false);
      setReportReason("");
    }, 1500);
  };

  return (
    <div className={isReply ? "ml-11 mt-3" : ""}>
      <div className="flex gap-3 group">
        <Link href={`/studio/${comment.author.username}`} className="flex-shrink-0">
          {comment.author.avatar_url ? (
            <img
              src={comment.author.avatar_url}
              alt={comment.author.username}
              className={`rounded-full object-cover hover:scale-110 transition-transform ${isReply ? "w-7 h-7" : "w-9 h-9"}`}
            />
          ) : (
            <div className={`rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white font-medium hover:scale-110 transition-transform ${isReply ? "w-7 h-7 text-xs" : "w-9 h-9 text-sm"}`}>
              {comment.author.username[0]?.toUpperCase()}
            </div>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          {/* Comment bubble */}
          <div className="bg-black/[0.03] rounded-2xl px-4 py-2.5 relative">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/studio/${comment.author.username}`}
                className="font-ui text-[0.85rem] font-medium text-ink hover:text-purple-primary transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
              <span className="font-ui text-[0.7rem] text-muted">
                {formatTime(comment.created_at)}
              </span>

              {/* 3-dot Menu */}
              {user && (
                <div className="relative ml-auto" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-6 h-6 rounded-full flex items-center justify-center text-muted/50 hover:text-muted hover:bg-black/[0.05] opacity-0 group-hover:opacity-100 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-1 w-28 bg-white rounded-lg shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      {isOwner ? (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onDelete(comment.id);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left font-ui text-[0.8rem] text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            setShowReportModal(true);
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left font-ui text-[0.8rem] text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                          </svg>
                          Report
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="font-body text-[0.9rem] text-ink leading-relaxed">
              {comment.content}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-4 mt-1.5 ml-2">
            <button
              onClick={() => onToggleLike(comment.id)}
              disabled={!user}
              className={`flex items-center gap-1 font-ui text-[0.75rem] transition-colors ${
                comment.is_liked
                  ? "text-pink-vivid"
                  : "text-muted hover:text-pink-vivid"
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill={comment.is_liked ? "currentColor" : "none"}
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              {comment.likes_count > 0 && <span>{comment.likes_count}</span>}
            </button>

            {/* Reply button - only for top-level comments */}
            {!isReply && user && (
              <button
                onClick={() => setShowReplyInput(!showReplyInput)}
                className="font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors"
              >
                Reply
              </button>
            )}
          </div>

          {/* Reply Input */}
          {showReplyInput && user && (
            <div className="flex gap-2 mt-3 ml-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submittingReply && handleSubmitReply()}
                placeholder="Write a reply..."
                disabled={submittingReply}
                className="flex-1 px-3 py-2 rounded-full bg-black/[0.03] border-none outline-none font-body text-[0.85rem] text-ink placeholder:text-muted/50 focus:bg-white focus:ring-2 focus:ring-purple-primary/20 transition-all"
              />
              <button
                onClick={handleSubmitReply}
                disabled={submittingReply || !replyText.trim()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.8rem] font-medium disabled:opacity-50 hover:scale-105 transition-all"
              >
                {submittingReply ? "..." : "Reply"}
              </button>
            </div>
          )}

          {/* View Replies Toggle */}
          {!isReply && comment.replies && comment.replies.length > 0 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="flex items-center gap-1.5 mt-2 ml-2 font-ui text-[0.8rem] text-purple-primary hover:text-pink-vivid transition-colors"
            >
              <svg
                className={`w-3 h-3 transition-transform ${showReplies ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              {showReplies ? "Hide" : "View"} {comment.replies.length} {comment.replies.length === 1 ? "reply" : "replies"}
            </button>
          )}

          {/* Nested Replies */}
          {showReplies && comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  user={user}
                  onToggleLike={onToggleLike}
                  onDelete={onDelete}
                  onReply={onReply}
                  onReport={onReport}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Report Modal */}
      {showReportModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60]"
            onClick={() => !reportSubmitting && setShowReportModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[340px] bg-white rounded-2xl shadow-2xl z-[61] p-5">
            {reportSubmitted ? (
              <div className="text-center py-4">
                <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="font-ui text-sm text-ink">Report submitted. Thank you!</p>
              </div>
            ) : (
              <>
                <h3 className="font-display text-lg text-ink mb-3">Report Comment</h3>
                <p className="font-body text-sm text-muted mb-4">
                  Why are you reporting this comment?
                </p>
                <div className="space-y-2 mb-4">
                  {REPORT_REASONS.map((reason) => (
                    <button
                      key={reason}
                      onClick={() => setReportReason(reason)}
                      className={`w-full text-left px-4 py-2.5 rounded-lg font-ui text-sm transition-colors ${
                        reportReason === reason
                          ? "bg-purple-primary/10 text-purple-primary"
                          : "bg-black/[0.03] text-ink hover:bg-black/[0.06]"
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowReportModal(false)}
                    disabled={reportSubmitting}
                    className="px-4 py-2 rounded-full font-ui text-sm text-muted hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={!reportReason || reportSubmitting}
                    className="px-4 py-2 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50"
                  >
                    {reportSubmitting ? "..." : "Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function TakeCommentsPanel({ isOpen, onClose, takeId }: TakeCommentsPanelProps) {
  const { user, profile } = useAuth();
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
    reportComment,
  } = useTakeComments(takeId, user?.id);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || submitting) return;

    setSubmitting(true);
    await addComment(input.trim());
    setInput("");
    setSubmitting(false);
  }, [input, submitting, addComment]);

  const handleReply = useCallback(async (parentId: string, content: string) => {
    await addComment(content, parentId);
  }, [addComment]);

  const handleReport = useCallback(async (commentId: string, reason: string) => {
    await reportComment(commentId, reason);
  }, [reportComment]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="take-comments-backdrop fixed inset-0 bg-black/50 md:bg-black/20 backdrop-blur-sm z-40"
          onClick={onClose}
        />
      )}

      {/* Panel - Side panel on desktop, bottom sheet on mobile */}
      {/* Panel - Side panel on desktop, bottom sheet on mobile */}
      <div
        className={`take-comments-panel fixed z-50 flex flex-col bg-white md:bg-[#fafafa] transform transition-transform duration-300 ease-out inset-x-0 bottom-0 h-[85vh] rounded-t-3xl md:inset-auto md:top-0 md:right-0 md:h-full md:w-[380px] md:rounded-none ${isOpen ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-y-0 md:translate-x-full"}`}
      >
        {/* Mobile drag handle */}
        <div className="md:hidden flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-black/20" />
        </div>

        {/* Header */}
        <div className="px-5 py-4 md:p-5 border-b border-black/[0.06] bg-white md:bg-white/60 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {/* Mobile close button (left side) */}
            <button
              onClick={onClose}
              className="md:hidden w-8 h-8 -ml-1 rounded-full flex items-center justify-center text-muted"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <span className="font-ui text-base md:text-[0.8rem] font-semibold md:font-medium md:tracking-[0.12em] md:uppercase text-ink md:text-muted">
              Comments
            </span>
            <span className="font-ui text-sm text-muted md:hidden">
              {comments.length > 0 && `(${comments.length})`}
            </span>
          </div>
          {/* Desktop close button (right side) */}
          <button
            onClick={onClose}
            className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Comments list */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="font-body text-red-500 text-sm">Failed to load comments</p>
            </div>
          )}

          {!loading && !error && comments.length === 0 && (
            <div className="text-center py-12 md:py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-black/[0.03] flex items-center justify-center">
                <svg className="w-8 h-8 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
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
                user={user}
                onToggleLike={toggleLike}
                onDelete={deleteComment}
                onReply={handleReply}
                onReport={handleReport}
              />
            ))}
          </div>
        </div>

        {/* Input */}
        {user ? (
          <div
            className="p-3 md:p-4 bg-white border-t border-black/[0.06] flex gap-2.5 items-center"
            style={{ paddingBottom: 'calc(12px + env(safe-area-inset-bottom, 0px))' }}
          >
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                {profile?.username?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex-1 flex items-center gap-2">
              <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-full px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg transition-all">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Add a comment..."
                  disabled={submitting}
                  className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || submitting}
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
            className="p-4 bg-white border-t border-black/[0.06] text-center"
            style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom, 0px))' }}
          >
            <p className="font-ui text-[0.9rem] text-muted">
              <Link href="/login" className="text-purple-primary hover:underline">Sign in</Link> to comment
            </p>
          </div>
        )}
      </div>
    </>
  );
}
