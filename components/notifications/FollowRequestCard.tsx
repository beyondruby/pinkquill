"use client";

import { useState } from "react";
import Link from "next/link";
import type { FollowRequest } from "@/lib/hooks";

interface FollowRequestCardProps {
  request: FollowRequest;
  onAccept: (requesterId: string) => Promise<void>;
  onDecline: (requesterId: string) => Promise<void>;
}

export default function FollowRequestCard({
  request,
  onAccept,
  onDecline,
}: FollowRequestCardProps) {
  const [accepting, setAccepting] = useState(false);
  const [declining, setDeclining] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    await onAccept(request.follower_id);
    setAccepting(false);
  };

  const handleDecline = async () => {
    setDeclining(true);
    await onDecline(request.follower_id);
    setDeclining(false);
  };

  // Defensive check for missing data
  if (!request?.requester) {
    return null;
  }

  const requester = request.requester;
  const timeAgo = getTimeAgo(request.requested_at || new Date().toISOString());

  return (
    <div className="bg-white rounded-2xl border border-black/[0.06] p-4 hover:border-purple-primary/20 transition-all">
      {/* Header with gradient accent */}
      <div className="h-1 w-full bg-gradient-to-r from-purple-primary via-pink-vivid to-warm-orange rounded-full mb-4 -mt-4 -mx-4 px-4" style={{ width: 'calc(100% + 2rem)', marginLeft: '-1rem' }} />

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Link href={`/studio/${requester.username}`} className="flex-shrink-0">
          <img
            src={requester.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
            alt={requester.display_name || requester.username}
            className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-md"
          />
        </Link>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={`/studio/${requester.username}`}
              className="font-ui text-[0.95rem] font-medium text-ink hover:text-purple-primary transition-colors"
            >
              {requester.display_name || requester.username}
            </Link>
            <span className="font-ui text-sm text-muted">@{requester.username}</span>
          </div>

          {requester.bio && (
            <p className="font-body text-sm text-muted mt-1 line-clamp-2">
              {requester.bio}
            </p>
          )}

          <p className="font-ui text-xs text-purple-primary mt-2">
            requested to follow you <span className="text-muted">· {timeAgo}</span>
          </p>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleAccept}
              disabled={accepting || declining}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:shadow-lg hover:shadow-purple-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            >
              {accepting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Accepting...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Accept
                </>
              )}
            </button>

            <button
              onClick={handleDecline}
              disabled={accepting || declining}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-black/10 bg-white text-ink font-ui text-sm font-medium hover:border-black/20 hover:bg-black/[0.02] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {declining ? (
                <>
                  <div className="w-4 h-4 border-2 border-ink border-t-transparent rounded-full animate-spin" />
                  Declining...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Decline
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper function for time ago
function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}
