"use client";

import "./studio.css";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { getOrCreateConversation } from "@/lib/messaging/conversations";
import { fetchCollaboratedPosts, useCommunities, COLLAB_SELF_REMOVED_EVENT } from "@/lib/hooks.legacy";
import type { CollabSelfRemovedDetail } from "@/lib/hooks.legacy";
import { useCollections, useToggleCollectionCollapse, useReorderCollections } from "@/lib/hooks/useCollections";
import { useRelays } from "@/lib/hooks/useFeed";
import { useBlock } from "@/lib/hooks/useInteractions";
import { usePinnedPosts } from "@/lib/hooks/usePinnedPosts";
import { useProfile, useFollow } from "@/lib/hooks/useProfile";
import type { FollowStatus } from "@/lib/types";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import { CommentIcon } from "@/components/ui/Icons";
import { getTimeAgo } from "@/lib/utils/time";

// Type for follows table real-time payload
import { useUserTakes, useRelayedTakes } from "@/lib/hooks/useTakes";
import { useTrackProfileView } from "@/lib/hooks/useTracking";
import { useAuth } from "@/components/providers/AuthProvider";
import { useUserEvent } from "@/components/providers/UserEventsProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import FollowersModal from "./FollowersModal";
import ShareModal from "@/components/ui/ShareModal";
import ActionMenu from "@/components/ui/ActionMenu";
import TakePostCard from "@/components/takes/TakePostCard";
import { Spinner } from "@/components/ui/Loading";
import { TabRow } from "@/components/ui/Tabs";
import { PageFrame } from "@/components/layout/PageFrame";
import ReportModal from "@/components/ui/ReportModal";
import Sheet from "@/components/ui/Sheet";
import StudioHeader from "./StudioHeader";
import StoreTab from "@/components/store/StoreTab";
import CommissionsTab from "@/components/commissions/CommissionsTab";
import { useHasCommissions } from "@/lib/hooks/useCommissions";
import type { Collection, Post } from "@/lib/types";
import { getInteractionCount } from "@/lib/types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

// Helper function to decode HTML entities
function decodeHtmlEntities(text: string): string {
  const entities: Record<string, string> = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&apos;': "'",
    '&nbsp;': ' ',
    '&#x27;': "'",
    '&#x2F;': '/',
    '&#60;': '<',
    '&#62;': '>',
  };
  return text.replace(/&[#\w]+;/g, (match) => entities[match] || match);
}

// Custom hook for scroll-triggered card reveal
function useScrollReveal() {
  const [revealedCards, setRevealedCards] = useState<Set<string>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute('data-post-id');
            if (id) {
              setRevealedCards((prev) => new Set([...prev, id]));
              // Unobserve after revealing to avoid re-triggering
              observerRef.current?.unobserve(entry.target);
            }
          }
        });
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    return () => observerRef.current?.disconnect();
  }, []);

  const observeCard = useCallback((element: HTMLElement | null) => {
    if (element && observerRef.current) {
      observerRef.current.observe(element);
    }
  }, []);

  return { revealedCards, observeCard };
}


// Social platform icons (using brand colors)
// Icons
const icons = {
  verified: (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
    </svg>
  ),
  location: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  link: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
  ),
  calendar: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  ),
  briefcase: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  education: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
    </svg>
  ),
  languages: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  ),
  message: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  ellipsis: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" />
    </svg>
  ),
  share: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v13" />
    </svg>
  ),
  feather: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
    </svg>
  ),
  heart: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  comment: (
    <CommentIcon />
  ),
  relay: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
  take: (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="8" width="18" height="13" rx="2" />
      <path d="M3 8l3-5h12l3 5" />
      <path d="M7 3l2 5M11 3l2 5M15 3l2 5" />
    </svg>
  ),
  quoteLeft: (
    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
      <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/>
    </svg>
  ),
  store: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  community: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  collection: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
};

// Branded icons for collections (matching NewCollectionModal)
const brandedCollectionIcons: Record<string, React.ReactNode> = {
  quill: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/>
      <line x1="16" y1="8" x2="2" y2="22"/>
    </svg>
  ),
  sparkle: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/>
      <path d="M5 3l.5 2L7 5.5 5.5 6 5 8l-.5-2L3 5.5 4.5 5 5 3z"/>
      <path d="M19 17l.5 2 1.5.5-1.5.5-.5 2-.5-2-1.5-.5 1.5-.5.5-2z"/>
    </svg>
  ),
  heart: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
    </svg>
  ),
  book: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
    </svg>
  ),
  music: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/>
      <circle cx="6" cy="18" r="3"/>
      <circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  camera: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  folder: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
    </svg>
  ),
  star: (
    <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
    </svg>
  ),
};

