/**
 * Shared type definitions for Quill
 * Extracted from hooks.ts to prevent circular dependencies
 */

// ============================================================================
// POST TYPES
// ============================================================================

// ============================================================================
// POST STYLING TYPES (for creative backgrounds, formatting, etc.)
// ============================================================================

export type BackgroundType = 'solid' | 'gradient' | 'pattern' | 'image';
export type TextAlignment = 'left' | 'center' | 'right' | 'justify';
export type LineSpacing = 'normal' | 'relaxed' | 'loose';
export type DividerStyle = 'none' | 'simple' | 'ornate' | 'dots' | 'stars' | 'wave';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type WeatherType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy' | 'windy';
export type MoodType = 'reflective' | 'joyful' | 'melancholic' | 'peaceful' | 'anxious' | 'grateful' | 'creative' | 'nostalgic' | 'hopeful' | 'contemplative' | 'excited' | 'curious' | 'serene' | 'restless' | 'inspired' | 'determined' | 'vulnerable' | 'content' | 'overwhelmed' | 'lonely';

export interface PostBackground {
  type: BackgroundType;
  value: string; // hex color, gradient CSS, pattern name, or image URL
  imageUrl?: string; // for image backgrounds
  opacity?: number; // 0-1, for image backgrounds
  blur?: number; // for image backgrounds
}

export interface PostStyling {
  background?: PostBackground;
  textAlignment?: TextAlignment;
  lineSpacing?: LineSpacing;
  dropCap?: boolean;
  dividerStyle?: DividerStyle;
}

export interface JournalMetadata {
  weather?: WeatherType | string;
  temperature?: string; // e.g., "15°C" or "59°F"
  mood?: MoodType | string;
  timeOfDay?: TimeOfDay;
}

// Spotify track data stored with posts
export interface SpotifyTrack {
  id: string;           // Spotify track ID
  name: string;         // Track name
  artist: string;       // Artist name(s)
  album: string;        // Album name
  albumArt: string;     // Album cover URL
  previewUrl?: string;  // 30-second preview URL (if available)
  externalUrl: string;  // Spotify URL to open the track
}

export interface BackgroundPreset {
  id: string;
  name: string;
  type: 'solid' | 'gradient' | 'pattern' | 'texture';
  value: string;
  preview_url?: string;
  category: string;
  is_system: boolean;
  sort_order: number;
}

export interface PostMedia {
  id: string;
  media_url: string;
  media_type: "image" | "video";
  caption: string | null;
  position: number;
}

export type PostType =
  | "poem"
  | "journal"
  | "thought"
  | "visual"
  | "audio"
  | "video"
  | "essay"
  | "screenplay"
  | "story"
  | "letter"
  | "quote";

// Using union with string for backward compatibility with legacy code
export type PostVisibility = "public" | "followers" | "private" | (string & {});

export type PostStatus = "draft" | "published" | "archived";

export interface PostAuthor {
  id?: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified?: boolean;
  is_private?: boolean;
}

export interface PostCommunity {
  id?: string;
  slug: string;
  name: string;
  avatar_url: string | null;
}

