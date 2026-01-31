"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useProfile, useFollow, useRelays, useBlock, useToggleReaction, useReactionCounts, useUserReaction, ReactionType, fetchCollaboratedPosts, FollowStatus, useCommunities, useCollections, useToggleCollectionCollapse, useDeleteCollection, useDeleteCollectionItem, useUpdateCollection, useUpdateCollectionItem } from "@/lib/hooks";

// Type for follows table real-time payload
interface FollowRealtimePayload {
  follower_id: string;
  following_id: string;
  status?: FollowStatus;
  created_at?: string;
}
import { useUserTakes, useRelayedTakes } from "@/lib/hooks/useTakes";
import { useTrackProfileView } from "@/lib/hooks/useTracking";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { useRouter } from "next/navigation";
import Image from "next/image";
import FollowersModal from "./FollowersModal";
import ShareModal from "@/components/ui/ShareModal";
import ReactionPicker from "@/components/feed/ReactionPicker";
import TakePostCard from "@/components/takes/TakePostCard";
import Loading from "@/components/ui/Loading";
import type { Collection } from "@/lib/types";
import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

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

// WorkCardFooter component with reaction picker per card
interface WorkCardFooterProps {
  postId: string;
  commentsCount: number;
  formattedDate: string;
  userId?: string;
}

function WorkCardFooter({ postId, commentsCount, formattedDate, userId }: WorkCardFooterProps) {
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(postId);
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(postId, userId);

  const handleReaction = async (reactionType: ReactionType) => {
    if (!userId) return;

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update
    await toggleReaction(postId, userId, reactionType, userReaction);
  };

  const handleRemoveReaction = async () => {
    if (!userId || !userReaction) return;
    setUserReaction(null);
    await removeReaction(postId, userId);
  };

  return (
    <div className="studio-work-footer" onClick={(e) => e.stopPropagation()}>
      <span className="studio-work-date">{formattedDate}</span>
      <div className="studio-work-stats">
        <ReactionPicker
          currentReaction={userReaction}
          reactionCounts={reactionCounts}
          onReact={handleReaction}
          onRemoveReaction={handleRemoveReaction}
          disabled={!userId}
        />
        <span className="studio-work-stat">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          {commentsCount}
        </span>
      </div>
    </div>
  );
}

// Social link type
interface SocialLink {
  platform: string;
  url: string;
}

// Parse social links from stored JSON or legacy string
function parseSocialLinks(website: string | null): SocialLink[] {
  if (!website) return [];
  try {
    const parsed = JSON.parse(website);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Legacy format: plain URL string - detect platform
    if (website.trim()) {
      const lower = website.toLowerCase();
      let platform = "website";
      if (lower.includes("twitter.com") || lower.includes("x.com")) platform = "twitter";
      else if (lower.includes("instagram.com")) platform = "instagram";
      else if (lower.includes("github.com")) platform = "github";
      else if (lower.includes("linkedin.com")) platform = "linkedin";
      else if (lower.includes("youtube.com") || lower.includes("youtu.be")) platform = "youtube";
      else if (lower.includes("tiktok.com")) platform = "tiktok";
      else if (lower.includes("threads.net")) platform = "threads";
      else if (lower.includes("facebook.com") || lower.includes("fb.com")) platform = "facebook";
      return [{ platform, url: website }];
    }
  }
  return [];
}

// Get URL for a social link
function getSocialUrl(link: SocialLink): string {
  const url = link.url.trim();
  // If already a full URL, return it
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  // Otherwise, construct URL based on platform
  const username = url.replace(/^@/, "");
  const platformUrls: Record<string, string> = {
    twitter: `https://twitter.com/${username}`,
    instagram: `https://instagram.com/${username}`,
    github: `https://github.com/${username}`,
    linkedin: `https://linkedin.com/in/${username}`,
    youtube: `https://youtube.com/@${username}`,
    tiktok: `https://tiktok.com/@${username}`,
    threads: `https://threads.net/@${username}`,
    facebook: `https://facebook.com/${username}`,
    behance: `https://behance.net/${username}`,
    dribbble: `https://dribbble.com/${username}`,
    spotify: `https://open.spotify.com/user/${username}`,
    soundcloud: `https://soundcloud.com/${username}`,
    medium: `https://medium.com/@${username}`,
    substack: `https://${username}.substack.com`,
    patreon: `https://patreon.com/${username}`,
    ko_fi: `https://ko-fi.com/${username}`,
  };
  return platformUrls[link.platform] || `https://${url}`;
}

