"use client";

import React, { useState } from "react";
import { useJoinCommunity, Community } from "@/lib/hooks";
import { supabase } from "@/lib/supabase";
import { getOptimizedAvatarUrl } from "@/lib/utils/image";
import { actionToast } from "@/lib/utils/toast";

interface JoinButtonProps {
  community: Community;
  userId: string;
  onUpdate?: () => void;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function JoinButton({ community, userId, onUpdate, size = 'md', className = '' }: JoinButtonProps) {
  const { join, leave, requestJoin, cancelRequest, isJoining: loading } = useJoinCommunity();
  const [isHovering, setIsHovering] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [invitationLoading, setInvitationLoading] = useState(false);

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (loading) return;

    if (community.is_member) {
      const result = await leave(community.id, userId);
      if (result.success) {
        if (onUpdate) onUpdate();
      } else {
        actionToast.genericError("leave community");
      }
    } else if (community.has_pending_request) {
      const result = await cancelRequest(community.id, userId);
      if (result.success) {
        if (onUpdate) onUpdate();
      } else {
        actionToast.genericError("cancel request");
      }
    } else if (community.privacy === 'private') {
      setShowRequestModal(true);
    } else {
      const result = await join(community.id, userId);
      if (result.success) {
        actionToast.joinedCommunity(community.name);
        if (onUpdate) onUpdate();
      } else {
        actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
      }
    }
  };

  const handleSubmitRequest = async () => {
    const result = await requestJoin(community.id, userId, requestMessage.trim() || undefined);
    if (result.success) {
      actionToast.joinRequestSent();
      setShowRequestModal(false);
      setRequestMessage('');
      if (onUpdate) onUpdate();
    } else {
      actionToast.membershipError(typeof result.error === "string" ? result.error : undefined);
    }
  };

