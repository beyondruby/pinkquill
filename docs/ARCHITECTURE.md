# Pinkquill — Architecture

How the system is put together as of 2026-09-02 (after the ship-readiness audit, Phases 1–8). Derived from `docs/audit/00-system-map.md`; the audit findings and what each phase changed are in `docs/audit/01-findings.md` and `docs/audit/03-progress.md`. Paths are relative to the repo root.

Sizes: `app/` ~25k lines (80 pages, 18 layouts), `components/` ~61k lines, `lib/` ~32k lines of which hooks are ~22k (`lib/hooks/*.ts`, 36 modules, plus `lib/hooks.legacy.ts` for communities/search). `app/globals.css` is ~8.4k lines / 189 KB; feature CSS lives next to the components that use it.

---

## 1. Topology

```
Browser                                   Vercel (functions pinned to sin1)            Supabase loaitxbibjftsytlgddi (ap-southeast-1)
┌────────────────────────────────┐  HTML   ┌──────────────────────────────────┐ getUser ┌────────────────────────────────────────┐
│ Next 16 client bundle          │ ──────▶ │ proxy.ts → updateSession()       │ ──────▶ │ GoTrue     /auth/v1                    │
│  AuthProvider → hooks → REST   │         │ route handlers (app/api/**)      │         │ PostgREST  /rest/v1 (RLS on all tables)│
│  realtime-js (1 websocket)     │ ◀────── │ RSC layouts/pages                │ ◀────── │ Realtime   /realtime/v1                │
│                                │         └──────────────────────────────────┘         │ Storage    /storage/v1 (10 buckets)    │
│ ── direct REST / WS / storage ────────────────────────────────────────────────────▶ │ Postgres 17 (Micro compute)            │
└────────────────────────────────┘                                                      └────────────────────────────────────────┘
                     GitHub Actions cron → POST /api/orders/auto-decline (*/10 min), /api/orders/auto-complete (hourly), bearer CRON_SECRET
```

| Component | Fact |
|---|---|
| Hosting | Vercel project `pinkquill`; `vercel.json` pins all functions to **sin1** (same region as the database). Production domain `www.pinkquill.com` (apex 307 → www); `metadataBase` defaults to it. |
| Database | Supabase, Postgres 17, Micro compute (60 connections). RLS on every table; ~117 SQL functions, most `SECURITY DEFINER`; 28 triggers. |
| Payments | Stripe (Checkout Sessions + Connect Express) behind `lib/payment-provider.ts`; `placeholder-provider.ts` for local/dev. Turnstile on checkout. |
| Observability | Sentry config files exist but are disabled (`sentry.*.config.ts` commented out); `[auth-diagnostic]` server logs; a client ring buffer in `lib/utils/requestMetrics.ts`. |
| Versions | next 16.1, react 19.2, @supabase/ssr 0.8, supabase-js 2.89, stripe 20, Node 20. |

Latency geometry: browser → Supabase is one Asian round trip (~200 ms from the Gulf); Vercel sin1 → Supabase is ~1 ms. Anything that must be fast per request belongs on the server side of that line or in a single RPC.

---

## 2. Request lifecycle (server)

### 2.1 `proxy.ts` (Next middleware)
Matches every page, RSC prefetch, `/api/**` and `/auth/callback` (not `_next/*` or static files). The static prose paths (`/about`, `/help/*`, `/login`, `/privacy`, `/terms`, `/community-guidelines`, `/marketplace-guidelines`) skip the GoTrue round trip entirely and are prerendered.

For everything else it runs `updateSession()` (`lib/supabase/middleware.ts`): an anon `createServerClient` with a cookie adapter, then `auth.getUser()` under a real `AbortController` timeout. An unresolved user on a protected prefix (`lib/auth/protected-paths.ts`: `/create /messages /saved /settings /orders /checkout /cart /pending-collaborations /seller /sell /insights`) → 307 to `/login?redirect=…`. Community settings/mod pages and `/community/create`, `/takes/create` are additionally gated client-side.

