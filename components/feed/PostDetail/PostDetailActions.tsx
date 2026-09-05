"use client";

import ReactionPicker from "@/components/feed/ReactionPicker";
import { BookmarkIcon, CommentIcon, RelayIcon, ShareIcon } from "@/components/ui/Icons";
import type { ReactionType, ReactionCounts } from "@/lib/types";

interface PostDetailActionsProps {
  signedIn: boolean;
  isOwner: boolean;
  userReaction: ReactionType | null;
  reactionCounts: ReactionCounts;
  onReact: (type: ReactionType) => void;
  onRemoveReaction: () => void;
  commentCount: number;
  onComment: () => void;
  relayCount: number;
  isRelayed: boolean;
  onRelay: () => void;
  onShare: () => void;
  isSaved: boolean;
  onSave: () => void;
}

/**
 * The same quiet action row the feed card uses (`.actions` / `.action-btn`),
 * so a work feels the same wherever it is read. Guests can share; the rest
 * asks them to sign in at the point of action (handled by the callers).
 */
export default function PostDetailActions({
  signedIn,
  isOwner,
  userReaction,
  reactionCounts,
  onReact,
  onRemoveReaction,
  commentCount,
  onComment,
  relayCount,
  isRelayed,
  onRelay,
  onShare,
  isSaved,
  onSave,
}: PostDetailActionsProps) {
  return (
    <div className="actions pq-detail__actions" role="toolbar" aria-label="Post actions">
      <div className="actions-left">
        <ReactionPicker
          currentReaction={userReaction}
          reactionCounts={reactionCounts}
          onReact={onReact}
          onRemoveReaction={onRemoveReaction}
          disabled={!signedIn}
        />
        <button type="button" className="action-btn" onClick={onComment} aria-label={`${commentCount} comments, go to the conversation`}>
          <CommentIcon />
          <span className="action-count">{commentCount}</span>
        </button>
        {!isOwner && (
          <button
            type="button"
            className={`action-btn ${isRelayed ? "active" : ""}`}
            onClick={onRelay}
            disabled={!signedIn}
            aria-pressed={isRelayed}
            aria-label={isRelayed ? `Remove relay, ${relayCount} relays` : `Relay, ${relayCount} relays`}
          >
            <RelayIcon />
            <span className="action-count">{relayCount}</span>
          </button>
        )}
      </div>
      <div className="actions-right">
        <button type="button" className="action-btn" onClick={onShare} aria-label="Share">
          <ShareIcon />
        </button>
        <button
          type="button"
          className={`action-btn ${isSaved ? "saved" : ""}`}
          onClick={onSave}
          disabled={!signedIn}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Remove from saved" : "Save"}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
      </div>
    </div>
  );
}
