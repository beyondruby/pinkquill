"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useComments, useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, useBlock, createNotification, ReactionType } from "@/lib/hooks";
import type { PostUpdate } from "@/components/providers/ModalProvider";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import CommentItem from "@/components/feed/CommentItem";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { supabase } from "@/lib/supabase";
import { icons } from "@/components/ui/Icons";
import PostTags from "@/components/feed/PostTags";

// Helper to clean HTML for display (keeps tags but fixes &nbsp;)
function cleanHtmlForDisplay(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
}

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface Author {
  name: string;
  handle: string;
  avatar: string;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface Post {
  id: string;
  authorId?: string;
  author: Author;
  type: "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "screenplay" | "story" | "letter" | "quote";
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  image?: string;
  stats: {
    admires: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  isSaved?: boolean;
  isRelayed?: boolean;
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
}

// Format date as "January 2, 2026"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (update: PostUpdate) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostDetailModal({
  post,
  isOpen,
  onClose,
  onPostUpdate,
  onPostDeleted,
}: PostDetailModalProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showContent, setShowContent] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const { blockUser } = useBlock();

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useComments(post?.id || "", user?.id);
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(post?.id || "");
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post?.id || "", user?.id);

  const hasMedia = post?.media && post.media.length > 0;
  const postUrl = typeof window !== 'undefined' && post ? `${window.location.origin}/post/${post.id}` : '';
  const isOwner = user && post?.authorId && user.id === post.authorId;

  // Sync state when post changes
  useEffect(() => {
    if (post) {
      setIsSaved(post.isSaved || false);
      setIsRelayed(post.isRelayed || false);
      setRelayCount(post.stats.relays);
      setCurrentMediaIndex(0);
      setShowContent(!post.contentWarning);
    }
  }, [post?.id, post?.isSaved, post?.isRelayed, post?.stats.relays, post?.contentWarning]);

  // Click outside to close menu
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

  const handleDelete = async () => {
    if (!post || !user) return;

    setDeleting(true);
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("post_media").delete().eq("post_id", post.id),
        supabase.from("admires").delete().eq("post_id", post.id),
        supabase.from("reactions").delete().eq("post_id", post.id),
        supabase.from("saves").delete().eq("post_id", post.id),
        supabase.from("relays").delete().eq("post_id", post.id),
        supabase.from("comments").delete().eq("post_id", post.id),
        supabase.from("notifications").delete().eq("post_id", post.id),
      ]);

      // Delete the post
      const { error } = await supabase.from("posts").delete().eq("id", post.id);

      if (error) {
        console.error("Error deleting post:", error);
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      onClose();
      // Notify parent to remove post from list
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!post) return;
    onClose();
    router.push(`/create?edit=${post.id}`);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !post) return;

    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        post_id: post.id,
        reporter_id: user.id,
        reason: reason,
        details: details || null,
      });

      if (error) {
        console.error("Error submitting report:", error);
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    }
    setReportSubmitting(false);
  };

  const handleBlock = async () => {
    if (!user || !post?.authorId) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.authorId);
      setShowBlockConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  if (!post) return null;

  // Reaction handlers
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Create notification for reaction
    if (!isSameReaction && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "admire", post.id);
    }

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  };

  const handleRemoveReaction = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsSaved = !isSaved;

    // Optimistic update
    setIsSaved(newIsSaved);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

    // Database update
    await toggleSave(post.id, user.id, isSaved);
  };

  const handleRelay = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    // Can't relay your own posts
    if (user.id === post.authorId) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    // Optimistic update
    setIsRelayed(newIsRelayed);
    setRelayCount((prev) => Math.max(0, prev + countChange));

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

    // Database update
    await toggleRelay(post.id, user.id, isRelayed);

    // Create notification for relay
    if (newIsRelayed && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "relay", post.id);
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      // Create notification for comment
      if (post.authorId && post.authorId !== user.id) {
        await createNotification(post.authorId, user.id, 'comment', post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string, isLiked: boolean) => {
    if (!user) {
      openAuthModal();
      return;
    }
    toggleLike(commentId, user.id, isLiked);
  };

  const handleCommentReply = async (parentId: string, content: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    await addComment(user.id, content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={`flex flex-col md:flex-row h-full ${showComments ? "" : ""}`}>
        {/* Mobile Close Button */}
        <button
          onClick={onClose}
          className="md:hidden absolute top-3 right-3 z-50 w-10 h-10 rounded-full bg-black/10 backdrop-blur-sm flex items-center justify-center text-ink"
        >
          {icons.close}
        </button>

        {/* Main Content Area */}
        <div
          className={`flex flex-col overflow-y-auto p-4 md:p-10 ${
            showComments ? "hidden md:flex md:flex-1 md:border-r border-black/5" : "flex-1"
          }`}
        >
          {/* Author Header */}
          <div className="flex items-center gap-3 md:gap-4 mb-4 md:mb-8 pb-4 md:pb-6 border-b border-black/[0.06]">
            <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={onClose}>
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                width={56}
                height={56}
                className="w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 md:border-[3px] border-white shadow-lg hover:scale-110 transition-transform"
              />
            </Link>
            <div className="flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={onClose} className="font-ui text-[0.95rem] md:text-[1.1rem] font-medium text-ink hover:text-purple-primary transition-colors truncate">
                  {post.author.name}
                </Link>
                <span className="font-ui text-[0.8rem] md:text-[0.9rem] font-light text-muted hidden sm:inline">
                  {post.typeLabel}
                </span>
              </div>
              <span className="font-ui text-[0.75rem] md:text-[0.85rem] text-muted">
                {post.timeAgo}
              </span>
            </div>
            <button
              onClick={() => setShowComments(!showComments)}
              className="view-discussion-btn hidden md:flex"
            >
              {icons.comment}
              <span>Discussion</span>
              <span className="badge">
                {comments.length}
              </span>
            </button>
            {/* Mobile Discussion Button */}
            <button
              onClick={() => setShowComments(!showComments)}
              className="md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-primary/10 text-purple-primary text-sm font-medium"
            >
              {icons.comment}
              <span>{comments.length}</span>
            </button>

            {/* Post Options Menu */}
            {isOwner ? (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                >
                  {icons.moreHorizontal}
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        handleEdit();
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                    >
                      {icons.edit}
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowDeleteConfirm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                    >
                      {icons.trash}
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ) : user && (
              <div className="relative" ref={menuRef}>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                >
                  {icons.moreHorizontal}
                </button>

                {showMenu && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowBlockConfirm(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                    >
                      {icons.block}
                      Block
                    </button>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowReportModal(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                    >
                      {icons.flag}
                      Report
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Journal Date */}
          {post.type === "journal" && post.createdAt && (
            <div className="journal-date">{formatDate(post.createdAt)}</div>
          )}

          {/* Post Content */}
          <div className="flex-1 relative">
            {post.title && (
              <h2
                className={`font-display text-[1.3rem] md:text-[1.8rem] text-ink mb-3 md:mb-4 leading-tight ${
                  post.type === "poem" ? "text-center" : ""
                }`}
              >
                {post.title}
              </h2>
            )}

            {post.type === "poem" ? (
              <div
                className="font-body text-[1.05rem] md:text-[1.3rem] text-ink leading-loose italic text-center py-4 md:py-8 post-content"
                dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
              />
            ) : (
              <div
                className="font-body text-[0.95rem] md:text-[1.1rem] text-ink leading-relaxed post-content"
                dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
              />
            )}

            {/* Media Gallery */}
            {hasMedia && (
              <div className="mt-4 md:mt-8">
                {/* Main Image Container */}
                <div className="relative group rounded-xl md:rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)] mb-3 md:mb-5">
                  {post.media![currentMediaIndex].media_type === "video" ? (
                    <div className="relative bg-black">
                      <video
                        src={post.media![currentMediaIndex].media_url}
                        className="w-full h-[250px] md:h-[420px] object-contain"
                        controls
                        controlsList="nodownload"
                        playsInline
                        preload="none"
                        poster="/video-placeholder.svg"
                      />
                    </div>
                  ) : (
                    <div className="relative overflow-hidden">
                      <Image
                        src={post.media![currentMediaIndex].media_url}
                        alt=""
                        width={800}
                        height={420}
                        className="w-full h-[250px] md:h-[420px] object-cover cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('openLightbox', {
                            detail: { images: post.media!, index: currentMediaIndex }
                          }));
                        }}
                      />
                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                    </div>
                  )}

                  {/* Navigation Arrows */}
                  {post.media!.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? post.media!.length - 1 : prev - 1))}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 transition-all duration-300 z-10"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setCurrentMediaIndex((prev) => (prev === post.media!.length - 1 ? 0 : prev + 1))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 transition-all duration-300 z-10"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {/* Caption - Elegant Design */}
                {post.media![currentMediaIndex].caption && (
                  <div className="text-center mb-5 px-4">
                    <div className="inline-block relative">
                      <span className="absolute -left-4 top-0 text-purple-primary/20 text-2xl font-display">"</span>
                      <p className="font-body text-[1rem] text-ink/80 italic leading-relaxed">
                        {post.media![currentMediaIndex].caption}
                      </p>
                      <span className="absolute -right-4 bottom-0 text-purple-primary/20 text-2xl font-display rotate-180">"</span>
                    </div>
                  </div>
                )}

                {/* Thumbnail Strip - Beautiful Design */}
                {post.media!.length > 1 && (
                  <div className="flex gap-3 justify-center flex-wrap">
                    {post.media!.map((item, idx) => (
                      <button
                        key={item.id || idx}
                        onClick={() => setCurrentMediaIndex(idx)}
                        className={`relative w-16 h-16 rounded-xl overflow-hidden transition-all duration-300 ${
                          idx === currentMediaIndex
                            ? "ring-2 ring-purple-primary ring-offset-2 scale-105 shadow-lg"
                            : "opacity-60 hover:opacity-100 hover:scale-105"
                        }`}
                      >
                        {item.media_type === "video" ? (
                          <div className="relative w-full h-full bg-black">
                            <video src={item.media_url} className="w-full h-full object-cover" preload="metadata" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        ) : (
                          <Image src={item.media_url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                        )}
                        {idx === currentMediaIndex && (
                          <div className="absolute inset-0 border-2 border-purple-primary rounded-xl" />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Legacy single image support */}
            {post.image && !hasMedia && (
              <Image
                src={post.image}
                alt={post.title || "Post image"}
                width={800}
                height={600}
                className="w-full rounded-xl mt-6 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform"
              />
            )}

            {/* Content Warning Overlay */}
            {post.contentWarning && !showContent && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-2xl bg-white/40 rounded-xl">
                <div className="relative text-center px-8 py-10">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-ui text-sm font-semibold text-amber-700">Content Warning</span>
                  </div>

                  <p className="font-body text-base text-ink/80 mb-6 max-w-md mx-auto">{post.contentWarning}</p>

                  <button
                    onClick={() => setShowContent(true)}
                    className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-ink/80 hover:bg-ink transition-colors"
                  >
                    Show Content
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags Section (Collaborators + Tagged People + Hashtags) */}
          <PostTags
            collaborators={post.collaborators}
            mentions={post.mentions}
            hashtags={post.hashtags}
            onNavigate={onClose}
          />

          {/* Actions */}
          <div className="flex items-center gap-1.5 md:gap-2 mt-auto pt-4 md:pt-6 border-t border-black/[0.06] flex-wrap">
            {/* Reaction Picker */}
            <ReactionPicker
              currentReaction={userReaction}
              reactionCounts={reactionCounts}
              onReact={handleReaction}
              onRemoveReaction={handleRemoveReaction}
            />

            {/* Comment Button */}
            <button
              onClick={() => setShowComments(true)}
              className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
            >
              {icons.comment}
              {comments.length > 0 && <span className="text-xs md:text-sm font-medium">{comments.length}</span>}
            </button>

            {/* Relay Button - hidden for own posts */}
            {user?.id !== post.authorId && (
              <button
                onClick={handleRelay}
                disabled={!user}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                  isRelayed
                    ? "bg-green-500/10 text-green-600"
                    : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {icons.relay}
                {relayCount > 0 && <span className="text-xs md:text-sm font-medium">{relayCount}</span>}
              </button>
            )}

            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-black/[0.04] flex items-center justify-center text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
            >
              {icons.share}
            </button>

            {/* Save/Bookmark Button */}
            <button
              onClick={handleSave}
              disabled={!user}
              className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
                isSaved
                  ? "bg-amber-500/10 text-amber-600"
                  : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSaved ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              ) : (
                icons.bookmark
              )}
            </button>
          </div>
        </div>

        {/* Comments Panel - Full screen on mobile */}
        {showComments && (
          <div className="discussion-panel absolute md:relative inset-0 md:inset-auto w-full md:w-auto bg-white z-40">
            {/* Comments Header */}
            <div className="p-4 md:p-5 border-b border-black/[0.06] bg-white/60 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setShowComments(false)}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-ui text-[0.8rem] font-medium tracking-[0.12em] uppercase text-muted">
                  Discussion
                </span>
              </div>
              <button
                onClick={() => setShowComments(false)}
                className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
              >
                {icons.close}
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-body text-muted italic">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id}
                      onLike={handleCommentLike}
                      onReply={handleCommentReply}
                      onDelete={handleCommentDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Comment Input */}
            {user ? (
              <div className="p-4 bg-white border-t border-black/[0.06] flex gap-2.5 items-center">
                <Image
                  src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
                  alt="You"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-3xl px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg transition-all">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add to the conversation..."
                    disabled={submitting}
                    className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60 placeholder:italic"
                  />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !commentText.trim()}
                  className="w-[42px] h-[42px] rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-purple-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {icons.send}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-white border-t border-black/[0.06] text-center">
                <p className="font-ui text-[0.9rem] text-muted">
                  <a href="/login" className="text-purple-primary hover:underline">Sign in</a> to comment
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </Modal>

    {/* Share Modal - rendered outside main modal to avoid z-index issues */}
    {post && (
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 100)}
        description={post.content.substring(0, 200)}
        type={post.type}
        authorName={post.author.name}
      />
    )}

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <>
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[2001] p-6">
          <h3 className="font-display text-xl text-ink mb-3">Delete Post?</h3>
          <p className="font-body text-sm text-muted mb-6">
            This action cannot be undone. This will permanently delete your post and remove all associated data including comments, admires, and saves.
          </p>
          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              disabled={deleting}
              className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </button>
          </div>
        </div>
      </>
    )}

    {/* Report Modal */}
    {/* Block Confirmation Modal */}
    {showBlockConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
          <h3 className="font-display text-lg font-semibold text-ink mb-2">
            Block @{post.author.handle}?
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

    {showReportModal && (
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />
    )}
    </>
  );
}