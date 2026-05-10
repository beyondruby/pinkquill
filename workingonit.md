# Quill - Project Context for Claude

> A creative social platform for artists, poets, writers, and creators.

**Tech Stack:** Next.js 16 + React 19 + Tailwind CSS v4 + Supabase (PostgreSQL + Auth + Realtime)

---

## Folder Structure

```
quill/
├── app/                          # Next.js App Router
│   ├── (feed)/                   # Route group (authenticated pages)
│   │   ├── page.tsx              # Home feed
│   │   ├── layout.tsx            # Layout with Header + Sidebars + Mobile nav
│   │   ├── create/page.tsx       # Create post page
│   │   ├── messages/page.tsx     # Messaging interface
│   │   ├── saved/page.tsx        # Saved/bookmarked posts
│   │   ├── explore/page.tsx      # Explore feed with trending content
│   │   └── about/page.tsx        # About page
│   ├── settings/                 # Settings pages
│   │   ├── layout.tsx            # Settings layout with SettingsSidebar
│   │   ├── page.tsx              # Settings index (redirects)
│   │   ├── profile/page.tsx      # Edit profile settings
│   │   ├── account/page.tsx      # Account settings (email/password)
│   │   └── privacy/page.tsx      # Privacy settings (blocked users)
│   ├── community/                # Communities feature
│   │   ├── layout.tsx            # Community layout
│   │   ├── page.tsx              # Communities list/discovery
│   │   ├── create/page.tsx       # Create new community
│   │   └── [slug]/               # Individual community pages
│   │       ├── layout.tsx        # Community detail layout
│   │       ├── page.tsx          # Community feed
│   │       ├── members/page.tsx  # Community members list
│   │       ├── about/page.tsx    # Community info
│   │       └── settings/         # Community admin settings
│   ├── insights/                 # Analytics feature
│   │   ├── layout.tsx            # Insights layout with sidebar
│   │   ├── page.tsx              # Insights overview dashboard
│   │   ├── audience/page.tsx     # Audience analytics
│   │   ├── communities/page.tsx  # Community statistics
│   │   └── content/              # Content performance
│   ├── help/                     # Help documentation
│   │   ├── layout.tsx            # Help layout
│   │   ├── page.tsx              # Help index
│   │   ├── getting-started/      # Getting started guide
│   │   └── [topic]/page.tsx      # Help topics
│   ├── takes/                    # Video responses feature
│   │   ├── layout.tsx            # Takes layout
│   │   ├── page.tsx              # Takes feed
│   │   └── create/page.tsx       # Create new take
│   ├── post/[id]/page.tsx        # Post detail page
│   ├── take/[id]/page.tsx        # Take detail page
│   ├── studio/[username]/page.tsx # User profile page
│   ├── tag/[tag]/page.tsx        # Hashtag feed page
│   ├── login/page.tsx            # Login/signup page
│   ├── auth/callback/route.ts    # OAuth callback handler
│   ├── privacy/page.tsx          # Privacy policy
│   ├── terms/page.tsx            # Terms of service
│   ├── layout.tsx                # Root layout with providers
│   ├── error.tsx                 # Error boundary
│   ├── global-error.tsx          # Global error handler
│   └── globals.css               # Global styles + Tailwind
├── components/
│   ├── auth/                     # Authentication
│   ├── feed/                     # Feed & posts
│   ├── create/                   # Post creation
│   ├── takes/                    # Video responses
│   ├── communities/              # Community features
│   ├── insights/                 # Analytics components
│   ├── messages/                 # Messaging
│   ├── notifications/            # Notifications
│   ├── studio/                   # User profiles
│   ├── layout/                   # Layout components
│   ├── ui/                       # Reusable UI
│   ├── settings/                 # Settings components
│   ├── search/                   # Search functionality
│   ├── explore/                  # Explore page
│   ├── about/                    # About page
│   └── providers/                # Context providers
├── lib/
│   ├── hooks/                    # Modular React hooks
│   │   ├── index.ts              # Barrel exports
│   │   ├── useFeed.ts            # Post fetching (feed, saved, relays)
│   │   ├── useProfile.ts         # User profiles, follow system
│   │   ├── useInteractions.ts    # Likes, saves, reactions, blocks
│   │   ├── useComments.ts        # Comments and replies
│   │   ├── useNotifications.ts   # Notification system
│   │   ├── useExplore.ts         # Explore/trending content
│   │   ├── useTags.ts            # Hashtag system
│   │   └── useMedia.ts           # Voice recorder, audio player
│   ├── types/
│   │   └── index.ts              # All TypeScript interfaces
│   ├── utils/
│   │   ├── index.ts              # Utility functions
│   │   └── retry.ts              # Retry logic for network requests
│   ├── hooks.ts                  # Main hooks barrel export
│   ├── hooks.legacy.ts           # Legacy hooks (communities, collaboration, search)
│   └── supabase.ts               # Supabase client configuration
├── supabase/migrations/          # Database migrations
├── email-templates/              # Email templates for auth
├── public/                       # Static assets
├── middleware.ts                 # Next.js middleware
└── package.json
```

