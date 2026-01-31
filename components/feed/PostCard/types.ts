import type { PostStyling, JournalMetadata, SpotifyTrack, ReactionType } from "@/lib/types";

export interface Author {
  name: string;
  handle: string;
  avatar: string;
}

export interface MediaItem {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
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
  admires: number;
  reactions?: number;
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
  image?: string;
  audioDuration?: string;
  videoDuration?: string;
  stats: PostStats;
  isAdmired?: boolean;
  reactionType?: ReactionType | null;
  isSaved?: boolean;
  isRelayed?: boolean;
  community?: CommunityInfo;
  collaborators?: CollaboratorInfo[];
  mentions?: MentionInfo[];
  hashtags?: string[];
  // Creative styling
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
}

export interface PostCardProps {
  post: PostProps;
  onPostDeleted?: (postId: string) => void;
}

// Action handler types
export interface PostActionHandlers {
  onAdmire: (e: React.MouseEvent) => void;
  onSave: (e: React.MouseEvent) => void;
  onRelay: (e: React.MouseEvent) => void;
  onReaction: (reactionType: ReactionType) => void;
  onRemoveReaction: () => void;
  onComment: () => void;
  onShare: () => void;
  onOpenModal: () => void;
}

export interface PostMenuHandlers {
  onEdit: () => void;
  onDelete: () => void;
  onReport: () => void;
  onBlock: () => void;
}
