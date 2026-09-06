"use client";

import { useEffect, useState, useMemo, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeedView } from "@/components/providers/FeedViewProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import { StreamFeed } from "./StreamView";
import { GalleryFeed } from "./GalleryView";
import { transformPostForCard } from "@/lib/feed-view/transform";
import { FeedViewSwitch } from "./FeedViewSwitch";
import ComposerPrompt from "./ComposerPrompt";
import { PageFrame } from "@/components/layout/PageFrame";
import Button from "@/components/ui/Button";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";
import type { FeedViewId } from "@/lib/feed-view/registry";
import { Spinner } from "@/components/ui/Loading";

// Width per view: Classic reads best in one 690px column, Stream in a wider
// list, Gallery uses the full 1216px region. Gutters come from the shell.
const VIEW_WIDTH: Record<FeedViewId, "narrow" | "reading" | "wide"> = {
  classic: "narrow",
  compact: "reading",
  grid: "wide",
};

function FeedFrame({
  viewId,
  signedIn,
  children,
}: {
  viewId: FeedViewId;
  signedIn: boolean;
  children: ReactNode;
}) {
  return (
    <PageFrame width={VIEW_WIDTH[viewId]} className="pq-feed">
      <ComposerPrompt />
      <div className="pq-home-toolbar">
        <h1 className="pq-home-label">{signedIn ? "From your creative world" : "What people are making"}</h1>
        <FeedViewSwitch />
      </div>
      {children}
    </PageFrame>
  );
}

function FeedLoading({ viewId }: { viewId: FeedViewId }) {
  if (viewId === "classic") {
    return (
      <div className="pq-feed-list">
        {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
      </div>
    );
  }
  if (viewId === "compact") {
    return (
      <div className="grid gap-2" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => <span key={i} className="pq-skeleton h-14 rounded-card" />)}
      </div>
    );
  }
  return (
    <div className="pq-gallery-skeleton" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <span key={i} className={`pq-skeleton rounded-card ${["h-56", "h-72", "h-48", "h-64"][i % 4]}`} />
      ))}
    </div>
  );
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const { subscribeToDeletes } = useModal();
  const { viewId } = useFeedView();

  // Use the optimized useFeed hook with AbortController and stable channels
  const {
    posts: feedPosts,
    loading: postsLoading,
    error,
    pagination,
    loadMore,
    refresh,
  } = useFeed(user?.id, { pageSize: 10, enabled: !authLoading });

  // Local state for filtering deleted posts (cleared on refresh since fresh data is accurate)
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Wrap refresh to clear deletedIds since fresh server data reflects accurate state
  const handleRefresh = useCallback(() => {
    setDeletedIds(new Set());
    refresh();
  }, [refresh]);

  // Auto-recovery: if the first page is still loading after 12s, retry once.
  // useFeed aborts the in-flight request when refresh() runs, so this never
  // stacks a second load on top of the first; one retry is enough because
  // the underlying request already has its own 25s timeout.
  const loadingStartRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (postsLoading && feedPosts.length === 0) {
      if (!loadingStartRef.current) {
        loadingStartRef.current = Date.now();
      }
      const timer = setTimeout(() => {
        if (retryCountRef.current < 1) {
          retryCountRef.current += 1;
          console.warn(`[Feed] Loading stuck for >12s, auto-retrying (attempt ${retryCountRef.current})`);
          handleRefresh();
        }
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      loadingStartRef.current = null;
      retryCountRef.current = 0;
    }
  }, [postsLoading, feedPosts.length, handleRefresh]);

  // Infinite scroll: observe the sentinel div at the bottom of the list.
  const [bottomEl, setBottomEl] = useState<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!bottomEl || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0, rootMargin: "100px" }
    );
    observer.observe(bottomEl);
    return () => observer.disconnect();
  }, [bottomEl]);

  // Load more when scrolling
  useEffect(() => {
    if (inView && pagination.hasMore && !postsLoading) {
      loadMore();
    }
  }, [inView, pagination.hasMore, postsLoading, loadMore]);

  // Subscribe to deletes
  useEffect(() => {
    const unsubPosts = subscribeToDeletes((id) => {
      setDeletedIds(prev => new Set(prev).add(id));
    });
    return () => { unsubPosts(); };
  }, [subscribeToDeletes]);

  // PERFORMANCE: Memoize filtered posts - only recalculate when feedPosts or
  // deletedIds change.
  const posts = useMemo(
    () => feedPosts.filter((p) => !deletedIds.has(p.id)),
    [feedPosts, deletedIds]
  );

  // PERFORMANCE: Memoize transformed posts - prevents object recreation on every render
  const transformedPosts = useMemo(
    () => posts.map(post => ({
      original: post,
      transformed: transformPostForCard(post),
    })),
    [posts]
  );

  const handlePostDeleted = useCallback((postId: string) => {
    setDeletedIds(prev => new Set(prev).add(postId));
  }, []);

  // Show skeletons while loading (only on initial load). Classic view uses
  // the rich PostSkeleton; other views show simple placeholder boxes sized
  // to their layout, since their cards are smaller.
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <FeedFrame viewId={viewId} signedIn={!!user}>
        <div role="status" aria-live="polite" className="sr-only">Loading your feed</div>
        <FeedLoading viewId={viewId} />
      </FeedFrame>
    );
  }

  if (error) {
    return (
      <FeedFrame viewId={viewId} signedIn={!!user}>
        <div className="pq-feed-state pq-feed-state--card" role="alert">
          <p className="pq-feed-state__title">The feed didn&rsquo;t load</p>
          <p className="pq-feed-state__text">{error}</p>
          <div className="pq-feed-state__actions">
            <Button variant="secondary" onClick={() => handleRefresh()}>Try again</Button>
          </div>
        </div>
      </FeedFrame>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedFrame viewId={viewId} signedIn={!!user}>
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Nothing here yet</p>
          <p className="pq-feed-state__text">
            {user
              ? "Follow a few people, join a community, or be the first to share something."
              : "Sign in to follow people and shape what shows up here."}
          </p>
          <div className="pq-feed-state__actions">
            <Link href="/explore" className="pq-button pq-button--md pq-button--secondary">Explore</Link>
            {user ? (
              <Link href="/create" className="pq-button pq-button--md pq-button--primary">Share something</Link>
            ) : (
              <Link href="/login" className="pq-button pq-button--md pq-button--primary">Sign in</Link>
            )}
          </div>
        </div>
      </FeedFrame>
    );
  }

  return (
    <FeedFrame viewId={viewId} signedIn={!!user}>
      {viewId === "classic" ? (
        <div className="pq-feed-list">
          {transformedPosts.map(({ original, transformed }) => (
            <ErrorBoundary
              key={original.id}
              section={`PostCard:${original.id}`}
              fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
            >
              <PostCard
                post={transformed}
                onPostDeleted={handlePostDeleted}
                disableRealtimeSubscriptions={true}
              />
            </ErrorBoundary>
          ))}
        </div>
      ) : viewId === "compact" ? (
        <StreamFeed items={transformedPosts} onPostDeleted={handlePostDeleted} />
      ) : (
        <GalleryFeed items={transformedPosts} />
      )}

      {/* Infinite scroll trigger */}
      <div ref={setBottomEl} className="h-4" />

      {postsLoading && posts.length > 0 && (
        <div className="pq-feed-more" role="status" aria-label="Loading more">
          <Spinner size="lg" />
        </div>
      )}

      {!pagination.hasMore && posts.length > 0 && (
        <p className="pq-feed-end">That&rsquo;s everything for now.</p>
      )}
    </FeedFrame>
  );
}