---

## Components Reference

### Auth
| Component | Description |
|-----------|-------------|
| `AuthForm.tsx` | Login/signup form with email auth via Supabase |
| `AuthModal.tsx` | Modal wrapper for auth dialogs |

### Feed
| Component | Description |
|-----------|-------------|
| `Feed.tsx` | Main feed container, fetches and displays public posts (RLS handles blocking) |
| `PostCard.tsx` | Individual post card with author, content, media, reactions, actions, block/report menu |
| `PostDetailModal.tsx` | Full post modal with discussion/comments panel |
| `PostSkeleton.tsx` | Loading skeleton for posts |
| `PostTags.tsx` | Display @mentions, hashtags, and collaborators on posts |
| `ReactionPicker.tsx` | Multi-reaction picker (admire, snap, ovation, support, inspired, applaud) |
| `CommentItem.tsx` | Individual comment in thread with replies |

### Create
| Component | Description |
|-----------|-------------|
| `CreatePost.tsx` | Rich post creation with 11 types, media upload, content warnings, collaborators, mentions, styling |
| `BackgroundPicker/` | Background/styling picker for posts (colors, gradients, patterns) |
| `JournalMetadata/` | Metadata for journal entries (weather, mood, time of day) |

### Takes (Video Responses)
| Component | Description |
|-----------|-------------|
| `TakesFeed.tsx` | Takes feed container |
| `TakeCard.tsx` | Individual take/video card |
| `TakeDetailModal.tsx` | Take detail with comments |
| `TakePostCard.tsx` | Take linked to original post |
| `CreateTake.tsx` | Record/upload take video |
| `TakePlayer.tsx` | Video player for takes |
| `TakeComments.tsx` | Comments on takes |

### Communities
| Component | Description |
|-----------|-------------|
| `CommunityCard.tsx` | Community preview card |
| `CommunityHeader.tsx` | Community header with cover image |
| `CommunityBadge.tsx` | Badge showing community affiliation |
| `JoinButton.tsx` | Join/leave community button |
| `InviteModal.tsx` | Invite users to community |

### Insights (Analytics)
| Component | Description |
|-----------|-------------|
| `InsightsSidebar.tsx` | Navigation for insights sections |
| `DateRangePicker.tsx` | Date range selector |
| `cards/MetricCard.tsx` | Metric display card |
| `charts/GrowthChart.tsx` | Growth trend chart |
| `charts/ViewsChart.tsx` | Views over time chart |
| `charts/TrafficSourcesChart.tsx` | Traffic sources breakdown |

### Messages
| Component | Description |
|-----------|-------------|
| `MessagesView.tsx` | Main messages layout with conversation list + chat (filters blocked users) |
| `ConversationList.tsx` | Lists conversations with last message preview |
| `ChatView.tsx` | Individual chat view with message history, info menu (block/report/delete) |
| `NewMessageModal.tsx` | Modal to start new conversations |
| `VoiceRecorder.tsx` | Voice message recorder with waveform |
| `VoiceNotePlayer.tsx` | Voice message player |

### Notifications
| Component | Description |
|-----------|-------------|
| `NotificationPanel.tsx` | Shows all notification types with real-time updates |
| `CollaborationInviteCard.tsx` | Special card for collaboration invites with accept/decline |
| `FollowRequestCard.tsx` | Follow request cards for private accounts |

### Studio/Profile
| Component | Description |
|-----------|-------------|
| `StudioProfile.tsx` | User profile with bio, stats, posts, relays, collaborated posts, 3-dot menu |
| `FollowersModal.tsx` | Modal showing followers/following list |

### Layout
| Component | Description |
|-----------|-------------|
| `LeftSidebar.tsx` | Left nav: Home, Explore, Saved, Create, Notifications |
| `RightSidebar.tsx` | Right sidebar for trends/suggestions |
| `ConditionalRightSidebar.tsx` | Responsive right sidebar (hidden on mobile) |
| `MainContent.tsx` | Central content wrapper |
| `MobileHeader.tsx` | Mobile top header |
| `MobileBottomNav.tsx` | Mobile bottom navigation bar |

### Settings
| Component | Description |
|-----------|-------------|
| `SettingsSidebar.tsx` | Settings navigation: Edit Profile, Account, Notifications, Privacy |

### Search
| Component | Description |
|-----------|-------------|
| `SearchBar.tsx` | Search input field with dropdown |
| `SearchDropdown.tsx` | Search results dropdown (users, posts, communities, tags) |
| `SearchResultItem.tsx` | Individual search result |

