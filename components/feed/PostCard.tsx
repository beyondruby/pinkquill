"use client";

import "./post-card.css";

import { useState, useEffect, useRef, useCallback, memo, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useModal } from "@/components/providers/ModalProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { removeSelfAsCollaborator } from "@/lib/hooks.legacy";
import { useToggleSave, useToggleRelay, useBlock } from "@/lib/hooks/useInteractions";
import { useReaction } from "@/lib/engagement/reactions";
import type { ReactionType } from "@/lib/types";
import { usePostViewTracker, useTrackPostImpression } from "@/lib/hooks/useTracking";

const ShareModal = dynamic(() => import("@/components/ui/ShareModal"), { ssr: false });
const ReportModal = dynamic(() => import("@/components/ui/ReportModal"), { ssr: false });
const SendToDMModal = dynamic(() => import("@/components/messages/SendToDMModal"), { ssr: false });
import ConfirmationModal from "@/components/ui/ConfirmationModal";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import CommunityBadge from "@/components/communities/CommunityBadge";
import FlairBadge from "@/components/communities/FlairBadge";
import CommentCount from "@/components/feed/CommentCount";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { AudioPlayer } from "@/components/feed/AudioPlayer";
import { supabase } from "@/lib/supabase";
import { submitReport } from "@/lib/reports";
import { getTimeAgoWords } from "@/lib/utils/time";
import { PostTypeChip } from "@/components/feed/PostTypeChip";
import { getPostTypeCollabPhrase } from "@/lib/feed-view/post-type-theme";
import { PostType } from "@/lib/types";
import { deleteOwnPost } from "@/lib/content-client";
import { actionToast, showToast } from "@/lib/utils/toast";
import {
  MentionsDisplay,
  HashtagsDisplay,
  SoundBars as SoundBarsComponent,
  TruncatedContent as TruncatedContentComponent,
  BlockConfirmModal,
  type MentionInfo,
} from "./PostCard/index";
import {
  ShareIcon,
  TrashIcon,
  EditIcon,
  FlagIcon,
  BlockIcon,
} from "@/components/ui/Icons";

// TruncatedContent imported from ./PostCard/TruncatedContent
const TruncatedContent = TruncatedContentComponent;

// Types imported from ./PostCard/types
import type { PostProps } from "./PostCard/types";
import { FormBody, JournalStrip } from "./PostCard/FormBody";
import { MediaCarousel } from "./PostCard/MediaCarousel";
import { VideoPlayer } from "./VideoPlayer";
import { CommentGlyph, RelayGlyph, ShareGlyph, BookmarkGlyph, PlayGlyph } from "./PostCard/ActionIcons";
import { stripHtml } from "@/lib/utils/sanitize";
import { getPostTypeTheme } from "@/lib/feed-view/post-type-theme";

// Use imported modular components
const SoundBars = SoundBarsComponent;

