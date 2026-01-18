"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useToggleSave, useToggleRelay, useComments, useToggleReaction, useReactionCounts, useUserReaction, useBlock, createNotification, ReactionType } from "@/lib/hooks";
import ShareModal from "@/components/ui/ShareModal";
import ReportModal from "@/components/ui/ReportModal";
import CommentItem from "@/components/feed/CommentItem";
import ReactionPicker from "@/components/feed/ReactionPicker";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import PostTags from "@/components/feed/PostTags";
import { icons } from "@/components/ui/Icons";

// Helper to clean HTML for display (keeps tags but fixes &nbsp;)
function cleanHtmlForDisplay(html: string): string {
  return html.replace(/&nbsp;/g, ' ');
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
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface JournalMetadata {
  weather?: string;
  temperature?: string;
  mood?: string;
  timeOfDay?: string;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  previewUrl?: string;
  externalUrl: string;
}

interface Post {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  content: string;
  content_warning: string | null;
  created_at: string;
  author: Author;
  media: MediaItem[];
  mentions?: TaggedUser[];
  hashtags?: string[];
  collaborators?: CollaboratorUser[];
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
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

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

function formatWeather(weather: string): string {
  return weather.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

function formatMood(mood: string): string {
  return mood.charAt(0).toUpperCase() + mood.slice(1);
}

// Weather icons for journal display
const weatherIcons: Record<string, React.ReactNode> = {
  'sunny': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="5"/><path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  'partly-cloudy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a5 5 0 0 0-4.9 4.03A5 5 0 0 0 3 11a5 5 0 0 0 5 5h9a4 4 0 0 0 0-8h-.35A5 5 0 0 0 12 2z"/></svg>,
  'cloudy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 18H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 18z"/></svg>,
  'rainy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 17l-2 4M12 17l-2 4M16 17l-2 4"/></svg>,
  'stormy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM13 14l-4 8h5l-1 4"/></svg>,
  'snowy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M17 13H7a5 5 0 0 1-.9-9.9 6 6 0 0 1 11.8 0A5 5 0 0 1 17 13zM8 16h.01M12 16h.01M16 16h.01M8 20h.01M12 20h.01M16 20h.01"/></svg>,
  'foggy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M4 14h16M4 18h12M4 10h8"/></svg>,
  'windy': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M9.59 4.59A2 2 0 1 1 11 8H2M12.59 19.41A2 2 0 1 0 14 16H2M17.73 7.73A2.5 2.5 0 1 1 19.5 12H2"/></svg>,
};

// Mood icons for journal display
const moodIcons: Record<string, React.ReactNode> = {
  'reflective': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'joyful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'melancholic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M16 16s-1.5-2-4-2-4 2-4 2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'peaceful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 14h8"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'anxious': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M8 15h8"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>,
  'grateful': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  'creative': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  'nostalgic': <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
};

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    poem: "wrote a poem",
    journal: "wrote in their journal",
    thought: "shared a thought",
    visual: "shared a visual story",
    audio: "recorded a voice note",
    video: "shared a video",
    essay: "wrote an essay",
    screenplay: "wrote a screenplay",
    story: "shared a story",
    letter: "wrote a letter",
    quote: "shared a quote",
  };
  return labels[type] || "shared something";
}

export default function PostPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;
  const { user, profile } = useAuth();

  const [post, setPost] = useState<Post | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [relayCount, setRelayCount] = useState(0);
  const [isSaved, setIsSaved] = useState(false);
  const [isRelayed, setIsRelayed] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
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

  const { toggle: toggleSave } = useToggleSave();
  const { toggle: toggleRelay } = useToggleRelay();
  const { comments, loading: commentsLoading, addComment, toggleLike, deleteComment } = useComments(postId, user?.id);

  // Reaction system hooks
  const { react: toggleReaction, removeReaction } = useToggleReaction();
  const { counts: reactionCounts } = useReactionCounts(postId);
  const { reaction: userReaction, setReaction: setUserReaction } = useUserReaction(postId, user?.id);

  // Single fetch function for all data
  const fetchData = useCallback(async () => {
    if (!postId) {
      setError("No post ID");
      setLoading(false);
      return;
    }

    try {
      // Fetch post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          *,
          author:profiles!posts_author_id_fkey (
            username,
            display_name,
            avatar_url
          ),
          media:post_media (
            id,
            media_url,
            media_type,
            caption,
            position
          )
        `)
        .eq("id", postId)
        .single();

      if (postError) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      if (!postData) {
        setError("Post not found");
        setLoading(false);
        return;
      }

      // SECURITY CHECK: Blocking (Highest Priority - Rule Set 1)
      // If User A blocks User B, User B CANNOT see User A's posts (even via direct link)
      const isOwner = user?.id === postData.author_id;

      if (!isOwner && user) {
        // Check if the post author has blocked the current user
        const { data: blockedByAuthor } = await supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", postData.author_id)
          .eq("blocked_id", user.id)
          .maybeSingle();

        if (blockedByAuthor) {
          // Author blocked this user - show as if post doesn't exist
          setError("Post not found");
          setLoading(false);
          return;
        }

        // Check if the current user has blocked the post author
        const { data: userBlockedAuthor } = await supabase
          .from("blocks")
          .select("id")
          .eq("blocker_id", user.id)
          .eq("blocked_id", postData.author_id)
          .maybeSingle();

        if (userBlockedAuthor) {
          // User blocked the author - show as if post doesn't exist
          setError("Post not found");
          setLoading(false);
          return;
        }
      }

      // SECURITY CHECK: Enforce visibility rules (Rule Set 2, 3, 4)
      const visibility = postData.visibility;

      if (visibility === "private") {
        // Private posts: only the author can see
        if (!isOwner) {
          setError("This post is private");
          setLoading(false);
          return;
        }
      } else if (visibility === "followers") {
        // Followers-only posts: only the author or their followers can see
        if (!isOwner) {
          if (!user) {
            // Not logged in - can't see followers-only content
            setError("You must be logged in to view this post");
            setLoading(false);
            return;
          }

          // Check if the current user follows the post author
          const { count: followCount } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", user.id)
            .eq("following_id", postData.author_id);

          if (!followCount || followCount === 0) {
            setError("This post is only visible to followers");
            setLoading(false);
            return;
          }
        }
      }

      // SECURITY CHECK: Private account check
      // If the author has a private account, only approved followers can see their posts
      if (!isOwner) {
        const { data: authorProfile } = await supabase
          .from("profiles")
          .select("is_private")
          .eq("id", postData.author_id)
          .single();

        if (authorProfile?.is_private) {
          if (!user) {
            setError("This post is from a private account");
            setLoading(false);
            return;
          }

          // Check if user is an accepted follower
          const { count: followCount } = await supabase
            .from("follows")
            .select("*", { count: "exact", head: true })
            .eq("follower_id", user.id)
            .eq("following_id", postData.author_id);

          if (!followCount || followCount === 0) {
            setError("This post is from a private account");
            setLoading(false);
            return;
          }
        }
      }

      // Fetch mentions (tagged people)
      let mentions: TaggedUser[] = [];
      try {
        const { data: mentionsData } = await supabase
          .from("post_mentions")
          .select(`
            user:profiles!post_mentions_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("post_id", postId);

        if (mentionsData) {
          mentions = mentionsData
            .map((m: any) => m.user)
            .filter((u: any): u is TaggedUser => u !== null && u !== undefined);
        }
      } catch {
        // Table might not exist yet
      }

      // Fetch hashtags
      let hashtags: string[] = [];
      try {
        const { data: tagsData } = await supabase
          .from("post_tags")
          .select("tag:tags(name)")
          .eq("post_id", postId);

        if (tagsData) {
          hashtags = tagsData
            .map((t: any) => t.tag?.name)
            .filter((name: any): name is string => !!name);
        }
      } catch {
        // Table might not exist yet
      }

      // Fetch collaborators
      let collaborators: CollaboratorUser[] = [];
      try {
        const { data: collabData } = await supabase
          .from("post_collaborators")
          .select(`
            role,
            user:profiles!post_collaborators_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .eq("post_id", postId)
          .eq("status", "accepted");

        if (collabData) {
          collaborators = collabData
            .map((c: any) => ({ role: c.role, user: c.user }))
            .filter((c: any) => c.user !== null);
        }
      } catch {
        // Table might not exist yet
      }

      setPost({ ...postData, mentions, hashtags, collaborators });
      setShowContent(!postData.content_warning);

      // Fetch relay count and user interactions
      const relaysResult = await supabase.from("relays").select("user_id").eq("post_id", postId);
      setRelayCount(relaysResult.data?.length || 0);

      // Check if current user has interacted (relays and saves - reactions handled by hooks)
      if (user) {
        const userRelayed = relaysResult.data?.some((r: { user_id: string }) => r.user_id === user.id) || false;
        setIsRelayed(userRelayed);

        const { data: saveData } = await supabase
          .from("saves")
          .select("user_id")
          .eq("post_id", postId)
          .eq("user_id", user.id)
          .maybeSingle();
        setIsSaved(!!saveData);
      }

      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load post");
      setLoading(false);
    }
  }, [postId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Reaction handlers
  const handleReaction = async (reactionType: ReactionType) => {
    if (!user || !post) return;

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
    if (!isSameReaction && post.author_id !== user.id) {
      await createNotification(post.author_id, user.id, "admire", post.id);
    }
  };

  const handleRemoveReaction = async () => {
    if (!user || !post || !userReaction) return;

    // Optimistic update
    setUserReaction(null);

    // Database update
    await removeReaction(post.id, user.id);
  };

  const handleSave = async () => {
    if (!user || !post) return;

    const newIsSaved = !isSaved;
    setIsSaved(newIsSaved);

    await toggleSave(post.id, user.id, !newIsSaved);
  };

  const handleRelay = async () => {
    if (!user || !post) return;
    // Can't relay your own posts
    if (user.id === post.author_id) return;

    const newIsRelayed = !isRelayed;
    setIsRelayed(newIsRelayed);
    setRelayCount(prev => newIsRelayed ? prev + 1 : Math.max(0, prev - 1));

    await toggleRelay(post.id, user.id, !newIsRelayed);

    if (newIsRelayed && post.author_id !== user.id) {
      await createNotification(post.author_id, user.id, "relay", post.id);
    }
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !user || !post) return;

    setSubmitting(true);
    const result = await addComment(user.id, commentText.trim());
    if (result.success) {
      setCommentText("");
      if (post.author_id !== user.id) {
        await createNotification(post.author_id, user.id, "comment", post.id, commentText.trim());
      }
    }
    setSubmitting(false);
  };

  const handleCommentLike = (commentId: string, isLiked: boolean) => {
    if (!user) return;
    toggleLike(commentId, user.id, isLiked);
  };

  const handleCommentReply = async (parentId: string, content: string) => {
    if (!user) return;
    await addComment(user.id, content, parentId);
  };

  const handleCommentDelete = (commentId: string) => {
    deleteComment(commentId);
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

  const isOwner = user && post && user.id === post.author_id;

  const handleDelete = async () => {
    if (!post || !user) return;

    setDeleting(true);
    try {
      // Delete related data first (media, admires, reactions, saves, relays, comments, notifications)
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

      // Navigate back to home
      router.push("/");
    } catch (err) {
      console.error("Failed to delete post:", err);
      setDeleting(false);
    }
  };

  const handleEdit = () => {
    if (!post) return;
    // Navigate to create page with post ID for editing
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
    if (!user || !post) return;

    setIsBlocking(true);
    try {
      await blockUser(user.id, post.author_id);
      setShowBlockConfirm(false);
      router.push("/");
    } catch (err) {
      console.error("Failed to block user:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  const postUrl = typeof window !== 'undefined' ? `${window.location.origin}/post/${postId}` : `/post/${postId}`;

  // Loading state
  if (loading) {
    return (
      <>
        <MobileHeader />
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[220px] min-h-screen bg-[#fdfdfd]">
          <div className="max-w-[680px] mx-auto py-12 px-4 md:px-6">
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="font-body text-muted italic">Loading post...</p>
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </>
    );
  }

  // Error state
  if (error || !post) {
    return (
      <>
        <MobileHeader />
        <LeftSidebar />
        <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[220px] min-h-screen bg-[#fdfdfd]">
          <div className="max-w-[680px] mx-auto py-12 px-4 md:px-6">
            <div className="text-center py-20">
              <h1 className="font-display text-2xl text-ink mb-4">Post not found</h1>
              <p className="font-body text-muted mb-6">This post may have been removed or doesn't exist.</p>
              <Link href="/" className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-white">
                Back to Feed
              </Link>
            </div>
          </div>
        </main>
        <MobileBottomNav />
      </>
    );
  }

  const hasMedia = post.media && post.media.length > 0;

  return (
    <>
      <MobileHeader />
      <LeftSidebar />
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[220px] min-h-screen bg-[#fdfdfd]">
        <div className="max-w-[1100px] mx-auto py-6 px-4 md:py-8 md:px-6 flex flex-col lg:flex-row gap-6">
          {/* Left Column - Post */}
          <div className="flex-1 min-w-0">
            {/* Post Card */}
            <article className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden">
            {/* Author Header */}
            <div className="flex items-center gap-3 md:gap-4 p-4 md:p-6 border-b border-black/[0.06]">
              <Link href={`/studio/${post.author.username}`}>
                <img
                  src={post.author.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt={post.author.display_name || post.author.username}
                  className="w-10 h-10 md:w-12 md:h-12 rounded-full object-cover border-2 border-white shadow-md hover:scale-110 transition-transform"
                />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/studio/${post.author.username}`} className="font-ui text-[0.9rem] md:text-[1rem] font-medium text-ink hover:text-purple-primary transition-colors truncate">
                    {post.author.display_name || post.author.username}
                  </Link>
                  <span className="font-ui text-[0.75rem] md:text-[0.85rem] text-muted hidden sm:inline">
                    {post.type === "journal" ? (
                      <span className="inline-flex items-center gap-1.5">
                        wrote in their{" "}
                        <svg className="w-4 h-4 inline" viewBox="0 0 24 24" fill="none" stroke="url(#journalGradientPage)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <defs>
                            <linearGradient id="journalGradientPage" x1="0%" y1="0%" x2="100%" y2="100%">
                              <stop offset="0%" stopColor="#8e44ad" />
                              <stop offset="50%" stopColor="#ff007f" />
                              <stop offset="100%" stopColor="#ff9f43" />
                            </linearGradient>
                          </defs>
                          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                        </svg>
                        <span className="font-medium bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm bg-clip-text text-transparent">
                          Journal
                        </span>
                      </span>
                    ) : (
                      getTypeLabel(post.type)
                    )}
                  </span>
                </div>
                <span className="font-ui text-[0.7rem] md:text-[0.8rem] text-muted">
                  {getTimeAgo(post.created_at)}
                </span>
              </div>

              {/* Post Options Menu */}
              {isOwner ? (
                <div className="relative" ref={menuRef}>
                  <button
                    onClick={() => setShowMenu(!showMenu)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                  >
                    {icons.moreHorizontal}
                  </button>

                  {/* Dropdown Menu */}
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
                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-ink hover:bg-black/[0.04] transition-all"
                  >
                    {icons.moreHorizontal}
                  </button>

                  {/* Dropdown Menu */}
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

            {/* Post Content */}
            <div className="p-4 md:p-6">
              {/* Actual Content */}
              <div className="relative">
                {/* Journal Header - Beautiful date, time, and metadata */}
                {post.type === "journal" && (
                  <div className="journal-header mb-6">
                    {/* Date with Time on same line */}
                    <div className="flex items-center gap-4 mb-4">
                      <h2 className="font-display text-2xl md:text-3xl font-normal tracking-tight text-purple-primary">
                        {formatDate(post.created_at)}
                      </h2>
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-ui bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 6v6l4 2" />
                        </svg>
                        {formatTime(post.created_at)}
                      </span>
                    </div>

                    {/* Location, Weather, Mood - Same line with creative spacing */}
                    {(post.post_location || post.metadata?.weather || post.metadata?.temperature || post.metadata?.mood) && (
                      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 mb-5 text-ink/70">
                        {/* Location */}
                        {post.post_location && (
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-purple-primary/70" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                            </svg>
                            <span className="font-ui text-sm">{post.post_location}</span>
                          </div>
                        )}

                        {/* Separator dot */}
                        {post.post_location && (post.metadata?.weather || post.metadata?.temperature) && (
                          <span className="hidden sm:block w-1 h-1 rounded-full bg-purple-primary/30" />
                        )}

                        {/* Weather with temperature */}
                        {(post.metadata?.weather || post.metadata?.temperature) && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-primary/70">
                              {post.metadata?.weather ? weatherIcons[post.metadata.weather] : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                  <path d="M14 4a6 6 0 00-6 6c0 2.5 1.5 4.5 3.5 5.5L10 20h4l-1.5-4.5c2-1 3.5-3 3.5-5.5a6 6 0 00-2-4.5" />
                                </svg>
                              )}
                            </span>
                            <span className="font-ui text-sm">
                              {post.metadata?.temperature}
                              {post.metadata?.temperature && post.metadata?.weather && <span className="mx-1 opacity-40">·</span>}
                              {post.metadata?.weather && formatWeather(post.metadata.weather)}
                            </span>
                          </div>
                        )}

                        {/* Separator dot */}
                        {(post.metadata?.weather || post.metadata?.temperature) && post.metadata?.mood && (
                          <span className="hidden sm:block w-1 h-1 rounded-full bg-purple-primary/30" />
                        )}

                        {/* Mood with prefix */}
                        {post.metadata?.mood && (
                          <div className="flex items-center gap-2">
                            <span className="text-purple-primary/70">
                              {moodIcons[post.metadata.mood] || moodIcons['reflective']}
                            </span>
                            <span className="font-ui text-sm">
                              <span className="text-muted">Mood:</span>
                              {' '}
                              <span className="italic">{formatMood(post.metadata.mood)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Elegant divider line */}
                    <div className="h-px w-full bg-gradient-to-r from-purple-primary/30 via-pink-vivid/20 to-transparent" />
                  </div>
                )}

                {/* Spotify Track Embed */}
                {post.spotify_track && (
                  <div className="mb-6">
                    <div className="rounded-xl overflow-hidden bg-gradient-to-r from-[#1DB954]/5 to-[#191414]/5 border border-[#1DB954]/20">
                      <iframe
                        src={`https://open.spotify.com/embed/track/${post.spotify_track.id}?utm_source=generator&theme=1`}
                        width="100%"
                        height="152"
                        frameBorder="0"
                        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        className="rounded-xl"
                        title={`${post.spotify_track.name} by ${post.spotify_track.artist}`}
                      />
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-2 text-muted">
                      <svg className="w-4 h-4 text-[#1DB954]" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                      </svg>
                      <span className="font-ui text-xs opacity-60">Listening to this track</span>
                    </div>
                  </div>
                )}

                {post.title && (
                  <h1 className={`font-display text-[1.3rem] md:text-[1.6rem] text-ink mb-3 md:mb-4 leading-tight ${post.type === "poem" ? "text-center" : ""}`}>
                    {post.title}
                  </h1>
                )}

                {post.type === "poem" ? (
                  <div
                    className="font-body text-[1rem] md:text-[1.15rem] text-ink leading-loose italic text-center py-3 md:py-4 post-content"
                    dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                  />
                ) : (
                  <div
                    className="font-body text-[0.95rem] md:text-[1.05rem] text-ink leading-relaxed post-content"
                    dangerouslySetInnerHTML={{ __html: cleanHtmlForDisplay(post.content) }}
                  />
                )}

              {/* Media Gallery */}
              {hasMedia && (
                <div className="mt-6">
                  <div className="relative rounded-xl overflow-hidden bg-black/[0.02]">
                    {post.media[currentMediaIndex].media_type === "video" ? (
                      <video
                        src={post.media[currentMediaIndex].media_url}
                        className="w-full max-h-[500px] object-contain bg-black"
                        controls
                        playsInline
                      />
                    ) : (
                      <img
                        src={post.media[currentMediaIndex].media_url}
                        alt=""
                        className="w-full max-h-[500px] object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("openLightbox", {
                            detail: { images: post.media, index: currentMediaIndex }
                          }));
                        }}
                      />
                    )}

                    {post.media.length > 1 && (
                      <>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === 0 ? post.media.length - 1 : prev - 1))}
                          className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-ink hover:bg-white transition-all"
                        >
                          {icons.chevronLeft}
                        </button>
                        <button
                          onClick={() => setCurrentMediaIndex((prev) => (prev === post.media.length - 1 ? 0 : prev + 1))}
                          className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg flex items-center justify-center text-ink hover:bg-white transition-all"
                        >
                          {icons.chevronRight}
                        </button>
                      </>
                    )}
                  </div>

                  {post.media[currentMediaIndex].caption && (
                    <p className="text-center font-body text-[0.9rem] text-muted italic mt-3">
                      {post.media[currentMediaIndex].caption}
                    </p>
                  )}

                  {post.media.length > 1 && (
                    <div className="flex gap-2 justify-center mt-4">
                      {post.media.map((item, idx) => (
                        <button
                          key={item.id}
                          onClick={() => setCurrentMediaIndex(idx)}
                          className={`w-14 h-14 rounded-lg overflow-hidden transition-all ${
                            idx === currentMediaIndex
                              ? "ring-2 ring-purple-primary ring-offset-2"
                              : "opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={item.media_url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

                {/* Content Warning Overlay */}
                {post.content_warning && !showContent && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center backdrop-blur-2xl bg-white/40 rounded-xl">
                    <div className="relative text-center px-8 py-10">
                      <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-amber-500/10 border border-amber-500/20 mb-5">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span className="font-ui text-sm font-semibold text-amber-700">Content Warning</span>
                      </div>

                      <p className="font-body text-base text-ink/80 mb-6 max-w-md mx-auto">{post.content_warning}</p>

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
            </div>

            {/* Tags Section (Collaborators + Tagged People + Hashtags) */}
            <div className="px-6">
              <PostTags
                collaborators={post.collaborators}
                mentions={post.mentions}
                hashtags={post.hashtags}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 md:gap-2 px-4 md:px-6 py-3 md:py-4 border-t border-black/[0.06] flex-wrap">
              {/* Reaction Picker */}
              <ReactionPicker
                currentReaction={userReaction}
                reactionCounts={reactionCounts}
                onReact={handleReaction}
                onRemoveReaction={handleRemoveReaction}
                disabled={!user}
              />

              <button
                className="flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
              >
                {icons.comment}
                {comments.length > 0 && <span className="text-xs md:text-sm font-medium">{comments.length}</span>}
              </button>

              {!isOwner && (
                <button
                  onClick={handleRelay}
                  disabled={!user}
                  className={`flex items-center gap-1.5 px-3 md:px-4 py-2 md:py-2.5 rounded-full transition-all ${
                    isRelayed
                      ? "bg-green-500/10 text-green-600"
                      : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                  } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  {icons.relay}
                  {relayCount > 0 && <span className="text-xs md:text-sm font-medium">{relayCount}</span>}
                </button>
              )}

              <div className="flex-1" />

              <button
                onClick={() => setShowShareModal(true)}
                className="w-9 h-9 md:w-10 md:h-10 rounded-full bg-black/[0.04] flex items-center justify-center text-muted hover:bg-purple-primary/10 hover:text-purple-primary transition-all"
              >
                {icons.share}
              </button>

              <button
                onClick={handleSave}
                disabled={!user}
                className={`w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center transition-all ${
                  isSaved
                    ? "bg-amber-500/10 text-amber-600"
                    : "bg-black/[0.04] text-muted hover:bg-purple-primary/10 hover:text-purple-primary"
                } ${!user ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {isSaved ? icons.bookmarkFilled : icons.bookmark}
              </button>
            </div>
          </article>
          </div>

          {/* Right Column - Discussion */}
          <div className="w-full lg:w-[360px] flex-shrink-0">
            <section className="bg-white rounded-2xl shadow-sm border border-black/[0.04] overflow-hidden lg:sticky lg:top-[86px]">
              <div className="p-4 md:p-5 border-b border-black/[0.06]">
                <h2 className="font-ui text-[0.9rem] md:text-[1rem] font-medium text-ink flex items-center gap-2">
                  {icons.comment}
                  Discussion ({comments.length})
                </h2>
              </div>

            {/* Comment Input */}
            {user ? (
              <div className="p-4 border-b border-black/[0.06] flex gap-3 items-center">
                <img
                  src={profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                  alt="You"
                  className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                />
                <div className="flex-1 flex items-center bg-[#f5f5f5] rounded-full px-4 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-primary transition-all">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                    placeholder="Add to the conversation..."
                    disabled={submitting}
                    className="flex-1 py-2.5 border-none bg-transparent outline-none font-body text-[0.9rem] text-ink placeholder:text-muted/60"
                  />
                </div>
                <button
                  onClick={handleAddComment}
                  disabled={submitting || !commentText.trim()}
                  className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white flex items-center justify-center hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {icons.send}
                </button>
              </div>
            ) : (
              <div className="p-4 border-b border-black/[0.06] text-center">
                <p className="font-ui text-[0.9rem] text-muted">
                  <Link href="/login" className="text-purple-primary hover:underline">Sign in</Link> to comment
                </p>
              </div>
            )}

            {/* Comments List */}
            <div className="p-4 max-h-[calc(100vh-280px)] overflow-y-auto">
              {commentsLoading ? (
                <div className="text-center py-8">
                  <div className="w-6 h-6 border-2 border-purple-primary border-t-transparent rounded-full animate-spin mx-auto" />
                </div>
              ) : comments.length === 0 ? (
                <div className="text-center py-8">
                  <p className="font-body text-muted italic">No comments yet. Start the conversation!</p>
                </div>
              ) : (
                <div className="space-y-4">
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
          </section>
          </div>
        </div>
      </main>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        url={postUrl}
        title={post.title || post.content.substring(0, 100)}
        description={post.content.substring(0, 200)}
        type={post.type}
        authorName={post.author.display_name || post.author.username}
        authorUsername={post.author.username}
        authorAvatar={post.author.avatar_url || ""}
        imageUrl={post.media && post.media.length > 0 ? post.media[0].media_url : ""}
      />

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <>
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[1000] animate-fadeIn"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] max-w-[400px] bg-white rounded-2xl shadow-2xl z-[1001] animate-scaleIn p-5 md:p-6">
            <h3 className="font-display text-[1.1rem] md:text-[1.3rem] text-ink mb-2 md:mb-3">Delete Post?</h3>
            <p className="font-body text-[0.85rem] md:text-[0.95rem] text-muted mb-5 md:mb-6">
              This action cannot be undone. This will permanently delete your post and remove all associated data including comments, admires, and saves.
            </p>
            <div className="flex justify-end gap-2 md:gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="px-4 md:px-5 py-2 md:py-2.5 rounded-full font-ui text-[0.85rem] md:text-[0.9rem] text-muted bg-black/[0.04] hover:bg-black/[0.08] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 md:px-5 py-2 md:py-2.5 rounded-full font-ui text-[0.85rem] md:text-[0.9rem] text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2"
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

      {/* Block Confirmation Modal */}
      {showBlockConfirm && post && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] animate-fadeIn">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 animate-scaleIn">
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              Block @{post.author.username}?
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

      <MobileBottomNav />
    </>
  );
}
