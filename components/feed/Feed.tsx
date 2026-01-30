"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useFeed } from "@/lib/hooks/useFeed";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import type { Post } from "@/lib/types";

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
  const labels: Record<string, string> = {
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
  return labels[type] || "shared something";
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

  // Filter out deleted posts
  const posts = feedPosts.filter(p => !deletedIds.has(p.id));

  const handlePostDeleted = (postId: string) => {
    setDeletedIds(prev => new Set(prev).add(postId));
  };

  // Show skeletons while loading (only on initial load)
  if (authLoading || (postsLoading && posts.length === 0)) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        {[...Array(3)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        <div className="text-center">
          <p className="font-body text-red-500 mb-4">{error}</p>
          <button
            onClick={() => refresh()}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
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
      </div>
    );
  }

  return (
    <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
      {posts.map((post) => (
        <PostCard
          key={post.id}
          post={{
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
              comments: post.comments_count,
              relays: post.relays_count,
            },
            isAdmired: post.user_has_admired,
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
          }}
          onPostDeleted={handlePostDeleted}
        />
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
            You've reached the end of the feed
          </p>
        </div>
      )}
    </div>
  );
}
