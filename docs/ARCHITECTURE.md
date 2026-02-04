# Quill Architecture

This document describes the high-level architecture of the Quill platform.

## Overview

Quill is a creative social platform built with:
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- **Backend**: Supabase (PostgreSQL + Auth + Realtime + Storage)
- **Deployment**: Vercel (recommended)

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
├─────────────────────────────────────────────────────────────────┤
│  Next.js App Router                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │    Pages     │  │  Components  │  │   Providers  │          │
│  │  (app/...)   │  │              │  │              │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│         │                 │                 │                    │
│         └─────────────────┼─────────────────┘                    │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────┐        │
│  │                    Custom Hooks                      │        │
│  │  useFeed | useProfile | useInteractions | ...        │        │
│  └────────────────────────┬────────────────────────────┘        │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────┐        │
│  │              Supabase Client (lib/supabase.ts)       │        │
│  │  - REST API calls                                    │        │
│  │  - Realtime subscriptions                           │        │
│  │  - Auth state management                            │        │
│  └────────────────────────┬────────────────────────────┘        │
└───────────────────────────┼─────────────────────────────────────┘
                            │ HTTPS / WSS
┌───────────────────────────┼─────────────────────────────────────┐
│                      SUPABASE CLOUD                              │
├───────────────────────────┴─────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   PostgREST  │  │   Realtime   │  │   Storage    │          │
│  │   (REST API) │  │  (WebSocket) │  │   (S3-like)  │          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                 │                 │                    │
│  ┌──────┴─────────────────┴─────────────────┴───────┐           │
│  │                  PostgreSQL                       │           │
│  │  - Row Level Security (RLS)                      │           │
│  │  - Triggers & Functions                          │           │
│  │  - Realtime publication                          │           │
│  └──────────────────────────────────────────────────┘           │
│                                                                  │
│  ┌──────────────────────────────────────────────────┐           │
│  │                  GoTrue (Auth)                    │           │
│  │  - Email/Password                                │           │
│  │  - Magic Links                                   │           │
│  │  - Session Management                            │           │
│  └──────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
quill/
├── app/                    # Next.js App Router pages
│   ├── (feed)/            # Authenticated route group
│   ├── auth/              # Auth callbacks
│   ├── settings/          # Settings pages
│   ├── community/         # Community pages
│   └── ...
├── components/            # React components
│   ├── auth/              # Authentication
│   ├── feed/              # Feed & posts
│   ├── create/            # Post creation
│   ├── messages/          # Messaging
│   ├── layout/            # Layout components
│   ├── ui/                # Reusable UI
│   └── providers/         # Context providers
├── lib/
│   ├── hooks/             # Custom React hooks
│   ├── types/             # TypeScript types
│   ├── utils/             # Utility functions
│   └── supabase.ts        # Supabase client
├── supabase/
│   └── migrations/        # Database migrations
└── public/                # Static assets
```

## Data Flow

### 1. Authentication Flow

```
User → AuthForm → Supabase Auth → Session Cookie → AuthProvider → App
                                                         ↓
                                                   Profile fetch
                                                         ↓
                                                   Context ready
```

### 2. Feed Loading Flow

```
Page mount → useFeed hook
                ↓
        AbortController created
                ↓
        Supabase query (RLS applied)
                ↓
        Batch fetch interactions
                ↓
        Transform & set state
                ↓
        Setup realtime subscription
```

### 3. Post Interaction Flow

```
User clicks reaction → useToggleReaction
                            ↓
                    Optimistic UI update
                            ↓
                    Supabase mutation
                            ↓
                    Create notification
                            ↓
                    Realtime broadcast
                            ↓
                    Other clients receive update
```

## Security Architecture

### Row Level Security (RLS)

All tables use RLS policies. Key patterns:

```sql
-- Users can only see posts from non-blocked users
CREATE POLICY "posts_select" ON posts FOR SELECT USING (
  author_id NOT IN (
    SELECT blocked_id FROM blocks WHERE blocker_id = auth.uid()
    UNION
    SELECT blocker_id FROM blocks WHERE blocked_id = auth.uid()
  )
);

-- Users can only modify their own data
CREATE POLICY "posts_update" ON posts FOR UPDATE USING (
  author_id = auth.uid()
);
```

### Client-Side Security

1. **XSS Prevention**: All HTML content sanitized with DOMPurify
2. **URL Validation**: Redirect URLs validated to prevent open redirects
3. **Request Timeouts**: All requests have configurable timeouts
4. **Abort Controllers**: Prevent race conditions and memory leaks

## Realtime Architecture

Supabase Realtime is used for:
- Notification updates
- Message delivery
- Reaction counts
- Follow requests

### Channel Naming Convention

```typescript
// Stable channel names prevent connection leaks
const channelName = `notifications:${userId}`;
const channelName = `messages:${conversationId}`;
const channelName = `reactions:${postId}`;
```

### Cleanup Pattern

```typescript
useEffect(() => {
  const channel = supabase.channel(channelName)
    .on('postgres_changes', {...}, callback)
    .subscribe();

  channelRef.current = channel;

  return () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };
}, [dependencies]);
```

## State Management

### Provider Hierarchy

```
<AuthProvider>           # User session & profile
  <ModalProvider>        # Post modal state
    <AuthModalProvider>  # Auth dialog visibility
      <App />
    </AuthModalProvider>
  </ModalProvider>
</AuthProvider>
```

### Hook-Based State

Most state is managed via custom hooks:
- `useFeed` - Feed posts with pagination
- `useProfile` - Profile data with blocking/privacy
- `useNotifications` - Real-time notifications
- `useMessages` - Conversation state

## Performance Optimizations

1. **Batch Queries**: Multiple queries combined with `Promise.all`
2. **Lazy Loading**: Comment replies loaded on demand
3. **Pagination**: Cursor-based with `.range()`
4. **Memoization**: `useMemo`, `useCallback`, `memo()`
5. **Image Optimization**: Custom Supabase loader with transforms

## Error Handling

### Error Categories

```typescript
type ErrorCategory =
  | 'network'     // Connection issues
  | 'auth'        // Authentication failures
  | 'validation'  // Invalid input
  | 'not_found'   // Resource missing
  | 'permission'  // Access denied
  | 'server'      // Server errors
  | 'unknown';    // Unclassified
```

### Error Boundaries

- Global error boundary at root
- Component-level fallbacks for isolated failures
- Sentry integration for production monitoring

## Scaling Considerations

1. **Database Indexes**: All foreign keys and common queries indexed
2. **RLS Performance**: Policies optimized to avoid N+1
3. **Connection Pooling**: Supabase handles via PgBouncer
4. **CDN**: Static assets served via Vercel Edge
5. **Image CDN**: Supabase Storage with transformation API
