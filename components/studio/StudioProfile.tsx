"use client";

import { Spinner } from "@/components/ui/Loading";
import { showToast, actionToast } from "@/lib/utils/toast";

import "./studio.css";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { toModalPost, DEFAULT_AVATAR } from "@/lib/posts/toPostProps";
import { formatCount } from "@/lib/utils/format";
import { stripHtml } from "@/lib/utils/sanitize";
import { getOrCreateConversation } from "@/lib/messaging/conversations";
import { fetchCollaboratedPosts, useCommunities, COLLAB_SELF_REMOVED_EVENT } from "@/lib/hooks.legacy";
import type { CollabSelfRemovedDetail } from "@/lib/hooks.legacy";
import { useCollections, useReorderCollections } from "@/lib/hooks/useCollections";
import CollectionsShelf from "@/components/studio/CollectionsShelf";
import { useRelays } from "@/lib/hooks/useFeed";
import { useBlock } from "@/lib/hooks/useInteractions";
import { usePinnedPosts } from "@/lib/hooks/usePinnedPosts";
import { useProfile, useFollow } from "@/lib/hooks/useProfile";
import type { FollowStatus } from "@/lib/types";
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ReportModal from "@/components/ui/ReportModal";
import { BLOCK_COPY } from "@/components/feed/post-detail/copy";
import { useReportFlow } from "@/components/feed/post-detail/flows";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import StudioSkeleton from "./StudioSkeleton";
import { CommentIcon } from "@/components/ui/Icons";
import { getTimeAgo, shortDate, fullDate, formatDate, mediumDate, monthYear } from "@/lib/utils/time";
import { parseSocialLinks, getSocialUrl } from "@/lib/utils/social";

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
import TakePostCard from "@/components/takes/TakePostCard";
import Loading from "@/components/ui/Loading";
import StoreTab from "@/components/store/StoreTab";
import CommissionsTab from "@/components/commissions/CommissionsTab";
import { useHasCommissions } from "@/lib/hooks/useCommissions";
import ActionMenu from "@/components/ui/ActionMenu";
import type { Post } from "@/lib/types";
import ReactionCount from "@/components/feed/ReactionCount";
import CommentCount from "@/components/feed/CommentCount";


// Keyboard access for tiles and stat cells that only had onClick (P-34).
function pressKeys(onPress: () => void) {
  return {
    role: "button" as const,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onPress();
      }
    },
  };
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
    color: "var(--color-ink)",
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
    color: "var(--color-ink)",
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
      </svg>
    ),
  },
  threads: {
    color: "var(--color-ink)",
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
    color: "var(--color-ink)",
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
    color: "var(--color-accent)",
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
  store: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
    </svg>
  ),
  collection: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  ),
};

// Plain-text excerpts, remembered per post: stripping HTML for every tile on
// every render was the profile's biggest render cost (P-28).
const excerptCache = new Map<string, string>();
function excerptOf(id: string, content: string | null | undefined, length: number): string {
  if (!content) return "";
  const key = `${id}:${length}:${content.length}`;
  const hit = excerptCache.get(key);
  if (hit !== undefined) return hit;
  const plain = stripHtml(content);
  let value = plain.substring(0, length);
  if (plain.length > length) {
    const cut = value.lastIndexOf(" ");
    if (cut > length * 0.6) value = value.substring(0, cut);
  }
  if (excerptCache.size > 2000) excerptCache.clear();
  excerptCache.set(key, value);
  return value;
}

// The image a tile can show: the first image item, not whatever is at
// position 0 — an audio- or video-first post used to render a broken <img> (P-22).
function tileImage(media: { media_type: string; media_url: string; position?: number }[] | null | undefined): string | null {
  if (!media || media.length === 0) return null;
  return [...media].sort((a, b) => (a.position ?? 0) - (b.position ?? 0)).find((m) => m.media_type === "image")?.media_url ?? null;
}

// Shown in place of a tab's empty state when its request failed (P-20).
function TabErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="studio-works-empty">
      <p className="studio-works-empty-text">Couldn&apos;t load {what}.</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-on-accent hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}

