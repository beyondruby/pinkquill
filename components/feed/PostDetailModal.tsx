"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAuth } from "@/components/providers/AuthProvider";
import { useAuthModal } from "@/components/providers/AuthModalProvider";
import { useComments, useToggleSave, useToggleRelay, useToggleReaction, useReactionCounts, useUserReaction, useBlock, createNotification, ReactionType } from "@/lib/hooks";
import type { PostUpdate } from "@/components/providers/ModalProvider";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import CommentItem from "@/components/feed/CommentItem";
import ReactionPicker from "@/components/feed/ReactionPicker";
import { supabase } from "@/lib/supabase";
import { icons } from "@/components/ui/Icons";
import PostTags from "@/components/feed/PostTags";
import { PostStyling, JournalMetadata, CanvasData, PostBackground, TimeOfDay, WeatherType, MoodType } from "@/lib/types";

// Helper to clean HTML for display (keeps tags but fixes &nbsp;)
function cleanHtmlForDisplay(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
}

// Generate background CSS from PostBackground
function getBackgroundStyle(background?: PostBackground): React.CSSProperties {
  if (!background) return {};

  switch (background.type) {
    case 'solid':
      return { backgroundColor: background.value };
    case 'gradient':
      return { background: background.value };
    case 'pattern':
      return {
        backgroundColor: '#f8f8f8',
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(getPatternSvg(background.value))}")`,
        backgroundRepeat: 'repeat',
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

// Get SVG pattern for pattern backgrounds
function getPatternSvg(patternName: string): string {
  const patterns: Record<string, string> = {
    'paper': '<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg"><filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="5"/><feDiffuseLighting lighting-color="#fff" surfaceScale="2"><feDistantLight azimuth="45" elevation="60"/></feDiffuseLighting></filter><rect width="100" height="100" filter="url(%23paper)"/></svg>',
    'linen': '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><rect width="20" height="20" fill="%23f5f5f5"/><path d="M0 0h20v1H0zM0 5h20v1H0zM0 10h20v1H0zM0 15h20v1H0z" fill="%23e8e8e8" opacity="0.5"/></svg>',
    'dots': '<svg width="20" height="20" xmlns="http://www.w3.org/2000/svg"><circle cx="2" cy="2" r="1" fill="%23ddd"/></svg>',
    'grid': '<svg width="40" height="40" xmlns="http://www.w3.org/2000/svg"><path d="M0 0h40v40H0z" fill="none" stroke="%23e0e0e0" stroke-width="0.5"/></svg>',
  };
  return patterns[patternName] || patterns['paper'];
}

// Weather icons for journal display
const weatherIcons: Record<string, React.ReactNode> = {
  'sunny': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'partly-cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-4.9 4.03A5 5 0 0 0 3 11a5 5 0 0 0 5 5h9a4 4 0 0 0 0-8h-.35A5 5 0 0 0 12 2z"/></svg>,
  'cloudy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 18H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 18z"/></svg>,
  'rainy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 17l-2 4M12 17l-2 4M16 17l-2 4"/></svg>,
  'stormy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM13 14l-4 8h5l-1 4"/></svg>,
  'snowy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 16h.01M12 16h.01M16 16h.01M8 20h.01M12 20h.01M16 20h.01"/></svg>,
  'foggy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h16M4 18h12M4 10h8"/></svg>,
  'windy': <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>,
};

// Time of day icons
const timeOfDayIcons: Record<string, React.ReactNode> = {
  'morning': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 7a5 5 0 0 0 0 10M2 12h2M20 12h2M6.34 6.34l1.42 1.42M16.24 16.24l1.42 1.42M6.34 17.66l1.42-1.42M16.24 7.76l1.42-1.42"/></svg>,
  'afternoon': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'evening': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v3M18.36 5.64l-2.12 2.12M21 12h-3M18.36 18.36l-2.12-2.12M12 21v-3M5.64 18.36l2.12-2.12M3 12h3M5.64 5.64l2.12 2.12"/></svg>,
  'night': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>,
};

// Mood icons
const moodIcons: Record<string, React.ReactNode> = {
  'reflective': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'joyful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01"/></svg>,
  'melancholic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2M9 9h.01M15 9h.01"/></svg>,
  'peaceful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14h8M9 9h.01M15 9h.01"/></svg>,
  'anxious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8M8 9h2M14 9h2"/></svg>,
  'grateful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  'creative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>,
  'nostalgic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  'hopeful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'contemplative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01"/></svg>,
};

// Get shadow CSS for canvas images
function getShadowStyle(shadow: string): string {
  switch (shadow) {
    case 'soft': return '0 4px 12px rgba(0,0,0,0.1)';
    case 'medium': return '0 8px 24px rgba(0,0,0,0.15)';
    case 'strong': return '0 12px 40px rgba(0,0,0,0.25)';
    default: return 'none';
  }
}

// Determine if background is dark to adjust text color
function isDarkBackground(background?: PostBackground): boolean {
  if (!background) return false;
  if (background.type === 'solid') {
    const hex = background.value.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  if (background.type === 'image') return true;
  if (background.type === 'gradient' && background.value.includes('#1')) return true;
  return false;
}

interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface CollaboratorUser {
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
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
  canvas_data?: CanvasData | null;
}

interface Post {
  id: string;
  authorId?: string;
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
  stats: {
    admires: number;
    comments: number;
    relays: number;
  };
  isAdmired?: boolean;
  isSaved?: boolean;
  isRelayed?: boolean;
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
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

// Format time as "10:42 PM"
function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Format time of day label
function formatTimeOfDay(timeOfDay?: string): string {
  const labels: Record<string, string> = {
    'morning': 'Morning',
    'afternoon': 'Afternoon',
    'evening': 'Evening',
    'night': 'Night'
  };
  return timeOfDay ? labels[timeOfDay] || timeOfDay : '';
}

// Format mood label
function formatMood(mood?: string): string {
  if (!mood) return '';
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

// Format weather label
function formatWeather(weather?: string): string {
  if (!weather) return '';
  const labels: Record<string, string> = {
    'sunny': 'Sunny',
    'partly-cloudy': 'Partly Cloudy',
    'cloudy': 'Cloudy',
    'rainy': 'Rainy',
    'stormy': 'Stormy',
    'snowy': 'Snowy',
    'foggy': 'Foggy',
    'windy': 'Windy'
  };
  return labels[weather] || weather;
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

interface PostDetailModalProps {
  post: Post | null;
  isOpen: boolean;
  onClose: () => void;
  onPostUpdate?: (update: PostUpdate) => void;
  onPostDeleted?: (postId: string) => void;
}

export default function PostDetailModal({
  post,
  isOpen,
  onClose,
  onPostUpdate,
  onPostDeleted,
}: PostDetailModalProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { openModal: openAuthModal } = useAuthModal();
  const [showComments, setShowComments] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [showContent, setShowContent] = useState(true);

  const menuRef = useRef<HTMLDivElement>(null);
  const { blockUser } = useBlock();

  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useComments(post?.id || "", user?.id);
  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(post?.id || "");
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(post?.id || "", user?.id);

  const hasMedia = post?.media && post.media.length > 0;
  const postUrl = typeof window !== 'undefined' && post ? `${window.location.origin}/post/${post.id}` : '';
  const isOwner = user && post?.authorId && user.id === post.authorId;

  // Sync state when post changes
  useEffect(() => {
    if (post) {
      setIsSaved(post.isSaved || false);
      setIsRelayed(post.isRelayed || false);
      setRelayCount(post.stats.relays);
      setCurrentMediaIndex(0);
      setShowContent(!post.contentWarning);
    }
  }, [post?.id, post?.isSaved, post?.isRelayed, post?.stats.relays, post?.contentWarning]);

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
    if (!post || !user) return;

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
      onClose();
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
    if (!post) return;
    onClose();
    router.push(`/create?edit=${post.id}`);
  };

  const handleReport = async (reason: string, details?: string) => {
    if (!user || !post) return;

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

  const handleBlock = async () => {
    if (!user || !post?.authorId) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.authorId);
      setShowBlockConfirm(false);
      onClose();
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  if (!post) return null;

  // Reaction handlers
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user) {
      openAuthModal();
      return;
    }

    const isSameReaction = userReaction === reactionType;

    // Optimistic update
    if (isSameReaction) {
      setUserReaction(null);
    } else {
      setUserReaction(reactionType);
    }

    // Database update (real-time subscription will update counts)
    await toggleReaction(post.id, user.id, reactionType, userReaction);

    // Create notification for reaction
    if (!isSameReaction && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "admire", post.id);
    }

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: !isSameReaction,
      countChange: isSameReaction ? -1 : (userReaction ? 0 : 1),
      reactionType: isSameReaction ? null : reactionType,
    });
  };

  const handleRemoveReaction = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "reactions",
      isActive: false,
      countChange: -1,
      reactionType: null,
    });
  };

  const handleSave = async () => {
    if (!user) {
      openAuthModal();
      return;
    }

    const newIsSaved = !isSaved;

    // Optimistic update
    setIsSaved(newIsSaved);

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "saves",
      isActive: newIsSaved,
      countChange: 0,
    });

    // Database update
    await toggleSave(post.id, user.id, isSaved);
  };

  const handleRelay = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    // Can't relay your own posts
    if (user.id === post.authorId) return;

    const newIsRelayed = !isRelayed;
    const countChange = newIsRelayed ? 1 : -1;

    // Optimistic update
    setIsRelayed(newIsRelayed);
    setRelayCount((prev) => Math.max(0, prev + countChange));

    // Notify other components
    onPostUpdate?.({
      postId: post.id,
      field: "relays",
      isActive: newIsRelayed,
      countChange,
    });

    // Database update
    await toggleRelay(post.id, user.id, isRelayed);

    // Create notification for relay
    if (newIsRelayed && post.authorId && post.authorId !== user.id) {
      await createNotification(post.authorId, user.id, "relay", post.id);
    }
  };

  const handleAddComment = async () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (!commentText.trim()) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      // Create notification for comment
      if (post.authorId && post.authorId !== user.id) {
        await createNotification(post.authorId, user.id, 'comment', post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string, isLiked: boolean) => {
    if (!user) {
      openAuthModal();
      return;
    }
    toggleLike(commentId, user.id, isLiked);
  };

  const handleCommentReply = async (parentId: string, content: string) => {
    if (!user) {
      openAuthModal();
      return;
    }
    await addComment(user.id, content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
  };

  // Determine styling properties
  const hasBackground = post.styling?.background;
  const hasDarkBg = isDarkBackground(post.styling?.background);
  const textColorClass = hasDarkBg ? 'text-white' : 'text-ink';
  const mutedTextColorClass = hasDarkBg ? 'text-white/70' : 'text-muted';
  const borderColorClass = hasDarkBg ? 'border-white/10' : 'border-black/[0.06]';

  // Text styling
  const textAlignment = post.styling?.textAlignment || 'left';
  const lineSpacing = post.styling?.lineSpacing || 'normal';
  const dropCapEnabled = post.styling?.dropCap || false;

  const alignmentClass = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
    justify: 'text-justify'
  }[textAlignment];

  const lineSpacingClass = {
    normal: 'leading-relaxed',
    relaxed: 'leading-[2]',
    loose: 'leading-[2.5]'
  }[lineSpacing];

  // Check for canvas images (position >= 1000)
  const canvasImages = post.media?.filter(m => m.position >= 1000 && m.canvas_data) || [];
  const regularMedia = post.media?.filter(m => m.position < 1000 || !m.canvas_data) || [];
  const hasCanvasImages = canvasImages.length > 0;
  const hasRegularMedia = regularMedia.length > 0;

  return (
    <>
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={`flex flex-col md:flex-row h-full ${showComments ? "" : ""}`}>
        {/* Mobile Close Button - Floating */}
        <button
          onClick={onClose}
          className={`md:hidden absolute top-3 right-3 z-50 w-10 h-10 rounded-full backdrop-blur-md flex items-center justify-center transition-all ${
            hasDarkBg ? 'bg-white/20 text-white hover:bg-white/30' : 'bg-black/10 text-ink hover:bg-black/20'
          }`}
        >
          {icons.close}
        </button>

        {/* Main Content Area - Immersive Design */}
        <div
          className={`flex flex-col overflow-y-auto relative ${
            showComments ? "hidden md:flex md:flex-1 md:border-r" : "flex-1"
          } ${borderColorClass}`}
          style={hasBackground ? getBackgroundStyle(post.styling?.background) : {}}
        >
          {/* Background overlay for image backgrounds */}
          {post.styling?.background?.type === 'image' && (
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              style={{
                opacity: post.styling.background.opacity !== undefined
                  ? 1 - post.styling.background.opacity
                  : 0.4,
                backdropFilter: post.styling.background.blur
                  ? `blur(${post.styling.background.blur}px)`
                  : 'blur(2px)'
              }}
            />
          )}

          {/* Content wrapper with padding */}
          <div className="relative z-10 p-4 md:p-10 flex flex-col flex-1">
            {/* Floating Author Header */}
            <div className={`flex items-center gap-3 md:gap-4 mb-4 md:mb-6 pb-4 md:pb-6 border-b ${borderColorClass}`}>
              <Link href={`/studio/${post.author.handle.replace('@', '')}`} onClick={onClose}>
                <Image
                  src={post.author.avatar}
                  alt={post.author.name}
                  width={56}
                  height={56}
                  className={`w-10 h-10 md:w-14 md:h-14 rounded-full object-cover border-2 md:border-[3px] shadow-lg hover:scale-110 transition-transform ${
                    hasDarkBg ? 'border-white/30' : 'border-white'
                  }`}
                />
              </Link>
              <div className="flex flex-col gap-0.5 md:gap-1 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link
                    href={`/studio/${post.author.handle.replace('@', '')}`}
                    onClick={onClose}
                    className={`font-ui text-[0.95rem] md:text-[1.1rem] font-medium transition-colors truncate ${
                      hasDarkBg ? 'text-white hover:text-white/80' : 'text-ink hover:text-purple-primary'
                    }`}
                  >
                    {post.author.name}
                  </Link>
                  <span className={`font-ui text-[0.8rem] md:text-[0.9rem] font-light hidden sm:inline ${mutedTextColorClass}`}>
                    {post.typeLabel}
                  </span>
                </div>
                <span className={`font-ui text-[0.75rem] md:text-[0.85rem] ${mutedTextColorClass}`}>
                  {post.timeAgo}
                </span>
              </div>
              <button
                onClick={() => setShowComments(!showComments)}
                className={`view-discussion-btn hidden md:flex ${hasDarkBg ? 'bg-white/10 text-white hover:bg-white/20' : ''}`}
              >
                {icons.comment}
                <span>Discussion</span>
                <span className={`badge ${hasDarkBg ? 'bg-white/20' : ''}`}>
                  {comments.length}
                </span>
              </button>
              {/* Mobile Discussion Button */}
              <button
                onClick={() => setShowComments(!showComments)}
                className={`md:hidden flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  hasDarkBg ? 'bg-white/20 text-white' : 'bg-purple-primary/10 text-purple-primary'
                }`}
              >
                {icons.comment}
                <span>{comments.length}</span>
              </button>

              {/* Post Options Menu */}
              {isOwner ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      hasDarkBg ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted hover:text-ink hover:bg-black/[0.04]'
                    }`}
                  >
                    {icons.moreHorizontal}
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          handleEdit();
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                      >
                        {icons.edit}
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowDeleteConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {icons.trash}
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ) : user && (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                      hasDarkBg ? 'text-white/70 hover:text-white hover:bg-white/10' : 'text-muted hover:text-ink hover:bg-black/[0.04]'
                    }`}
                  >
                    {icons.moreHorizontal}
                  </button>

                  {showMenu && (
                    <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-lg border border-black/[0.08] overflow-hidden z-50 animate-fadeIn">
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowBlockConfirm(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-ink hover:bg-black/[0.04] transition-colors"
                      >
                        {icons.block}
                        Block
                      </button>
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          setShowReportModal(true);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-3 text-left font-ui text-[0.9rem] text-red-500 hover:bg-red-50 transition-colors"
                      >
                        {icons.flag}
                        Report
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Beautiful Journal Metadata Header */}
            {post.type === "journal" && post.createdAt && (
              <div className={`journal-immersive-header mb-6 md:mb-8 text-center ${hasDarkBg ? 'text-white' : ''}`}>
                {/* Location */}
                {post.post_location && (
                  <div className={`flex items-center justify-center gap-2 mb-3 ${mutedTextColorClass}`}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    <span className="font-ui text-sm tracking-wide">{post.post_location}</span>
                  </div>
                )}

                {/* Date & Time */}
                <div className={`font-display text-2xl md:text-3xl mb-2 ${textColorClass}`}>
                  {formatDate(post.createdAt)}
                </div>
                <div className={`flex items-center justify-center gap-3 text-sm ${mutedTextColorClass}`}>
                  <span className="font-ui">{formatTime(post.createdAt)}</span>
                  {post.metadata?.timeOfDay && (
                    <>
                      <span className="opacity-40">·</span>
                      <span className="flex items-center gap-1.5">
                        {timeOfDayIcons[post.metadata.timeOfDay]}
                        <span className="font-ui">{formatTimeOfDay(post.metadata.timeOfDay)}</span>
                      </span>
                    </>
                  )}
                </div>

                {/* Weather & Mood */}
                {(post.metadata?.weather || post.metadata?.temperature || post.metadata?.mood) && (
                  <div className={`flex items-center justify-center gap-4 mt-4 pt-4 border-t ${borderColorClass}`}>
                    {(post.metadata?.weather || post.metadata?.temperature) && (
                      <div className={`flex items-center gap-2 ${mutedTextColorClass}`}>
                        {post.metadata?.weather && weatherIcons[post.metadata.weather]}
                        {post.metadata?.temperature && (
                          <span className="font-ui text-sm">{post.metadata.temperature}</span>
                        )}
                        {post.metadata?.weather && !post.metadata?.temperature && (
                          <span className="font-ui text-sm">{formatWeather(post.metadata.weather)}</span>
                        )}
                      </div>
                    )}
                    {post.metadata?.mood && (
                      <>
                        {(post.metadata?.weather || post.metadata?.temperature) && (
                          <span className={`opacity-30 ${textColorClass}`}>·</span>
                        )}
                        <div className={`flex items-center gap-1.5 ${mutedTextColorClass}`}>
                          {moodIcons[post.metadata.mood] || moodIcons['reflective']}
                          <span className="font-ui text-sm">{formatMood(post.metadata.mood)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Decorative divider */}
                <div className={`flex items-center justify-center mt-6 mb-2 ${mutedTextColorClass}`}>
                  <div className={`w-12 h-px ${hasDarkBg ? 'bg-white/20' : 'bg-black/10'}`} />
                  <svg className="w-4 h-4 mx-3 opacity-30" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                  </svg>
                  <div className={`w-12 h-px ${hasDarkBg ? 'bg-white/20' : 'bg-black/10'}`} />
                </div>
              </div>
            )}

            {/* Non-journal location display */}
            {post.type !== "journal" && post.post_location && (
              <div className={`flex items-center gap-2 mb-4 ${mutedTextColorClass}`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span className="font-ui text-sm">{post.post_location}</span>
              </div>
            )}

            {/* Post Content */}
            <div className="flex-1 relative">
              {post.title && (
                <h2
                  className={`font-display text-[1.3rem] md:text-[1.8rem] mb-3 md:mb-4 leading-tight ${textColorClass} ${
                    post.type === "poem" || textAlignment === 'center' ? "text-center" : alignmentClass
                  }`}
                >
                  {post.title}
                </h2>
              )}

              {post.type === "poem" ? (
                <div
                  className={`font-body text-[1.05rem] md:text-[1.3rem] leading-loose italic text-center py-4 md:py-8 post-content ${textColorClass} ${dropCapEnabled ? 'drop-cap-enabled' : ''}`}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                />
              ) : (
                <div
                  className={`font-body text-[0.95rem] md:text-[1.1rem] post-content ${textColorClass} ${alignmentClass} ${lineSpacingClass} ${dropCapEnabled ? 'drop-cap-enabled' : ''}`}
                  dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                />
              )}

              {/* Canvas Images Display - Free-positioned images */}
              {hasCanvasImages && (
                <div className="relative w-full aspect-[4/3] md:aspect-[16/10] mt-4 md:mt-8 rounded-xl overflow-hidden bg-black/5">
                  {canvasImages.map((item, idx) => {
                    const canvas = item.canvas_data!;
                    return (
                      <div
                        key={item.id || idx}
                        className="absolute cursor-pointer transition-transform hover:scale-[1.02]"
                        style={{
                          left: `${canvas.x * 100}%`,
                          top: `${canvas.y * 100}%`,
                          width: `${canvas.width * 100}%`,
                          height: `${canvas.height * 100}%`,
                          zIndex: canvas.zIndex || 1,
                          transform: `rotate(${canvas.rotation || 0}deg)`,
                        }}
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('openLightbox', {
                            detail: { images: canvasImages, index: idx }
                          }));
                        }}
                      >
                        <Image
                          src={item.media_url}
                          alt=""
                          fill
                          className="object-cover"
                          style={{
                            borderRadius: `${canvas.borderRadius || 0}px`,
                            border: canvas.borderWidth ? `${canvas.borderWidth}px solid ${canvas.borderColor || '#000'}` : 'none',
                            boxShadow: getShadowStyle(canvas.shadow || 'none'),
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Regular Media Gallery */}
              {hasRegularMedia && (
                <div className="mt-4 md:mt-8">
                  {/* Main Image Container */}
                  <div className="relative group rounded-xl md:rounded-2xl overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.15)] mb-3 md:mb-5">
                    {regularMedia[currentMediaIndex]?.media_type === "video" ? (
                      <div className="relative bg-black">
                        <video
                          src={regularMedia[currentMediaIndex].media_url}
                          className="w-full h-[250px] md:h-[420px] object-contain"
                          controls
                          controlsList="nodownload"
                          playsInline
                          preload="none"
                          poster="/video-placeholder.svg"
                        />
                      </div>
                    ) : regularMedia[currentMediaIndex] && (
                      <div className="relative overflow-hidden">
                        <Image
                          src={regularMedia[currentMediaIndex].media_url}
                          alt=""
                          width={800}
                          height={420}
                          className="w-full h-[250px] md:h-[420px] object-cover cursor-pointer transition-transform duration-500 group-hover:scale-[1.02]"
                          onClick={() => {
                            window.dispatchEvent(new CustomEvent('openLightbox', {
                              detail: { images: regularMedia, index: currentMediaIndex }
                            }));
                          }}
                        />
                        {/* Hover overlay */}
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none" />
                      </div>
                    )}

                    {/* Navigation Arrows */}
                    {regularMedia.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? regularMedia.length - 1 : prev - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 transition-all duration-300 z-10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === regularMedia.length - 1 ? 0 : prev + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 backdrop-blur-sm shadow-[0_4px_20px_rgba(0,0,0,0.2)] flex items-center justify-center text-ink opacity-0 group-hover:opacity-100 hover:bg-white hover:scale-110 transition-all duration-300 z-10"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Caption - Elegant Design */}
                  {regularMedia[currentMediaIndex]?.caption && (
                    <div className="text-center mb-5 px-4">
                      <div className="inline-block relative">
                        <span className={`absolute -left-4 top-0 text-2xl font-display ${hasDarkBg ? 'text-white/20' : 'text-purple-primary/20'}`}>"</span>
                        <p className={`font-body text-[1rem] italic leading-relaxed ${hasDarkBg ? 'text-white/80' : 'text-ink/80'}`}>
                          {regularMedia[currentMediaIndex].caption}
                        </p>
                        <span className={`absolute -right-4 bottom-0 text-2xl font-display rotate-180 ${hasDarkBg ? 'text-white/20' : 'text-purple-primary/20'}`}>"</span>
                      </div>
                    </div>
                  )}

                  {/* Thumbnail Strip - Beautiful Design */}
                  {regularMedia.length > 1 && (
                    <div className="flex gap-3 justify-center flex-wrap">
                      {regularMedia.map((item, idx) => (
                        <button
                          key={item.id || idx}
                          onClick={() => setCurrentMediaIndex(idx)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden transition-all duration-300 ${
                            idx === currentMediaIndex
                              ? "ring-2 ring-purple-primary ring-offset-2 scale-105 shadow-lg"
                              : "opacity-60 hover:opacity-100 hover:scale-105"
                          }`}
                        >
                          {item.media_type === "video" ? (
                            <div className="relative w-full h-full bg-black">
                              <video src={item.media_url} className="w-full h-full object-cover" preload="metadata" />
                              <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M8 5v14l11-7z" />
                                </svg>
                              </div>
                            </div>
                          ) : (
                            <Image src={item.media_url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                          )}
                          {idx === currentMediaIndex && (
                            <div className="absolute inset-0 border-2 border-purple-primary rounded-xl" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

            {/* Legacy single image support */}
            {post.image && !hasMedia && (
              <Image
                src={post.image}
                alt={post.title || "Post image"}
                width={800}
                height={600}
                className="w-full rounded-xl mt-6 shadow-lg cursor-pointer hover:scale-[1.02] transition-transform"
              />
            )}

            {/* Content Warning Overlay */}
            {post.contentWarning && !showContent && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-2xl bg-white/40 rounded-xl">
                <div className="relative text-center px-8 py-10">
                  <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <span className="font-ui text-sm font-semibold text-amber-700">Content Warning</span>
                  </div>

                  <p className="font-body text-base text-ink/80 mb-6 max-w-md mx-auto">{post.contentWarning}</p>

                  <button
                    onClick={() => setShowContent(true)}
                    className="px-6 py-2.5 rounded-full font-ui text-sm font-medium text-white bg-ink/80 hover:bg-ink transition-colors"
                  >
                    Show Content
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Tags Section (Collaborators + Tagged People + Hashtags) */}
          <PostTags
            collaborators={post.collaborators}
            mentions={post.mentions}
            hashtags={post.hashtags}
            onNavigate={onClose}
          />

          {/* Actions - Floating action bar */}
          <div className={`flex items-center gap-1.5 md:gap-2 mt-auto pt-4 md:pt-6 border-t flex-wrap ${borderColorClass}`}>
            {/* Reaction Picker */}
            <ReactionPicker
              currentReaction={userReaction}
              reactionCounts={reactionCounts}
              onReact={handleReaction}
              onRemoveReaction={handleRemoveReaction}
            />

            {/* Comment Button */}
            <button
              onClick={() => setShowComments(true)}
              className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                hasDarkBg
                  ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              }`}
            >
              {icons.comment}
              {comments.length > 0 && <span className="text-xs md:text-sm font-medium">{comments.length}</span>}
            </button>

            {/* Relay Button - hidden for own posts */}
            {user?.id !== post.authorId && (
              <button
                onClick={handleRelay}
                disabled={!user}
                className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                  isRelayed
                    ? "bg-green-500/20 text-green-400"
                    : hasDarkBg
                      ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                      : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
                } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {icons.relay}
                {relayCount > 0 && <span className="text-xs md:text-sm font-medium">{relayCount}</span>}
              </button>
            )}

            {/* Share Button */}
            <button
              onClick={() => setShowShareModal(true)}
              className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
                hasDarkBg
                  ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                  : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              }`}
            >
              {icons.share}
            </button>

            {/* Save/Bookmark Button */}
            <button
              onClick={handleSave}
              disabled={!user}
              className={`w-9 h-9 md:w-11 md:h-11 rounded-full flex items-center justify-center transition-all ${
                isSaved
                  ? "bg-amber-500/20 text-amber-400"
                  : hasDarkBg
                    ? 'bg-white/10 text-white/80 hover:bg-white/20 hover:text-white'
                    : 'bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary'
              } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {isSaved ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              ) : (
                icons.bookmark
              )}
            </button>
          </div>
          </div>
        </div>

        {/* Comments Panel - Full screen on mobile */}
        {showComments && (
          <div className="discussion-panel absolute md:relative inset-0 md:inset-auto w-full md:w-auto bg-white z-40">
            {/* Comments Header */}
            <div className="p-4 md:p-5 border-b border-black/[0.06] bg-white/60 flex justify-between items-center">
              <div className="flex items-center gap-3">
                {/* Back button on mobile */}
                <button
                  onClick={() => setShowComments(false)}
                  className="md:hidden w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink transition-all"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <span className="font-ui text-[0.8rem] font-medium tracking-[0.12em] uppercase text-muted">
                  Discussion
                </span>
              </div>
              <button
                onClick={() => setShowComments(false)}
                className="hidden md:flex w-9 h-9 rounded-full items-center justify-center text-muted hover:text-pink-vivid hover:rotate-90 transition-all"
              >
                {icons.close}
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-6">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-body text-muted italic">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-5">
                  {comments.map((comment) => (
                    <CommentItem
                      key={comment.id}
                      comment={comment}
                      currentUserId={user?.id}
                      onLike={handleCommentLike}
                      onReply={handleCommentReply}
                      onDelete={handleCommentDelete}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Comment Input */}
            {user ? (
              <div className="p-4 bg-white border-t border-black/[0.06] flex gap-2.5 items-center">
                <Image
                  src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80"}
                  alt="You"
                  width={36}
                  height={36}
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-3xl px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary focus-within:shadow-lg transition-all">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add to the conversation..."
                    disabled={submitting}
                    className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.95rem] text-ink placeholder:text-muted/60 placeholder:italic"
                  />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !commentText.trim()}
                  className="w-[42px] h-[42px] rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-110 hover:shadow-lg hover:shadow-purple-primary/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                >
                  {icons.send}
                </button>
              </div>
            ) : (
              <div className="p-4 bg-white border-t border-black/[0.06] text-center">
                <p className="font-ui text-[0.9rem] text-muted">
                  <a href="/login" className="text-purple-primary hover:underline">Sign in</a> to comment
                </p>
              </div>
            )}
          </div>
        )}
      </div>

    </Modal>

    {/* Share Modal - rendered outside main modal to avoid z-index issues */}
    {post && (
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 100)}
        description={post.content.substring(0, 200)}
        type={post.type}
        authorName={post.author.name}
      />
    )}

    {/* Delete Confirmation Modal */}
    {showDeleteConfirm && (
      <>
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[2000]"
          onClick={() => !deleting && setShowDeleteConfirm(false)}
        />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] bg-white rounded-2xl shadow-2xl z-[2001] p-6">
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
    {/* Block Confirmation Modal */}
    {showBlockConfirm && (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
        <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
          <h3 className="font-display text-lg font-semibold text-ink mb-2">
            Block @{post.author.handle}?
          </h3>
          <p className="font-body text-sm text-muted mb-6">
            They won&apos;t be able to see your posts, follow you, or message you. They won&apos;t be notified.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowBlockConfirm(false)}
              className="flex-1 py-2.5 rounded-full border border-black/10 font-ui text-sm font-medium text-ink hover:bg-black/[0.03] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBlock}
              disabled={isBlocking}
              className="flex-1 py-2.5 rounded-full bg-red-500 text-white font-ui text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isBlocking ? "Blocking..." : "Block"}
            </button>
          </div>
        </div>
      </div>
    )}

    {showReportModal && (
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmit={handleReport}
        submitting={reportSubmitting}
        submitted={reportSubmitted}
      />
    )}
    </>
  );
}