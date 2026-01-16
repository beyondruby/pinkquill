"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useModal } from "@/components/providers/ModalProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useToggleAdmire, useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, createNotification, useBlock, ReactionType, ReactionCounts } from "@/lib/hooks";
import { usePostViewTracker, useTrackPostImpression } from "@/lib/hooks/useTracking";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import CommunityBadge from "@/components/communities/CommunityBadge";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { supabase } from "@/lib/supabase";
import { PostStyling, JournalMetadata, PostBackground } from "@/lib/types";
import {
  HeartIcon,
  CommentIcon,
  RelayIcon,
  ShareIcon,
  BookmarkIcon,
  EllipsisIcon,
  TrashIcon,
  EditIcon,
  FlagIcon,
  BlockIcon,
  PlayIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowRightIcon,
} from "@/components/ui/Icons";

// Helper to strip HTML tags for excerpts (uses regex for SSR consistency)
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

// Helper to clean HTML for display (keeps tags but fixes &nbsp;)
function cleanHtmlForDisplay(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
}

// Helper to count words in content
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

// Helper to get excerpt by word count
function getExcerptByWords(content: string, maxWords: number): { text: string; isTruncated: boolean } {
  const text = stripHtml(content);
  const words = text.trim().split(/\s+/).filter(word => word.length > 0);
  if (words.length <= maxWords) {
    return { text, isTruncated: false };
  }
  return { text: words.slice(0, maxWords).join(' ') + '...', isTruncated: true };
}

// Helper to get excerpt from content (legacy, character-based)
function getExcerpt(content: string, maxLength: number): string {
  const text = stripHtml(content);
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + "...";
}

// Truncated content component with "Continue reading" button (50 word limit)
interface TruncatedContentProps {
  content: string;
  maxWords?: number;
  onReadMore: () => void;
  className?: string;
  isPoem?: boolean;
}

function TruncatedContent({ content, maxWords = 50, onReadMore, className = "", isPoem = false }: TruncatedContentProps) {
  const plainText = stripHtml(content);
  const wordCount = countWords(plainText);
  const isTruncated = wordCount > maxWords;
  const { text: truncatedText } = getExcerptByWords(content, maxWords);

  return (
    <div className="truncated-content-wrapper">
      {isTruncated ? (
        <>
          <p className={`post-content-text ${isPoem ? 'text-center italic' : ''} ${className}`}>
            {truncatedText}
          </p>
          <button
            className="continue-reading-btn"
            onClick={(e) => {
              e.stopPropagation();
              onReadMore();
            }}
          >
            Continue reading
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        </>
      ) : (
        <div
          className={`post-content ${isPoem ? 'text-center italic' : ''} ${className}`}
          dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(content) }}
        />
      )}
    </div>
  );
}

