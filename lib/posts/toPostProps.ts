import type {
  CommunityFlair,
  JournalMetadata,
  PostMedia,
  PostStyling,
  ReactionCounts,
  ReactionType,
  SpotifyTrack,
} from "@/lib/types";
import type { ModalPost, PostProps, PostType } from "@/components/feed/PostCard/types";
import { getPostTypePhrase } from "@/lib/feed-view/post-type-theme";
import { getTimeAgo } from "@/lib/utils/time";

export const DEFAULT_AVATAR = "/defaultprofile.png";

interface UserLike {
  id?: string;
  username?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

/**
 * What a list row must carry to become card / modal props. The feed's rows
 * (`lib/types` `Post`) have all of it; saved / explore / collection rows have
 * a subset and the optional fields fall back to "unknown", which the
 * engagement store then fetches.
 */
export interface PostLike {
  id: string;
  author_id?: string | null;
  type: string;
  title?: string | null;
  content?: string | null;
  created_at: string;
  content_warning?: string | null;
  author?: UserLike | null;
  media?: Array<Partial<PostMedia> & Pick<PostMedia, "id" | "media_url" | "media_type">> | null;
  reactions_count?: number | null;
  reaction_counts?: ReactionCounts;
  comments_count?: number | null;
  relays_count?: number | null;
  user_reaction_type?: ReactionType | null;
  user_has_saved?: boolean;
  user_has_relayed?: boolean;
  community?: { slug: string; name: string; avatar_url?: string | null } | null;
  flair?: CommunityFlair | null;
  collaborators?: Array<{ status?: string | null; role?: string | null; user: UserLike & { id: string; username: string } }>;
  mentions?: Array<{ user: UserLike & { id: string; username: string } }>;
  hashtags?: string[];
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
}

/**
 * The one row → `PostProps` mapper (finding V-5 / P-29 / F-32: six hand-written
 * copies disagreed on the type phrase, the default avatar, and which fields —
 * content warning, mentions, hashtags, Spotify track — reached the modal).
 * `overrides` lets a caller pin what it knows better than the row (e.g. the
 * saved page knows `isSaved: true`).
 */
export function toPostProps(post: PostLike, overrides: Partial<PostProps> = {}): PostProps {
  const author = post.author;
  return {
    id: post.id,
    authorId: post.author_id || author?.id || "",
    author: {
      name: author?.display_name || author?.username || "Unknown",
      handle: `@${author?.username || "unknown"}`,
      avatar: author?.avatar_url || DEFAULT_AVATAR,
    },
    type: post.type as PostType,
    typeLabel: getPostTypePhrase(post.type),
    timeAgo: getTimeAgo(post.created_at),
    createdAt: post.created_at,
    title: post.title || undefined,
    content: post.content || "",
    contentWarning: post.content_warning || undefined,
    media: (post.media || []).map((m, index) => ({
      id: m.id,
      media_url: m.media_url,
      media_type: m.media_type,
      caption: m.caption ?? null,
      position: m.position ?? index,
    })),
    stats: {
      // `undefined` = unknown; the engagement store fetches it.
      reactions: post.reactions_count ?? undefined,
      reactionCounts: post.reaction_counts,
      comments: post.comments_count ?? 0,
      relays: post.relays_count ?? 0,
    },
    reactionType: post.user_reaction_type,
    isSaved: post.user_has_saved,
    isRelayed: post.user_has_relayed,
    community: post.community
      ? { slug: post.community.slug, name: post.community.name, avatar_url: post.community.avatar_url }
      : undefined,
    flair: post.flair || undefined,
    collaborators: (post.collaborators || []).map((c) => ({
      role: c.role ?? null,
      status: (c.status || "accepted") as "pending" | "accepted" | "declined",
      user: {
        id: c.user.id,
        username: c.user.username,
        display_name: c.user.display_name ?? null,
        avatar_url: c.user.avatar_url ?? null,
      },
    })),
    mentions: (post.mentions || []).map((m) => ({
      user: {
        id: m.user.id,
        username: m.user.username,
        display_name: m.user.display_name ?? null,
        avatar_url: m.user.avatar_url ?? null,
      },
    })),
    hashtags: post.hashtags || [],
    styling: post.styling || null,
    post_location: post.post_location || null,
    metadata: post.metadata || null,
    spotify_track: post.spotify_track || null,
    ...overrides,
  };
}

/** `PostProps` with mentions flattened to users — what `openPostModal` takes. */
export function toModalPost(post: PostLike, overrides: Partial<PostProps> = {}): ModalPost {
  const props = toPostProps(post, overrides);
  return {
    ...props,
    mentions: (props.mentions || []).map((m) => m.user),
  };
}
