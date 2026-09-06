import type { Post, RelayedPost } from "@/lib/types";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { getTimeAgo } from "@/lib/utils/time";

/**
 * A database post as the card, tile and row components want it. One shape
 * for the home feed, studios, communities and collections.
 */
export function transformPostForCard(post: Post) {
  return {
    id: post.id,
    authorId: post.author_id,
    author: {
      name: post.author.display_name || post.author.username,
      handle: `@${post.author.username}`,
      avatar: post.author.avatar_url || "/defaultprofile.png",
    },
    type: post.type,
    typeLabel: getPostTypePhrase(post.type),
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content,
    contentWarning: post.content_warning || undefined,
    media: post.media || [],
    stats: {
      admires: post.admires_count,
      reactions: post.reactions_count,
      comments: post.comments_count,
      relays: post.relays_count,
    },
    isAdmired: post.user_has_admired,
    reactionType: post.user_reaction_type,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    community: post.community ? {
      slug: post.community.slug,
      name: post.community.name,
      avatar_url: post.community.avatar_url,
    } : undefined,
    flair: post.flair || undefined,
    collaborators: (post.collaborators || []).map(c => ({
      ...c,
      status: c.status as 'pending' | 'accepted' | 'declined',
    })),
    mentions: post.mentions || [],
    hashtags: post.hashtags || [],
    styling: post.styling || null,
    post_location: post.post_location || null,
    metadata: post.metadata || null,
    spotify_track: post.spotify_track || null,
  };
}

/** A relayed post reads as the original author's post. */
export function relayToPost(relay: RelayedPost): Post {
  return { ...relay, author: relay.original_author || relay.author };
}