### 2.2 Server Supabase clients
| Client | File | Key | Used by |
|---|---|---|---|
| `supabaseAdmin` | `lib/supabase-server.ts` (lazy Proxy so build never needs env) | service role | API-route reads/writes, storage signing, `auth.admin.*` |
| `createSupabaseServerClient()` | `lib/auth-server.ts` | anon + request cookies | `getAuthUser` cookie fallback, login/logout, RLS-enforced RPCs (`/api/orders/download`, refund requests) |
| inline `createServerClient` | `app/auth/callback/route.ts` | anon | PKCE exchange |
| transient `createClient` | change-email / change-password routes | anon, memory | password re-verification; signs out with `scope: "local"` |

`getAuthUser(request)`: bearer token → `supabaseAdmin.auth.getUser(jwt)`, else cookie client. `hasRecentRecoveryAuth` reads the JWT `amr` claim so a password reset does not need the old password.

### 2.3 API routes (`app/api/**`)
All routes go through `lib/api-security.ts`: `enforceSameOrigin`, `checkRateLimit` (DB RPC `enforce_api_rate_limit`, per-route scopes such as `checkout.create`, `posts.delete`; rows older than 24 h are pruned by the auto-decline cron), client IP from `x-real-ip` → `x-forwarded-for` (Vercel-set). `verifyCronSecret` guards the two cron routes.

| Group | Routes | Notes |
|---|---|---|
| Auth | `auth/{login,logout,signup,resend,change-email,change-password}` | server-side signup/resend; email change uses GoTrue's confirmation flow (`profiles.email` follows via trigger); password change requires the current password unless a recent recovery `amr` entry exists |
| Account | `DELETE account` | |
| Commerce | `checkout`, `checkout/confirm`, `checkout/status`, `orders/{create,download,files,update-draft}`, `payments/refund`, `stripe/webhooks`, `stripe/connect/{onboard,dashboard,status}` | orders are created by the `create_marketplace_order` RPC (server computes every money figure; the client never sends amounts); the webhook pays the seller and marks `delivered` only for **digital** products; buyer refund requests go through the guarded `request_refund` RPC as the buyer |
| Cron | `orders/auto-complete`, `orders/auto-decline` | bearer `CRON_SECRET` |
| Content | `posts/delete`, `takes/delete`, `listings/delete` | service-role deletes after ownership check |
| Tracking | `track/profile-view` | calls `record_profile_view_admin` (self/block/follower decided in SQL) |
| Diagnostics | `diagnostics/auth` | |

---

## 3. Browser auth

- `lib/supabase.ts` creates one `createBrowserClient` (PKCE, cookies, `autoRefreshToken`) with a `customFetch` that applies real `AbortController` timeouts (data 25 s, auth 10 s, upload 300 s) and a single deduplicated refresh-and-retry on 401.
- auth-js uses the cross-tab **Web Locks** lock `lock:sb-<ref>-auth-token`. Every PostgREST/RPC/storage call waits for that lock via `getSession()`. **Rule (Phase 1): never await a Supabase call inside `onAuthStateChange`** — it re-enters the lock and deadlocks every tab. `AuthProvider` reacts to auth events by setting state and scheduling work outside the callback.
- `components/providers/AuthProvider.tsx` owns `user`, `profile`, `loading`. Profile creation happens in a DB trigger on signup, not in the client. `loading` is guaranteed to flip false on every path (timeouts do not turn "unknown" into "anonymous").
- Login/signup: `POST /api/auth/login` sets cookies server-side, then the client reloads. Signup → 6-digit OTP (`verifyOtp` type `signup`). Forgot password → emailed link → `/auth/callback` (PKCE exchange, server-side) → `/settings/account?reset=true`; callback errors land on `/login?error=…`.
- `RequireAuth` (`components/auth/RequireAuth.tsx`) is the client gate; `/login` redirects already-signed-in users to their `?redirect=` target.

---

## 4. State management

There is no store library. State lives in:

