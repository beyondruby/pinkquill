# Pinkquill — System Map (ship-readiness audit, 2026-09-02)

Read-only audit of commit `0c9625b` on `main`, plus the live Supabase project and the live Vercel deployment. Every finding in `01-findings.md` cites a section of this map (`§n`). Paths are relative to the repo root. "Verified" means read in code, measured in production, or queried from the live database this session.

Sizes: `app/` 21.8k lines (80 `page.tsx`, 17 `layout.tsx`), `components/` 60.9k lines (191 files), `lib/` 31.4k lines of which hooks are ~24.5k (`lib/hooks/*.ts` 21.7k + `lib/hooks.legacy.ts` 2.85k). `app/globals.css` is 11,993 lines / 263 KB. 548 commits; 83 files / +5,004 −2,013 changed today alone (4 prod deploys today).

---

## §1 Topology

```
Browser (user, e.g. Riyadh; Vercel edge PoP bom1)           Vercel (all functions in iad1, US-East)          Supabase loaitxbibjftsytlgddi (ap-southeast-1, Singapore)
┌──────────────────────────────────────┐   HTML / RSC   ┌──────────────────────────────────────┐  getUser   ┌───────────────────────────────────────────┐
│ Next 16 client bundle                │ ─────────────▶ │ proxy.ts  → updateSession()          │ ─────────▶ │ GoTrue      /auth/v1                        │
│  AuthProvider → hooks → PostgREST    │                │   (every matched request, Node λ)    │            │ PostgREST   /rest/v1  (RLS, 279 policies)   │
│  realtime-js (1 websocket)           │ ◀───────────── │ 211 route λs (2.2 MB each)           │ ◀───────── │ Realtime    /realtime/v1                    │
│                                      │                └──────────────────────────────────────┘            │ Storage     /storage/v1 (10 buckets)        │
│ ── direct REST / WS / storage ─────────────────────────────────────────────────────────────────────────▶ │ Postgres 17.6, Micro (60 conns, 2 MB work_mem) │
└──────────────────────────────────────┘                                                                    └───────────────────────────────────────────┘
                     GitHub Actions cron → POST /api/orders/auto-decline (*/10 min) and /auto-complete (hourly), bearer CRON_SECRET
```

| Component | Fact (verified) | Source |
|---|---|---|
| Hosting | Vercel project `pinkquill`; functions in **iad1** only; no `vercel.json`, no `preferredRegion`, no `maxDuration` | `vercel inspect` |
| Database | Supabase **ap-southeast-1**, Postgres 17.6, Micro compute: `max_connections=60`, `shared_buffers=224MB`, `work_mem=2184kB`, 2 parallel workers; 19 connections in use | `pg_settings`, `pg_stat_activity` |
| Data today | 13 auth users, 10 profiles, 36 posts, 7 takes, 10 communities, 2 orders, 3 products; DB 30 MB; 82 tables, 407 indexes, 117 functions (96 SECURITY DEFINER), 279 RLS policies | SQL |
| Latency geometry | Browser→Supabase ≈ 200–270 ms per round trip; Vercel iad1→Supabase ≈ 230 ms; every page pays one server-side GoTrue round trip before HTML, then a 5-stage client waterfall | curl, performance API |
| Domains | `www.pinkquill.com` → Vercel; apex 307→www. **`pinkquill.co` does not resolve** but is the `metadataBase` fallback in `app/layout.tsx:175` and is what production emits for `og:image` (NEXT_PUBLIC_BASE_URL is not set in prod) | dig, curl |
| Observability | Sentry fully disabled (all three `sentry.*.config.ts` commented out, no `instrumentation.ts`). Only `console.warn` in the proxy and a client-side ring buffer (`lib/utils/requestMetrics.ts`). | files |
| Caching | Root layout awaits `cookies()` (`lib/theme/server.ts:18`, `lib/feed-view/server.ts:12`) ⇒ **every route is dynamic**; `.next/prerender-manifest.json` has exactly one static route (`/_global-error`); every HTML response is `cache-control: private, no-store`, `x-vercel-cache: MISS` | build output, curl |
| Payments | Stripe only (`lib/providers/stripe-provider.ts`, `placeholder-provider.ts`); PayPal mentioned in older notes is **not in the codebase** | files |
| Versions | next 16.1.1, react 19.2.3, @supabase/ssr 0.8.0, supabase-js / auth-js / realtime-js 2.89.0, stripe ^20.3.1, Node 20 | package.json, node_modules |

Measured production baseline (2026-09-02, 1–2 active users):

