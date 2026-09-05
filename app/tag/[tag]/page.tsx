"use client";

import { useRef, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useTagPosts, useTrendingTags } from "@/lib/hooks/useTags";
import PostCard from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import type { PostProps, PostType } from "@/components/feed/PostCard/types";
import { PageFrame } from "@/components/layout/PageFrame";
import { NavIcon } from "@/components/layout/navigation";
import { Spinner } from "@/components/ui/Loading";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { getTimeAgoCompact } from "@/lib/utils/time";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

type TagPost = ReturnType<typeof useTagPosts>["posts"][number];

function transformPostForCard(post: TagPost): PostProps {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author?.display_name || post.author?.username || "Unknown",
      handle: `@${post.author?.username || "unknown"}`,
      avatar: post.author?.avatar_url || DEFAULT_AVATAR,
    },
    type: post.type as PostType,
    typeLabel: getPostTypePhrase(post.type),
    timeAgo: getTimeAgoCompact(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content || "",
    contentWarning: post.content_warning || undefined,
    media: post.media,
    stats: {
      admires: post.admires_count || 0,
      reactions: post.reactions_count || post.admires_count || 0,
      comments: post.comments_count || 0,
      relays: post.relays_count || 0,
    },
    isAdmired: post.user_has_admired,
    reactionType: (post.user_reaction_type as PostProps["reactionType"]) || null,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    hashtags: post.hashtags || [],
  } as PostProps;
}

export default function TagPage() {
  const params = useParams();
  const tagName = decodeURIComponent(params.tag as string);
  const { user } = useAuth();
  const { posts, loading, error, hasMore, loadMore, tagInfo } = useTagPosts(tagName, user?.id);
  const { tags: relatedTags } = useTrendingTags(8);

  const observerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, loading]);

  const handlePostDeleted = useCallback(() => {
    // The hook re-reads on its own; nothing to do locally.
  }, []);

  const filteredRelatedTags = relatedTags.filter((t) => t.name.toLowerCase() !== tagName.toLowerCase());
  const count = tagInfo?.totalPosts;

  return (
    <PageFrame width="narrow">
      <header className="pq-page-head">
        <div className="flex items-start gap-2 min-w-0">
          <Link href="/explore" className="pq-icon-button -ml-2 shrink-0" aria-label="Back to Explore">
            <NavIcon name="back" />
          </Link>
          <div className="min-w-0">
            <h1 className="pq-page-head__title break-words">#{tagInfo?.name || tagName}</h1>
            {typeof count === "number" && (
              <p className="pq-page-head__lede">
                {count.toLocaleString()} {count === 1 ? "post" : "posts"} with this tag
              </p>
            )}
          </div>
        </div>
      </header>

      {filteredRelatedTags.length > 0 && (
        <nav className="mb-5" aria-label="Related tags">
          <div className="pq-chip-row">
            {filteredRelatedTags.slice(0, 6).map((tag) => (
              <Link key={tag.name} href={`/tag/${encodeURIComponent(tag.name)}`} className="pq-chip">
                #{tag.name}
              </Link>
            ))}
          </div>
        </nav>
      )}

      {error && (
        <div className="pq-feed-state pq-feed-state--card mb-4" role="alert">
          <p className="pq-feed-state__title">This tag didn&rsquo;t load</p>
          <p className="pq-feed-state__text">{error}</p>
        </div>
      )}

      {loading && posts.length === 0 && !error && (
        <div className="pq-feed-list">
          <div role="status" aria-live="polite" className="sr-only">Loading</div>
          {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
        </div>
      )}

      {!loading && posts.length === 0 && !error && (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Nothing tagged #{tagName} yet</p>
          <p className="pq-feed-state__text">
            {user ? "Be the first to share something with this tag." : "Sign in to be the first to share something with this tag."}
          </p>
          <div className="pq-feed-state__actions">
            <Link href="/explore" className="pq-button pq-button--md pq-button--secondary">Back to Explore</Link>
            {user ? (
              <Link href="/create" className="pq-button pq-button--md pq-button--primary">Share something</Link>
            ) : (
              <Link href={`/login?redirect=${encodeURIComponent(`/tag/${tagName}`)}`} className="pq-button pq-button--md pq-button--primary">Sign in</Link>
            )}
          </div>
        </div>
      )}

      {posts.length > 0 && (
        <div className="pq-feed-list">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={transformPostForCard(post)}
              onPostDeleted={handlePostDeleted}
              disableRealtimeSubscriptions={true}
            />
          ))}

          {loading && (
            <div className="pq-feed-more" role="status" aria-label="Loading more">
              <Spinner size="lg" />
            </div>
          )}

          <div ref={observerRef} className="h-4" />

          {!hasMore && <p className="pq-feed-end">That&rsquo;s everything for now.</p>}
        </div>
      )}
    </PageFrame>
  );
}
