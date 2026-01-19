"use client";

import { useState } from "react";
import Link from "next/link";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheck,
  faTimes,
  faSpinner,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import type { CommunityInvitation } from "@/lib/types";

interface CommunityInviteCardProps {
  invite: CommunityInvitation;
  onAccept: (inviteId: string, communityId: string) => Promise<{ success: boolean }>;
  onDecline: (inviteId: string) => Promise<{ success: boolean }>;
  onRespond?: () => void;
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

export default function CommunityInviteCard({
  invite,
  onAccept,
  onDecline,
  onRespond,
}: CommunityInviteCardProps) {
  const [responding, setResponding] = useState(false);
  const [responseType, setResponseType] = useState<"accept" | "decline" | null>(null);

  const handleAccept = async () => {
    setResponding(true);
    setResponseType("accept");
    const result = await onAccept(invite.id, invite.community_id);
    if (result.success) {
      onRespond?.();
    }
    setResponding(false);
  };

  const handleDecline = async () => {
    setResponding(true);
    setResponseType("decline");
    const result = await onDecline(invite.id);
    if (result.success) {
      onRespond?.();
    }
    setResponding(false);
  };

  // If we don't have valid data, don't render
  if (!invite.community || !invite.inviter) {
    return null;
  }

  return (
    <div className="community-invite-card bg-white rounded-xl border border-black/[0.06] overflow-hidden shadow-sm">
      {/* Decorative gradient bar */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm" />

      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-black/[0.04]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
          <FontAwesomeIcon icon={faUsers} className="w-4 h-4 text-purple-primary" />
        </div>
        <span className="font-ui text-sm font-semibold text-ink">Community Invite</span>
        <span className="ml-auto font-ui text-xs text-muted">{formatTimeAgo(invite.created_at)}</span>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Inviter info */}
        <div className="flex items-center gap-3 mb-4">
          <Link href={`/studio/${invite.inviter.username}`} className="flex-shrink-0">
            {invite.inviter.avatar_url ? (
              <img
                src={invite.inviter.avatar_url}
                alt={invite.inviter.display_name || invite.inviter.username}
                className="w-10 h-10 rounded-full object-cover hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white font-medium">
                {(invite.inviter.display_name || invite.inviter.username)[0].toUpperCase()}
              </div>
            )}
          </Link>
          <div className="flex-1 min-w-0">
            <Link href={`/studio/${invite.inviter.username}`} className="font-ui text-sm font-medium text-ink hover:text-purple-primary transition-colors">
              {invite.inviter.display_name || invite.inviter.username}
            </Link>
            <span className="font-body text-sm text-muted block">
              invited you to join a community
            </span>
          </div>
        </div>

        {/* Community Preview */}
        <Link
          href={`/community/${invite.community.slug}`}
          className="block p-3 rounded-xl bg-black/[0.02] hover:bg-black/[0.04] transition-colors"
        >
          <div className="flex items-center gap-3">
            {invite.community.avatar_url ? (
              <img
                src={invite.community.avatar_url}
                alt={invite.community.name}
                className="w-12 h-12 rounded-xl object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                <FontAwesomeIcon icon={faUsers} className="w-6 h-6 text-white" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h4 className="font-display text-base font-semibold text-ink truncate">
                {invite.community.name}
              </h4>
              <p className="font-ui text-xs text-muted">
                /community/{invite.community.slug}
              </p>
            </div>
          </div>
        </Link>
      </div>

      {/* Actions */}
      <div className="flex gap-3 p-4 pt-0">
        <button
          onClick={handleAccept}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-semibold hover:shadow-lg hover:shadow-purple-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {responding && responseType === "accept" ? (
            <FontAwesomeIcon icon={faSpinner} spin className="w-4 h-4" />
          ) : (
            <>
              <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
              Join Community
            </>
          )}
        </button>
        <button
          onClick={handleDecline}
          disabled={responding}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-black/[0.05] text-muted font-ui text-sm font-semibold hover:bg-black/[0.08] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