| Metric | Value |
|---|---|
| `/` TTFB | 2.0 s cold, 0.55 s warm; 51 KB HTML |
| Client data waterfall on `/` (logged in) | 18–24 Supabase requests in 5 stages, settling at 3.2–4.7 s after navigation |
| Supabase edge requests / 24 h | 5,431. Top: `GET /auth/v1/user` 1,056, `GET /rest/v1/blocks` 388, `profiles` 283, `conversation_participants` 232, `posts` 210, `PATCH post_views` 195, `POST post_views` 187, `HEAD messages` 177, `rpc/get_community_chat_unread_count` 175 |
| Supabase health | 0×5xx, 0×429; origin p50 165 ms, p95 790 ms; GoTrue `/user` p50 3 ms, p95 31 ms. **The backend is not the bottleneck.** |
| Postgres error log / 24 h | `no unique or exclusion constraint matching the ON CONFLICT specification` ×24; RLS violation on `take_views` ×5, `community_views` ×2; `invalid input syntax for type uuid: "temp-…"` ×2 |
| Realtime | `realtime.subscription` delete statements have removed **156,550 rows** since January (subscribe/unsubscribe churn); the WAL poller has run 10.46 M times (68,136 s of DB time) |
| PostgREST | schema-cache reloads ×725 (each ~0.6 s + 5 MB temp) — one per DDL/`NOTIFY`, mostly from migrations applied via MCP |

---

## §2 Request lifecycle (server)

### §2.1 `proxy.ts` (Next 16 middleware)
- Matcher (`proxy.ts:37-47`) = everything except `_next/static`, `_next/image`, and static file extensions. It matches **every page, every RSC prefetch, every `/api/**` route (including the Stripe webhook and both cron routes), and `/auth/callback`**.
- Runs `updateSession(request)` (`lib/supabase/middleware.ts:23-75`) first, then redirects to `/login?redirect=…` when the path is in `PROTECTED_PREFIXES` (`lib/auth/protected-paths.ts`: `/create /messages /saved /settings /orders /queue /cart /pending-collaborations /seller /insights`) and no user resolved.
- Not protected by the proxy (client-side gate only, verified anon gets HTTP 200): `/checkout/*`, `/community/create`, `/community/[slug]/settings/*`, `/community/[slug]/mod`, `/takes/create`, `/sell/*`.

### §2.2 `updateSession()` — what every request costs
1. `createServerClient` (anon key, cookie adapter that rewrites `request.cookies` and rebuilds the response so downstream sees refreshed cookies).
2. `supabase.auth.getUser()` (`:62`): reads the `sb-<ref>-auth-token` cookie; if within 90 s of expiry POSTs `/auth/v1/token` (refresh) and writes new cookies; then **always** GETs `/auth/v1/user` when a cookie exists. This is the 1,056 `/auth/v1/user` calls per day.
3. `Promise.race` against a 5 s timer (`:60-72`). The race is a timer, not a cancellation: no `AbortController` is passed, the `setTimeout` is never cleared (it logs "exceeded 5000ms" after **every** request), and a refresh that finishes after the race lost writes cookies to a response already sent.
4. Any error ⇒ `user = null` ("anonymous"), never "error".

### §2.3 Server Supabase clients
| Client | File | Key | Session | Used by |
|---|---|---|---|---|
| `supabaseAdmin` | `lib/supabase-server.ts` (lazy Proxy) | service role | none | every API route's reads/writes, rate limiting, storage signing, `auth.admin.*`, bearer validation |
| `createSupabaseServerClient()` | `lib/auth-server.ts:9-32` | anon | request cookies | `getAuthUser` cookie fallback, login/logout, `/api/orders/download` (RLS-enforced RPC) |
| inline `createServerClient` | `app/auth/callback/route.ts` | anon | cookies | PKCE exchange |
| transient `createClient` | `change-email`, `change-password` routes | anon | memory | password re-verification (then `signOut()` with default **global** scope) |

`getAuthUser(request)` (`lib/auth-server.ts:54-67`): bearer token → `supabaseAdmin.auth.getUser(jwt)` (network) else cookie client `getUser()` (network). So an authenticated API call = **2 GoTrue round trips** (proxy + route) + 1 `enforce_api_rate_limit` RPC + the work.

### §2.4 API routes (26)
All use `supabaseAdmin` unless noted. SO = `enforceSameOrigin` (Origin/Referer must match host; **missing both is allowed**). RL = `checkRateLimit` → DB RPC `enforce_api_rate_limit` (SECURITY DEFINER, `SELECT … FOR UPDATE` on `api_rate_limits`, **fails closed**, rows never pruned). IP = `cf-connecting-ip` → `x-real-ip` → first `x-forwarded-for` (`lib/api-security.ts:19-33`).

