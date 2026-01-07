"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useModal } from "@/components/providers/ModalProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Take, RelayedTake, TakeReactionType, TakeReactionCounts } from "@/lib/hooks/useTakes";
import { useBlock } from "@/lib/hooks";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import TakeReactionPicker from "@/components/takes/TakeReactionPicker";
import { supabase } from "@/lib/supabase";
import {
  HeartIcon,
  CommentIcon,
  RelayIcon,
  ShareIcon,
  BookmarkIcon,
  EllipsisIcon,
  TrashIcon,
  FlagIcon,
  BlockIcon,
} from "@/components/ui/Icons";

interface TakePostCardProps {
  take: Take | RelayedTake;
  isRelayed?: boolean;
  relayedBy?: {
    username: string;
    display_name: string | null;
  };
  variant?: "feed" | "grid";
  onTakeDeleted?: (takeId: string) => void;
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return n.toString();
}

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function TakePostCard({ take, isRelayed, relayedBy, variant = "feed", onTakeDeleted }: TakePostCardProps) {
  const { openTakeModal, subscribeToTakeUpdates, notifyTakeUpdate } = useModal();
  const { user } = useAuth();
  const { blockUser } = useBlock();
  const videoRef = useRef<HTMLVideoElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const [userReaction, setUserReaction] = useState<TakeReactionType | null>(take.user_reaction_type || null);
  const [reactionCounts, setReactionCounts] = useState<TakeReactionCounts>(
    take.reaction_counts || {
      admire: 0,
      snap: 0,
      ovation: 0,
      support: 0,
      inspired: 0,
      applaud: 0,
      total: take.reactions_count || 0,
    }
  );
  const [isSaved, setIsSaved] = useState(take.is_saved || false);
  const [isRelayedState, setIsRelayedState] = useState(take.is_relayed || false);
  const [relayCount, setRelayCount] = useState(take.relays_count || 0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const isOwner = user && user.id === take.author_id;
  const takeUrl = typeof window !== 'undefined' ? `${window.location.origin}/take/${take.id}` : `/take/${take.id}`;
  const relayedAt = 'relayed_at' in take ? take.relayed_at : null;

  // Subscribe to updates from modal
  useEffect(() => {
    const unsubscribe = subscribeToTakeUpdates((update) => {
      if (update.takeId !== take.id) return;

      if (update.field === "reactions") {
        const newReactionType = update.reactionType as TakeReactionType | null;
        const previousReaction = userReaction;
        setUserReaction(newReactionType);
        setReactionCounts((prev) => {
          const newCounts = { ...prev };
          // Decrement previous reaction type
          if (previousReaction && newReactionType !== previousReaction) {
            newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
          }
          // Increment new reaction type
          if (newReactionType && newReactionType !== previousReaction) {
            newCounts[newReactionType] = newCounts[newReactionType] + 1;
          }
          // Update total
          newCounts.total = Math.max(0, prev.total + update.countChange);
          return newCounts;
        });
      } else if (update.field === "relays") {
        setIsRelayedState(update.isActive);
        setRelayCount((prev) => Math.max(0, prev + update.countChange));
      } else if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });

    return unsubscribe;
  }, [take.id, subscribeToTakeUpdates]);

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

  const handleMouseEnter = () => {
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  const handleOpenModal = () => {
    openTakeModal({
      ...take,
      is_saved: isSaved,
      is_relayed: isRelayedState,
      relays_count: relayCount,
      reactions_count: reactionCounts.total,
      reaction_counts: reactionCounts,
      user_reaction_type: userReaction,
    });
  };

  // Reaction handler
  const handleReaction = async (reactionType: TakeReactionType) => {
    if (!user) return;

    const isSameReaction = userReaction === reactionType;
    const previousReaction = userReaction;

    // Optimistic update
    if (isSameReaction) {
      // Removing reaction
      setUserReaction(null);
      setReactionCounts(prev => {
        const newCounts = { ...prev };
        newCounts[reactionType] = Math.max(0, newCounts[reactionType] - 1);
        newCounts.total = Math.max(0, prev.total - 1);
        return newCounts;
      });
    } else {
      // Adding or changing reaction
      setUserReaction(reactionType);
      setReactionCounts(prev => {
        const newCounts = { ...prev };
        // Increment new reaction type
        newCounts[reactionType] = newCounts[reactionType] + 1;
        // Decrement previous reaction type if changing
        if (previousReaction) {
          newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
        } else {
          // New reaction, increment total
          newCounts.total = prev.total + 1;
        }
        return newCounts;
      });
    }

    // Notify modal
    notifyTakeUpdate({
      takeId: take.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (previousReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });

    try {
      if (isSameReaction) {
        await supabase.from("take_reactions").delete()
          .eq("take_id", take.id)
          .eq("user_id", user.id);
      } else if (previousReaction) {
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
      setReactionCounts(take.reaction_counts || {
        admire: 0, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0,
        total: take.reactions_count || 0,
      });
    }
  };

  const handleRemoveReaction = async () => {
    if (!user || !userReaction) return;

    const previousReaction = userReaction;
    setUserReaction(null);
    setReactionCounts(prev => {
      const newCounts = { ...prev };
      newCounts[previousReaction] = Math.max(0, newCounts[previousReaction] - 1);
      newCounts.total = Math.max(0, prev.total - 1);
      return newCounts;
    });

    notifyTakeUpdate({
      takeId: take.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });

    try {
      await supabase.from("take_reactions").delete()
        .eq("take_id", take.id)
        .eq("user_id", user.id);
    } catch (err) {
      setUserReaction(take.user_reaction_type);
      setReactionCounts(take.reaction_counts || {
        admire: 0, snap: 0, ovation: 0, support: 0, inspired: 0, applaud: 0,
        total: take.reactions_count || 0,
      });
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    notifyTakeUpdate({
      takeId: take.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

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
  };

  const handleRelay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || take.author_id === user.id) return;

    const newIsRelayed = !isRelayedState;
    const countChange = newIsRelayed ? 1 : -1;

    setIsRelayedState(newIsRelayed);
    setRelayCount(prev => Math.max(0, prev + countChange));

    notifyTakeUpdate({
      takeId: take.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

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
      setIsRelayedState(!newIsRelayed);
      setRelayCount(prev => prev - countChange);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("take_comments").delete().eq("take_id", take.id),
        supabase.from("take_saves").delete().eq("take_id", take.id),
        supabase.from("take_relays").delete().eq("take_id", take.id),
        supabase.from("take_reactions").delete().eq("take_id", take.id),
        supabase.from("notifications").delete().eq("post_id", take.id),
      ]);

      const { error } = await supabase.from("takes").delete().eq("id", take.id);

      if (error) {
        console.error("Error deleting take:", error);
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      if (onTakeDeleted) {
        onTakeDeleted(take.id);
      }
    } catch (err) {
      console.error("Failed to delete take:", err);
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user) return;

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

  const handleBlockUser = async () => {
    if (!user) return;

    setBlockLoading(true);
    const result = await blockUser(user.id, take.author_id);
    if (result.success) {
      setShowBlockConfirm(false);
      if (onTakeDeleted) {
        onTakeDeleted(take.id);
      }
    }
    setBlockLoading(false);
  };

  // Grid variant - compact card for profile page
  if (variant === "grid") {
    return (
      <article
        className="take-grid-card"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleOpenModal}
      >
        <video
          ref={videoRef}
          src={take.video_url}
          poster={take.thumbnail_url || undefined}
          muted
          loop
          playsInline
          className="take-grid-video"
        />

        <div className="take-grid-overlay" />

        {!isHovering && (
          <div className="take-grid-play">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
        )}

        <div className="take-grid-duration">
          {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, '0')}
        </div>

        <div className="take-grid-stats">
          <span>
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
            {formatCount(reactionCounts.total)}
          </span>
        </div>
      </article>
    );
  }

  // Feed variant - full post card matching other post types
  return (
    <>
      <article className="post take-post" onClick={handleOpenModal}>
        {/* Relayed header */}
        {isRelayed && relayedBy && (
          <div className="take-relayed-badge">
            <RelayIcon />
            <Link
              href={`/studio/${relayedBy.username}`}
              onClick={(e) => e.stopPropagation()}
            >
              {relayedBy.display_name || relayedBy.username}
            </Link>
            {" "}relayed
            {relayedAt && <span className="take-relayed-time">· {getTimeAgo(relayedAt)}</span>}
          </div>
        )}

        {/* Author Header - same as posts */}
        <div className="author-header">
          <Link
            href={`/studio/${take.author.username}`}
            onClick={(e) => e.stopPropagation()}
            className="author-avatar-link"
          >
            <Image
              src={take.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
              alt=""
              width={70}
              height={70}
              className="author-avatar"
            />
          </Link>
          <div className="author-info">
            <div className="author-name-line">
              <Link
                href={`/studio/${take.author.username}`}
                onClick={(e) => e.stopPropagation()}
                className="author-name"
              >
                {take.author.display_name || take.author.username}
              </Link>
              <span className="post-type-label">shared a take</span>
            </div>
            <span className="post-time">{getTimeAgo(take.created_at)}</span>
          </div>

          {/* Menu */}
          {isOwner ? (
            <div className="relative" ref={menuRef}>
              <button
                className="post-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <EllipsisIcon />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <TrashIcon />
                    Delete
                  </button>
                </div>
              )}
            </div>
          ) : user ? (
            <div className="relative" ref={menuRef}>
              <button
                className="post-menu-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMenu(!showMenu);
                }}
              >
                <EllipsisIcon />
              </button>
              {showMenu && (
                <div
                  className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-50"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowBlockConfirm(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
                  >
                    <BlockIcon />
                    Block @{take.author.username}
                  </button>
                  <div className="h-px bg-black/[0.06] mx-3" />
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <FlagIcon />
                    Report
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button className="post-menu-btn" onClick={(e) => e.stopPropagation()}>
              <EllipsisIcon />
            </button>
          )}
        </div>

        {/* Video Thumbnail */}
        <div
          className="take-video-container"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <video
            ref={videoRef}
            src={take.video_url}
            poster={take.thumbnail_url || undefined}
            muted
            loop
            playsInline
            className="take-video"
          />

          {!isHovering && (
            <div className="take-play-overlay">
              <div className="take-play-btn">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </div>
            </div>
          )}

          <div className="take-duration-badge">
            {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, '0')}
          </div>

          <div className="take-type-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="8" width="18" height="13" rx="2" />
              <path d="M3 8l3-5h12l3 5" />
              <path d="M12 3v5" />
            </svg>
            Take
          </div>
        </div>

        {/* Caption */}
        {take.caption && (
          <p className="take-caption">
            {take.caption.length > 200 ? `${take.caption.substring(0, 200)}...` : take.caption}
          </p>
        )}

        {/* Actions - same hierarchy as posts */}
        <div className="actions">
          <div className="actions-left">
            <TakeReactionPicker
              currentReaction={userReaction}
              reactionCounts={reactionCounts}
              onReact={handleReaction}
              onRemoveReaction={handleRemoveReaction}
              disabled={!user}
              compact
            />
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}>
              <CommentIcon />
              <span className="action-count">{formatCount(take.comments_count)}</span>
            </button>
            {!isOwner && (
              <button
                className={`action-btn ${isRelayedState ? 'active' : ''}`}
                onClick={handleRelay}
                style={isRelayedState ? { color: '#22c55e' } : undefined}
              >
                <RelayIcon />
                <span className="action-count">{formatCount(relayCount)}</span>
              </button>
            )}
          </div>
          <div className="actions-right">
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}>
              <ShareIcon />
            </button>
            <button className={`action-btn ${isSaved ? 'saved' : ''}`} onClick={handleSave}>
              <BookmarkIcon filled={isSaved} />
            </button>
          </div>
        </div>
      </article>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={takeUrl}
        title={take.caption || "Take"}
        description={take.caption || "Check out this take"}
        type="video"
        authorName={take.author.display_name || take.author.username}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
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

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
            <h3 className="font-display text-xl text-ink mb-3">
              Block @{take.author.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              You won't see their posts anymore. They won't be able to see your posts, follow you, or message you.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlockUser}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {blockLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Blocking...
                  </>
                ) : (
                  "Block"
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