### UI
| Component | Description |
|-----------|-------------|
| `Modal.tsx` | Base modal with backdrop and escape key |
| `ShareModal.tsx` | Share via link, social, or embed code |
| `ReportModal.tsx` | Report user/post modal |
| `Lightbox.tsx` | Full-screen image gallery viewer |
| `PeoplePickerModal.tsx` | Modal for selecting collaborators or tagged people with search |
| `EmojiPicker.tsx` | Emoji/reaction picker |
| `ErrorBoundary.tsx` | React error boundary |
| `Loading.tsx` | Loading spinner |
| `Skeleton.tsx` | Generic skeleton loader |

### Providers
| Component | Description |
|-----------|-------------|
| `AuthProvider.tsx` | Auth context: user, profile, loading, signOut() |
| `ModalProvider.tsx` | Post modal context with URL history sync |
| `AuthModalProvider.tsx` | Auth modal visibility state |

---

## Database Schema (Supabase/PostgreSQL)

### profiles
```sql
id              UUID PRIMARY KEY (user auth id)
username        TEXT UNIQUE NOT NULL
display_name    TEXT
avatar_url      TEXT
cover_url       TEXT
bio             TEXT
tagline         TEXT
role            TEXT
education       TEXT
location        TEXT
languages       TEXT
website         TEXT
is_verified     BOOLEAN DEFAULT false
is_private      BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
```

### posts
```sql
id              UUID PRIMARY KEY
author_id       UUID REFERENCES profiles(id)
community_id    UUID REFERENCES communities(id)
type            TEXT (poem|journal|thought|visual|audio|video|essay|screenplay|story|letter|quote)
title           TEXT
content         TEXT (HTML)
visibility      TEXT (public|followers|private)
content_warning TEXT
status          TEXT DEFAULT 'published' -- 'draft', 'published', 'archived'
styling         JSONB -- creative backgrounds, text alignment, etc.
post_location   TEXT
metadata        JSONB -- journal metadata (weather, mood, time_of_day)
spotify_track   JSONB -- Spotify track data
created_at      TIMESTAMPTZ
```

### post_media
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id)
media_url       TEXT
media_type      TEXT (image|video)
caption         TEXT
position        INTEGER
```

### admires (likes)
```sql
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
PRIMARY KEY (post_id, user_id)
```

### reactions (multi-reaction system)
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
reaction_type   TEXT (admire|snap|ovation|support|inspired|applaud)
created_at      TIMESTAMPTZ
UNIQUE(post_id, user_id)
```

### saves (bookmarks)
```sql
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
created_at      TIMESTAMPTZ
PRIMARY KEY (post_id, user_id)
```

### relays (reposts)
```sql
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
created_at      TIMESTAMPTZ
PRIMARY KEY (post_id, user_id)
```

### comments
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
parent_id       UUID REFERENCES comments(id)  -- For nested replies
content         TEXT
created_at      TIMESTAMPTZ
```

### comment_likes
```sql
comment_id      UUID REFERENCES comments(id)
user_id         UUID REFERENCES profiles(id)
created_at      TIMESTAMPTZ
PRIMARY KEY (comment_id, user_id)
```

### follows
```sql
follower_id     UUID REFERENCES profiles(id)
following_id    UUID REFERENCES profiles(id)
status          TEXT DEFAULT 'accepted' -- 'pending', 'accepted' (for private accounts)
requested_at    TIMESTAMPTZ DEFAULT NOW()
PRIMARY KEY (follower_id, following_id)
```

### notifications
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES profiles(id)
actor_id        UUID REFERENCES profiles(id)
type            TEXT -- see NotificationType below
post_id         UUID REFERENCES posts(id)
comment_id      UUID REFERENCES comments(id)
community_id    UUID REFERENCES communities(id)
content         TEXT
read            BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
```

### blocks
```sql
id              UUID PRIMARY KEY
blocker_id      UUID REFERENCES profiles(id) ON DELETE CASCADE
blocked_id      UUID REFERENCES profiles(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ
UNIQUE(blocker_id, blocked_id)
```

### reports
```sql
id              UUID PRIMARY KEY
reporter_id     UUID REFERENCES profiles(id) ON DELETE CASCADE
reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE
reported_post_id UUID REFERENCES posts(id) ON DELETE CASCADE
reason          TEXT NOT NULL
type            TEXT NOT NULL  -- 'user' or 'post'
status          TEXT DEFAULT 'pending'  -- pending, reviewed, resolved
created_at      TIMESTAMPTZ
```

### conversations
```sql
id              UUID PRIMARY KEY
updated_at      TIMESTAMPTZ
```

### conversation_participants
```sql
conversation_id UUID REFERENCES conversations(id)
user_id         UUID REFERENCES profiles(id)
PRIMARY KEY (conversation_id, user_id)
```

### messages
```sql
id              UUID PRIMARY KEY
conversation_id UUID REFERENCES conversations(id)
sender_id       UUID REFERENCES profiles(id)
content         TEXT
message_type    TEXT DEFAULT 'text' -- 'text', 'voice', 'media'
media_url       TEXT
media_type      TEXT
voice_url       TEXT
voice_duration  INTEGER
waveform_data   JSONB
is_read         BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
```

