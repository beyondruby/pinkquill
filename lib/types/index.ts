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
  media_type: "image" | "video" | "audio";
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
  | "blog"
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

  // Flair (community post categorization)
  flair_id?: string | null;
  flair?: CommunityFlair | null;

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
// PINNED POSTS TYPES
// ============================================================================

export interface PinnedPost {
  id: string;
  user_id: string;
  post_id: string;
  position: number;
  pinned_at: string;
}

export interface CommunityPinnedPost {
  id: string;
  community_id: string;
  post_id: string;
  pinned_by: string;
  position: number;
  pinned_at: string;
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
  theme_preference: string | null;
  notification_preferences: Record<string, boolean> | null;
  created_at: string;
  works_count: number;
  followers_count: number | null;
  following_count: number | null;
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
  hasMoreReplies?: boolean;
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
  | "community_warning"
  | "collaboration_invite"
  | "collaboration_accepted"
  | "collaboration_declined"
  | "collaboration_removed"
  | "mention"
  | "order_pending_acceptance"
  | "order_accepted"
  | "order_declined"
  | "order_placed"
  | "order_paid"
  | "order_started"
  | "order_delivered"
  | "order_completed"
  | "revision_requested"
  | "order_cancelled"
  | "review_received"
  | "order_message"
  | "order_disputed"
  | "dispute_resolved"
  | "refund_requested"
  | "order_refunded";

export interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  community_id: string | null;
  order_id: string | null;
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

export type MessageType = "text" | "voice" | "media" | "post_share";

// Supported emoji reactions for messages (like Instagram DMs)
export const MESSAGE_REACTION_EMOJIS = ["❤️", "😂", "😮", "😢", "😠", "👍"] as const;
export type MessageReactionEmoji = typeof MESSAGE_REACTION_EMOJIS[number];

export interface MessageReaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: MessageReactionEmoji;
  created_at: string;
  user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface Message {
  id: string;
  conversation_id?: string; // Optional for optimistic updates before server response
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Message type for different content types
  message_type?: MessageType;
  // Voice message fields
  voice_url?: string;
  voice_duration?: number;
  waveform_data?: number[];
  // Media message fields
  media_url?: string;
  media_type?: "image" | "video";
  // Shared post fields (for post_share message type)
  shared_post_id?: string;
  shared_post?: SharedPostPreview;
  sender?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  // Reactions on this message
  reactions?: MessageReaction[];
}

// Preview data for shared posts in messages
export interface SharedPostPreview {
  id: string;
  type: PostType;
  title: string | null;
  content: string;
  author: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  media?: {
    media_url: string;
    media_type: "image" | "video";
  } | null;
  created_at: string;
}

// Typing indicator state
export interface TypingUser {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  started_at: number;
}

// ============================================================================
// COMMUNITY CHAT TYPES
// ============================================================================

export type CommunityChatSenderRole = "system" | "member" | "moderator" | "admin";
export type CommunityChatMessageType =
  | "message"
  | "announcement"
  | "welcome"
  | "mod_action"
  | "appeal"
  | "status_update";

export interface CommunityChatThread {
  id: string;
  community_id: string;
  member_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
  closed_at: string | null;
  has_unread?: boolean;
  member_profile?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export interface CommunityChatMessage {
  id: string;
  thread_id: string;
  sender_id: string | null;
  sender_role: CommunityChatSenderRole;
  message_type: CommunityChatMessageType;
  content: string;
  metadata?: Record<string, unknown> | null;
  created_at: string;
  sender_profile?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

export interface CommunityChatMembership {
  community_id: string;
  role: "admin" | "moderator" | "member";
  status: "active" | "muted" | "banned";
  community_chat_joined?: boolean;
  mute_reason: string | null;
  ban_reason: string | null;
  permissions?: ModeratorPermissions | null;
  community: {
    id: string;
    slug: string;
    name: string;
    avatar_url: string | null;
    welcome_message?: string | null;
    community_chat_enabled?: boolean;
    community_chat_allow_member_messages?: boolean;
    community_chat_allow_modmail?: boolean;
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
  welcome_message?: string | null;
  community_chat_enabled?: boolean;
  community_chat_allow_member_messages?: boolean;
  community_chat_allow_modmail?: boolean;
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

// Content deletion audit log entry
export interface ContentDeletion {
  id: string;
  community_id: string;
  content_type: 'post' | 'comment';
  content_id: string;
  content_author_id: string | null;
  deleted_by: string;
  reason: string | null;
  deleted_at: string;
  content_snapshot?: {
    title?: string | null;
    content?: string;
    type?: string;
  } | null;
  author_profile?: { username: string; display_name: string | null; avatar_url: string | null };
  moderator_profile?: { username: string; display_name: string | null; avatar_url: string | null };
}

// Moderator permissions - granular control over what moderators can do
export interface ModeratorPermissions {
  can_mute: boolean;
  can_ban: boolean;
  can_delete_posts: boolean;
  can_delete_comments: boolean;
  can_pin_posts: boolean;
  can_manage_rules: boolean;
  can_send_community_chat_messages: boolean;
}

// Default permissions for new moderators
export const DEFAULT_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  can_mute: true,
  can_ban: false,
  can_delete_posts: true,
  can_delete_comments: true,
  can_pin_posts: true,
  can_manage_rules: false,
  can_send_community_chat_messages: true,
};

// Full permissions (for admins or full moderators)
export const FULL_MODERATOR_PERMISSIONS: ModeratorPermissions = {
  can_mute: true,
  can_ban: true,
  can_delete_posts: true,
  can_delete_comments: true,
  can_pin_posts: true,
  can_manage_rules: true,
  can_send_community_chat_messages: true,
};

export interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: "admin" | "moderator" | "member";
  status: "active" | "muted" | "banned";
  muted_until: string | null;
  mute_reason: string | null;
  banned_until: string | null;
  ban_reason: string | null;
  joined_at: string;
  permissions: ModeratorPermissions | null; // null for members, set for moderators
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
// COMMUNITY FLAIR TYPES
// ============================================================================

export interface CommunityFlair {
  id: string;
  community_id: string;
  name: string;
  color: string;
  emoji: string | null;
  position: number;
  created_at: string;
}

// ============================================================================
// MOD QUEUE / REPORT TYPES
// ============================================================================

export type ReportType = "user" | "post" | "comment" | "take" | "community";
export type ReportStatus = "pending" | "reviewed" | "resolved";
export type ResolutionAction =
  | "dismissed"
  | "content_deleted"
  | "user_muted"
  | "user_banned"
  | "warning_sent";

export interface Report {
  id: string;
  reporter_id: string;
  reported_user_id: string | null;
  reported_post_id: string | null;
  community_id: string | null;
  reason: string;
  details: string | null;
  type: ReportType;
  status: ReportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_action: ResolutionAction | null;
  resolution_notes: string | null;
  created_at: string;
  // Joined data for display
  reporter?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  reported_user?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  reported_post?: {
    id: string;
    title: string | null;
    content: string;
    type: PostType;
  };
  resolver?: {
    username: string;
    display_name: string | null;
  };
}

// ============================================================================
// SORTING / FILTERING TYPES
// ============================================================================

export type SortOption = "newest" | "hot" | "top";
export type TopTimeRange = "today" | "week" | "month" | "year" | "all";

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
// SUPABASE QUERY RESULT TYPES
// ============================================================================

/**
 * Supabase aggregate count result - returned from queries like `admires(count)`
 * Returns an array with a single object containing the count
 */
export interface AggregateCount {
  count: number;
}

/**
 * Raw post data from Supabase query before transformation
 * This represents the exact shape returned by the database query
 */
export interface RawPostQueryResult {
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
  styling?: PostStyling | null;
  post_location?: string | null;
  metadata?: JournalMetadata | null;
  spotify_track?: SpotifyTrack | null;
  flair_id?: string | null;
  flair?: CommunityFlair | null;
  author: PostAuthor;
  media: PostMedia[];
  community?: PostCommunity | null;
  // Aggregate counts come as array with single object
  admires: AggregateCount[] | null;
  reactions: AggregateCount[] | null;
  comments: AggregateCount[] | null;
  relays: AggregateCount[] | null;
}

/**
 * Supabase real-time payload for follows table
 */
export interface FollowPayload {
  follower_id: string;
  following_id: string;
  status?: FollowStatus;
  created_at?: string;
}

/**
 * Supabase real-time payload for post_collaborators table
 */
export interface CollaboratorPayload {
  post_id: string;
  user_id: string;
  status: string;
}

/**
 * Helper to safely extract count from aggregate result
 */
export function getAggregateCount(aggregate: AggregateCount[] | null | undefined): number {
  return aggregate?.[0]?.count ?? 0;
}

/**
 * Unified "heart" / interaction count for a post.
 * Pinkquill keeps a legacy `admires` table alongside the newer multi-reaction
 * `reactions` table — both are written to depending on which UI was used.
 * To show a single, never-undercounted number, take the larger of the two.
 */
export function getInteractionCount(post: {
  admires_count?: number | null;
  reactions_count?: number | null;
}): number {
  return Math.max(post.reactions_count ?? 0, post.admires_count ?? 0);
}

// ============================================================================
// COLLECTION TYPES
// ============================================================================

/**
 * Collection - A grouping of items (e.g., "Music", "Books", "Writings")
 */
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_url: string | null;
  icon_emoji: string | null;
  cover_url: string | null;
  position: number;
  is_collapsed: boolean;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  items_count?: number;
  items?: CollectionItem[];
}

/**
 * CollectionItem - An item within a collection (e.g., an album, a book, a journal series)
 */
export interface CollectionItem {
  id: string;
  collection_id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  cover_url: string | null;
  icon_emoji: string | null;
  position: number;
  metadata: CollectionItemMetadata;
  created_at: string;
  updated_at: string;
  // Computed/joined fields
  posts_count?: number;
  posts?: CollectionItemPost[];
  collection?: Collection;
}

/**
 * CollectionItemMetadata - Flexible metadata for different item types
 */
export interface CollectionItemMetadata {
  // Music albums
  artist?: string;
  releaseYear?: number;
  genre?: string;
  // Books
  author?: string;
  publishedYear?: number;
  isbn?: string;
  // General
  tags?: string[];
  externalUrl?: string;
  [key: string]: unknown;
}

/**
 * CollectionItemPost - Links a post to a collection item
 */
export interface CollectionItemPost {
  id: string;
  collection_item_id: string;
  post_id: string;
  position: number;
  created_at: string;
  // Joined fields
  post?: Post;
}

/**
 * CollectionWithItems - Collection with its items pre-loaded
 */
export interface CollectionWithItems extends Collection {
  items: CollectionItem[];
}

// ============================================================================
// STORE/MARKETPLACE TYPES
// ============================================================================

// Re-export all store types
export * from './store';
