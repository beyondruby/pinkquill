"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import type { SharedPostPreview, PostType } from "@/lib/types";
import { fetchSharedPostPreview } from "@/lib/hooks";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

interface SharedPostCardProps {
  postId: string;
  isOwnMessage: boolean;
  cachedPost?: SharedPostPreview;
}

// Post type labels
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

// Post type icons
const POST_TYPE_ICONS: Record<PostType, React.ReactNode> = {
  poem: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  journal: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  ),
  thought: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    </svg>
  ),
  visual: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  audio: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
    </svg>
  ),
  video: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
    </svg>
  ),
  essay: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  blog: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  ),
  story: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  ),
  letter: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  quote: (
    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
};

/**
 * Strip HTML tags and truncate text
 */
function getExcerpt(html: string, maxLength: number = 100): string {
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

  // Loading state
  if (loading) {
    return (
      <div
        className={`w-[260px] rounded-xl overflow-hidden ${
          isOwnMessage ? "bg-white/10" : "bg-black/[0.03]"
        }`}
      >
        <div className="p-3 animate-pulse">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-full ${isOwnMessage ? "bg-white/20" : "bg-black/10"}`} />
            <div className="flex-1">
              <div className={`h-3 rounded ${isOwnMessage ? "bg-white/20" : "bg-black/10"} w-20 mb-1`} />
              <div className={`h-2 rounded ${isOwnMessage ? "bg-white/20" : "bg-black/10"} w-16`} />
            </div>
          </div>
          <div className={`h-3 rounded ${isOwnMessage ? "bg-white/20" : "bg-black/10"} w-full mb-1`} />
          <div className={`h-3 rounded ${isOwnMessage ? "bg-white/20" : "bg-black/10"} w-3/4`} />
        </div>
      </div>
    );
  }

  // Error or deleted post
  if (error || !post) {
    return (
      <div
        className={`w-[260px] rounded-xl overflow-hidden ${
          isOwnMessage
            ? "bg-white/10 border border-white/20"
            : "bg-black/[0.03] border border-black/[0.06]"
        }`}
      >
        <div className="p-4 text-center">
          <svg
            className={`w-8 h-8 mx-auto mb-2 ${isOwnMessage ? "text-white/40" : "text-muted/40"}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className={`font-ui text-xs ${isOwnMessage ? "text-white/60" : "text-muted"}`}>
            Post unavailable
          </p>
        </div>
      </div>
    );
  }

  const typeLabel = POST_TYPE_LABELS[post.type] || "Post";
  const typeIcon = POST_TYPE_ICONS[post.type];

  return (
    <Link href={`/post/${post.id}`} className="block group">
      <div
        className={`w-[260px] rounded-xl overflow-hidden transition-all duration-200 ${
          isOwnMessage
            ? "bg-white/10 hover:bg-white/15 border border-white/20"
            : "bg-white hover:bg-black/[0.02] border border-black/[0.08] shadow-sm"
        }`}
      >
        {/* Post image if available */}
        {post.media && (
          <div className="relative h-32 overflow-hidden">
            {post.media.media_type === "video" ? (
              <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                  <svg className="w-5 h-5 text-purple-primary ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            ) : null}
            <img
              src={post.media.media_url}
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-3">
          {/* Author row */}
          <div className="flex items-center gap-2 mb-2">
            <img
              src={post.author.avatar_url || DEFAULT_AVATAR}
              alt={post.author.display_name || post.author.username}
              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p
                className={`font-ui text-xs font-medium truncate ${
                  isOwnMessage ? "text-white" : "text-ink"
                }`}
              >
                {post.author.display_name || post.author.username}
              </p>
              <p
                className={`font-ui text-[0.65rem] truncate ${
                  isOwnMessage ? "text-white/60" : "text-muted"
                }`}
              >
                @{post.author.username}
              </p>
            </div>
            {/* Type badge */}
            <div
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-ui font-medium ${
                isOwnMessage
                  ? "bg-white/20 text-white"
                  : "bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary"
              }`}
            >
              {typeIcon}
              <span>{typeLabel}</span>
            </div>
          </div>

          {/* Title */}
          {post.title && (
            <h4
              className={`font-display text-sm font-semibold mb-1 line-clamp-1 ${
                isOwnMessage ? "text-white" : "text-ink"
              }`}
            >
              {post.title}
            </h4>
          )}

          {/* Excerpt */}
          <p
            className={`font-body text-xs leading-relaxed line-clamp-2 ${
              isOwnMessage ? "text-white/80" : "text-muted"
            }`}
          >
            {getExcerpt(post.content, 80)}
          </p>

          {/* View post link */}
          <div
            className={`mt-2 pt-2 border-t flex items-center justify-between ${
              isOwnMessage ? "border-white/10" : "border-black/[0.06]"
            }`}
          >
            <span
              className={`font-ui text-[0.65rem] font-medium ${
                isOwnMessage
                  ? "text-white/70 group-hover:text-white"
                  : "text-purple-primary/70 group-hover:text-purple-primary"
              } transition-colors`}
            >
              View post
            </span>
            <svg
              className={`w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5 ${
                isOwnMessage ? "text-white/70" : "text-purple-primary/70"
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