// Social platform icons (using brand colors)
const socialIcons: Record<string, { icon: React.ReactNode; color: string }> = {
  twitter: {
    color: "#1DA1F2",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  instagram: {
    color: "#E4405F",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
      </svg>
    ),
  },
  github: {
    color: "#333",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
      </svg>
    ),
  },
  linkedin: {
    color: "#0A66C2",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
      </svg>
    ),
  },
  youtube: {
    color: "#FF0000",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
  tiktok: {
    color: "#000",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  threads: {
    color: "#000",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.333-3.022.812-.672 1.927-1.073 3.222-1.158 1.009-.066 1.955.024 2.822.268l.028-.988c-.49-.065-1.003-.098-1.528-.098-1.918 0-3.61.463-4.763 1.306-1.362 1-2.09 2.48-2.001 4.065.09 1.593.894 2.984 2.265 3.918 1.187.81 2.699 1.16 4.247 1.063.91-.05 2.338-.34 3.364-1.677.704-.92 1.163-2.2 1.296-3.823a9.05 9.05 0 011.308.627c1.03.557 1.794 1.26 2.336 2.143 1.06 1.73 1.089 4.72-1.193 6.96-1.908 1.875-4.245 2.735-7.512 2.76zm1.828-11.883c-.86-.081-1.65-.026-2.37.16l-.082 2.896c.614.14 1.312.195 2.065.143 1.113-.077 1.75-.527 2.059-.982.35-.522.368-1.162-.036-1.733-.33-.466-.915-.41-1.636-.484z" />
      </svg>
    ),
  },
  facebook: {
    color: "#1877F2",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
      </svg>
    ),
  },
  behance: {
    color: "#1769FF",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6.938 4.503c.702 0 1.34.06 1.92.188.577.13 1.07.33 1.485.61.41.28.733.65.96 1.12.225.47.34 1.05.34 1.73 0 .74-.17 1.36-.507 1.86-.338.5-.837.9-1.502 1.22.906.26 1.576.72 2.022 1.37.448.66.665 1.45.665 2.36 0 .75-.13 1.39-.41 1.93-.28.55-.67 1-1.16 1.35-.48.348-1.05.6-1.67.767-.61.165-1.252.254-1.91.254H0V4.51h6.938v-.007zM6.545 9.64c.56 0 1.01-.13 1.36-.397.35-.27.52-.678.52-1.224 0-.31-.06-.566-.17-.77-.11-.2-.26-.36-.45-.47-.188-.11-.4-.187-.66-.23-.25-.043-.52-.066-.81-.066H3.277v3.157h3.268zm.19 5.412c.306 0 .6-.033.876-.1.277-.066.517-.174.72-.32.206-.145.37-.343.49-.593.12-.25.177-.56.177-.93 0-.75-.222-1.296-.666-1.64-.445-.343-1.033-.52-1.767-.52H3.277v4.103h3.458zM14.5 14.03c.24.49.66.86 1.25 1.11.26.11.55.17.87.17.39 0 .74-.07 1.03-.21.28-.14.47-.29.56-.44.09-.15.15-.27.18-.36h2.36c-.16.76-.62 1.39-1.38 1.9-.76.5-1.61.75-2.55.75-.58 0-1.13-.09-1.65-.27-.52-.18-.97-.45-1.36-.8-.39-.36-.69-.81-.91-1.35-.22-.54-.33-1.17-.33-1.87 0-.68.11-1.3.33-1.85.22-.55.52-1.02.91-1.4.39-.38.85-.67 1.38-.88.52-.21 1.1-.32 1.71-.32.69 0 1.3.13 1.84.39.53.26.97.62 1.31 1.07.34.45.6.98.77 1.58.17.6.23 1.25.17 1.93h-6.02c.02.64.19 1.23.43 1.72zm2.97-4.1c-.48-.4-1.08-.6-1.79-.6-.45 0-.84.08-1.16.23-.32.16-.58.36-.78.6-.2.24-.35.51-.45.79-.1.28-.16.55-.19.79h4.96c-.08-.75-.32-1.4-.6-1.8zM13.338 6.01h5.316V7.4h-5.316z" />
      </svg>
    ),
  },
  dribbble: {
    color: "#EA4C89",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 24C5.385 24 0 18.615 0 12S5.385 0 12 0s12 5.385 12 12-5.385 12-12 12zm10.12-10.358c-.35-.11-3.17-.953-6.384-.438 1.34 3.684 1.887 6.684 1.992 7.308 2.3-1.555 3.936-4.02 4.395-6.87zm-6.115 7.808c-.153-.9-.75-4.032-2.19-7.77l-.066.02c-5.79 2.015-7.86 6.025-8.04 6.4 1.73 1.358 3.92 2.166 6.29 2.166 1.42 0 2.77-.29 4-.814zm-11.62-2.58c.232-.4 3.045-5.055 8.332-6.765.135-.045.27-.084.405-.12-.26-.585-.54-1.167-.832-1.74C7.17 11.775 2.206 11.71 1.756 11.7l-.004.312c0 2.633.998 5.037 2.634 6.855zm-2.42-8.955c.46.008 4.683.026 9.477-1.248-1.698-3.018-3.53-5.558-3.8-5.928-2.868 1.35-5.01 3.99-5.676 7.17zM9.6 2.052c.282.38 2.145 2.914 3.822 6 3.645-1.365 5.19-3.44 5.373-3.702-1.81-1.61-4.19-2.586-6.795-2.586-.825 0-1.63.1-2.4.285zm10.335 3.483c-.218.29-1.935 2.493-5.724 4.04.24.49.47.985.68 1.486.08.18.15.36.22.53 3.41-.43 6.8.26 7.14.33-.02-2.42-.88-4.64-2.31-6.38z" />
      </svg>
    ),
  },
  spotify: {
    color: "#1DB954",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
      </svg>
    ),
  },
  soundcloud: {
    color: "#FF5500",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M1.175 12.225c-.051 0-.094.046-.101.1l-.233 2.154.233 2.105c.007.058.05.098.101.098.05 0 .09-.04.099-.098l.255-2.105-.27-2.154c-.009-.06-.05-.1-.1-.1m-.899.828c-.06 0-.091.037-.104.094L0 14.479l.165 1.308c.014.057.045.094.09.094.051 0 .089-.037.099-.094l.21-1.308-.21-1.334c-.01-.057-.045-.09-.09-.09m1.83-1.229c-.061 0-.12.045-.12.104l-.21 2.563.225 2.458c0 .06.045.12.12.12.06 0 .105-.061.12-.12l.24-2.458-.24-2.563c-.015-.06-.06-.104-.12-.104m.945-.089c-.075 0-.135.06-.15.135l-.193 2.64.21 2.544c.016.077.075.138.149.138.075 0 .135-.061.15-.138l.24-2.544-.24-2.64c-.015-.074-.074-.135-.15-.135m1.064.094c-.09 0-.164.075-.164.165l-.196 2.382.211 2.484c0 .09.075.15.164.15.091 0 .166-.061.18-.15l.24-2.484-.24-2.382c-.015-.09-.089-.165-.18-.165m1.05-.207c-.104 0-.194.089-.194.194l-.18 2.595.195 2.453c0 .12.09.194.194.194.105 0 .18-.074.195-.195l.21-2.453-.21-2.595c-.015-.105-.09-.194-.195-.194m1.215-.39c-.12 0-.21.09-.225.209l-.165 2.79.18 2.392c.016.12.105.21.225.21.12 0 .21-.09.225-.21l.195-2.392-.195-2.79c-.016-.12-.105-.21-.225-.21m1.186.39c-.135 0-.24.105-.24.24l-.15 2.399.15 2.334c0 .135.104.24.24.24.135 0 .24-.105.24-.24l.166-2.334-.166-2.4c0-.135-.105-.24-.24-.24m1.125-1.065c-.15 0-.255.12-.255.27l-.166 3.466.166 2.303c0 .15.105.27.255.27.15 0 .255-.12.27-.27l.18-2.303-.18-3.466c-.015-.15-.12-.27-.27-.27m1.185-.256c-.165 0-.285.12-.285.284l-.165 3.721.165 2.24c0 .166.12.286.285.286.165 0 .285-.12.3-.286l.18-2.24-.18-3.72c-.015-.166-.135-.286-.3-.286m1.185-.21c-.18 0-.315.135-.315.315l-.15 3.915.15 2.175c0 .181.135.316.315.316.18 0 .315-.135.33-.316l.165-2.175-.166-3.915c-.015-.18-.15-.315-.33-.315m1.245-.15c-.195 0-.345.149-.345.344l-.135 4.051.135 2.1c0 .195.15.344.345.344.195 0 .345-.149.36-.345l.15-2.1-.15-4.05c-.015-.195-.165-.344-.36-.344m1.245-.045c-.21 0-.375.165-.375.375l-.12 4.11.12 2.04c.015.21.165.375.375.375.21 0 .375-.165.39-.375l.135-2.04-.135-4.11c-.015-.21-.18-.375-.39-.375m1.275.015c-.225 0-.405.18-.405.405l-.12 4.095.12 1.98c.015.225.18.405.405.405.225 0 .405-.18.42-.405l.12-1.98-.12-4.095c-.015-.225-.195-.405-.42-.405m1.365.27c-.24 0-.435.195-.435.434l-.09 3.81.09 1.921c0 .24.195.435.435.435.24 0 .435-.195.45-.435l.105-1.92-.105-3.81c-.015-.24-.21-.435-.45-.435m1.274.405c-.24 0-.435.195-.435.42l-.09 3.404.09 1.846c0 .255.195.449.435.449.255 0 .45-.194.465-.449l.105-1.846-.105-3.405c-.015-.225-.21-.42-.465-.42m1.335.315c-.255 0-.465.21-.465.465l-.075 3.09.075 1.77c0 .256.21.466.465.466.256 0 .465-.21.48-.466l.09-1.77-.09-3.09c-.015-.255-.224-.465-.48-.465m4.335 2.415c-.735 0-1.395.315-1.875.809a5.01 5.01 0 00-4.905-3.99c-.54 0-1.065.105-1.53.285-.18.075-.225.15-.225.3v7.875c0 .15.12.285.27.3h8.265c1.38 0 2.49-1.11 2.49-2.49 0-1.38-1.11-2.49-2.49-2.49" />
      </svg>
    ),
  },
  medium: {
    color: "#000",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M13.54 12a6.8 6.8 0 01-6.77 6.82A6.8 6.8 0 010 12a6.8 6.8 0 016.77-6.82A6.8 6.8 0 0113.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
      </svg>
    ),
  },
  substack: {
    color: "#FF6719",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
      </svg>
    ),
  },
  patreon: {
    color: "#FF424D",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M15.386.524c-4.764 0-8.64 3.876-8.64 8.64 0 4.75 3.876 8.613 8.64 8.613 4.75 0 8.614-3.864 8.614-8.613C24 4.4 20.136.524 15.386.524M.003 23.537h4.22V.524H.003" />
      </svg>
    ),
  },
  ko_fi: {
    color: "#29ABE0",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.881 8.948c-.773-4.085-4.859-4.593-4.859-4.593H.723c-.604 0-.679.798-.679.798s-.082 7.324-.022 11.822c.164 2.424 2.586 2.672 2.586 2.672s8.267-.023 11.966-.049c2.438-.426 2.683-2.566 2.658-3.734 4.352.24 7.422-2.831 6.649-6.916zm-11.062 3.511c-1.246 1.453-4.011 3.976-4.011 3.976s-.121.119-.31.023c-.076-.057-.108-.09-.108-.09-.443-.441-3.368-3.049-4.034-3.954-.709-.965-1.041-2.7-.091-3.71.951-1.01 3.005-1.086 4.363.407 0 0 1.565-1.782 3.468-.963 1.904.82 1.832 3.011.723 4.311zm6.173.478c-.928.116-1.682.028-1.682.028V7.284h1.77s1.971.551 1.971 2.638c0 1.913-.985 2.667-2.059 3.015z" />
      </svg>
    ),
  },
  website: {
    color: "#8e44ad",
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
};

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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
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
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
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
}