### communities
```sql
id              UUID PRIMARY KEY
slug            TEXT UNIQUE NOT NULL
name            TEXT NOT NULL
description     TEXT
avatar_url      TEXT
cover_url       TEXT
privacy         TEXT DEFAULT 'public' -- 'public', 'private'
topics          TEXT[]
created_by      UUID REFERENCES profiles(id)
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
```

### community_members
```sql
id              UUID PRIMARY KEY
community_id    UUID REFERENCES communities(id)
user_id         UUID REFERENCES profiles(id)
role            TEXT DEFAULT 'member' -- 'admin', 'moderator', 'member'
status          TEXT DEFAULT 'active' -- 'active', 'muted', 'banned'
muted_until     TIMESTAMPTZ
joined_at       TIMESTAMPTZ
UNIQUE(community_id, user_id)
```

### community_rules
```sql
id              UUID PRIMARY KEY
community_id    UUID REFERENCES communities(id)
rule_number     INTEGER
title           TEXT
description     TEXT
```

### community_tags
```sql
id              UUID PRIMARY KEY
community_id    UUID REFERENCES communities(id)
tag             TEXT
tag_type        TEXT -- 'genre', 'theme', 'type', 'custom'
```

### community_join_requests
```sql
id              UUID PRIMARY KEY
community_id    UUID REFERENCES communities(id)
user_id         UUID REFERENCES profiles(id)
message         TEXT
status          TEXT DEFAULT 'pending' -- 'pending', 'approved', 'rejected'
reviewed_by     UUID REFERENCES profiles(id)
reviewed_at     TIMESTAMPTZ
created_at      TIMESTAMPTZ
```

### community_invitations
```sql
id              UUID PRIMARY KEY
community_id    UUID REFERENCES communities(id)
inviter_id      UUID REFERENCES profiles(id)
invitee_id      UUID REFERENCES profiles(id)
status          TEXT DEFAULT 'pending' -- 'pending', 'accepted', 'declined'
created_at      TIMESTAMPTZ
responded_at    TIMESTAMPTZ
```

### post_collaborators
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
role            TEXT
status          TEXT DEFAULT 'pending' -- 'pending', 'accepted', 'declined'
invited_at      TIMESTAMPTZ DEFAULT NOW()
responded_at    TIMESTAMPTZ
UNIQUE(post_id, user_id)
```

### post_mentions
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(post_id, user_id)
```

### tags
```sql
id              UUID PRIMARY KEY
name            TEXT UNIQUE NOT NULL
created_at      TIMESTAMPTZ DEFAULT NOW()
```

