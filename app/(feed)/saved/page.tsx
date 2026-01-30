"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useSavedPosts, useToggleSave } from "@/lib/hooks";
import { useSavedTakes, Take } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { supabase } from "@/lib/supabase";
import Loading, { FullPageLoading } from "@/components/ui/Loading";

function getTimeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTypeIcon(type: string): React.ReactNode {
  const icons: Record<string, React.ReactNode> = {
    take: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="8" width="18" height="13" rx="2" />
        <path d="M3 8l3-5h12l3 5" />
        <path d="M7 3l2 5M11 3l2 5M15 3l2 5" />
        <path d="M10 14l4 2.5-4 2.5v-5" fill="currentColor" stroke="none" />
      </svg>
    ),
    poem: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    ),
    journal: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
      </svg>
    ),
    thought: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    visual: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    audio: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
    video: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
      </svg>
    ),
    essay: (
      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    quote: (
      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
      </svg>
    ),
  };
  return icons[type] || icons.thought;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    take: "Take",
    poem: "Poem",
    journal: "Journal",
    thought: "Thought",
    visual: "Visual",
    audio: "Audio",
    video: "Video",
    essay: "Essay",
    screenplay: "Screenplay",
    story: "Story",
    letter: "Letter",
    quote: "Quote",
  };
  return labels[type] || "Post";
}

function stripHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  return doc.body.textContent || "";
}

type PostType = "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "blog" | "story" | "letter" | "quote";
type TabType = "all" | "posts" | "takes";

interface SavedPost {
  id: string;
  author_id: string;
  type: string;
  title: string | null;
  content: string;
  content_warning: string | null;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
  media: Array<{
    id: string;
    media_url: string;
    media_type: "image" | "video";
    caption: string | null;
    position: number;
  }> | null;
  admires_count: number;
  comments_count: number;
  user_has_saved: boolean;
}

