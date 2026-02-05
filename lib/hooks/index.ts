/**
 * Hooks Barrel File
 *
 * This file re-exports all hooks from the modular hook files.
 * Import from here to get all hooks in one place.
 *
 * Example:
 *   import { useFeed, useToggleAdmire, useProfile } from '@/lib/hooks';
 */

// Feed & Posts
export { useFeed, useSavedPosts, useRelays } from "./useFeed";

// Interactions (likes, saves, relays, reactions, blocks)
export {
  useToggleAdmire,
  useToggleSave,
  useToggleRelay,
  useToggleReaction,
  useReactionCounts,
  useUserReaction,
  useBlock,
} from "./useInteractions";

// Comments
export { useComments } from "./useComments";

// Profile & Follows
export { useProfile, useFollow, useFollowList, useFollowRequests } from "./useProfile";

// Notifications
export {
  createNotification,
  useNotifications,
  useUnreadCount,
  useMarkAsRead,
  useUnreadMessagesCount,
} from "./useNotifications";

// Media (voice recording, audio player, media upload)
export {
  useVoiceRecorder,
  useAudioPlayer,
  useSendVoiceNote,
  useSendMedia,
} from "./useMedia";
export type { VoiceRecorderState, AudioPlayerState, MediaLimits } from "./useMedia";

// Tracking (analytics)
export {
  useTrackPostImpression,
  useTrackPostView,
  usePostViewTracker,
  useTrackTakeImpression,
  useTrackTakeView,
  useTrackProfileView,
  useTrackCommunityView,
  getSessionId,
  getSourceFromUrl,
} from "./useTracking";

// Takes
export * from "./useTakes";

// Insights
export * from "./useInsights";

// Explore & Tags
export { useExplore } from "./useExplore";
export type { ExploreTab } from "./useExplore";
export { useTrendingTags, useTagPosts, usePopularTags } from "./useTags";
export type { TrendingTag } from "./useTags";

// Collections
export {
  useCollections,
  useCollection,
  useCollectionItem,
  useCreateCollection,
  useCreateCollectionItem,
  useAddPostToCollectionItem,
  useUpdateCollection,
  useUpdateCollectionItem,
  useDeleteCollection,
  useDeleteCollectionItem,
  useReorderCollections,
  useReorderCollectionItems,
  useToggleCollectionCollapse,
} from "./useCollections";

// Pinned Posts
export { usePinnedPosts, useCommunityPinnedPosts } from "./usePinnedPosts";

// Flair
export { useCommunityFlairs, useManageFlairs, usePostFlair } from "./useFlair";

// Mod Queue
export { useModQueue, useResolveReport, useModerationActions } from "./useModQueue";

// Marketplace
export { useMarketplace, useFeaturedProducts } from "./useMarketplace";
export type {
  MarketplaceSortOption,
  MarketplaceFilters,
  MarketplacePagination,
  UseMarketplaceOptions,
  UseMarketplaceReturn,
} from "./useMarketplace";

// Messaging (reactions, typing indicators, sharing)
export {
  useMessageReactions,
  useTypingIndicator,
  useChatFeatures,
  MESSAGE_REACTION_EMOJIS,
} from "./useMessaging";

export { useShareToDM, fetchSharedPostPreview } from "./useShareToDM";

// Re-export types
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
  MessageType,
  MessageReaction,
  MessageReactionEmoji,
  SharedPostPreview,
  TypingUser,
  Community,
  CommunityMember,
  CommunityRule,
  CommunityTag,
  JoinRequest,
  CommunityInvitation,
  PaginationState,
  PaginatedResult,
  Collection,
  CollectionItem,
  CollectionItemPost,
  CollectionWithItems,
  CollectionItemMetadata,
  PinnedPost,
  CommunityPinnedPost,
  CommunityFlair,
  Report,
  ReportType,
  ReportStatus,
  ResolutionAction,
  SortOption,
  TopTimeRange,
} from "../types";
