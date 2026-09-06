"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import { useProfile } from "@/lib/hooks/useProfile";
import { useCollectionItem } from "@/lib/hooks/useCollections";
import { PageFrame } from "@/components/layout/PageFrame";
import { Spinner } from "@/components/ui/Loading";
import PostCard from "@/components/feed/PostCard";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { getTimeAgoCompact } from "@/lib/utils/time";
import "@/components/studio/studio.css";

/** One item inside a collection (an album, a book, a series) and the posts filed under it. */
export default function CollectionItemPage() {
  const params = useParams();
  const { user } = useAuth();
  const username = params?.username as string;
  const collectionSlug = params?.collection as string;
  const itemSlug = params?.item as string;

  const { profile, loading: profileLoading } = useProfile(username, user?.id);
  const { item, loading: itemLoading, error } = useCollectionItem(profile?.id, collectionSlug, itemSlug);
  const loading = profileLoading || itemLoading;

  if (loading) {
    return (
      <PageFrame width="reading" className="pq-studio">
        <div className="pq-feed-state" role="status" aria-label="Loading"><Spinner size="lg" /></div>
      </PageFrame>
    );
  }

  if (error || !item) {
    return (
      <PageFrame width="reading" className="pq-studio">
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">Nothing here</p>
          <p className="pq-feed-state__text">This item isn&rsquo;t in the collection any more, or never was.</p>
          <div className="pq-feed-state__actions">
            <Link href={`/studio/${username}?tab=collections`} className="pq-button pq-button--md pq-button--secondary">Back to the studio</Link>
          </div>
        </div>
      </PageFrame>
    );
  }

  const posts = (item.posts || [])
    .filter((p) => p.post)
    .map((p) => {
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
        typeLabel: getPostTypePhrase(post.type),
        timeAgo: getTimeAgoCompact(post.created_at),
        title: post.title || undefined,
        content: post.content,
        media: post.media?.map((m, index) => ({ id: m.id, media_url: m.media_url, media_type: m.media_type, caption: m.caption || null, position: index })),
        stats: { admires: 0, reactions: 0, comments: 0, relays: 0 },
        isAdmired: false,
        isSaved: false,
        isRelayed: false,
      };
    });
  const postWord = `${item.posts_count || 0} ${item.posts_count === 1 ? "post" : "posts"}`;

  return (
    <PageFrame width="reading" className="pq-studio">
      <nav className="pq-crumbs" aria-label="You are here">
        <Link href={`/studio/${username}`}>@{username}</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/studio/${username}?tab=collections`}>Collections</Link>
        <span aria-hidden="true">/</span>
        <span>{item.collection?.name || collectionSlug}</span>
      </nav>

      <header className="pq-collection-item-head">
        {item.cover_url && <img src={item.cover_url} alt="" className="pq-collection-item-head__cover" />}
        <div className="pq-collection-item-head__text">
          <h1 className="pq-collection-item-head__name">{item.name}</h1>
          {item.description && <p className="pq-collection-item-head__desc">{item.description}</p>}
          <p className="pq-collection-item-head__meta">
            {postWord}
            {item.collection && <> · in {item.collection.name}</>}
          </p>
        </div>
      </header>

      {posts.length === 0 ? (
        <div className="pq-feed-state pq-feed-state--card">
          <p className="pq-feed-state__title">No posts in here yet</p>
          <p className="pq-feed-state__text">Posts filed under this item will show up here.</p>
        </div>
      ) : (
        <div className="pq-feed pq-feed--classic">
          {posts.map((post) => <PostCard key={post.id} post={post} disableRealtimeSubscriptions />)}
        </div>
      )}
    </PageFrame>
  );
}
