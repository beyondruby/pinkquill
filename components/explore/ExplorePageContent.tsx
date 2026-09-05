"use client";

import { useRef, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useExplore } from "@/lib/hooks/useExplore";
import { useTrendingTags } from "@/lib/hooks/useTags";
import type { ExploreTab } from "@/lib/hooks/useExplore";
import PostCard from "@/components/feed/PostCard";
import PostSkeleton from "@/components/feed/PostSkeleton";
import type { PostProps, PostType } from "@/components/feed/PostCard/types";
import { PageFrame, PageHeader } from "@/components/layout/PageFrame";
import { NavIcon } from "@/components/layout/navigation";
import { TabRow } from "@/components/ui/Tabs";
import ActionMenu, { type ActionMenuItem } from "@/components/ui/ActionMenu";
import Button from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Loading";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { getTimeAgoCompact } from "@/lib/utils/time";
import { DEFAULT_AVATAR } from "@/lib/utils/image";

// The four ways to look around, and the type filter that narrows any of them.
const PRIMARY_TABS: { id: ExploreTab; label: string }[] = [
  { id: "for-you", label: "For you" },
  { id: "trending", label: "Trending" },
  { id: "communities", label: "Communities" },
  { id: "topics", label: "Topics" },
];

const TYPE_FILTERS: { id: ExploreTab; label: string }[] = [
  { id: "poem", label: "Poetry" },
  { id: "journal", label: "Journals" },
  { id: "thought", label: "Thoughts" },
  { id: "visual", label: "Visual" },
  { id: "essay", label: "Essays" },
  { id: "story", label: "Stories" },
  { id: "quote", label: "Quotes" },
];

const EMPTY_COPY: Record<ExploreTab, { title: string; text: string }> = {
  "for-you": { title: "Nothing here yet", text: "Follow a few people and react to work you like, and this fills in around you." },
  trending: { title: "Nothing trending right now", text: "Come back a little later to see what people are gathering around." },
  communities: { title: "No community posts yet", text: "Posts from communities you might like will show up here." },
  topics: { title: "No topics yet", text: "Tags people use in their posts appear here once there are a few." },
  poem: { title: "No poetry yet", text: "Poems people share will appear here." },
  journal: { title: "No journals yet", text: "Journal entries people share will appear here." },
  thought: { title: "No thoughts yet", text: "Short thoughts people share will appear here." },
  visual: { title: "No visual work yet", text: "Photos and visual work people share will appear here." },
  essay: { title: "No essays yet", text: "Essays people share will appear here." },
  story: { title: "No stories yet", text: "Stories people share will appear here." },
  letter: { title: "No letters yet", text: "Letters people share will appear here." },
  quote: { title: "No quotes yet", text: "Quotes people share will appear here." },
};

function TopicsList() {
  const { tags, loading } = useTrendingTags(30);

  if (loading) {
    return (
      <div className="pq-list" aria-hidden="true">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="pq-list-row">
            <span className="pq-skeleton w-10 h-10 rounded-[0.625rem]" />
            <span className="grid gap-1.5 flex-1">
              <span className="pq-skeleton h-3 w-32" />
              <span className="pq-skeleton h-2.5 w-20" />
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="pq-feed-state pq-feed-state--card">
        <p className="pq-feed-state__title">{EMPTY_COPY.topics.title}</p>
        <p className="pq-feed-state__text">{EMPTY_COPY.topics.text}</p>
      </div>
    );
  }

  return (
    <nav className="pq-list" aria-label="Topics">
      {tags.map((tag) => (
        <Link key={tag.name} href={`/tag/${encodeURIComponent(tag.name)}`} className="pq-list-row">
          <span className="pq-list-row__mark" aria-hidden="true">#</span>
          <span className="pq-list-row__text">
            <span className="pq-list-row__title">#{tag.name}</span>
            <span className="pq-list-row__meta">
              {tag.post_count.toLocaleString()} {tag.post_count === 1 ? "post" : "posts"}
              {tag.recent_posts > 0 && ` · ${tag.recent_posts} this week`}
            </span>
          </span>
          <NavIcon name="back" className="rotate-180" />
        </Link>
      ))}
    </nav>
  );
}

type ExplorePost = ReturnType<typeof useExplore>["posts"][number];

function transformPostForCard(post: ExplorePost): PostProps {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author?.display_name || post.author?.username || "Unknown",
      handle: `@${post.author?.username || "unknown"}`,
      avatar: post.author?.avatar_url || DEFAULT_AVATAR,
    },
    type: post.type as PostType,
    typeLabel: getPostTypePhrase(post.type),
    timeAgo: getTimeAgoCompact(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content || "",
    contentWarning: post.content_warning || undefined,
    media: post.media,
    stats: {
      admires: post.admires_count || 0,
      reactions: post.reactions_count || post.admires_count || 0,
      comments: post.comments_count || 0,
      relays: post.relays_count || 0,
    },
    isAdmired: post.user_has_admired,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    reactionType: post.user_reaction_type,
    community: post.community ?? undefined,
    flair: post.flair || undefined,
    collaborators: (post.collaborators || []).map((c) => ({ ...c, status: c.status as "pending" | "accepted" | "declined" })),
    mentions: post.mentions,
    hashtags: post.hashtags,
  } as PostProps;
}