| Route | Auth | SO | RL | Notes |
|---|---|---|---|---|
| `POST /api/auth/login` | public | ✓ | ip 20/5min | username→email lookup, cookie session |
| `POST /api/auth/logout` | none | ✓ | – | clears `sb-*` cookies (`httpOnly:false`) |
| `POST /api/auth/signup` | public | ✓ | ip 5/10min | resend-for-unconfirmed path has no per-email limit |
| `POST /api/auth/resend` | public | ✓ | ip + email | |
| `POST /api/auth/change-email` | user | ✓ | ip | sets `email_confirm:true` immediately; transient `signOut()` = global |
| `POST /api/auth/change-password` | user | ✓ | ip | `currentPassword` optional; transient `signOut()` = global |
| `DELETE /api/account` | user | ✓ | scope `"user"` 3/h | shares bucket with checkout/posts-delete |
| `POST /api/checkout` | user | ✓ | `"user"` 10/min | Turnstile siteverify (no timeout) → re-validates price → Stripe Checkout Session |
| `POST /api/checkout/confirm` | user | ✓ | `"user"` 10/min | only $0 orders outside Stripe in prod |
| `GET /api/checkout/status` | user | – | **none** | `stripe.checkout.sessions.retrieve` per call; polled by complete page |
| `POST /api/orders/create` | user | ✓ | 30/min | RPC `create_marketplace_order` (service role) — ignores client amounts |
| `POST /api/orders/download` | user | ✓ | 30/min | `consume_download_token` via cookie client (RLS) + 5-min signed URL — good pattern |
| `POST /api/orders/files` | user | ✓ | 60/min | ≤50 paths, signed sequentially |
| `POST /api/orders/update-draft` | user | ✓ | 60/min | |
| `POST /api/orders/auto-complete` | CRON_SECRET (timingSafeEqual) | – | – | RPCs + up to 50 sequential Stripe transfers in one request |
| `POST /api/orders/auto-decline` | CRON_SECRET | – | – | |
| `POST /api/payments/refund` | user | ✓ | 12/min | buyer `request` = direct `orders.update` (bypasses `request_refund` RPC); seller approve → Stripe reversal+refund |
| `POST /api/stripe/webhooks` | Stripe signature | – | – | idempotent via `processed_stripe_events`; pays seller + marks `delivered` when `delivery_type==='digital' \|\| listing_type==='product'` |
| `POST /api/stripe/connect/{onboard,dashboard}` | user | ✓ | 15–20/min | |
| `GET /api/stripe/connect/status` | user | – | **none** | `stripe.accounts.retrieve` + `seller_accounts` write per call |
| `POST /api/{listings,posts,takes}/delete` | user | ✓ | 10/min | takes: 12 parallel child deletes then parent, no transaction; storage removes fire-and-forget |
| `POST /api/track/profile-view` | optional | ✓ | 60/min | trusts client `session_id`, `is_follower`, `source` |
| `GET /auth/callback` | none | – | – | PKCE exchange needs the verifier cookie of the requesting browser |

---

## §3 Browser auth lifecycle

### §3.1 The singleton client — `lib/supabase.ts`
- `createBrowserClient` (from `@supabase/ssr`) at module-evaluation time: `flowType: pkce`, `autoRefreshToken: true`, session in **cookies** (chunked, base64url, JS-readable). Throws at import if env is missing.
- `customFetch` (`:188-252`): timeouts 25 s data / **10 s auth** / 300 s upload via real `AbortController`; on 401 → `deduplicatedRefresh()` (single in-flight promise, 30 s cooldown after failure) → one retry with `x-sb-retry`.
- Realtime: `eventsPerSecond: 10`, `timeout: 30000`; `beforeunload` → `removeAllChannels()`.

