"use client";

import { useRef, useEffect, useCallback, useState } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExplore, useTrendingTags } from "@/lib/hooks";
import type { ExploreTab } from "@/lib/hooks";
import PostCard from "@/components/feed/PostCard";
import Link from "next/link";

// Primary navigation tabs
const PRIMARY_TABS: { id: ExploreTab; label: string }[] = [
  { id: "for-you", label: "For You" },
  { id: "trending", label: "Trending" },
  { id: "communities", label: "Communities" },
  { id: "topics", label: "Topics" },
];

// Category filters for post types with icons
const CATEGORY_FILTERS: { id: ExploreTab; label: string }[] = [
  { id: "poem", label: "Poetry" },
  { id: "journal", label: "Journal" },
  { id: "thought", label: "Thoughts" },
  { id: "visual", label: "Visual" },
  { id: "essay", label: "Essays" },
  { id: "story", label: "Stories" },
  { id: "quote", label: "Quotes" },
];

// Loading skeleton component
function PostSkeleton() {
  return (
    <div className="bg-white rounded-2xl p-5 animate-pulse">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-full bg-gray-100" />
        <div className="flex-1">
          <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
          <div className="h-3 bg-gray-100 rounded w-24" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-4 bg-gray-100 rounded w-full" />
        <div className="h-4 bg-gray-100 rounded w-5/6" />
        <div className="h-4 bg-gray-100 rounded w-4/6" />
      </div>
      <div className="h-48 bg-gray-100 rounded-xl" />
    </div>
  );
}