1. **The provider tree** (`app/layout.tsx`, root → leaf): `AuthProvider` → `ThemeProvider` → `FeedViewProvider` → `UserEventsProvider` → `BadgeCountProvider` → `AuthModalProvider` → `LightboxProvider` → `ModalProvider` (+ `AuthModal` always mounted).
   - `ThemeProvider` / `FeedViewProvider` take no server props. An inline head script stamps `<html data-theme>` from the `pq_theme` cookie before first paint; the providers adopt the cookie after hydration. `FeedViewProvider` writes `profiles.feed_view_preference` only on an explicit user choice.
   - `UserEventsProvider` joins **one** private broadcast channel `user-events:${userId}`; DB triggers (`follows_notify`, `messages_notify_unread`, `notifications_notify`, …) `realtime.send` targeted events into it. `realtime.setAuth` is called by `AuthProvider` before any private channel joins.
   - `BadgeCountProvider` fetches unread notification/DM counts via RPC after idle and re-polls on focus (`usePollOnFocus`), not on a timer.
   - `ModalProvider` owns the post/take detail modals (URL push-state, update/delete pub-sub). Both modals are `next/dynamic` imports loaded on first open.
2. **Per-hook `useState`** in `lib/hooks/*` and `lib/hooks.legacy.ts`. Each hook owns its fetch, loading flag, optimistic update + revert, and (rarely) a realtime channel. Shared caches exist only where a duplicate mount was measured: `CommunityContext` (community layout fetches once; `useCommunity(slug)` reads it), `useTrendingTags` (module cache + in-flight dedupe), `useSellerOnboarding` (5-minute cache).
3. **Browser storage**: `localStorage` for drafts (`useDrafts`, 30 s auto-save), studio cart (`useStudioQueue`), mute/volume; `sessionStorage` `quill_session_id` for anonymous tracking; cookies `pq_theme`, `pq_feed_view` (client-read only).

Module-level side effects at import: `lib/supabase.ts` (`beforeunload` channel cleanup), `lib/hooks/useTracking.ts` (impression queue flush on `visibilitychange`/`pagehide`), `lib/utils/sanitize.ts` (DOMPurify style hook). Hooks are imported by direct path (`@/lib/hooks/useFeed`); there is no barrel.

---

## 5. What runs on page load

**Server**: proxy `updateSession()` (skipped for prose routes) → root layout (no cookies/headers, so routes without server data prerender) → route layout (`generateMetadata` on `/community/[slug]`, `/post/[id]`, `/take/[id]`, `/studio/[username]`, `/product/[id]`, `/commissions/[id]`) → page. Every route group has an `error.tsx`; `app/not-found.tsx` exists.

**Client, signed-in `/`**:
1. Providers mount; `AuthProvider` resolves the session and profile.
2. Shell mounts (`LeftSidebar`, `MainContent`, deferred `ConditionalRightSidebar`, `MobileBottomNav`). Right sidebar: `get_trending_tags` RPC, suggested communities/users.
3. `Feed` → `useFeed`: one `posts` page with embedded relations and `(count)` aggregates, then one batched `fetchUserPostFlags` read (admires/saves/relays/reactions for the page). Rows become `Post` objects through `lib/posts/enrich.ts` — the single mapper used by feed, saved, explore, tag, profile and community lists.
4. Per `PostCard`: a batched `post_impressions` insert and an `IntersectionObserver` that, after 1 s at ≥50 % visibility, calls the `record_content_view` RPC once (viewer, block and follower status resolved in SQL) and `update_content_view` on exit with read time.
5. `UserEventsProvider` joins the websocket + private channel; `BadgeCountProvider` fetches badge counts after idle.

Anonymous: same minus auth/badges; views are recorded by `session_id` through the same RPC.

---

## 6. Data layer

### 6.1 Access paths
- ~95 % of reads/writes are **browser → PostgREST** with the user JWT under RLS. Embeds (`author:profiles!posts_author_id_fkey(...)`, `comments!parent_id(count)`) are the join mechanism; lists use `.range()` and, where sort matters, an explicit `.order()`.
- **RPCs** for anything multi-step or privileged. Money and order-state RPCs (`create_marketplace_order`, `finalize_order_*`, `update_order_payment`, `resolve_dispute`, `release_order_escrow`, `record_profile_view_admin`, …) are `service_role` only. User-action RPCs (`accept_order`, `request_refund`, community membership `invite/join/request/accept/decline/approve/reject`, `get_or_create_dm_conversation`, `record_content_view`, `get_dm_conversation_overview`, …) are granted to `authenticated` (+ `anon` only where the surface is public) and check `auth.uid()` themselves. Trigger functions and internal helpers are locked to `service_role`; `search_path` is pinned on all `SECURITY DEFINER` functions.
- **Client writes that remain direct** (RLS-only): reactions/admires/saves/relays, comments and likes, follows (a trigger forces `pending` for private targets), reports, drafts of products/commissions, community create/update. Notifications are inserted by triggers or by the actor (`actor_id = auth.uid()`).
- Blocks are enforced in RLS (`posts_select_policy`, `takes_select`), so a blocked viewer gets the same 404/empty result everywhere; no client-side block filtering.

