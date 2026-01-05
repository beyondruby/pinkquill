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
│   │   ├── layout.tsx            # Layout with Header + Sidebars
│   │   ├── create/page.tsx       # Create post page
│   │   └── messages/page.tsx     # Messaging interface
│   ├── settings/                 # Settings pages
│   │   ├── layout.tsx            # Settings layout with SettingsSidebar
│   │   ├── page.tsx              # Settings index (redirects)
│   │   ├── profile/page.tsx      # Edit profile settings
│   │   ├── account/page.tsx      # Account settings (email/password)
│   │   └── privacy/page.tsx      # Privacy settings (blocked users)
│   ├── post/[id]/page.tsx        # Post detail page
│   ├── studio/[username]/page.tsx # User profile page
│   ├── login/page.tsx            # Login/signup page
│   ├── layout.tsx                # Root layout with providers
│   └── globals.css               # Global styles + Tailwind
├── components/
│   ├── auth/                     # Authentication
│   ├── feed/                     # Feed & posts
│   ├── create/                   # Post creation
│   ├── messages/                 # Messaging
│   ├── notifications/            # Notifications
│   ├── studio/                   # User profiles
│   ├── layout/                   # Layout components
│   ├── ui/                       # Reusable UI
│   ├── settings/                 # Settings components
│   └── providers/                # Context providers
├── lib/
│   ├── supabase.ts               # Supabase client
│   └── hooks.ts                  # Custom React hooks
└── package.json
```

---

## Components Reference

### Auth
| Component | Description |
|-----------|-------------|
| `AuthForm.tsx` | Login/signup form with email auth via Supabase |

### Feed
| Component | Description |
|-----------|-------------|
| `Feed.tsx` | Main feed container, fetches and displays public posts (filters blocked users) |
| `PostCard.tsx` | Individual post card with author, content, media, actions, block/report menu |
| `PostDetailModal.tsx` | Full post modal with discussion/comments panel |

### Create
| Component | Description |
|-----------|-------------|
| `CreatePost.tsx` | Rich post creation with 11 types, media upload, content warnings |

### Messages
| Component | Description |
|-----------|-------------|
| `MessagesView.tsx` | Main messages layout with conversation list + chat (filters blocked users) |
| `ConversationList.tsx` | Lists conversations with last message preview |
| `ChatView.tsx` | Individual chat view with message history, info menu (block/report/delete) |
| `NewMessageModal.tsx` | Modal to start new conversations |

### Notifications
| Component | Description |
|-----------|-------------|
| `NotificationPanel.tsx` | Shows admires, comments, relays, saves, follows, replies, comment likes, collaboration invites, mentions |
| `CollaborationInviteCard.tsx` | Special card for collaboration invites with accept/decline buttons |

### Studio/Profile
| Component | Description |
|-----------|-------------|
| `StudioProfile.tsx` | User profile with bio, stats, posts, relays, 3-dot menu (share/block/report) |
| `FollowersModal.tsx` | Modal showing followers/following list |

### Layout
| Component | Description |
|-----------|-------------|
| `Header.tsx` | Top navigation with logo and search |
| `LeftSidebar.tsx` | Left nav: Home, Explore, Saved, Create, Notifications |
| `RightSidebar.tsx` | Right sidebar for trends/suggestions |
| `MainContent.tsx` | Central content wrapper |

### Settings
| Component | Description |
|-----------|-------------|
| `SettingsSidebar.tsx` | Settings navigation: Edit Profile, Account, Notifications, Privacy |

### UI
| Component | Description |
|-----------|-------------|
| `Modal.tsx` | Base modal with backdrop and escape key |
| `ShareModal.tsx` | Share via link, social, or embed code |
| `Lightbox.tsx` | Full-screen image gallery viewer |
| `PeoplePickerModal.tsx` | Modal for selecting collaborators or tagged people with search |

### Providers
| Component | Description |
|-----------|-------------|
| `AuthProvider.tsx` | Auth context: user, profile, loading, signOut() |
| `ModalProvider.tsx` | Post modal context with URL history sync |

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
website         TEXT
is_verified     BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
```