export interface PostCollaborator {
  status: string;
  role: string | null;
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface PostMention {
  user: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Post {
  id: string;
  author_id: string;
  type: PostType;
  title: string | null;
  content: string;
  visibility: PostVisibility;
  status?: PostStatus;
  content_warning: string | null;
  created_at: string;
  community_id: string | null;

  // Creative styling options
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;

  // Joined data
  author: PostAuthor;
  media: PostMedia[];
  community?: PostCommunity | null;

  // Computed counts (from view or aggregation)
  admires_count: number;
  reactions_count: number;
  comments_count: number;
  relays_count: number;

  // User-specific flags
  user_has_admired: boolean;
  user_reaction_type: ReactionType | null;
  user_has_saved: boolean;
  user_has_relayed: boolean;

  // Optional collaborator/mention data
  collaborators?: PostCollaborator[];
  mentions?: PostMention[];
  hashtags?: string[];
}

export interface RelayedPost extends Post {
  relayed_at: string;
  original_author: PostAuthor;
}

// ============================================================================
// REACTION TYPES
// ============================================================================

export type ReactionType =
  | "admire"
  | "snap"
  | "ovation"
  | "support"
  | "inspired"
  | "applaud";

export interface ReactionCounts {
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
}

// ============================================================================
// PROFILE TYPES
// ============================================================================

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  bio: string | null;
  tagline: string | null;
  role: string | null;
  education: string | null;
  location: string | null;
  languages: string | null;
  website: string | null;
  is_verified: boolean;
  is_private: boolean;
  created_at: string;
  works_count: number;
  followers_count: number;
  following_count: number;
  admires_count: number;
}

export interface FollowUser {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
}

export type FollowStatus = "pending" | "accepted" | null;

export interface FollowRequest {
  follower_id: string;
  requested_at: string;
  requester: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    bio: string | null;
  };
}

// ============================================================================
// COMMENT TYPES
// ============================================================================

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  author: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  likes_count: number;
  replies_count: number;
  user_has_liked: boolean;
  replies?: Comment[];
}

// ============================================================================
// NOTIFICATION TYPES
// ============================================================================

export type NotificationType =
  | "admire"
  | "snap"
  | "ovation"
  | "support"
  | "inspired"
  | "applaud"
  | "comment"
  | "relay"
  | "save"
  | "follow"
  | "follow_request"
  | "follow_request_accepted"
  | "reply"
  | "comment_like"
  | "community_invite"
  | "community_join_request"
  | "community_join_approved"
  | "community_role_change"
  | "community_muted"
  | "community_banned"
  | "collaboration_invite"
  | "collaboration_accepted"
  | "collaboration_declined"
  | "mention";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  community_id: string | null;
  content: string | null;
  read: boolean;
  created_at: string;
  actor: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  post?: {
    title: string | null;
    content: string;
    type: string;
  };
  community?: {
    name: string;
    slug: string;
    avatar_url: string | null;
  };
}

// ============================================================================
// MESSAGE TYPES
// ============================================================================

export interface Conversation {
  id: string;
  updated_at: string;
  participants: ConversationParticipant[];
  last_message?: Message;
}

export interface ConversationParticipant {
  user_id: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// ============================================================================
// COMMUNITY TYPES
// ============================================================================

export interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  privacy: "public" | "private";
  topics: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  post_count?: number;
  is_member?: boolean;
  user_role?: "admin" | "moderator" | "member" | null;
  user_status?: "active" | "muted" | "banned" | null;
  has_pending_request?: boolean;
  has_pending_invitation?: boolean;
  pending_invitation_id?: string;
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  status: "active" | "muted" | "banned";
  muted_until: string | null;
  joined_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

export interface CommunityRule {
  id: string;
  community_id: string;
  rule_number: number;
  title: string;
  description: string | null;
}

export interface CommunityTag {
  id: string;
  community_id: string;
  tag: string;
  tag_type: "genre" | "theme" | "type" | "custom";
}

export interface JoinRequest {
  id: string;
  community_id: string;
  user_id: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityInvitation {
  id: string;
  community_id: string;
  inviter_id: string;
  invitee_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  responded_at: string | null;
  community: {
    name: string;
    slug: string;
    avatar_url: string | null;
  };
  inviter: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface PaginationState {
  page: number;
  pageSize: number;
  hasMore: boolean;
  total?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationState;
}

// ============================================================================
// COLLABORATION TYPES
// ============================================================================

export type CollaboratorStatus = "pending" | "accepted" | "declined";

export interface CollaborationInvite {
  id: string;
  post_id: string;
  user_id: string;
  status: CollaboratorStatus;
  invited_at: string;
  post: {
    id: string;
    title: string | null;
    type: string;
    content: string;
    status: string;
    author: {
      id: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
    };
  };
}