### 6.2 Realtime
Design rule: **one private broadcast channel per user; no new `postgres_changes` subscriptions.** The `supabase_realtime` publication contains only the 5 tables still needed by the scoped, in-view subscriptions that remain: `messages` (open conversation), `community_chat_messages`/threads (staff inbox), `orders` (open order / seller dashboard), and reactions on an open post detail. Everything list-shaped polls on focus via `usePollOnFocus`. DM list previews/unread counts come from the `get_dm_conversation_overview` RPC plus targeted `dm_unread_change` events.

### 6.3 Tracking
`lib/hooks/useTracking.ts`: impressions are batched inserts (`post_impressions`, `take_impressions`, attributed after auth settles). Views go through `record_content_view(kind, id, session, source)` / `update_content_view(...)`; the four view tables have **no direct client write policy** and are readable only by the content owner. Unique indexes `(x_id, session_id, view_date)` make anonymous upserts conflict-safe.

### 6.4 RLS and indexes
RLS on all tables, predicates wrapped as `(select auth.uid())`, one permissive policy per command per table. Helper predicates (`is_community_*`, `is_post_collaborator`, `can_access_community_chat_thread`, `user_is_conversation_participant`) stay callable by the invoking role because policies evaluate them. Covering indexes exist for every FK; duplicate indexes were dropped. Role `statement_timeout`: anon 3 s, authenticated 8 s, service_role none.

### 6.5 Storage buckets
Public: `avatars`, `covers`, `post-media`, `post-audio`, `takes`, `product-images` (all size-limited). Private: `message-media`, `voice-notes` (path `<sender>/<conversation>/…`, policies scoped to conversation participants; the client re-signs expired/legacy links via `useFreshMediaUrl`), `product-files`, `order-files` (download via `consume_download_token` + 5-minute signed URL).

### 6.6 Migrations
`supabase/migrations/` (82 files) is the record; DDL is applied to prod through the Supabase MCP and the file committed alongside. Phase migrations are `20260902_phase{2..7}_*.sql`.

---

## 7. Hooks (condensed)

| Area | Module | Shape |
|---|---|---|
| Feed / saved / relays | `useFeed.ts` | 2 round trips per page (posts page + flags batch); request ids drop stale responses; focus refetch |
| Explore, tags | `useExplore.ts`, `useTags.ts` | one page per request, de-duplicated append; `useTrendingTags` shared cache |
| Interactions | `useInteractions.ts` | reactions via `reactions` table + `get_reaction_counts` RPC; `useBlock` |
| Comments | `useComments.ts` | `comment_likes(count)` and reply `(count)` embeds |
| Profile / follows | `useProfile.ts` | `followUserRecord` is the single follow implementation (private → pending + `follow_request` notification) |
| Takes | `useTakes.ts` | `get_takes_feed` RPC first, query fallback; reaction writes throw on error so optimistic state reverts |
| Tracking | `useTracking.ts` | see 6.3 |
| Messaging | `useMessaging.ts`, `useShareToDM.ts`, `lib/messaging/conversations.ts` | `get_or_create_dm_conversation` for find-or-create; reactions/typing over the per-user broadcast channel |
| Notifications / badges | `useNotifications.ts`, `usePollOnFocus.ts` | RPC counts, focus polling |
| Communities, search | `hooks.legacy.ts` | `useCommunity` reads `CommunityContext` under the community layout; membership actions are RPCs |
| Community chat | `useCommunityChat.ts` | staff inbox threads/messages, announcements |
| Commerce | `useOrders.ts`, `useProducts.ts`, `useCommissions.ts`, `usePayments.ts`, `useSellerProfile.ts`, `usePromoCode.ts`, `useDownloads.ts`, `useShipping.ts`, `useDisputes.ts`, `useReviews.ts`, `useMarketplace.ts` | orders/refunds/state transitions through RPCs or API routes; product create/update is still a multi-write client sequence (open item) |
| Insights | `useInsights.ts` | RPC aggregates per period |
| Composer | `useDrafts.ts`, `useMedia.ts`, `useAudioUpload.ts`, `useFlair.ts`, `usePinnedPosts.ts`, `useCollections.ts` | |

