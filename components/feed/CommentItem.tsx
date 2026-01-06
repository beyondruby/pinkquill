"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Comment } from "@/lib/hooks";
import { useBlock } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import ReportModal from "@/components/ui/ReportModal";

interface CommentItemProps {
  comment: Comment;
  currentUserId?: string;
  onLike: (commentId: string, isLiked: boolean) => void;
  onReply: (parentId: string, content: string) => Promise<void>;
  onDelete?: (commentId: string) => void;
  onBlock?: (userId: string) => void;
  isReply?: boolean;
  topLevelParentId?: string; // The top-level comment ID for flat threading
}

// Parse @mentions in comment content and render as clickable links
function renderContentWithMentions(content: string): React.ReactNode {
  // Match @username patterns (alphanumeric and underscores)
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(content)) !== null) {
    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index));
    }
    // Add the mention as a link
    const username = match[1];
    parts.push(
      <Link
        key={match.index}
        href={`/studio/${username}`}
        className="text-purple-primary font-medium hover:underline"
        onClick={(e) => e.stopPropagation()}
      >
        @{username}
      </Link>
    );
    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex));
  }

  return parts.length > 0 ? parts : content;
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString();
}

export default function CommentItem({
  comment,
  currentUserId,
  onLike,
  onReply,
  onDelete,
  onBlock,
  isReply = false,
  topLevelParentId,
}: CommentItemProps) {
  const [showReplies, setShowReplies] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // For flat threading: when replying to a reply, use the top-level parent ID
  // When replying to a top-level comment, use the comment's own ID
  const effectiveParentId = isReply ? (topLevelParentId || comment.id) : comment.id;

  // Auto-populate @username when opening reply on a nested comment
  const handleOpenReply = () => {
    if (!showReplyInput) {
      // If this is a reply (nested comment), pre-fill with @username
      if (isReply) {
        setReplyText(`@${comment.author.username} `);
      } else {
        setReplyText("");
      }
    }
    setShowReplyInput(!showReplyInput);
  };
  const [showMenu, setShowMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { blockUser } = useBlock();

  const isOwner = currentUserId === comment.user_id;

  const handleBlock = async () => {
    if (!currentUserId || isOwner) return;

    setIsBlocking(true);
    try {
      await blockUser(currentUserId, comment.user_id);
      setShowBlockConfirm(false);
      setShowMenu(false);
      onBlock?.(comment.user_id);
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!currentUserId) return;

    setIsReporting(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: currentUserId,
        reported_user_id: comment.user_id,
        reason: reason + (details ? `: ${details}` : ""),
        type: "comment",
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 1500);
    } catch (err) {
      console.error("Failed to report:", err);
    } finally {
      setIsReporting(false);
    }
  };

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

  const handleLike = () => {
    if (!currentUserId) return;
    onLike(comment.id, comment.user_has_liked);
  };

  const handleSubmitReply = async () => {
    if (!replyText.trim() || !currentUserId) return;

    setSubmitting(true);
    // Use effectiveParentId to maintain flat threading structure
    await onReply(effectiveParentId, replyText.trim());
    setReplyText("");
    setShowReplyInput(false);
    // Only show replies for top-level comments
    if (!isReply) {
      setShowReplies(true);
    }
    setSubmitting(false);
  };

  const handleDelete = () => {
    if (onDelete && isOwner) {
      onDelete(comment.id);
    }
  };

  return (
    <div className={`${isReply ? "ml-11 mt-3" : ""}`}>
      <div className="flex gap-3 group">
        <Link href={`/studio/${comment.author.username}`} className="flex-shrink-0">
          <Image
            src={comment.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
            alt={comment.author.display_name || comment.author.username}
            width={36}
            height={36}
            className={`rounded-full object-cover hover:scale-110 transition-transform ${isReply ? "w-7 h-7" : "w-9 h-9"}`}
          />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="bg-black/[0.03] rounded-2xl px-4 py-2.5 relative">
            <div className="flex items-center gap-2 mb-0.5">
              <Link
                href={`/studio/${comment.author.username}`}
                className="font-ui text-[0.85rem] font-medium text-ink hover:text-purple-primary transition-colors"
              >
                {comment.author.display_name || comment.author.username}
              </Link>
              <span className="font-ui text-[0.7rem] text-muted">
                {getTimeAgo(comment.created_at)}
              </span>

              {/* 3-dot Menu */}
              {currentUserId && (isOwner || !isOwner) && (
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
                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      {isOwner && onDelete ? (
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            handleDelete();
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 text-left font-ui text-[0.8rem] text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Delete
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setShowMenu(false);
                              setShowBlockConfirm(true);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left font-ui text-[0.8rem] text-ink hover:bg-black/[0.03] transition-colors"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            Block
                          </button>
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
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
            <p className="font-body text-[0.9rem] text-ink leading-relaxed">
              {renderContentWithMentions(comment.content)}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-4 mt-1.5 ml-2">
            <button
              onClick={handleLike}
              disabled={!currentUserId}
              className={`flex items-center gap-1 font-ui text-[0.75rem] transition-colors ${
                comment.user_has_liked
                  ? "text-pink-vivid"
                  : "text-muted hover:text-pink-vivid"
              } ${!currentUserId ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <svg
                className="w-3.5 h-3.5"
                fill={comment.user_has_liked ? "currentColor" : "none"}
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

            <button
              onClick={handleOpenReply}
              disabled={!currentUserId}
              className={`font-ui text-[0.75rem] text-muted hover:text-purple-primary transition-colors ${
                !currentUserId ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              Reply
            </button>
          </div>

          {/* Reply Input */}
          {showReplyInput && currentUserId && (
            <div className="flex gap-2 mt-3 ml-2">
              <input
                type="text"
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && handleSubmitReply()}
                placeholder="Write a reply..."
                disabled={submitting}
                className="flex-1 px-3 py-2 rounded-full bg-black/[0.03] border-none outline-none font-body text-[0.85rem] text-ink placeholder:text-muted/50 focus:bg-white focus:ring-2 focus:ring-purple-primary/20 transition-all"
              />
              <button
                onClick={handleSubmitReply}
                disabled={submitting || !replyText.trim()}
                className="px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-[0.8rem] font-medium disabled:opacity-50 hover:scale-105 transition-all"
              >
                {submitting ? "..." : "Reply"}
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
                  currentUserId={currentUserId}
                  onLike={onLike}
                  onReply={onReply}
                  onDelete={onDelete}
                  onBlock={onBlock}
                  isReply
                  topLevelParentId={comment.id} // Pass the top-level comment ID for flat threading
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Block @{comment.author.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                className="flex-1 py-2.5 rounded-full border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/[0.03] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={isBlocking}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {isBlocking ? "Blocking..." : "Block"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => {
            setShowReportModal(false);
            setReportSubmitted(false);
          }}
          onSubmit={handleReport}
          submitting={isReporting}
          submitted={reportSubmitted}
        />
      )}
    </div>
  );
}
