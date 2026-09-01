"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { SharedPostPreview, PostType } from "@/lib/types";
import { fetchSharedPostPreview } from "@/lib/hooks";
import Avatar from "@/components/ui/Avatar";

interface SharedPostCardProps {
  postId: string;
  isOwnMessage: boolean;
  cachedPost?: SharedPostPreview;
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  poem: "Poem",
  journal: "Journal",
  thought: "Thought",
  visual: "Visual",
  audio: "Audio",
  video: "Video",
  essay: "Essay",
  blog: "Blog",
  story: "Story",
  letter: "Letter",
  quote: "Quote",
};

function getExcerpt(html: string, maxLength: number = 80): string {
  const text = html.replace(/<[^>]*>/g, "").trim();
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

export default function SharedPostCard({
  postId,
  isOwnMessage,
  cachedPost,
}: SharedPostCardProps) {
  const [post, setPost] = useState<SharedPostPreview | null>(cachedPost || null);
  const [loading, setLoading] = useState(!cachedPost);
  const [error, setError] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (cachedPost) {
      setPost(cachedPost);
      return;
    }

    const fetchPost = async () => {
      setLoading(true);
      const data = await fetchSharedPostPreview(postId);
      if (data) {
        setPost(data);
      } else {
        setError(true);
      }
      setLoading(false);
    };

    fetchPost();
  }, [postId, cachedPost]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-[240px] rounded-xl overflow-hidden bg-surface border border-border-light">
        <div className="animate-pulse">
          <div className="h-[160px] bg-skeleton" />
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-6 h-6 rounded-full bg-skeleton" />
              <div className="h-3 bg-skeleton rounded w-20" />
            </div>
            <div className="h-3 bg-skeleton rounded w-full mb-1.5" />
            <div className="h-3 bg-skeleton rounded w-3/4" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <div className="w-[240px] rounded-xl overflow-hidden bg-surface border border-border-light">
        <div className="p-6 text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-skeleton flex items-center justify-center">
            <svg className="w-6 h-6 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
            </svg>
          </div>
          <p className="font-ui text-sm text-muted">Post unavailable</p>
        </div>
      </div>
    );
  }

  const typeLabel = POST_TYPE_LABELS[post.type] || "Post";
  const hasMedia = post.media && post.media.media_url;

  return (
    <Link href={`/post/${post.id}`} className="block">
      <div className="w-[240px] rounded-xl overflow-hidden bg-surface border border-border-light hover:border-border-strong transition-colors active:scale-[0.98] transition-transform">
        {/* Media preview */}
        {hasMedia ? (
          <div className="relative h-[160px] bg-skeleton">
            <img
              src={post.media!.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
            {post.media!.media_type === "video" && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-11 h-11 rounded-full bg-black/60 flex items-center justify-center backdrop-blur-sm">
                  <svg className="w-5 h-5 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            )}
            {/* Type badge on media */}
            <div className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-black/50 backdrop-blur-sm">
              <span className="font-ui text-3xs font-medium text-white">{typeLabel}</span>
            </div>
          </div>
        ) : (
          /* No media - show styled content preview */
          <div className="h-[120px] bg-subtle flex items-center justify-center p-4">
            <p className="font-body text-sm text-muted text-center line-clamp-4 italic">
              &quot;{getExcerpt(post.content, 100)}&quot;
            </p>
          </div>
        )}

        {/* Footer */}
        <div className="p-3 border-t border-border-light">
          <div className="flex items-center gap-2">
            <Avatar
              src={post.author.avatar_url}
              alt=""
              size={24}
              className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="font-ui text-xs font-semibold text-ink truncate">
                {post.author.display_name || post.author.username}
              </p>
              <p className="font-ui text-3xs text-muted truncate">
                @{post.author.username}
              </p>
            </div>
            {!hasMedia && (
              <span className="px-2 py-0.5 rounded-full bg-accent/10 font-ui text-3xs font-medium text-accent">
                {typeLabel}
              </span>
            )}
          </div>

          {/* Title if exists and has media */}
          {hasMedia && post.title && (
            <p className="mt-2 font-ui text-xs text-subdued line-clamp-2">
              {post.title}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