Conventions every hook follows: `loading` initialised only when a fetch will run and flipped false on every path; aborted requests detected with `isAbortError` from `lib/utils/retry.ts` (supabase-js returns an `AbortError:`-prefixed error object rather than throwing); `pendingRef` for double-click protection; `crypto.randomUUID()` temp ids that never reach PostgREST filters.

---

## 8. Shared modules (canonical homes)

| Concern | Module |
|---|---|
| Raw post row → `Post`, selects, user-flag batch | `lib/posts/enrich.ts` |
| DM find-or-create | `lib/messaging/conversations.ts` |
| Platform fee (`PLATFORM_FEE_RATE`, 5 %) | `lib/payments.ts` (SQL functions use the same rate and base: discounted amount minus shipping) |
| Currency, time, slug, cookies, retry/abort, sanitize, storage paths, toasts | `lib/utils/*.ts` |
| Order status vocabulary | `lib/utils/orderStatus.ts` |
| API security helpers (origin, rate limit, IP, cron secret) | `lib/api-security.ts` |
| Auth server helpers | `lib/auth-server.ts`, `lib/auth/protected-paths.ts` |
| Theme | `lib/theme/*` (registry, inline resolve script) |
| Route error UI | `components/ui/RouteError.tsx` |

Known remaining duplication (tracked in `03-progress.md`): post/take detail page vs modal, `MetricCard` copies, `ORDER_STATUS_CONFIG` copies, hand-rolled auth gates that should use `RequireAuth`.

---

## 9. Bundle, fonts and CSS

- Root client chunk: the 8 providers, `AuthModal`, sonner, FontAwesome runtime. `PostDetailModal` and `TakeDetailModal` are dynamic imports (loaded on first open).
- Fonts: `app/layout.tsx` registers 15 Google families through `next/font`; only Poppins and Open Sans (the UI/body fonts, `--font-ui`/`--font-body`/`--font-display`) are preloaded. The other 13 exist for the composer's font picker, which writes `font-family: var(--font-<slug>), <generic>` — the only font-family values the sanitizer (`lib/utils/sanitize.ts`) keeps; legacy literal family names in stored posts are rewritten to the variable at render time.
- CSS: Tailwind v4 plus `app/globals.css` (theme tokens, post forms/views, cards, modals, editor, shared animations). Feature-only styles are colocated and imported by the components that use them: `components/takes/takes.css`, `components/studio/studio.css`, `components/messages/messages.css`. The aura background blobs are not rendered under 768 px and do not animate under `prefers-reduced-motion`.
- Static routes: the prose pages listed in §2.1 prerender; everything else is dynamic because it reads the session.

---

## 10. Working rules

1. No Supabase calls awaited inside `onAuthStateChange`; no `loading=true` without a guaranteed `false`.
2. New realtime needs go through the per-user broadcast channel + a DB trigger, never a new `postgres_changes` subscription or a new published table.
3. Any write that moves money, changes order state, changes membership, or must be atomic is a `SECURITY DEFINER` RPC with an `auth.uid()` check and an explicit `GRANT`; never leave a new function on the default `PUBLIC` execute.
4. Analytics writes go through the `record_*`/`update_*` RPCs; view tables have no client write policy.
5. Server work lives in sin1; keep the root layout free of `cookies()`/`headers()` so prose routes stay static.
6. Design: no accent-line borders (`border-l-4` with brand colours); full subtle background + matching border instead. Visual changes are shown before they ship.
7. When something is "stuck loading", check in order: hook loading guards → middleware/auth timeout → private channel `setAuth` (see `docs/audit/03-progress.md`, Phase 1).
