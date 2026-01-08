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
  const { user } = useAuth();
  const { subscribeToTakeDeletes, subscribeToDeletes } = useModal();
  const { takes: fetchedTakes, loading: takesLoading } = useTakes(user?.id);

  // Posts state for infinite scroll
  const [posts, setPosts] = useState<Post[]>([]);
  const [takes, setTakes] = useState<Take[]>([]);
  const [page, setPage] = useState(0);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Cache for blocked users and following (to avoid refetching on each page)
  const blockedUsersRef = useRef<{ blockedBy: Set<string>; iBlocked: Set<string> } | null>(null);
  const followingIdsRef = useRef<Set<string> | null>(null);
  const privateAccountIdsRef = useRef<Set<string> | null>(null);

  // Intersection observer for infinite scroll
  const { ref: bottomRef, inView } = useInView({
    threshold: 0,
    rootMargin: "100px",
  });

  // Fetch blocked users and following list (cached)
  const fetchFilteringData = useCallback(async (currentUserId?: string) => {
    if (blockedUsersRef.current && followingIdsRef.current && privateAccountIdsRef.current) {
      return {
        blockedBy: blockedUsersRef.current.blockedBy,
        iBlocked: blockedUsersRef.current.iBlocked,
        followingIds: followingIdsRef.current,
        privateAccountIds: privateAccountIdsRef.current,
      };
    }

    let blockedBy = new Set<string>();
    let iBlocked = new Set<string>();
    let followingIds = new Set<string>();

    if (currentUserId) {
      const [blockedByResult, iBlockedResult] = await Promise.all([
        supabase.from("blocks").select("blocker_id").eq("blocked_id", currentUserId),
        supabase.from("blocks").select("blocked_id").eq("blocker_id", currentUserId),
      ]);

      (blockedByResult.data || []).forEach(b => blockedBy.add(b.blocker_id));
      (iBlockedResult.data || []).forEach(b => iBlocked.add(b.blocked_id));

      // Try with status column first, fall back to without if it doesn't exist
      const { data: followingData, error: followingError } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .eq("status", "accepted");

      if (followingError && (followingError.code === "42703" || followingError.message?.includes("status"))) {
        // Status column doesn't exist - fall back to simple query
        const { data: fallbackData } = await supabase
          .from("follows")
          .select("following_id")
          .eq("follower_id", currentUserId);
        (fallbackData || []).forEach(f => followingIds.add(f.following_id));
      } else {
        (followingData || []).forEach(f => followingIds.add(f.following_id));
      }
    }

    // Get private accounts
    const { data: privateAccountsData } = await supabase
      .from("profiles")
      .select("id")
      .eq("is_private", true);

    const privateAccountIds = new Set<string>((privateAccountsData || []).map(p => p.id));

    // Cache the results
    blockedUsersRef.current = { blockedBy, iBlocked };
    followingIdsRef.current = followingIds;
    privateAccountIdsRef.current = privateAccountIds;

    return { blockedBy, iBlocked, followingIds, privateAccountIds };
  }, []);

  // Fetch posts with pagination
  const fetchPosts = useCallback(async (pageNum: number, currentUserId?: string) => {
    try {
      const { blockedBy, iBlocked, followingIds, privateAccountIds } = await fetchFilteringData(currentUserId);

      const from = pageNum * POSTS_PER_PAGE;
      const to = (pageNum + 1) * POSTS_PER_PAGE - 1;

      // Fetch posts with range for pagination
      const { data: postsData, error: postsError } = await supabase
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
          ),
          community:communities (
            slug,
            name,
            avatar_url
          )
        `)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (postsError) throw postsError;

      // Filter posts based on visibility and blocking rules
      const filteredPosts = (postsData || []).filter(post => {
        // Filter blocked users
        if (blockedBy.has(post.author_id) || iBlocked.has(post.author_id)) {
          return false;
        }

        const isOwnPost = currentUserId && post.author_id === currentUserId;
        const isFollowing = followingIds.has(post.author_id);
        const isPrivateAccount = privateAccountIds.has(post.author_id);

        // User can always see their own posts
        if (isOwnPost) return true;

        // Posts from private accounts are only visible to accepted followers
        if (isPrivateAccount && !isFollowing) return false;

        // Check post visibility
        if (post.visibility === 'public') return true;
        if (post.visibility === 'followers' && isFollowing) return true;

        // Private posts are never shown to others
        return false;
      });

      // Check if we've reached the end
      if (postsData && postsData.length < POSTS_PER_PAGE) {
        setHasMore(false);
      }

      if (filteredPosts.length === 0) {
        return [];
      }

      const postIds = filteredPosts.map(p => p.id);

      // Batch fetch counts and additional data
      const [admiresResult, commentsResult, relaysResult, collaboratorsResult, mentionsResult, tagsResult] = await Promise.all([
        supabase.from("admires").select("post_id").in("post_id", postIds),
        supabase.from("comments").select("post_id").in("post_id", postIds),
        supabase.from("relays").select("post_id").in("post_id", postIds),
        supabase
          .from("post_collaborators")
          .select(`
            post_id,
            status,
            role,
            user:profiles!post_collaborators_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .in("post_id", postIds)
          .eq("status", "accepted"),
        supabase
          .from("post_mentions")
          .select(`
            post_id,
            user:profiles!post_mentions_user_id_fkey (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .in("post_id", postIds),
        supabase
          .from("post_tags")
          .select(`
            post_id,
            tag:tags(name)
          `)
          .in("post_id", postIds),
      ]);

      // Count occurrences per post
      const admiresCounts: Record<string, number> = {};
      const commentsCounts: Record<string, number> = {};
      const relaysCounts: Record<string, number> = {};

      (admiresResult.data || []).forEach(a => {
        admiresCounts[a.post_id] = (admiresCounts[a.post_id] || 0) + 1;
      });
      (commentsResult.data || []).forEach(c => {
        commentsCounts[c.post_id] = (commentsCounts[c.post_id] || 0) + 1;
      });
      (relaysResult.data || []).forEach(r => {
        relaysCounts[r.post_id] = (relaysCounts[r.post_id] || 0) + 1;
      });

      // Group collaborators, mentions, and hashtags by post_id
      const collaboratorsByPost: Record<string, any[]> = {};
      const mentionsByPost: Record<string, any[]> = {};
      const hashtagsByPost: Record<string, string[]> = {};

      (collaboratorsResult.data || []).forEach(c => {
        if (!collaboratorsByPost[c.post_id]) {
          collaboratorsByPost[c.post_id] = [];
        }
        collaboratorsByPost[c.post_id].push({
          status: c.status,
          role: c.role,
          user: c.user,
        });
      });

      (mentionsResult.data || []).forEach(m => {
        if (!mentionsByPost[m.post_id]) {
          mentionsByPost[m.post_id] = [];
        }
        mentionsByPost[m.post_id].push({
          user: m.user,
        });
      });

      (tagsResult.data || []).forEach((t: any) => {
        const tagName = t.tag?.name;
        if (tagName) {
          if (!hashtagsByPost[t.post_id]) {
            hashtagsByPost[t.post_id] = [];
          }
          hashtagsByPost[t.post_id].push(tagName);
        }
      });

      // Fetch user interactions if logged in
      let userAdmires = new Set<string>();
      let userSaves = new Set<string>();
      let userRelays = new Set<string>();

      if (currentUserId) {
        const [userAdmiresResult, userSavesResult, userRelaysResult] = await Promise.all([
          supabase.from("admires").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
          supabase.from("saves").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
          supabase.from("relays").select("post_id").eq("user_id", currentUserId).in("post_id", postIds),
        ]);

        userAdmires = new Set((userAdmiresResult.data || []).map(a => a.post_id));
        userSaves = new Set((userSavesResult.data || []).map(s => s.post_id));
        userRelays = new Set((userRelaysResult.data || []).map(r => r.post_id));
      }

      // Map posts with all their data
      const postsWithStats: Post[] = filteredPosts.map(post => ({
        ...post,
        media: (post.media || []).sort((a: PostMedia, b: PostMedia) => a.position - b.position),
        admires_count: admiresCounts[post.id] || 0,
        comments_count: commentsCounts[post.id] || 0,
        relays_count: relaysCounts[post.id] || 0,
        user_has_admired: userAdmires.has(post.id),
        user_has_saved: userSaves.has(post.id),
        user_has_relayed: userRelays.has(post.id),
        collaborators: collaboratorsByPost[post.id] || [],
        mentions: mentionsByPost[post.id] || [],
        hashtags: hashtagsByPost[post.id] || [],
      }));

      return postsWithStats;
    } catch (err) {
      console.error("[Feed] Error fetching posts:", err);
      throw err;
    }
  }, [fetchFilteringData]);

  // Initial load
  useEffect(() => {
    const loadInitialPosts = async () => {
      try {
        setInitialLoading(true);
        setError(null);
        const initialPosts = await fetchPosts(0, user?.id);
        setPosts(initialPosts);
        setPage(0);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch posts";
        setError(errorMessage);
      } finally {
        setInitialLoading(false);
      }
    };

    loadInitialPosts();
  }, [user?.id, fetchPosts]);

  // Load more when bottom is in view
  useEffect(() => {
    const loadMorePosts = async () => {
      if (!inView || loadingMore || !hasMore || initialLoading) return;

      try {
        setLoadingMore(true);
        const nextPage = page + 1;
        const newPosts = await fetchPosts(nextPage, user?.id);

        if (newPosts.length > 0) {
          setPosts(prev => [...prev, ...newPosts]);
          setPage(nextPage);
        }

        if (newPosts.length < POSTS_PER_PAGE) {
          setHasMore(false);
        }
      } catch (err) {
        console.error("[Feed] Error loading more posts:", err);
      } finally {
        setLoadingMore(false);
      }
    };

    loadMorePosts();
  }, [inView, loadingMore, hasMore, initialLoading, page, user?.id, fetchPosts]);

  // Sync local takes with fetched takes
  useEffect(() => {
    setTakes(fetchedTakes);
  }, [fetchedTakes]);

  // Subscribe to delete events from modal
  useEffect(() => {
    const unsubscribeTakes = subscribeToTakeDeletes((takeId) => {
      setTakes(current => current.filter(t => t.id !== takeId));
    });
    const unsubscribePosts = subscribeToDeletes((postId) => {
      setPosts(current => current.filter(p => p.id !== postId));
    });
    return () => {
      unsubscribeTakes();
      unsubscribePosts();
    };
  }, [subscribeToTakeDeletes, subscribeToDeletes]);

  // Combine and sort posts and takes by timestamp
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];

    posts.forEach(post => {
      items.push({
        type: 'post',
        data: post,
        timestamp: post.created_at,
      });
    });

    takes.forEach(take => {
      items.push({
        type: 'take',
        data: take,
        timestamp: take.created_at,
      });
    });

    // Sort by timestamp, newest first
    items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return items;
  }, [posts, takes]);

  const handlePostDeleted = (postId: string) => {
    setPosts(current => current.filter(p => p.id !== postId));
  };

  const handleTakeDeleted = (takeId: string) => {
    setTakes(current => current.filter(t => t.id !== takeId));
  };

  // Initial loading state - show 5 skeletons
  if (initialLoading || takesLoading) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        {[...Array(5)].map((_, i) => (
          <PostSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-[580px] mx-auto py-6 px-4 md:py-12 md:px-6">
        <div className="text-center text-red-500">
          <p className="font-body">{error}</p>
        </div>
      </div>
    );
  }

  if (feedItems.length === 0) {
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
                avatar:
                  post.author.avatar_url ||
                  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?ixlib=rb-1.2.1&auto=format&fit=crop&w=100&q=80",
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
            }}
            onPostDeleted={handlePostDeleted}
          />
        );
      })}

      {/* Infinite scroll trigger */}
      <div ref={bottomRef} className="h-4" />

      {/* Loading spinner for pagination */}
      {loadingMore && (
        <div className="flex justify-center py-8">
          <div className="loading-spinner" />
          <style jsx>{`
            .loading-spinner {
              width: 32px;
              height: 32px;
              border: 3px solid #e8e8e8;
              border-top-color: #8e44ad;
              border-radius: 50%;
              animation: spin 0.8s linear infinite;
            }

            @keyframes spin {
              to {
                transform: rotate(360deg);
              }
            }
          `}</style>
        </div>
      )}

      {/* End of feed message */}
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
