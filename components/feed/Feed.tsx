"use client";

import { useEffect, useState, useMemo, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import ErrorBoundary from "@/components/ui/ErrorBoundary";
import { PostCardErrorFallback } from "@/components/ui/ErrorFallbacks";
import type { Post } from "@/lib/types";

// PERFORMANCE: Moved outside component to prevent recreation on every render
const TYPE_LABELS: Record<string, string> = {
  poem: "wrote a poem",
  journal: "wrote in their journal",
  thought: "shared a thought",
  visual: "shared a visual story",
  audio: "recorded a voice note",
  video: "shared a video",
  essay: "wrote an essay",
  blog: "published a blog post",
  story: "shared a story",
  letter: "wrote a letter",
  quote: "shared a quote",
};

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] || "shared something";
}

// PERFORMANCE: Transform post data once, memoized by post ID
function transformPostForCard(post: Post) {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar: post.author.avatar_url || "/defaultprofile.png",
    },
    type: post.type,
    typeLabel: getTypeLabel(post.type),
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content,
    contentWarning: post.content_warning || undefined,
    media: post.media || [],
    stats: {
      admires: post.admires_count,
      reactions: post.reactions_count,
      comments: post.comments_count,
      relays: post.relays_count,
    },
    isAdmired: post.user_has_admired,
    reactionType: post.user_reaction_type,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    community: post.community ? {
      slug: post.community.slug,
      name: post.community.name,
      avatar_url: post.community.avatar_url,
    } : undefined,
    collaborators: (post.collaborators || []).map(c => ({
      ...c,
      status: c.status as 'pending' | 'accepted' | 'declined',
    })),
    mentions: post.mentions || [],
    hashtags: post.hashtags || [],
    styling: post.styling || null,
    post_location: post.post_location || null,
    metadata: post.metadata || null,
    spotify_track: post.spotify_track || null,
  };
}