interface Author {
  name: string;
  handle: string;
  avatar: string;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface CommunityInfo {
  slug: string;
  name: string;
  avatar_url?: string | null;
}

interface CollaboratorInfo {
  status: 'pending' | 'accepted' | 'declined';
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface MentionInfo {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface PostProps {
  id: string;
  authorId: string;
  author: Author;
  type: "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "screenplay" | "story" | "letter" | "quote";
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  image?: string;
  audioDuration?: string;
  videoDuration?: string;
  stats: {
    admires: number;
    reactions?: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  reactionType?: ReactionType | null;
  isSaved?: boolean;
  isRelayed?: boolean;
  community?: CommunityInfo;
  collaborators?: CollaboratorInfo[];
  mentions?: MentionInfo[];
  hashtags?: string[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
}

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

// Sound Wave Animation Component
function SoundBars() {
  return (
    <div className="sound-bars">
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
      <div className="sound-bar"></div>
    </div>
  );
}

export default function PostCard({ post, onPostDeleted }: { post: PostProps; onPostDeleted?: (postId: string) => void }) {
  const router = useRouter();
  const { openPostModal, subscribeToUpdates, notifyUpdate } = useModal();
  const { user } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const { toggle: toggleAdmire } = useToggleAdmire();
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();
  const { react: toggleReaction, removeReaction } = useToggleReaction();

  // Real-time reaction hooks
  const { counts: reactionCounts, refetch: refetchReactionCounts } = useReactionCounts(post.id);
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post.id, user?.id);

  const [isAdmired, setIsAdmired] = useState(post.isAdmired || false);
  const [isSaved, setIsSaved] = useState(post.isSaved || false);
  const [isRelayed, setIsRelayed] = useState(post.isRelayed || false);
  const [admireCount, setAdmireCount] = useState(post.stats?.admires ?? 0);
  const [relayCount, setRelayCount] = useState(post.stats?.relays ?? 0);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showContent, setShowContent] = useState(!post.contentWarning);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const { blockUser } = useBlock();
  const menuRef = useRef<HTMLDivElement>(null);
  const isOwner = user && user.id === post.authorId;

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

  // Open post modal
  const handleOpenModal = () => {
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
  };

  const handleAdmire = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsAdmired = !isAdmired;
    const countChange = newIsAdmired ? 1 : -1;

    setIsAdmired(newIsAdmired);
    setAdmireCount((prev) => Math.max(0, prev + countChange));

    notifyUpdate({
      postId: post.id,
      field: "admires",
      isActive: newIsAdmired,
      countChange,
    });

    await toggleAdmire(post.id, user.id, isAdmired);

    if (newIsAdmired) {
      await createNotification(post.authorId, user.id, 'admire', post.id);
    }
  };

  // Handle reaction (new reaction system with real-time)
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const wasReacted = userReaction !== null;
    const isSameReaction = userReaction === reactionType;

    // Optimistic update for immediate feedback
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Perform database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Notify modal of changes
    notifyUpdate({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (wasReacted ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });

    // Send notification for new reactions (not removals or changes)
    // Always use "admire" as notification type for all reaction types
    if (!wasReacted && !isSameReaction) {
      await createNotification(post.authorId, user.id, "admire", post.id);
    }
  };

  const handleRemoveReaction = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Perform database update (real-time subscription will update counts)
    await removeReaction(post.id, user.id);

    // Notify modal
    notifyUpdate({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async (e: React.MouseEvent) => {
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

    await toggleSave(post.id, user.id, isSaved);
  };

  const handleRelay = async (e: React.MouseEvent) => {
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

    await toggleRelay(post.id, user.id, isRelayed);

    if (newIsRelayed) {
      await createNotification(post.authorId, user.id, 'relay', post.id);
    }
  };

  // Click outside to close menu
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

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // Delete related data first
      await Promise.all([
        supabase.from("post_media").delete().eq("post_id", post.id),
        supabase.from("admires").delete().eq("post_id", post.id),
        supabase.from("reactions").delete().eq("post_id", post.id),
        supabase.from("saves").delete().eq("post_id", post.id),
        supabase.from("relays").delete().eq("post_id", post.id),
        supabase.from("comments").delete().eq("post_id", post.id),
        supabase.from("notifications").delete().eq("post_id", post.id),
      ]);

      // Delete the post
      const { error } = await supabase.from("posts").delete().eq("id", post.id);

      if (error) {
        console.error("Error deleting post:", error);
        setDeleting(false);
        return;
      }

      setShowDeleteConfirm(false);
      // Notify parent to remove post from list
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    router.push(`/create?edit=${post.id}`);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user) return;

    setReportSubmitting(true);
    try {
      const { error } = await supabase.from("reports").insert({
        post_id: post.id,
        reporter_id: user.id,
        reason: reason,
        details: details || null,
      });

      if (error) {
        console.error("Error submitting report:", error);
        setReportSubmitting(false);
        return;
      }

      setReportSubmitted(true);
      setTimeout(() => {
        setShowReportModal(false);
        setReportSubmitted(false);
      }, 2000);
    } catch (err) {
      console.error("Failed to submit report:", err);
    }
    setReportSubmitting(false);
  };

  const handleBlockUser = async () => {
    if (!user) return;

    setBlockLoading(true);
    const result = await blockUser(user.id, post.authorId);
    if (result.success) {
      setShowBlockConfirm(false);
      // Remove post from view by calling onPostDeleted if available
      if (onPostDeleted) {
        onPostDeleted(post.id);
      }
    }
    setBlockLoading(false);
  };

  // Mentions/Tagged People display
  const hasMentions = post.mentions && post.mentions.length > 0;
  const MentionsDisplay = () => {
    if (!hasMentions) return null;
    const mentions = post.mentions!;
    const displayCount = 3;
    const visibleMentions = mentions.slice(0, displayCount);
    const remainingCount = mentions.length - displayCount;

    return (
      <div className="mentions-display" onClick={(e) => e.stopPropagation()}>
        <span className="mentions-label">with</span>
        {visibleMentions.map((mention, index) => (
          <span key={mention.user.id}>
            <Link
              href={`/studio/${mention.user.username}`}
              className="mention-link"
            >
              @{mention.user.username}
            </Link>
            {index < visibleMentions.length - 1 && <span className="mention-separator">, </span>}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="mentions-more">+{remainingCount} more</span>
        )}
      </div>
    );
  };

  // Hashtags display
  const hasHashtags = post.hashtags && post.hashtags.length > 0;
  const HashtagsDisplay = () => {
    if (!hasHashtags) return null;
    const tags = post.hashtags!;
    const displayCount = 4;
    const visibleTags = tags.slice(0, displayCount);
    const remainingCount = tags.length - displayCount;

    return (
      <div className="hashtags-display" onClick={(e) => e.stopPropagation()}>
        {visibleTags.map((tag) => (
          <Link
            key={tag}
            href={`/tag/${encodeURIComponent(tag)}`}
            className="hashtag-link"
          >
            #{tag}
          </Link>
        ))}
        {remainingCount > 0 && (
          <span className="hashtags-more">+{remainingCount}</span>
        )}
      </div>
    );
  };

  // Actions component reused across post types (now includes mentions and hashtags display)
  const Actions = () => (
    <div className="actions-wrapper">
      <MentionsDisplay />
      <HashtagsDisplay />
      <div className="actions">
        <div className="actions-left">
        {/* Reaction Picker with real-time counts */}
        <ReactionPicker
          currentReaction={userReaction}
          reactionCounts={reactionCounts}
          onReact={handleReaction}
          onRemoveReaction={handleRemoveReaction}
        />
        <button className="action-btn">
          <CommentIcon />
          <span className="action-count">{post.stats?.comments ?? 0}</span>
        </button>
        {(!user || user.id !== post.authorId) && (
          <button className={`action-btn ${isRelayed ? 'active' : ''}`} onClick={handleRelay} style={isRelayed ? { color: '#22c55e' } : undefined}>
            <RelayIcon />
            <span className="action-count">{relayCount}</span>
          </button>
        )}
      </div>
      <div className="actions-right">
        <button className="action-btn" onClick={(e) => { e.stopPropagation(); setShowShareModal(true); }}>
          <ShareIcon />
        </button>
        <button className={`action-btn ${isSaved ? 'saved' : ''}`} onClick={handleSave}>
          <BookmarkIcon filled={isSaved} />
        </button>
      </div>
      </div>
    </div>
  );

  // Get accepted collaborators
  const acceptedCollaborators = (post.collaborators || []).filter(c => c.status === 'accepted');
  const hasCollaborators = acceptedCollaborators.length > 0;

  // Author Header component
  const AuthorHeader = ({ small = false, centered = false }: { small?: boolean; centered?: boolean }) => (
    <div className="author-header" style={centered ? { justifyContent: 'center' } : undefined}>
      {/* Avatar Stack for Collaborators */}
      {hasCollaborators ? (
        <div className="collab-avatars group" onClick={(e) => e.stopPropagation()}>
          {/* Author Avatar */}
          <Link href={`/studio/${post.author.handle.replace('@', '')}`}>
            <Image
              src={post.author.avatar}
              alt={post.author.name}
              width={70}
              height={70}
              className="collab-avatar first"
              style={small ? { width: '36px', height: '36px' } : undefined}
            />
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
                <Image
                  src={collab.user.avatar_url}
                  alt={collab.user.display_name || collab.user.username}
                  width={70}
                  height={70}
                  className="collab-avatar"
                  style={small ? { width: '36px', height: '36px' } : undefined}
                />
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
          <Image
            src={post.author.avatar}
            alt={post.author.name}
            width={70}
            height={70}
            className="author-avatar"
            style={small ? { width: '36px', height: '36px' } : undefined}
          />
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
              <span className="post-type-label">{post.typeLabel}</span>
            </>
          )}
          {post.community && (
            <>
              <span className="post-type-label">in</span>
              <CommunityBadge community={post.community} size="sm" showAvatar={false} />
            </>
          )}
        </div>
        <div className="post-meta-line">
          {hasCollaborators && <span className="post-type-label">{post.typeLabel}</span>}
          <span className="post-time">{post.timeAgo}</span>
        </div>
      </div>
      {isOwner ? (
        <div className="relative" ref={menuRef}>
          <button
            className="post-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <EllipsisIcon />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-36 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  handleEdit();
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
              >
                <EditIcon />
                Edit
              </button>
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowDeleteConfirm(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <TrashIcon />
                Delete
              </button>
            </div>
          )}
        </div>
      ) : user ? (
        <div className="relative" ref={menuRef}>
          <button
            className="post-menu-btn"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
          >
            <EllipsisIcon />
          </button>
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-2 w-44 bg-white rounded-xl shadow-lg border border-black/10 overflow-hidden z-50"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowBlockConfirm(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-ink hover:bg-black/[0.04] transition-colors"
              >
                <BlockIcon />
                Block @{post.author.handle.replace('@', '')}
              </button>
              <div className="h-px bg-black/[0.06] mx-3" />
              <button
                onClick={() => {
                  setShowMenu(false);
                  setShowReportModal(true);
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 transition-colors"
              >
                <FlagIcon />
                Report
              </button>
            </div>
          )}
        </div>
      ) : (
        <button className="post-menu-btn" onClick={(e) => e.stopPropagation()}>
          <EllipsisIcon />
        </button>
      )}
    </div>
  );

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

  // Render function for different post types
  const renderPost = () => {
    // Audio post
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
              <div className="audio-author">"{post.title}"</div>
            </ContentSection>
            <Actions />
          </div>
        </article>
      );
    }