function CollectionCard({
  collection,
  isOwnProfile,
  username,
  onToggleCollapse,
  onDelete,
  onDeleteItem,
  router
}: CollectionCardProps) {
  const [showMenu, setShowMenu] = useState(false);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showMenu]);

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
      try {
        return <span className="text-3xl">{String.fromCodePoint(parseInt(collection.icon_emoji, 16))}</span>;
      } catch {
        return <span className="text-3xl">{collection.icon_emoji}</span>;
      }
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
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/60 to-purple-primary/5" />
        <div className="absolute inset-0 bg-gradient-to-tr from-purple-primary/[0.03] via-transparent to-pink-vivid/[0.05]" />
        <div className="absolute inset-0 backdrop-blur-xl" />

        {/* Shimmer effect on hover */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

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
            <div className="shrink-0 flex items-center gap-2">
              {/* Collapse toggle */}
              <button
                onClick={onToggleCollapse}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.05] transition-all"
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
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.05] transition-all"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                    </svg>
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-xl border border-black/[0.08] overflow-hidden z-20 animate-scaleIn origin-top-right">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          router.push(`/studio/${username}/collections/${collection.slug}/edit`);
                        }}
                        className="w-full px-4 py-2.5 text-left font-ui text-sm text-ink hover:bg-purple-primary/5 flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit Collection
                      </button>
                      <div className="h-px bg-black/[0.06]" />
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onDelete();
                        }}
                        className="w-full px-4 py-2.5 text-left font-ui text-sm text-red-500 hover:bg-red-50 flex items-center gap-2 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete Collection
                      </button>
                    </div>
                  )}
                </div>
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
                          onDeleteItem(item.id);
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
        <div className="absolute inset-0 rounded-3xl border border-white/60 pointer-events-none" />

        {/* Subtle inner shadow */}
        <div className="absolute inset-0 rounded-3xl shadow-inner pointer-events-none" style={{ boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.5)' }} />
      </div>

      {/* Decorative gradient glow on hover */}
      <div className="absolute -inset-1 bg-gradient-to-r from-purple-primary/20 to-pink-vivid/20 rounded-[28px] opacity-0 group-hover:opacity-50 blur-xl transition-opacity duration-500 -z-10" />
    </div>
  );
}