### posts
```sql
id              UUID PRIMARY KEY
author_id       UUID REFERENCES profiles(id)
type            TEXT (poem|journal|thought|visual|audio|video|essay|screenplay|story|letter|quote)
title           TEXT
content         TEXT (HTML)
visibility      TEXT (public|private)
content_warning TEXT
status          TEXT DEFAULT 'published' -- 'draft' (awaiting collaborators), 'published', 'archived'
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

### saves (bookmarks)
```sql
post_id         UUID REFERENCES posts(id)
user_id         UUID REFERENCES profiles(id)
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
PRIMARY KEY (follower_id, following_id)
```

### notifications
```sql
id              UUID PRIMARY KEY
user_id         UUID REFERENCES profiles(id)
actor_id        UUID REFERENCES profiles(id)
type            TEXT (admire|comment|relay|save|follow|reply|comment_like|collaboration_invite|collaboration_accepted|collaboration_declined|mention)
post_id         UUID REFERENCES posts(id)
comment_id      UUID REFERENCES comments(id)
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
is_read         BOOLEAN DEFAULT false
created_at      TIMESTAMPTZ
```

### post_collaborators
```sql
id              UUID PRIMARY KEY
post_id         UUID REFERENCES posts(id) ON DELETE CASCADE
user_id         UUID REFERENCES profiles(id) ON DELETE CASCADE
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

---

## Custom Hooks (lib/hooks.ts)

### Post Hooks
```typescript
usePosts(userId?: string)
// Returns: { posts, loading, error, refetch }
// Fetches public posts with author, media, interaction counts
// Filters out posts from blocked users (both directions)

useToggleAdmire()
// Returns: { toggle: (postId, userId, isAdmired) => Promise }

useToggleSave()
// Returns: { toggle: (postId, userId, isSaved) => Promise }

useToggleRelay()
// Returns: { toggle: (postId, userId, isRelayed) => Promise }
```

### Profile Hooks
```typescript
useProfile(username: string, viewerId?: string)
// Returns: { profile, posts, loading, error, isBlockedByUser }
// If viewerId is blocked by the profile owner, isBlockedByUser = true

useFollow()
// Returns: { checkIsFollowing, toggle }

useFollowList(userId: string, type: 'followers' | 'following')
// Returns: { users, loading, refetch }
```

### Comment Hooks
```typescript
useComments(postId: string)
// Returns: { comments, loading, addComment, refetch }
// Supports nested replies (parent_id)
// Creates notifications for replies and comment likes
```

### Notification Hooks
```typescript
useNotifications(userId?: string)
// Returns: { notifications, loading, refetch }
// Has real-time subscription for instant updates
// Types: admire, comment, relay, save, follow, reply, comment_like

useUnreadCount(userId?: string)
// Returns: { count, refetch }
// Real-time subscription

useMarkAsRead()
// Returns: { markAsRead, markAllAsRead }

useUnreadMessagesCount(userId?: string)
// Returns: { count, refetch }
// Filters out messages from blocked users
```

### Relay Hooks
```typescript
useRelays(username: string)
// Returns: { relays, loading }
```

### Block Hooks
```typescript
useBlock()
// Returns: { checkIsBlocked, checkIsBlockedEitherWay, blockUser, unblockUser, getBlockedUsers }

checkIsBlocked(blockerId, blockedId)
// Checks if blockerId has blocked blockedId

checkIsBlockedEitherWay(userId1, userId2)
// Checks if either user has blocked the other

blockUser(blockerId, blockedId)
// Blocks user and removes mutual follows

unblockUser(blockerId, blockedId)
// Removes block

getBlockedUsers(userId)
// Returns list of users blocked by userId
```

### Collaboration Hooks
```typescript
useCollaborators(postId: string)
// Returns: { collaborators, loading, inviteCollaborator, removeCollaborator }
// Manages collaborators for a post

useCollaborationInvites(userId: string)
// Returns: { invites, loading, accept, decline, refetch }
// Fetches pending collaboration invites for a user
// Used in NotificationPanel to show invite cards

usePendingCollaborations(userId: string)
// Returns: { posts, loading }
// Fetches posts where user has pending collaborator responses

useMentions(postId: string)
// Returns: { mentions, loading, addMention, removeMention }
// Manages @mentions/tags for a post

useMentionedPosts(userId: string)
// Returns: { posts, loading }
// Fetches posts where user is mentioned/tagged
```

### User Search Hooks
```typescript
useUserSearch(currentUserId: string)
// Returns: { results, loading, search, suggestions }
// Debounced search for users by username/display_name
// Also provides suggestions from following list
// Used in PeoplePickerModal for collaborators and tags

fetchCollaboratedPosts(userId: string)
// Helper function that returns posts where user is accepted collaborator
// Used in StudioProfile to show collaborated posts in grid
```

### Helper Functions
```typescript
createNotification(userId, actorId, type, postId?, content?, commentId?)
// Creates notification (prevents self-notifications)
// Supports all notification types including reply and comment_like
```

---

## Context Providers

