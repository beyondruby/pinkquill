"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { useInView } from "react-intersection-observer";
import { useTakes, Take } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import { supabase } from "@/lib/supabase";
import PostCard from "./PostCard";
import PostSkeleton from "./PostSkeleton";
import TakePostCard from "@/components/takes/TakePostCard";

const POSTS_PER_PAGE = 10;

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

type PostType = "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "screenplay" | "story" | "letter" | "quote";

interface PostMedia {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

interface Post {
  id: string;
  author_id: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  type: PostType;
  title: string | null;
  content: string;
  content_warning: string | null;
  created_at: string;
  visibility?: string;
  media: PostMedia[];
  admires_count: number;
  comments_count: number;
  relays_count: number;
  user_has_admired: boolean;
  user_has_saved: boolean;
  user_has_relayed: boolean;
  community?: {
    slug: string;
    name: string;
    avatar_url: string | null;
  } | null;
  collaborators?: Array<{
    status: 'pending' | 'accepted' | 'declined';
    role?: string | null;
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }>;
  mentions?: Array<{
    user: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  }>;
  hashtags?: string[];
  styling?: any | null;
  post_location?: string | null;
  metadata?: any | null;
  spotify_track?: {
    id: string;
    name: string;
    artist: string;
    album: string;
    albumArt: string;
    previewUrl?: string;
    externalUrl: string;
  } | null;
}

interface PostItem {
  type: 'post';
  data: Post;
  timestamp: string;
}

interface TakeItem {
  type: 'take';
  data: Take;
  timestamp: string;
}

type FeedItem = PostItem | TakeItem;

export default function Feed() {
  const { user, loading: authLoading } = useAuth();
  const { subscribeToTakeDeletes, subscribeToDeletes } = useModal();

  // Takes loading is independent - don't block posts on it
  const { takes: fetchedTakes, loading: takesLoading } = useTakes(user?.id);

  // Posts state
  const [posts, setPosts] = useState<Post[]>([]);
  const [takes, setTakes] = useState<Take[]>([]);
  const [page, setPage] = useState(0);
  const [postsLoading, setPostsLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Track if we've done initial fetch
  const fetchedRef = useRef(false);
  const lastUserIdRef = useRef<string | undefined>(undefined);

  // Intersection observer for infinite scroll
  const { ref: bottomRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Simplified fetch - single query with minimal joins
  const fetchPosts = useCallback(async (pageNum: number, userId?: string) => {
    const from = pageNum * POSTS_PER_PAGE;
    const to = from + POSTS_PER_PAGE - 1;

    // Single query - let RLS handle visibility
    const { data: postsData, error: queryError } = await supabase
      .from("posts")
      .select(`
        id,
        author_id,
        type,
        title,
        content,
        content_warning,
        created_at,
        visibility,
        styling,
        post_location,
        metadata,
        spotify_track,
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
        ),
        community:communities (
          slug,
          name,
          avatar_url
        )
      `)
      .eq("status", "published")
      .eq("visibility", "public")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (queryError) {
      throw queryError;
    }

    if (!postsData || postsData.length === 0) {
      return [];
    }

    const postIds = postsData.map(p => p.id);

    // Batch fetch counts in parallel - use count queries for efficiency
    const [admiresRes, commentsRes, relaysRes] = await Promise.all([
      supabase.from("admires").select("post_id").in("post_id", postIds),
      supabase.from("comments").select("post_id").in("post_id", postIds),
      supabase.from("relays").select("post_id").in("post_id", postIds),
    ]);

    // Count by post_id
    const admiresCount: Record<string, number> = {};
    const commentsCount: Record<string, number> = {};
    const relaysCount: Record<string, number> = {};

    (admiresRes.data || []).forEach(a => {
      admiresCount[a.post_id] = (admiresCount[a.post_id] || 0) + 1;
    });
    (commentsRes.data || []).forEach(c => {
      commentsCount[c.post_id] = (commentsCount[c.post_id] || 0) + 1;
    });
    (relaysRes.data || []).forEach(r => {
      relaysCount[r.post_id] = (relaysCount[r.post_id] || 0) + 1;
    });

    // User interactions (only if logged in)
    let userAdmires = new Set<string>();
    let userSaves = new Set<string>();
    let userRelays = new Set<string>();

    if (userId) {
      const [uAdmires, uSaves, uRelays] = await Promise.all([
        supabase.from("admires").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("saves").select("post_id").eq("user_id", userId).in("post_id", postIds),
        supabase.from("relays").select("post_id").eq("user_id", userId).in("post_id", postIds),
      ]);
      userAdmires = new Set((uAdmires.data || []).map(a => a.post_id));
      userSaves = new Set((uSaves.data || []).map(s => s.post_id));
      userRelays = new Set((uRelays.data || []).map(r => r.post_id));
    }

    // Map posts - handle Supabase returning single objects for one-to-one joins
    const processedPosts: Post[] = postsData.map(post => {
      // Supabase returns single object for one-to-many with fkey, array for many-to-many
      const author = Array.isArray(post.author) ? post.author[0] : post.author;
      const community = Array.isArray(post.community) ? post.community[0] : post.community;

      return {
        ...post,
        author: author || { username: 'unknown', display_name: null, avatar_url: null },
        community: community || null,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: admiresCount[post.id] || 0,
        comments_count: commentsCount[post.id] || 0,
        relays_count: relaysCount[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
        collaborators: [],
        mentions: [],
        hashtags: [],
      };
    });

    return processedPosts;
  }, []);

  // Initial load
  useEffect(() => {
    // Reset if user changed
    if (lastUserIdRef.current !== user?.id) {
      fetchedRef.current = false;
      lastUserIdRef.current = user?.id;
      setPosts([]);
      setPage(0);
      setHasMore(true);
    }

    // Don't fetch until auth is resolved
    if (authLoading) return;

    // Don't re-fetch if already fetched
    if (fetchedRef.current) return;

    const loadPosts = async () => {
      fetchedRef.current = true;
      setPostsLoading(true);
      setError(null);

      try {
        const initialPosts = await fetchPosts(0, user?.id);
        setPosts(initialPosts);
        setHasMore(initialPosts.length === POSTS_PER_PAGE);
      } catch (err) {
        console.error("[Feed] Error:", err);
        setError("Failed to load posts. Please refresh.");
      } finally {
        setPostsLoading(false);
      }
    };

    loadPosts();
  }, [authLoading, user?.id, fetchPosts]);

  // Load more when scrolling
  useEffect(() => {
    if (!inView || loadingMore || !hasMore || postsLoading || authLoading) return;

    const loadMore = async () => {
      setLoadingMore(true);
      try {
        const nextPage = page + 1;
        const newPosts = await fetchPosts(nextPage, user?.id);

        if (newPosts.length > 0) {
          setPosts(prev => [...prev, ...newPosts]);
          setPage(nextPage);
        }

        setHasMore(newPosts.length === POSTS_PER_PAGE);
      } catch (err) {
        console.error("[Feed] Load more error:", err);
      } finally {
        setLoadingMore(false);
      }
    };

    loadMore();
  }, [inView, loadingMore, hasMore, postsLoading, authLoading, page, user?.id, fetchPosts]);

  // Sync takes (independent of posts loading)
  useEffect(() => {
    setTakes(fetchedTakes);
  }, [fetchedTakes]);

  // Subscribe to deletes
  useEffect(() => {
    const unsubTakes = subscribeToTakeDeletes((id) => {
      setTakes(curr => curr.filter(t => t.id !== id));
    });
    const unsubPosts = subscribeToDeletes((id) => {
      setPosts(curr => curr.filter(p => p.id !== id));
    });
    return () => { unsubTakes(); unsubPosts(); };
  }, [subscribeToTakeDeletes, subscribeToDeletes]);

  // Combine posts and takes
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    posts.forEach(post => {
      items.push({ type: 'post', data: post, timestamp: post.created_at });
    });

    takes.forEach(take => {
      items.push({ type: 'take', data: take, timestamp: take.created_at });
    });

    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return items;
  }, [posts, takes]);

  const handlePostDeleted = (postId: string) => {
    setPosts(curr => curr.filter(p => p.id !== postId));
  };

  const handleTakeDeleted = (takeId: string) => {
    setTakes(curr => curr.filter(t => t.id !== takeId));
  };

  // Show skeletons only while posts are loading (don't wait for takes)
  if (authLoading || postsLoading) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        {[...Array(3)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        <div className="text-center">
          <p className="font-body text-red-500 mb-4">{error}</p>
          <button
            onClick={() => {
              fetchedRef.current = false;
              setError(null);
              setPosts([]);
              setPage(0);
              setHasMore(true);
              setPostsLoading(true);
              // Trigger re-fetch
              setTimeout(() => {
                fetchPosts(0, user?.id).then(p => {
                  setPosts(p);
                  setHasMore(p.length === POSTS_PER_PAGE);
                  setPostsLoading(false);
                  fetchedRef.current = true;
                }).catch(() => {
                  setError("Failed to load. Please refresh.");
                  setPostsLoading(false);
                });
              }, 100);
            }}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-sm font-medium text-white hover:opacity-90 transition-opacity"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show content even if takes are still loading
  if (feedItems.length === 0 && !takesLoading) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        <div className="text-center">
          <h2 className="font-display text-2xl text-ink mb-4">
            The canvas awaits
          </h2>
          <p className="font-body text-muted italic mb-6">
            No posts yet. Be the first to share your creative voice.
          </p>
          <Link
            href="/create"
            className="inline-block px-6 py-3 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid font-ui text-[0.95rem] font-medium text-white"
          >
            Create Something
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
      {feedItems.map((item) => {
        if (item.type === 'take') {
          return (
            <div key={`take-${item.data.id}`} className="feed-take-card">
              <TakePostCard take={item.data} onTakeDeleted={handleTakeDeleted} />
            </div>
          );
        }

        const post = item.data;
        return (
          <PostCard
            key={post.id}
            post={{
              id: post.id,
              authorId: post.author_id,
              author: {
                name: post.author.display_name || post.author.username,
                handle: `@${post.author.username}`,
                avatar: post.author.avatar_url || "/defaultprofile.png",
              },
              type: post.type,
              typeLabel: getTypeLabel(post.type),
              timeAgo: getTimeAgo(post.created_at),
              createdAt: post.created_at,
              title: post.title || undefined,
              content: post.content,
              contentWarning: post.content_warning || undefined,
              media: post.media || [],
              stats: {
                admires: post.admires_count,
                comments: post.comments_count,
                relays: post.relays_count,
              },
              isAdmired: post.user_has_admired,
              isSaved: post.user_has_saved,
              isRelayed: post.user_has_relayed,
              community: post.community ? {
                slug: post.community.slug,
                name: post.community.name,
                avatar_url: post.community.avatar_url,
              } : undefined,
              collaborators: post.collaborators || [],
              mentions: post.mentions || [],
              hashtags: post.hashtags || [],
              styling: post.styling || null,
              post_location: post.post_location || null,
              metadata: post.metadata || null,
              spotify_track: post.spotify_track || null,
            }}
            onPostDeleted={handlePostDeleted}
          />
        );
      })}

      {/* Infinite scroll trigger */}
      <div ref={bottomRef} className="h-4" />

      {/* Loading more indicator */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-purple-600 rounded-full animate-spin" />
        </div>
      )}

      {/* End of feed */}
      {!hasMore && feedItems.length > 0 && (
        <div className="text-center py-8">
          <p className="font-body text-muted text-sm italic">
            You've reached the end of the feed
          </p>
        </div>
      )}
    </div>
  );
}
