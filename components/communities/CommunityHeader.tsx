"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Community, CommunityTag } from "@/lib/hooks";
import JoinButton from "./JoinButton";
import ReportModal from "@/components/ui/ReportModal";
import { supabase } from "@/lib/supabase";

interface CommunityHeaderProps {
  community: Community;
  tags: CommunityTag[];
  userId?: string;
  onUpdate?: () => void;
}

function formatCount(count: number): string {
  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(/\.0$/, '') + 'm';
  }
  if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  }
  return count.toString();
}

export default function CommunityHeader({ community, tags, userId, onUpdate }: CommunityHeaderProps) {
  const pathname = usePathname();
  const [showMenu, setShowMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleReportSubmit = async (reason: string, details?: string) => {
    if (!userId) return;
    setReportSubmitting(true);
    try {
      // Store community report with community info in reason since there's no reported_community_id column
      const fullReason = `[Community: ${community.name} (${community.id})] ${reason}${details ? ` - ${details}` : ""}`;
      await supabase.from("reports").insert({
        reporter_id: userId,
        reason: fullReason,
        type: "community",
        status: "pending",
      });
      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleReportClose = () => {
    setShowReportModal(false);
    setReportSubmitted(false);
  };

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

  const handleShare = async () => {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setShowMenu(false);
    }, 1500);
  };

  const isAdmin = community.user_role === 'admin';
  const isMod = community.user_role === 'moderator';

  // Determine active tab
  const basePath = `/community/${community.slug}`;
  const isPostsActive = pathname === basePath;
  const isAboutActive = pathname === `${basePath}/about`;
  const isMembersActive = pathname === `${basePath}/members`;
  const isSettingsActive = pathname.startsWith(`${basePath}/settings`);

  return (
    <div className="relative">
      {/* Full Width Hero Section */}
      <div className="relative h-48 md:h-72 w-full overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/80 via-pink-vivid/60 to-orange-warm/50" />

        {/* Cover image */}
        {community.cover_url && (
          <img
            src={community.cover_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
        )}

        {/* Top right - Menu button */}
        <div className="absolute top-3 right-3 md:top-6 md:right-6 z-20" ref={menuRef}>
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-white/20 backdrop-blur-sm hover:bg-white/30 flex items-center justify-center text-white transition-all border border-white/20"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="2" />
              <circle cx="12" cy="12" r="2" />
              <circle cx="19" cy="12" r="2" />
            </svg>
          </button>

          {showMenu && (
            <div className="absolute right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl shadow-black/15 border border-ink/5 overflow-hidden z-50 animate-fadeIn">
              {/* Horizontal menu items */}
              <div className="flex items-center p-1.5 md:p-2 gap-1">
                <button
                  onClick={handleShare}
                  className="flex flex-col items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-ink/70 hover:bg-ink/5 hover:text-ink transition-all min-w-[60px] md:min-w-[72px]"
                >
                  {copied ? (
                    <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
                      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
                      <path d="M16 6l-4-4-4 4" />
                      <path d="M12 2v13" />
                    </svg>
                  )}
                  <span className="font-ui text-xs font-medium">{copied ? 'Copied!' : 'Share'}</span>
                </button>

                {/* Settings - for admins/mods only */}
                {(isAdmin || isMod) && (
                  <>
                    <div className="w-px h-10 bg-ink/10" />
                    <Link
                      href={`/community/${community.slug}/settings`}
                      onClick={() => setShowMenu(false)}
                      className="flex flex-col items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-ink/70 hover:bg-purple-primary/5 hover:text-purple-primary transition-all min-w-[60px] md:min-w-[72px]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span className="font-ui text-xs font-medium">Settings</span>
                    </Link>
                  </>
                )}

                {/* Report - for logged in users who are not admin */}
                {userId && !isAdmin && (
                  <>
                    <div className="w-px h-10 bg-ink/10" />
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        setShowReportModal(true);
                      }}
                      className="flex flex-col items-center gap-1 md:gap-1.5 px-3 md:px-4 py-2.5 md:py-3 rounded-xl text-ink/70 hover:bg-red-50 hover:text-red-500 transition-all min-w-[60px] md:min-w-[72px]"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                      </svg>
                      <span className="font-ui text-xs font-medium">Report</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Top left badges */}
        <div className="absolute top-3 left-3 md:top-6 md:left-6 flex items-center gap-1.5 md:gap-3 z-10">
          {/* Privacy badge */}
          <div className="px-2.5 py-1 md:px-4 md:py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 flex items-center gap-1.5">
            {community.privacy === 'private' ? (
              <>
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span className="font-ui text-[10px] md:text-xs font-semibold text-white">Private</span>
              </>
            ) : (
              <>
                <svg className="w-3 h-3 md:w-3.5 md:h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                <span className="font-ui text-[10px] md:text-xs font-semibold text-white">Public</span>
              </>
            )}
          </div>

          {/* Role badge */}
          {community.is_member && (
            <div className="px-2.5 py-1 md:px-4 md:py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 flex items-center gap-1.5">
              <div className={`w-1.5 h-1.5 rounded-full ${
                community.user_role === 'admin'
                  ? 'bg-orange-warm'
                  : community.user_role === 'moderator'
                  ? 'bg-white'
                  : 'bg-emerald-400'
              }`} />
              <span className="font-ui text-[10px] md:text-xs font-semibold text-white capitalize">
                {community.user_role || 'Member'}
              </span>
            </div>
          )}
        </div>

        {/* Main content - positioned at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-4 md:px-12 lg:px-16 pb-6 md:pb-8">
          <div className="max-w-7xl mx-auto flex items-end gap-3 md:gap-8">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="absolute -inset-1 bg-white/30 rounded-full blur-sm" />
              <div className="relative w-16 h-16 md:w-32 md:h-32 rounded-full overflow-hidden border-3 border-white/40 shadow-2xl">
                {community.avatar_url ? (
                  <img
                    src={community.avatar_url}
                    alt={community.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <span className="text-white text-3xl md:text-4xl font-display font-bold drop-shadow-lg">
                      {community.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-xl md:text-4xl lg:text-5xl font-bold text-white tracking-tight drop-shadow-lg line-clamp-1">
                {community.name}
              </h1>

              {community.description && (
                <p className="hidden md:block font-body text-lg text-white/80 mt-2 line-clamp-1 max-w-2xl">
                  {community.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 md:gap-6 mt-2 md:mt-4">
                <Link
                  href={`/community/${community.slug}/members`}
                  className="group flex items-center gap-1.5 md:gap-2"
                >
                  <span className="font-display text-base md:text-2xl font-bold text-white">
                    {formatCount(community.member_count || 0)}
                  </span>
                  <span className="font-ui text-xs md:text-sm text-white/70 group-hover:text-white transition-colors">
                    members
                  </span>
                </Link>
              </div>
            </div>

            {/* Actions */}
            <div className="hidden md:flex items-center gap-3 pb-2">
              {/* Create Post button - only for active members */}
              {community.is_member && community.user_status === 'active' && (
                <Link
                  href={`/create?community=${community.slug}`}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 text-white font-ui text-sm font-medium hover:bg-white/30 transition-all"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Create Post
                </Link>
              )}
              {userId && (
                <JoinButton
                  community={community}
                  userId={userId}
                  onUpdate={onUpdate}
                  size="lg"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Separate Tab Navigation Bar */}
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-xl border-b border-ink/5 shadow-sm safe-area-top">
        <div className="max-w-7xl mx-auto px-3 md:px-12 lg:px-16">
          <div className="flex items-center justify-between gap-1.5">
            {/* Tabs — scrollable on mobile, min-w-0 enables overflow */}
            <nav className="flex-1 min-w-0 flex items-center gap-0 overflow-x-auto scrollbar-hide">
              <Link
                href={`/community/${community.slug}`}
                className={`relative shrink-0 px-3 md:px-5 py-3.5 md:py-4 font-ui text-[13px] md:text-sm font-medium transition-all ${
                  isPostsActive
                    ? 'text-purple-primary'
                    : 'text-ink/50 hover:text-ink'
                }`}
              >
                <span className="relative z-10">Posts</span>
                {isPostsActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                )}
              </Link>
              <Link
                href={`/community/${community.slug}/about`}
                className={`relative shrink-0 px-3 md:px-5 py-3.5 md:py-4 font-ui text-[13px] md:text-sm font-medium transition-all ${
                  isAboutActive
                    ? 'text-purple-primary'
                    : 'text-ink/50 hover:text-ink'
                }`}
              >
                <span className="relative z-10">About</span>
                {isAboutActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                )}
              </Link>
              <Link
                href={`/community/${community.slug}/members`}
                className={`relative shrink-0 px-3 md:px-5 py-3.5 md:py-4 font-ui text-[13px] md:text-sm font-medium transition-all ${
                  isMembersActive
                    ? 'text-purple-primary'
                    : 'text-ink/50 hover:text-ink'
                }`}
              >
                <span className="relative z-10">Members</span>
                {isMembersActive && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                )}
              </Link>
              {(isAdmin || isMod) && (
                <Link
                  href={`/community/${community.slug}/settings`}
                  className={`relative shrink-0 px-3 md:px-5 py-3.5 md:py-4 font-ui text-[13px] md:text-sm font-medium transition-all ${
                    isSettingsActive
                      ? 'text-purple-primary'
                      : 'text-ink/50 hover:text-ink'
                  }`}
                >
                  <span className="relative z-10">Settings</span>
                  {isSettingsActive && (
                    <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                  )}
                </Link>
              )}
            </nav>

            {/* Mobile actions — shrink-0 so they never get pushed off */}
            <div className="flex md:hidden items-center gap-1.5 shrink-0">
              {community.is_member && community.user_status === 'active' && (
                <Link
                  href={`/create?community=${community.slug}`}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                  aria-label="Create post"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                </Link>
              )}
              {userId && (
                <JoinButton
                  community={community}
                  userId={userId}
                  onUpdate={onUpdate}
                  size="sm"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={handleReportClose}
        onSubmit={handleReportSubmit}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
        title="Report this community"
        placeholder="What's wrong with this community..."
      />
    </div>
  );
}