    // Video post
    if (post.type === "video") {
      return (
        <article className="post type-video" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            <div className="video-container" onClick={(e) => e.stopPropagation()}>
              <Image src={post.image || "/video-placeholder.svg"} alt={post.title || "Video thumbnail"} width={640} height={360} className="video-thumbnail" style={{ width: '100%', height: 'auto' }} />
              <div className="video-play-btn">
                <span style={{ color: 'var(--primary-purple)', marginLeft: '4px' }}><PlayIcon /></span>
              </div>
              {post.videoDuration && <span className="video-duration">{post.videoDuration}</span>}
            </div>
            {post.title && <h3 className="video-title">{post.title}</h3>}
            {post.content && <p className="video-description">{post.content}</p>}
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Poem post
    if (post.type === "poem") {
      return (
        <article className="post type-poem" onClick={handleOpenModal}>
          <AuthorHeader centered />
          <ContentSection>
            {post.title && <div className="poem-title">{post.title}</div>}
            <TruncatedContent
              content={post.content}
              maxWords={50}
              onReadMore={handleOpenModal}
              className="poem-body"
              isPoem
            />
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Journal post
    if (post.type === "journal" && !hasMedia) {
      const { text: journalExcerpt, isTruncated: journalTruncated } = getExcerptByWords(post.content, 50);
      const hasBackground = post.styling?.background;
      const hasMetadata = post.metadata && (post.metadata.weather || post.metadata.temperature || post.metadata.mood);

      return (
        <article
          className={`post type-journal ${hasBackground ? 'has-background' : ''}`}
          onClick={handleOpenModal}
          style={hasBackground ? { position: 'relative', overflow: 'hidden' } : undefined}
        >
          {/* Background preview for styled journals */}
          {hasBackground && (
            <div
              className="absolute inset-0 opacity-20 pointer-events-none"
              style={getBackgroundPreviewStyle(post.styling?.background)}
            />
          )}
          <div className="relative z-10">
            <AuthorHeader />
            <ContentSection>
              {/* Journal metadata row */}
              <div className="journal-header-row">
                <div className="journal-date">{post.createdAt ? formatDate(post.createdAt) : post.timeAgo}</div>
                {/* Metadata indicators */}
                {(hasMetadata || post.post_location) && (
                  <div className="journal-metadata-indicators">
                    {post.post_location && (
                      <span className="journal-location-indicator" title={post.post_location}>
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                        </svg>
                      </span>
                    )}
                    {post.metadata?.weather && (
                      <span className="journal-weather-indicator" title={post.metadata.weather}>
                        {weatherIconsSmall[post.metadata.weather] || '🌤️'}
                      </span>
                    )}
                    {post.metadata?.temperature && (
                      <span className="journal-temp-indicator">{post.metadata.temperature}</span>
                    )}
                    {post.metadata?.mood && (
                      <span className="journal-mood-indicator" title={post.metadata.mood}>
                        {moodIndicators[post.metadata.mood] || '💭'}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {post.title && <h3 className="journal-title">{post.title}</h3>}
              <p className="journal-excerpt">{journalExcerpt}</p>
              {journalTruncated && (
                <button className="continue-reading-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}>
                  Continue reading
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              )}
            </ContentSection>
            <Actions />
          </div>
        </article>
      );
    }

    // Thought/Manifesto post
    if (post.type === "thought") {
      return (
        <article className="post type-manifesto" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            {post.title && <h3 className="carousel-title">{post.title}</h3>}
            <TruncatedContent
              content={post.content}
              maxWords={50}
              onReadMore={handleOpenModal}
              className="thought-content"
            />
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Essay/Story/Letter/Screenplay (longform)
    if ((post.type === "essay" || post.type === "story" || post.type === "letter" || post.type === "screenplay") && !hasMedia) {
      const { text: longformExcerpt, isTruncated: longformTruncated } = getExcerptByWords(post.content, 50);
      return (
        <article className="post type-longform" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            {post.title && <h2 className="longform-title">{post.title}</h2>}
            <div className="longform-content">
              <div className="longform-text">
                <p>{longformExcerpt}</p>
              </div>
            </div>
            {longformTruncated && (
              <button className="continue-reading-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}>
                Continue reading
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14M12 5l7 7-7 7"/>
                </svg>
              </button>
            )}
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Quote post
    if (post.type === "quote") {
      return (
        <article className="post type-poem" onClick={handleOpenModal}>
          <AuthorHeader centered />
          <ContentSection>
            <div className="poem-body post-content" style={{ fontSize: '1.5rem', lineHeight: '1.6' }} dangerouslySetInnerHTML={{ __html: `"${stripHtml(post.content)}"` }} />
            {post.title && <p style={{ fontFamily: 'var(--font-ui)', fontSize: '0.9rem', color: 'var(--primary-purple)', marginTop: '1rem' }}>— {post.title}</p>}
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Visual post with carousel (has media)
    if (hasMedia) {
      const { text: excerptText, isTruncated: contentTruncated } = getExcerptByWords(post.content, 50);

      return (
        <article className="post type-carousel" onClick={handleOpenModal}>
          <AuthorHeader />

          <ContentSection>
            {/* Title first */}
            {post.title && <h3 className="carousel-title">{post.title}</h3>}

            {/* Content/paragraph second */}
            {post.content && (
              <div className="carousel-text-content">
                <p className="carousel-description">{excerptText}</p>
                {contentTruncated && (
                  <button className="continue-reading-btn" onClick={(e) => { e.stopPropagation(); handleOpenModal(); }}>
                    Continue reading
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                )}
              </div>
            )}

            {/* Images/carousel third */}
            <div className="carousel-container" onClick={(e) => e.stopPropagation()}>
              <div
                className="carousel-track"
                style={{ transform: `translateX(-${currentMediaIndex * 100}%)` }}
              >
                {post.media!.map((item, idx) => (
                  <div key={item.id || idx} className="carousel-slide">
                    {item.media_type === "video" ? (
                      <video
                        src={item.media_url}
                        style={{ width: '100%', height: '380px', objectFit: 'cover' }}
                        controls
                        controlsList="nodownload"
                        playsInline
                        preload="none"
                        poster="/video-placeholder.svg"
                      />
                    ) : (
                      <Image src={item.media_url} alt="" width={640} height={480} className="carousel-image" style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
                    )}
                    {item.caption && (
                      <div className="carousel-caption">
                        <h4>{item.caption.includes(' - ') ? item.caption.split(' - ')[0] : item.caption}</h4>
                        {item.caption.includes(' - ') && <p>{item.caption.split(' - ')[1]}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Navigation arrows */}
              {post.media!.length > 1 && (
                <>
                  <button
                    className="carousel-nav prev"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMediaIndex((prev) => (prev === 0 ? post.media!.length - 1 : prev - 1));
                    }}
                  >
                    <ChevronLeftIcon />
                  </button>
                  <button
                    className="carousel-nav next"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMediaIndex((prev) => (prev === post.media!.length - 1 ? 0 : prev + 1));
                    }}
                  >
                    <ChevronRightIcon />
                  </button>
                </>
              )}

              {/* Dots */}
              {post.media!.length > 1 && (
                <div className="carousel-dots">
                  {post.media!.map((_, idx) => (
                    <button
                      key={idx}
                      className={`carousel-dot ${idx === currentMediaIndex ? 'active' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCurrentMediaIndex(idx);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </ContentSection>

          <Actions />
        </article>
      );
    }

    // Visual post without carousel (single image)
    if (post.type === "visual" && post.image) {
      return (
        <article className="post" onClick={handleOpenModal}>
          <AuthorHeader />
          <ContentSection>
            {/* Title first */}
            {post.title && <h3 className="carousel-title">{post.title}</h3>}
            {/* Content/paragraph second */}
            {post.content && (
              <TruncatedContent
                content={post.content}
                maxWords={50}
                onReadMore={handleOpenModal}
                className="carousel-description"
              />
            )}
            {/* Image third */}
            <div style={{ borderRadius: '14px', overflow: 'hidden', marginTop: '1rem' }}>
              <Image src={post.image} alt={post.title || "Visual post"} width={640} height={480} style={{ width: '100%', height: 'auto', objectFit: 'cover' }} />
            </div>
          </ContentSection>
          <Actions />
        </article>
      );
    }

    // Default fallback
    return (
      <article className="post" onClick={handleOpenModal}>
        <AuthorHeader />
        <ContentSection>
          {post.title && <h3 className="carousel-title">{post.title}</h3>}
          <TruncatedContent
            content={post.content}
            maxWords={50}
            onReadMore={handleOpenModal}
            className="carousel-description"
          />
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
        title={post.title || post.content.substring(0, 100)}
        description={post.content.substring(0, 200)}
        type={post.type}
        authorName={post.author.name}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000]"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[1001] p-6">
            <h3 className="font-display text-xl text-ink mb-3">Delete Post?</h3>
            <p className="font-body text-sm text-muted mb-6">
              This action cannot be undone. This will permanently delete your post and remove all associated data including comments, admires, and saves.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-5 py-2.5 rounded-full font-ui text-sm text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
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
              You won't see their posts anymore. They won't be able to see your posts, follow you, or message you.
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