function StudioTabButton({
  label,
  icon,
  active,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      role="tab"
      aria-selected={active}
      className={`flex-1 min-w-0 relative flex items-center justify-center gap-2 py-3 md:py-3 font-ui text-[13px] font-medium transition-colors duration-200 ${
        active
          ? "text-accent-2"
          : "text-subdued hover:text-ink"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="hidden md:inline truncate">{label}</span>
      <span className={`absolute bottom-0 inset-x-0 h-[2px] rounded-full transition-colors duration-200 ${
        active ? "bg-accent-2" : "bg-transparent"
      }`} />
    </button>
  );
}

function StudioSubTabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      role="tab"
      aria-selected={active}
      className={`shrink-0 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap ${
        active
          ? "bg-accent/15 text-accent"
          : "text-subdued hover:text-ink hover:bg-subtle"
      }`}
    >
      {label}
    </button>
  );
}


interface StudioProfileProps {
  username: string;
}

export default function StudioProfile({ username }: StudioProfileProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  const { openPostModal, subscribeToDeletes, subscribeToUpdates, subscribeToTakeDeletes, subscribeToAuthorBlocks } = useModal();

  // What the modal did to a post since this page loaded (V-9, V-10, V-11,
  // F-14): the hooks' arrays are not re-fetched on every action, so keep the
  // deltas here and apply them to tiles and to the next modal open.
  const [deletedPostIds, setDeletedPostIds] = useState<Set<string>>(new Set());
  const [deletedTakeIds, setDeletedTakeIds] = useState<Set<string>>(new Set());
  const [blockedAuthorIds, setBlockedAuthorIds] = useState<Set<string>>(new Set());
  const [postOverrides, setPostOverrides] = useState<Record<string, { isSaved?: boolean; isRelayed?: boolean; relaysDelta: number }>>({});
  useEffect(() => {
    const unsubDelete = subscribeToDeletes((id) => setDeletedPostIds((prev) => new Set(prev).add(id)));
    const unsubTake = subscribeToTakeDeletes((id) => setDeletedTakeIds((prev) => new Set(prev).add(id)));
    const unsubBlock = subscribeToAuthorBlocks((authorId) => setBlockedAuthorIds((prev) => new Set(prev).add(authorId)));
    const unsubUpdate = subscribeToUpdates((update) => {
      setPostOverrides((prev) => {
        const current = prev[update.postId] ?? { relaysDelta: 0 };
        if (update.field === "saves") return { ...prev, [update.postId]: { ...current, isSaved: update.isActive } };
        if (update.field === "relays") {
          return { ...prev, [update.postId]: { ...current, isRelayed: update.isActive, relaysDelta: current.relaysDelta + update.countChange } };
        }
        return prev;
      });
    });
    return () => { unsubDelete(); unsubTake(); unsubBlock(); unsubUpdate(); };
  }, [subscribeToDeletes, subscribeToTakeDeletes, subscribeToAuthorBlocks, subscribeToUpdates]);

  // Modal props for a row, with whatever the modal changed since load applied.
  const openWithOverrides = (row: Parameters<typeof toModalPost>[0]) => {
    const o = postOverrides[row.id];
    if (!o) return toModalPost(row);
    return toModalPost(row, {
      ...(o.isSaved !== undefined ? { isSaved: o.isSaved } : {}),
      ...(o.isRelayed !== undefined ? { isRelayed: o.isRelayed } : {}),
      stats: {
        reactions: row.reactions_count ?? undefined,
        reactionCounts: row.reaction_counts,
        comments: row.comments_count ?? 0,
        relays: Math.max(0, (row.relays_count ?? 0) + o.relaysDelta),
      },
    });
  };
  const [activeTab, setActiveTab] = useState<"posts" | "takes" | "relays" | "store" | "commissions" | "collections">("posts");
  const [relaySubTab, setRelaySubTab] = useState<"posts" | "takes">("posts");
  const shouldLoadTakes = activeTab === "takes";
  const shouldLoadRelayPosts = activeTab === "relays";
  const shouldLoadRelayTakes = activeTab === "relays" && relaySubTab === "takes";
  const shouldLoadCollections = activeTab === "collections";
  const { profile, posts, hasMorePosts, loadingMorePosts, loadMorePosts, loading, error, isBlockedByUser, isPrivateAccount, viewerFollowStatus, viewerHasBlocked, refetch: refetchProfile } = useProfile(username, user?.id, { ready: !authLoading });
  const { follow, unfollow } = useFollow();
  const { blockUser, unblockUser } = useBlock();
  // Tab data loads when its tab opens and is kept when the tab is left (P-11).
  const { relays, loading: relaysLoading, error: relaysError, refetch: refetchRelays } = useRelays(username, user?.id, { enabled: shouldLoadRelayPosts });
  const { takes: userTakes, loading: takesLoading, error: takesError, refetch: refetchTakes } = useUserTakes(username, user?.id, { enabled: shouldLoadTakes });
  const { takes: relayedTakes, loading: relayedTakesLoading, error: relayedTakesError, refetch: refetchRelayedTakes } = useRelayedTakes(username, user?.id, { enabled: shouldLoadRelayTakes });
  // Only the About box shows communities; skip the two requests when there is no About box (P-12).
  const hasAboutBox = !!(profile && (profile.bio || profile.role || profile.location || profile.education || profile.languages));
  const { communities: userCommunities } = useCommunities(profile?.id, 'joined', { enabled: hasAboutBox });
  const { collections, loading: collectionsLoading, error: collectionsError, refetch: refetchCollections } = useCollections(profile?.id, { enabled: shouldLoadCollections });
  const { reorderCollections } = useReorderCollections();
  const { pinnedPostIds, isPinned, canPin, pinPost, unpinPost } = usePinnedPosts(profile?.id);
  const [pageLoaded, setPageLoaded] = useState(false);
  const [showCommunitiesModal, setShowCommunitiesModal] = useState(false);
  // Follow / block status come from useProfile's single lookup; the page only
  // keeps what the viewer changed since, keyed by profile so a different
  // profile never inherits it (P-7).
  const [followOverride, setFollowOverride] = useState<{ id: string; status: FollowStatus } | null>(null);
  const followStatus: FollowStatus = followOverride && followOverride.id === profile?.id ? followOverride.status : viewerFollowStatus;
  const setFollowStatus = (status: FollowStatus) => setFollowOverride(profile ? { id: profile.id, status } : null);
  // Follower / following counts adjusted for the viewer's own actions until
  // the next refetch (P-5). `base` detects a refetch: when the server count
  // moves, the local delta is dropped.
  const [countDelta, setCountDelta] = useState<{ id: string; base: number | null; followers: number; following: number } | null>(null);
  const deltaLive = countDelta && countDelta.id === profile?.id && countDelta.base === profile?.followers_count;
  const followersShown = profile?.followers_count === null || profile?.followers_count === undefined
    ? null
    : profile.followers_count + (deltaLive ? countDelta.followers : 0);
  const followingShown = profile?.following_count === null || profile?.following_count === undefined
    ? null
    : profile.following_count + (deltaLive ? countDelta.following : 0);
  const adjustCounts = (followers: number, following: number) => {
    if (!profile) return;
    setCountDelta((prev) => {
      const live = prev && prev.id === profile.id && prev.base === profile.followers_count;
      return {
        id: profile.id,
        base: profile.followers_count,
        followers: (live ? prev.followers : 0) + followers,
        following: (live ? prev.following : 0) + following,
      };
    });
  };
  const [followLoading, setFollowLoading] = useState(false);
  const [messageLoading, setMessageLoading] = useState(false);
  const { openModal: openAuthModal } = useAuthModal();
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [followersModalTab, setFollowersModalTab] = useState<"followers" | "following">("followers");
  const [showShareModal, setShowShareModal] = useState(false);
  const [blockOverride, setBlockOverride] = useState<{ id: string; value: boolean } | null>(null);
  const isBlocked = blockOverride && blockOverride.id === profile?.id ? blockOverride.value : viewerHasBlocked;
  const setIsBlocked = (value: boolean) => setBlockOverride(profile ? { id: profile.id, value } : null);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);
  const report = useReportFlow(profile ? { type: "user", reportedUserId: profile.id } : null);
  const [collaboratedPosts, setCollaboratedPosts] = useState<Post[]>([]);

  // Trigger page load animation
  useEffect(() => {
    if (!loading && profile) {
      const timer = setTimeout(() => setPageLoaded(true), 100);
      return () => clearTimeout(timer);
    }
  }, [loading, profile]);

  useEffect(() => {
    const tab = searchParams?.get("tab");
    if (tab === "posts" || tab === "takes" || tab === "relays" || tab === "store" || tab === "commissions" || tab === "collections") {
      setActiveTab(tab);
    }
    const view = searchParams?.get("view");
    if (view === "all" || view === "gallery" || view === "poems" || view === "journals" || view === "communities") {
      setPostViewMode(view);
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
  type PostViewMode = "all" | "gallery" | "poems" | "journals" | "communities";
  const [postViewMode, setPostViewMode] = useState<PostViewMode>("all");

  // Refresh and Back keep the tab and sub-tab: they live in ?tab= / ?view=
  // (P-36). Native replaceState keeps Next's history entry (the modal's
  // pushState contract in ModalProvider relies on it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const wantTab = activeTab === "posts" ? null : activeTab;
    const wantView = activeTab === "posts" && postViewMode !== "all" ? postViewMode : null;
    if ((url.searchParams.get("tab") ?? null) === wantTab && (url.searchParams.get("view") ?? null) === wantView) return;
    if (wantTab) url.searchParams.set("tab", wantTab); else url.searchParams.delete("tab");
    if (wantView) url.searchParams.set("view", wantView); else url.searchParams.delete("view");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [activeTab, postViewMode]);


  // Derived post lists are memoised so unrelated state (a modal, a report
  // textarea) no longer rebuilds and re-sorts every tile on each render (P-28).
  const collaboratedPostIdSet = useMemo(() => new Set(collaboratedPosts.map(p => p.id)), [collaboratedPosts]);
  const allPosts = useMemo(() => {
    const isGone = (p: { id: string; author_id: string }) => deletedPostIds.has(p.id) || blockedAuthorIds.has(p.author_id);
    return [
      ...posts.filter(p => !isGone(p)).map(p => ({ ...p, isCollaboration: false })),
      ...collaboratedPosts
        .filter(p => !posts.some(post => post.id === p.id)) // Avoid duplicates
        .filter(p => !isGone(p))
        .map(p => ({ ...p, isCollaboration: true })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [posts, collaboratedPosts, deletedPostIds, blockedAuthorIds]);
  const filteredPosts = useMemo(() => {
    // Community posts are ONLY shown in the communities view
    let list: typeof allPosts;
    switch (postViewMode) {
      case "communities":
        list = allPosts.filter(p => p.community_id);
        break;
      case "gallery":
        list = allPosts.filter(p => !!tileImage(p.media) && !p.community_id);
        break;
      case "poems":
        list = allPosts.filter(p => p.type === "poem" && !p.community_id);
        break;
      case "journals":
        list = allPosts.filter(p => p.type === "journal" && !p.community_id);
        break;
      case "all":
      default:
        list = allPosts.filter(p => !p.community_id);
    }
    // Pinned posts first (only in the "all" view)
    if (postViewMode !== "all" || pinnedPostIds.length === 0) return list;
    const pinned = list
      .filter(p => pinnedPostIds.includes(p.id))
      .sort((a, b) => pinnedPostIds.indexOf(a.id) - pinnedPostIds.indexOf(b.id));
    const unpinned = list.filter(p => !pinnedPostIds.includes(p.id));
    return [...pinned, ...unpinned];
  }, [allPosts, postViewMode, pinnedPostIds]);

  // Infinite scroll for the posts tab (same sentinel pattern as the feed, P-10).
  const [postsSentinel, setPostsSentinel] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!postsSentinel || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void loadMorePosts();
      },
      { threshold: 0, rootMargin: "200px" },
    );
    observer.observe(postsSentinel);
    return () => observer.disconnect();
  }, [postsSentinel, loadMorePosts]);


  // Follow-status changes (e.g. a request being accepted/rejected) arrive on the
  // per-user broadcast channel instead of a dedicated postgres_changes subscription.
  useUserEvent("follow_change", (payload) => {
    if (!user || !profile || isOwnProfile) return;
    if (payload.follower_id !== user.id || payload.following_id !== profile.id) return;

    if (payload.op === "DELETE") {
      setFollowStatus(null);
      return;
    }

    // The `isFollowing && isPrivateAccount` effect below does the refetch for
    // an accepted request; doing it here as well fetched everything twice (P-8).
    setFollowStatus(payload.status ?? null);
  });


  // Fetch collaborated posts
  useEffect(() => {
    const loadCollaboratedPosts = async () => {
      if (profile?.id) {
        try {
          const collabPosts = await fetchCollaboratedPosts(profile.id, user?.id);
          setCollaboratedPosts(collabPosts);
        } catch (error) {
          console.error("Error fetching collaborated posts:", error);
        }
      }
    };
    loadCollaboratedPosts();
  }, [profile?.id, user?.id]);

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

  // Handle follow/unfollow
  const handleFollow = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!profile || isOwnProfile) return;
    if (followLoading) return;
    setFollowLoading(true);

    const wasFollowing = followStatus === 'accepted' || followStatus === 'pending';
    try {
      if (wasFollowing) {
        // Unfollow or cancel request
        await unfollow(user.id, profile.id);
        if (followStatus === 'accepted') adjustCounts(-1, 0);
        setFollowStatus(null);
      } else {
        // Follow or send request (is_private is already loaded — no extra lookup)
        const newStatus = await follow(user.id, profile.id, profile.is_private);
        if (newStatus === 'accepted') adjustCounts(1, 0);
        setFollowStatus(newStatus);
      }
    } catch (err) {
      // The helpers throw on failure; without this the button stayed
      // disabled forever (P-6).
      console.error("[StudioProfile] Follow toggle failed:", err);
      if (wasFollowing) actionToast.unfollowError();
      else actionToast.followError();
    } finally {
      setFollowLoading(false);
    }
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
      <StudioSkeleton />
    );
  }

  if (error || !profile || isBlockedByUser) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl text-ink mb-4">User not found</h1>
          <p className="font-body text-muted">This user doesn&apos;t exist or is unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas">
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
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
        )}

        {/* Paper texture */}
        <div className="studio-cover-paper" />

        {/* Bottom Fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[150px] bg-gradient-to-t from-canvas to-transparent" />
      </div>

      {/* Profile Section */}
      <div className="relative max-w-[1100px] mx-auto px-4 md:px-8 -mt-[60px] md:-mt-[100px] pb-12">
        {/* Profile Header */}
        <div className={`flex flex-col md:flex-row md:items-end gap-4 md:gap-8 mb-6 md:mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-1' : ''}`}>
          {/* Avatar with Glow */}
          <div className="studio-avatar-wrapper flex-shrink-0 mx-auto md:mx-0">
            <div className="studio-avatar-glow" />
            <img
              src={profile.avatar_url || DEFAULT_AVATAR}
              alt={profile.display_name || profile.username}
              className="studio-avatar w-24 h-24 md:w-40 md:h-40 rounded-full object-cover border-4 border-surface shadow-xl"
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 pb-2 md:pb-4 text-center md:text-left">
            {/* Name */}
            <div className="flex items-center justify-center md:justify-start gap-2 md:gap-3 mb-1 md:mb-2">
              <h1 className="font-display text-[1.6rem] md:text-[2.6rem] tracking-tight leading-none text-ink font-medium truncate min-w-0">
                {profile.display_name || profile.username}
              </h1>
              {profile.is_verified && (
                <span className="w-5 h-5 md:w-7 md:h-7 bg-gradient-to-br from-purple-primary via-pink-vivid to-orange-warm rounded-full flex items-center justify-center text-on-accent shadow-lg shadow-pink-vivid/25">
                  {icons.verified}
                </span>
              )}
            </div>

            {/* Username */}
            <p className="font-ui text-[0.8rem] md:text-[0.85rem] text-muted/70 tracking-wider mb-2 md:mb-3 truncate">@{profile.username}</p>

            {/* Tagline */}
            {profile.tagline && (
              <p className="font-body text-[0.9rem] md:text-[1.05rem] italic text-muted truncate">
                {profile.tagline}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap justify-center md:justify-end gap-2 md:gap-3 pb-2 md:pb-4">
            {!isOwnProfile && (
              <>
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  aria-busy={followLoading}
                  aria-label={followLoading ? "Updating follow status" : undefined}
                  className={`relative px-5 py-2 md:px-8 md:py-3 rounded-full font-ui text-[0.85rem] md:text-15 font-medium transition-all ${
                    isFollowing
                      ? "bg-surface border-2 border-accent text-accent hover:bg-accent/5"
                      : isPendingRequest
                        ? "bg-surface border-2 border-muted text-muted hover:border-red-400 hover:text-red-400"
                        : "bg-gradient-to-r from-purple-primary to-pink-vivid text-on-accent shadow-lg shadow-purple-primary/30 hover:shadow-xl"
                  }`}
                >
                  {followLoading && <span className="absolute inset-0 flex items-center justify-center"><Spinner size="sm" /></span>}
                  <span className={followLoading ? "invisible" : ""}>{isFollowing
                      ? "Following"
                      : isPendingRequest
                        ? "Requested"
                        : profile?.is_private
                          ? "Request to Follow"
                          : "Follow"
                  }</span>
                </button>
                <button
                  onClick={async () => {
                    if (!user) {
                      openAuthModal();
                      return;
                    }
                    if (!profile || messageLoading) return;
                    setMessageLoading(true);

                    try {
                      const conversationId = await getOrCreateConversation(profile.id);
                      router.push(`/messages?conversation=${conversationId}`);
                    } catch (err) {
                      console.error("Failed to start conversation:", err);
                      showToast.error("Couldn’t open conversation", "Please try again");
                      setMessageLoading(false);
                    }
                  }}
                  disabled={messageLoading}
                  className="px-4 py-2 md:px-6 md:py-3 rounded-full border-2 border-border-light bg-surface font-ui text-[0.85rem] md:text-15 font-medium text-ink flex items-center gap-2 hover:border-accent hover:text-accent transition-all disabled:opacity-50"
                >
                  {icons.message}
                  <span className="hidden md:inline">Message</span>
                </button>
              </>
            )}

            {isOwnProfile && (
              <Link href="/settings" className="px-5 py-2 md:px-8 md:py-3 rounded-full border-2 border-border-light bg-surface font-ui text-[0.85rem] md:text-15 font-medium text-ink hover:border-accent hover:text-accent transition-all">
                Edit Profile
              </Link>
            )}

            <ActionMenu
              widthClassName="w-52"
              buttonAriaLabel="Profile actions"
              portal
              buttonClassName="w-10 h-10 md:w-12 md:h-12 rounded-full border-2 border-border-light bg-surface flex items-center justify-center text-ink hover:border-accent hover:text-accent transition-all"
              items={[
                {
                  label: "Share",
                  onSelect: () => setShowShareModal(true),
                  icon: icons.share,
                },
                {
                  label: "Copy link",
                  onSelect: () => {
                    navigator.clipboard.writeText(profileUrl).then(
                      () => showToast.success("Link copied"),
                      () => showToast.error("Couldn’t copy the link"),
                    );
                  },
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  ),
                },
                {
                  label: "Appearance",
                  href: "/settings/appearance",
                  hidden: !isOwnProfile,
                  sectionLabel: "Settings",
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 3l1.6 4.9L18.7 7l-3.5 3.8 1 5.1L12 13.3 7.8 15.9l1-5.1L5.3 7l5.1.9L12 3z" />
                    </svg>
                  ),
                },
                {
                  label: `${isBlocked ? "Unblock" : "Block"} @${profile.username}`,
                  onSelect: () => {
                    if (isBlocked) {
                      handleBlock();
                    } else {
                      setShowBlockConfirm(true);
                    }
                  },
                  hidden: isOwnProfile || !user,
                  tone: "warning",
                  dividerBefore: true,
                  sectionLabel: "Safety",
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                    </svg>
                  ),
                },
                {
                  label: `Report @${profile.username}`,
                  onSelect: report.show,
                  hidden: isOwnProfile || !user,
                  tone: "danger",
                  icon: (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  ),
                },
              ]}
            />
          </div>
        </div>

        {/* Private Account Notice */}
        {isPrivateAccount && !isOwnProfile && !isFollowing && (
          <div className={`mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-2' : ''}`}>
            <div className="relative rounded-3xl bg-gradient-to-br from-surface via-surface to-accent/10 p-10 border border-accent/15 shadow-lg shadow-accent/10 text-center">
              {/* Lock Icon */}
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-accent/10 to-accent-2/10 flex items-center justify-center">
                <svg className="w-10 h-10 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>

              <h3 className="font-display text-xl text-ink mb-3">This Account is Private</h3>
              <p className="font-body text-muted text-15 max-w-md mx-auto mb-6">
                {isPendingRequest
                  ? "Your follow request is pending. Once approved, you'll be able to see their posts and profile."
                  : "Follow this account to see their posts, takes, and profile information."
                }
              </p>

            </div>
          </div>
        )}

        {/* Stats - Enhanced (only show for public accounts or if following) */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
        <div className={`studio-stats-enhanced mb-8 studio-section-animated ${pageLoaded ? 'loaded delay-2' : ''}`}>
          <div className="studio-stat-item">
            <span className="studio-stat-value">{formatCount(profile.works_count)}</span>
            <span className="studio-stat-label">Posts</span>
          </div>
          <div
            className="studio-stat-item"
            onClick={() => {
              setFollowersModalTab("followers");
              setShowFollowersModal(true);
            }}
            {...pressKeys(() => {
              setFollowersModalTab("followers");
              setShowFollowersModal(true);
            })}
          >
            <span className="studio-stat-value">{formatCount(followersShown)}</span>
            <span className="studio-stat-label">Followers</span>
          </div>
          <div
            className="studio-stat-item"
            onClick={() => {
              setFollowersModalTab("following");
              setShowFollowersModal(true);
            }}
            {...pressKeys(() => {
              setFollowersModalTab("following");
              setShowFollowersModal(true);
            })}
          >
            <span className="studio-stat-value">{formatCount(followingShown)}</span>
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
            <div className="relative rounded-2xl md:rounded-3xl bg-gradient-to-br from-surface via-surface to-accent/10 p-5 md:p-8 lg:p-10 border border-accent/15 shadow-lg shadow-accent/10">

              {/* Header */}
              <div className="mb-4 md:mb-8">
                <h3 className="font-display text-base md:text-lg text-ink/80 tracking-wide font-medium">About the Artist</h3>
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="font-body text-15 md:text-[1.12rem] leading-[1.8] md:leading-[1.95] text-ink/75 mb-6 md:mb-8 max-w-2xl whitespace-pre-line break-words">
                  {profile.bio}
                </p>
              )}

              {/* Details with subtle separators */}
              <div className="flex flex-wrap items-center gap-y-2 md:gap-y-3 text-[0.82rem] md:text-[0.88rem] text-ink/60 mb-6 md:mb-8">
                {profile.role && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-accent/70">{icons.briefcase}</span>
                      <span className="font-body">{profile.role}</span>
                    </div>
                    {(profile.location || profile.education || profile.languages) && (
                      <span className="text-accent/25 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.location && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-accent/70">{icons.location}</span>
                      <span className="font-body">{profile.location}</span>
                    </div>
                    {(profile.education || profile.languages) && (
                      <span className="text-accent/25 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.education && (
                  <>
                    <div className="flex items-center gap-2 pr-5">
                      <span className="text-accent/70">{icons.education}</span>
                      <span className="font-body">{profile.education}</span>
                    </div>
                    {profile.languages && (
                      <span className="text-accent/25 pr-5">•</span>
                    )}
                  </>
                )}
                {profile.languages && (
                  <div className="flex items-center gap-2">
                    <span className="text-accent/70">{icons.languages}</span>
                    <span className="font-body">{profile.languages}</span>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 pt-6 border-t border-accent/10">
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
                          className="group flex items-center justify-center w-9 h-9 rounded-xl hover:bg-accent/10 transition-all duration-300"
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
                    className="group flex items-center gap-1 py-1.5 rounded-full hover:bg-accent/[0.04] transition-all duration-300 px-1"
                  >
                    {/* Stacked Community Avatars */}
                    <div className="flex items-center">
                      {userCommunities.slice(0, userCommunities.length > 4 ? 3 : 4).map((community, index) => (
                        <div
                          key={community.id}
                          className="relative w-7 h-7 rounded-full border-2 border-surface overflow-hidden shadow-sm transition-all duration-300 group-hover:shadow-md"
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
                            <div className="w-full h-full bg-gradient-to-br from-accent/40 to-accent-2/40 flex items-center justify-center">
                              <span className="text-[9px] font-ui text-on-accent font-semibold">
                                {community.name?.charAt(0).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* +X more indicator */}
                      {userCommunities.length > 4 && (
                        <div
                          className="relative w-7 h-7 rounded-full border-2 border-surface overflow-hidden shadow-sm bg-gradient-to-br from-accent to-accent-2 flex items-center justify-center transition-all duration-300 group-hover:shadow-md"
                          style={{ marginLeft: '-8px', zIndex: 6 }}
                        >
                          <span className="text-[9px] font-ui text-on-accent font-bold">
                            +{userCommunities.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                )}

                {/* Joined */}
                <div className="flex items-center gap-2 text-ink/30">
                  <span className="text-accent/50">{icons.calendar}</span>
                  <span className="font-ui text-xs">Joined {monthYear(profile.created_at)}</span>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* Tabs and Content - Only show for public accounts or if following */}
        {(!isPrivateAccount || isOwnProfile || isFollowing) && (
          <>
        {/* Tabs */}
        <div className="mb-8">
          <div>
            <div className="flex items-stretch overflow-x-auto scrollbar-hide border-b border-border-light" role="tablist" aria-label="Profile sections">
              <StudioTabButton
                label="Posts"
                icon={icons.feather}
                active={activeTab === "posts"}
                onClick={() => setActiveTab("posts")}
              />
              <StudioTabButton
                label="Takes"
                icon={icons.take}
                active={activeTab === "takes"}
                onClick={() => setActiveTab("takes")}
              />
              <StudioTabButton
                label="Relays"
                icon={icons.relay}
                active={activeTab === "relays"}
                onClick={() => setActiveTab("relays")}
              />
              <StudioTabButton
                label="Store"
                icon={icons.store}
                active={activeTab === "store"}
                onClick={() => setActiveTab("store")}
              />
              {showCommissionsTab ? (
                <StudioTabButton
                  label="Commissions"
                  icon={icons.briefcase}
                  active={activeTab === "commissions"}
                  onClick={() => setActiveTab("commissions")}
                />
              ) : hasCommissions === undefined ? (
                // Same width as the real tab while we do not know yet, so the bar does not jump (P-40).
                <div className="flex-1 min-w-0 invisible" aria-hidden="true" />
              ) : null}
              <StudioTabButton
                label="Collections"
                icon={icons.collection}
                active={activeTab === "collections"}
                onClick={() => setActiveTab("collections")}
              />
            </div>
          </div>
        </div>

        {/* Posts Section */}
        {activeTab === "posts" && (
          <div className="studio-works-section">
            {/* View Mode Tabs */}
            <div className="studio-subtabs flex items-center gap-1.5 mb-8 overflow-x-auto scrollbar-hide" role="tablist" aria-label="Post views">
              <StudioSubTabButton
                label="All"
                active={postViewMode === "all"}
                onClick={() => setPostViewMode("all")}
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
              const collaboratedPostIds = collaboratedPostIdSet;

              // Empty state — or, while later pages may still hold matches for
              // this view, keep paging before declaring it empty (P-10).
              if (filteredPosts.length === 0 && (hasMorePosts || loadingMorePosts)) {
                return (
                  <div ref={setPostsSentinel} className="py-12">
                    <Loading text="Loading posts" size="medium" />
                  </div>
                );
              }
              if (filteredPosts.length === 0) {
                const emptyMessages: Record<string, { icon: React.ReactNode; text: string }> = {
                  all: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    ),
                    text: "No posts yet..."
                  },
                  blog: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
                      </svg>
                    ),
                    text: "No posts yet..."
                  },
                  gallery: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    ),
                    text: "No visual posts yet..."
                  },
                  poems: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                      </svg>
                    ),
                    text: "No poems yet..."
                  },
                  journals: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                      </svg>
                    ),
                    text: "No journal entries yet..."
                  },
                  communities: {
                    icon: (
                      <svg className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ),
                    text: "No community posts yet..."
                  }
                };

                const { icon, text } = emptyMessages[postViewMode];
                return (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">{icon}</div>
                    <p className="studio-works-empty-text">{text}</p>
                  </div>
                );
              }

              // Helper to create postForModal
              const createPostForModal = (work: typeof filteredPosts[0]) => openWithOverrides(work);

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
                      const tileSrc = tileImage(work.media);
                      const hasMedia = !!tileSrc;
                      const hasMultipleImages = work.media && work.media.length > 1;
                      const plainContent = work.content
                        ? excerptOf(work.id, work.content, 100)
                        : '';
                      const formattedDate = shortDate(work.created_at);

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          {...pressKeys(() => openPostModal(createPostForModal(work)))}
                          className="group relative cursor-pointer"
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
                                    src={tileSrc ?? ""}
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
                                      className={`absolute top-3 ${isPinned(work.id) ? 'left-12' : 'left-3'} w-7 h-7 rounded-full backdrop-blur-sm flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 studio-touch-reveal transition-all duration-200 z-10 ${
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
                                    <ReactionCount id={work.id} total={work.reactions_count} mine={work.user_reaction_type} />
                                  </span>
                                  <span className="flex items-center gap-1 text-xs text-muted">
                                    <CommentIcon />
                                    <CommentCount id={work.id} total={work.comments_count} />
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

              // ========== GALLERY VIEW ==========
              if (postViewMode === "gallery") {
                return (
                  <div className="grid grid-cols-3 gap-1 sm:gap-2">
                    {filteredPosts.map((work) => {
                      const hasMultipleImages = work.media && work.media.length > 1;
                      const tileSrc = tileImage(work.media);

                      return (
                        <div
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          {...pressKeys(() => openPostModal(createPostForModal(work)))}
                          className="group relative aspect-square cursor-pointer overflow-hidden bg-skeleton/60 rounded-sm sm:rounded-lg"
                        >
                          <img
                            src={tileSrc ?? ""}
                            alt={work.title || ""}
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                          />

                          {/* Hover overlay */}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 studio-touch-reveal transition-opacity duration-300 flex items-center justify-center">
                            <div className="flex items-center gap-6 text-white">
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                                <ReactionCount id={work.id} total={work.reactions_count} mine={work.user_reaction_type} />
                              </span>
                              <span className="flex items-center gap-2">
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
                                </svg>
                                <CommentCount id={work.id} total={work.comments_count} />
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
                        ? excerptOf(work.id, work.content, 240)
                        : '';
                      const formattedDate = formatDate(work.created_at);

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          {...pressKeys(() => openPostModal(createPostForModal(work)))}
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
                              <ReactionCount id={work.id} total={work.reactions_count} mine={work.user_reaction_type} />
                            </span>
                            <span className="text-muted/50">·</span>
                            <span className="flex items-center gap-1">
                              <CommentIcon />
                              <CommentCount id={work.id} total={work.comments_count} />
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
                  const dateKey = mediumDate(post.created_at);
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
                            const tileSrc = tileImage(work.media);
                      const hasMedia = !!tileSrc;
                            const plainContent = work.content
                              ? excerptOf(work.id, work.content, 120)
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
                          {...pressKeys(() => openPostModal(createPostForModal(work)))}
                                className="journal-card"
                              >
                                {hasMedia && (
                                  <div className="journal-card-image">
                                    <img src={tileSrc ?? ""} alt="" />
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
                      const tileSrc = tileImage(work.media);
                      const hasMedia = !!tileSrc;
                      const plainContent = work.content
                        ? excerptOf(work.id, work.content, 120)
                        : '';
                      const community = work.community;

                      return (
                        <article
                          key={work.id}
                          onClick={() => openPostModal(createPostForModal(work))}
                          {...pressKeys(() => openPostModal(createPostForModal(work)))}
                          className="group relative bg-surface rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 border border-border-light"
                        >
                          {/* Image */}
                          {hasMedia && (
                            <div className="relative h-44 overflow-hidden">
                              <img
                                src={tileSrc ?? ""}
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
                              <h4 className="font-display font-semibold text-ink text-15 mb-1.5 line-clamp-2 group-hover:text-accent transition-colors">
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
                                  <ReactionCount id={work.id} total={work.reactions_count} mine={work.user_reaction_type} />
                                </span>
                                <span className="flex items-center gap-1 text-xs">
                                  <CommentIcon size="sm" />
                                  <CommentCount id={work.id} total={work.comments_count} />
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
            {activeTab === "posts" && (hasMorePosts || loadingMorePosts) && (
              <div ref={setPostsSentinel} className="py-8 flex justify-center">
                {loadingMorePosts && <Loading text="Loading more" size="small" />}
              </div>
            )}
          </div>
        )}

        {/* Takes Section */}
        {activeTab === "takes" && (
          <div className="studio-works-section">
            {takesLoading ? (
              <div className="py-12">
                <Loading text="Loading takes" size="medium" />
              </div>
            ) : takesError ? (
              <TabErrorState what="takes" onRetry={refetchTakes} />
            ) : userTakes.filter((t) => !deletedTakeIds.has(t.id)).length === 0 ? (
              <div className="studio-works-empty">
                <div className="studio-works-empty-icon">
                  {icons.take}
                </div>
                <p className="studio-works-empty-text">No takes yet...</p>
              </div>
            ) : (
              <div className="takes-grid">
                {userTakes.filter((t) => !deletedTakeIds.has(t.id)).map((take) => (
                  <TakePostCard key={take.id} take={take} variant="grid" />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Relays Section */}
        {activeTab === "relays" && (
          <div className="studio-works-section">
            {/* Relay Type Tabs */}
            <div className="flex items-center gap-1.5 mb-8 overflow-x-auto scrollbar-hide">
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
                  <div className="py-12">
                    <Loading text="Loading relays" size="medium" />
                  </div>
                ) : relaysError ? (
              <TabErrorState what="relayed posts" onRetry={refetchRelays} />
            ) : relays.filter((r) => !deletedPostIds.has(r.id) && !blockedAuthorIds.has(r.author_id)).length === 0 ? (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">
                      {icons.relay}
                    </div>
                    <p className="studio-works-empty-text">No relayed posts yet...</p>
                  </div>
                ) : (
                  <div className="studio-works-grid">
                    {relays.filter((r) => !deletedPostIds.has(r.id) && !blockedAuthorIds.has(r.author_id)).map((relay) => {
                      const postForModal = openWithOverrides(relay);

                      const tileSrc = tileImage(relay.media);
                      const hasMedia = !!tileSrc;
                      const plainContent = relay.content
                        ? excerptOf(relay.id, relay.content, 200)
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
                          {...pressKeys(() => openPostModal(postForModal))}
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
                                src={tileSrc ?? ""}
                                alt={relay.title || "Relayed work"}
                                className="studio-relay-image"
                              />
                            </div>
                          )}

                          {/* Footer */}
                          <div className="studio-relay-footer">
                            <div className="studio-relay-author">
                              <Image
                                src={relay.original_author?.avatar_url || DEFAULT_AVATAR}
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
                                {icons.heart} <ReactionCount id={relay.id} total={relay.reactions_count} />
                              </span>
                              <span className="studio-relay-stat">
                                {icons.comment} <CommentCount id={relay.id} total={relay.comments_count} />
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
                ) : relayedTakesError ? (
              <TabErrorState what="relayed takes" onRetry={refetchRelayedTakes} />
            ) : relayedTakes.filter((t) => !deletedTakeIds.has(t.id)).length === 0 ? (
                  <div className="studio-works-empty">
                    <div className="studio-works-empty-icon">
                      {icons.take}
                    </div>
                    <p className="studio-works-empty-text">No relayed takes yet...</p>
                  </div>
                ) : (
                  <div className="takes-grid">
                    {relayedTakes.filter((t) => !deletedTakeIds.has(t.id)).map((take) => (
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
            pageLoaded={pageLoaded}
          />
        )}

        {/* Commissions Section */}
        {activeTab === "commissions" && profile && showCommissionsTab && (
          <CommissionsTab
            userId={profile.id}
            isOwnProfile={isOwnProfile}
            pageLoaded={pageLoaded}
          />
        )}

        {/* Collections Section */}
        {activeTab === "collections" && (
          <div className="studio-works-section">
            {collectionsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loading />
              </div>
            ) : collectionsError ? (
              <TabErrorState what="collections" onRetry={refetchCollections} />
            ) : collections.length === 0 && !isOwnProfile ? (
              <div className="studio-works-empty">
                <div className="studio-works-empty-icon">
                  <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <p className="studio-works-empty-text">
                  {`${profile?.display_name || profile?.username} hasn't started a collection yet.`}
                </p>
              </div>
            ) : (
              <CollectionsShelf
                collections={collections}
                isOwnProfile={isOwnProfile}
                username={username}
                onReorder={async (ids) => {
                  await reorderCollections(ids);
                  refetchCollections();
                }}
                onDelete={async (id) => {
                  const { error } = await supabase.from("collections").delete().eq("id", id);
                  if (error) actionToast.genericError("delete collection");
                  else refetchCollections();
                }}
                onCreated={refetchCollections}
              />
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
        onUnfollowed={() => { if (isOwnProfile) adjustCounts(0, -1); }}
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

      {/* Block confirmation — the same dialog and copy as posts and takes (P-32, P-34) */}
      <ConfirmationModal
        isOpen={showBlockConfirm}
        onClose={() => !blockLoading && setShowBlockConfirm(false)}
        onConfirm={handleBlock}
        title={BLOCK_COPY.title(profile.username)}
        description={BLOCK_COPY.description}
        confirmText={BLOCK_COPY.confirm}
        isDanger
        loading={blockLoading}
      />

      {/* Report — the shared report flow and dialog (P-32, P-34) */}
      {report.open && (
        <ReportModal
          isOpen={report.open}
          onClose={report.hide}
          onSubmit={report.submit}
          submitting={report.submitting}
          submitted={report.submitted}
          title={`Report @${profile.username}`}
          placeholder="Help us understand what's happening with this account..."
        />
      )}

      {/* Communities Modal */}
      {showCommunitiesModal && userCommunities && userCommunities.length > 0 && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => setShowCommunitiesModal(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[calc(100%-2rem)] max-w-[400px] max-h-[80vh] bg-elevated rounded-2xl shadow-2xl z-[1001] overflow-hidden">
            {/* Header */}
            <div className="p-5 border-b border-border-light flex items-center justify-between">
              <h3 className="font-display text-lg text-ink">Communities</h3>
              <button
                onClick={() => setShowCommunitiesModal(false)}
                className="w-8 h-8 rounded-full hover:bg-skeleton/60 flex items-center justify-center text-muted transition-colors"
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
                  className="flex items-center gap-3 p-4 hover:bg-subtle transition-colors border-b border-border-light last:border-b-0"
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
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-xs font-ui font-semibold">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
                          </svg>
                          Admin
                        </span>
                      )}
                      {community.user_role === 'moderator' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-xs font-ui font-semibold">
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
                      <span className="font-ui text-3xs text-ink/40">
                        {community.member_count || 0} {community.member_count === 1 ? "member" : "members"}
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