function FeedFrame({ children }: { children: ReactNode }) {
  return (
    <div className="home-feed-modern w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
      {children}
      <style jsx global>{`
        .home-feed-modern {
          --feed-ink: #201c17;
          --feed-muted: rgba(32, 28, 23, 0.62);
          --feed-card-bg: rgba(255, 255, 253, 0.96);
          --feed-border: rgba(42, 35, 25, 0.09);
          --feed-accent: #1f7a70;
          --feed-accent-soft: rgba(31, 122, 112, 0.14);
          --feed-warm: #c27452;
          --feed-warm-soft: rgba(194, 116, 82, 0.14);
          position: relative;
          isolation: isolate;
        }

        .home-feed-modern::before {
          content: "";
          position: absolute;
          inset: -14px -18px;
          border-radius: 30px;
          background:
            radial-gradient(108% 88% at 0% 0%, rgba(31, 122, 112, 0.12) 0%, rgba(31, 122, 112, 0) 46%),
            radial-gradient(90% 84% at 100% 8%, rgba(194, 116, 82, 0.12) 0%, rgba(194, 116, 82, 0) 44%),
            linear-gradient(180deg, rgba(253, 251, 246, 0.82) 0%, rgba(247, 246, 241, 0.68) 100%);
          z-index: -1;
          pointer-events: none;
        }

        .home-feed-modern .post {
          position: relative;
          border-radius: 24px;
          border: 1px solid var(--feed-border);
          background: linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, var(--feed-card-bg) 100%);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.82),
            0 12px 30px rgba(17, 13, 8, 0.07);
          margin-bottom: 1.2rem;
          padding: 1.35rem 1.35rem 1.15rem;
          transition:
            box-shadow 0.26s ease,
            border-color 0.26s ease,
            transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
          animation: feedCardReveal 0.46s cubic-bezier(0.2, 0.75, 0.32, 1) both;
          overflow: visible;
        }

        .home-feed-modern .post::before {
          content: "";
          position: absolute;
          inset: 0;
          border-radius: inherit;
          padding: 1px;
          background: linear-gradient(
            132deg,
            rgba(31, 122, 112, 0.22) 0%,
            rgba(255, 255, 255, 0.05) 40%,
            rgba(194, 116, 82, 0.22) 100%
          );
          -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          -webkit-mask-composite: xor;
          mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
          mask-composite: exclude;
          pointer-events: none;
        }

        .home-feed-modern .post::after {
          content: "";
          position: absolute;
          width: 170px;
          height: 170px;
          right: -44px;
          top: -72px;
          border-radius: 999px;
          pointer-events: none;
          background: radial-gradient(circle, rgba(31, 122, 112, 0.2) 0%, rgba(31, 122, 112, 0) 72%);
          opacity: 0;
          transition: opacity 0.26s ease;
        }

        .home-feed-modern .post:hover {
          border-color: rgba(31, 122, 112, 0.23);
          box-shadow:
            inset 0 1px 0 rgba(255, 255, 255, 0.94),
            0 20px 42px rgba(17, 13, 8, 0.12);
          transform: translateY(-3px);
        }

        .home-feed-modern .post:hover::after {
          opacity: 1;
        }

        .home-feed-modern .author-header {
          margin-bottom: 1rem;
          gap: 0.72rem;
        }

        .home-feed-modern .author-avatar {
          border-width: 1px;
          border-color: rgba(32, 28, 23, 0.12);
          box-shadow: 0 6px 14px rgba(21, 17, 13, 0.13);
        }

        .home-feed-modern .collab-avatar,
        .home-feed-modern .collab-avatar.first,
        .home-feed-modern .collab-avatar-more {
          border-width: 1px;
          border-color: rgba(32, 28, 23, 0.12);
        }

        .home-feed-modern .author-info {
          min-width: 0;
        }

        .home-feed-modern .author-name-line {
          row-gap: 2px;
        }

        .home-feed-modern .author-name {
          color: var(--feed-ink);
          font-weight: 600;
          letter-spacing: -0.01em;
        }

        .home-feed-modern .post-time,
        .home-feed-modern .post-type-label,
        .home-feed-modern .posted-by-label,
        .home-feed-modern .posted-by-author,
        .home-feed-modern .collab-count,
        .home-feed-modern .collab-label,
        .home-feed-modern .post-time-separator {
          color: var(--feed-muted);
        }

        .home-feed-modern .posted-by-author:hover,
        .home-feed-modern .author-name:hover {
          color: var(--feed-accent);
        }

        .home-feed-modern .unified-post-title {
          margin-bottom: 0.58rem;
          letter-spacing: -0.02em;
          line-height: 1.34;
          font-weight: 560;
          color: var(--feed-ink);
          text-wrap: balance;
        }

        .home-feed-modern .post-content-text {
          color: rgba(32, 28, 23, 0.88);
          line-height: 1.72;
        }

        .home-feed-modern .continue-reading-link {
          margin-top: 0.6rem;
          color: var(--feed-accent);
          font-size: 0.8rem;
          letter-spacing: 0.01em;
          font-weight: 600;
        }

        .home-feed-modern .continue-reading-link:hover {
          color: #145f57;
        }

        .home-feed-modern .mentions-wrapper,
        .home-feed-modern .hashtags-wrapper {
          margin-bottom: 0.15rem;
        }

        .home-feed-modern .mention-pill,
        .home-feed-modern .hashtag-pill {
          border: 1px solid rgba(31, 122, 112, 0.16);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.7);
          color: rgba(32, 28, 23, 0.72);
          backdrop-filter: blur(6px);
        }

        .home-feed-modern .mention-pill:hover,
        .home-feed-modern .hashtag-pill:hover {
          border-color: rgba(31, 122, 112, 0.25);
          background: var(--feed-accent-soft);
          color: var(--feed-accent);
        }

        .home-feed-modern .unified-media-grid {
          margin-top: 0.9rem;
          gap: 8px;
          border-radius: 18px;
        }

        .home-feed-modern .unified-media-item {
          border-radius: 12px;
          box-shadow: inset 0 0 0 1px rgba(32, 28, 23, 0.07);
        }

        .home-feed-modern .unified-media-image {
          transition:
            transform 0.45s cubic-bezier(0.22, 1, 0.36, 1),
            filter 0.45s ease;
        }

        .home-feed-modern .post:hover .unified-media-image {
          transform: scale(1.035);
          filter: saturate(1.06);
        }

        .home-feed-modern .video-container,
        .home-feed-modern .audio-visual {
          border-radius: 18px;
          box-shadow: inset 0 0 0 1px rgba(32, 28, 23, 0.08);
        }

        .home-feed-modern .actions {
          margin-top: 1rem;
          padding-top: 0.9rem;
          border-top: 1px solid rgba(32, 28, 23, 0.09);
        }

        .home-feed-modern .actions-left,
        .home-feed-modern .actions-right {
          gap: 0.28rem;
        }

        .home-feed-modern .action-btn {
          gap: 0.42rem;
          padding: 0.42rem 0.62rem;
          border-radius: 999px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--feed-muted);
          line-height: 1;
          transition:
            color 0.18s ease,
            border-color 0.18s ease,
            background-color 0.18s ease,
            transform 0.2s ease;
        }

        .home-feed-modern .action-btn:hover {
          border-color: rgba(31, 122, 112, 0.2);
          background: rgba(255, 255, 255, 0.84);
          color: var(--feed-ink);
        }

        .home-feed-modern .action-btn:focus-visible {
          outline: none;
          border-color: rgba(31, 122, 112, 0.38);
          box-shadow: 0 0 0 3px rgba(31, 122, 112, 0.17);
        }

        .home-feed-modern .action-btn.active,
        .home-feed-modern .reaction-picker-trigger.action-btn.active {
          color: var(--feed-accent);
          border-color: rgba(31, 122, 112, 0.26);
          background: var(--feed-accent-soft);
        }

        .home-feed-modern .action-btn.saved {
          color: var(--feed-warm);
          border-color: rgba(194, 116, 82, 0.25);
          background: var(--feed-warm-soft);
        }

        .home-feed-modern .action-count {
          font-variant-numeric: tabular-nums;
          font-size: 0.8rem;
          letter-spacing: 0.01em;
        }

        .home-feed-modern .reaction-picker-dropdown > div {
          border-color: rgba(32, 28, 23, 0.08);
          box-shadow: 0 20px 36px rgba(17, 13, 8, 0.15);
        }

        .home-feed-modern .post-menu-btn {
          width: 34px;
          height: 34px;
          border: 1px solid transparent;
          border-radius: 999px;
          color: var(--feed-muted);
          background: rgba(255, 255, 255, 0.48);
          backdrop-filter: blur(6px);
          transition:
            color 0.18s ease,
            border-color 0.18s ease,
            background-color 0.18s ease;
        }

        .home-feed-modern .post-menu-btn:hover {
          border-color: rgba(32, 28, 23, 0.14);
          color: var(--feed-ink);
          background: rgba(255, 255, 255, 0.88);
        }

        .home-feed-modern .post:nth-child(2) {
          animation-delay: 35ms;
        }

        .home-feed-modern .post:nth-child(3) {
          animation-delay: 70ms;
        }

        .home-feed-modern .post:nth-child(4) {
          animation-delay: 105ms;
        }

        .home-feed-modern .post:nth-child(5) {
          animation-delay: 140ms;
        }

        @keyframes feedCardReveal {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.995);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @media (max-width: 640px) {
          .home-feed-modern {
            padding-left: 0.85rem;
            padding-right: 0.85rem;
          }

          .home-feed-modern::before {
            inset: -8px -10px;
            border-radius: 22px;
          }

          .home-feed-modern .post {
            border-radius: 20px;
            padding: 1.05rem 1rem 0.95rem;
            margin-bottom: 0.9rem;
          }

          .home-feed-modern .author-header {
            gap: 0.62rem;
            margin-bottom: 0.88rem;
          }

          .home-feed-modern .unified-post-title {
            font-size: 1.12rem;
          }

          .home-feed-modern .actions-left,
          .home-feed-modern .actions-right {
            gap: 0.2rem;
          }

          .home-feed-modern .action-btn {
            padding: 0.4rem 0.5rem;
          }
        }

        @media (hover: none) and (pointer: coarse) {
          .home-feed-modern .post:hover {
            transform: none;
          }

          .home-feed-modern .post:hover .unified-media-image {
            transform: none;
            filter: none;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .home-feed-modern .post {
            animation: none;
            transition: none;
          }

          .home-feed-modern .post::after,
          .home-feed-modern .unified-media-image {
            transition: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const { subscribeToDeletes } = useModal();

  // Use the optimized useFeed hook with AbortController and stable channels
  const {
    posts: feedPosts,
    loading: postsLoading,
    error,
    pagination,
    loadMore,
    refresh,
  } = useFeed(user?.id, { pageSize: 10 });

  // Local state for filtering deleted posts
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  // Intersection observer for infinite scroll
  const { ref: bottomRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

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

  // PERFORMANCE: Memoize filtered posts - only recalculate when feedPosts or deletedIds change
  const posts = useMemo(
    () => feedPosts.filter(p => !deletedIds.has(p.id)),
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

  // Show skeletons while loading (only on initial load)
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <FeedFrame>
        {[...Array(3)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </FeedFrame>
    );
  }

  if (error) {
    return (
      <FeedFrame>
        <div className="text-center">
          <p className="font-body text-red-500 mb-4">{error}</p>
          <button
            onClick={() => refresh()}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </FeedFrame>
    );
  }

  if (posts.length === 0) {
    return (
      <FeedFrame>
        <div className="text-center">
          <h2 className="font-display text-2xl text-ink mb-4">
            The canvas awaits
          </h2>
          <p className="font-body text-muted italic mb-6">
            No posts yet. Be the first to share your creative voice.
          </p>
          <Link
            href="/create"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
          >
            Create Something
          </Link>
        </div>
      </FeedFrame>
    );
  }

  return (
    <FeedFrame>
      {/* PERFORMANCE: Using memoized transformed posts */}
      {transformedPosts.map(({ original, transformed }) => (
        <ErrorBoundary
          key={original.id}
          section={`PostCard:${original.id}`}
          fallback={({ reset }) => <PostCardErrorFallback onRetry={reset} />}
        >
          <PostCard
            post={transformed}
            onPostDeleted={handlePostDeleted}
            disableRealtimeSubscriptions={true} // PERFORMANCE: Disable per-card subscriptions in feed
          />
        </ErrorBoundary>
      ))}

      {/* Infinite scroll trigger */}
      <div ref={bottomRef} className="h-4" />

      {/* Loading more indicator */}
      {postsLoading && posts.length > 0 && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {/* End of feed */}
      {!pagination.hasMore && posts.length > 0 && (
        <div className="text-center py-8">
          <p className="font-body text-muted text-sm italic">
            You&apos;ve reached the end of the feed
          </p>
        </div>
      )}
    </FeedFrame>
  );
}
