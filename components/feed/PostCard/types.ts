import type { PostStyling, JournalMetadata, SpotifyTrack, ReactionType, ReactionCounts, CommunityFlair } from "@/lib/types";

export interface Author {
  name: string;
  handle: string;
  avatar: string;
}

export interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video" | "audio";
  caption: string | null;
  position: number;
  /** Poster for video items; no column stores one yet (F-12), so usually null. */
  thumbnail_url?: string | null;
}

export interface CommunityInfo {
  slug: string;
  name: string;
  avatar_url?: string | null;
}

export interface CollaboratorInfo {
  status: "pending" | "accepted" | "declined";
  role?: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface MentionInfo {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface TaggedUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export type PostType =
  | "poem"
  | "journal"
  | "thought"
  | "visual"
  | "audio"
  | "video"
  | "essay"
  | "blog"
  | "story"
  | "letter"
  | "quote";

export interface PostStats {
  /** Reaction total from the list row; `undefined` = unknown, the engagement store fetches it. */
  reactions?: number;
  /** Per-type split from the list row (posts.reaction_counts), when known. */
  reactionCounts?: ReactionCounts;
  comments: number;
  relays: number;
}

export interface PostProps {
  id: string;
  authorId: string;
  author: Author;
  type: PostType;
  typeLabel: string;
  timeAgo: string;
  createdAt?: string;
  title?: string;
  content: string;
  contentWarning?: string;
  media?: MediaItem[];
  stats: PostStats;
  /** Viewer's reaction from the list row; `undefined` = unknown (fetched), `null` = none. */
  reactionType?: ReactionType | null;
  isSaved?: boolean;
  isRelayed?: boolean;
  community?: CommunityInfo;
  flair?: CommunityFlair | null;
  collaborators?: CollaboratorInfo[];
  mentions?: MentionInfo[];
  hashtags?: string[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
}

/**
 * What the post detail modal receives: card props with mentions flattened to
 * users. One type for `ModalProvider.openPostModal` and `PostDetailModal`
 * (they used to declare two divergent copies; finding V-5).
 */
export type ModalPost = Omit<PostProps, "mentions"> & { mentions?: TaggedUser[] };
