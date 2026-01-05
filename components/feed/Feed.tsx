"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { usePosts } from "@/lib/hooks";
import { useTakes, Take } from "@/lib/hooks/useTakes";
import { useAuth } from "@/components/providers/AuthProvider";
import { useModal } from "@/components/providers/ModalProvider";
import PostCard from "./PostCard";
import TakePostCard from "@/components/takes/TakePostCard";
import Loading from "@/components/ui/Loading";

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

interface PostItem {
  type: 'post';
  data: {
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
    media: Array<{
      id: string;
      media_url: string;
      media_type: "image" | "video";
      caption: string | null;
      position: number;
    }>;
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
  };
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
  const { posts: fetchedPosts, loading: postsLoading, error: postsError } = usePosts(user?.id);
  const { takes: fetchedTakes, loading: takesLoading } = useTakes(user?.id);
  const [posts, setPosts] = useState<typeof fetchedPosts>([]);
  const [takes, setTakes] = useState<Take[]>([]);

  // Sync local posts with fetched posts
  useEffect(() => {
    setPosts(fetchedPosts);
  }, [fetchedPosts]);

  // Sync local takes with fetched takes
  useEffect(() => {
    setTakes(fetchedTakes);
  }, [fetchedTakes]);

  // Subscribe to take delete events from modal
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

  const loading = postsLoading || takesLoading;
  const error = postsError;

  if (loading) {
    return (
      <div className="max-w-[580px] mx-auto py-16 px-6">
        <Loading text="Loading the ether" size="large" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[580px] mx-auto py-12 px-6">
        <div className="text-center text-red-500">
          <p className="font-body">{error}</p>
        </div>
      </div>
    );
  }

  if (feedItems.length === 0) {
    return (
      <div className="max-w-[580px] mx-auto py-12 px-6">
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
    <div className="max-w-[580px] mx-auto py-12 px-6">
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
    </div>
  );
}