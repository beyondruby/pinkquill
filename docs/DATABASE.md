# Database Schema Documentation

This document describes the PostgreSQL database schema used by Quill.

## Overview

Quill uses Supabase (PostgreSQL) with Row Level Security (RLS) for all tables.

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  profiles   │────<│   follows   │>────│  profiles   │
└─────────────┘     └─────────────┘     └─────────────┘
       │
       │ 1:N
       ▼
┌─────────────┐     ┌─────────────┐
│    posts    │────<│  post_media │
└─────────────┘     └─────────────┘
       │
       │ 1:N
       ├────────────────────────────────────────┐
       │                                        │
       ▼                                        ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   admires   │     │   comments  │     │   saves     │
└─────────────┘     └─────────────┘     └─────────────┘
                           │
                           │ 1:N (self-ref)
                           ▼
                    ┌─────────────┐
                    │  comments   │
                    │  (replies)  │
                    └─────────────┘
```

## Core Tables

### profiles

Stores user profile information.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key (matches auth.users.id) |
| username | TEXT | Unique username |
| display_name | TEXT | Display name |
| avatar_url | TEXT | Profile picture URL |
| cover_url | TEXT | Cover image URL |
| bio | TEXT | User biography |
| tagline | TEXT | Short tagline |
| role | TEXT | Role/occupation |
| education | TEXT | Education info |
| location | TEXT | Location |
| languages | TEXT | Languages spoken |
| website | TEXT | Personal website |
| is_verified | BOOLEAN | Verification status |
| is_private | BOOLEAN | Private account flag |
| created_at | TIMESTAMPTZ | Account creation time |

### posts

Stores all user posts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| author_id | UUID | FK → profiles.id |
| community_id | UUID | FK → communities.id (nullable) |
| type | TEXT | Post type (poem, journal, etc.) |
| title | TEXT | Post title (nullable) |
| content | TEXT | HTML content |
| visibility | TEXT | public/followers/private |
| content_warning | TEXT | Content warning (nullable) |
| status | TEXT | draft/published/archived |
| styling | JSONB | Background/text styling |
| post_location | TEXT | Location tag |
| metadata | JSONB | Journal metadata |
| spotify_track | JSONB | Attached Spotify track |
| created_at | TIMESTAMPTZ | Creation timestamp |

**Post Types**: poem, journal, thought, visual, audio, video, essay, screenplay, story, letter, quote

### post_media

Media attachments for posts.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| media_url | TEXT | Media file URL |
| media_type | TEXT | image/video |
| caption | TEXT | Media caption |
| position | INTEGER | Order position |

## Interaction Tables

### admires

Simple like system.

| Column | Type | Description |
|--------|------|-------------|
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| PK | (post_id, user_id) | Composite primary key |

### reactions

Multi-reaction system (6 types).

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| reaction_type | TEXT | admire/snap/ovation/support/inspired/applaud |
| created_at | TIMESTAMPTZ | Reaction timestamp |
| UNIQUE | (post_id, user_id) | One reaction per user per post |

### saves

Bookmarked posts.

| Column | Type | Description |
|--------|------|-------------|
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| created_at | TIMESTAMPTZ | Save timestamp |
| PK | (post_id, user_id) | Composite primary key |

### relays

Reposts/shares.

| Column | Type | Description |
|--------|------|-------------|
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| created_at | TIMESTAMPTZ | Relay timestamp |
| PK | (post_id, user_id) | Composite primary key |

## Comment System

### comments

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| parent_id | UUID | FK → comments.id (for replies) |
| content | TEXT | Comment content |
| created_at | TIMESTAMPTZ | Creation timestamp |

### comment_likes

| Column | Type | Description |
|--------|------|-------------|
| comment_id | UUID | FK → comments.id |
| user_id | UUID | FK → profiles.id |
| created_at | TIMESTAMPTZ | Like timestamp |
| PK | (comment_id, user_id) | Composite primary key |

## Social System

### follows

| Column | Type | Description |
|--------|------|-------------|
| follower_id | UUID | FK → profiles.id (who follows) |
| following_id | UUID | FK → profiles.id (who is followed) |
| status | TEXT | pending/accepted |
| requested_at | TIMESTAMPTZ | Request timestamp |
| PK | (follower_id, following_id) | Composite primary key |

### blocks

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| blocker_id | UUID | FK → profiles.id |
| blocked_id | UUID | FK → profiles.id |
| created_at | TIMESTAMPTZ | Block timestamp |
| UNIQUE | (blocker_id, blocked_id) | One block per pair |

## Messaging

### conversations

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| updated_at | TIMESTAMPTZ | Last activity |

### conversation_participants

| Column | Type | Description |
|--------|------|-------------|
| conversation_id | UUID | FK → conversations.id |
| user_id | UUID | FK → profiles.id |
| PK | (conversation_id, user_id) | Composite primary key |

### messages

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| conversation_id | UUID | FK → conversations.id |
| sender_id | UUID | FK → profiles.id |
| content | TEXT | Message text |
| message_type | TEXT | text/voice/media |
| media_url | TEXT | Media URL (nullable) |
| media_type | TEXT | Media type (nullable) |
| voice_url | TEXT | Voice note URL (nullable) |
| voice_duration | INTEGER | Voice duration in seconds |
| waveform_data | JSONB | Voice waveform data |
| is_read | BOOLEAN | Read status |
| created_at | TIMESTAMPTZ | Send timestamp |

## Notifications

### notifications

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| user_id | UUID | FK → profiles.id (recipient) |
| actor_id | UUID | FK → profiles.id (who triggered) |
| type | TEXT | Notification type |
| post_id | UUID | FK → posts.id (nullable) |
| comment_id | UUID | FK → comments.id (nullable) |
| community_id | UUID | FK → communities.id (nullable) |
| content | TEXT | Additional content |
| read | BOOLEAN | Read status |
| created_at | TIMESTAMPTZ | Notification timestamp |

**Notification Types**:
- Reactions: admire, snap, ovation, support, inspired, applaud
- Post: comment, relay, save
- Social: follow, follow_request, follow_request_accepted
- Comment: reply, comment_like
- Community: community_invite, community_join_request, etc.
- Collaboration: collaboration_invite, collaboration_accepted, mention

## Collaboration System

### post_collaborators

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| role | TEXT | Collaborator role |
| status | TEXT | pending/accepted/declined |
| invited_at | TIMESTAMPTZ | Invite timestamp |
| responded_at | TIMESTAMPTZ | Response timestamp |
| UNIQUE | (post_id, user_id) | One invite per user per post |

### post_mentions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| user_id | UUID | FK → profiles.id |
| created_at | TIMESTAMPTZ | Mention timestamp |
| UNIQUE | (post_id, user_id) | One mention per user per post |

## Tag System

### tags

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| name | TEXT | Tag name (unique) |
| created_at | TIMESTAMPTZ | Creation timestamp |

### post_tags

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| post_id | UUID | FK → posts.id |
| tag_id | UUID | FK → tags.id |
| created_at | TIMESTAMPTZ | Assignment timestamp |
| UNIQUE | (post_id, tag_id) | One tag per post |

## Row Level Security Policies

### Key RLS Patterns

**Block-aware queries**:
```sql
-- Posts are hidden from blocked users
CREATE POLICY "posts_visible" ON posts FOR SELECT USING (
  author_id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = auth.uid()
  )
);
```

**Private account support**:
```sql
-- Only show posts from private accounts to approved followers
CREATE POLICY "private_posts" ON posts FOR SELECT USING (
  visibility = 'public'
  OR author_id = auth.uid()
  OR (
    visibility IN ('followers', 'private')
    AND author_id IN (
      SELECT following_id FROM follows
      WHERE follower_id = auth.uid() AND status = 'accepted'
    )
  )
);
```

**Self-modification only**:
```sql
CREATE POLICY "users_update_own" ON profiles FOR UPDATE USING (
  id = auth.uid()
);
```

## Indexes

Key indexes for performance:

```sql
-- Posts queries
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_created ON posts(created_at DESC);
CREATE INDEX idx_posts_community ON posts(community_id);

-- Blocks (both directions)
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- Follows
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);

-- Reactions
CREATE INDEX idx_reactions_post ON reactions(post_id);
CREATE INDEX idx_reactions_user ON reactions(user_id);

-- Messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);
```

## Triggers

### Auto-publish when collaborators accept

```sql
CREATE OR REPLACE FUNCTION check_all_collaborators_accepted()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'accepted' THEN
    IF NOT EXISTS (
      SELECT 1 FROM post_collaborators
      WHERE post_id = NEW.post_id AND status = 'pending'
    ) THEN
      UPDATE posts SET status = 'published'
      WHERE id = NEW.post_id AND status = 'draft';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_collaborators
AFTER UPDATE ON post_collaborators
FOR EACH ROW EXECUTE FUNCTION check_all_collaborators_accepted();
```
