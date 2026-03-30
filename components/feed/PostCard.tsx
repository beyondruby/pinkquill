"use client";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useModal } from "@/components/providers/ModalProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useToggleAdmire, useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, createNotification, useBlock, ReactionType, ReactionCounts } from "@/lib/hooks";
import { usePostViewTracker, useTrackPostImpression } from "@/lib/hooks/useTracking";

const ShareModal = dynamic(() => import("@/components/ui/ShareModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/ui/ReportModal"), { ssr: false });
const SendToDMModal = dynamic(() => import("@/components/messages/SendToDMModal"), { ssr: false });
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import CommunityBadge from "@/components/communities/CommunityBadge";
import FlairBadge from "@/components/communities/FlairBadge";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { supabase } from "@/lib/supabase";
import { PostStyling, JournalMetadata, PostBackground, SpotifyTrack, PostType } from "@/lib/types";
import { deleteOwnPost } from "@/lib/posts-client";
import { actionToast } from "@/lib/utils/toast";
import {
  MentionsDisplay,
  HashtagsDisplay,
  SoundBars as SoundBarsComponent,
  TruncatedContent as TruncatedContentComponent,
  StyledTypeLabel as StyledTypeLabelComponent,
  BlockConfirmModal,
  PostMenu as PostMenuComponent,
  type MentionInfo,
} from "./PostCard/index";
import {
  HeartIcon,
  CommentIcon,
  RelayIcon,
  ShareIcon,
  BookmarkIcon,
  TrashIcon,
  EditIcon,
  FlagIcon,
  BlockIcon,
  PlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "@/components/ui/Icons";

// Helper functions imported from @/lib/utils/sanitize
import { stripHtml } from "@/lib/utils/sanitize";

// TruncatedContent imported from ./PostCard/TruncatedContent
const TruncatedContent = TruncatedContentComponent;

// Types imported from ./PostCard/types
import type { PostProps } from "./PostCard/types";

// Format date as "January 2, 2026"
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

// Get background style for card preview
function getBackgroundPreviewStyle(background?: PostBackground): React.CSSProperties {
  if (!background) return {};
  switch (background.type) {
    case 'solid':
      return { backgroundColor: background.value };
    case 'gradient':
      return { background: background.value };
    case 'pattern':
      return {
        background: background.value,
        backgroundSize: background.value.includes("notebook")
          ? "100% 24px"
          : background.value.includes("dots") || background.value.includes("grid")
          ? "20px 20px"
          : "auto",
      };
    case 'image':
      return {
        backgroundImage: `url(${background.imageUrl || background.value})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      };
    default:
      return {};
  }
}

function getLuminance(hex: string): number {
  const normalized = hex.replace("#", "");
  if (normalized.length < 6) return 1;
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function extractColorsFromGradient(gradient: string): string[] {
  const hexPattern = /#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{3}/g;
  return gradient.match(hexPattern) || [];
}

function isDarkBackground(background?: PostBackground): boolean {
  if (!background) return false;

  if (background.type === "solid") {
    return getLuminance(background.value) < 0.5;
  }

  if (background.type === "image") return true;

  if (background.type === "gradient" || background.type === "pattern") {
    const colors = extractColorsFromGradient(background.value);
    if (colors.length === 0) return false;
    const average = colors.reduce((sum, color) => sum + getLuminance(color), 0) / colors.length;
    return average < 0.5;
  }

  return false;
}

// Weather icons (simplified inline)
const weatherIconsSmall: Record<string, string> = {
  'sunny': '☀️',
  'partly-cloudy': '⛅',
  'cloudy': '☁️',
  'rainy': '🌧️',
  'stormy': '⛈️',
  'snowy': '❄️',
  'foggy': '🌫️',
  'windy': '💨',
};

// Mood indicators
const moodIndicators: Record<string, string> = {
  'reflective': '🪞',
  'joyful': '😊',
  'melancholic': '🌙',
  'peaceful': '🕊️',
  'anxious': '😰',
  'grateful': '🙏',
  'creative': '✨',
  'nostalgic': '📷',
  'hopeful': '🌟',
  'contemplative': '💭',
};

// Use imported modular components
const StyledTypeLabel = StyledTypeLabelComponent;
const SoundBars = SoundBarsComponent;

function PostCardComponent({
  post,
  onPostDeleted,
  canModerateDelete,
  onModeratorDelete,
  onPin,
  onUnpin,
  isPinned,
  disableRealtimeSubscriptions = false,
}: {
  post: PostProps;
  onPostDeleted?: (postId: string) => void;
  canModerateDelete?: boolean;
  onModeratorDelete?: (postId: string, reason?: string) => Promise<void>;
  onPin?: (postId: string) => void;
  onUnpin?: (postId: string) => void;
  isPinned?: boolean;
  /** PERFORMANCE: Disable per-card real-time subscriptions when used in feed context */
  disableRealtimeSubscriptions?: boolean;
}) {
  const router = useRouter();
  const { openPostModal, subscribeToUpdates, notifyUpdate } = useModal();
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { toggle: toggleAdmire } = useToggleAdmire();
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();
  const { react: toggleReaction, removeReaction } = useToggleReaction();

  const initialReactionTotal = Math.max(
    0,
    post.stats?.reactions ?? post.stats?.admires ?? 0
  );
  const initialReactionCounts = useMemo<ReactionCounts>(
    () => ({
      admire: initialReactionTotal,
      snap: 0,
      ovation: 0,
      support: 0,
      inspired: 0,
      applaud: 0,
      total: initialReactionTotal,
    }),
    [initialReactionTotal]
  );

  // Real-time reaction hooks - disabled in feed context to reduce subscription count
  const { counts: reactionCounts, refetch: refetchReactionCounts } = useReactionCounts(post.id, {
    disableRealtime: disableRealtimeSubscriptions,
    skipInitialFetch: disableRealtimeSubscriptions,
    initialCounts: initialReactionCounts,
  });
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post.id, user?.id, {
    disableRealtime: disableRealtimeSubscriptions,
    skipInitialFetch: disableRealtimeSubscriptions,
    initialReaction: post.reactionType ?? null,
  });

  const [isAdmired, setIsAdmired] = useState(post.isAdmired || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isRelayed, setIsRelayed] = useState(post.isRelayed || false);
  const [admireCount, setAdmireCount] = useState(post.stats?.admires ?? 0);
  const [relayCount, setRelayCount] = useState(post.stats?.relays ?? 0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showContent, setShowContent] = useState(!post.contentWarning);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showSendToDMModal, setShowSendToDMModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModeratorDeleteConfirm, setShowModeratorDeleteConfirm] = useState(false);
  const [moderatorDeleting, setModeratorDeleting] = useState(false);
  const [moderatorDeleteReason, setModeratorDeleteReason] = useState("");
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const { blockUser } = useBlock();
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOwner = user && user.id === post.authorId;

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current);
      }
    };
  }, []);

  // Track post views and impressions
  const viewTrackerRef = usePostViewTracker(post.id, post.authorId, "feed");
  useTrackPostImpression(post.id, "feed");

  const hasMedia = post.media && post.media.length > 0;
  const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;

  // Subscribe to updates from modal (reactions are handled by real-time hooks)
  useEffect(() => {
    const unsubscribe = subscribeToUpdates((update) => {
      if (update.postId !== post.id) return;

      if (update.field === "admires") {
        setIsAdmired(update.isActive);
        setAdmireCount((prev) => Math.max(0, prev + update.countChange));
      } else if (update.field === "reactions") {
        // Reactions are now handled by real-time hooks (useUserReaction, useReactionCounts)
        // This is kept for modal sync - optimistic updates from modal
        setUserReaction((update.reactionType as ReactionType) || null);
      } else if (update.field === "relays") {
        setIsRelayed(update.isActive);
        setRelayCount((prev) => Math.max(0, prev + update.countChange));
      } else if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });

    return unsubscribe;
  }, [post.id, subscribeToUpdates, setUserReaction]);

  // Open post modal - memoized to prevent re-creation
  const handleOpenModal = useCallback(() => {
    // Map mentions to flat user objects for the modal
    const mappedMentions = (post.mentions || [])
      .map(m => m.user)
      .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined);

    openPostModal({
      ...post,
      isAdmired,
      isSaved,
      isRelayed,
      stats: {
        admires: admireCount,
        comments: post.stats?.comments ?? 0,
        relays: relayCount,
      },
      mentions: mappedMentions,
      hashtags: post.hashtags || [],
      collaborators: post.collaborators || [],
    });
  }, [post, isAdmired, isSaved, isRelayed, admireCount, relayCount, openPostModal]);

  const handleAdmire = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsAdmired = !isAdmired;
    const countChange = newIsAdmired ? 1 : -1;

    // Optimistic update
    setIsAdmired(newIsAdmired);
    setAdmireCount((prev) => Math.max(0, prev + countChange));

    notifyUpdate({
      postId: post.id,
      field: "admires",
      isActive: newIsAdmired,
      countChange,
    });

    try {
      await toggleAdmire(post.id, user.id, isAdmired);

      if (newIsAdmired) {
        await createNotification(post.authorId, user.id, 'admire', post.id);
      }
    } catch {
      // Revert on error
      setIsAdmired(!newIsAdmired);
      setAdmireCount((prev) => Math.max(0, prev - countChange));
      actionToast.reactionError();
    }
  }, [user, openAuthModal, isAdmired, post.id, post.authorId, notifyUpdate, toggleAdmire]);

  // Handle reaction (new reaction system with real-time) - memoized
  const handleReaction = useCallback(async (reactionType: ReactionType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const wasReacted = userReaction !== null;
    const isSameReaction = userReaction === reactionType;
    const previousReaction = userReaction;

    // Optimistic update for immediate feedback
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Notify modal of changes (before try-catch for immediate feedback)
    notifyUpdate({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (wasReacted ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });

    try {
      // Perform database update (real-time subscription will update counts)
      await toggleReaction(post.id, user.id, reactionType, userReaction);

      // Send notification for new reactions (not removals or changes)
      if (!wasReacted && !isSameReaction) {
        await createNotification(post.authorId, user.id, reactionType, post.id);
      }

      if (disableRealtimeSubscriptions) {
        await refetchReactionCounts();
      }
    } catch {
      // Revert on error
      setUserReaction(previousReaction);
      actionToast.reactionError();
    }
  }, [user, openAuthModal, userReaction, post.id, post.authorId, notifyUpdate, toggleReaction, setUserReaction, disableRealtimeSubscriptions, refetchReactionCounts]);

  const handleRemoveReaction = useCallback(async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    const previousReaction = userReaction;

    // Optimistic update
    setUserReaction(null);

    // Notify modal
    notifyUpdate({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });

    try {
      // Perform database update (real-time subscription will update counts)
      await removeReaction(post.id, user.id);
      if (disableRealtimeSubscriptions) {
        await refetchReactionCounts();
      }
    } catch {
      // Revert on error
      setUserReaction(previousReaction);
      actionToast.reactionError();
    }
  }, [user, openAuthModal, userReaction, post.id, notifyUpdate, removeReaction, setUserReaction, disableRealtimeSubscriptions, refetchReactionCounts]);

  const handleSave = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    notifyUpdate({
      postId: post.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

    try {
      await toggleSave(post.id, user.id, isSaved);

      // Show toast feedback
      if (newIsSaved) {
        actionToast.postSaved();
      } else {
        actionToast.postUnsaved();
      }

      // Create notification when saving (not when unsaving)
      if (newIsSaved && post.authorId !== user.id) {
        await createNotification(post.authorId, user.id, 'save', post.id);
      }
    } catch {
      // Revert on error
      setIsSaved(!newIsSaved);
      actionToast.genericError("save post");
    }
  }, [user, openAuthModal, isSaved, post.id, post.authorId, notifyUpdate, toggleSave]);

  const handleRelay = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }
    // Can't relay your own posts
    if (user.id === post.authorId) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    setIsRelayed(newIsRelayed);
    setRelayCount((prev) => Math.max(0, prev + countChange));

    notifyUpdate({
      postId: post.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

    try {
      await toggleRelay(post.id, user.id, isRelayed);

      // Show toast feedback
      if (newIsRelayed) {
        actionToast.postRelayed();
      } else {
        actionToast.postUnrelayed();
      }

      if (newIsRelayed) {
        await createNotification(post.authorId, user.id, 'relay', post.id);
      }
    } catch {
      // Revert on error
      setIsRelayed(!newIsRelayed);
      setRelayCount((prev) => Math.max(0, prev - countChange));
      actionToast.genericError("relay post");
    }
  }, [user, openAuthModal, isRelayed, post.id, post.authorId, notifyUpdate, toggleRelay]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await deleteOwnPost(post.id);

      setShowDeleteConfirm(false);
      actionToast.postDeleted();
      // Notify parent to remove post from list
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      actionToast.postDeleteError();
      setDeleting(false);
    }
  }, [post.id, onPostDeleted]);

  // Moderator delete handler - uses the community moderation system
  const handleModeratorDelete = useCallback(async () => {
    if (!onModeratorDelete) return;
    setModeratorDeleting(true);
    try {
      await onModeratorDelete(post.id, moderatorDeleteReason.trim() || undefined);
      setShowModeratorDeleteConfirm(false);
      setModeratorDeleteReason("");
      actionToast.postDeleted();
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post as moderator:", err);
      actionToast.postDeleteError();
    } finally {
      setModeratorDeleting(false);
    }
  }, [post.id, moderatorDeleteReason, onModeratorDelete, onPostDeleted]);

  const handleEdit = useCallback(() => {
    router.push(`/create?edit=${post.id}`);
  }, [router, post.id]);

  const handleReport = useCallback(async (reason: string, details?: string) => {
    if (!user) return;

    setReportSubmitting(true);
    try {
      // Build report data with required columns
      const reportData: Record<string, unknown> = {
        reported_post_id: post.id,
        reported_user_id: post.authorId,
        reporter_id: user.id,
        reason: details ? `${reason}: ${details}` : reason,
        type: "post",
      };

      // Add community_id if post belongs to a community (for mod queue filtering)
      if (post.community) {
        const { data: postData } = await supabase
          .from("posts")
          .select("community_id")
          .eq("id", post.id)
          .single();
        if (postData?.community_id) {
          reportData.community_id = postData.community_id;
        }
      }

      const { error } = await supabase.from("reports").insert(reportData);

      if (error) {
        console.error("Error submitting report:", error);
        actionToast.reportError();
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      actionToast.reportSubmitted();
      reportTimeoutRef.current = setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
      actionToast.reportError();
    }
    setReportSubmitting(false);
  }, [user, post.id, post.authorId, post.community]);

  const handleBlockUser = useCallback(async () => {
    if (!user) return;

    setBlockLoading(true);
    const result = await blockUser(user.id, post.authorId);
    if (result.success) {
      setShowBlockConfirm(false);
      actionToast.userBlocked(post.author.handle);
      // Remove post from view by calling onPostDeleted if available
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } else {
      actionToast.blockError();
    }
    setBlockLoading(false);
  }, [user, blockUser, post.authorId, post.author.handle, post.id, onPostDeleted]);

  // Mentions and hashtags from post data (passed to extracted components)

  // Actions component reused across post types (now includes mentions and hashtags display)
  const Actions = () => (
    <div className="actions-wrapper">
      {post.mentions && post.mentions.length > 0 && (
        <MentionsDisplay mentions={post.mentions} />
      )}
      {post.hashtags && post.hashtags.length > 0 && (
        <HashtagsDisplay hashtags={post.hashtags} />
      )}
      <div className="actions" role="toolbar" aria-label="Post actions">
        <div className="actions-left">
        {/* Reaction Picker with real-time counts */}
        <ReactionPicker
          currentReaction={userReaction}
          reactionCounts={reactionCounts}
          onReact={handleReaction}
          onRemoveReaction={handleRemoveReaction}
        />
        <button className="action-btn" aria-label={`${post.stats?.comments ?? 0} comments`}>
          <CommentIcon />
          <span className="action-count">{post.stats?.comments ?? 0}</span>
        </button>
        {(!user || user.id !== post.authorId) && (
          <button
            className={`action-btn ${isRelayed ? 'active' : ''}`}
            onClick={handleRelay}
            style={isRelayed ? { color: '#22c55e' } : undefined}
            aria-label={isRelayed ? `Remove relay, ${relayCount} relays` : `Relay post, ${relayCount} relays`}
            aria-pressed={isRelayed}
          >
            <RelayIcon />
            <span className="action-count">{relayCount}</span>
          </button>
        )}
      </div>
      <div className="actions-right">
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }} aria-label="Share post">
          <ShareIcon />
        </button>
        <button
          className={`action-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          aria-label={isSaved ? "Remove from saved" : "Save post"}
          aria-pressed={isSaved}
        >
          <BookmarkIcon filled={isSaved} />
        </button>
      </div>
      </div>
    </div>
  );

  // Get accepted collaborators - memoized to prevent recalculation on every render
  const acceptedCollaborators = useMemo(() =>
    (post.collaborators || []).filter(c => c.status === 'accepted'),
    [post.collaborators]
  );
  const hasCollaborators = acceptedCollaborators.length > 0;
  const hasCommunity = !!post.community;
  const postMenuItems = useMemo(() => {
    const items: ActionMenuItem[] = [];

    if (isPinned && onUnpin) {
      items.push({
        label: "Unpin",
        onSelect: () => onUnpin(post.id),
        icon: (
          <svg
            className="w-4 h-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ),
        dividerBefore: false,
      });
    } else if (!isPinned && onPin) {
      items.push({
        label: "Pin",
        onSelect: () => onPin(post.id),
        icon: (
          <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
          </svg>
        ),
        tone: "accent" as const,
      });
    }

    if (isOwner) {
      items.push({
        label: "Edit",
        onSelect: handleEdit,
        icon: <EditIcon aria-hidden="true" />,
        dividerBefore: items.length > 0,
      });
      items.push({
        label: "Delete",
        onSelect: () => setShowDeleteConfirm(true),
        icon: <TrashIcon aria-hidden="true" />,
        tone: "danger" as const,
      });
      if (canModerateDelete && onModeratorDelete) {
        items.push({
          label: "Delete (Mod)",
          onSelect: () => setShowModeratorDeleteConfirm(true),
          icon: <TrashIcon aria-hidden="true" />,
          tone: "warning" as const,
          dividerBefore: true,
        });
      }
      return items;
    }

    if (!user) return items;

    items.push({
      label: `Block @${post.author.handle.replace("@", "")}`,
      onSelect: () => setShowBlockConfirm(true),
      icon: <BlockIcon aria-hidden="true" />,
      dividerBefore: items.length > 0,
    });

    if (canModerateDelete && onModeratorDelete) {
      items.push({
        label: "Delete (Mod)",
        onSelect: () => setShowModeratorDeleteConfirm(true),
        icon: <TrashIcon aria-hidden="true" />,
        tone: "warning" as const,
        dividerBefore: true,
      });
    }

    items.push({
      label: "Report",
      onSelect: () => setShowReportModal(true),
      icon: <FlagIcon aria-hidden="true" />,
      tone: "danger" as const,
      dividerBefore: true,
    });

    return items;
  }, [
    canModerateDelete,
    handleEdit,
    isOwner,
    isPinned,
    onModeratorDelete,
    onPin,
    onUnpin,
    post.author.handle,
    post.id,
    user,
  ]);

  const postMenuElement = user ? (
    <ActionMenu
      items={postMenuItems}
      buttonClassName="post-menu-btn"
      widthClassName={(onPin || onUnpin || (canModerateDelete && onModeratorDelete)) ? "w-44" : "w-36"}
      buttonAriaLabel="Post options menu"
      portal
    />
  ) : null;

  // Author Header component - Reddit-style for community posts
  const AuthorHeader = ({ small = false, centered = false }: { small?: boolean; centered?: boolean }) => {
    // Reddit-style: Community posts show community first, author as secondary
    if (hasCommunity) {
      return (
        <div className="author-header" style={centered ? { justifyContent: 'center' } : undefined}>
          {/* Community Avatar */}
          <Link
            href={`/community/${post.community!.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="flex-shrink-0"
          >
            {post.community!.avatar_url ? (
              <Image
                src={post.community!.avatar_url}
                alt={post.community!.name}
                width={70}
                height={70}
                className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover border border-black/[0.06] hover:border-purple-primary/30 transition-colors"
                sizes="44px"
                quality={80}
              />
            ) : (
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center border border-black/[0.06]">
                <span className="font-ui text-sm font-semibold text-white">
                  {post.community!.name.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
          </Link>

          <div className="author-info" style={centered ? { textAlign: 'left' } : undefined}>
            {/* Primary line: Community name + Posted by author */}
            <div className="author-name-line">
              <Link
                href={`/community/${post.community!.slug}`}
                onClick={(e) => e.stopPropagation()}
                className="author-name font-semibold hover:text-purple-primary transition-colors"
              >
                {post.community!.name}
              </Link>
              <span className="post-time-separator">·</span>
              <span className="posted-by-label">Posted by</span>
              <Link
                href={`/studio/${post.author.handle.replace('@', '')}`}
                onClick={(e) => e.stopPropagation()}
                className="posted-by-author"
              >
                @{post.author.handle.replace('@', '')}
              </Link>
              {hasCollaborators && (
                <>
                  <span className="collab-separator">&</span>
                  {acceptedCollaborators.length === 1 ? (
                    <Link
                      href={`/studio/${acceptedCollaborators[0].user.username}`}
                      onClick={(e) => e.stopPropagation()}
                      className="posted-by-author"
                    >
                      @{acceptedCollaborators[0].user.username}
                    </Link>
                  ) : (
                    <span className="collab-count">{acceptedCollaborators.length} others</span>
                  )}
                </>
              )}
            </div>

            {/* Secondary line: Time + Flair */}
            <div className="post-meta-line community-post-meta">
              <span className="post-time">{post.timeAgo}</span>
              {post.flair && (
                <>
                  <span className="post-time-separator">·</span>
                  <FlairBadge flair={post.flair} size="sm" />
                </>
              )}
            </div>
          </div>
          {postMenuElement}
        </div>
      );
    }

    // Standard author-first layout for non-community posts
    return (
      <div className="author-header" style={centered ? { justifyContent: 'center' } : undefined}>
        {/* Avatar Stack for Collaborators */}
        {hasCollaborators ? (
          <div className="collab-avatars group" onClick={(e) => e.stopPropagation()}>
            {/* Author Avatar */}
            <Link href={`/studio/${post.author.handle.replace('@', '')}`}>
              <div className="collab-avatar first" style={small ? { width: '36px', height: '36px' } : undefined}>
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  fill
                  className="object-cover rounded-full"
                  sizes="44px"
                  quality={80}
                />
              </div>
            </Link>
            {/* Collaborator Avatars */}
            {acceptedCollaborators.slice(0, 3).map((collab, index) => (
              <Link
                key={collab.user.id}
                href={`/studio/${collab.user.username}`}
                className="collab-avatar-link"
                style={{ zIndex: 10 - index }}
              >
                {collab.user.avatar_url ? (
                  <div className="collab-avatar" style={small ? { width: '36px', height: '36px' } : undefined}>
                    <Image
                      src={collab.user.avatar_url}
                      alt={collab.user.display_name || collab.user.username}
                      fill
                      className="object-cover rounded-full"
                      sizes="44px"
                      quality={80}
                    />
                  </div>
                ) : (
                  <div
                    className="collab-avatar collab-avatar-placeholder"
                    style={small ? { width: '36px', height: '36px' } : undefined}
                  >
                    {(collab.user.display_name || collab.user.username)[0].toUpperCase()}
                  </div>
                )}
              </Link>
            ))}
            {acceptedCollaborators.length > 3 && (
              <div className="collab-avatar collab-avatar-more" style={small ? { width: '36px', height: '36px' } : undefined}>
                +{acceptedCollaborators.length - 3}
              </div>
            )}
          </div>
        ) : (
          <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={(e) => e.stopPropagation()}>
            <div className="author-avatar" style={small ? { width: '36px', height: '36px' } : undefined}>
              <Image
                src={post.author.avatar}
                alt={post.author.name}
                fill
                className="object-cover"
                sizes="48px"
                quality={80}
              />
            </div>
          </Link>
        )}
        <div className="author-info" style={centered ? { textAlign: 'left' } : undefined}>
          <div className="author-name-line">
            {hasCollaborators ? (
              <>
                <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={(e) => e.stopPropagation()} className="author-name">
                  {post.author.name}
                </Link>
                <span className="collab-separator">&</span>
                {acceptedCollaborators.length === 1 ? (
                  <Link href={`/studio/${acceptedCollaborators[0].user.username}`} onClick={(e) => e.stopPropagation()} className="author-name">
                    {acceptedCollaborators[0].user.display_name || acceptedCollaborators[0].user.username}
                  </Link>
                ) : (
                  <span className="collab-count">{acceptedCollaborators.length} others</span>
                )}
                <span className="collab-label">collaborated</span>
              </>
            ) : (
              <>
                <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={(e) => e.stopPropagation()} className="author-name">
                  {post.author.name}
                </Link>
                <span className="post-type-label">
                  <StyledTypeLabel type={post.type} />
                </span>
              </>
            )}
          </div>
          <div className="post-meta-line">
            {hasCollaborators && (
              <span className="post-type-label">
                <StyledTypeLabel type={post.type} />
              </span>
            )}
            <span className="post-time">{post.timeAgo}</span>
          </div>
        </div>
        {postMenuElement}
      </div>
    );
  };

  // Content Section wrapper - applies blur and warning overlay only to content, not header/actions
  const ContentSection = ({ children }: { children: React.ReactNode }) => {
    const hasWarning = post.contentWarning && !showContent;

    if (!hasWarning) {
      return <>{children}</>;
    }

    return (
      <div className="relative min-h-[80px]">
        <div className="blur-md select-none pointer-events-none opacity-60">
          {children}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-2">
            <svg className="w-3.5 h-3.5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span className="font-ui text-xs font-medium text-amber-700">{post.contentWarning}</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowContent(true);
            }}
            className="px-4 py-1.5 rounded-full font-ui text-xs font-medium text-ink/70 hover:text-ink bg-black/5 hover:bg-black/10 transition-colors"
          >
            Show Content
          </button>
        </div>
      </div>
    );
  };

  // Unified render function for all post types
  // Format: Title → First 20 words → Images (square) → Continue reading
  const renderPost = () => {
    // Audio post - special layout
    if (post.type === "audio") {
      return (
        <article className="post type-audio" onClick={handleOpenModal}>
          <div className="audio-visual" onClick={(e) => e.stopPropagation()}>
            <SoundBars />
          </div>
          <div className="audio-content">
            <AuthorHeader small />
            <ContentSection>
              <div className="audio-title">Voice Note</div>
              <div className="audio-author">&quot;{post.title}&quot;</div>
            </ContentSection>
            <Actions />
          </div>
        </article>
      );
    }

    // Video post - special layout
    if (post.type === "video") {
      return (
        <article className="post type-video" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            <div className="video-container" onClick={(e) => e.stopPropagation()}>
              <Image src={post.image || "/video-placeholder.svg"} alt={post.title || "Video thumbnail"} width={640} height={360} className="video-thumbnail" style={{ width: '100%', height: 'auto' }} sizes="(max-width: 640px) 90vw, 500px" quality={75} loading="lazy" />
              <div className="video-play-btn">
                <span style={{ color: 'var(--primary-purple)', marginLeft: '4px' }}><PlayIcon /></span>
              </div>
              {post.videoDuration && <span className="video-duration">{post.videoDuration}</span>}
            </div>
            {post.title && <h3 className="video-title">{post.title}</h3>}
            {post.content && (
              <TruncatedContent
                content={post.content}
                onReadMore={handleOpenModal}
              />
            )}
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // UNIFIED LAYOUT for all other post types
    // Format: Title → First 250 chars → Images (square) → Continue reading
    const hasCreativeBackground = Boolean(post.styling?.background);
    const hasDarkCreativeBackground = isDarkBackground(post.styling?.background);
    const creativeTextClass = hasDarkCreativeBackground ? "text-white" : "";
    const alignmentClass = {
      left: "text-left",
      center: "text-center",
      right: "text-right",
      justify: "text-justify",
    }[post.styling?.textAlignment || "left"];
    const lineSpacingClass = {
      normal: "leading-relaxed",
      relaxed: "leading-[2]",
      loose: "leading-[2.5]",
    }[post.styling?.lineSpacing || "normal"];

    return (
      <article className="post type-unified" onClick={handleOpenModal}>
        <AuthorHeader />
        <ContentSection>
          <div
            className={hasCreativeBackground ? "relative rounded-xl overflow-hidden p-4 md:p-5" : undefined}
            style={hasCreativeBackground ? getBackgroundPreviewStyle(post.styling?.background) : undefined}
          >
            {post.styling?.background?.type === "image" && (
              <div className="absolute inset-0 bg-black/30" />
            )}
            <div className={hasCreativeBackground ? "relative z-10" : undefined}>
              {/* 1. Title */}
              {post.title && (
                <h3 className={`unified-post-title ${creativeTextClass} ${alignmentClass}`}>
                  {post.title}
                </h3>
              )}

              {/* 2. First 250 chars with Continue reading */}
              {post.content && (
                <TruncatedContent
                  content={post.content}
                  onReadMore={handleOpenModal}
                  className={`${creativeTextClass} ${alignmentClass} ${lineSpacingClass} ${post.styling?.dropCap ? "drop-cap-enabled" : ""}`}
                />
              )}

              {/* Spotify Track Indicator */}
              {post.spotify_track && (
                <div className="flex items-center gap-2 mt-3 mb-1 px-1">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20">
                    <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    <span className="font-ui text-xs text-[#1DB954] font-medium truncate max-w-[180px]">
                      {post.spotify_track.name}
                    </span>
                    <span className="font-ui text-xs text-[#1DB954]/60 hidden sm:inline">
                      · {post.spotify_track.artist}
                    </span>
                  </div>
                </div>
              )}

              {/* 3. Images as squares */}
              {hasMedia && (
                <div className="unified-media-grid" onClick={(e) => e.stopPropagation()}>
                  {post.media!.slice(0, 4).map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className={`unified-media-item ${post.media!.length === 1 ? 'single' : ''} ${post.media!.length === 2 ? 'double' : ''} ${post.media!.length === 3 && idx === 0 ? 'featured' : ''}`}
                    >
                      {item.media_type === "video" ? (
                        <div className="unified-video-thumb">
                          <video
                            src={item.media_url}
                            className="unified-media-image"
                            preload="metadata"
                            aria-label={item.caption || `Video ${idx + 1} in post by ${post.author.name}`}
                          />
                          <div className="unified-video-play" aria-hidden="true">
                            <PlayIcon />
                          </div>
                        </div>
                      ) : (
                        <Image
                          src={item.media_url}
                          alt={item.caption || `Image ${idx + 1} in post by ${post.author.name}`}
                          width={400}
                          height={400}
                          className="unified-media-image"
                          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 200px, 180px"
                          quality={75}
                          loading="lazy"
                        />
                      )}
                      {/* Show +N overlay on the last visible image if more than 4 */}
                      {idx === 3 && post.media!.length > 4 && (
                        <div className="unified-media-more">
                          +{post.media!.length - 4}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Legacy single image support */}
              {!hasMedia && post.image && (
                <div className="unified-media-grid single-legacy" onClick={(e) => e.stopPropagation()}>
                  <div className="unified-media-item single">
                    <Image
                      src={post.image}
                      alt={post.title || ""}
                      width={400}
                      height={400}
                      className="unified-media-image"
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 400px, 360px"
                      quality={75}
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </ContentSection>
        <Actions />
      </article>
    );
  };

  return (
    <>
      <div ref={viewTrackerRef}>
        {renderPost()}
      </div>
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 150)}
        description={post.content}
        type={post.type}
        authorName={post.author.name}
        authorUsername={post.author.handle}
        authorAvatar={post.author.avatar}
        imageUrl={post.media && post.media.length > 0 ? post.media[0].media_url : ""}
        onSendToDM={user ? () => setShowSendToDMModal(true) : undefined}
      />

      {/* Send to DM Modal */}
      {user && (
        <SendToDMModal
          isOpen={showSendToDMModal}
          onClose={() => setShowSendToDMModal(false)}
          post={{
            id: post.id,
            author_id: post.authorId,
            type: post.type as PostType,
            title: post.title || null,
            content: post.content,
            visibility: "public",
            content_warning: post.contentWarning || null,
            created_at: post.createdAt || new Date().toISOString(),
            community_id: null,
            author: {
              id: post.authorId,
              username: post.author.handle.replace(/^@/, ''),
              display_name: post.author.name,
              avatar_url: post.author.avatar,
              is_verified: false,
            },
            media: post.media?.map(m => ({
              id: m.id,
              media_url: m.media_url,
              media_type: m.media_type,
              caption: m.caption,
              position: m.position,
            })) || [],
            admires_count: post.stats.admires,
            reactions_count: post.stats.reactions || 0,
            comments_count: post.stats.comments,
            relays_count: post.stats.relays,
            user_has_admired: post.isAdmired || false,
            user_reaction_type: post.reactionType || null,
            user_has_saved: post.isSaved || false,
            user_has_relayed: post.isRelayed || false,
          }}
          currentUserId={user.id}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDelete}
        title="Delete Post?"
        description="This action cannot be undone. This will permanently delete your post and remove all associated data including comments, admires, and saves."
        confirmText="Delete"
        isDanger
        loading={deleting}
      />

      {/* Moderator Delete Confirmation Modal */}
      {showModeratorDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !moderatorDeleting && setShowModeratorDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-2xl shadow-2xl z-[1001] overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 border-b border-orange-200/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <TrashIcon className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-semibold text-ink">Delete Post (Moderator)</h3>
                  <p className="font-ui text-xs text-muted">This action will be logged</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <p className="font-body text-sm text-muted mb-4">
                You are about to delete this post as a community moderator. This action cannot be undone and will be recorded in the moderation log.
              </p>
              <div className="mb-4">
                <label className="block font-ui text-sm font-medium text-ink mb-2">
                  Reason for deletion <span className="text-muted font-normal">(optional)</span>
                </label>
                <textarea
                  value={moderatorDeleteReason}
                  onChange={(e) => setModeratorDeleteReason(e.target.value)}
                  placeholder="e.g., Violates community guidelines..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-black/10 bg-white font-body text-sm placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400 resize-none"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowModeratorDeleteConfirm(false);
                    setModeratorDeleteReason("");
                  }}
                  disabled={moderatorDeleting}
                  className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleModeratorDelete}
                  disabled={moderatorDeleting}
                  className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {moderatorDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Post"
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReport}
          submitting={reportSubmitting}
          submitted={reportSubmitted}
        />
      )}

      {/* Block Confirmation Modal */}
      {showBlockConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
            <h3 className="font-display text-xl text-ink mb-3">
              Block @{post.author.handle.replace('@', '')}?
            </h3>
            <p className="font-body text-sm text-muted mb-6">
              You won&apos;t see their posts anymore. They won&apos;t be able to see your posts, follow you, or message you.
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
                onClick={handleBlockUser}
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
    </>
  );
}

// Memoize component to prevent unnecessary re-renders when parent updates
const PostCard = memo(PostCardComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific props change
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.stats?.admires === nextProps.post.stats?.admires &&
    prevProps.post.stats?.reactions === nextProps.post.stats?.reactions &&
    prevProps.post.stats?.comments === nextProps.post.stats?.comments &&
    prevProps.post.stats?.relays === nextProps.post.stats?.relays &&
    prevProps.post.isAdmired === nextProps.post.isAdmired &&
    prevProps.post.isSaved === nextProps.post.isSaved &&
    prevProps.post.isRelayed === nextProps.post.isRelayed &&
    prevProps.post.reactionType === nextProps.post.reactionType &&
    prevProps.canModerateDelete === nextProps.canModerateDelete &&
    !!prevProps.onModeratorDelete === !!nextProps.onModeratorDelete &&
    prevProps.isPinned === nextProps.isPinned &&
    !!prevProps.onPin === !!nextProps.onPin &&
    !!prevProps.onUnpin === !!nextProps.onUnpin &&
    prevProps.disableRealtimeSubscriptions === nextProps.disableRealtimeSubscriptions
  );
});

export default PostCard;
