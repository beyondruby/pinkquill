"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/lib/hooks";
import { useCollectionItem } from "@/lib/hooks/useCollections";
import Loading from "@/components/ui/Loading";
import PostCard from "@/components/feed/PostCard";

export default function CollectionItemPage() {
  const params = useParams();
  const { user } = useAuth();

  const username = params?.username as string;
  const collectionSlug = params?.collection as string;
  const itemSlug = params?.item as string;

  // Get profile for user ID
  const { profile, loading: profileLoading } = useProfile(username, user?.id);

  // Get collection item
  const { item, loading: itemLoading, error } = useCollectionItem(
    profile?.id,
    collectionSlug,
    itemSlug
  );

  const loading = profileLoading || itemLoading;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading />
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl text-ink mb-2">Item Not Found</h1>
          <p className="font-body text-muted mb-4">This collection item doesn't exist or has been removed.</p>
          <Link
            href={`/studio/${username}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium hover:-translate-y-0.5 transition-transform"
          >
            Back to Profile
          </Link>
        </div>
      </div>
    );
  }

  // Transform posts for PostCard
  const transformedPosts = (item.posts || [])
    .filter(p => p.post)
    .map(p => {
      const post = p.post!;
      return {
        id: post.id,
        authorId: post.author?.id || "",
        author: {
          handle: `@${post.author?.username || username}`,
          name: post.author?.display_name || post.author?.username || username,
          avatar: post.author?.avatar_url || "",
          id: post.author?.id,
          isVerified: post.author?.is_verified,
        },
        type: post.type as "poem" | "journal" | "thought" | "visual" | "audio" | "video" | "essay" | "blog" | "story" | "letter" | "quote",
        typeLabel: getTypeLabel(post.type),
        timeAgo: getTimeAgo(post.created_at),
        title: post.title || undefined,
        content: post.content,
        media: post.media?.map((m, index) => ({
          id: m.id,
          media_url: m.media_url,
          media_type: m.media_type,
          caption: m.caption || null,
          position: index,
        })),
        stats: {
          admires: 0,
          reactions: 0,
          comments: 0,
          relays: 0,
        },
        isAdmired: false,
        isSaved: false,
        isRelayed: false,
      };
    });

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-muted mb-6">
        <Link href={`/studio/${username}`} className="hover:text-purple-primary transition-colors">
          @{username}
        </Link>
        <span>/</span>
        <Link href={`/studio/${username}?tab=collections`} className="hover:text-purple-primary transition-colors">
          Collections
        </Link>
        <span>/</span>
        <span className="text-ink">{item.collection?.name || collectionSlug}</span>
        <span>/</span>
        <span className="text-ink font-medium">{item.name}</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row gap-6 mb-8">
        {/* Cover Image */}
        {item.cover_url && (
          <div className="w-full md:w-48 h-48 rounded-2xl overflow-hidden flex-shrink-0">
            <img
              src={item.cover_url}
              alt={item.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Info */}
        <div className="flex-1">
          <h1 className="font-display text-2xl md:text-3xl font-semibold text-ink mb-2">
            {item.name}
          </h1>
          {item.description && (
            <p className="font-body text-muted mb-4">{item.description}</p>
          )}
          <div className="flex items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {item.posts_count || 0} posts
            </span>
            {item.collection && (
              <span className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                {item.collection.name}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Posts */}
      {transformedPosts.length === 0 ? (
        <div className="py-16 text-center bg-black/[0.02] rounded-2xl">
          <svg className="w-12 h-12 mx-auto text-muted/30 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="font-display text-lg text-ink mb-2">No Posts Yet</h3>
          <p className="font-body text-sm text-muted">
            This collection item doesn't have any posts yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {transformedPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function for time ago
function getTimeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d`;
  if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 604800)}w`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Helper function for type labels
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    poem: "wrote a poem",
    journal: "wrote in their journal",
    thought: "shared a thought",
    visual: "shared a visual story",
    audio: "recorded a voice note",
    video: "shared a video",
    essay: "wrote an essay",
    blog: "published a blog post",
    story: "shared a story",
    letter: "wrote a letter",
    quote: "shared a quote",
  };
  return labels[type] || "shared something";
}