### post_tags
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id) ON DELETE CASCADE
tag_id          UUID REFERENCES tags(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(post_id, tag_id)
```

---

## Custom Hooks (lib/hooks/)

### Feed Hooks (useFeed.ts)
```typescript
useFeed(userId?: string, options?: { pageSize?: number; communityId?: string })
// Returns: { posts, loading, error, pagination, loadMore, refresh }
// Optimized feed with RLS-based filtering, pagination, real-time updates
// Fetches collaborators, mentions, hashtags, and all interaction states

usePosts(userId?: string) // DEPRECATED - use useFeed
// Returns: { posts, loading, error, refetch }

useSavedPosts(userId?: string)
// Returns: { posts, loading, error, refetch }
// Fetches user's saved/bookmarked posts

useRelays(username: string)
// Returns: { relays, loading }
// Fetches relayed posts for a user's profile
```

### Interaction Hooks (useInteractions.ts)
```typescript
useToggleAdmire()
// Returns: { toggle: (postId, userId, isAdmired) => Promise }

useToggleSave()
// Returns: { toggle: (postId, userId, isSaved) => Promise }

useToggleRelay()
// Returns: { toggle: (postId, userId, isRelayed) => Promise }

useToggleReaction()
// Returns: { react, removeReaction, getReaction }
// Multi-reaction system with fallback to admires table

useReactionCounts(postId: string)
// Returns: { counts, loading, refetch }
// Real-time reaction counts per type

useUserReaction(postId: string, userId?: string)
// Returns: { reaction, loading, setReaction, refetch }
// User's current reaction with real-time updates

useBlock()
// Returns: { checkIsBlocked, checkIsBlockedEitherWay, blockUser, unblockUser, getBlockedUsers }
```

### Profile Hooks (useProfile.ts)
```typescript
useProfile(username: string, viewerId?: string)
// Returns: { profile, posts, loading, error, isBlockedByUser, isPrivateAccount, refetch }
// Handles private accounts, blocked users, visibility filtering

useFollow()
// Returns: { checkFollowStatus, checkIsFollowing, checkIsPrivate, follow, unfollow,
//            acceptRequest, declineRequest, getPendingRequests, toggle }
// Full follow system with private account support

useFollowList(userId: string, type: 'followers' | 'following')
// Returns: { users, loading, refetch }

useFollowRequests(userId?: string)
// Returns: { requests, loading, count, accept, decline, refetch }
// Manage follow requests for private accounts with real-time updates
```

### Comment Hooks (useComments.ts)
```typescript
useComments(postId: string, userId?: string)
// Returns: { comments, loading, addComment, toggleLike, deleteComment, fetchReplies, refetch }
// Optimized: lazy-loads replies on demand, creates notifications for replies and likes
```

### Notification Hooks (useNotifications.ts)
```typescript
createNotification(userId, actorId, type, postId?, content?, communityId?, commentId?)
// Helper function to create notifications (prevents self-notifications)

useNotifications(userId?: string)
// Returns: { notifications, loading, refetch }
// Real-time subscription for instant updates

useUnreadCount(userId?: string)
// Returns: { count, refetch }
// Real-time unread notification count

useMarkAsRead()
// Returns: { markAsRead, markAllAsRead }

useUnreadMessagesCount(userId?: string)
// Returns: { count, refetch }
// Filters out messages from blocked users
```

### Explore Hooks (useExplore.ts)
```typescript
useExplore(userId?: string, options?: { pageSize?: number; tab?: ExploreTab })
// Returns: { posts, loading, error, pagination, loadMore, refresh, activeTab, setActiveTab }
// Personalized algorithm with engagement scoring, time decay, trending boost
// Tabs: for-you, trending, video, communities, topics, poem, journal, etc.
```

### Tag Hooks (useTags.ts)
```typescript
useTrendingTags(limit?: number)
// Returns: { tags, loading, error, refetch }
// Real trending tags from database (last 30 days, sorted by recent activity)

useTagPosts(tagName: string, userId?: string)
// Returns: { posts, loading, error, hasMore, loadMore, tagInfo }
// Paginated posts for a specific hashtag

usePopularTags(limit?: number)
// Returns: { tags, loading }
// All-time popular tags
```

### Media Hooks (useMedia.ts)
```typescript
useVoiceRecorder(maxDuration?: number)
// Returns: { isRecording, isPaused, duration, audioBlob, audioUrl, waveformData, error,
//            hasPermission, isSupported, startRecording, stopRecording, pauseRecording,
//            resumeRecording, cancelRecording, requestPermission, reset }
// Full voice recording with waveform visualization

useAudioPlayer(audioUrl: string | null)
// Returns: { isPlaying, isLoading, currentTime, duration, playbackRate, error,
//            play, pause, toggle, seek, setPlaybackRate }

useSendVoiceNote()
// Returns: { sendVoiceNote, sending, progress, error }
// Upload and send voice notes in conversations

useSendMedia(limits?: MediaLimits)
// Returns: { sendMedia, validateFile, sending, progress, error, limits }
// Upload and send images/videos in conversations
```

### Community Hooks (hooks.legacy.ts)
```typescript
useCommunity(slug: string, userId?: string)
// Returns: { community, loading, error, refetch }

useCommunities(userId?: string, filter?: 'all' | 'joined' | 'created')
// Returns: { communities, loading, error, refetch }

useDiscoverCommunities(options?: { category?: string; tag?: string; limit?: number })
// Returns: { communities, loading, error }

useSuggestedCommunities(userId?: string, limit?: number)
// Returns: { communities, loading }

useCommunityMembers(communityId: string, options?: { role?: string; status?: string })
// Returns: { members, loading, refetch }

useCommunityPosts(communityId: string, userId?: string, sortBy?: 'newest' | 'top')
// Returns: { posts, loading, error, loadMore, hasMore, refetch }

useJoinCommunity()
// Returns: { join, leave, requestJoin, cancelRequest, isJoining }

useCommunityInvitations(userId?: string)
// Returns: { invitations, loading, accept, decline, refetch }

useJoinRequests(communityId: string)
// Returns: { requests, loading, approve, reject, refetch }

useCreateCommunity()
// Returns: { create, creating, error }

useUpdateCommunity()
// Returns: { update, updating, error }

useDeleteCommunity()
// Returns: { delete: deleteCommunity, deleting, error }

useCommunityModeration(communityId: string)
// Returns: { updateMemberRole, updateMemberStatus, removeMember, loading }
```

### Collaboration Hooks (hooks.legacy.ts)
```typescript
useCollaborators(postId?: string)
// Returns: { collaborators, loading, inviteCollaborator, removeCollaborator, refetch }

useCollaborationInvites(userId?: string)
// Returns: { invites, loading, accept, decline, refetch }

usePendingCollaborations(userId?: string)
// Returns: { posts, loading }

useMentions(postId?: string)
// Returns: { mentions, loading, addMention, removeMention, refetch }

useMentionedPosts(userId?: string)
// Returns: { posts, loading }

useUserSearch(currentUserId?: string)
// Returns: { results, loading, search, suggestions }
// Debounced search for users, includes following suggestions

saveCollaboratorsAndMentions(postId, collaborators, mentions)
// Helper function to save collaborators and mentions for a post

fetchCollaboratedPosts(userId: string)
// Helper to fetch posts where user is accepted collaborator
```

### Search Hook (hooks.legacy.ts)
```typescript
useSearch(query: string, options?: { debounceMs?: number; limit?: number })
// Returns: { results: { profiles, posts, communities, tags }, loading, error }
// Unified search across profiles, posts, communities, and tags
```

---

## TypeScript Types (lib/types/index.ts)

### Post Types
```typescript
type PostType = 'poem' | 'journal' | 'thought' | 'visual' | 'audio' | 'video' |
                'essay' | 'screenplay' | 'story' | 'letter' | 'quote';

type PostVisibility = 'public' | 'followers' | 'private';
type PostStatus = 'draft' | 'published' | 'archived';

interface Post {
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
  author: PostAuthor;
  media: PostMedia[];
  community?: PostCommunity | null;
  admires_count: number;
  reactions_count: number;
  comments_count: number;
  relays_count: number;
  user_has_admired: boolean;
  user_reaction_type: ReactionType | null;
  user_has_saved: boolean;
  user_has_relayed: boolean;
  collaborators?: PostCollaborator[];
  mentions?: PostMention[];
  hashtags?: string[];
}
```

### Styling Types
```typescript
type BackgroundType = 'solid' | 'gradient' | 'pattern' | 'image';
type TextAlignment = 'left' | 'center' | 'right' | 'justify';
type LineSpacing = 'normal' | 'relaxed' | 'loose';
type DividerStyle = 'none' | 'simple' | 'ornate' | 'dots' | 'stars' | 'wave';
type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
type WeatherType = 'sunny' | 'partly-cloudy' | 'cloudy' | 'rainy' | 'stormy' | 'snowy' | 'foggy' | 'windy';
type MoodType = 'reflective' | 'joyful' | 'melancholic' | 'peaceful' | 'anxious' | 'grateful' |
                'creative' | 'nostalgic' | 'hopeful' | 'contemplative' | 'excited' | 'curious' |
                'serene' | 'restless' | 'inspired' | 'determined' | 'vulnerable' | 'content' |
                'overwhelmed' | 'lonely';

interface PostStyling {
  background?: PostBackground;
  textAlignment?: TextAlignment;
  lineSpacing?: LineSpacing;
  dropCap?: boolean;
  dividerStyle?: DividerStyle;
}

interface JournalMetadata {
  weather?: WeatherType | string;
  temperature?: string;
  mood?: MoodType | string;
  timeOfDay?: TimeOfDay;
}

interface SpotifyTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  albumArt: string;
  previewUrl?: string;
  externalUrl: string;
}
```

### Reaction Types
```typescript
type ReactionType = 'admire' | 'snap' | 'ovation' | 'support' | 'inspired' | 'applaud';