function PostCardComponent({
  post,
  onPostDeleted,
  canModerateDelete,
  onModeratorDelete,
  onPin,
  onUnpin,
  isPinned,
  readOnly = false,
}: {
  post: PostProps;
  onPostDeleted?: (postId: string) => void;
  canModerateDelete?: boolean;
  onModeratorDelete?: (postId: string, reason?: string) => Promise<void>;
  onPin?: (postId: string) => void;
  onUnpin?: (postId: string) => void;
  isPinned?: boolean;
  /** When true, disables commenting/interactions (e.g. muted community members) */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const { openPostModal, subscribeToUpdates, notifyUpdate } = useModal();
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();

  // Reactions: one shared entry per post (lib/engagement), seeded from the
  // list row. Every other surface showing this post reads the same entry.
  const reaction = useReaction("post", post.id, {
    seed: { total: post.stats?.reactions, counts: post.stats?.reactionCounts, mine: post.reactionType, comments: post.stats?.comments },
    authorId: post.authorId,
  });

  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isRelayed, setIsRelayed] = useState(post.isRelayed || false);
  const [relayCount, setRelayCount] = useState(post.stats?.relays ?? 0);
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
  const [showRemoveCollabConfirm, setShowRemoveCollabConfirm] = useState(false);
  const [removingCollab, setRemovingCollab] = useState(false);

  const { blockUser } = useBlock();
  const reportTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isOwner = user && user.id === post.authorId;
  const isAcceptedCollaborator = useMemo(() => {
    if (!user || !post.collaborators?.length) return false;
    if (user.id === post.authorId) return false;
    return post.collaborators.some(
      (c) => c.user?.id === user.id && c.status === "accepted"
    );
  }, [user, post.collaborators, post.authorId]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (reportTimeoutRef.current) {
        clearTimeout(reportTimeoutRef.current);
      }
    };
  }, []);

  // Track post views and impressions
  const viewTrackerRef = usePostViewTracker(post.id, "feed");
  useTrackPostImpression(post.id, "feed");

  // Audio (Sound/Voice formats) renders as a player; visual media keeps the grid.
  const audioMedia = post.media?.find((m) => m.media_type === "audio") || null;
  const visualMedia = (post.media || []).filter((m) => m.media_type !== "audio");
  const hasMedia = visualMedia.length > 0;
  const isVoicePost = (post.type as string) === "voice";
  const videoMedia = visualMedia.find((item) => item.media_type === "video");
  const audioCover = visualMedia.find((m) => m.media_type === "image")?.media_url || null;
  const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${post.id}` : `/post/${post.id}`;

  // Subscribe to save/relay updates from the modal (reactions live in the store)
  useEffect(() => {
    const unsubscribe = subscribeToUpdates((update) => {
      if (update.postId !== post.id) return;

      if (update.field === "relays") {
        setIsRelayed(update.isActive);
        setRelayCount((prev) => Math.max(0, prev + update.countChange));
      } else if (update.field === "saves") {
        setIsSaved(update.isActive);
      }
    });

    return unsubscribe;
  }, [post.id, subscribeToUpdates]);

  // Open post modal - memoized to prevent re-creation
  const handleOpenModal = useCallback(() => {
    // Map mentions to flat user objects for the modal
    const mappedMentions = (post.mentions || [])
      .map(m => m.user)
      .filter((u): u is NonNullable<typeof u> => u !== null && u !== undefined);

    openPostModal({
      ...post,
      isSaved,
      isRelayed,
      reactionType: reaction.mine,
      stats: {
        reactions: reaction.counts.total,
        reactionCounts: reaction.countsLoaded ? reaction.counts : undefined,
        comments: reaction.comments,
        relays: relayCount,
      },
      mentions: mappedMentions,
      hashtags: post.hashtags || [],
      collaborators: post.collaborators || [],
    });
  }, [post, isSaved, isRelayed, reaction.mine, reaction.counts.total, relayCount, openPostModal]);

  // Reaction handlers — the store does optimistic update, RPC, revert, toast
  // and the "new reaction" notification; the card only forwards intent.
  const handleReaction = useCallback(async (reactionType: ReactionType) => {
    if (readOnly) return;
    await reaction.react(reactionType);
  }, [readOnly, reaction]);

  const handleRemoveReaction = useCallback(async () => {
    if (readOnly) return;
    await reaction.unreact();
  }, [readOnly, reaction]);

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
      const ok = await submitReport(
        { type: "post", postId: post.id, reportedUserId: post.authorId, communityId: post.community ? undefined : null },
        user.id,
        reason,
        details,
      );

      if (!ok) {
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

  const handleRemoveSelfAsCollaborator = useCallback(async () => {
    if (!user || !isAcceptedCollaborator) return;

    setRemovingCollab(true);
    const result = await removeSelfAsCollaborator(post.id, user.id, post.authorId);
    if (result.success) {
      setShowRemoveCollabConfirm(false);
      showToast.success(
        "Removed from collaboration",
        "This post no longer appears on your profile."
      );
    } else {
      showToast.error(
        "Couldn't remove you from this post",
        "Please try again."
      );
    }
    setRemovingCollab(false);
  }, [user, isAcceptedCollaborator, post.id, post.authorId]);

  // Mentions and hashtags from post data (passed to extracted components)

  // Actions component reused across post types (now includes mentions and hashtags display)
  const renderActions = () => (
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
          kind="post"
          id={post.id}
          currentReaction={reaction.mine}
          reactionCounts={reaction.counts}
          countsLoaded={reaction.countsLoaded}
          onOpen={reaction.loadCounts}
          onReact={handleReaction}
          onRemoveReaction={handleRemoveReaction}
          disabled={readOnly}
        />
        <button className="action-btn" aria-label="Comments" onClick={readOnly ? undefined : handleOpenModal} disabled={readOnly} style={readOnly ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
          <CommentGlyph />
          <span className="action-count"><CommentCount id={post.id} total={post.stats?.comments} format={(n) => (n > 0 ? n.toLocaleString() : "")} /></span>
        </button>
        {(!user || user.id !== post.authorId) && (
          <button
            className={`action-btn ${isRelayed ? 'relayed' : ''}`}
            onClick={readOnly ? undefined : handleRelay}
            style={readOnly ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            aria-label={isRelayed ? `Remove relay, ${relayCount} relays` : `Relay post, ${relayCount} relays`}
            aria-pressed={isRelayed}
            disabled={readOnly}
          >
            <RelayGlyph />
            {relayCount > 0 && <span className="action-count">{relayCount.toLocaleString()}</span>}
          </button>
        )}
      </div>
      <div className="actions-right">
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }} aria-label="Share post">
          <ShareGlyph />
        </button>
        <button
          className={`action-btn ${isSaved ? 'saved' : ''}`}
          onClick={handleSave}
          aria-label={isSaved ? "Remove from saved" : "Save post"}
          aria-pressed={isSaved}
        >
          <BookmarkGlyph filled={isSaved} />
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
    const items: ActionMenuItem[] = [
      {
        label: "Share",
        onSelect: () => setShowShareModal(true),
        icon: <ShareIcon aria-hidden="true" />,
      },
      {
        label: "Copy link",
        onSelect: () => navigator.clipboard.writeText(`${window.location.origin}/post/${post.id}`),
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        ),
      },
    ];

    if (isPinned && onUnpin) {
      items.push({
        label: "Unpin",
        onSelect: () => onUnpin(post.id),
        sectionLabel: "Author",
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
        sectionLabel: "Author",
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

    if (isAcceptedCollaborator) {
      items.push({
        label: "Remove me as collaborator",
        onSelect: () => setShowRemoveCollabConfirm(true),
        sectionLabel: "Collaboration",
        dividerBefore: items.length > 0,
        tone: "warning" as const,
        icon: (
          <svg
            className="w-4 h-4"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M14 8a4 4 0 11-8 0 4 4 0 018 0zM2 20v-1a5 5 0 015-5h2a5 5 0 015 5v1M16 11h6" />
          </svg>
        ),
      });
    }

    items.push({
      label: `Block @${post.author.handle.replace("@", "")}`,
      onSelect: () => setShowBlockConfirm(true),
      icon: <BlockIcon aria-hidden="true" />,
      dividerBefore: items.length > 0,
      sectionLabel: "Safety",
      tone: "warning" as const,
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
    isAcceptedCollaborator,
    isPinned,
    onModeratorDelete,
    onPin,
    onUnpin,
    post.author.handle,
    post.id,
    setShowShareModal,
    user,
  ]);

  const postMenuElement = user ? (
    <ActionMenu
      items={postMenuItems}
      buttonClassName="post-menu-btn"
      widthClassName="w-48"
      buttonAriaLabel="Post options menu"
      portal
    />
  ) : null;

  // "2 hours ago" under the name; the list row's compact string is the fallback.
  const timeWords = post.createdAt ? getTimeAgoWords(post.createdAt) : post.timeAgo;

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
                className="w-10 h-10 md:w-11 md:h-11 rounded-full object-cover border border-border-light hover:border-accent/30 transition-colors"
                sizes="44px"
                quality={80}
              />
            ) : (
              <div className="w-10 h-10 md:w-11 md:h-11 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center border border-border-light">
                <span className="font-ui text-sm font-semibold text-on-accent">
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
                className="author-name font-semibold hover:text-accent transition-colors"
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
              {post.flair && (
                <FlairBadge flair={post.flair} size="sm" />
              )}
            </div>

            {/* Secondary line: what was posted, then when */}
            <div className="post-meta-line">
              <span className="post-type-label">
                <PostTypeChip type={post.type} variant="phrase" size="md" className="" />
              </span>
              <span className="post-time-separator">·</span>
              <span className="post-time">{timeWords}</span>
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
                <span className="post-type-label">{getPostTypeCollabPhrase(post.type)}</span>
              </>
            ) : (
              <>
                <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={(e) => e.stopPropagation()} className="author-name">
                  {post.author.name}
                </Link>
                <span className="post-type-label">
                  <PostTypeChip type={post.type} variant="phrase" size="md" className="" />
                </span>
              </>
            )}
          </div>
          <span className="post-time">{timeWords}</span>
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
            className="px-4 py-1.5 rounded-full font-ui text-xs font-medium text-ink/70 hover:text-ink bg-skeleton hover:bg-black/10 transition-colors"
          >
            Show Content
          </button>
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Render — one card shell, one header, one action row; each post type earns
  // its own body form (after the quill-v6 reference):
  //   thought  → a statement in the display serif
  //   journal  → date line with a hairline rule, title, muted excerpt
  //   visual   → title + description, then a caption carousel
  //   poem     → centred, italic, framed by faint quotation marks
  //   audio    → gradient banner with a live wave on the left, note on the right
  //   video    → poster + play, title and description below
  //   essay/blog/story/letter/quote → editorial forms from FormBody
  // ---------------------------------------------------------------------------
  const form = getPostTypeTheme(post.type).form;
  const plainContent = post.content ? stripHtml(post.content) : "";
  const isStatement =
    form === "text" && !post.title && !hasMedia && !post.image && !audioMedia && !post.spotify_track &&
    plainContent.length > 0 && plainContent.length <= 180;

  const renderPost = () => {
    // Audio — banner on the left, note on the right
    if (post.type === "audio") {
      const cover = audioCover || post.image || null;
      return (
        <article className={`post type-audio pq-feed-card pq-post-audio ${cover ? "has-cover" : ""}`} onClick={handleOpenModal}>
          <div className="audio-visual" aria-hidden="true">
            {showContent && cover && <Image src={cover} alt="" fill sizes="120px" className="audio-cover" />}
            <SoundBars />
          </div>
          <div className="audio-content">
            <AuthorHeader small />
            <ContentSection>
              <div className="audio-kind">{isVoicePost ? "Voice note" : "Sound"}{post.audioDuration ? ` · ${post.audioDuration}` : ""}</div>
              <h3 className="audio-author">{post.title || "Untitled recording"}</h3>
              {post.content && (
                <TruncatedContent content={post.content} maxChars={140} onReadMore={handleOpenModal} className="audio-note" />
              )}
              {audioMedia && showContent && (
                <div className="audio-feed-player" onClick={(e) => e.stopPropagation()}>
                  <AudioPlayer src={audioMedia.media_url} title={post.title} variant="voice" />
                </div>
              )}
            </ContentSection>
            {renderActions()}
          </div>
        </article>
      );
    }

    // Video — Pinkquill's own player (poster, play disc, gradient scrubber);
    // the clip is not fetched until the disc is tapped.
    if (post.type === "video") {
      const poster = post.image || null;
      return (
        <article className="post type-video pq-feed-card pq-post-video" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            <div className="video-container" onClick={(e) => e.stopPropagation()}>
              {videoMedia && showContent ? (
                <VideoPlayer src={videoMedia.media_url} poster={poster} title={post.title} durationLabel={post.videoDuration} />
              ) : (
                <>
                  {poster ? (
                    <Image
                      src={poster}
                      alt={post.title || "Video thumbnail"}
                      width={640}
                      height={360}
                      className="video-thumbnail"
                      sizes="(max-width: 640px) 92vw, 560px"
                      quality={75}
                      loading="lazy"
                    />
                  ) : (
                    <div className="video-poster-blank" aria-hidden="true" />
                  )}
                  <button type="button" className="video-play-btn" aria-label="Open post" onClick={handleOpenModal}>
                    <PlayGlyph size={24} />
                  </button>
                  {post.videoDuration && <span className="video-duration">{post.videoDuration}</span>}
                </>
              )}
            </div>
            {post.title && <h3 className="video-title">{post.title}</h3>}
            {post.content && (
              <TruncatedContent content={post.content} maxChars={200} onReadMore={handleOpenModal} className="video-description" />
            )}
          </ContentSection>
          {renderActions()}
        </article>
      );
    }

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

    const isVisual = form === "gallery";
    const isPoem = form === "poem";

    // Photos: the visual story gets a carousel; other types keep the grid.
    const mediaBlock = isVisual ? (
      hasMedia && showContent ? (
        <MediaCarousel items={visualMedia} authorName={post.author.name} onOpen={handleOpenModal} />
      ) : !hasMedia && post.image && showContent ? (
        <MediaCarousel
          items={[{ id: post.id, media_url: post.image, media_type: "image", caption: null, position: 0 }]}
          authorName={post.author.name}
          onOpen={handleOpenModal}
        />
      ) : null
    ) : (
      <>
        {hasMedia && showContent && (
          <div className={`unified-media-grid pq-media-count-${Math.min(visualMedia.length, 4)}`} onClick={(e) => e.stopPropagation()}>
            {visualMedia.slice(0, 4).map((item, idx) => (
              <button
                type="button"
                onClick={handleOpenModal}
                aria-label={`Open ${item.media_type === "video" ? "video" : "photo"} ${idx + 1} of ${visualMedia.length}`}
                key={item.id || idx}
                className={`unified-media-item ${visualMedia.length === 1 ? "single" : ""} ${visualMedia.length === 2 ? "double" : ""} ${visualMedia.length === 3 && idx === 0 ? "featured" : ""}`}
              >
                {item.media_type === "video" ? (
                  <div className="unified-video-thumb">
                    <video src={item.media_url} className="unified-media-image" preload="metadata" aria-label={item.caption || `Video ${idx + 1} in post by ${post.author.name}`} />
                    <div className="unified-video-play" aria-hidden="true">
                      <PlayGlyph size={18} />
                    </div>
                  </div>
                ) : (
                  <Image
                    src={item.media_url}
                    alt={item.caption || `Image ${idx + 1} in post by ${post.author.name}`}
                    width={400}
                    height={400}
                    className="unified-media-image"
                    sizes="(max-width: 640px) 90vw, 600px"
                    quality={75}
                    loading="lazy"
                  />
                )}
                {idx === 3 && visualMedia.length > 4 && <div className="unified-media-more">+{visualMedia.length - 4}</div>}
              </button>
            ))}
          </div>
        )}
        {!hasMedia && post.image && showContent && (
          <div className="unified-media-grid single-legacy" onClick={(e) => e.stopPropagation()}>
            <div className="unified-media-item single">
              <Image src={post.image} alt={post.title || ""} width={400} height={400} className="unified-media-image" sizes="(max-width: 640px) 90vw, 600px" quality={75} loading="lazy" />
            </div>
          </div>
        )}
      </>
    );

    return (
      <article
        className={`post type-unified pq-feed-card pq-post-${post.type} ${isStatement ? "pq-statement" : ""}`}
        onClick={handleOpenModal}
      >
        <AuthorHeader />
        <ContentSection>
          <>
            {/* Journal: the dated entry line sits above the title, with a hairline rule */}
            {post.type === "journal" && <JournalStrip post={post} className="journal-date" />}

            {post.title && (
              <h3 className={`unified-post-title ${isPoem ? "poem-title" : ""} ${alignmentClass}`}>{post.title}</h3>
            )}

            {isStatement ? (
              <p className={`pq-thought-statement ${alignmentClass}`}>{plainContent}</p>
            ) : (
              <FormBody
                hideJournalStrip
                post={post}
                onReadMore={handleOpenModal}
                className={`${alignmentClass} ${lineSpacingClass} ${post.styling?.dropCap ? "drop-cap-enabled" : ""}`}
              />
            )}

            {post.spotify_track && (
              <div className="flex items-center gap-2 mt-3 mb-1 px-1">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1DB954]/10 border border-[#1DB954]/20">
                  <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                  </svg>
                  <span className="font-ui text-xs text-[#1DB954] font-medium truncate max-w-[180px]">{post.spotify_track.name}</span>
                  <span className="font-ui text-xs text-[#1DB954]/60 hidden sm:inline">· {post.spotify_track.artist}</span>
                </div>
              </div>
            )}

            {audioMedia && showContent && (
              <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                <AudioPlayer
                  src={audioMedia.media_url}
                  title={post.title || undefined}
                  cover={isVoicePost ? null : audioCover}
                  variant={isVoicePost ? "voice" : "card"}
                />
              </div>
            )}

            {mediaBlock}
          </>
        </ContentSection>
        {renderActions()}
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
            reactions_count: reaction.counts.total,
            comments_count: post.stats.comments,
            relays_count: post.stats.relays,
            user_reaction_type: reaction.mine,
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
        title="Erase this from your studio?"
        description="The post, its admires, and the conversation around it will fade for good. This page won't remember it."
        confirmText="Erase it"
        isDanger
        loading={deleting}
      />

      {/* Moderator Delete Confirmation Modal */}
      {showModeratorDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-(--z-modal) animate-fadeIn"
            onClick={() => !moderatorDeleting && setShowModeratorDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[90vw] bg-surface rounded-3xl shadow-2xl border border-border-light z-(--z-modal) overflow-hidden animate-scaleIn">
            <div className="p-7">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
                  <TrashIcon className="w-5 h-5" />
                </div>
                <h3 className="font-display text-xl text-ink leading-tight">Sweep this post out as moderator?</h3>
              </div>

              <p className="font-body text-[0.95rem] text-muted leading-relaxed mb-5 ml-[56px]">
                The post will leave the community feed and your action will be written into the moderation log for the record.
              </p>

              <div className="mb-5 ml-[56px]">
                <label className="block font-ui text-xs font-medium text-muted mb-2">
                  Reason <span className="text-muted/60 normal-case tracking-normal">(optional)</span>
                </label>
                <textarea
                  value={moderatorDeleteReason}
                  onChange={(e) => setModeratorDeleteReason(e.target.value)}
                  placeholder="A short note for the log…"
                  rows={2}
                  className="w-full px-4 py-3 rounded-2xl border border-border-light bg-subtle/40 text-ink font-body text-sm placeholder:text-muted/60 focus:outline-none focus:ring-2 focus:ring-orange-400/30 focus:border-orange-400/60 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setShowModeratorDeleteConfirm(false);
                    setModeratorDeleteReason("");
                  }}
                  disabled={moderatorDeleting}
                >
                  Cancel
                </Button>
                <button
                  onClick={handleModeratorDelete}
                  disabled={moderatorDeleting}
                  className="px-5 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-orange-500 transition-all duration-150 hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-surface active:scale-[0.97] disabled:opacity-70 disabled:active:scale-100 flex items-center gap-2 shadow-sm hover:shadow-md hover:shadow-orange-500/20"
                >
                  {moderatorDeleting ? (
                    <>
                      <Spinner size="xs" className="text-white" />
                      Sweeping...
                    </>
                  ) : (
                    "Sweep it"
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
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-(--z-modal) animate-fadeIn"
            onClick={() => !blockLoading && setShowBlockConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[440px] max-w-[90vw] bg-surface rounded-3xl shadow-2xl border border-border-light z-(--z-modal) p-7 animate-scaleIn">
            <h3 className="font-display text-xl text-ink mb-3">
              Close the door on @{post.author.handle.replace('@', '')}?
            </h3>
            <p className="font-body text-[0.95rem] text-muted mb-7 leading-relaxed">
              Their posts vanish from your feed and yours from theirs. They won&apos;t be able to follow you, message you, or knock again.
            </p>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={() => setShowBlockConfirm(false)} disabled={blockLoading}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleBlockUser}
                loading={blockLoading}
                loadingText="Closing..."
              >
                Block
              </Button>
            </div>
          </div>
        </>
      )}

      {showRemoveCollabConfirm && (
        <ConfirmationModal
          isOpen={showRemoveCollabConfirm}
          onClose={() => !removingCollab && setShowRemoveCollabConfirm(false)}
          onConfirm={handleRemoveSelfAsCollaborator}
          title="Remove yourself from this collab?"
          description={`This post will no longer appear on your profile, and @${post.author.handle.replace('@', '')} will be notified. The post itself will stay published.`}
          confirmText="Remove me"
          cancelText="Cancel"
          isDanger
          loading={removingCollab}
        />
      )}
    </>
  );
}

// Memoize component to prevent unnecessary re-renders when parent updates
const PostCard = memo(PostCardComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if these specific props change
  return (
    prevProps.post.id === nextProps.post.id &&
    prevProps.post.stats?.reactions === nextProps.post.stats?.reactions &&
    prevProps.post.stats?.comments === nextProps.post.stats?.comments &&
    prevProps.post.stats?.relays === nextProps.post.stats?.relays &&
    prevProps.post.isSaved === nextProps.post.isSaved &&
    prevProps.post.isRelayed === nextProps.post.isRelayed &&
    prevProps.post.reactionType === nextProps.post.reactionType &&
    prevProps.canModerateDelete === nextProps.canModerateDelete &&
    !!prevProps.onModeratorDelete === !!nextProps.onModeratorDelete &&
    prevProps.isPinned === nextProps.isPinned &&
    !!prevProps.onPin === !!nextProps.onPin &&
    !!prevProps.onUnpin === !!nextProps.onUnpin &&
    prevProps.readOnly === nextProps.readOnly
  );
});

export default PostCard;
