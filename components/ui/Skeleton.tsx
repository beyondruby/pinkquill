"use client";

import { ReactNode } from "react";

interface SkeletonProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Base skeleton component with pulse animation
 */
export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-black/[0.06] via-black/[0.10] to-black/[0.06] bg-[length:200%_100%] rounded ${className}`}
      style={{
        animation: "shimmer 1.5s ease-in-out infinite",
      }}
    />
  );
}

/**
 * Skeleton for post cards in feed
 */
export function PostCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden p-4 md:p-6">
      {/* Author header */}
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 md:w-12 md:h-12 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Content */}
      <div className="space-y-2 mb-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4 pt-4 border-t border-black/[0.04]">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <div className="flex-1" />
        <Skeleton className="h-8 w-8" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the full feed
 */
export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </div>
  );
}

/**
 * Skeleton for profile header
 */
export function ProfileHeaderSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
      {/* Cover */}
      <Skeleton className="h-32 md:h-48 w-full rounded-none" />

      {/* Avatar and info */}
      <div className="px-4 md:px-6 pb-4 md:pb-6 -mt-12 md:-mt-16">
        <div className="flex flex-col md:flex-row md:items-end gap-4">
          <Skeleton className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-white" />
          <div className="flex-1">
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-24 mb-3" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
          <Skeleton className="h-10 w-28 rounded-full" />
        </div>

        {/* Stats */}
        <div className="flex gap-6 mt-4 pt-4 border-t border-black/[0.04]">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for conversation list item
 */
export function ConversationSkeleton() {
  return (
    <div className="flex items-center gap-3 p-4 border-b border-black/[0.04]">
      <Skeleton className="w-12 h-12 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-32 mb-2" />
        <Skeleton className="h-3 w-48" />
      </div>
      <Skeleton className="h-3 w-12" />
    </div>
  );
}

/**
 * Skeleton for message list
 */
export function MessageListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
        >
          <Skeleton
            className={`h-12 rounded-2xl ${
              i % 2 === 0 ? "w-2/3" : "w-1/2"
            }`}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for notification item
 */
export function NotificationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-4 border-b border-black/[0.04]">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1">
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-3 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for comment item
 */
export function CommentSkeleton() {
  return (
    <div className="flex gap-3 py-3">
      <Skeleton className="w-8 h-8 rounded-full flex-shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-24 mb-2" />
        <Skeleton className="h-4 w-full mb-1" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * Inline text skeleton for loading text content
 */
export function TextSkeleton({ width = "w-full" }: { width?: string }) {
  return <Skeleton className={`h-4 ${width} inline-block`} />;
}

// Add shimmer animation to global styles
if (typeof document !== "undefined") {
  const styleId = "skeleton-shimmer-style";
  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      @keyframes shimmer {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `;
    document.head.appendChild(style);
  }
}