interface ReactionCounts {
  admire: number;
  snap: number;
  ovation: number;
  support: number;
  inspired: number;
  applaud: number;
  total: number;
}
```

### Notification Types
```typescript
type NotificationType =
  | 'admire' | 'snap' | 'ovation' | 'support' | 'inspired' | 'applaud'  // Reactions
  | 'comment' | 'relay' | 'save'                                        // Post interactions
  | 'follow' | 'follow_request' | 'follow_request_accepted'             // Following
  | 'reply' | 'comment_like'                                            // Comment interactions
  | 'community_invite' | 'community_join_request' | 'community_join_approved'
  | 'community_role_change' | 'community_muted' | 'community_banned'    // Community
  | 'collaboration_invite' | 'collaboration_accepted' | 'collaboration_declined'
  | 'mention';                                                          // Collaboration
```

### Community Types
```typescript
interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  privacy: 'public' | 'private';
  topics: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  post_count?: number;
  is_member?: boolean;
  user_role?: 'admin' | 'moderator' | 'member' | null;
  user_status?: 'active' | 'muted' | 'banned' | null;
  has_pending_request?: boolean;
  has_pending_invitation?: boolean;
}

interface CommunityMember {
  id: string;
  community_id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  status: 'active' | 'muted' | 'banned';
  muted_until: string | null;
  joined_at: string;
  profile: { id, username, display_name, avatar_url, is_verified };
}
```

---

## Context Providers

### AuthProvider (components/providers/AuthProvider.tsx)
```typescript
const { user, profile, loading, signOut } = useAuth();

// user: Supabase User | null
// profile: Profile | null (includes is_private for private accounts)
// loading: boolean
// signOut: () => Promise<void>
```

### ModalProvider (components/providers/ModalProvider.tsx)
```typescript
const { openPostModal, closePostModal, subscribeToUpdates, notifyUpdate } = useModal();

