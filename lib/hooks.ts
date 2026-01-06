/**
 * Hooks - Main Entry Point
 *
 * This file serves as the barrel export for all hooks.
 * The hooks have been refactored into modular files for better maintainability.
 *
 * MIGRATION STATUS:
 * - useFeed, usePosts, useSavedPosts, useRelays -> lib/hooks/useFeed.ts
 * - useToggleAdmire, useToggleSave, useToggleRelay, etc. -> lib/hooks/useInteractions.ts
 * - useComments -> lib/hooks/useComments.ts
 * - useProfile, useFollow, useFollowList, useFollowRequests -> lib/hooks/useProfile.ts
 * - useNotifications, useUnreadCount, useMarkAsRead -> lib/hooks/useNotifications.ts
 * - useVoiceRecorder, useAudioPlayer, useSendVoiceNote, useSendMedia -> lib/hooks/useMedia.ts
 *
 * Hooks still in legacy (hooks.legacy.ts):
 * - Community hooks (useCommunity, useCommunityMembers, etc.)
 * - Collaboration hooks (useCollaborators, useMentions, etc.)
 * - User search hooks (useUserSearch)
 */

// ============================================================================
// NEW MODULAR HOOKS (Use these - they are optimized)
// ============================================================================

// Feed & Posts
export { useFeed, usePosts, useSavedPosts, useRelays } from "./hooks/useFeed";

// Explore
export { useExplore } from "./hooks/useExplore";
export type { ExploreTab } from "./hooks/useExplore";

// Tags
export { useTrendingTags, useTagPosts, usePopularTags } from "./hooks/useTags";
export type { TrendingTag } from "./hooks/useTags";

// Interactions
export {
  useToggleAdmire,
  useToggleSave,
  useToggleRelay,
  useToggleReaction,
  useReactionCounts,
  useUserReaction,
  useBlock,
} from "./hooks/useInteractions";

// Comments
export { useComments } from "./hooks/useComments";

// Profile & Follows
export { useProfile, useFollow, useFollowList, useFollowRequests } from "./hooks/useProfile";

// Notifications
export {
  createNotification,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useUnreadMessagesCount,
} from "./hooks/useNotifications";

// Media
export {
  useVoiceRecorder,
  useAudioPlayer,
  useSendVoiceNote,
  useSendMedia,
} from "./hooks/useMedia";
export type { VoiceRecorderState, AudioPlayerState, MediaLimits } from "./hooks/useMedia";

// ============================================================================
// TYPES (from centralized types file)
// ============================================================================

export type {
  Post,
  PostMedia,
  PostType,
  PostVisibility,
  PostStatus,
  PostAuthor,
  PostCommunity,
  PostCollaborator,
  PostMention,
  RelayedPost,
  ReactionType,
  ReactionCounts,
  Profile,
  FollowUser,
  FollowStatus,
  FollowRequest,
  Comment,
  NotificationType,
  Notification,
  Conversation,
  ConversationParticipant,
  Message,
  Community,
  CommunityMember,
  CommunityRule,
  CommunityTag,
  JoinRequest,
  CommunityInvitation,
  PaginationState,
  PaginatedResult,
} from "./types";

// ============================================================================
// LEGACY HOOKS (Not yet migrated - still functional)
// ============================================================================

// Community hooks
export {
  useCommunity,
  useCommunities,
  useDiscoverCommunities,
  useSuggestedCommunities,
  useCommunityMembers,
  useCommunityPosts,
  useJoinCommunity,
  useCommunityInvitations,
  useJoinRequests,
  useCreateCommunity,
  useUpdateCommunity,
  useDeleteCommunity,
  useCommunityModeration,
} from "./hooks.legacy";

// Search
export { useSearch } from "./hooks.legacy";

// Collaboration hooks
export {
  useCollaborators,
  useCollaborationInvites,
  usePendingCollaborations,
  useMentions,
  useMentionedPosts,
  fetchCollaboratedPosts,
} from "./hooks.legacy";

// User search
export { useUserSearch, saveCollaboratorsAndMentions } from "./hooks.legacy";

// Legacy type exports that may still be needed
export type {
  Collaborator,
  CollaboratorStatus,
  Mention,
  CollaborationInvite,
  SearchableUser,
  SearchResults,
  SearchResultProfile,
  SearchResultCommunity,
  SearchResultTag,
} from "./hooks.legacy";
