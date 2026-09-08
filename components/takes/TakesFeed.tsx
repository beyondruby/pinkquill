"use client";

import "./takes.css";
import { toggleDefaultReaction } from "@/lib/engagement/store";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import TakeCard from "./TakeCard";
import TakeCommentsPanel from "./TakeCommentsPanel";
import { useTakes, useMuted, useTakesFollowing, useVolume } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";

interface TakesFeedProps {
  communityId?: string;
  soundId?: string;
  authorId?: string;
  initialTakeId?: string;
}

const HIDDEN_TAKES_KEY = "pq-hidden-takes";
const HIDDEN_TAKES_MAX = 200;
function readHiddenTakeIds(): string[] {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(HIDDEN_TAKES_KEY) : null;
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeHiddenTakeIds(ids: Set<string>) {
  try {
    window.localStorage.setItem(HIDDEN_TAKES_KEY, JSON.stringify([...ids].slice(-HIDDEN_TAKES_MAX)));
  } catch {
    // storage may be unavailable; the hide still applies for this session
  }
}

export default function TakesFeed({
  communityId,
  soundId,
  authorId,
  initialTakeId,
}: TakesFeedProps) {
  const { user } = useAuth();
  const router = useRouter();
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  const [activeIndex, setActiveIndex] = useState(0);
  const [commentsPanelOpen, setCommentsPanelOpen] = useState(false);
  const [commentsTakeId, setCommentsTakeId] = useState<string | null>(null);
  // "Not interested" survives a refresh (V-32): the ids live in localStorage, newest last, capped.
  const [hiddenTakeIds, setHiddenTakeIds] = useState<Set<string>>(() => new Set(readHiddenTakeIds()));

  const {
    takes,
    loading,
    error,
    hasMore,
    fetchMore,
    refetch,
    toggleSave,
    toggleRelay,
    deleteTake,
  } = useTakes(user?.id, { communityId, soundId, authorId, initialTakeId });

  const visibleTakes = useMemo(
    () => takes.filter((take) => !hiddenTakeIds.has(take.id)),
    [takes, hiddenTakeIds]
  );

  const { isMuted, toggle: toggleMute } = useMuted();
  const { volume, setVolume } = useVolume();
  const { following, checkFollowing, toggle: toggleFollow } = useTakesFollowing(user?.id);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setHiddenTakeIds(new Set());
    setActiveIndex(0);
  }, [communityId, soundId, authorId, initialTakeId]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Look up follow state only for authors we have not asked about yet; the
  // list changes on every page and every "not interested" (V-30).
  const checkedAuthorsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    checkedAuthorsRef.current = new Set();
  }, [user?.id, communityId, soundId, authorId]);
  useEffect(() => {
    if (visibleTakes.length === 0 || !user?.id) return;
    const fresh = [...new Set(visibleTakes.map(t => t.author_id))].filter((id) => !checkedAuthorsRef.current.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => checkedAuthorsRef.current.add(id));
    checkFollowing(fresh);
  }, [visibleTakes, user?.id, checkFollowing]);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (visibleTakes.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= visibleTakes.length) {
      setActiveIndex(Math.max(0, visibleTakes.length - 1));
    }
  }, [activeIndex, visibleTakes.length]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Scroll to the deep-linked take exactly once. This used to re-run on
  // every list change and yank the user back after each page load (V-31).
  const deepLinkDoneRef = useRef<string | null>(null);
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!initialTakeId || visibleTakes.length === 0) return;
    if (deepLinkDoneRef.current === initialTakeId) return;
    const index = visibleTakes.findIndex(t => t.id === initialTakeId);
    if (index === -1) return;
    deepLinkDoneRef.current = initialTakeId;
    setActiveIndex(index);
    cardRefs.current.get(initialTakeId)?.scrollIntoView({ behavior: "instant" });
  }, [initialTakeId, visibleTakes]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
            const takeId = entry.target.getAttribute("data-take-id");
            if (takeId) {
              const index = visibleTakes.findIndex(t => t.id === takeId);
              if (index !== -1) setActiveIndex(index);
            }
          }
        });
      },
      { root: feedRef.current, threshold: 0.6 }
    );

    cardRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [visibleTakes]);

  useEffect(() => {
    if (activeIndex >= visibleTakes.length - 2 && hasMore && !loading) {
      fetchMore();
    }
  }, [activeIndex, visibleTakes.length, hasMore, loading, fetchMore]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (commentsPanelOpen) return;

      switch (e.key) {
        case "ArrowDown":
        case "j":
          e.preventDefault();
          if (activeIndex < visibleTakes.length - 1) {
            const nextTake = visibleTakes[activeIndex + 1];
            cardRefs.current.get(nextTake.id)?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        case "ArrowUp":
        case "k":
          e.preventDefault();
          if (activeIndex > 0) {
            const prevTake = visibleTakes[activeIndex - 1];
            cardRefs.current.get(prevTake.id)?.scrollIntoView({ behavior: "smooth" });
          }
          break;
        case "m":
          toggleMute();
          break;
        case "l":
          if (visibleTakes[activeIndex] && user?.id) {
            void toggleDefaultReaction("take", visibleTakes[activeIndex].id, user.id);
          }
          break;
        case "c":
          if (visibleTakes[activeIndex]) {
            setCommentsTakeId(visibleTakes[activeIndex].id);
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
  }, [activeIndex, visibleTakes, commentsPanelOpen, toggleMute, user?.id]);

  const handleOpenComments = useCallback((takeId: string) => {
    setCommentsTakeId(takeId);
    setCommentsPanelOpen(true);
  }, []);

  const setCardRef = useCallback((takeId: string, el: HTMLDivElement | null) => {
    if (el) cardRefs.current.set(takeId, el);
    else cardRefs.current.delete(takeId);
  }, []);

  // Navigation handlers for desktop arrows
  const goToPrevious = useCallback(() => {
    if (activeIndex > 0) {
      const prevTake = visibleTakes[activeIndex - 1];
      cardRefs.current.get(prevTake.id)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeIndex, visibleTakes]);

  const goToNext = useCallback(() => {
    if (activeIndex < visibleTakes.length - 1) {
      const nextTake = visibleTakes[activeIndex + 1];
      cardRefs.current.get(nextTake.id)?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeIndex, visibleTakes]);

  const handleHideTake = useCallback((takeId: string, index: number) => {
    const nextTake = visibleTakes[index + 1] || visibleTakes[index - 1];
    setHiddenTakeIds((prev) => {
      const next = new Set(prev).add(takeId);
      writeHiddenTakeIds(next);
      return next;
    });

    if (nextTake) {
      requestAnimationFrame(() => {
        cardRefs.current.get(nextTake.id)?.scrollIntoView({ behavior: "smooth" });
      });
    }
  }, [visibleTakes]);

  // Keep the video footprint stable while the first page arrives.
  if (loading && visibleTakes.length === 0) {
    return (
      <div className="tiktok-feed-container" role="status" aria-label="Loading Takes" aria-busy="true">
        <div className="tiktok-feed" aria-hidden="true">
          <div className="tiktok-feed-item">
            <div className="tiktok-take">
              <div className="tiktok-take-video">
                <div className="absolute inset-0 bg-subtle" />
                <div className="tiktok-bottom-content animate-pulse space-y-3">
                  <div className="h-3 w-28 rounded bg-skeleton" />
                  <div className="h-3 w-3/4 rounded bg-skeleton" /><div className="h-3 w-1/2 rounded bg-skeleton" />
                </div>
              </div>
              <div className="tiktok-actions animate-pulse">
                {[0, 1, 2, 3, 4].map(item => <div key={item} className="w-10 h-10 rounded-full bg-skeleton" />)}
              </div>
            </div>
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
          <span className="tiktok-status-sub" role="alert">{error}</span>
          <button type="button" onClick={() => void refetch()} className="mt-4 py-2 font-ui text-accent underline underline-offset-2">Try again</button>
        </div>
      </div>
    );
  }

  // Empty state
  if (visibleTakes.length === 0) {
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
          <p>{soundId ? "No Takes use this sound yet" : communityId ? "No Takes in this community yet" : authorId ? "No Takes from this creator yet" : "No Takes yet"}</p>
          <span className="tiktok-status-sub">{soundId || communityId || authorId ? "Check back soon, or browse all Takes." : "Be the first to share a Take!"}</span>
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

      {/* Mobile Navigation - back where you came from, the home feed when there is nowhere to go (V-33) */}
      <Link
        href="/"
        aria-label="Back"
        onClick={(e) => {
          if (window.history.length > 1) {
            e.preventDefault();
            router.back();
          }
        }}
        className="md:hidden fixed top-3 left-3 z-50 w-10 h-10 rounded-full bg-black/50 flex items-center justify-center text-white"
        style={{ top: 'calc(12px + env(safe-area-inset-top, 0px))' }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </Link>

      {/* Right Side Navigation Arrows - Desktop Only */}
      <div className="takes-nav-arrows hidden md:flex">
        <button
          onClick={goToPrevious}
          disabled={activeIndex === 0}
          className={`takes-nav-arrow ${activeIndex === 0 ? 'disabled' : ''}`}
          aria-label="Previous take"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="navArrowGradUp" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#8e44ad" />
                <stop offset="50%" stopColor="#ff007f" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path
              d="M12 19V5M5 12l7-7 7 7"
              stroke="url(#navArrowGradUp)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          onClick={goToNext}
          disabled={activeIndex >= visibleTakes.length - 1}
          className={`takes-nav-arrow ${activeIndex >= visibleTakes.length - 1 ? 'disabled' : ''}`}
          aria-label="Next take"
        >
          <svg viewBox="0 0 24 24" fill="none">
            <defs>
              <linearGradient id="navArrowGradDown" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#8e44ad" />
                <stop offset="50%" stopColor="#ff007f" />
                <stop offset="100%" stopColor="#ff9f43" />
              </linearGradient>
            </defs>
            <path
              d="M12 5v14M5 12l7 7 7-7"
              stroke="url(#navArrowGradDown)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Feed */}
      <div ref={feedRef} className="tiktok-feed">
        {visibleTakes.map((take, index) => {
          const shouldRenderCard = Math.abs(index - activeIndex) <= 2;

          return (
          <div
            key={take.id}
            ref={(el) => setCardRef(take.id, el)}
            data-take-id={take.id}
            className="tiktok-feed-item"
          >
            {shouldRenderCard ? (
              <TakeCard
                take={take}
                isActive={index === activeIndex}
                isMuted={isMuted}
                volume={volume}
                isFollowing={following.has(take.author_id) || take.author_id === user?.id}
                isOwnTake={take.author_id === user?.id}
                onToggleMute={toggleMute}
                onVolumeChange={setVolume}
                onToggleSave={() => toggleSave(take.id)}
                onToggleRelay={() => toggleRelay(take.id)}
                onToggleFollow={() => toggleFollow(take.author_id)}
                onOpenComments={() => handleOpenComments(take.id)}
                onDelete={() => deleteTake(take.id)}
                onHide={() => handleHideTake(take.id, index)}
              />
            ) : (
              <div className="tiktok-feed-placeholder" aria-hidden="true" />
            )}
          </div>
        )})}

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
          authorId={takes.find((t) => t.id === commentsTakeId)?.author_id ?? null}
        />
      )}
    </div>
  );
}
