"use client";

import { memo } from "react";

interface ErrorFallbackProps {
  onRetry?: () => void;
  message?: string;
}

// Compact fallback for individual items (posts, comments, etc.)
export const ItemErrorFallback = memo(function ItemErrorFallback({
  onRetry,
  message = "Failed to load this item",
}: ErrorFallbackProps) {
  return (
    <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-center">
      <p className="font-body text-sm text-red-600 mb-2">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-ui font-medium text-red-500 hover:text-red-700 underline"
        >
          Try again
        </button>
      )}
    </div>
  );
});

// Feed error fallback
export const FeedErrorFallback = memo(function FeedErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg
          className="w-7 h-7 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg text-ink mb-2">
        Couldn&apos;t load feed
      </h3>
      <p className="font-body text-sm text-muted mb-4 max-w-sm">
        Something went wrong while loading your feed. Please try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Refresh Feed
        </button>
      )}
    </div>
  );
});

// Post card error fallback
export const PostCardErrorFallback = memo(function PostCardErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="post p-6 text-center bg-paper rounded-2xl border border-black/[0.06]">
      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-3">
        <svg
          className="w-5 h-5 text-amber-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
      </div>
      <p className="font-body text-sm text-muted mb-3">
        This post couldn&apos;t be displayed
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-ui font-medium text-purple-primary hover:text-pink-vivid transition-colors"
        >
          Try again
        </button>
      )}
    </div>
  );
});

// Messages error fallback
export const MessagesErrorFallback = memo(function MessagesErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
      <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none">
          <defs><linearGradient id="cg-ef-msg" x1="2" y1="20" x2="22" y2="4" gradientUnits="userSpaceOnUse"><stop stopColor="#6366F1" /><stop offset=".5" stopColor="#EC4899" /><stop offset="1" stopColor="#F97316" /></linearGradient></defs>
          <path d="M8 3.5C4.5 3.5 2 6 2 9c0 1.4.5 2.6 1.4 3.6L2 16l2.8-1.3c.7.5 1.6.8 2.5.8.7 0 1.3-.1 1.9-.3" stroke="url(#cg-ef-msg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M15 6.5c-3 0-5.5 2.5-5.5 5.5s2.5 5.5 5.5 5.5c.8 0 1.5-.1 2.2-.4L21 19l-1.5-3c.7-1 1.1-2.2 1.1-3.5 0-3-2.4-5.5-5.6-5.5z" stroke="url(#cg-ef-msg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M12 10.5h6M12 13h4" stroke="url(#cg-ef-msg)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </div>
      <h3 className="font-display text-lg text-ink mb-2">
        Messages unavailable
      </h3>
      <p className="font-body text-sm text-muted mb-4 max-w-sm">
        We couldn&apos;t load your messages. Please try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Reload Messages
        </button>
      )}
    </div>
  );
});

// Sidebar error fallback (compact)
export const SidebarErrorFallback = memo(function SidebarErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="p-4 text-center">
      <p className="font-body text-xs text-muted mb-2">
        Couldn&apos;t load content
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs font-ui font-medium text-purple-primary hover:underline"
        >
          Retry
        </button>
      )}
    </div>
  );
});

// Profile error fallback
export const ProfileErrorFallback = memo(function ProfileErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
      <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg
          className="w-8 h-8 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      </div>
      <h3 className="font-display text-xl text-ink mb-2">
        Profile unavailable
      </h3>
      <p className="font-body text-sm text-muted mb-4 max-w-sm">
        We couldn&apos;t load this profile. It may have been removed or there was a temporary error.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
      )}
    </div>
  );
});

// Modal error fallback
export const ModalErrorFallback = memo(function ModalErrorFallback({
  onRetry,
}: ErrorFallbackProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center min-h-[300px]">
      <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
        <svg
          className="w-6 h-6 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>
      <h3 className="font-display text-lg text-ink mb-2">
        Content unavailable
      </h3>
      <p className="font-body text-sm text-muted mb-4">
        Something went wrong. Please close and try again.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 rounded-full bg-black/5 text-ink font-ui text-sm font-medium hover:bg-black/10 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );
});
