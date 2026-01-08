"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import Link from "next/link";
import TakePlayer from "./TakePlayer";
import TakeReactionPicker from "./TakeReactionPicker";
import ReportModal from "@/components/ui/ReportModal";
import ShareModal from "@/components/ui/ShareModal";
import { Take, TakeReactionType, TakeReactionCounts } from "@/lib/hooks/useTakes";

interface TakeCardProps {
  take: Take;
  isActive: boolean;
  isMuted: boolean;
  volume: number;
  isFollowing: boolean;
  isOwnTake: boolean;
  reactionCounts: TakeReactionCounts;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onToggleAdmire: () => void;
  onToggleReaction: (type: TakeReactionType) => void;
  onToggleSave: () => void;
  onToggleRelay: () => void;
  onToggleFollow: () => void;
  onOpenComments: () => void;
  onDelete?: () => void;
  onReport?: (reason: string, details?: string) => Promise<void>;
}

function formatCount(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "K";
  return String(n);
}

function getWordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function TakeCard({
  take,
  isActive,
  isMuted,
  volume,
  isFollowing,
  isOwnTake,
  reactionCounts,
  onToggleMute,
  onVolumeChange,
  onToggleAdmire,
  onToggleReaction,
  onToggleSave,
  onToggleRelay,
  onToggleFollow,
  onOpenComments,
  onDelete,
  onReport,
}: TakeCardProps) {
  const [showHeart, setShowHeart] = useState(false);
  const [heartPosition, setHeartPosition] = useState({ x: 0, y: 0 });
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showContent, setShowContent] = useState(!take.content_warning);

  // Generate the Take URL for sharing
  const takeUrl = typeof window !== "undefined"
    ? `${window.location.origin}/take/${take.id}`
    : `/take/${take.id}`;

  const menuRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef<HTMLDivElement>(null);

  const handleDoubleTap = useCallback((e?: React.MouseEvent) => {
    if (!take.is_admired) {
      onToggleAdmire();
    }
    if (e) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setHeartPosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    } else {
      setHeartPosition({ x: 50, y: 50 });
    }
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 800);
  }, [take.is_admired, onToggleAdmire]);

  const caption = take.caption || "";
  const wordCount = getWordCount(caption);
  const shouldTruncate = wordCount > 10;

  const getTruncatedCaption = () => {
    if (!shouldTruncate || captionExpanded) return caption;
    const words = caption.trim().split(/\s+/);
    return words.slice(0, 10).join(" ") + "...";
  };

  // Click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (volumeRef.current && !volumeRef.current.contains(event.target as Node)) {
        setShowVolumeSlider(false);
      }
    };

    if (showMenu || showVolumeSlider) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showMenu, showVolumeSlider]);

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete();
    } catch (err) {
      console.error("Failed to delete take:", err);
    }
    setDeleting(false);
    setShowDeleteConfirm(false);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!onReport) return;
    setReportSubmitting(true);
    try {
      await onReport(reason, details);
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to report take:", err);
    }
    setReportSubmitting(false);
  };

  return (
    <div className="tiktok-take">
      {/* Video Container */}
      <div className="tiktok-take-video">
        <TakePlayer
          src={take.video_url}
          isActive={isActive && showContent}
          isMuted={isMuted}
          volume={volume}
          onDoubleTap={() => handleDoubleTap()}
          onToggleMute={onToggleMute}
        />

        {/* Double-tap heart */}
        {showHeart && (
          <div
            className="tiktok-heart-burst"
            style={{ left: `${heartPosition.x}px`, top: `${heartPosition.y}px` }}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
          </div>
        )}

        {/* Content Warning Overlay */}
        {take.content_warning && !showContent && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl">
            <div className="flex flex-col items-center gap-4 p-6 max-w-[280px] text-center">
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

        {/* Bottom gradient */}
        <div className="tiktok-gradient-bottom" />

        {/* Top controls - show on hover */}
        <div className="tiktok-top-controls">
          {/* Left side - Mute & Volume */}
          <div className="tiktok-volume-control" ref={volumeRef}>
            <button
              className="tiktok-mute-btn"
              onClick={onToggleMute}
              onMouseEnter={() => setShowVolumeSlider(true)}
            >
              {isMuted ? (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                </svg>
              )}
            </button>

            {/* Horizontal volume slider */}
            {showVolumeSlider && (
              <div
                className="tiktok-volume-slider"
                onMouseLeave={() => setShowVolumeSlider(false)}
              >
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    const newVolume = parseFloat(e.target.value);
                    onVolumeChange(newVolume);
                    if (newVolume > 0 && isMuted) {
                      onToggleMute();
                    }
                  }}
                  className="tiktok-volume-range"
                />
              </div>
            )}
          </div>

          {/* Right side - 3 dots menu (horizontal) */}
          <div className="tiktok-top-menu" ref={menuRef}>
            <button
              className="tiktok-menu-btn"
              onClick={() => setShowMenu(!showMenu)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {showMenu && (
              <div className="tiktok-menu-dropdown">
                {isOwnTake ? (
                  <button
                    className="tiktok-menu-item delete"
                    onClick={() => {
                      setShowMenu(false);
                      setShowDeleteConfirm(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                    </svg>
                    Delete Take
                  </button>
                ) : (
                  <button
                    className="tiktok-menu-item"
                    onClick={() => {
                      setShowMenu(false);
                      setShowReportModal(true);
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
                      <line x1="4" y1="22" x2="4" y2="15" />
                    </svg>
                    Report
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Bottom content */}
        <div className="tiktok-bottom-content">
          {/* Username */}
          <Link href={`/studio/${take.author.username}`} className="tiktok-username">
            @{take.author.username}
          </Link>

          {/* Caption */}
          {caption && (
            <div className="tiktok-caption">
              <span>{getTruncatedCaption()}</span>
              {shouldTruncate && (
                <button
                  className="tiktok-caption-toggle"
                  onClick={() => setCaptionExpanded(!captionExpanded)}
                >
                  {captionExpanded ? " less" : " more"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right sidebar actions */}
      <div className="tiktok-actions">
        {/* Profile avatar */}
        <div className="tiktok-action-profile">
          <Link href={`/studio/${take.author.username}`} className="tiktok-profile-link">
            {take.author.avatar_url ? (
              <img src={take.author.avatar_url} alt={take.author.username} />
            ) : (
              <div className="tiktok-profile-placeholder">
                {take.author.username[0]?.toUpperCase()}
              </div>
            )}
          </Link>
          {!isOwnTake && !isFollowing && (
            <button className="tiktok-follow-btn" onClick={onToggleFollow}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
              </svg>
            </button>
          )}
        </div>

        {/* Reactions - using ReactionPicker */}
        <TakeReactionPicker
          currentReaction={take.user_reaction_type}
          reactionCounts={reactionCounts}
          onReact={onToggleReaction}
        />

        {/* Comments */}
        <button className="tiktok-action-btn" onClick={onOpenComments}>
          <div className="tiktok-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
            </svg>
          </div>
          <span>{formatCount(take.comments_count)}</span>
        </button>

        {/* Save */}
        <button
          className={`tiktok-action-btn ${take.is_saved ? "saved" : ""}`}
          onClick={onToggleSave}
        >
          <div className="tiktok-action-icon">
            <svg viewBox="0 0 24 24" fill={take.is_saved ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
              <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <span>{formatCount(take.saves_count)}</span>
        </button>

        {/* Relay (Repost) - Only show for other people's takes */}
        {!isOwnTake && (
          <button
            className={`tiktok-action-btn ${take.is_relayed ? "relayed" : ""}`}
            onClick={onToggleRelay}
          >
            <div className="tiktok-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M17 1l4 4-4 4" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <path d="M7 23l-4-4 4-4" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <span>{formatCount(take.relays_count)}</span>
          </button>
        )}

        {/* Share */}
        <button className="tiktok-action-btn" onClick={() => setShowShareModal(true)}>
          <div className="tiktok-action-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
          </div>
          <span>Share</span>
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[1000] animate-fadeIn"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[1001] p-6 animate-scaleIn">
            <h3 className="font-display text-xl text-ink mb-3">Delete Take?</h3>
            <p className="font-body text-sm text-muted mb-6">
              This action cannot be undone. This will permanently delete your Take and remove all associated data including comments, reactions, and saves.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl font-ui text-sm text-muted hover:text-ink border border-black/10 hover:border-black/20 transition-all disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-xl font-ui text-sm font-medium text-white bg-gradient-to-r from-red-500 to-pink-500 shadow-md hover:shadow-lg hover:scale-[1.02] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={takeUrl}
        title={take.caption || "Check out this Take"}
        description={take.caption || ""}
        type="take"
        authorName={take.author.display_name || take.author.username}
      />
    </div>
  );
}