// openPostModal(post) - Opens detail modal, updates URL
// closePostModal() - Closes modal, restores URL
// subscribeToUpdates(callback) - Listen for post stat changes
// notifyUpdate(update) - Broadcast stat changes
```

---

## Blocking System

### How Blocking Works

When User A blocks User B:

1. **Profile Access**: User B sees "User not found" when viewing User A's profile
2. **Feed Filtering**: Posts from both users are hidden from each other's feeds (RLS handles this)
3. **Messaging (Instagram-style)**:
   - Both users can still "send" messages
   - Messages appear to send but are never delivered to the other party
   - Existing conversation history remains visible
   - No "you can't message" notification (silent block)
4. **Unread Counts**: Messages from blocked users don't count toward unread badges
5. **Conversation List**: Last message preview only shows own messages when blocked
6. **Follows**: Mutual follows are automatically removed when blocking

### Where to Block Users
- Profile page: 3-dot menu → Block
- Post card: 3-dot menu → Block
- Messages: Info (i) button → Block

### Viewing Blocked Users
Settings → Privacy → Shows list of blocked users with unblock option

---

## Private Accounts System

### How Private Accounts Work

1. **Profile Visibility**: Private account profiles show limited info to non-followers
2. **Follow Requests**: Following a private account sends a "pending" request
3. **Request Management**: Account owner sees requests in notifications and can accept/decline
4. **Post Visibility**: All posts from private accounts only visible to accepted followers
5. **Notifications**: Special notification types for follow_request and follow_request_accepted

### Implementation
- `profiles.is_private` boolean flag
- `follows.status` column: 'pending' or 'accepted'
- `follows.requested_at` timestamp for request ordering

---

## Collaboration & Tagging System

### Collaborators (Co-creators)
When creating a post, users can add collaborators:
- **Max 10 collaborators** per post
- Collaborators must **accept the invite** before the post is published
- Post appears in both the author's and collaborators' profile grids
- Collaborator names shown on post with overlapping avatar display
- Avatar fan-out animation on hover reveals all collaborators

### Flow
1. Author adds collaborators via PeoplePickerModal in CreatePost
2. Post saved with `status: 'draft'` and collaborators as `pending`
3. Notifications sent to all invited collaborators
4. Collaborators see CollaborationInviteCard in NotificationPanel
5. When all collaborators accept → post `status` becomes `'published'`
6. If any decline → author notified, can remove them and publish

### People Tags (@Mentions)
Users can tag/mention people in posts:
- **Max 50 tagged people** per post
- Both inline @mentions in content AND separate tag section
- Tagged users shown in post footer ("with @username +X more")
- Clicking a tag navigates to that user's profile
- Mention notifications sent to tagged users

### Hashtags
- Posts can include #hashtags in content
- Tags are extracted and stored in `tags` and `post_tags` tables
- `/tag/[tag]` page shows all posts with that hashtag
- Trending tags shown in explore and right sidebar

---

## Communities System

### Community Features
- **Creation**: Users can create communities with name, description, avatar, cover, topics
- **Privacy**: Public (anyone can join) or Private (approval required)
- **Roles**: Admin (creator), Moderator (appointed), Member
- **Moderation**: Mute, ban, role management
- **Rules**: Community rules that members must follow
- **Join Requests**: Private communities require approval
- **Invitations**: Members can invite others to communities

### Community Posts
- Posts can be created within a community
- Community badge shown on posts
- Separate community feed page
- Community posts appear in main feed with community attribution

---

## Explore Algorithm

The explore page uses a scoring algorithm for personalized content:

### Engagement Signals
- Admires: 1.0 weight
- Comments: 1.5 weight
- Relays: 2.0 weight

### Relationship Signals
- Following author: 3.0x boost
- Previously admired author: 2.0x boost

### Content Preference
- Preferred post type (based on user history): 1.5x boost

### Time Decay
- Posts start decaying after 48 hours
- Exponential decay function

### Trending Boost
- Posts with 10+ engagement in 24 hours get 2.5x boost

---

## Settings Pages

### Edit Profile (`/settings/profile`)
- Avatar upload
- Cover image upload
- Display name
- Username
- Bio
- Tagline
- Role/Occupation
- Education
- Location
- Languages
- Website

### Account (`/settings/account`)
- Change email
- Change password
- Danger zone (delete account)

### Privacy (`/settings/privacy`)
- Toggle private account
- View blocked users
- Unblock users

---

## Styling Approach

### CSS Variables (globals.css)
```css
--color-purple-primary: #8e44ad
--color-pink-vivid: #ff007f
--color-orange-warm: #ff9f43
--color-ink: #1e1e1e
--color-muted: #777777
--color-paper: #ffffff
--color-background: #fdfdfd