export default function SavedPage() {
  const { user, loading: authLoading } = useAuth();
  const { posts, loading: postsLoading, error: postsError, refetch: refetchPosts } = useSavedPosts(user?.id);
  const { takes, loading: takesLoading, error: takesError, refetch: refetchTakes } = useSavedTakes(user?.id);
  const { openPostModal } = useModal();
  const { toggle: toggleSave } = useToggleSave();
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [removedItems, setRemovedItems] = useState<Set<string>>(new Set());
  const [removingItem, setRemovingItem] = useState<string | null>(null);

  const loading = postsLoading || takesLoading;
  const error = postsError || takesError;

  const handleUnsavePost = useCallback(async (e: React.MouseEvent, postId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    setRemovingItem(postId);
    await toggleSave(postId, user.id, true);

    setTimeout(() => {
      setRemovedItems(prev => new Set([...prev, postId]));
      setRemovingItem(null);
    }, 300);
  }, [user, toggleSave]);

  const handleUnsaveTake = useCallback(async (e: React.MouseEvent, takeId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    setRemovingItem(takeId);
    await supabase.from("take_saves").delete().eq("take_id", takeId).eq("user_id", user.id);

    setTimeout(() => {
      setRemovedItems(prev => new Set([...prev, takeId]));
      setRemovingItem(null);
    }, 300);
  }, [user]);

  const handleOpenPost = useCallback((post: SavedPost) => {
    openPostModal({
      id: post.id,
      authorId: post.author_id,
      author: {
        name: post.author?.display_name || post.author?.username || "Unknown",
        handle: `@${post.author?.username || "unknown"}`,
        avatar: post.author?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100",
      },
      type: post.type as PostType,
      typeLabel: getTypeLabel(post.type),
      timeAgo: getTimeAgo(post.created_at),
      createdAt: post.created_at,
      title: post.title || undefined,
      content: post.content,
      contentWarning: post.content_warning || undefined,
      media: post.media?.map(m => ({
        id: m.id,
        media_url: m.media_url,
        media_type: m.media_type,
        caption: m.caption,
        position: m.position,
      })),
      stats: {
        admires: post.admires_count || 0,
        comments: post.comments_count || 0,
        relays: 0,
      },
      isAdmired: false,
      isSaved: true,
      isRelayed: false,
    });
  }, [openPostModal]);

  const visiblePosts = posts.filter(post => !removedItems.has(post.id));
  const visibleTakes = takes.filter(take => !removedItems.has(take.id));

  const totalCount = visiblePosts.length + visibleTakes.length;
  const displayedPosts = activeTab === "takes" ? [] : visiblePosts;
  const displayedTakes = activeTab === "posts" ? [] : visibleTakes;

  if (authLoading) {
    return <FullPageLoading text="Loading" />;
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 mx-auto mb-8 relative">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-primary/20 to-pink-vivid/20 blur-xl" />
            <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
          </div>
          <h1 className="font-display text-3xl text-ink mb-4">Your Collection</h1>
          <p className="font-body text-muted mb-8 text-lg">
            Sign in to save posts and build your personal collection. Everything you save is private to you.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold text-lg shadow-xl shadow-purple-primary/30 hover:shadow-2xl hover:scale-[1.02] transition-all"
          >
            Sign In to Start Saving
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/90 backdrop-blur-xl border-b border-black/[0.04]">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center shadow-lg shadow-purple-primary/25">
                <svg className="w-7 h-7 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-3xl text-ink">Saved</h1>
                <p className="font-body text-muted mt-0.5">
                  {totalCount} {totalCount === 1 ? 'item' : 'items'} in your collection
                </p>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-4 py-2 rounded-full font-ui text-sm transition-all ${
                activeTab === "all"
                  ? "bg-purple-primary text-white shadow-md"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              All ({totalCount})
            </button>
            <button
              onClick={() => setActiveTab("posts")}
              className={`px-4 py-2 rounded-full font-ui text-sm transition-all ${
                activeTab === "posts"
                  ? "bg-purple-primary text-white shadow-md"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              Posts ({visiblePosts.length})
            </button>
            <button
              onClick={() => setActiveTab("takes")}
              className={`px-4 py-2 rounded-full font-ui text-sm transition-all ${
                activeTab === "takes"
                  ? "bg-purple-primary text-white shadow-md"
                  : "bg-gray-100 text-muted hover:bg-gray-200"
              }`}
            >
              Takes ({visibleTakes.length})
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loading text="Loading your collection" size="large" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <p className="font-body text-red-500 mb-6 text-lg">{error}</p>
            <button
              onClick={() => { refetchPosts(); refetchTakes(); }}
              className="px-6 py-3 rounded-xl bg-purple-primary/10 text-purple-primary font-ui font-medium hover:bg-purple-primary/20 transition-all"
            >
              Try Again
            </button>
          </div>
        ) : displayedPosts.length === 0 && displayedTakes.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-32 h-32 mx-auto mb-8 relative">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 blur-2xl" />
              <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 flex items-center justify-center border-2 border-dashed border-purple-primary/20">
                <svg className="w-14 h-14 text-purple-primary/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </div>
            </div>
            <h2 className="font-display text-2xl text-ink mb-3">
              {activeTab === "all" ? "Start your collection" : `No saved ${activeTab}`}
            </h2>
            <p className="font-body text-muted mb-8 max-w-md mx-auto text-lg">
              {activeTab === "takes"
                ? "Save takes you love by tapping the bookmark icon. They'll appear here."
                : "Save posts you love by tapping the bookmark icon. They'll appear here for you to revisit anytime."
              }
            </p>
            <Link
              href={activeTab === "takes" ? "/takes" : "/"}
              className="inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold shadow-xl shadow-purple-primary/30 hover:shadow-2xl hover:scale-[1.02] transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
              </svg>
              {activeTab === "takes" ? "Explore Takes" : "Explore Feed"}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Render Posts */}
            {displayedPosts.map((post) => {
              const hasMedia = post.media && post.media.length > 0;
              const firstMedia = hasMedia ? post.media![0] : null;
              const plainContent = stripHtml(post.content);
              const isRemoving = removingItem === post.id;

              return (
                <div
                  key={`post-${post.id}`}
                  onClick={() => handleOpenPost(post)}
                  className={`group relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isRemoving ? 'opacity-0 scale-95' : 'hover:scale-[1.02] hover:shadow-xl'
                  }`}
                >
                  {/* Background */}
                  {hasMedia && firstMedia?.media_type === "image" ? (
                    <img
                      src={firstMedia.media_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : hasMedia && firstMedia?.media_type === "video" ? (
                    <video
                      src={firstMedia.media_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                    />
                  ) : (
                    <div className={`absolute inset-0 ${
                      post.type === 'poem' ? 'bg-gradient-to-br from-purple-100 to-pink-50' :
                      post.type === 'journal' ? 'bg-gradient-to-br from-amber-50 to-orange-50' :
                      post.type === 'thought' ? 'bg-gradient-to-br from-blue-50 to-indigo-50' :
                      post.type === 'essay' ? 'bg-gradient-to-br from-slate-50 to-gray-100' :
                      post.type === 'quote' ? 'bg-gradient-to-br from-emerald-50 to-teal-50' :
                      'bg-gradient-to-br from-gray-50 to-slate-100'
                    }`} />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Type badge */}
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm">
                      <span className="text-purple-primary">{getTypeIcon(post.type)}</span>
                      <span className="font-ui text-[0.7rem] font-medium text-ink/80">{getTypeLabel(post.type)}</span>
                    </div>
                  </div>

                  {/* Unsave button */}
                  <button
                    onClick={(e) => handleUnsavePost(e, post.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:scale-110"
                  >
                    <svg className="w-4 h-4 text-purple-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>

                  {/* Content preview (for text posts) */}
                  {!hasMedia && (
                    <div className="absolute inset-x-4 top-14 bottom-20">
                      <p className={`font-body text-sm text-ink/80 line-clamp-6 ${
                        post.type === 'poem' ? 'italic text-center' : ''
                      }`}>
                        {post.title && <span className="font-semibold block mb-2">{post.title}</span>}
                        {plainContent}
                      </p>
                    </div>
                  )}

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={post.author?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-white/30"
                      />
                      <span className="font-ui text-xs text-white/90 truncate">
                        {post.author?.display_name || post.author?.username || "Unknown"}
                      </span>
                    </div>
                    {post.title && hasMedia && (
                      <p className="font-display text-sm text-white line-clamp-2 mb-1">
                        {post.title}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-white/70">
                      <span className="flex items-center gap-1 text-xs">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        {post.admires_count || 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {post.comments_count || 0}
                      </span>
                      <span className="text-xs ml-auto">{getTimeAgo(post.created_at)}</span>
                    </div>
                  </div>

                  {/* Media count indicator */}
                  {hasMedia && post.media!.length > 1 && (
                    <div className="absolute top-3 right-12 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                      <span className="font-ui text-[0.65rem] text-white font-medium">
                        +{post.media!.length - 1}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Render Takes */}
            {displayedTakes.map((take) => {
              const isRemoving = removingItem === take.id;

              return (
                <Link
                  key={`take-${take.id}`}
                  href={`/takes?id=${take.id}`}
                  className={`group relative aspect-[4/5] rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 ${
                    isRemoving ? 'opacity-0 scale-95' : 'hover:scale-[1.02] hover:shadow-xl'
                  }`}
                >
                  {/* Video thumbnail */}
                  {take.thumbnail_url ? (
                    <img
                      src={take.thumbnail_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <video
                      src={take.video_url}
                      className="absolute inset-0 w-full h-full object-cover"
                      muted
                      playsInline
                    />
                  )}

                  {/* Gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

                  {/* Play icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>

                  {/* Type badge */}
                  <div className="absolute top-3 left-3">
                    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/90 backdrop-blur-sm">
                      <span className="text-rose-500">{getTypeIcon("take")}</span>
                      <span className="font-ui text-[0.7rem] font-medium text-ink/80">Take</span>
                    </div>
                  </div>

                  {/* Unsave button */}
                  <button
                    onClick={(e) => handleUnsaveTake(e, take.id)}
                    className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white hover:scale-110 z-10"
                  >
                    <svg className="w-4 h-4 text-purple-primary" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                  </button>

                  {/* Bottom info */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <img
                        src={take.author?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100"}
                        alt=""
                        className="w-6 h-6 rounded-full object-cover border border-white/30"
                      />
                      <span className="font-ui text-xs text-white/90 truncate">
                        {take.author?.display_name || take.author?.username || "Unknown"}
                      </span>
                    </div>
                    {take.caption && (
                      <p className="font-body text-sm text-white line-clamp-2 mb-1">
                        {take.caption}
                      </p>
                    )}
                    <div className="flex items-center gap-3 text-white/70">
                      <span className="flex items-center gap-1 text-xs">
                        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                        </svg>
                        {take.admires_count || 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {take.comments_count || 0}
                      </span>
                      <span className="text-xs ml-auto">{getTimeAgo(take.created_at)}</span>
                    </div>
                  </div>

                  {/* Duration indicator */}
                  {take.duration && (
                    <div className="absolute top-3 right-12 px-2 py-1 rounded-full bg-black/50 backdrop-blur-sm">
                      <span className="font-ui text-[0.65rem] text-white font-medium">
                        {Math.floor(take.duration / 60)}:{String(Math.floor(take.duration % 60)).padStart(2, '0')}
                      </span>
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
