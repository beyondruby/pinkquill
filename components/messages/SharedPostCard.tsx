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

/**
 * Strip HTML tags and truncate text
 */
function getExcerpt(html: string, maxLength: number = 60): string {
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

  // Loading state - compact skeleton
  if (loading) {
    return (
      <div
        className={`w-full max-w-[280px] rounded-2xl overflow-hidden ${
          isOwnMessage ? "bg-white/5" : "bg-gray-100"
        }`}
      >
        <div className="flex items-center gap-3 p-3 animate-pulse">
          <div className={`w-14 h-14 rounded-lg flex-shrink-0 ${isOwnMessage ? "bg-white/10" : "bg-gray-200"}`} />
          <div className="flex-1 min-w-0">
            <div className={`h-3 rounded ${isOwnMessage ? "bg-white/10" : "bg-gray-200"} w-24 mb-2`} />
            <div className={`h-2.5 rounded ${isOwnMessage ? "bg-white/10" : "bg-gray-200"} w-full mb-1`} />
            <div className={`h-2.5 rounded ${isOwnMessage ? "bg-white/10" : "bg-gray-200"} w-2/3`} />
          </div>
        </div>
      </div>
    );
  }

  // Error or deleted post
  if (error || !post) {
    return (
      <div
        className={`w-full max-w-[280px] rounded-2xl overflow-hidden ${
          isOwnMessage
            ? "bg-white/5 border border-white/10"
            : "bg-gray-50 border border-gray-200"
        }`}
      >
        <div className="flex items-center gap-3 p-3">
          <div className={`w-14 h-14 rounded-lg flex-shrink-0 flex items-center justify-center ${
            isOwnMessage ? "bg-white/10" : "bg-gray-100"
          }`}>
            <svg
              className={`w-6 h-6 ${isOwnMessage ? "text-white/30" : "text-gray-300"}`}
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
          </div>
          <div className="flex-1 min-w-0">
            <p className={`font-ui text-sm ${isOwnMessage ? "text-white/50" : "text-gray-400"}`}>
              Post unavailable
            </p>
            <p className={`font-ui text-xs ${isOwnMessage ? "text-white/30" : "text-gray-300"}`}>
              This post may have been deleted
            </p>
          </div>
        </div>
      </div>
    );
  }

  const typeLabel = POST_TYPE_LABELS[post.type] || "Post";

  return (
    <Link href={`/post/${post.id}`} className="block">
      <div
        className={`w-full max-w-[280px] rounded-2xl overflow-hidden transition-all active:scale-[0.98] ${
          isOwnMessage
            ? "bg-white/5 hover:bg-white/10 border border-white/10"
            : "bg-white hover:bg-gray-50 border border-gray-200"
        }`}
      >
        <div className="flex gap-3 p-3">
          {/* Thumbnail */}
          <div className={`w-14 h-14 rounded-lg flex-shrink-0 overflow-hidden ${
            !post.media ? (isOwnMessage ? "bg-white/10" : "bg-gray-100") : ""
          }`}>
            {post.media ? (
              <div className="relative w-full h-full">
                <img
                  src={post.media.media_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
                {post.media.media_type === "video" && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <img
                  src={post.author.avatar_url || DEFAULT_AVATAR}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            {/* Author and type */}
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className={`font-ui text-xs font-semibold truncate ${
                isOwnMessage ? "text-white" : "text-gray-900"
              }`}>
                {post.author.display_name || post.author.username}
              </span>
              <span className={`font-ui text-[10px] ${
                isOwnMessage ? "text-white/50" : "text-gray-400"
              }`}>
                · {typeLabel}
              </span>
            </div>

            {/* Title or excerpt */}
            {post.title ? (
              <p className={`font-ui text-xs line-clamp-2 ${
                isOwnMessage ? "text-white/80" : "text-gray-600"
              }`}>
                {post.title}
              </p>
            ) : (
              <p className={`font-ui text-xs line-clamp-2 ${
                isOwnMessage ? "text-white/70" : "text-gray-500"
              }`}>
                {getExcerpt(post.content, 60)}
              </p>
            )}

            {/* Tap to view hint */}
            <p className={`font-ui text-[10px] mt-1 ${
              isOwnMessage ? "text-white/40" : "text-gray-400"
            }`}>
              Tap to view
            </p>
          </div>

          {/* Arrow indicator */}
          <div className="flex items-center">
            <svg
              className={`w-4 h-4 ${isOwnMessage ? "text-white/30" : "text-gray-300"}`}
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