### §3.2 Inside auth-js 2.89 (verified in `node_modules/@supabase/auth-js/dist/main/GoTrueClient.js`) — the facts the app depends on
- Because `persistSession` is true and `navigator.locks` exists, the client uses **`navigatorLock`**: a Web Locks API exclusive lock named `lock:sb-<ref>-auth-token`, **shared across all same-origin tabs**, acquired with `acquireTimeout = -1` (no timeout, no abort) almost everywhere (`_acquireLock(-1, …)` ×15; only the 30 s auto-refresh tick uses `0` = skip if busy).
- `_acquireLock` is re-entrant by chaining: if the same client already holds the lock, an inner call is queued after the last `pendingInLock` entry — which is the currently running outer function. **An inner call awaited by the outer function deadlocks.** This is the mechanism behind Supabase's documented warning "do not use other Supabase functions inside `onAuthStateChange`".
- The constructor calls `initialize()` → `_acquireLock(-1, _initialize)` → `_recoverAndRefresh()` → **`await this._notifyAllSubscribers('SIGNED_IN', session)` inside the lock, before `initializePromise` resolves** (`GoTrueClient.js:1928,1943`). `_notifyAllSubscribers` awaits every callback (`:2007`).
- `visibilitychange` → `_onVisibilityChanged` → `await initializePromise` → `_acquireLock(-1, _recoverAndRefresh)` → emits `SIGNED_IN` again, under the lock (`:2249-2270`).
- **Every PostgREST / RPC / storage call goes through `getSession()`** (supabase-js `_getAccessToken`, `dist/index.cjs:323-327`) = `await initializePromise` → `_acquireLock(-1)`. The per-query `.abortSignal()` is attached only to the eventual `fetch`, so it cannot interrupt a lock wait.
- Token refresh: `_refreshAccessToken` retries with 200/400/800 ms backoff while `now + backoff − startedAt < 30 s`; an aborted fetch (the app's 10 s timeout) is wrapped as a *retryable* error, so a dead network produces **three 10 s attempts ≈ 31 s holding the cross-tab lock**.

### §3.3 `components/providers/AuthProvider.tsx` (605 lines; outermost provider)
1. Effect registers `onAuthStateChange` (`:368-469`) **then** calls `initAuth()` (`:471`). A 12 s timer (`AUTH_INIT_TIMEOUT_MS`) forces `setLoading(false)` **without touching `user`** (`:277-283`).
2. `initAuth`: `await supabase.auth.getSession()` (`:296`) → no session ⇒ user/profile null, loading false. Session ⇒ `syncRealtimeAuth(token)`, `setUser`, then **awaits** `fetchOrCreateProfileWithTimeout` (`profiles.select('*')`, 10 s abort; on missing profile inserts one with 3 username attempts; on FK error calls `supabase.auth.signOut()` `:162`) → `setLoading(false)`. Profile failure ⇒ retries at 2/5/10 s.
3. `onAuthStateChange`:
   - `SIGNED_OUT` ⇒ synchronous clear.
   - `SIGNED_IN` (`:383-440`) ⇒ if same user and profile already present, `setUser` only; otherwise `setLoading(true)` and **`await fetchOrCreateProfileWithTimeout(session.user)` inside the callback** (`:411`) — a Supabase query awaited inside the auth callback (see §3.2).
   - `TOKEN_REFRESHED` / `USER_UPDATED` ⇒ `setUser(session.user)` (a **new object** even for the same user — several effects key on the object).
4. `visibilitychange` handler (`:485-535`): `getSession()`, re-arm realtime auth, refetch profile if missing — runs concurrently with auth-js's own visibility handler.
5. `signOut` (`:553-598`): `POST /api/auth/logout` → manual `sb-*` cookie expiry → `supabase.auth.signOut()` (global) → `window.location.replace('/')`.

### §3.4 Login / signup / recovery
`POST /api/auth/login` sets cookies server-side; the client then does a full reload (`AuthForm.tsx:44-49`, `AuthModal.tsx:71-85`). Signup → OTP → `verifyOtp`. Forgot password → `resetPasswordForEmail` (PKCE verifier stored in *this* browser's cookie) → `/auth/callback` exchanges server-side → `/settings/account?reset=true`. `RequireAuth` (`components/auth/RequireAuth.tsx`) redirects to `/login` whenever `!loading && !user`.

---

## §4 State management

There is no store library. State lives in three places:

1. **Provider tree** (`app/layout.tsx:248-259`, root → leaf): `AuthProvider` → `ThemeProvider` → `FeedViewProvider` → `UserEventsProvider` → `BadgeCountProvider` → `AuthModalProvider` → `LightboxProvider` → `ModalProvider` (+ `AuthModal` always mounted). None renders null while loading; the "infinite loading" surface is in ~20 consumers that gate on `useAuth().loading` (see §5.3).

| Provider | On mount |
|---|---|
| ThemeProvider | `matchMedia` listener; after auth, if `profile.theme_preference` is null → `profiles.update` |
| FeedViewProvider | after auth, once per page load: resets view to `classic`, writes cookie, and **writes `profiles.update({feed_view_preference:'classic'})` whenever the stored value differs** (`FeedViewProvider.tsx:57-92`) |
| UserEventsProvider | one private broadcast channel `user-events:${userId}` with 3 handlers (`dm_unread_change`, `notification_change`, `follow_change`); deps `[userId]` — the one correctly-built channel |
| BadgeCountProvider | after auth + idle (≤2.5 s): `useUnreadCount` (HEAD `notifications`), `useUnreadMessagesCount` (`blocks`×2 → `conversation_participants` → HEAD `messages` → RPC `get_community_chat_unread_count`, then **every 60 s and on every focus/visibility event, unthrottled**), `useStudioCart` (localStorage) |
| ModalProvider | `popstate` listener; **statically imports** `PostDetailModal` (1,275 lines) and `TakeDetailModal` (731 lines) into the root client chunk |

2. **Per-hook `useState`** inside ~120 hooks (`lib/hooks/*.ts`, `lib/hooks.legacy.ts`), each owning its own fetch, loading flag, optimistic updates and (sometimes) realtime channel. No shared cache: the same data fetched by two components is fetched twice (e.g. `useCommunity` is mounted 2–3× per community page = 16–24 queries; `useTrendingTags` 3× on explore; `useCommunityChatOverview` 2× on `/messages/community`; `useSellerOnboarding` 2× on the seller dashboard → 2 Stripe API calls per visit).

3. **Browser storage**: `localStorage` for drafts (`useDrafts`), studio cart (`useStudioQueue`), mute/volume; `sessionStorage` `quill_session_id` for anonymous tracking; cookies `pq_theme`, `pq_feed_view` (also read server-side, which is what makes every route dynamic).

Module-level singletons with side effects at import: `lib/supabase.ts` (`beforeunload`), `lib/hooks/useTracking.ts` (`visibilitychange`/`pagehide` flush listeners, impression queues, 2-minute block/follow caches), `lib/utils/sanitize.ts` (`DOMPurify.addHook`). The barrel `lib/hooks.ts` re-exports every hook module (incl. the 2,851-line legacy file) and is imported by **57 files**, including root-mounted `BadgeCountProvider`, `LeftSidebar`, `RightSidebar`, `PostCard`, `PostDetailModal`.

---

## §5 What runs on page load

### §5.1 Server
proxy `updateSession()` (1 GoTrue round trip iad1→sin, plus a refresh near expiry) → root layout (`cookies()` ×2, no DB) → route layout (`generateMetadata` on `/community/[slug]`, `/post/[id]`, `/take/[id]` (2 sequential queries), `/studio/[username]`, `/product/[id]`, `/commissions/[id]` each do their own Supabase select) → page. Route `loading.tsx` exists only for `(feed)`, `explore`, `messages`, `studio/[username]`; `error.tsx` only for root and `(feed)`; **no `not-found.tsx` anywhere**.

### §5.2 Client — cold load of `/` for a logged-in user (measured order)
1. Providers mount. `AuthProvider.initAuth` → `getSession()` → `profiles` select (serial, ≤10 s). `loading` stays true until this returns.
2. Shell mounts (`MobileHeader`, `LeftSidebar` with `SearchBar`/`NotificationPanel` dynamic import, `MainContent`, `ConditionalRightSidebar` deferred ≤3 s, `MobileBottomNav`). Right sidebar fires RPC `get_trending_tags`, `communities` (+counts), `profiles`+`follows` for suggested users — not auth-gated, so these are the first requests seen (t≈1.0–1.2 s).
3. `Feed` → `useFeed(user.id, {enabled: !authLoading})`: `posts` (10 rows, 11 embeds) → then 4 parallel (`admires`, `saves`, `relays`, `reactions` by post ids). Skeleton until stage 2 completes (t≈2.1–2.5 s).
4. Per `PostCard` ×10: `useReactionCounts`/`useUserReaction` skipped (feed passes `disableRealtimeSubscriptions`), `useTrackPostImpression` (one batched `post_impressions` insert after 750 ms), `usePostViewTracker` (IntersectionObserver). Each card ≥50 % visible for 1 s → **`blocks`×2 → `follows` → `post_views` upsert** (4 requests per viewed post; 2-minute per-pair cache) and a `post_views` update on viewport exit.
5. `UserEventsProvider` joins the websocket + private channel (`realtime.setAuth` done in AuthProvider).
6. `BadgeCountProvider` after idle: HEAD `notifications`; `blocks`×2 → `conversation_participants` → HEAD `messages` → RPC unread (t≈2.6–3.2 s), then every 60 s.
7. `ThemeProvider`/`FeedViewProvider` may each issue a `profiles.update`.
8. After ≥30 s hidden, focus → `useFeed` refetches page 0 (5 requests, discards pagination) and the badge chain re-runs.

Anonymous: step 1 resolves immediately; feed = 1 `posts` query; sidebar queries; impressions; view upserts (**which always fail** — §6.3).

### §5.3 The `useAuth().loading` gating surface
`RequireAuth` (`/create`, `/messages`, `/messages/community`, `/saved`) shows `FullPageLoading` while `loading || !user` and **redirects to `/login` when `!loading && !user`**; hand-rolled copies in `app/settings/layout.tsx`, `app/insights/layout.tsx`, `app/seller/layout.tsx` (also waits on `useSellerSetupStatus` — 3 serial waits before any seller page), `CreateTake`, `EditListingPage`, `CheckoutPage`, `/saved` (double-gated). `Feed` and `ExplorePageContent` pass `enabled: !authLoading`. `LeftSidebar` shows an avatar skeleton while `loading || (user && !profile)`. Worst case today: 10–12 s of spinner, then content with `profile === null` or a bounce to `/login` for a user who is actually signed in.

---

## §6 Data layer

### §6.1 Access paths
- ~95 % of reads/writes: **browser → PostgREST** directly (anon key + user JWT, RLS). ~120 hooks; PostgREST embeds (`author:profiles!posts_author_id_fkey(...)`, `(count)` relations) are the main join mechanism.
- Server → PostgREST via `supabaseAdmin` (service role) in API routes; via cookie client only for `/api/orders/download`.
- **RPCs**: 117 functions, 96 SECURITY DEFINER. Money/order-state RPCs are correctly locked to `service_role` (`create_marketplace_order`, `finalize_order_*`, `update_order_payment`, `resolve_dispute`, `mark_order_*`, `release_order_escrow`, `sync_seller_account`, `recalculate_seller_stats`, `auth_user_status_by_email`, `handle_new_user`). **74 SECURITY DEFINER functions are executable by `anon`** (default PUBLIC EXECUTE), including `enforce_api_rate_limit`, `create_order_notification`, `get_community_chat_overview(p_user_id)`, `get_community_chat_unread_count(p_user_id)`, `get_user_conversation_ids`, `auto_complete_orders`, `reveal_expired_reviews`, `is_blocked_either_way`, `is_following` — none of which check `auth.uid()` (verified bodies).
- **Triggers (28)**: user-events fan-out (`follows_notify`, `messages_notify_unread`, `notifications_notify` → `realtime.send` to `user-events:<uid>`), order lifecycle (`trg_order_*`, download tokens, stock restore, auto-completion deadline), community chat sync, pricing cache, `on_take_uses_sound`. `notify_dm_unread_change` sends to every participant **except the sender** — i.e. a read receipt (an UPDATE by the reader) is broadcast to the reader.

### §6.2 Realtime
Intended design (May/Jun 2026): one private broadcast channel per user + `usePollOnFocus` for everything else. Actual: **16 `postgres_changes` call sites on 13 channel names** remain (`lib/hooks/useMessaging.ts:177`, `useCommunityChat.ts:661,778,960`, `useOrders.ts:271,712,794`, `useInteractions.ts:436,569`, `hooks.legacy.ts:2241,2354`, `components/messages/MessagesView.tsx:332,342,354`, `ChatView.tsx:363,413`). One is **platform-wide and unfiltered** (`community-announcements-*`, `community_chat_messages` INSERT). The `supabase_realtime` publication still contains **22 tables**, so whenever any `postgres_changes` channel is open the poller decodes WAL for all of them. `usePollOnFocus` has 3 callers; `useUnreadMessagesCount` and `useFeed` hand-roll their own focus polling with different throttles.

### §6.3 Tracking / analytics writes
`lib/hooks/useTracking.ts`: impressions batched (750 ms / 30 rows); views upserted per post/take/community/profile after a dwell threshold, each preceded by `isBlockedEitherWay` (2× `blocks`) and `checkIsFollowing` (1× `follows`) with a 2-minute cache — the source of `/rest/v1/blocks` being the #2 endpoint (18 `from("blocks")` call sites across 8 files). Anonymous upserts use `onConflict: "post_id,session_id,view_date"`, which targets a **partial** unique index and therefore always errors (`42P10`). `take_views` has an INSERT policy but **no SELECT policy**, so PostgREST's `INSERT … RETURNING` is rejected by RLS 100 % of the time (table has 0 rows ever); `community_views` succeeds only for community managers.

### §6.4 RLS shape (live)
- RLS on all 82 tables; policies mostly `(select auth.uid())`-wrapped. Bare `auth.uid()` on `community_member_history`, `community_views`, `user_locations`. Multiple permissive SELECT policies on 8 tables (`community_members`, `order_reviews`, `orders`, `product_files`, `product_purchases`, `reports`, `reviews`, `transactions`).
- Per-row subqueries on hot tables: `posts_select_policy` = public ∨ author ∨ `EXISTS(follows…)` ∨ `is_post_collaborator()`; `community_chat_*` call `can_access_community_chat_thread()` per row; `product_*` join `products` per row.
- Public-write tracking tables with `WITH CHECK (true)`: `community_views`, `profile_views`, `take_impressions`, `take_views` (anon can insert unlimited rows with any `viewer_id`). `notifications_insert` requires `actor_id = auth.uid()` (content/type/target unconstrained). `conv_insert` is `true`.
- Indexes: 407; advisors flag 120 unused, 5 duplicate pairs, 9 unindexed FKs. Tables are tiny today, so nothing is slow yet; `seq_scan` counters (profiles 174 k, post_media 120 k, comments 69 k, reactions 67 k, follows 65 k, relays 53 k, posts 46 k) show the query shapes that become full scans.
- Role `statement_timeout`: anon 3 s, authenticated 8 s, service_role none.

### §6.5 Storage buckets
Public + no size limit: `avatars`, `covers`, `post-media`, `post-audio`, `voice-notes`, `message-media` (the last two hold **DM attachments**; URL = access). Public with limits: `takes` (100 MB), `product-images` (10 MB). Private: `product-files` (500 MB), `order-files`. Voice/media messages persist a 1-hour **signed** URL in `messages.voice_url/media_url` and re-sign on the client when expired.

### §6.6 Migrations
76 files in `supabase/migrations`, latest `20260902_*`. Most objects are captured; DDL is applied to prod via MCP (hence the 725 PostgREST schema reloads). No `supabase db pull` baseline exists.

---

## §7 Hook inventory (condensed — full tables in the audit scratch notes)

| Area | Hooks | Round trips on mount | Pagination | Notable |
|---|---|---|---|---|
| Feed (`useFeed.ts`) | `useFeed` 5 RT / 2 stages; `useSavedPosts` 4 RT **unbounded**; `useRelays` 2 RT **unbounded** | `.range()` on feed only | focus refetch page 0 after 30 s; `pagination.total` never populated |
| Explore (`useExplore.ts`) | up to 10 RT / 3 stages + 2 un-awaited interest queries | fetches 1.5× page, slices → overlapping pages, duplicate keys | `count:"exact"` every page |
| Interactions (`useInteractions.ts`) | `useReactionCounts` 2 RT, `useUserReaction` 1 RT; **2 `postgres_changes` channels per opened post** (modal + `/post/[id]`) | – | plain inserts (double-click → 23505); `admires` and `reactions` both written for the same heart |
| Comments (`useComments.ts`) | 4 RT / 2 stages; likes + **all reply rows** fetched to count | comments only | client-side notification insert per like/comment |
| Tags (`useTags.ts`) | `useTagPosts` up to 9 RT / **6 stages**; `.range()` without `.order()` | non-deterministic | `useTrendingTags` per-instance dedupe (3 instances on explore) |
| Profile (`useProfile.ts`) | `useProfile` up to 10 RT / 4 stages; **every published post of the author** with 11 embeds | none | `useFollowList` stuck if `userId` falsy |
| Takes (`useTakes.ts`, 2,207 lines) | RPC `get_takes_feed` happy path; fallbacks up to 11 RT fetching every interaction row; `useUserTakes/useRelayedTakes/useSavedTakes` 7–10 RT, unbounded | none | 10 s forced `loading=false`; optimistic revert only on thrown errors (PostgREST never throws) |
| Tracking (`useTracking.ts`) | 4 RT per viewed post/take/profile (see §6.3) | – | module-level caches + listeners |
| Messaging (`useMessaging.ts`, `MessagesView`, `ChatView`) | list: 7 RT incl. **all messages of all conversations** ×2; chat: 5 RT / 3 stages | chat keyset 50 | reactions channel recreated per message; list channel + refetch keyed on `user` object; typing never broadcasts |
| Notifications (`useNotifications.ts`) | `useUnreadMessagesCount` 3–4 RT waterfall every 60 s + focus; `useUnreadCount` HEAD refetch on every UPDATE event (no guard) | limit 50 | `retryWithBackoff` ×3 around each step |
| Community chat (`useCommunityChat.ts`, 1,134 lines) | inbox route 7 RT + 2–3 channels; announcements unfiltered stream | none (all messages/threads) | member search scans all `profiles` first |
| Communities (`hooks.legacy.ts`) | `useCommunity` 8 RT (mounted 2–3× per page); `useCommunityPosts` 10 RT / 4 stages per page fetching all engagement rows | posts paged; sort applied per page | join/leave/role/delete are direct client writes (RLS only) |
| Orders (`useOrders.ts`) | `ORDER_SELECT` embeds 4 `*` relations; 3 channels; `count:"exact"` per page | range | `VALID_TRANSITIONS` duplicates RPC state machine |
| Products / commissions | create = 7–10 sequential writes (status `active` set first); update = 15–30 | – | `while(true)` slug loop |
| Insights (`useInsights.ts`, 2,332 lines) | RPC first; fallbacks fetch raw `post_views`/`take_views` rows for the period | none | all six leave `loading=true` when `user` is null |
| Collections / pins / flairs | N sequential updates for reorder; slug loops | – | 5 hooks with no callers |

---

## §8 Shared vs duplicated

| Concern | Canonical | Duplicates |
|---|---|---|
| Raw post row → `Post` | none | 7 copies with drifting fields: `useFeed.ts:223,513,696`, `useExplore.ts:541`, `useTags.ts:276`, `useProfile.ts:255`, `hooks.legacy.ts:854` |
| User-flag batch (admires/saves/relays/reactions `in(ids)`) | none | 5 copies |
| Interaction counts | `(count)` embeds | RPC+head (`useReactionCounts`); fetch-all-rows-and-count (~12 sites) |
| Block check | none | `useTracking` (2-min cache), `useBlock` (none, dead), `useNotifications` (5-min set), inline in `/post/[id]`, `/take/[id]`, `MessagesView`, `useUserSearch` |
| Follow toggle | `useFollow` | `useTakesFollowing` (no pending, no notification), `useProfile` fallback |
| Post detail | – | `app/post/[id]/page.tsx` (1,349 lines) vs `PostDetailModal.tsx` (1,275): 12 identically named handlers |
| Take detail | – | `app/take/[id]/page.tsx` (924) vs `TakeDetailModal.tsx` (731): 9 handlers; plus `useTakeReactionCounts` |
| Auth gating | `RequireAuth` | 7 hand-rolled copies |
| Focus polling | `usePollOnFocus` | `useFeed`, `useUnreadMessagesCount` |
| Find-or-create DM | – | `NewMessageModal`, `StudioProfile` (N+1 loop), `useShareToDM`, `SendToDMModal` |
| Order status config | `lib/utils/orderStatus.ts` | `OrderView.tsx:34`, `SellerListingsGrid.tsx:19`, `StoreTab.tsx:241` |
| MetricCard | `components/insights/cards/MetricCard.tsx` | 4 more |
| Time formatting | `lib/utils/time.ts` | 9 local copies |
| Price formatting | none | 5 copies |
| Platform fee | – | `lib/payments.ts:21`, `lib/types/store.ts:646`, literal `0.05` in 2 SQL functions; **fee base differs** (creation excludes shipping; promo + Stripe transfer include it) |
| Helpers | – | `getClientIp` ×2, `normalizeUsername` ×2, transient auth client ×2, `verifyCronSecret` ×2, `writeCookie` ×2, idle-defer ×2, `generateSlug` ×2, `clampMin` ×2 |

---

## §9 Bundle and assets
- Root client chunk includes 8 providers, `AuthModal` + `useAuthFlow`, `ModalProvider` → `PostDetailModal` + `TakeDetailModal` (+ `ReactionPicker`, `CommentItem`, `AudioPlayer`, DOMPurify), sonner, FontAwesome runtime. 5.8 MB of chunks total; three 292 KB chunks.
- `app/layout.tsx` loads **15 Google font families / 46 faces**; only `Poppins`, `Open Sans`, `Playfair Display`, `Lora` have their CSS variable referenced anywhere. The composer writes literal family names into inline styles, which `next/font` does not serve and the sanitizer strips.
- `globals.css` 263 KB shipped on every route; three `.aura-blob` divs with `filter: blur(100px)` and an infinite animation on every page.
- Static prose routes (`/help/*`, `/privacy`, `/terms`, `/community-guidelines`, `/marketplace-guidelines`, `/about`) are `"use client"` and dynamic.
- Unused: `@fortawesome/fontawesome-svg-core` (0 imports), `react-intersection-observer` (1 call site), `NEXT_PUBLIC_SENTRY_DSN`.
