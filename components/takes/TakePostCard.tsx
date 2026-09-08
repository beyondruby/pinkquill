"use client";

import "./takes.css";
import { formatCount } from "@/lib/utils/format";
import { LazyVideoThumb } from "@/components/feed/LazyVideoThumb";

import { useState, useEffect, useRef } from "react";
import { getTimeAgoCompact as getTimeAgo } from "@/lib/utils/time";
import Link from "next/link";
import Image from "next/image";
import { useModal } from "@/components/providers/ModalProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Take, RelayedTake } from "@/lib/hooks/useTakes";
import { useReaction } from "@/lib/engagement/reactions";
import { useBlock } from "@/lib/hooks/useInteractions";
import { deleteOwnTake } from "@/lib/content-client";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import ReactionPicker from "@/components/feed/ReactionPicker";
import CommentCount from "@/components/feed/CommentCount";
import { supabase } from "@/lib/supabase";
import { submitReport } from "@/lib/reports";
import { actionToast } from "@/lib/utils/toast";
import {
  HeartIcon,
  CommentIcon,
  RelayIcon,
  ShareIcon,
  BookmarkIcon,
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


export default function TakePostCard({ take, isRelayed, relayedBy, variant = "feed", onTakeDeleted }: TakePostCardProps) {
  const { openTakeModal, subscribeToTakeUpdates, notifyTakeUpdate } = useModal();
  const { user } = useAuth();
  const { blockUser } = useBlock();
  const videoRef = useRef<HTMLVideoElement>(null);

  const [isHovering, setIsHovering] = useState(false);
  const reaction = useReaction("take", take.id, {
    seed: { total: take.reactions_count, mine: take.user_reaction_type, counts: take.reaction_counts },
    authorId: take.author_id,
  });
  const [isSaved, setIsSaved] = useState(take.is_saved || false);
  const [isRelayedState, setIsRelayedState] = useState(take.is_relayed || false);
  const [relayCount, setRelayCount] = useState(take.relays_count || 0);
  const [showShareModal, setShowShareModal] = useState(false);
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

      if (update.field === "relays") {
        setIsRelayedState(update.isActive);
        setRelayCount((prev) => Math.max(0, prev + update.countChange));
      } else if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });

    return unsubscribe;
  }, [take.id, subscribeToTakeUpdates]);

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
      reactions_count: reaction.counts.total,
      reaction_counts: reaction.countsLoaded ? reaction.counts : undefined,
      user_reaction_type: reaction.mine,
    });
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
      const { error } = newIsSaved
        ? await supabase.from("take_saves").insert({ take_id: take.id, user_id: user.id })
        : await supabase.from("take_saves").delete().eq("take_id", take.id).eq("user_id", user.id);
      if (error) throw error;
    } catch {
      setIsSaved(!newIsSaved);
      notifyTakeUpdate({ takeId: take.id, field: "saves", isActive: !newIsSaved, countChange: 0 });
      actionToast.genericError(newIsSaved ? "save take" : "unsave take");
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
      const { error } = newIsRelayed
        ? await supabase.from("take_relays").insert({ take_id: take.id, user_id: user.id })
        : await supabase.from("take_relays").delete().eq("take_id", take.id).eq("user_id", user.id);
      if (error) throw error;
    } catch {
      setIsRelayedState(!newIsRelayed);
      setRelayCount(prev => prev - countChange);
      notifyTakeUpdate({ takeId: take.id, field: "relays", isActive: !newIsRelayed, countChange: -countChange });
      actionToast.genericError(newIsRelayed ? "relay take" : "remove relay");
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteOwnTake(take.id);

      setShowDeleteConfirm(false);
      if (onTakeDeleted) {
        onTakeDeleted(take.id);
      }
    } catch (err) {
      console.error("Failed to delete take:", err);
      actionToast.genericError("delete take");
      setDeleting(false);
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user) return;

    setReportSubmitting(true);
    try {
      const ok = await submitReport(
        { type: "take", takeId: take.id, reportedUserId: take.author_id },
        user.id,
        reason,
        details,
      );

      if (!ok) {
        actionToast.reportError();
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      actionToast.reportSubmitted();
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
      actionToast.reportError();
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
    } else {
      actionToast.blockError();
    }
    setBlockLoading(false);
  };

  const takeMenuItems: ActionMenuItem[] = isOwner
    ? [
        {
          label: "Delete",
          onSelect: () => setShowDeleteConfirm(true),
          icon: <TrashIcon />,
          tone: "danger",
        },
      ]
    : user
      ? [
          {
            label: `Block @${take.author.username}`,
            onSelect: () => setShowBlockConfirm(true),
            icon: <BlockIcon />,
          },
          {
            label: "Report",
            onSelect: () => setShowReportModal(true),
            icon: <FlagIcon />,
            tone: "danger",
            dividerBefore: true,
          },
        ]
      : [];

  // Grid variant - compact card for profile page
  if (variant === "grid") {
    return (
      <article
        className="take-grid-card"
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        onClick={handleOpenModal}
      >
        {/* Thumbnail only - no video playback */}
        {take.thumbnail_url ? (
          <img
            src={take.thumbnail_url}
            alt=""
            className="take-grid-thumbnail"
            loading="lazy"
            decoding="async"
          />
        ) : (
          <LazyVideoThumb src={take.video_url} className="take-grid-thumbnail" />
        )}

        {/* Hover overlay with engagement stats */}
        <div className={`take-grid-hover-overlay ${isHovering ? 'visible' : ''}`}>
          <div className="take-grid-hover-stats">
            <span>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
              </svg>
              {formatCount(reaction.counts.total)}
            </span>
            <span>
              <CommentIcon />
              <CommentCount kind="take" id={take.id} total={take.comments_count} format={formatCount} />
            </span>
          </div>
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
          {(isOwner || user) && (
            <ActionMenu
              items={takeMenuItems}
              buttonClassName="post-menu-btn"
              widthClassName={isOwner ? "w-36" : "w-44"}
              buttonAriaLabel="Take options menu"
            />
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
            preload={take.thumbnail_url ? "none" : "metadata"}
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
            <ReactionPicker
              currentReaction={reaction.mine}
              reactionCounts={reaction.counts}
              countsLoaded={reaction.countsLoaded}
              onOpen={reaction.loadCounts}
              onReact={(type) => void reaction.react(type)}
              onRemoveReaction={() => void reaction.unreact()}
              disabled={!user}
            />
            <button className="action-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}>
              <CommentIcon />
              <span className="action-count"><CommentCount kind="take" id={take.id} total={take.comments_count} format={formatCount} /></span>
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
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Take?"
        description="This action cannot be undone. This will permanently delete your take and remove all associated data including comments and reactions."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

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
            className="fixed inset-0 bg-black/50 z-[1000]"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-surface rounded-2xl shadow-2xl z-[1001] p-6">
            <h3 className="font-display text-xl text-ink mb-3">
              Block @{take.author.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              You won&apos;t see their posts anymore. They won&apos;t be able to see your posts, follow you, or message you.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-skeleton/70 hover:bg-skeleton transition-colors disabled:opacity-50"
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