--font-display: var(--font-poppins), sans-serif  /* Titles */
--font-body: var(--font-open-sans), sans-serif   /* Content */
--font-ui: var(--font-poppins), sans-serif       /* UI elements */
```

### Key Style Patterns
- **Posts**: `.post`, `.type-poem`, `.type-journal`, etc.
- **Actions**: `.action-btn`, `.action-btn.active`
- **Modal**: `.modal-overlay`, `.modal-card`
- **Animations**: `animate-fadeIn`, `animate-scaleIn`, `animate-slideUp`
- **Gradients**: `bg-gradient-to-r from-purple-primary to-pink-vivid`

### Tailwind v4
- Uses `@tailwindcss/postcss` plugin
- Custom theme variables in `@theme` block
- Utility classes throughout components

---

## Third-Party Services

### Supabase
- **URL**: `NEXT_PUBLIC_SUPABASE_URL`
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Features Used**:
  - Auth (email/password, magic link)
  - PostgreSQL database
  - Real-time subscriptions (notifications, messages, reactions)
  - Row Level Security (RLS)
  - Storage (avatars, covers, media, voice-notes)

### Dependencies
```json
"@supabase/supabase-js": "^2.89.0"
"@fortawesome/react-fontawesome": "^3.1.1"
"recharts": "^2.x"  // Analytics charts
"dompurify": "^3.x"  // HTML sanitization
"next": "16.1.1"
"react": "^19.2.3"
"tailwindcss": "^4"
```

---

## Post Types

| Type | Label | Description |
|------|-------|-------------|
| `thought` | "shared a thought" | Short manifesto/reflection |
| `poem` | "wrote a poem" | Centered, italic poetry |
| `journal` | "wrote in their journal" | Personal journal entry with metadata |
| `essay` | "wrote an essay" | Long-form essay |
| `story` | "shared a story" | Fiction/narrative |
| `letter` | "wrote a letter" | Letter format |
| `screenplay` | "wrote a screenplay" | Script format |
| `quote` | "shared a quote" | Quote with attribution |
| `visual` | "shared a visual story" | Image/gallery post |
| `audio` | "recorded a voice note" | Audio content |
| `video` | "shared a video" | Video content |

---

## Routes

| Route | Description |
|-------|-------------|
| `/` | Main feed (requires auth) |
| `/create` | Create new post |
| `/explore` | Explore trending content |
| `/saved` | Saved/bookmarked posts |
| `/messages` | Direct messages |
| `/settings` | Settings index |
| `/settings/profile` | Edit profile |
| `/settings/account` | Account settings |
| `/settings/privacy` | Privacy & blocked users |
| `/studio/[username]` | User profile |
| `/post/[id]` | Post detail page |
| `/tag/[tag]` | Hashtag feed |
| `/community` | Communities list |
| `/community/create` | Create community |
| `/community/[slug]` | Community page |
| `/community/[slug]/members` | Community members |
| `/community/[slug]/settings` | Community settings |
| `/insights` | Analytics dashboard |
| `/insights/audience` | Audience analytics |
| `/insights/content` | Content analytics |
| `/takes` | Takes/video feed |
| `/takes/create` | Create take |
| `/take/[id]` | Take detail |
| `/help` | Help documentation |
| `/login` | Login/signup |
| `/privacy` | Privacy policy |
| `/terms` | Terms of service |

---

## Key Patterns

### Optimized Post Fetching
Posts are fetched with RLS-based filtering and batch queries:
```typescript
// RLS handles visibility/blocking - no client-side filtering needed
supabase.from("posts").select(`
  *, styling, post_location, metadata,
  author:profiles!posts_author_id_fkey (...),
  media:post_media (...),
  community:communities (...),
  admires:admires(count),
  comments:comments(count),
  relays:relays(count)
`);

// Batch fetch user interactions
const [admiresResult, savesResult, relaysResult, reactionsResult] = await Promise.all([...]);
```

### Real-time Updates
Notifications, messages, and reactions use Supabase real-time:
```typescript
supabase.channel('notifications')
  .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications',
       filter: `user_id=eq.${userId}` }, callback)
  .subscribe()
```

### Auth Flow
1. User signs in via `supabase.auth.signInWithPassword()` or magic link
2. `AuthProvider` listens to `onAuthStateChange`
3. Profile is fetched/created from `profiles` table
4. Auth state available via `useAuth()` hook

### Post Truncation
Posts over 50 words show "Continue reading" link that opens modal.

### Optimistic Updates
All interactions (admire, save, relay, block, react) use optimistic UI updates.

### Lazy-Loaded Replies
Comments hook initially fetches only top-level comments; replies are loaded on demand via `fetchReplies()`.

---

## SQL Setup Scripts

### Enable Real-time
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
```

### Blocks table
```sql
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their blocks" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "Users can check if blocked" ON blocks
  FOR SELECT USING (auth.uid() = blocked_id);
CREATE POLICY "Users can block others" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "Users can unblock" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);
```

### Reactions table
```sql
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL CHECK (reaction_type IN ('admire', 'snap', 'ovation', 'support', 'inspired', 'applaud')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, user_id)
);

ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read reactions" ON reactions FOR SELECT USING (true);
CREATE POLICY "Users can add reactions" ON reactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update reactions" ON reactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete reactions" ON reactions FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);
```

### Tags tables
```sql
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(post_id, tag_id)
);

CREATE INDEX idx_post_tags_post ON post_tags(post_id);
CREATE INDEX idx_post_tags_tag ON post_tags(tag_id);
```
