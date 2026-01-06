"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTakeComments, useTakeReactionCounts, TakeReactionType, Take } from "@/lib/hooks/useTakes";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import TakeReactionPicker from "@/components/takes/TakeReactionPicker";
import TakeCommentItem from "@/components/takes/TakeCommentItem";
import PostTags from "@/components/feed/PostTags";
import { supabase } from "@/lib/supabase";
import { icons } from "@/components/ui/Icons";

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

export interface TakeUpdate {
  takeId: string;
  field: "reactions" | "comments" | "relays" | "saves";
  isActive: boolean;
  countChange: number;
  reactionType?: TakeReactionType | null;
}

interface TakeDetailModalProps {
  take: Take | null;
  isOpen: boolean;
  onClose: () => void;
  onTakeUpdate?: (update: TakeUpdate) => void;
  onTakeDeleted?: (takeId: string) => void;
}

export default function TakeDetailModal({
  take,
  isOpen,
  onClose,
  onTakeUpdate,
  onTakeDeleted,
}: TakeDetailModalProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [reactionsCount, setReactionsCount] = useState(0);
  const [userReaction, setUserReaction] = useState<TakeReactionType | null>(null);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [showContent, setShowContent] = useState(true);
  const [collaborators, setCollaborators] = useState<Array<{
    role?: string | null;
    user: { id: string; username: string; display_name: string | null; avatar_url: string | null };
  }>>([]);
  const [mentions, setMentions] = useState<Array<{
    id: string; username: string; display_name: string | null; avatar_url: string | null;
  }>>([]);

  const menuRef = useRef<HTMLDivElement>(null);

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useTakeComments(take?.id || "", user?.id);
  const { counts: reactionCounts } = useTakeReactionCounts(take?.id || "");

  const takeUrl = typeof window !== 'undefined' && take ? `${window.location.origin}/take/${take.id}` : '';
  const isOwner = user && take?.author_id && user.id === take.author_id;

  // Sync state when take changes
  useEffect(() => {
    if (take) {
      setIsSaved(take.is_saved || false);
      setIsRelayed(take.is_relayed || false);
      setRelayCount(take.relays_count || 0);
      setReactionsCount(take.reactions_count || 0);
      setUserReaction(take.user_reaction_type || null);
      setShowContent(!take.content_warning);
    }
  }, [take?.id, take?.is_saved, take?.is_relayed, take?.relays_count, take?.reactions_count, take?.user_reaction_type, take?.content_warning]);

  // Fetch hashtags, collaborators, and mentions when take changes
  useEffect(() => {
    const fetchMetadata = async () => {
      if (!take?.id) {
        setHashtags([]);
        setCollaborators([]);
        setMentions([]);
        return;
      }

      // Fetch all metadata in parallel
      const [tagsRes, collabRes, mentionsRes] = await Promise.all([
        supabase.from("take_tags").select("tag").eq("take_id", take.id),
        supabase.from("take_collaborators").select("role, user_id").eq("take_id", take.id).eq("status", "accepted"),
        supabase.from("take_mentions").select("user_id").eq("take_id", take.id),
      ]);

      // Set hashtags
      if (tagsRes.data) {
        setHashtags(tagsRes.data.map(t => t.tag));
      }

      // Fetch collaborator profiles
      if (collabRes.data && collabRes.data.length > 0) {
        const userIds = collabRes.data.map(c => c.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        if (profiles) {
          const profileMap = new Map(profiles.map(p => [p.id, p]));
          setCollaborators(collabRes.data.map(c => ({
            role: c.role,
            user: profileMap.get(c.user_id) || { id: c.user_id, username: "unknown", display_name: null, avatar_url: null },
          })));
        }
      } else {
        setCollaborators([]);
      }

      // Fetch mention profiles
      if (mentionsRes.data && mentionsRes.data.length > 0) {
        const userIds = mentionsRes.data.map(m => m.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, username, display_name, avatar_url")
          .in("id", userIds);

        setMentions(profiles || []);
      } else {
        setMentions([]);
      }
    };

    fetchMetadata();
  }, [take?.id]);

  // Auto-play when modal opens (only if no content warning or user accepted it)
  useEffect(() => {
    if (isOpen && videoRef.current && showContent) {
      videoRef.current.play().catch(() => {});
      setIsPlaying(true);
    }
  }, [isOpen, take?.id, showContent]);

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
    if (!take || !user) return;

    setDeleting(true);
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("take_comments").delete().eq("take_id", take.id),
        supabase.from("take_saves").delete().eq("take_id", take.id),
        supabase.from("take_relays").delete().eq("take_id", take.id),
        supabase.from("take_reactions").delete().eq("take_id", take.id),
        supabase.from("notifications").delete().eq("post_id", take.id),
      ]);

      // Delete the take
      const { error } = await supabase.from("takes").delete().eq("id", take.id);

      if (error) {
        console.error("Error deleting take:", error);
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      onClose();
      if (onTakeDeleted) {
        onTakeDeleted(take.id);
      }
    } catch (err) {
      console.error("Failed to delete take:", err);
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !take) return;

    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        reported_post_id: take.id,
        reporter_id: user.id,
        reason: reason,
        details: details || null,
        type: "take",
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

  if (!take) return null;

  // Reaction handler
  const handleReaction = async (reactionType: TakeReactionType) => {
    if (!user) return;

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
      setReactionsCount(prev => Math.max(0, prev - 1));
    } else {
      const wasReacted = userReaction !== null;
      setUserReaction(reactionType);
      if (!wasReacted) {
        setReactionsCount(prev => prev + 1);
      }
    }

    try {
      if (isSameReaction) {
        await supabase.from("take_reactions").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      } else if (userReaction) {
        await supabase.from("take_reactions")
          .update({ reaction_type: reactionType })
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      } else {
        await supabase.from("take_reactions").insert({
          take_id: take.id,
          user_id: user.id,
          reaction_type: reactionType,
        });
      }
    } catch (err) {
      // Revert on error
      setUserReaction(take.user_reaction_type);
      setReactionsCount(take.reactions_count);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  };

  const handleRemoveReaction = async () => {
    if (!user || !userReaction) return;

    setUserReaction(null);
    setReactionsCount(prev => Math.max(0, prev - 1));

    try {
      await supabase.from("take_reactions").delete()
        .eq("take_id", take.id)
        .eq("user_id", user.id);
    } catch (err) {
      setUserReaction(take.user_reaction_type);
      setReactionsCount(take.reactions_count);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async () => {
    if (!user) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    try {
      if (newIsSaved) {
        await supabase.from("take_saves").insert({
          take_id: take.id,
          user_id: user.id,
        });
      } else {
        await supabase.from("take_saves").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      }
    } catch (err) {
      setIsSaved(!newIsSaved);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });
  };

  const handleRelay = async () => {
    if (!user || take.author_id === user.id) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    setIsRelayed(newIsRelayed);
    setRelayCount(prev => Math.max(0, prev + countChange));

    try {
      if (newIsRelayed) {
        await supabase.from("take_relays").insert({
          take_id: take.id,
          user_id: user.id,
        });
      } else {
        await supabase.from("take_relays").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      }
    } catch (err) {
      setIsRelayed(!newIsRelayed);
      setRelayCount(prev => prev - countChange);
    }

    onTakeUpdate?.({
      takeId: take.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user) return;

    setSubmitting(true);
    const result = await addComment(commentText.trim());
    if (result) {
      setCommentText("");
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string) => {
    if (!user) return;
    toggleLike(commentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  const handleVideoClick = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose}>
        <div className={`flex h-full ${showComments ? "" : ""}`}>
          {/* Main Content Area */}
          <div
            className={`flex flex-col overflow-y-auto p-10 ${
              showComments ? "flex-1 border-r border-black/5" : "flex-1"
            }`}
          >
            {/* Author Header */}
            <div className="flex items-center gap-4 mb-8 pb-6 border-b border-black/[0.06]">
              <Link href={`/studio/${take.author.username}`} onClick={onClose}>
                <img
                  src={take.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={take.author.display_name || take.author.username}
                  className="w-14 h-14 rounded-full object-cover border-[3px] border-white shadow-lg hover:scale-110 transition-transform"
                />
              </Link>
              <div className="flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/studio/${take.author.username}`}
                    onClick={onClose}
                    className="font-ui text-[1.1rem] font-medium text-ink hover:text-purple-primary transition-colors"
                  >
                    {take.author.display_name || take.author.username}
                  </Link>
                  <span className="font-ui text-[0.9rem] font-light text-muted">
                    shared a take
                  </span>
                </div>
                <span className="font-ui text-[0.85rem] text-muted">
                  {getTimeAgo(take.created_at)}
                </span>
              </div>
              <button
                onClick={() => setShowComments(!showComments)}
                className="view-discussion-btn"
              >
                {icons.comment}
                <span>Discussion</span>
                <span className="badge">
                  {comments.length}
                </span>
              </button>

              {/* Take Options Menu */}
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

            {/* Post Content */}
            <div className="flex-1">
              {/* Caption */}
              {take.caption && (
                <p className="font-body text-[1.1rem] text-ink leading-relaxed mb-6">
                  {take.caption}
                </p>
              )}

              {/* Tags */}
              <PostTags
                hashtags={hashtags}
                collaborators={collaborators}
                mentions={mentions}
                onNavigate={onClose}
              />

              {/* Video Player */}
              <div className="mt-2">
                <div className="relative group rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)]">
                  <div className="relative bg-black">
                    <video
                      ref={videoRef}
                      src={take.video_url}
                      poster={take.thumbnail_url || undefined}
                      className={`w-full object-contain cursor-pointer ${take.content_warning && !showContent ? 'blur-xl' : ''}`}
                      style={{ maxHeight: '480px' }}
                      loop
                      playsInline
                      muted={isMuted}
                      onClick={handleVideoClick}
                    />

                    {/* Content Warning Overlay */}
                    {take.content_warning && !showContent && (
                      <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/60">
                        <div className="flex flex-col items-center gap-4 p-6 max-w-[300px] text-center">
                          <div className="w-14 h-14 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <svg className="w-7 h-7 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                          <div>
                            <h3 className="font-ui text-base font-semibold text-white mb-1">Content Warning</h3>
                            <p className="font-ui text-sm text-white/70">{take.content_warning}</p>
                          </div>
                          <button
                            onClick={() => setShowContent(true)}
                            className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-white/20 hover:bg-white/30 transition-colors"
                          >
                            Show Content
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Play/Pause Overlay */}
                    {!isPlaying && showContent && (
                      <div
                        className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer"
                        onClick={handleVideoClick}
                      >
                        <div className="w-20 h-20 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-purple-primary hover:scale-110 transition-transform">
                          {icons.play}
                        </div>
                      </div>
                    )}

                    {/* Video Controls Overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="flex items-center justify-between">
                        {/* Duration Badge */}
                        <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-sm text-white font-ui text-[0.8rem]">
                          {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, '0')}
                        </div>

                        {/* Mute Button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleMute();
                          }}
                          className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/80 transition-colors"
                        >
                          {isMuted ? icons.volumeOff : icons.volumeOn}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 mt-auto pt-6 border-t border-black/[0.06]">
              {/* Reaction Picker */}
              <TakeReactionPicker
                currentReaction={userReaction}
                reactionCounts={reactionCounts}
                onReact={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                disabled={!user}
                standardStyle
              />

              {/* Comment Button */}
              <button
                onClick={() => setShowComments(true)}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
              >
                {icons.comment}
                {comments.length > 0 && <span className="text-sm font-medium">{comments.length}</span>}
              </button>

              {/* Relay Button */}
              <button
                onClick={handleRelay}
                disabled={!user || take.author_id === user?.id}
                className={`flex items-center gap-1.5 px-4 py-2.5 rounded-full transition-all ${
                  isRelayed
                    ? "bg-green-500/10 text-green-600"
                    : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                } ${(!user || take.author_id === user?.id) ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {icons.relay}
                {relayCount > 0 && <span className="text-sm font-medium">{relayCount}</span>}
              </button>

              {/* Share Button */}
              <button
                onClick={() => setShowShareModal(true)}
                className="w-11 h-11 rounded-full bg-black/[0.04] flex items-center justify-center text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
              >
                {icons.share}
              </button>

              {/* Save/Bookmark Button */}
              <button
                onClick={handleSave}
                disabled={!user}
                className={`w-11 h-11 rounded-full flex items-center justify-center transition-all ${
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

          {/* Comments Panel */}
          {showComments && (
            <div className="discussion-panel">
              {/* Comments Header */}
              <div className="p-5 border-b border-black/[0.06] bg-white/60 flex justify-between items-center">
                <span className="font-ui text-[0.8rem] font-medium tracking-[0.12em] uppercase text-muted">
                  Discussion
                </span>
                <button
                  onClick={() => setShowComments(false)}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
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
                  <div className="space-y-4">
                    {comments.map((comment) => (
                      <TakeCommentItem
                        key={comment.id}
                        comment={comment}
                        currentUserId={user?.id}
                        onLike={handleCommentLike}
                        onReply={async (content, parentId) => {
                          return await addComment(content, parentId);
                        }}
                        onDelete={handleCommentDelete}
                        onModalClose={onClose}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Comment Input */}
              {user ? (
                <div className="p-4 bg-white border-t border-black/[0.06] flex gap-2.5 items-center">
                  <img
                    src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                    alt="You"
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

      {/* Share Modal */}
      {take && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          url={takeUrl}
          title={take.caption || "Take"}
          description={take.caption || "Check out this take"}
          type="video"
          authorName={take.author.display_name || take.author.username}
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
            <h3 className="font-display text-xl text-ink mb-3">Delete Take?</h3>
            <p className="font-body text-sm text-muted mb-6">
              This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions.
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