### AuthProvider (components/providers/AuthProvider.tsx)
```typescript
const { user, profile, loading, signOut } = useAuth();

// user: Supabase User | null
// profile: { id, username, display_name, avatar_url, bio, ... } | null
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
2. **Feed Filtering**: Posts from both users are hidden from each other's feeds
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

## Report System

### Report Types
- `user` - Report a user profile
- `post` - Report a post

### Report Reasons (Quick Select)
- Spam
- Harassment
- Impersonation
- Inappropriate content
- Other (custom text)

### Where to Report
- Profile page: 3-dot menu → Report
- Post card: 3-dot menu → Report
- Messages: Info (i) button → Report

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
4. Collaborators see special CollaborationInviteCard in NotificationPanel
5. When all collaborators accept → post `status` becomes `'published'`
6. If any decline → author notified, can remove them and publish

### People Tags (@Mentions)
Users can tag/mention people in posts:
- **Max 50 tagged people** per post
- Both inline @mentions in content AND separate tag section
- Tagged users shown in post footer ("with @username +X more")
- Clicking a tag navigates to that user's profile
- Mention notifications sent to tagged users

### Components
- `PeoplePickerModal.tsx` - Modal for selecting collaborators or mentions
- `CollaborationInviteCard.tsx` - Special notification card with accept/decline
- `PostCard.tsx` - Displays collaborators (overlapping avatars) and mentions
- `StudioProfile.tsx` - Shows collaborated posts with "Collab" badge

### Notification Types
| Type | Icon | Message |
|------|------|---------|
| `collaboration_invite` | ✨ | "invited you to collaborate" |
| `collaboration_accepted` | 🎉 | "accepted your collaboration" |
| `collaboration_declined` | 💔 | "declined your collaboration" |
| `mention` | 🏷️ | "mentioned you in a post" |

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
- Website

### Account (`/settings/account`)
- Change email
- Change password
- Danger zone (delete account)

### Privacy (`/settings/privacy`)
- View blocked users
- Unblock users

### Notifications (`/settings/notifications`)
- Notification preferences (planned)

---

## Styling Approach

### CSS Variables (globals.css)
```css
--primary-purple: #8e44ad
--vivid-pink: #ff007f
--warm-orange: #ff9f43
--ink: #1e1e1e
--muted-text: #777
--paper: #ffffff
--background: #fdfdfd

--font-display: 'Libre Baskerville', serif  /* Titles, poems */
--font-body: 'Crimson Pro', serif           /* Content */
--font-ui: 'Josefin Sans', sans-serif       /* UI elements */
```

### Key Style Patterns
- **Posts**: `.post`, `.type-poem`, `.type-journal`, `.type-manifesto`, etc.
- **Actions**: `.action-btn`, `.action-btn.active`, `.action-btn.saved`
- **Modal**: `.modal-overlay`, `.modal-card`
- **Animations**: `animate-fadeIn`, `animate-scaleIn`, `animate-slideUp`
- **Truncation**: `.continue-reading-btn` (purple with arrow)
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
  - Auth (email/password)
  - PostgreSQL database
  - Real-time subscriptions (notifications, messages)
  - Row Level Security (RLS)
  - Storage (avatars, covers, media)

### Dependencies
```json
"@supabase/supabase-js": "^2.89.0"
"@fortawesome/react-fontawesome": "^3.1.1"
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
| `journal` | "wrote in their journal" | Personal journal entry |
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
| `/messages` | Direct messages |
| `/settings` | Settings index |
| `/settings/profile` | Edit profile |
| `/settings/account` | Account settings |
| `/settings/privacy` | Privacy & blocked users |
| `/studio/[username]` | User profile |
| `/post/[id]` | Post detail page |
| `/login` | Login/signup |

---

## Key Patterns

### Post Fetching
Posts are fetched with related data in one query, filtering blocked users:
```typescript
// Get blocked users first
const blockedByUsers = await getBlockedBy(userId);
const usersIBlocked = await getBlocked(userId);

// Then filter posts
supabase.from("posts").select(`
  *,
  author:profiles!posts_author_id_fkey (...),
  media:post_media (...)
`)
// Client-side filter for blocked users
```

### Real-time Updates
Notifications and messages use Supabase real-time:
```typescript
supabase.channel('notifications')
  .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, callback)
  .subscribe()
```

### Auth Flow
1. User signs in via `supabase.auth.signInWithPassword()`
2. `AuthProvider` listens to `onAuthStateChange`
3. Profile is fetched/created from `profiles` table
4. Auth state available via `useAuth()` hook

### Post Truncation
Posts over 50 words show "Continue reading" link that opens modal.

### Optimistic Updates
All interactions (admire, save, relay, block) use optimistic UI updates for instant feedback.

---

## SQL Setup Scripts

### Enable Real-time on notifications
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
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

### Reports table
```sql
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  reported_post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view their own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);
```

### Update notification types
```sql
ALTER TABLE notifications
DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
ADD CONSTRAINT notifications_type_check
CHECK (type IN ('admire', 'comment', 'relay', 'save', 'follow', 'reply', 'comment_like'));
```