  const handleAcceptInvitation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!community.pending_invitation_id) return;

    setInvitationLoading(true);
    try {
      const { data, error } = await supabase.rpc('accept_community_invitation', {
        p_invitation_id: community.pending_invitation_id,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string } | null;
      if (!result?.ok) {
        actionToast.membershipError(result?.error);
        return;
      }
      actionToast.invitationAccepted(community.name);
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("[JoinButton] Accept invitation error:", err);
      actionToast.membershipError();
    } finally {
      setInvitationLoading(false);
    }
  };

  const handleDeclineInvitation = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!community.pending_invitation_id) return;

    setInvitationLoading(true);
    try {
      const { data, error } = await supabase.rpc('decline_community_invitation', {
        p_invitation_id: community.pending_invitation_id,
      });
      if (error) throw error;
      const result = data as { ok: boolean; error?: string } | null;
      if (!result?.ok) {
        actionToast.membershipError(result?.error);
        return;
      }
      actionToast.invitationDeclined();
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error("[JoinButton] Decline invitation error:", err);
      actionToast.membershipError();
    } finally {
      setInvitationLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-4 py-2 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-sm',
  };

  // Don't show leave button for admins (they need to transfer ownership first)
  if (community.is_member && community.user_role === 'admin') {
    return (
      <button
        disabled
        className={`font-ui font-semibold rounded-full bg-surface/90 text-purple-primary cursor-default shadow-lg ${sizeClasses[size]} ${className}`}
      >
        Admin
      </button>
    );
  }

  if (community.is_member) {
    return (
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        disabled={loading}
        className={`font-ui font-semibold rounded-full transition-all duration-200 shadow-lg ${sizeClasses[size]} ${className} ${
          isHovering
            ? 'bg-surface text-red-500'
            : 'bg-surface/90 text-purple-primary'
        } hover:shadow-xl disabled:opacity-50`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Leaving...
          </span>
        ) : isHovering ? (
          'Leave'
        ) : (
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Joined
          </span>
        )}
      </button>
    );
  }

  if (community.has_pending_request) {
    return (
      <button
        onClick={handleClick}
        onMouseEnter={() => setIsHovering(true)}
        onMouseLeave={() => setIsHovering(false)}
        disabled={loading}
        className={`font-ui font-semibold rounded-full transition-all duration-200 shadow-lg ${sizeClasses[size]} ${className} ${
          isHovering
            ? 'bg-surface text-red-500'
            : 'bg-surface/90 text-orange-500'
        } hover:shadow-xl disabled:opacity-50`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Canceling...
          </span>
        ) : isHovering ? (
          'Cancel'
        ) : (
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending
          </span>
        )}
      </button>
    );
  }

  // User has been invited - show Accept/Decline buttons
  if (community.has_pending_invitation) {
    return (
      <div className={`flex items-center justify-center gap-3 ${className}`}>
        <button
          onClick={handleAcceptInvitation}
          disabled={invitationLoading}
          className={`font-ui font-semibold rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 ${sizeClasses[size]}`}
        >
          {invitationLoading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Joining...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Accept
            </span>
          )}
        </button>
        <button
          onClick={handleDeclineInvitation}
          disabled={invitationLoading}
          className={`font-ui font-semibold rounded-full bg-surface/90 text-muted hover:text-red-500 hover:bg-surface shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 ${sizeClasses[size]}`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Decline
          </span>
        </button>
      </div>
    );
  }

  // Not a member - show Join or Request button
  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className={`font-ui font-semibold rounded-full bg-surface text-purple-primary hover:bg-surface hover:text-pink-vivid shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 disabled:opacity-50 ${sizeClasses[size]} ${className}`}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            {community.privacy === 'private' ? 'Requesting...' : 'Joining...'}
          </span>
        ) : community.privacy === 'private' ? (
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Request to Join
          </span>
        ) : (
          <span className="flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Join
          </span>
        )}
      </button>

      {/* Request to Join Modal */}
      {showRequestModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !loading && setShowRequestModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-md bg-surface rounded-2xl shadow-2xl z-[1001] overflow-hidden animate-fadeIn">
            {/* Header */}
            <div className="relative h-24 bg-gradient-to-br from-purple-primary via-pink-vivid/80 to-orange-warm/60 flex items-center justify-center">
              <div className="absolute inset-0 opacity-20">
                <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <defs>
                    <pattern id="request-pattern" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                      <circle cx="5" cy="5" r="1" fill="white" />
                    </pattern>
                  </defs>
                  <rect width="100" height="100" fill="url(#request-pattern)" />
                </svg>
              </div>
              <div className="relative flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-surface/20 backdrop-blur-sm flex items-center justify-center border border-surface/30 overflow-hidden">
                  {community.avatar_url ? (
                    <img src={getOptimizedAvatarUrl(community.avatar_url, 48)} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <span className="text-white text-lg font-bold">{community.name.charAt(0)}</span>
                  )}
                </div>
                <div className="text-white">
                  <p className="font-ui text-xs text-white/70">Request to join</p>
                  <h3 className="font-display text-lg font-bold">{community.name}</h3>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              <label className="block font-ui text-sm font-medium text-ink mb-2">
                Message to admins <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                placeholder="Tell the community why you'd like to join..."
                rows={3}
                maxLength={500}
                className="w-full px-4 py-3 rounded-xl bg-subtle border border-border-light font-body text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20 focus:border-purple-primary/30 transition-all resize-none"
                disabled={loading}
              />
              <p className="mt-2 font-ui text-xs text-muted text-right">
                {requestMessage.length}/500
              </p>

              <div className="flex items-center gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowRequestModal(false);
                    setRequestMessage('');
                  }}
                  disabled={loading}
                  className="flex-1 px-5 py-2.5 rounded-full bg-skeleton text-ink font-ui font-medium hover:bg-black/10 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitRequest}
                  disabled={loading}
                  className="flex-1 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-medium hover:shadow-lg hover:shadow-pink-vivid/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Sending...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Send Request
                    </>
                  )}
                </button>
              </div>

              <p className="mt-4 text-center font-ui text-xs text-muted">
                The community admin will review your request
              </p>
            </div>
          </div>
        </>
      )}
    </>
  );
}