function formatCount(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}m`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
  return num.toString();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

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

interface StudioProfileProps {
  username: string;
}

export default function StudioProfile({ username }: StudioProfileProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { openPostModal } = useModal();
  const { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch: refetchProfile } = useProfile(username, user?.id);
  const { checkFollowStatus, follow, unfollow } = useFollow();
  const { checkIsBlocked, blockUser, unblockUser } = useBlock();
  const { relays, loading: relaysLoading } = useRelays(username);
  const { takes: userTakes, loading: takesLoading } = useUserTakes(username, user?.id);
  const { takes: relayedTakes, loading: relayedTakesLoading } = useRelayedTakes(username, user?.id);
  const { communities: userCommunities, loading: communitiesLoading } = useCommunities(profile?.id, 'joined');
  const { collections, loading: collectionsLoading, refetch: refetchCollections } = useCollections(profile?.id);
  const { toggleCollapse } = useToggleCollectionCollapse();
  const { revealedCards, observeCard } = useScrollReveal();
  const [pageLoaded, setPageLoaded] = useState(false);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"posts" | "takes" | "relays" | "store" | "collections">("posts");
  const [relaySubTab, setRelaySubTab] = useState<"posts" | "takes">("posts");
  const [activeFilter, setActiveFilter] = useState("All");
  const [followStatus, setFollowStatus] = useState<FollowStatus>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [collaboratedPosts, setCollaboratedPosts] = useState<any[]>([]);
  const [collabPostsLoading, setCollabPostsLoading] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Trigger page load animation
  useEffect(() => {
    if (!loading && profile) {
      const timer = setTimeout(() => setPageLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, profile]);

  const profileUrl = typeof window !== 'undefined' ? `${window.location.origin}/studio/${username}` : `/studio/${username}`;

  // Track profile views (only for other people's profiles)
  const isOwnProfile = user?.id === profile?.id;
  useTrackProfileView(isOwnProfile ? undefined : profile?.id, "direct");

  const filters = ["All", "Poetry", "Journals", "Visual"];

  useEffect(() => {
    const checkFollow = async () => {
      if (user && profile && !isOwnProfile) {
        const status = await checkFollowStatus(user.id, profile.id);
        setFollowStatus(status);
      }
    };
    checkFollow();
  }, [user, profile, isOwnProfile]);

  // Real-time subscription for follow status changes (e.g., when request is accepted)
  useEffect(() => {
    if (!user || !profile || isOwnProfile) return;

    const channel = supabase
      .channel(`follow-status-${user.id}-${profile.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${user.id}`,
        },
        (payload) => {
          // Check if this update is for the profile we're viewing
          const newData = payload.new as FollowRealtimePayload | null;
          if (newData && newData.following_id === profile.id) {
            const newStatus = newData.status ?? null;
            setFollowStatus(newStatus);

            // If follow was just accepted, refetch the full profile to get all the data
            if (newStatus === 'accepted') {
              refetchProfile();
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'follows',
          filter: `follower_id=eq.${user.id}`,
        },
        (payload) => {
          // Check if the deleted follow was for this profile
          const oldData = payload.old as FollowRealtimePayload | null;
          if (oldData && oldData.following_id === profile.id) {
            setFollowStatus(null);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile, isOwnProfile, refetchProfile]);

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
        setCollabPostsLoading(true);
        try {
          const collabPosts = await fetchCollaboratedPosts(profile.id);
          setCollaboratedPosts(collabPosts);
        } catch (error) {
          console.error("Error fetching collaborated posts:", error);
        }
        setCollabPostsLoading(false);
      }
    };
    loadCollaboratedPosts();
  }, [profile?.id]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showMenu]);

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

  const handleReport = async () => {
    if (!user || !profile || !reportReason.trim()) return;

    setReportLoading(true);
    try {
      await supabase.from("reports").insert({
        reporter_id: user.id,
        reported_user_id: profile.id,
        reason: reportReason.trim(),
        type: "user",
      });
      setReportSuccess(true);
      setReportReason("");
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
  const isPendingRequest = followStatus === 'pending';

  // Refetch profile when follow status changes to 'accepted' (to get full profile data)
  useEffect(() => {
    if (isFollowing && isPrivateAccount) {
      // User just got accepted as a follower of a private account - refetch to get full data
      refetchProfile();
    }
  }, [isFollowing, isPrivateAccount, refetchProfile]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] flex items-center justify-center">
        <Loading text="Loading profile" size="large" />
      </div>
    );
  }

  if (error || !profile || isBlockedByUser) {
    return (
      <div className="min-h-screen bg-[#f8f7fc] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl text-ink mb-4">User not found</h1>
          <p className="font-body text-muted">This user doesn't exist or is unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8f7fc]">
      {/* Cover Section - Soft Watercolor Aesthetic */}
      <div className="relative h-[200px] md:h-[320px] overflow-hidden">
        {/* Base watercolor background */}
        <div className="studio-cover-watercolor" />

        {/* Floating petals */}
        <div className="studio-cover-decorations">
          <div className="studio-floating-petal petal-1" style={{"--rotation": "-25deg"} as React.CSSProperties} />
          <div className="studio-floating-petal petal-2" style={{"--rotation": "15deg"} as React.CSSProperties} />
          <div className="studio-floating-petal petal-3" style={{"--rotation": "-40deg"} as React.CSSProperties} />
        </div>

        {/* Ink splash accents */}
        <div className="studio-ink-splash splash-1" />
        <div className="studio-ink-splash splash-2" />

        {profile.cover_url && (
          <img
            src={profile.cover_url}
            alt="Cover"
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-multiply"
          />
        )}

        {/* Paper texture */}
        <div className="studio-cover-paper" />

        {/* Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-t from-[#f8f7fc] to-transparent" />
      </div>

      {/* Profile Section */}
      <div className="relative max-w-[1100px] mx-auto px-4 md:px-8 -mt-[60px] md:-mt-[100px] pb-12">
        {/* Profile Header */}
        <div className={`flex flex-col md:flex-row md:items-end gap-4 md:gap-8 mb-6 md:mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-1' : ''}`}>
          {/* Avatar with Glow */}
          <div className="studio-avatar-wrapper flex-shrink-0 mx-auto md:mx-0">
            <div className="studio-avatar-glow" />
            <img
              src={profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=400&q=80"}
              alt={profile.display_name || profile.username}
              className="studio-avatar w-24 h-24 md:w-40 md:h-40 rounded-full object-cover border-[4px] md:border-[5px] border-[#f8f7fc] shadow-xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 pb-2 md:pb-4 text-center md:text-left">
            {/* Name */}
            <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-1 md:mb-2">
              <h1 className="font-display text-[1.6rem] md:text-[2.6rem] tracking-tight leading-none text-ink font-medium">
                {profile.display_name || profile.username}
              </h1>
              {profile.is_verified && (
                <span className="w-5 h-5 md:w-7 md:h-7 bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm rounded-full flex items-center justify-center text-white shadow-lg shadow-pink-vivid/25">
                  {icons.verified}
                </span>
              )}
            </div>

            {/* Username */}
            <p className="font-ui text-[0.8rem] md:text-[0.85rem] text-muted/70 tracking-wider mb-2 md:mb-3">@{profile.username}</p>

            {/* Tagline */}
            {profile.tagline && (
              <p className="font-body text-[0.9rem] md:text-[1.05rem] italic text-ink/40">
                {profile.tagline}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-3 pb-2 md:pb-4">
            {!isOwnProfile && user && (
              <>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`px-5 py-2 md:px-8 md:py-3 rounded-full font-ui text-[0.85rem] md:text-[0.95rem] font-medium transition-all ${
                    isFollowing
                      ? "bg-white border-2 border-purple-primary text-purple-primary hover:bg-purple-primary/5"
                      : isPendingRequest
                        ? "bg-white border-2 border-muted text-muted hover:border-red-400 hover:text-red-400"
                        : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/30 hover:-translate-y-0.5 hover:shadow-xl"
                  }`}
                >
                  {followLoading
                    ? "..."
                    : isFollowing
                      ? "Following"
                      : isPendingRequest
                        ? "Requested"
                        : profile?.is_private
                          ? "Request to Follow"
                          : "Follow"
                  }
                </button>
                <button
                  onClick={async () => {
                    if (!user || !profile || messageLoading) return;
                    setMessageLoading(true);

                    try {
                      // Check for existing conversation
                      const { data: existingParticipations } = await supabase
                        .from("conversation_participants")
                        .select("conversation_id")
                        .eq("user_id", user.id);

                      if (existingParticipations) {
                        for (const participation of existingParticipations) {
                          const { data: otherParticipant } = await supabase
                            .from("conversation_participants")
                            .select("user_id")
                            .eq("conversation_id", participation.conversation_id)
                            .eq("user_id", profile.id)
                            .single();

                          if (otherParticipant) {
                            router.push(`/messages?conversation=${participation.conversation_id}`);
                            return;
                          }
                        }
                      }

                      // Create new conversation
                      const { data: newConversation } = await supabase
                        .from("conversations")
                        .insert({})
                        .select()
                        .single();

                      if (newConversation) {
                        await supabase.from("conversation_participants").insert([
                          { conversation_id: newConversation.id, user_id: user.id },
                          { conversation_id: newConversation.id, user_id: profile.id },
                        ]);
                        router.push(`/messages?conversation=${newConversation.id}`);
                      }
                    } catch (err) {
                      console.error("Failed to start conversation:", err);
                      setMessageLoading(false);
                    }
                  }}
                  disabled={messageLoading}
                  className="px-4 py-2 md:px-6 md:py-3 rounded-full border-2 border-black/10 bg-white font-ui text-[0.85rem] md:text-[0.95rem] font-medium text-ink flex items-center gap-2 hover:border-purple-primary hover:text-purple-primary transition-all disabled:opacity-50"
                >
                  {icons.message}
                  <span className="hidden md:inline">{messageLoading ? "..." : "Message"}</span>
                </button>
              </>
            )}

            {isOwnProfile && (
              <a href="/settings" className="px-5 py-2 md:px-8 md:py-3 rounded-full border-2 border-black/10 bg-white font-ui text-[0.85rem] md:text-[0.95rem] font-medium text-ink hover:border-purple-primary hover:text-purple-primary transition-all">
                Edit Profile
              </a>
            )}

            {/* 3-dot Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-black/10 bg-white flex items-center justify-center text-ink hover:border-purple-primary hover:text-purple-primary transition-all"
              >
                {icons.ellipsis}
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-50 animate-fadeIn">
                  <button
                    onClick={() => {
                      setShowMenu(false);
                      setShowShareModal(true);
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
                  >
                    {icons.share}
                    Share Profile
                  </button>

                  {!isOwnProfile && user && (
                    <>
                      <div className="h-px bg-black/[0.06] mx-3" />
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          if (isBlocked) {
                            handleBlock();
                          } else {
                            setShowBlockConfirm(true);
                          }
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                        </svg>
                        {isBlocked ? "Unblock" : "Block"} @{profile?.username}
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowReportModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Report @{profile?.username}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Private Account Notice */}
        {isPrivateAccount && !isOwnProfile && !isFollowing && (
          <div className={`mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-2' : ''}`}>
            <div className="relative rounded-3xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/80 p-10 border border-purple-200/50 shadow-[0_8px_40px_-12px_rgba(142,68,173,0.15)] text-center">
              {/* Lock Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <h3 className="font-display text-xl text-ink mb-3">This Account is Private</h3>
              <p className="font-body text-muted text-[0.95rem] max-w-md mx-auto mb-6">
                {isPendingRequest
                  ? "Your follow request is pending. Once approved, you'll be able to see their posts and profile."
                  : "Follow this account to see their posts, takes, and profile information."
                }
              </p>

              {/* Minimal Stats */}
              <div className="flex items-center justify-center gap-8 pt-6 border-t border-purple-primary/10">
                <div className="text-center">
                  <span className="font-display text-xl text-ink block">{formatCount(profile.followers_count)}</span>
                  <span className="font-ui text-xs text-muted uppercase tracking-wider">Followers</span>
                </div>
                <div className="text-center">
                  <span className="font-display text-xl text-ink block">{formatCount(profile.following_count)}</span>
                  <span className="font-ui text-xs text-muted uppercase tracking-wider">Following</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats - Enhanced (only show for public accounts or if following) */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
        <div className={`studio-stats-enhanced mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-2' : ''}`}>
          <div className="studio-stat-item">
            <span className="studio-stat-value">{profile.works_count}</span>
            <span className="studio-stat-label">Posts</span>
          </div>
          <div
            className="studio-stat-item"
            onClick={() => {
              setFollowersModalTab("followers");
              setShowFollowersModal(true);
            }}
          >
            <span className="studio-stat-value">{formatCount(profile.followers_count)}</span>
            <span className="studio-stat-label">Followers</span>
          </div>
          <div
            className="studio-stat-item"
            onClick={() => {
              setFollowersModalTab("following");
              setShowFollowersModal(true);
            }}
          >
            <span className="studio-stat-value">{formatCount(profile.following_count)}</span>
            <span className="studio-stat-label">Following</span>
          </div>
          <div className="studio-stat-item">
            <span className="studio-stat-value">{formatCount(profile.admires_count)}</span>
            <span className="studio-stat-label">Admires</span>
          </div>
        </div>
        )}

        {/* About the Artist — Refined Design (only show for public accounts or if following) */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (profile.bio || profile.role || profile.location || profile.education || profile.languages) && (
          <div className={`relative mb-8 md:mb-12 studio-section-animated ${pageLoaded ? 'loaded delay-3' : ''}`}>

            {/* The Box */}
            <div className="relative rounded-2xl md:rounded-3xl bg-gradient-to-br from-rose-50/90 via-white to-pink-50/80 p-5 md:p-8 lg:p-10 border border-pink-200/50 shadow-[0_8px_40px_-12px_rgba(255,0,127,0.15)]">

              {/* Subtle top accent line */}
              <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-pink-vivid/30 to-transparent" />

              {/* Header */}
              <div className="mb-4 md:mb-8">
                <h3 className="font-display text-base md:text-lg text-ink/80 tracking-wide font-medium">About the Artist</h3>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="font-body text-[0.95rem] md:text-[1.12rem] leading-[1.8] md:leading-[1.95] text-ink/75 mb-6 md:mb-8 max-w-2xl">
                  {profile.bio}
                </p>
              )}

              {/* Details with subtle separators */}
              <div className="flex flex-wrap items-center gap-y-2 md:gap-y-3 text-[0.82rem] md:text-[0.88rem] text-ink/60 mb-6 md:mb-8">
                {profile.role && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-pink-vivid/60">{icons.briefcase}</span>
                      <span className="font-body">{profile.role}</span>
                    </div>
                    {(profile.location || profile.education || profile.languages) && (
                      <span className="text-pink-vivid/20 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.location && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-pink-vivid/60">{icons.location}</span>
                      <span className="font-body">{profile.location}</span>
                    </div>
                    {(profile.education || profile.languages) && (
                      <span className="text-pink-vivid/20 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.education && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-pink-vivid/60">{icons.education}</span>
                      <span className="font-body">{profile.education}</span>
                    </div>
                    {profile.languages && (
                      <span className="text-pink-vivid/20 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.languages && (
                  <div className="flex items-center gap-2">
                    <span className="text-pink-vivid/60">{icons.languages}</span>
                    <span className="font-body">{profile.languages}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-pink-vivid/10">
                {/* Social Links */}
                {profile.website && parseSocialLinks(profile.website).length > 0 ? (
                  <div className="flex items-center gap-1">
                    {parseSocialLinks(profile.website).map((link, index) => {
                      const platformIcon = socialIcons[link.platform] || socialIcons.website;
                      return (
                        <a
                          key={index}
                          href={getSocialUrl(link)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="group flex items-center justify-center w-9 h-9 rounded-xl hover:bg-pink-vivid/10 transition-all duration-300"
                          title={link.url}
                        >
                          <span
                            className="text-sm opacity-60 group-hover:opacity-100 transition-all duration-300 group-hover:scale-110"
                            style={{ color: platformIcon.color }}
                          >
                            {platformIcon.icon}
                          </span>
                        </a>
                      );
                    })}
                  </div>
                ) : <div />}

                {/* Communities - stacked circle avatars */}
                {userCommunities && userCommunities.length > 0 && (
                  <button
                    onClick={() => setShowCommunitiesModal(true)}
                    className="group flex items-center gap-1 py-1.5 rounded-full hover:bg-pink-vivid/[0.04] transition-all duration-300 px-1"
                  >
                    {/* Stacked Community Avatars */}
                    <div className="flex items-center">
                      {userCommunities.slice(0, userCommunities.length > 4 ? 3 : 4).map((community, index) => (
                        <div
                          key={community.id}
                          className="relative w-7 h-7 rounded-full border-2 border-white overflow-hidden shadow-sm transition-all duration-300 group-hover:shadow-md"
                          style={{
                            marginLeft: index === 0 ? 0 : '-8px',
                            zIndex: 10 - index,
                          }}
                        >
                          {community.avatar_url ? (
                            <img
                              src={community.avatar_url}
                              alt={community.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full bg-gradient-to-br from-purple-primary/40 to-pink-vivid/40 flex items-center justify-center">
                              <span className="text-[9px] font-ui text-white font-semibold">
                                {community.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* +X more indicator */}
                      {userCommunities.length > 4 && (
                        <div
                          className="relative w-7 h-7 rounded-full border-2 border-white overflow-hidden shadow-sm bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center transition-all duration-300 group-hover:shadow-md"
                          style={{ marginLeft: '-8px', zIndex: 6 }}
                        >
                          <span className="text-[9px] font-ui text-white font-bold">
                            +{userCommunities.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                )}

                {/* Joined */}
                <div className="flex items-center gap-2 text-ink/30">
                  <span className="text-pink-vivid/40">{icons.calendar}</span>
                  <span className="font-ui text-xs tracking-wider uppercase">Since {formatDate(profile.created_at)}</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tabs and Content - Only show for public accounts or if following */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
          <>
        {/* Tabs - Enhanced */}
        <div className={`studio-tabs-container flex mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-4' : ''}`}>
          <button
            onClick={() => setActiveTab("posts")}
            className={`studio-tab-btn ${activeTab === "posts" ? "active" : ""}`}
          >
            {icons.feather} Posts
          </button>
          <button
            onClick={() => setActiveTab("takes")}
            className={`studio-tab-btn ${activeTab === "takes" ? "active" : ""}`}
          >
            {icons.take} Takes
          </button>
          <button
            onClick={() => setActiveTab("relays")}
            className={`studio-tab-btn ${activeTab === "relays" ? "active" : ""}`}
          >
            {icons.relay} Relays
          </button>
          <button
            onClick={() => setActiveTab("store")}
            className={`studio-tab-btn ${activeTab === "store" ? "active" : ""}`}
          >
            {icons.store} Store
          </button>
          <button
            onClick={() => setActiveTab("collections")}
            className={`studio-tab-btn ${activeTab === "collections" ? "active" : ""}`}
          >
            {icons.collection} Collections
          </button>
        </div>

        {/* Posts Section */}
        {activeTab === "posts" && (
          <div className={`studio-works-section studio-section-animated ${pageLoaded ? 'loaded delay-5' : ''}`}>
            <div className="studio-works-header">
              <h2 className="studio-works-title">Posts</h2>
              <div className="studio-filters">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setActiveFilter(filter)}
                    className={`studio-filter-btn ${activeFilter === filter ? "active" : ""}`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
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

              // Filter posts based on activeFilter
              const filterTypeMap: Record<string, string> = {
                "Poetry": "poem",
                "Journals": "journal",
                "Visual": "visual",
              };

              const filteredPosts = activeFilter === "All"
                ? allPosts
                : allPosts.filter(p => p.type === filterTypeMap[activeFilter]);

              if (filteredPosts.length === 0) {
                return (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">
                      {activeFilter === "Journals" ? (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                        </svg>
                      ) : (
                        <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                        </svg>
                      )}
                    </div>
                    <p className="studio-works-empty-text">
                      {activeFilter === "All" ? "No posts yet..." : `No ${activeFilter.toLowerCase()} yet...`}
                    </p>
                  </div>
                );
              }

              // Special view for Journals - minimalist grouped by day
              if (activeFilter === "Journals") {
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
                            const isCollab = work.isCollaboration || collaboratedPostIds.has(work.id);
                            const workAuthor = isCollab && work.author ? work.author : profile;
                            const postForModal = {
                              id: work.id,
                              authorId: workAuthor.id || profile.id,
                              author: {
                                name: workAuthor.display_name || workAuthor.username || profile.display_name || profile.username,
                                handle: `@${workAuthor.username || profile.username}`,
                                avatar: workAuthor.avatar_url || profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80",
                              },
                              type: work.type as "poem" | "journal" | "thought" | "visual" | "audio" | "video",
                              typeLabel: "Journal",
                              timeAgo: getTimeAgo(work.created_at),
                              createdAt: work.created_at,
                              title: work.title || undefined,
                              content: work.content,
                              media: work.media,
                              styling: work.styling,
                              post_location: work.post_location,
                              metadata: work.metadata,
                              stats: {
                                admires: work.admires_count,
                                comments: work.comments_count,
                                relays: work.relays_count || 0,
                              },
                              isAdmired: work.user_has_admired,
                              isSaved: work.user_has_saved,
                              isRelayed: work.user_has_relayed,
                            };

                            const hasMedia = work.media && work.media.length > 0;
                            const plainContent = work.content
                              ? work.content.replace(/<[^>]*>/g, '').substring(0, 120)
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
                                onClick={() => openPostModal(postForModal)}
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

              return (
                <div className="studio-works-grid">
                  {filteredPosts.map((work) => {
                    const isCollab = work.isCollaboration || collaboratedPostIds.has(work.id);
                    const workAuthor = isCollab && work.author ? work.author : profile;
                    const postForModal = {
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
                      admires: work.admires_count,
                      comments: work.comments_count,
                      relays: work.relays_count || 0,
                    },
                    isAdmired: work.user_has_admired,
                    isSaved: work.user_has_saved,
                    isRelayed: work.user_has_relayed,
                  };

                  const hasMedia = work.media && work.media.length > 0;
                  const hasMultipleImages = work.media && work.media.length > 1;

                  // Strip HTML for preview
                  const plainContent = work.content
                    ? work.content.replace(/<[^>]*>/g, '').substring(0, 200)
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

                  // Format date
                  const formattedDate = new Date(work.created_at).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <article
                      key={work.id}
                      ref={observeCard}
                      data-post-id={work.id}
                      onClick={() => openPostModal(postForModal)}
                      className={`studio-work-card ${hasMedia ? 'has-image' : ''} ${revealedCards.has(work.id) ? 'revealed' : ''} ${isCollab ? 'is-collaboration' : ''}`}
                      data-type={work.type}
                    >
                      {/* Collaboration Badge */}
                      {isCollab && (
                        <div className="studio-collab-badge">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          <span>Collab</span>
                        </div>
                      )}

                      {/* Content - Top (type → title → text hierarchy) */}
                      <div className="studio-work-content">
                        <span className="studio-work-type-label">
                          {typeLabels[work.type] || work.type}
                        </span>

                        <h3 className="studio-work-title-text">
                          {work.title || "Untitled"}
                        </h3>

                        <div className="studio-work-preview">
                          <p className="studio-work-preview-text">
                            {plainContent}
                          </p>
                        </div>
                      </div>

                      {/* Media - Bottom */}
                      {hasMedia && (
                        <div className="studio-work-image-wrap">
                          <img
                            src={work.media[0].media_url}
                            alt={work.title || "Visual work"}
                            className="studio-work-image"
                          />
                          {hasMultipleImages && (
                            <div className="studio-work-multi-indicator">
                              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                              {work.media.length}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Footer with Reaction Picker */}
                      <WorkCardFooter
                        postId={work.id}
                        commentsCount={work.comments_count}
                        formattedDate={formattedDate}
                        userId={user?.id}
                      />
                    </article>
                  );
                })}
              </div>
              );
            })()}
          </div>
        )}

        {/* Takes Section */}
        {activeTab === "takes" && (
          <div className={`studio-works-section studio-section-animated ${pageLoaded ? 'loaded delay-5' : ''}`}>
            <div className="studio-works-header">
              <h2 className="studio-works-title">Takes</h2>
            </div>

            {takesLoading ? (
              <div className="py-12">
                <Loading text="Loading takes" size="medium" />
              </div>
            ) : userTakes.length === 0 ? (
              <div className="studio-works-empty">
                <div className="studio-works-empty-icon">
                  {icons.take}
                </div>
                <p className="studio-works-empty-text">No takes yet...</p>
              </div>
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
          <div className={`studio-works-section studio-section-animated ${pageLoaded ? 'loaded delay-5' : ''}`}>
            <div className="studio-works-header">
              <h2 className="studio-works-title">Relays</h2>
              <div className="studio-filters">
                <button
                  onClick={() => setRelaySubTab("posts")}
                  className={`studio-filter-btn ${relaySubTab === "posts" ? "active" : ""}`}
                >
                  Posts
                </button>
                <button
                  onClick={() => setRelaySubTab("takes")}
                  className={`studio-filter-btn ${relaySubTab === "takes" ? "active" : ""}`}
                >
                  Takes
                </button>
              </div>
            </div>

            {/* Relayed Posts */}
            {relaySubTab === "posts" && (
              <>
                {relaysLoading ? (
                  <div className="py-12">
                    <Loading text="Loading relays" size="medium" />
                  </div>
                ) : relays.length === 0 ? (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">
                      {icons.relay}
                    </div>
                    <p className="studio-works-empty-text">No relayed posts yet...</p>
                  </div>
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
                          admires: relay.admires_count,
                          comments: relay.comments_count,
                          relays: relay.relays_count || 0,
                        },
                        isAdmired: relay.user_has_admired,
                        isSaved: relay.user_has_saved,
                        isRelayed: relay.user_has_relayed,
                      };

                      const hasMedia = relay.media && relay.media.length > 0;
                      const plainContent = relay.content
                        ? relay.content.replace(/<[^>]*>/g, '').substring(0, 200)
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
                                {icons.heart} {relay.admires_count}
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
                  <div className="py-12">
                    <Loading text="Loading relayed takes" size="medium" />
                  </div>
                ) : relayedTakes.length === 0 ? (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">
                      {icons.take}
                    </div>
                    <p className="studio-works-empty-text">No relayed takes yet...</p>
                  </div>
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
        {activeTab === "store" && (
          <div className={`studio-works-section studio-section-animated ${pageLoaded ? 'loaded delay-5' : ''}`}>
            <div className="relative rounded-2xl md:rounded-3xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/80 p-8 md:p-12 lg:p-16 border border-purple-200/50 shadow-[0_8px_40px_-12px_rgba(142,68,173,0.15)] text-center">
              {/* Store Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>

              <h3 className="font-display text-xl md:text-2xl text-ink mb-3">Store Coming Soon</h3>
              <p className="font-body text-muted text-[0.95rem] max-w-md mx-auto">
                A place to share and sell your creative work. Stay tuned for updates.
              </p>

              {/* Subtle decorative element */}
              <div className="mt-8 flex justify-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/20" />
                <span className="w-1.5 h-1.5 rounded-full bg-pink-vivid/30" />
                <span className="w-1.5 h-1.5 rounded-full bg-orange-warm/20" />
              </div>
            </div>
          </div>
        )}

        {/* Collections Section */}
        {activeTab === "collections" && (
          <div className={`studio-works-section studio-section-animated ${pageLoaded ? 'loaded delay-5' : ''}`}>
            {collectionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loading />
              </div>
            ) : collections.length === 0 ? (
              /* Empty State - Glass Card */
              <div className="relative rounded-3xl overflow-hidden">
                {/* Glass background */}
                <div className="absolute inset-0 bg-gradient-to-br from-purple-primary/5 via-white/80 to-pink-vivid/5 backdrop-blur-xl" />
                <div className="absolute inset-0 bg-white/40" />

                {/* Content */}
                <div className="relative p-10 md:p-16 text-center">
                  {/* Decorative circles */}
                  <div className="absolute top-8 left-8 w-24 h-24 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 blur-2xl" />
                  <div className="absolute bottom-8 right-8 w-32 h-32 rounded-full bg-gradient-to-br from-pink-vivid/10 to-orange-warm/10 blur-2xl" />

                  <div className="relative">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center backdrop-blur-sm border border-white/50">
                      <svg className="w-10 h-10 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                      </svg>
                    </div>
                    <h3 className="font-display text-2xl md:text-3xl text-ink mb-3">No Collections Yet</h3>
                    <p className="font-body text-muted max-w-md mx-auto">
                      {isOwnProfile
                        ? "Create a collection to organize your works. Go to Create Post and select a collection to get started!"
                        : `${profile?.display_name || profile?.username} hasn't created any collections yet.`}
                    </p>
                  </div>
                </div>

                {/* Border */}
                <div className="absolute inset-0 rounded-3xl border border-white/60 pointer-events-none" />
              </div>
            ) : (
              <div className="space-y-6">
                {collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    isOwnProfile={isOwnProfile}
                    username={username}
                    onToggleCollapse={async () => {
                      await toggleCollapse(collection.id, collection.is_collapsed);
                      refetchCollections();
                    }}
                    onDelete={async () => {
                      if (confirm("Are you sure you want to delete this collection? This cannot be undone.")) {
                        // Use the hook outside - for now just refetch
                        const { error } = await supabase.from("collections").delete().eq("id", collection.id);
                        if (!error) refetchCollections();
                      }
                    }}
                    onDeleteItem={async (itemId: string) => {
                      if (confirm("Are you sure you want to delete this item?")) {
                        const { error } = await supabase.from("collection_items").delete().eq("id", itemId);
                        if (!error) refetchCollections();
                      }
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

      </div>

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

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
            <h3 className="font-display text-xl text-ink mb-3">
              Block @{profile.username}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              They won't be able to see your posts, follow you, or message you. They won't be notified that you blocked them.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowBlockConfirm(false)}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBlock}
                disabled={blockLoading}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {blockLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Blocking...
                  </>
                ) : (
                  "Block"
                )}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !reportLoading && setShowReportModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] bg-white rounded-2xl shadow-2xl z-[1001] overflow-hidden">
            {reportSuccess ? (
              <div className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="font-display text-xl text-ink mb-2">Report Submitted</h3>
                <p className="font-body text-sm text-muted">
                  Thank you for helping keep PinkQuill safe. We'll review this report.
                </p>
              </div>
            ) : (
              <>
                <div className="p-6 border-b border-black/[0.06]">
                  <h3 className="font-display text-xl text-ink">
                    Report @{profile.username}
                  </h3>
                  <p className="font-body text-sm text-muted mt-1">
                    Help us understand what's happening with this account.
                  </p>
                </div>

                <div className="p-6">
                  <label className="block font-ui text-sm text-ink mb-2">
                    Why are you reporting this user?
                  </label>
                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Please describe the issue..."
                    rows={4}
                    className="w-full px-4 py-3 rounded-xl bg-black/[0.03] border-none outline-none font-body text-ink placeholder:text-muted/50 focus:ring-2 focus:ring-purple-primary/20 transition-all resize-none"
                  />

                  <div className="mt-4 space-y-2">
                    <p className="font-ui text-xs text-muted">Quick select:</p>
                    <div className="flex flex-wrap gap-2">
                      {["Spam", "Harassment", "Impersonation", "Inappropriate content", "Other"].map((reason) => (
                        <button
                          key={reason}
                          onClick={() => setReportReason(reason)}
                          className={`px-3 py-1.5 rounded-full font-ui text-xs transition-all ${
                            reportReason === reason
                              ? "bg-purple-primary text-white"
                              : "bg-black/[0.04] text-muted hover:bg-black/[0.08]"
                          }`}
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-black/[0.06] flex justify-end gap-3">
                  <button
                    onClick={() => {
                      setShowReportModal(false);
                      setReportReason("");
                    }}
                    disabled={reportLoading}
                    className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReport}
                    disabled={reportLoading || !reportReason.trim()}
                    className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {reportLoading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      "Submit Report"
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* Communities Modal */}
      {showCommunitiesModal && userCommunities && userCommunities.length > 0 && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => setShowCommunitiesModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[400px] max-h-[80vh] bg-white rounded-2xl shadow-2xl z-[1001] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-black/[0.06] flex items-center justify-between">
              <h3 className="font-display text-lg text-ink">Communities</h3>
              <button
                onClick={() => setShowCommunitiesModal(false)}
                className="w-8 h-8 rounded-full hover:bg-black/[0.04] flex items-center justify-center text-muted transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Community List */}
            <div className="overflow-y-auto max-h-[calc(80vh-80px)]">
              {userCommunities.map((community) => (
                <a
                  key={community.id}
                  href={`/community/${community.slug || community.id}`}
                  onClick={() => setShowCommunitiesModal(false)}
                  className="flex items-center gap-3 p-4 hover:bg-black/[0.02] transition-colors border-b border-black/[0.04] last:border-b-0"
                >
                  {/* Community Avatar */}
                  <div className="relative w-12 h-12 rounded-full overflow-hidden flex-shrink-0">
                    {community.avatar_url ? (
                      <img
                        src={community.avatar_url}
                        alt={community.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 flex items-center justify-center">
                        <span className="text-lg font-ui text-purple-primary font-medium">
                          {community.name?.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Community Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="font-ui text-sm font-medium text-ink truncate">{community.name}</h4>
                      {/* Admin/Moderator Badge */}
                      {community.user_role === 'admin' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-[9px] font-ui font-semibold uppercase tracking-wide">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                          </svg>
                          Admin
                        </span>
                      )}
                      {community.user_role === 'moderator' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-[9px] font-ui font-semibold uppercase tracking-wide">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm-2 16l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"/>
                          </svg>
                          Mod
                        </span>
                      )}
                    </div>
                    {community.description && (
                      <p className="font-body text-xs text-muted line-clamp-1 mt-0.5">
                        {community.description}
                      </p>
                    )}
                    <div className="flex items-center gap-3 mt-1">
                      <span className="font-ui text-[10px] text-ink/40">
                        {community.member_count || 0} members
                      </span>
                    </div>
                  </div>

                  {/* Arrow */}
                  <svg className="w-4 h-4 text-muted/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