// Collection Card Component with glass effect
interface CollectionCardProps {
  collection: Collection;
  isOwnProfile: boolean;
  username: string;
  onToggleCollapse: () => void;
  onDelete: () => void;
  onDeleteItem: (itemId: string) => void;
  router: AppRouterInstance;
  // Reordering props
  index: number;
  totalCount: number;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

function CollectionCard({
  collection,
  isOwnProfile,
  username,
  onToggleCollapse,
  onDelete,
  onDeleteItem,
  router,
  index,
  totalCount,
  onMoveUp,
  onMoveDown,
}: CollectionCardProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<string | null>(null);
  const [collectionDeleting, setCollectionDeleting] = useState(false);
  const [itemDeleting, setItemDeleting] = useState(false);

  // Render collection icon
  const renderIcon = () => {
    if (collection.icon_emoji?.startsWith("icon:")) {
      const iconKey = collection.icon_emoji.replace("icon:", "");
      const icon = brandedCollectionIcons[iconKey];
      if (icon) {
        return <div className="w-8 h-8 text-purple-primary">{icon}</div>;
      }
    }
    if (collection.icon_emoji) {
      // Check if it's a hex code point (all hex characters)
      if (/^[0-9A-Fa-f]+$/.test(collection.icon_emoji)) {
        try {
          const codePoint = parseInt(collection.icon_emoji, 16);
          if (!isNaN(codePoint) && codePoint > 0) {
            return <span className="text-3xl">{String.fromCodePoint(codePoint)}</span>;
          }
        } catch {
          // Fall through to display as-is
        }
      }
      // Display emoji as-is (it's already a unicode character)
      return <span className="text-3xl">{collection.icon_emoji}</span>;
    }
    if (collection.icon_url) {
      return <img src={collection.icon_url} alt="" className="w-10 h-10 rounded-lg object-cover" />;
    }
    // Default icon
    return (
      <div className="w-8 h-8 text-purple-primary/60">
        <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      </div>
    );
  };

  return (
    <div className="group relative">
      {/* Glass effect container */}
      <div className="relative overflow-hidden rounded-3xl">
        {/* Background gradient layers */}
        <div className="absolute inset-0 bg-gradient-to-br from-surface/80 via-surface/60 to-purple-primary/5" />
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-primary/[0.03] via-transparent to-pink-vivid/[0.05]" />
        <div className="absolute inset-0 backdrop-blur-xl" />

        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

        {/* Content */}
        <div className="relative p-6">
          {/* Header */}
          <div className="flex items-start gap-4">
            {/* Icon */}
            <div className="shrink-0 w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center shadow-sm">
              {renderIcon()}
            </div>

            {/* Title & Description */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-xl font-semibold text-ink truncate">
                  {collection.name}
                </h3>
                {collection.items_count !== undefined && collection.items_count > 0 && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-purple-primary/10 text-purple-primary text-xs font-medium">
                    {collection.items_count} {collection.items_count === 1 ? 'item' : 'items'}
                  </span>
                )}
              </div>
              {collection.description && (
                <p className="mt-1 font-body text-sm text-muted line-clamp-2">
                  {collection.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="shrink-0 flex items-center gap-1">
              {/* Reorder buttons - only for owner */}
              {isOwnProfile && totalCount > 1 && (
                <div className="flex items-center gap-0.5 mr-1">
                  <button
                    onClick={onMoveUp}
                    disabled={index === 0}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      index === 0
                        ? 'text-muted/30 cursor-not-allowed'
                        : 'text-muted hover:text-ink hover:bg-skeleton'
                    }`}
                    title="Move up"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={onMoveDown}
                    disabled={index === totalCount - 1}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      index === totalCount - 1
                        ? 'text-muted/30 cursor-not-allowed'
                        : 'text-muted hover:text-ink hover:bg-skeleton'
                    }`}
                    title="Move down"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              )}

              {/* Collapse toggle */}
              <button
                onClick={onToggleCollapse}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton transition-all"
                title={collection.is_collapsed ? "Expand" : "Collapse"}
              >
                <svg
                  className={`w-5 h-5 transition-transform duration-300 ${collection.is_collapsed ? "" : "rotate-180"}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Owner menu */}
              {isOwnProfile && (
                <ActionMenu
                  widthClassName="w-44"
                  buttonClassName="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-skeleton transition-all"
                  buttonIconClassName="w-5 h-5"
                  items={[
                    {
                      label: "Edit",
                      onSelect: () => router.push(`/studio/${username}/collections/${collection.slug}/edit`),
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      ),
                    },
                    {
                      label: "Delete",
                      onSelect: () => setShowDeleteConfirm(true),
                      tone: "danger",
                      dividerBefore: true,
                      icon: (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ),
                    },
                  ]}
                />
              )}
            </div>
          </div>

          {/* Items Grid */}
          {!collection.is_collapsed && collection.items && collection.items.length > 0 && (
            <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {collection.items.map((item) => (
                <div
                  key={item.id}
                  className="group/item relative cursor-pointer"
                  onClick={() => router.push(`/studio/${username}/collections/${collection.slug}/${item.slug}`)}
                >
                  {/* Item Card */}
                  <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
                    {item.cover_url ? (
                      <img
                        src={item.cover_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="w-12 h-12 text-purple-primary/30">
                          <svg className="w-full h-full" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* Overlay with name */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover/item:opacity-100 transition-opacity duration-300">
                      <div className="absolute bottom-0 left-0 right-0 p-3">
                        <p className="font-ui text-sm font-medium text-white truncate">
                          {item.name}
                        </p>
                        {item.posts_count !== undefined && item.posts_count > 0 && (
                          <p className="text-xs text-white/70 mt-0.5">
                            {item.posts_count} {item.posts_count === 1 ? 'post' : 'posts'}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Delete button for owner */}
                    {isOwnProfile && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteItemTarget(item.id);
                        }}
                        className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-white opacity-0 group-hover/item:opacity-100 hover:bg-red-500 transition-all"
                        title="Delete item"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Item name below card */}
                  <p className="mt-2 font-ui text-sm font-medium text-ink truncate text-center">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="font-body text-xs text-muted truncate text-center">
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Empty items state */}
          {!collection.is_collapsed && (!collection.items || collection.items.length === 0) && (
            <div className="mt-6 py-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-purple-primary/10 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <p className="font-body text-sm text-muted">
                {isOwnProfile
                  ? "No items yet. Add items when creating posts!"
                  : "No items in this collection yet."
                }
              </p>
            </div>
          )}
        </div>

        {/* Glass border */}
        <div className="absolute inset-0 rounded-3xl border border-surface/60 pointer-events-none" />

        {/* Subtle inner shadow */}
        <div className="absolute inset-0 rounded-3xl shadow-inner pointer-events-none" style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' }} />
      </div>

      {/* Decorative gradient glow on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-primary/20 to-pink-vivid/20 rounded-[28px] opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 -z-10" />

      {/* Delete Collection Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={async () => {
          setCollectionDeleting(true);
          await onDelete();
          setCollectionDeleting(false);
          setShowDeleteConfirm(false);
        }}
        title="Pull this collection from your studio?"
        description="The collection and every piece inside it will leave your shelves for good. No way to set it back up."
        confirmText="Erase it"
        isDanger
        loading={collectionDeleting}
      />

      {/* Delete Item Confirmation */}
      <ConfirmationModal
        isOpen={!!deleteItemTarget}
        onClose={() => setDeleteItemTarget(null)}
        onConfirm={async () => {
          if (!deleteItemTarget) return;
          setItemDeleting(true);
          await onDeleteItem(deleteItemTarget);
          setItemDeleting(false);
          setDeleteItemTarget(null);
        }}
        title="Delete Item?"
        description="This action cannot be undone. This item will be permanently removed from the collection."
        confirmText="Delete"
        isDanger
        loading={itemDeleting}
      />
    </div>
  );
}

function StudioSubTabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className="pq-chip" aria-pressed={active} onClick={onClick}>
      {label}
    </button>
  );
}

type StudioTab = "posts" | "takes" | "relays" | "store" | "commissions" | "collections";

interface StudioProfileProps {
  username: string;
}

export default function StudioProfile({ username }: StudioProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { openPostModal } = useModal();
  const [activeTab, setActiveTab] = useState<StudioTab>("posts");
  const [relaySubTab, setRelaySubTab] = useState<"posts" | "takes">("posts");
  const shouldLoadTakes = activeTab === "takes";
  const shouldLoadRelayPosts = activeTab === "relays";
  const shouldLoadRelayTakes = activeTab === "relays" && relaySubTab === "takes";
  const shouldLoadCollections = activeTab === "collections";
  const { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: refetchProfile } = useProfile(username, user?.id);
  const { checkFollowStatus, follow, unfollow } = useFollow();
  const { checkIsBlocked, blockUser, unblockUser } = useBlock();
  const { relays, loading: relaysLoading } = useRelays(shouldLoadRelayPosts ? username : "");
  const { takes: userTakes, loading: takesLoading } = useUserTakes(shouldLoadTakes ? username : "", user?.id);
  const { takes: relayedTakes, loading: relayedTakesLoading } = useRelayedTakes(shouldLoadRelayTakes ? username : "", user?.id);
  const { communities: userCommunities } = useCommunities(profile?.id, 'joined');
  const { collections, loading: collectionsLoading, refetch: refetchCollections } = useCollections(shouldLoadCollections ? profile?.id : undefined);
  const { toggleCollapse } = useToggleCollectionCollapse();
  const { reorderCollections } = useReorderCollections();
  const { pinnedPostIds, isPinned, canPin, pinPost, unpinPost } = usePinnedPosts(profile?.id);
  const { revealedCards, observeCard } = useScrollReveal();
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [showShareModal, setShowShareModal] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [collaboratedPosts, setCollaboratedPosts] = useState<Post[]>([]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "posts" || tab === "takes" || tab === "relays" || tab === "store" || tab === "commissions" || tab === "collections") {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/studio/${username}` : `/studio/${username}`;

  // Track profile views (only for other people's profiles)
  const isOwnProfile = user?.id === profile?.id;
  // Phase 3b: the Commissions tab exists only for profiles that sell (owners always see it).
  const { hasCommissions } = useHasCommissions(profile?.id);
  const showCommissionsTab = isOwnProfile || hasCommissions === true;
  useEffect(() => {
    if (activeTab === "commissions" && hasCommissions === false && !isOwnProfile) setActiveTab("posts");
  }, [activeTab, hasCommissions, isOwnProfile]);
  useTrackProfileView(isOwnProfile ? undefined : profile?.id, "direct");

  // Post view modes
  type PostViewMode = "all" | "blog" | "gallery" | "poems" | "journals" | "communities";
  const [postViewMode, setPostViewMode] = useState<PostViewMode>("all");

  useEffect(() => {
    const checkFollow = async () => {
      if (user && profile && !isOwnProfile) {
        const status = await checkFollowStatus(user.id, profile.id);
        setFollowStatus(status);
      }
    };
    checkFollow();
  }, [user, profile, isOwnProfile]);

  // Follow-status changes (e.g. a request being accepted/rejected) arrive on the
  // per-user broadcast channel instead of a dedicated postgres_changes subscription.
  useUserEvent("follow_change", (payload) => {
    if (!user || !profile || isOwnProfile) return;
    if (payload.follower_id !== user.id || payload.following_id !== profile.id) return;

    if (payload.op === "DELETE") {
      setFollowStatus(null);
      return;
    }

    const newStatus = payload.status ?? null;
    setFollowStatus(newStatus);
    // If the follow was just accepted, refetch the full profile to load gated data.
    if (newStatus === "accepted") {
      refetchProfile();
    }
  });

  // Check if blocked
  useEffect(() => {
    const checkBlock = async () => {
      if (user && profile && !isOwnProfile) {
        const blocked = await checkIsBlocked(user.id, profile.id);
        setIsBlocked(blocked);
      }
    };
    checkBlock();
  }, [user, profile, isOwnProfile]);

  // Fetch collaborated posts
  useEffect(() => {
    const loadCollaboratedPosts = async () => {
      if (profile?.id) {
        try {
          const collabPosts = await fetchCollaboratedPosts(profile.id);
          setCollaboratedPosts(collabPosts);
        } catch (error) {
          console.error("Error fetching collaborated posts:", error);
        }
      }
    };
    loadCollaboratedPosts();
  }, [profile?.id]);

  // Drop a post from the collaborated-posts grid as soon as the profile owner
  // removes themselves from it. The PostCard / PostDetailModal dispatches a
  // browser CustomEvent on success.
  useEffect(() => {
    if (!profile?.id) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<CollabSelfRemovedDetail>).detail;
      if (!detail || detail.userId !== profile.id) return;
      setCollaboratedPosts((prev) => prev.filter((p) => p.id !== detail.postId));
    };
    window.addEventListener(COLLAB_SELF_REMOVED_EVENT, handler);
    return () => window.removeEventListener(COLLAB_SELF_REMOVED_EVENT, handler);
  }, [profile?.id]);

  const handleBlock = async () => {
    if (!user || !profile) return;

    setBlockLoading(true);
    if (isBlocked) {
      const result = await unblockUser(user.id, profile.id);
      if (result.success) {
        setIsBlocked(false);
      }
    } else {
      const result = await blockUser(user.id, profile.id);
      if (result.success) {
        setIsBlocked(true);
        setFollowStatus(null);
        setShowBlockConfirm(false);
        // Redirect to home after blocking
        router.push('/');
      }
    }
    setBlockLoading(false);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !profile) return;
    setReportLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: profile.id,
        reason: details?.trim() ? `${reason}: ${details.trim()}` : reason,
        type: "user",
      });
      setReportSuccess(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    } finally {
      setReportLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!user || !profile || messageLoading) return;
    setMessageLoading(true);
    try {
      const conversationId = await getOrCreateConversation(profile.id);
      router.push(`/messages?conversation=${conversationId}`);
    } catch (err) {
      console.error("Failed to start conversation:", err);
      setMessageLoading(false);
    }
  };

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user || !profile || isOwnProfile) return;
    setFollowLoading(true);

    if (followStatus === 'accepted' || followStatus === 'pending') {
      // Unfollow or cancel request
      await unfollow(user.id, profile.id);
      setFollowStatus(null);
    } else {
      // Follow or send request
      const newStatus = await follow(user.id, profile.id);
      setFollowStatus(newStatus);
    }

    setFollowLoading(false);
  };

  // Derived state for easier rendering
  const isFollowing = followStatus === 'accepted';

  // Refetch profile when follow status changes to 'accepted' (to get full profile data)
  useEffect(() => {
    if (isFollowing && isPrivateAccount) {
      // User just got accepted as a follower of a private account - refetch to get full data
      refetchProfile();
    }
  }, [isFollowing, isPrivateAccount, refetchProfile]);

  if (loading) {
    return (
      <PageFrame width="wide" className="pq-studio">
        <div className="pq-feed-state" role="status" aria-label="Loading studio"><Spinner size="lg" /></div>
      </PageFrame>
    );
  }

  if (error || !profile || isBlockedByUser) {
    return (
      <PageFrame width="wide" className="pq-studio">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">No studio here</p>
          <p className="pq-feed-state__text">This person doesn&rsquo;t exist, or their studio isn&rsquo;t available to you.</p>
          <div className="pq-feed-state__actions">
            <Link href="/explore" className="pq-button pq-button--md pq-button--secondary">Explore instead</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  return (
    <div className="pq-studio">
      <PageFrame width="wide">
        <StudioHeader
          profile={profile}
          isOwnProfile={isOwnProfile}
          signedIn={!!user}
          followStatus={followStatus}
          followLoading={followLoading}
          onFollow={handleFollow}
          messageLoading={messageLoading}
          onMessage={handleMessage}
          isBlocked={isBlocked}
          onBlock={() => { if (isBlocked) void handleBlock(); else setShowBlockConfirm(true); }}
          onReport={() => setShowReportModal(true)}
          onShare={() => setShowShareModal(true)}
          onCopyLink={() => { void navigator.clipboard.writeText(profileUrl); }}
          onOpenFollowers={(type) => { setFollowersModalTab(type); setShowFollowersModal(true); }}
          communities={userCommunities || []}
          onOpenCommunities={() => setShowCommunitiesModal(true)}
          gated={isPrivateAccount && !isOwnProfile && !isFollowing}
        />

        {/* Tabs and Content - Only show for public accounts or if following */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
          <>
        <TabRow<StudioTab>
          className="pq-studio-tabs"
          ariaLabel="Studio sections"
          items={[
            { id: "posts", label: "Posts" },
            { id: "takes", label: "Takes" },
            { id: "relays", label: "Relays" },
            { id: "store", label: "Store" },
            ...(showCommissionsTab ? [{ id: "commissions" as StudioTab, label: "Commissions" }] : []),
            { id: "collections", label: "Collections" },
          ]}
          value={activeTab}
          onChange={setActiveTab}
        />

        {/* Posts Section */}
        {activeTab === "posts" && (
          <div className="pq-studio-section" role="tabpanel">
            {/* View Mode Tabs */}
            <div className="pq-chip-scroll pq-studio-filters" role="group" aria-label="Kind of post">
              <StudioSubTabButton
                label="All"
                active={postViewMode === "all"}
                onClick={() => setPostViewMode("all")}
              />
              <StudioSubTabButton
                label="Blog"
                active={postViewMode === "blog"}
                onClick={() => setPostViewMode("blog")}
              />
              <StudioSubTabButton
                label="Gallery"
                active={postViewMode === "gallery"}
                onClick={() => setPostViewMode("gallery")}
              />
              <StudioSubTabButton
                label="Poems"
                active={postViewMode === "poems"}
                onClick={() => setPostViewMode("poems")}
              />
              <StudioSubTabButton
                label="Journals"
                active={postViewMode === "journals"}
                onClick={() => setPostViewMode("journals")}
              />
              <StudioSubTabButton
                label="Communities"
                active={postViewMode === "communities"}
                onClick={() => setPostViewMode("communities")}
              />
            </div>

            {(() => {
              // Merge regular posts with collaborated posts
              const collaboratedPostIds = new Set(collaboratedPosts.map(p => p.id));
              const allPosts = [
                ...posts.map(p => ({ ...p, isCollaboration: false })),
                ...collaboratedPosts
                  .filter(p => !posts.some(post => post.id === p.id)) // Avoid duplicates
                  .map(p => ({ ...p, isCollaboration: true }))
              ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

              // Filter posts based on view mode
              // Community posts are ONLY shown in the communities view
              const getFilteredPosts = () => {
                switch (postViewMode) {
                  case "communities":
                    // Only community posts
                    return allPosts.filter(p => p.community_id);
                  case "gallery":
                    // Only posts with media, exclude community posts
                    return allPosts.filter(p => p.media && p.media.length > 0 && !p.community_id);
                  case "poems":
                    // Only poems, exclude community posts
                    return allPosts.filter(p => p.type === "poem" && !p.community_id);
                  case "journals":
                    // Only journals, exclude community posts
                    return allPosts.filter(p => p.type === "journal" && !p.community_id);
                  case "blog":
                  case "all":
                  default:
                    // All posts except community posts
                    return allPosts.filter(p => !p.community_id);
                }
              };

              // Sort posts with pinned posts at the top (only for "all" view)
              const sortWithPinnedPosts = (postsToSort: typeof allPosts) => {
                if (postViewMode !== "all" || pinnedPostIds.length === 0) {
                  return postsToSort;
                }

                const pinned = postsToSort
                  .filter(p => pinnedPostIds.includes(p.id))
                  .sort((a, b) => pinnedPostIds.indexOf(a.id) - pinnedPostIds.indexOf(b.id));
                const unpinned = postsToSort.filter(p => !pinnedPostIds.includes(p.id));

                return [...pinned, ...unpinned];
              };

              const filteredPosts = sortWithPinnedPosts(getFilteredPosts());

              // Empty state
              if (filteredPosts.length === 0) {
                const emptyMessages: Record<string, { icon: React.ReactNode; text: string }> = {
                  all: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    ),
                    text: "No posts yet"
                  },
                  blog: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    ),
                    text: "No posts yet"
                  },
                  gallery: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    ),
                    text: "No visual posts yet"
                  },
                  poems: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    ),
                    text: "No poems yet"
                  },
                  journals: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    ),
                    text: "No journal entries yet"
                  },
                  communities: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ),
                    text: "No community posts yet"
                  }
                };

                const { text } = emptyMessages[postViewMode];
                return (
                  <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">{text}</p></div>
                );
              }

              // Helper to create postForModal
              const createPostForModal = (work: typeof filteredPosts[0]) => {
                const isCollab = work.isCollaboration || collaboratedPostIds.has(work.id);
                const workAuthor = isCollab && work.author ? work.author : profile;
                return {
                  id: work.id,
                  authorId: workAuthor.id || profile.id,
                  author: {
                    name: workAuthor.display_name || workAuthor.username || profile.display_name || profile.username,
                    handle: `@${workAuthor.username || profile.username}`,
                    avatar: workAuthor.avatar_url || profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80",
                  },
                  type: work.type as "poem" | "journal" | "thought" | "visual" | "audio" | "video",
                  typeLabel: work.type.charAt(0).toUpperCase() + work.type.slice(1),
                  timeAgo: getTimeAgo(work.created_at),
                  createdAt: work.created_at,
                  title: work.title || undefined,
                  content: work.content,
                  media: work.media,
                  styling: work.styling,
                  post_location: work.post_location,
                  metadata: work.metadata,
                  stats: {
                    admires: getInteractionCount(work),
                    reactions: getInteractionCount(work),
                    comments: work.comments_count,
                    relays: work.relays_count || 0,
                  },
                  isAdmired: work.user_has_admired,
                  isSaved: work.user_has_saved,
                  isRelayed: work.user_has_relayed,
                  community: work.community ? {
                    slug: work.community.slug,
                    name: work.community.name,
                    avatar_url: work.community.avatar_url,
                  } : undefined,
                  flair: work.flair || undefined,
                  // Pass through collaborators so the post detail modal can offer
                  // the "Remove me from this collab" action when the viewer is
                  // an accepted collaborator.
                  collaborators: work.collaborators,
                };
              };

              const typeLabels: Record<string, string> = {
                poem: "Poetry",
                journal: "Journal",
                thought: "Thought",
                essay: "Essay",
                blog: "Blog",
                story: "Story",
                letter: "Letter",
                visual: "Visual",
                quote: "Quote",
                audio: "Audio",
                video: "Video",
              };

              // ========== ALL VIEW - Uniform Glass Grid ==========
              if (postViewMode === "all") {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredPosts.map((work) => {
                      const isCollab = work.isCollaboration || collaboratedPostIds.has(work.id);
                      const hasMedia = work.media && work.media.length > 0;
                      const hasMultipleImages = work.media && work.media.length > 1;
                      const plainContent = work.content
                        ? decodeHtmlEntities(work.content.replace(/<[^>]*>/g, '')).substring(0, 100)
                        : '';
                      const formattedDate = new Date(work.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric'
                      });

                      return (
                        <article
                          key={work.id}
                          ref={observeCard}
                          data-post-id={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          className={`group relative cursor-pointer ${revealedCards.has(work.id) ? 'animate-fadeIn' : 'opacity-0'}`}
                        >
                          {/* Glass card container */}
                          <div className="relative h-full overflow-hidden rounded-2xl bg-elevated/80 backdrop-blur-xl shadow-sm hover:shadow-xl transition-all duration-300">
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/[0.02] via-transparent to-pink-vivid/[0.03] pointer-events-none" />

                            {/* Shimmer effect */}
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-surface/50 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out pointer-events-none" />

                            {/* Image section - uniform height */}
                            <div className="relative h-48 overflow-hidden bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5">
                              {hasMedia ? (
                                <>
                                  <img
                                    src={work.media[0].media_url}
                                    alt={work.title || ""}
                                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                  />
                                  {/* Gradient overlay on image */}
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />

                                  {/* Pinned badge */}
                                  {isPinned(work.id) && (
                                    <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-purple-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg">
                                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                      </svg>
                                    </div>
                                  )}

                                  {/* Pin/Unpin button for profile owner */}
                                  {isOwnProfile && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isPinned(work.id)) {
                                          unpinPost(work.id);
                                        } else if (canPin) {
                                          pinPost(work.id);
                                        }
                                      }}
                                      className={`absolute top-3 ${isPinned(work.id) ? 'left-12' : 'left-3'} w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 ${
                                        isPinned(work.id)
                                          ? 'bg-surface/90 hover:bg-surface text-purple-primary'
                                          : canPin
                                            ? 'bg-black/40 hover:bg-accent/90 text-white'
                                            : 'bg-black/20 text-white/50 cursor-not-allowed'
                                      }`}
                                      title={isPinned(work.id) ? 'Unpin post' : canPin ? 'Pin to profile' : 'Max 6 pinned posts'}
                                    >
                                      {isPinned(work.id) ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                        </svg>
                                      )}
                                    </button>
                                  )}

                                  {/* Multi-image badge */}
                                  {hasMultipleImages && (
                                    <div className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center">
                                      <span className="text-white text-xs font-medium">{work.media.length}</span>
                                    </div>
                                  )}

                                  {/* Type badge overlaid on image */}
                                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-surface/95 backdrop-blur-sm text-purple-primary text-xs font-semibold shadow-sm">
                                      {typeLabels[work.type] || work.type}
                                    </span>
                                    {isCollab && (
                                      <span className="px-2 py-1 rounded-full bg-pink-vivid/90 text-white text-xs font-medium flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                </>
                              ) : (
                                // No image - decorative placeholder
                                <div className="w-full h-full flex items-center justify-center relative">
                                  {/* Pinned badge for no-image posts */}
                                  {isPinned(work.id) && (
                                    <div className="absolute top-3 left-3 w-7 h-7 rounded-full bg-purple-primary/90 backdrop-blur-sm flex items-center justify-center shadow-lg z-10">
                                      <svg className="w-3.5 h-3.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                      </svg>
                                    </div>
                                  )}

                                  {/* Pin/Unpin button for profile owner (no-image posts) */}
                                  {isOwnProfile && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (isPinned(work.id)) {
                                          unpinPost(work.id);
                                        } else if (canPin) {
                                          pinPost(work.id);
                                        }
                                      }}
                                      className={`absolute top-3 ${isPinned(work.id) ? 'left-12' : 'left-3'} w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all duration-200 z-10 ${
                                        isPinned(work.id)
                                          ? 'bg-surface/90 hover:bg-surface text-purple-primary'
                                          : canPin
                                            ? 'bg-accent/20 hover:bg-accent/80 hover:text-on-accent text-accent'
                                            : 'bg-black/10 text-muted cursor-not-allowed'
                                      }`}
                                      title={isPinned(work.id) ? 'Unpin post' : canPin ? 'Pin to profile' : 'Max 6 pinned posts'}
                                    >
                                      {isPinned(work.id) ? (
                                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                      ) : (
                                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z"/>
                                        </svg>
                                      )}
                                    </button>
                                  )}

                                  {/* Large type icon */}
                                  <div className="text-purple-primary/20">
                                    {work.type === 'poem' && (
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                      </svg>
                                    )}
                                    {work.type === 'journal' && (
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    )}
                                    {(work.type === 'thought' || work.type === 'blog' || work.type === 'essay') && (
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                      </svg>
                                    )}
                                    {work.type === 'quote' && (
                                      <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311 1.804.167 3.226 1.648 3.226 3.489a3.5 3.5 0 01-3.5 3.5c-1.073 0-2.099-.49-2.748-1.179z"/>
                                      </svg>
                                    )}
                                    {(work.type === 'story' || work.type === 'letter') && (
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                      </svg>
                                    )}
                                    {!['poem', 'journal', 'thought', 'blog', 'essay', 'quote', 'story', 'letter'].includes(work.type) && (
                                      <svg className="w-16 h-16" fill="none" stroke="currentColor" strokeWidth={1} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                      </svg>
                                    )}
                                  </div>

                                  {/* Type badge */}
                                  <div className="absolute bottom-3 left-3 flex items-center gap-2">
                                    <span className="px-3 py-1 rounded-full bg-purple-primary/10 text-purple-primary text-xs font-semibold">
                                      {typeLabels[work.type] || work.type}
                                    </span>
                                    {isCollab && (
                                      <span className="px-2 py-1 rounded-full bg-pink-vivid/10 text-pink-vivid text-xs font-medium flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                          <path d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Content section */}
                            <div className="p-4">
                              {/* Title */}
                              <h3 className="font-display text-base font-semibold text-ink mb-2 line-clamp-2 group-hover:text-accent transition-colors">
                                {work.title || "Untitled"}
                              </h3>

                              {/* Excerpt */}
                              <p className="font-body text-sm text-muted line-clamp-2 mb-3">
                                {plainContent || "..."}
                              </p>

                              {/* Footer */}
                              <div className="flex items-center justify-between pt-3 border-t border-border-light">
                                <span className="text-xs text-muted">{formattedDate}</span>
                                <div className="flex items-center gap-3">
                                  <span className="flex items-center gap-1 text-xs text-muted">
                                    <svg className="w-4 h-4 text-pink-vivid/70" fill="currentColor" viewBox="0 0 24 24">
                                      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                    </svg>
                                    {getInteractionCount(work)}
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-muted">
                                    <CommentIcon />
                                    {work.comments_count || 0}
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* Glass border */}
                            <div className="absolute inset-0 rounded-2xl border border-border-light pointer-events-none" />
                          </div>

                          {/* Hover glow effect */}
                          <div className="absolute -inset-1 bg-gradient-to-r from-purple-primary/20 to-pink-vivid/20 rounded-[20px] opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-300 -z-10" />
                        </article>
                      );
                    })}
                  </div>
                );
              }

              // ========== BLOG VIEW ==========
              if (postViewMode === "blog") {
                return (
                  <div className="space-y-6">
                    {filteredPosts.map((work) => {
                      const isCollab = work.isCollaboration || collaboratedPostIds.has(work.id);
                      const hasMedia = work.media && work.media.length > 0;
                      const plainContent = work.content
                        ? decodeHtmlEntities(work.content.replace(/<[^>]*>/g, '')).substring(0, 300)
                        : '';
                      const formattedDate = new Date(work.created_at).toLocaleDateString('en-US', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      });

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          className="group relative bg-surface rounded-2xl border border-border-light hover:border-accent/20 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden"
                        >
                          {/* Featured image */}
                          {hasMedia && (
                            <div className="relative h-48 sm:h-64 overflow-hidden">
                              <img
                                src={work.media[0].media_url}
                                alt={work.title || ""}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                              {work.media.length > 1 && (
                                <div className="absolute top-3 right-3 px-2 py-1 bg-black/50 backdrop-blur-sm rounded-full text-white text-xs flex items-center gap-1">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                  </svg>
                                  {work.media.length}
                                </div>
                              )}
                            </div>
                          )}

                          <div className="p-6">
                            {/* Meta row */}
                            <div className="flex items-center gap-3 mb-3">
                              <span className="px-2.5 py-1 rounded-full bg-purple-primary/10 text-purple-primary text-xs font-medium">
                                {typeLabels[work.type] || work.type}
                              </span>
                              <span className="text-sm text-muted">{formattedDate}</span>
                              {isCollab && (
                                <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-pink-vivid/10 text-pink-vivid text-xs font-medium">
                                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                  Collab
                                </span>
                              )}
                            </div>

                            {/* Title */}
                            <h2 className="font-display text-xl sm:text-2xl font-semibold text-ink mb-3 group-hover:text-accent transition-colors line-clamp-2">
                              {work.title || "Untitled"}
                            </h2>

                            {/* Excerpt */}
                            <p className="font-body text-muted leading-relaxed line-clamp-3 mb-4">
                              {plainContent || "No preview available..."}
                            </p>

                            {/* Footer */}
                            <div className="flex items-center justify-between pt-4 border-t border-border-light">
                              <div className="flex items-center gap-4 text-sm text-muted">
                                <span className="flex items-center gap-1.5">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                  </svg>
                                  {getInteractionCount(work)}
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <CommentIcon />
                                  {work.comments_count || 0}
                                </span>
                              </div>
                              <span className="text-accent text-sm font-medium group-hover:underline">
                                Read more →
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              }

              // ========== GALLERY VIEW ==========
              if (postViewMode === "gallery") {
                return (
                  <div className="grid grid-cols-3 gap-1 sm:gap-2">
                    {filteredPosts.map((work) => {
                      const hasMultipleImages = work.media && work.media.length > 1;

                      return (
                        <div
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          className="group relative aspect-square cursor-pointer overflow-hidden bg-skeleton/60 rounded-sm sm:rounded-lg"
                        >
                          <img
                            src={work.media[0].media_url}
                            alt={work.title || ""}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                            <div className="flex items-center gap-6 text-white">
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                {getInteractionCount(work)}
                              </span>
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
                                </svg>
                                {work.comments_count || 0}
                              </span>
                            </div>
                          </div>

                          {/* Multiple images indicator */}
                          {hasMultipleImages && (
                            <div className="absolute top-2 right-2 text-white drop-shadow-lg">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H8V4h12v12z"/>
                              </svg>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              }

              // ========== POEMS VIEW ==========
              if (postViewMode === "poems") {
                return (
                  <div className="max-w-2xl mx-auto">
                    {filteredPosts.map((work, idx) => {
                      const plainContent = work.content
                        ? decodeHtmlEntities(work.content.replace(/<[^>]*>/g, '')).substring(0, 240)
                        : '';
                      const formattedDate = new Date(work.created_at).toLocaleDateString('en-US', {
                        month: 'long',
                        day: 'numeric',
                        year: 'numeric'
                      });

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          className="group cursor-pointer py-12 first:pt-6 last:pb-6 px-4 rounded-2xl hover:bg-subtle/60 transition-colors"
                        >
                          {idx > 0 && (
                            <div className="flex justify-center -mt-12 mb-12">
                              <div className="h-px w-16 bg-purple-primary/15" />
                            </div>
                          )}

                          {work.title && (
                            <h2 className="font-display text-2xl text-ink text-center mb-6 group-hover:text-accent transition-colors">
                              {work.title}
                            </h2>
                          )}

                          <p className="font-body text-lg text-ink/80 italic leading-loose text-center whitespace-pre-line">
                            {plainContent || "..."}
                          </p>

                          {plainContent.length >= 240 && (
                            <p className="text-center mt-5 font-ui text-xs text-purple-primary/80 group-hover:text-accent transition-colors">
                              Continue reading
                            </p>
                          )}

                          <div className="flex items-center justify-center gap-3 mt-8 font-ui text-xs text-muted">
                            <span>{formattedDate}</span>
                            <span className="text-muted/50">·</span>
                            <span className="flex items-center gap-1">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                              </svg>
                              {getInteractionCount(work)}
                            </span>
                            <span className="text-muted/50">·</span>
                            <span className="flex items-center gap-1">
                              <CommentIcon />
                              {work.comments_count || 0}
                            </span>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              }

              // ========== JOURNALS VIEW (Original) ==========
              if (postViewMode === "journals") {
                // Group journals by date
                const journalsByDate: Record<string, typeof filteredPosts> = {};
                filteredPosts.forEach(post => {
                  const date = new Date(post.created_at);
                  const dateKey = date.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });
                  if (!journalsByDate[dateKey]) {
                    journalsByDate[dateKey] = [];
                  }
                  journalsByDate[dateKey].push(post);
                });

                return (
                  <div className="studio-journals-grid">
                    {Object.entries(journalsByDate).map(([dateKey, dayPosts]) => (
                      <div key={dateKey} className="journals-date-section">
                        <div className="journals-date-label">{dateKey}</div>
                        <div className="journals-entries">
                          {dayPosts.map((work) => {
                            const hasMedia = work.media && work.media.length > 0;
                            const plainContent = work.content
                              ? decodeHtmlEntities(work.content.replace(/<[^>]*>/g, '')).substring(0, 120)
                              : '';

                            // Get time from created_at
                            const entryTime = new Date(work.created_at).toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            });

                            return (
                              <article
                                key={work.id}
                                onClick={() => openPostModal(createPostForModal(work))}
                                className="journal-card"
                              >
                                {hasMedia && (
                                  <div className="journal-card-image">
                                    <img src={work.media[0].media_url} alt="" />
                                    {work.media.length > 1 && (
                                      <span className="journal-card-image-count">+{work.media.length - 1}</span>
                                    )}
                                  </div>
                                )}
                                <div className="journal-card-body">
                                  <span className="journal-card-time">{entryTime}</span>
                                  {work.title && (
                                    <h3 className="journal-card-title">{work.title}</h3>
                                  )}
                                  <p className="journal-card-excerpt">{plainContent}</p>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                );
              }

              // Communities View - Simple and creative grid
              if (postViewMode === "communities") {
                return (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredPosts.map((work) => {
                      const hasMedia = work.media && work.media.length > 0;
                      const plainContent = work.content
                        ? decodeHtmlEntities(work.content.replace(/<[^>]*>/g, '')).substring(0, 120)
                        : '';
                      const community = work.community;

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          className="group relative bg-surface rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border border-border-light"
                        >
                          {/* Image */}
                          {hasMedia && (
                            <div className="relative h-44 overflow-hidden">
                              <img
                                src={work.media[0].media_url}
                                alt=""
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                              />
                              {work.media.length > 1 && (
                                <span className="absolute top-2.5 right-2.5 bg-black/50 text-white text-xs px-2 py-0.5 rounded-full">
                                  +{work.media.length - 1}
                                </span>
                              )}
                            </div>
                          )}

                          {/* Content */}
                          <div className="p-4">
                            {/* Community Tag - Simple clickable pill */}
                            {community && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/community/${community.slug}`);
                                }}
                                className="inline-flex items-center gap-1.5 mb-3 px-2.5 py-1 rounded-full bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 hover:from-purple-primary/20 hover:to-pink-vivid/20 transition-colors"
                              >
                                {community.avatar_url ? (
                                  <img
                                    src={community.avatar_url}
                                    alt=""
                                    className="w-4 h-4 rounded-full object-cover"
                                  />
                                ) : (
                                  <span className="w-4 h-4 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                    </svg>
                                  </span>
                                )}
                                <span className="text-xs font-medium bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                                  {community.name}
                                </span>
                              </button>
                            )}

                            {work.title && (
                              <h4 className="font-display font-semibold text-ink text-[0.95rem] mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">
                                {work.title}
                              </h4>
                            )}

                            {plainContent && (
                              <p className="text-muted text-sm line-clamp-2 leading-relaxed">{plainContent}</p>
                            )}

                            {/* Footer */}
                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border-light">
                              <span className="text-xs text-muted">{getTimeAgo(work.created_at)}</span>
                              <div className="flex items-center gap-3 text-muted">
                                <span className="flex items-center gap-1 text-xs">
                                  <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" />
                                  </svg>
                                  {getInteractionCount(work)}
                                </span>
                                <span className="flex items-center gap-1 text-xs">
                                  <CommentIcon size="sm" />
                                  {work.comments_count || 0}
                                </span>
                              </div>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                );
              }

              // Fallback
              return null;
            })()}
          </div>
        )}

        {/* Takes Section */}
        {activeTab === "takes" && (
          <div className="pq-studio-section" role="tabpanel">
            {takesLoading ? (
              <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
            ) : userTakes.length === 0 ? (
              <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">No takes yet</p></div>
            ) : (
              <div className="takes-grid">
                {userTakes.map((take) => (
                  <TakePostCard key={take.id} take={take} variant="grid" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Relays Section */}
        {activeTab === "relays" && (
          <div className="pq-studio-section" role="tabpanel">
            {/* Relay Type Tabs */}
            <div className="pq-chip-scroll pq-studio-filters" role="group" aria-label="Kind of relay">
              <StudioSubTabButton
                label="Posts"
                active={relaySubTab === "posts"}
                onClick={() => setRelaySubTab("posts")}
              />
              <StudioSubTabButton
                label="Takes"
                active={relaySubTab === "takes"}
                onClick={() => setRelaySubTab("takes")}
              />
            </div>

            {/* Relayed Posts */}
            {relaySubTab === "posts" && (
              <>
                {relaysLoading ? (
                  <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
                ) : relays.length === 0 ? (
                  <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">No relayed posts yet</p></div>
                ) : (
                  <div className="studio-works-grid">
                    {relays.map((relay) => {
                      const postForModal = {
                        id: relay.id,
                        authorId: relay.author_id,
                        author: {
                          name: relay.original_author?.display_name || relay.original_author?.username || "Unknown",
                          handle: `@${relay.original_author?.username || "unknown"}`,
                          avatar: relay.original_author?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80",
                        },
                        type: relay.type as "poem" | "journal" | "thought" | "visual" | "audio" | "video",
                        typeLabel: relay.type.charAt(0).toUpperCase() + relay.type.slice(1),
                        timeAgo: getTimeAgo(relay.created_at),
                        createdAt: relay.created_at,
                        title: relay.title || undefined,
                        content: relay.content,
                        media: relay.media,
                        styling: relay.styling,
                        post_location: relay.post_location,
                        metadata: relay.metadata,
                        stats: {
                          admires: getInteractionCount(relay),
                          reactions: getInteractionCount(relay),
                          comments: relay.comments_count,
                          relays: relay.relays_count || 0,
                        },
                        isAdmired: relay.user_has_admired,
                        isSaved: relay.user_has_saved,
                        isRelayed: relay.user_has_relayed,
                      };

                      const hasMedia = relay.media && relay.media.length > 0;
                      const plainContent = relay.content
                        ? decodeHtmlEntities(relay.content.replace(/<[^>]*>/g, '')).substring(0, 200)
                        : '';

                      const typeLabels: Record<string, string> = {
                        poem: "Poetry",
                        journal: "Journal",
                        thought: "Thought",
                        essay: "Essay",
                        story: "Story",
                        letter: "Letter",
                        visual: "Visual",
                        quote: "Quote",
                        audio: "Audio",
                        video: "Video",
                      };

                      return (
                        <article
                          key={relay.id}
                          onClick={() => openPostModal(postForModal)}
                          className={`studio-relay-card ${hasMedia ? 'has-image' : ''}`}
                          data-type={relay.type}
                        >
                          {/* Relay Badge */}
                          <div className="studio-relay-badge">
                            {icons.relay}
                            <span>Relayed {getTimeAgo(relay.relayed_at)}</span>
                          </div>

                          {/* Content */}
                          <div className="studio-relay-content">
                            <span className="studio-relay-type">
                              {typeLabels[relay.type] || relay.type}
                            </span>

                            <h3 className="studio-relay-title">
                              {relay.title || "Untitled"}
                            </h3>

                            <p className="studio-relay-preview">
                              {plainContent}
                            </p>
                          </div>

                          {/* Media */}
                          {hasMedia && (
                            <div className="studio-relay-image-wrap">
                              <img
                                src={relay.media[0].media_url}
                                alt={relay.title || "Relayed work"}
                                className="studio-relay-image"
                              />
                            </div>
                          )}

                          {/* Footer */}
                          <div className="studio-relay-footer">
                            <div className="studio-relay-author">
                              <Image
                                src={relay.original_author?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                                alt=""
                                width={70}
                                height={70}
                                className="studio-relay-author-avatar"
                                sizes="24px"
                                quality={80}
                              />
                              <span className="studio-relay-author-name">
                                {relay.original_author?.display_name || relay.original_author?.username}
                              </span>
                            </div>
                            <div className="studio-relay-stats">
                              <span className="studio-relay-stat">
                                {icons.heart} {getInteractionCount(relay)}
                              </span>
                              <span className="studio-relay-stat">
                                {icons.comment} {relay.comments_count}
                              </span>
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </>
            )}

            {/* Relayed Takes */}
            {relaySubTab === "takes" && (
              <>
                {relayedTakesLoading ? (
                  <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
                ) : relayedTakes.length === 0 ? (
                  <div className="pq-feed-state pq-feed-state--card"><p className="pq-feed-state__title">No relayed takes yet</p></div>
                ) : (
                  <div className="takes-grid">
                    {relayedTakes.map((take) => (
                      <TakePostCard
                        key={take.id}
                        take={take}
                        variant="grid"
                        isRelayed
                        relayedBy={{
                          username: profile?.username || username,
                          display_name: profile?.display_name || null,
                        }}
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Store Section */}
        {activeTab === "store" && profile && (
          <StoreTab
            userId={profile.id}
            isOwnProfile={isOwnProfile}
          />
        )}

        {/* Commissions Section */}
        {activeTab === "commissions" && profile && showCommissionsTab && (
          <CommissionsTab
            userId={profile.id}
            isOwnProfile={isOwnProfile}
          />
        )}

        {/* Collections Section */}
        {activeTab === "collections" && (
          <div className="pq-studio-section" role="tabpanel">
            {collectionsLoading ? (
              <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
            ) : collections.length === 0 ? (
              <div className="pq-feed-state pq-feed-state--card">
                <p className="pq-feed-state__title">No collections yet</p>
                <p className="pq-feed-state__text">
                  {isOwnProfile
                    ? "Collections group your work. Pick one when you post, and it shows up here."
                    : `${profile?.display_name || profile?.username} hasn't put anything into a collection yet.`}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {collections.map((collection, index) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    isOwnProfile={isOwnProfile}
                    username={username}
                    index={index}
                    totalCount={collections.length}
                    onMoveUp={async () => {
                      if (index === 0) return;
                      const newOrder = [...collections];
                      [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
                      await reorderCollections(newOrder.map(c => c.id));
                      refetchCollections();
                    }}
                    onMoveDown={async () => {
                      if (index === collections.length - 1) return;
                      const newOrder = [...collections];
                      [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
                      await reorderCollections(newOrder.map(c => c.id));
                      refetchCollections();
                    }}
                    onToggleCollapse={async () => {
                      await toggleCollapse(collection.id, collection.is_collapsed);
                      refetchCollections();
                    }}
                    onDelete={async () => {
                      const { error } = await supabase.from("collections").delete().eq("id", collection.id);
                      if (!error) refetchCollections();
                    }}
                    onDeleteItem={async (itemId: string) => {
                      const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
                      if (!error) refetchCollections();
                    }}
                    router={router}
                  />
                ))}
              </div>
            )}
          </div>
        )}
          </>
        )}

      </PageFrame>

      {/* Followers Modal */}
      <FollowersModal
        isOpen={showFollowersModal}
        onClose={() => setShowFollowersModal(false)}
        userId={profile.id}
        type={followersModalTab}
        isOwnProfile={isOwnProfile}
      />

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={profileUrl}
        title={`${profile.display_name || profile.username}'s Profile`}
        description={profile.bio || `Check out ${profile.display_name || profile.username}'s creative work on PinkQuill`}
        type="profile"
        authorName={profile.display_name || profile.username}
      />

      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={`Block @${profile.username}?`}
        description="Their posts leave your feed and yours leave theirs. They can't follow or message you, and we don't tell them."
        confirmText="Block"
        isDanger
        loading={blockLoading}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportLoading}
        submitted={reportSuccess}
        title={`Report @${profile.username}`}
        placeholder="What's going on with this account?"
      />

      <Sheet
        isOpen={showCommunitiesModal && !!userCommunities && userCommunities.length > 0}
        onClose={() => setShowCommunitiesModal(false)}
        title="Communities"
        subtitle={`${profile.display_name || profile.username} is part of ${userCommunities?.length === 1 ? "one community" : `${userCommunities?.length ?? 0} communities`}.`}
        bodyClassName="pq-dialog__body--flush"
      >
        {(userCommunities || []).map((community) => {
          const role = community.user_role === "admin" ? "Admin" : community.user_role === "moderator" ? "Moderator" : null;
          const members = `${community.member_count || 0} ${community.member_count === 1 ? "member" : "members"}`;
          return (
            <Link key={community.id} href={`/community/${community.slug || community.id}`} className="pq-studio-community" onClick={() => setShowCommunitiesModal(false)}>
              <span className="pq-studio-community__mark" aria-hidden="true">
                {community.avatar_url ? <img src={community.avatar_url} alt="" /> : community.name?.charAt(0).toUpperCase()}
              </span>
              <span className="pq-studio-community__text">
                <span className="pq-studio-community__name">{community.name}</span>
                <span className="pq-studio-community__meta">{role ? `${members} · ${role}` : members}</span>
              </span>
            </Link>
          );
        })}
      </Sheet>
    </div>
  );
}