// Trending tags sidebar component
function TrendingSidebar() {
  const { tags, loading } = useTrendingTags(8);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl p-5 animate-pulse">
        <div className="h-5 bg-gray-100 rounded w-32 mb-4" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-4 bg-gray-100 rounded w-24" />
              <div className="h-3 bg-gray-100 rounded w-12 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (tags.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-black/[0.04]">
      <h3 className="font-display text-sm text-ink mb-4">Trending Topics</h3>
      <div className="space-y-2">
        {tags.map((tag, index) => (
          <Link
            key={tag.name}
            href={`/explore?tag=${encodeURIComponent(tag.name)}`}
            className="flex items-center justify-between group py-2 px-2.5 -mx-2.5 rounded-lg hover:bg-purple-primary/[0.04] transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="font-ui text-[11px] text-muted/50 w-3 tabular-nums">{index + 1}</span>
              <span className="font-body text-sm text-ink group-hover:text-purple-primary transition-colors">
                {tag.name}
              </span>
            </div>
            <span className="font-ui text-[11px] text-muted/60">{tag.post_count}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

// Full Topics Tab View
function TopicsTabView() {
  const { tags, loading } = useTrendingTags(30);

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/[0.04] animate-pulse">
            <div className="w-10 h-10 rounded-lg bg-gray-100" />
            <div className="flex-1">
              <div className="h-4 bg-gray-100 rounded w-32 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-black/[0.03] flex items-center justify-center">
          <svg className="w-6 h-6 text-muted/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
          </svg>
        </div>
        <h3 className="font-display text-lg text-ink mb-2">No topics yet</h3>
        <p className="font-body text-sm text-muted max-w-[280px] mx-auto">
          Start creating posts with hashtags to see topics here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {tags.map((tag, index) => (
        <Link
          key={tag.name}
          href={`/tag/${encodeURIComponent(tag.name)}`}
          className="flex items-center gap-4 p-4 bg-white rounded-xl border border-black/[0.04] hover:border-purple-primary/20 hover:shadow-md transition-all group"
        >
          {/* Rank Badge */}
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-ui text-sm font-semibold flex-shrink-0 ${
            index === 0
              ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
              : index === 1
              ? "bg-purple-primary/20 text-purple-primary"
              : index === 2
              ? "bg-purple-primary/10 text-purple-primary/80"
              : "bg-black/[0.04] text-muted"
          }`}>
            {index + 1}
          </div>

          {/* Tag Info */}
          <div className="flex-1 min-w-0">
            <div className="font-ui text-[0.95rem] font-medium text-ink truncate group-hover:text-purple-primary transition-colors">
              #{tag.name}
            </div>
            <div className="font-body text-[0.75rem] text-muted">
              {tag.post_count} {tag.post_count === 1 ? "post" : "posts"}
              {tag.recent_posts > 0 && (
                <span className="text-purple-primary ml-2">
                  +{tag.recent_posts} this week
                </span>
              )}
            </div>
          </div>

          {/* Arrow */}
          <svg className="w-5 h-5 text-muted/40 group-hover:text-purple-primary group-hover:translate-x-0.5 transition-all flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      ))}
    </div>
  );
}

// Empty state component - minimal, no create button
function EmptyState({ tab }: { tab: ExploreTab }) {
  const messages: Record<ExploreTab, { title: string; subtitle: string }> = {
    "for-you": {
      title: "Nothing here yet",
      subtitle: "Follow creators and engage with posts to see personalized recommendations.",
    },
    trending: {
      title: "Nothing trending",
      subtitle: "Check back later to see what's popular.",
    },
    communities: {
      title: "No community posts",
      subtitle: "Posts from communities you might like will appear here.",
    },
    topics: {
      title: "No topics",
      subtitle: "Trending topics will appear here.",
    },
    poem: {
      title: "No poetry",
      subtitle: "Poetry posts will appear here.",
    },
    journal: {
      title: "No journal entries",
      subtitle: "Journal posts will appear here.",
    },
    thought: {
      title: "No thoughts",
      subtitle: "Thought posts will appear here.",
    },
    visual: {
      title: "No visual stories",
      subtitle: "Visual posts will appear here.",
    },
    essay: {
      title: "No essays",
      subtitle: "Essay posts will appear here.",
    },
    story: {
      title: "No stories",
      subtitle: "Story posts will appear here.",
    },
    letter: {
      title: "No letters",
      subtitle: "Letter posts will appear here.",
    },
    quote: {
      title: "No quotes",
      subtitle: "Quote posts will appear here.",
    },
  };

  const { title, subtitle } = messages[tab];

  return (
    <div className="text-center py-20">
      <div className="w-12 h-12 mx-auto mb-5 rounded-full bg-black/[0.03] flex items-center justify-center">
        <svg className="w-5 h-5 text-muted/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
        </svg>
      </div>
      <h3 className="font-display text-lg text-ink mb-1.5">{title}</h3>
      <p className="font-body text-sm text-muted max-w-[240px] mx-auto">{subtitle}</p>
    </div>
  );
}

// Helper function to transform post data for PostCard
function transformPostForCard(post: any) {
  const typeLabels: Record<string, string> = {
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

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author?.display_name || post.author?.username || "Unknown",
      handle: `@${post.author?.username || "unknown"}`,
      avatar: post.author?.avatar_url || "/default-avatar.png",
    },
    type: post.type,
    typeLabel: typeLabels[post.type] || "shared",
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title,
    content: post.content || "",
    contentWarning: post.content_warning,
    media: post.media,
    stats: {
      admires: post.admires_count || 0,
      comments: post.comments_count || 0,
      relays: post.relays_count || 0,
    },
    isAdmired: post.user_has_admired,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    reactionType: post.user_reaction_type,
    community: post.community,
    collaborators: post.collaborators,
    mentions: post.mentions,
    hashtags: post.hashtags,
  };
}

export default function ExplorePageContent() {
  const { user } = useAuth();
  const {
    posts,
    loading,
    error,
    pagination,
    loadMore,
    refresh,
    activeTab,
    setActiveTab,
  } = useExplore(user?.id);

  const [showCategories, setShowCategories] = useState(false);
  const [showMobileFilter, setShowMobileFilter] = useState(false);
  const observerRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  // Check if current tab is a category filter
  const isCategory = CATEGORY_FILTERS.some(c => c.id === activeTab);
  const isPrimaryTab = PRIMARY_TABS.some(t => t.id === activeTab);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    if (observerRef.current) {
      observer.observe(observerRef.current);
    }

    return () => observer.disconnect();
  }, [loadMore, pagination.hasMore, loading]);

  const handlePostDeleted = useCallback((postId: string) => {
    refresh();
  }, [refresh]);

  const handleCategorySelect = (categoryId: ExploreTab) => {
    setActiveTab(categoryId);
    setShowCategories(false);
    setShowMobileFilter(false);
  };

  const handlePrimaryTabSelect = (tabId: ExploreTab) => {
    setActiveTab(tabId);
    setShowCategories(false);
    setShowMobileFilter(false);
  };

  // Get current category label if active
  const currentCategory = CATEGORY_FILTERS.find(c => c.id === activeTab);

  return (
    <div className="min-h-screen">
      {/* Header - Desktop */}
      <header className="sticky top-0 z-40 bg-white border-b border-black/[0.05] hidden md:block">
        <div className="max-w-[640px] lg:max-w-[780px] mx-auto px-4">
          {/* Navigation Bar */}
          <div className="flex items-center h-[52px]">
            {/* Title */}
            <h1 className="font-display text-lg text-ink mr-6">Explore</h1>

            {/* Primary Tabs */}
            <div className="flex items-center h-full">
              {PRIMARY_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => handlePrimaryTabSelect(tab.id)}
                  className={`relative h-full px-4 font-ui text-[14px] transition-colors ${
                    activeTab === tab.id && isPrimaryTab
                      ? "text-ink font-medium"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                  {activeTab === tab.id && isPrimaryTab && (
                    <div className="absolute bottom-0 left-4 right-4 h-[2px] bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full" />
                  )}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-5 bg-black/[0.08] mx-3" />

            {/* Categories Dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowCategories(!showCategories)}
                className={`flex items-center gap-1.5 h-8 px-3 rounded-lg font-ui text-[13px] transition-all ${
                  isCategory
                    ? "text-purple-primary bg-purple-primary/[0.06]"
                    : "text-muted hover:text-ink hover:bg-black/[0.03]"
                }`}
              >
                {isCategory ? currentCategory?.label : "All types"}
                <svg className={`w-3.5 h-3.5 transition-transform ${showCategories ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Categories Dropdown Menu */}
              {showCategories && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowCategories(false)}
                  />
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white rounded-xl shadow-xl shadow-black/[0.08] border border-black/[0.05] py-1.5 z-50">
                    <button
                      onClick={() => handlePrimaryTabSelect("for-you")}
                      className={`w-full flex items-center justify-between px-4 py-2 text-left font-ui text-[13px] transition-colors ${
                        !isCategory
                          ? "text-purple-primary bg-purple-primary/[0.04]"
                          : "text-ink hover:bg-black/[0.03]"
                      }`}
                    >
                      <span>All types</span>
                      {!isCategory && (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="h-px bg-black/[0.05] my-1.5 mx-3" />
                    {CATEGORY_FILTERS.map((category) => (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category.id)}
                        className={`w-full flex items-center justify-between px-4 py-2 text-left font-ui text-[13px] transition-colors ${
                          activeTab === category.id
                            ? "text-purple-primary bg-purple-primary/[0.04]"
                            : "text-ink hover:bg-black/[0.03]"
                        }`}
                      >
                        <span>{category.label}</span>
                        {activeTab === category.id && (
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Header - Mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-black/[0.05] md:hidden">
        {/* Title Row with Filter Button */}
        <div className="flex items-center justify-between px-4 h-12">
          <h1 className="font-display text-lg text-ink">Explore</h1>

          {/* Filter Button - Shows current category if selected */}
          <button
            onClick={() => setShowMobileFilter(true)}
            className={`flex items-center gap-1.5 h-8 px-3 rounded-full font-ui text-[13px] transition-all ${
              isCategory
                ? "text-purple-primary bg-purple-primary/10"
                : "text-muted bg-black/[0.04]"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            {isCategory ? currentCategory?.label : "Filter"}
          </button>
        </div>

        {/* Scrollable Tabs */}
        <div
          ref={tabsScrollRef}
          className="flex items-center overflow-x-auto scrollbar-hide px-4 pb-2 gap-1 -mx-4"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <div className="flex items-center gap-1 px-4">
            {PRIMARY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handlePrimaryTabSelect(tab.id)}
                className={`relative flex-shrink-0 h-9 px-4 rounded-full font-ui text-[13px] transition-all ${
                  activeTab === tab.id && isPrimaryTab
                    ? "text-white bg-gradient-to-r from-purple-primary to-pink-vivid font-medium"
                    : "text-ink bg-black/[0.04] active:bg-black/[0.08]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Mobile Filter Modal */}
      {showMobileFilter && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileFilter(false)}
          />

          {/* Bottom Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-hidden animate-slideUp">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="w-10 h-1 rounded-full bg-black/10" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pb-3 border-b border-black/[0.05]">
              <h3 className="font-ui text-base font-medium text-ink">Filter by Type</h3>
              <button
                onClick={() => setShowMobileFilter(false)}
                className="w-8 h-8 rounded-full bg-black/[0.05] flex items-center justify-center"
              >
                <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Options */}
            <div className="p-4 pb-8 overflow-y-auto" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
              {/* All Types Option */}
              <button
                onClick={() => handlePrimaryTabSelect("for-you")}
                className={`w-full flex items-center justify-between p-4 rounded-xl mb-2 transition-all ${
                  !isCategory
                    ? "bg-purple-primary/10 border-2 border-purple-primary"
                    : "bg-black/[0.03] border-2 border-transparent"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    !isCategory ? "bg-purple-primary text-white" : "bg-black/[0.06] text-muted"
                  }`}>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                  </div>
                  <span className={`font-ui text-[15px] ${!isCategory ? "text-purple-primary font-medium" : "text-ink"}`}>
                    All Types
                  </span>
                </div>
                {!isCategory && (
                  <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {/* Category Grid */}
              <div className="grid grid-cols-2 gap-2">
                {CATEGORY_FILTERS.map((category) => (
                  <button
                    key={category.id}
                    onClick={() => handleCategorySelect(category.id)}
                    className={`flex items-center gap-2 p-3 rounded-xl transition-all ${
                      activeTab === category.id
                        ? "bg-purple-primary/10 border-2 border-purple-primary"
                        : "bg-black/[0.03] border-2 border-transparent active:bg-black/[0.06]"
                    }`}
                  >
                    <span className={`font-ui text-[14px] ${
                      activeTab === category.id ? "text-purple-primary font-medium" : "text-ink"
                    }`}>
                      {category.label}
                    </span>
                    {activeTab === category.id && (
                      <svg className="w-4 h-4 text-purple-primary ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-[640px] mx-auto px-4 py-4 md:px-4 pb-20 md:pb-4">
        {/* Topics Tab View */}
        {activeTab === "topics" ? (
          <TopicsTabView />
        ) : (
          <>
            {/* Error State */}
            {error && (
              <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-4">
                <p className="font-body text-sm text-red-600/90">{error}</p>
                <button
                  onClick={refresh}
                  className="mt-2 font-ui text-[13px] text-red-600 hover:text-red-700 underline underline-offset-2"
                >
                  Try again
                </button>
              </div>
            )}

            {/* Loading State */}
            {loading && posts.length === 0 && (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <PostSkeleton key={i} />
                ))}
              </div>
            )}

            {/* Posts */}
            {!loading && posts.length === 0 ? (
              <EmptyState tab={activeTab} />
            ) : (
              <div className="space-y-4">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={transformPostForCard(post)}
                    onPostDeleted={handlePostDeleted}
                  />
                ))}

            {/* Loading More Indicator */}
            {loading && posts.length > 0 && (
              <div className="flex justify-center py-8">
                <div className="w-5 h-5 border-[1.5px] border-black/10 border-t-ink/60 rounded-full animate-spin" />
              </div>
            )}

            {/* Infinite Scroll Trigger */}
            <div ref={observerRef} className="h-4" />

            {/* End of Feed */}
            {!pagination.hasMore && posts.length > 0 && (
              <div className="text-center py-10">
                <div className="inline-block w-8 h-px bg-black/10 mb-3" />
                <p className="font-body text-[13px] text-muted/70">You're all caught up</p>
              </div>
            )}
          </div>
        )}
        </>
        )}
      </main>
    </div>
  );
}
