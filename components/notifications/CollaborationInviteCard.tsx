"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTimes,
  faSpinner,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { CollaborationInvite, useCollaborationInvites } from "@/lib/hooks";

interface CollaborationInviteCardProps {
  invite: CollaborationInvite;
  userId: string;
  onRespond?: () => void;
}

// Helper to get post type label
function getPostTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    poem: "poem",
    journal: "journal entry",
    thought: "thought",
    essay: "essay",
    story: "story",
    letter: "letter",
    quote: "quote",
    visual: "visual post",
    audio: "voice note",
    video: "video",
    screenplay: "screenplay",
  };
  return labels[type] || "post";
}

// Helper to get excerpt from HTML content
function getExcerpt(content: string, maxLength: number = 100): string {
  const text = content.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ");
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Helper to format time ago
function formatTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function CollaborationInviteCard({
  invite,
  userId,
  onRespond,
}: CollaborationInviteCardProps) {
  const [responding, setResponding] = useState(false);
  const [responseType, setResponseType] = useState<"accept" | "decline" | null>(null);
  const { accept, decline } = useCollaborationInvites(userId);

  // Defensive check for missing data - must come after hooks
  if (!invite?.post?.author) {
    return null;
  }

  const handleAccept = async () => {
    setResponding(true);
    setResponseType("accept");
    const result = await accept(invite.post_id, invite.post.author.id);
    if (result.success) {
      onRespond?.();
    }
    setResponding(false);
  };

  const handleDecline = async () => {
    setResponding(true);
    setResponseType("decline");
    const result = await decline(invite.post_id, invite.post.author.id);
    if (result.success) {
      onRespond?.();
    }
    setResponding(false);
  };

  const author = invite.post.author;
  const postTypeLabel = getPostTypeLabel(invite.post.type);
  const excerpt = getExcerpt(invite.post.content || "");

  return (
    <div className="collab-invite-card">
      {/* Decorative gradient bar */}
      <div className="collab-invite-gradient" />

      {/* Header */}
      <div className="collab-invite-header">
        <div className="collab-invite-icon">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <span className="collab-invite-title">Collaboration Invite</span>
        <span className="collab-invite-time">{formatTimeAgo(invite.invited_at)}</span>
      </div>

      {/* Content */}
      <div className="collab-invite-content">
        <div className="collab-invite-author">
          <Link href={`/studio/${author.username}`} className="collab-invite-avatar-link">
            {author.avatar_url ? (
              <img
                src={author.avatar_url}
                alt={author.display_name || author.username}
                className="collab-invite-avatar"
              />
            ) : (
              <div className="collab-invite-avatar collab-invite-avatar-placeholder">
                {(author.display_name || author.username)[0].toUpperCase()}
              </div>
            )}
          </Link>
          <div className="collab-invite-author-info">
            <Link href={`/studio/${author.username}`} className="collab-invite-author-name">
              {author.display_name || author.username}
            </Link>
            <span className="collab-invite-action-text">
              invited you to collaborate on their {postTypeLabel}
            </span>
          </div>
        </div>

        {/* Post Preview */}
        <div className="collab-invite-preview">
          {invite.post.title && (
            <h4 className="collab-invite-preview-title">{invite.post.title}</h4>
          )}
          <p className="collab-invite-preview-text">{excerpt}</p>
        </div>

        {/* Preview Link */}
        <Link href={`/post/${invite.post_id}?preview=true`} className="collab-invite-preview-link">
          <FontAwesomeIcon icon={faEye} className="w-3.5 h-3.5" />
          Preview Post
        </Link>
      </div>

      {/* Actions */}
      <div className="collab-invite-actions">
        <button
          onClick={handleAccept}
          disabled={responding}
          className="collab-invite-btn collab-invite-btn-accept"
        >
          {responding && responseType === "accept" ? (
            <FontAwesomeIcon icon={faSpinner} spin className="w-4 h-4" />
          ) : (
            <>
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
              Accept
            </>
          )}
        </button>
        <button
          onClick={handleDecline}
          disabled={responding}
          className="collab-invite-btn collab-invite-btn-decline"
        >
          {responding && responseType === "decline" ? (
            <FontAwesomeIcon icon={faSpinner} spin className="w-4 h-4" />
          ) : (
            <>
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
              Decline
            </>
          )}
        </button>
      </div>
    </div>
  );
}
