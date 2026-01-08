"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import TakeCard from "./TakeCard";
import TakeCommentsPanel from "./TakeCommentsPanel";
import { useTakes, useMuted, useFollow, useVolume } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTrackTakeView, useTrackTakeImpression, getSessionId } from "@/lib/hooks/useTracking";
import { supabase } from "@/lib/supabase";

interface TakesFeedProps {
  communityId?: string;
  soundId?: string;
  authorId?: string;
  initialTakeId?: string;
}

export default function TakesFeed({
  communityId,
  soundId,
  authorId,
  initialTakeId,
}: TakesFeedProps) {
  const { user } = useAuth();
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentsTakeId, setCommentsTakeId] = useState<string | null>(null);

  const {
    takes,
    loading,
    error,
    hasMore,
    fetchMore,
    toggleAdmire,
    toggleReaction,
    toggleSave,
    toggleRelay,
    deleteTake,
    reportTake,
  } = useTakes(user?.id, { communityId, soundId, authorId });


  const { isMuted, toggle: toggleMute } = useMuted();
  const { volume, setVolume } = useVolume();
  const { following, checkFollowing, toggle: toggleFollow } = useFollow(user?.id);

  useEffect(() => {
    if (takes.length > 0 && user?.id) {
      const authorIds = [...new Set(takes.map(t => t.author_id))];
      checkFollowing(authorIds);
    }
  }, [takes, user?.id, checkFollowing]);

  // Track take views when active take changes
  const lastTrackedTakeId = useRef<string | null>(null);
  const watchStartTime = useRef<number | null>(null);

  useEffect(() => {
    const activeTake = takes[activeIndex];
    if (!activeTake) return;

    // Track new take
    if (activeTake.id !== lastTrackedTakeId.current) {
      // Save watch time for previous take
      if (lastTrackedTakeId.current && watchStartTime.current) {
        const watchDuration = Math.floor((Date.now() - watchStartTime.current) / 1000);
        const sessionId = getSessionId();

        // Update previous take's watch time
        supabase.from("take_views").upsert({
          take_id: lastTrackedTakeId.current,
          viewer_id: user?.id || null,
          session_id: user?.id ? null : sessionId,
          source: "feed",
          watch_time_seconds: watchDuration,
        }, {
          onConflict: user?.id ? "take_id,viewer_id,view_date" : "take_id,session_id,view_date",
        });
      }

      // Record impression for new take
      const sessionId = getSessionId();
      supabase.from("take_impressions").insert({
        take_id: activeTake.id,
        viewer_id: user?.id || null,
        session_id: user?.id ? null : sessionId,
        source: "feed",
      });

      // Record view after 3 seconds
      const viewTimer = setTimeout(() => {
        supabase.from("take_views").upsert({
          take_id: activeTake.id,
          viewer_id: user?.id || null,
          session_id: user?.id ? null : sessionId,
          source: "feed",
          is_follower: following.has(activeTake.author_id),
        }, {
          onConflict: user?.id ? "take_id,viewer_id,view_date" : "take_id,session_id,view_date",
          ignoreDuplicates: true,
        });
      }, 3000);

      lastTrackedTakeId.current = activeTake.id;
      watchStartTime.current = Date.now();

      return () => clearTimeout(viewTimer);
    }
  }, [activeIndex, takes, user?.id, following]);

  useEffect(() => {
    if (initialTakeId && takes.length > 0) {
      const index = takes.findIndex(t => t.id === initialTakeId);
      if (index !== -1) {
        setActiveIndex(index);
        const el = cardRefs.current.get(initialTakeId);
        el?.scrollIntoView({ behavior: "instant" });
      }
    }
  }, [initialTakeId, takes]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const takeId = entry.target.getAttribute("data-take-id");
            if (takeId) {
              const index = takes.findIndex(t => t.id === takeId);
              if (index !== -1) setActiveIndex(index);
            }
          }
        });
      },
      { root: feedRef.current, threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [takes]);

  useEffect(() => {
    if (activeIndex >= takes.length - 2 && hasMore && !loading) {
      fetchMore();
    }
  }, [activeIndex, takes.length, hasMore, loading, fetchMore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentsPanelOpen) return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (activeIndex < takes.length - 1) {
            const nextTake = takes[activeIndex + 1];
            cardRefs.current.get(nextTake.id)?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (activeIndex > 0) {
            const prevTake = takes[activeIndex - 1];
            cardRefs.current.get(prevTake.id)?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        case "m":
          toggleMute();
          break;
        case "l":
          if (takes[activeIndex]) toggleAdmire(takes[activeIndex].id);
          break;
        case "c":
          if (takes[activeIndex]) {
            setCommentsTakeId(takes[activeIndex].id);
            setCommentsPanelOpen(true);
          }
          break;
        case "Escape":
          setCommentsPanelOpen(false);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeIndex, takes, commentsPanelOpen, toggleMute, toggleAdmire]);

  const handleOpenComments = useCallback((takeId: string) => {
    setCommentsTakeId(takeId);
    setCommentsPanelOpen(true);
  }, []);

  const setCardRef = useCallback((takeId: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(takeId, el);
    else cardRefs.current.delete(takeId);
  }, []);

  // Loading state
  if (loading && takes.length === 0) {
    return (
      <div className="tiktok-feed-container">
        <div className="aura-blob blob-1" />
        <div className="aura-blob blob-2" />
        <div className="aura-blob blob-3" />
        <div className="tiktok-status">
          <div className="takes-loading-quill">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="loadingQuillGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8e44ad">
                    <animate
                      attributeName="stop-color"
                      values="#8e44ad;#ff007f;#ff9f43;#8e44ad"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </stop>
                  <stop offset="50%" stopColor="#ff007f">
                    <animate
                      attributeName="stop-color"
                      values="#ff007f;#ff9f43;#8e44ad;#ff007f"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </stop>
                  <stop offset="100%" stopColor="#ff9f43">
                    <animate
                      attributeName="stop-color"
                      values="#ff9f43;#8e44ad;#ff007f;#ff9f43"
                      dur="2s"
                      repeatCount="indefinite"
                    />
                  </stop>
                </linearGradient>
              </defs>
              <path
                d="M28 2C22 4 18 8 15 13C12 18 10 22 9 25L7 30L8.5 28.5C9.5 27.5 11 26 13 24.5C14.5 23.5 16.5 22.5 19 22C17 20 15.5 17.5 15 15C18 15.5 21 17 23 19C23.5 16.5 24.5 14.5 25.5 13C27 14.5 28 16.5 28.5 19C30 15 31 10 28 2Z"
                fill="url(#loadingQuillGradient)"
                className="takes-quill-body"
              />
              <path
                d="M27 3C21 7 16 14 12 21C10 25 8 28 7 30"
                stroke="url(#loadingQuillGradient)"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="takes-quill-spine"
              />
              <path
                d="M24 6C22 8 20 10 18 13M26 8C23 11 20 14 17 17M25 12C22 15 19 18 16 20"
                stroke="url(#loadingQuillGradient)"
                strokeWidth="0.8"
                strokeLinecap="round"
                className="takes-quill-barbs"
              />
            </svg>
            <div className="takes-loading-ripple" />
            <div className="takes-loading-ripple ripple-2" />
          </div>
          <p className="takes-loading-text">Loading Takes</p>
          <div className="takes-loading-dots">
            <span /><span /><span />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="tiktok-feed-container">
        <div className="aura-blob blob-1" />
        <div className="aura-blob blob-2" />
        <div className="aura-blob blob-3" />
        <div className="tiktok-status">
          <div className="tiktok-status-icon error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p>Failed to load Takes</p>
          <span className="tiktok-status-sub">{error}</span>
        </div>
      </div>
    );
  }

  // Empty state
  if (takes.length === 0) {
    return (
      <div className="tiktok-feed-container">
        <div className="aura-blob blob-1" />
        <div className="aura-blob blob-2" />
        <div className="aura-blob blob-3" />
        <div className="tiktok-status">
          <div className="tiktok-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <p>No Takes yet</p>
          <span className="tiktok-status-sub">Be the first to share a Take!</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`tiktok-feed-container ${commentsPanelOpen ? "comments-open" : ""}`}>
      {/* Background */}
      <div className="aura-blob blob-1 hidden md:block" />
      <div className="aura-blob blob-2 hidden md:block" />
      <div className="aura-blob blob-3 hidden md:block" />

      {/* Mobile Navigation - Back to Home */}
      <Link
        href="/"
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-full bg-black/30 backdrop-blur-md flex items-center justify-center text-white"
        style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* Feed */}
      <div ref={feedRef} className="tiktok-feed">
        {takes.map((take, index) => (
          <div
            key={take.id}
            ref={(el) => setCardRef(take.id, el)}
            data-take-id={take.id}
            className="tiktok-feed-item"
          >
            <TakeCard
              take={take}
              isActive={index === activeIndex}
              isMuted={isMuted}
              volume={volume}
              isFollowing={following.has(take.author_id) || take.author_id === user?.id}
              isOwnTake={take.author_id === user?.id}
              reactionCounts={take.reaction_counts}
              onToggleMute={toggleMute}
              onVolumeChange={setVolume}
              onToggleAdmire={() => toggleAdmire(take.id)}
              onToggleReaction={(type) => toggleReaction(take.id, type)}
              onToggleSave={() => toggleSave(take.id)}
              onToggleRelay={() => toggleRelay(take.id)}
              onToggleFollow={() => toggleFollow(take.author_id)}
              onOpenComments={() => handleOpenComments(take.id)}
              onDelete={() => deleteTake(take.id)}
              onReport={(reason, details) => reportTake(take.id, reason, details)}
            />
          </div>
        ))}

        {loading && takes.length > 0 && (
          <div className="tiktok-loading-more">
            <div className="tiktok-spinner" />
          </div>
        )}
      </div>

      {/* Right-side Comments Panel */}
      {commentsTakeId && (
        <TakeCommentsPanel
          isOpen={commentsPanelOpen}
          onClose={() => setCommentsPanelOpen(false)}
          takeId={commentsTakeId}
        />
      )}
    </div>
  );
}