export default function ExplorePageContent() {
  const { user, loading: authLoading } = useAuth();
  const {
    posts,
    loading: exploreLoading,
    error,
    pagination,
    loadMore,
    refresh,
    activeTab,
    setActiveTab,
  } = useExplore(user?.id, { enabled: !authLoading });
  const loading = authLoading || exploreLoading;

  const observerRef = useRef<HTMLDivElement>(null);

  // Auto-recovery: if loading is stuck for >12s, force a retry
  const retryCountRef = useRef(0);
  useEffect(() => {
    if (loading && posts.length === 0) {
      const timer = setTimeout(() => {
        if (retryCountRef.current < 2) {
          retryCountRef.current += 1;
          console.warn(`[Explore] Loading stuck for >12s, auto-retrying (attempt ${retryCountRef.current})`);
          refresh();
        }
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      retryCountRef.current = 0;
    }
  }, [loading, posts.length, refresh]);

  const typeFilter = TYPE_FILTERS.find((c) => c.id === activeTab);
  const isPrimaryTab = PRIMARY_TABS.some((t) => t.id === activeTab);
  // A type filter narrows "For you"; the tab row shows that as its home.
  const tabValue: ExploreTab = isPrimaryTab ? activeTab : "for-you";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && pagination.hasMore && !loading) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );
    if (observerRef.current) observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [loadMore, pagination.hasMore, loading]);

  const handlePostDeleted = useCallback(() => {
    refresh();
  }, [refresh]);

  const typeMenuItems = useMemo<ActionMenuItem[]>(() => [
    { label: "All types", onSelect: () => setActiveTab("for-you"), tone: typeFilter ? "default" : "accent" },
    ...TYPE_FILTERS.map((c) => ({
      label: c.label,
      onSelect: () => setActiveTab(c.id),
      tone: (activeTab === c.id ? "accent" : "default") as ActionMenuItem["tone"],
      dividerBefore: c.id === TYPE_FILTERS[0].id,
    })),
  ], [activeTab, setActiveTab, typeFilter]);

  const empty = EMPTY_COPY[activeTab];

  return (
    <PageFrame width="narrow">
      <PageHeader
        title="Explore"
        lede="Wander through what people are making, by mood, by medium, or by what's catching on."
      />

      <div className="flex items-end justify-between gap-3 mb-5">
        <TabRow
          items={PRIMARY_TABS}
          value={tabValue}
          onChange={(id) => setActiveTab(id)}
          ariaLabel="Explore"
          className="flex-1 min-w-0"
        />
        {activeTab !== "topics" && (
          <ActionMenu
            items={typeMenuItems}
            label="Post type"
            buttonAriaLabel={typeFilter ? `Post type: ${typeFilter.label}` : "Post type: all"}
            buttonClassName={`pq-chip ${typeFilter ? "" : ""}`.trim()}
            trigger={
              <>
                <span aria-hidden="true">{typeFilter ? typeFilter.label : "All types"}</span>
                <NavIcon name="back" className="-rotate-90 w-3.5 h-3.5" />
              </>
            }
            widthClassName="w-48"
            portal
          />
        )}
      </div>

      <div role="tabpanel" aria-label={PRIMARY_TABS.find((t) => t.id === tabValue)?.label}>
        {activeTab === "topics" ? (
          <TopicsList />
        ) : (
          <>
            {error && (
              <div className="pq-feed-state pq-feed-state--card mb-4" role="alert">
                <p className="pq-feed-state__title">Explore didn&rsquo;t load</p>
                <p className="pq-feed-state__text">{error}</p>
                <div className="pq-feed-state__actions">
                  <Button variant="secondary" onClick={() => refresh()}>Try again</Button>
                </div>
              </div>
            )}

            {loading && posts.length === 0 && !error && (
              <div className="pq-feed-list">
                <div role="status" aria-live="polite" className="sr-only">Loading</div>
                {[0, 1, 2].map((i) => <PostSkeleton key={i} />)}
              </div>
            )}

            {!loading && posts.length === 0 && !error && (
              <div className="pq-feed-state pq-feed-state--card">
                <p className="pq-feed-state__title">{empty.title}</p>
                <p className="pq-feed-state__text">{empty.text}</p>
                {typeFilter && (
                  <div className="pq-feed-state__actions">
                    <Button variant="secondary" onClick={() => setActiveTab("for-you")}>Show all types</Button>
                  </div>
                )}
              </div>
            )}

            {posts.length > 0 && (
              <div className="pq-feed-list">
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={transformPostForCard(post)}
                    onPostDeleted={handlePostDeleted}
                    disableRealtimeSubscriptions={true}
                  />
                ))}

                {loading && (
                  <div className="pq-feed-more" role="status" aria-label="Loading more">
                    <Spinner size="lg" />
                  </div>
                )}

                <div ref={observerRef} className="h-4" />

                {!pagination.hasMore && (
                  <p className="pq-feed-end">That&rsquo;s everything for now.</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </PageFrame>
  );
}
