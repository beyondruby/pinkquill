# Pinkquill — Findings (ship-readiness audit, 2026-09-02)

Companion to `00-system-map.md` (cited as `§n`). One root cause = one finding, with every location listed. Severity: **CRITICAL** (users lose access, money, or data), **HIGH** (breaks at modest load or is exploitable), **MEDIUM**, **LOW**. "Verified" = read end-to-end in code, measured in prod, or queried in the live DB. "Suspected" = strongly indicated but not reproduced.

Categories, in the order requested: (1) hang / fail to load, (2) breaks under load, (3) security, (4) broken or half-finished, (5) contradictions, (6) dead code.

---

## 1. Anything that can make the site hang or fail to load

### H1 — Supabase queries are awaited inside `onAuthStateChange`; under auth-js's cross-tab lock this deadlocks the tab, and every other Pinkquill tab with it  — **CRITICAL, verified structurally, not reproduced**
**What.** `AuthProvider`'s `SIGNED_IN` handler awaits `fetchOrCreateProfileWithTimeout()` (`components/providers/AuthProvider.tsx:411`), which runs `profiles` select/insert (`:94-98`, `:132-142`) and can call `supabase.auth.signOut()` (`:162`). Every one of those goes through `getSession()` → `_acquireLock(-1)` (§3.2). auth-js emits `SIGNED_IN` **from inside the lock** during `_initialize` (before `initializePromise` resolves) and on every `visibilitychange` to visible, and it awaits each callback. Re-entrant lock calls are queued behind the outer function, so the outer function waits for the handler, the handler waits for `getSession()`, and `getSession()` waits for the outer function. Nothing times out: the lock has no acquire timeout, and the 10 s `AbortController` is attached only to a `fetch` that never starts.
**When it triggers.** (a) Init path: whenever `_initialize` is delayed until after React hydrates and subscribes — i.e. another same-origin tab holds `lock:sb-<ref>-auth-token` (it is a Web Locks API lock shared by all tabs; a tab holds it for the length of its own `SIGNED_IN` handler, up to 10 s, or a refresh, up to ~31 s per H2). (b) Visibility path: whenever `hasProfile` is false when the tab regains focus (`:392-396`) — any earlier profile fetch failure, timeout, or RLS error.
**Why it matters.** A deadlocked tab holds the cross-tab lock forever. Every other tab and every new tab then blocks in `initialize()`; after 12 s AuthProvider gives up with `user = null`; feed hooks start as guest but every `supabase.from()` still blocks on `getSession()`; `Feed` auto-retries twice at 12 s and then shows nothing. Refreshing a tab that is *not* the lock holder re-enters the wait and then deadlocks itself the moment the lock transfers, because it already has a subscriber. This matches "slow, sometimes doesn't load, 10+ minutes even with repeated refreshes" while every Supabase log looks healthy (no request is ever sent). The one thing this audit could not do is reproduce it live; Phase 1 includes the instrumentation to confirm it.
**Root cause.** Awaiting Supabase work inside the auth callback — the exact pattern Supabase's docs forbid ("do not use other Supabase functions in the callback; dispatch with `setTimeout(…, 0)`"). The May 2026 fix moved `getUser()` out of `initAuth` for this reason but left the profile fetch inside the callback.
**Locations.** `components/providers/AuthProvider.tsx:368-469` (subscription), `:383-440` (`SIGNED_IN` await), `:411`, `:162` (`signOut` inside `createProfile`), `:92-115`, `:118-177`, `:183-209`; `lib/supabase.ts:267-278` (client created at import, `navigatorLock`); vendor: `@supabase/auth-js/dist/main/GoTrueClient.js:1097-1145` (`_acquireLock`), `:1864-1950` (`_recoverAndRefresh` emits inside lock), `:2007` (awaits callbacks), `:2249-2270` (visibility path), `lib/locks.js:99-163`. Map §3.2–§3.3.

### H2 — No timeout on auth-lock acquisition anywhere; a slow refresh holds the cross-tab lock ~31 s and every query in every tab queues behind it — **HIGH, verified**
**What.** `lib/supabase.ts:16` caps auth requests at 10 s, but auth-js treats an aborted fetch as retryable and retries while `elapsed < 30 s`: three 10 s attempts ≈ 31 s under `_acquireLock(-1)`. Every `supabase.from()` (via `getSession()`), `refreshSession()` (`lib/supabase.ts:166`), `getSession()` in `lib/auth-client.ts:62` and `AuthProvider.tsx:296,492`, and every hook calling `supabase.auth.getUser()`/`getSession()` (`useOrders.ts:110-112,183,520`, `useProducts.ts:259,533,953,1040`, `useCommissions.ts:49,223`, `useDisputes.ts:153,191,229`, `hooks.legacy.ts:1366,1491,1861-1897`) waits with no timeout. Combined with `customFetch`'s 25 s + 401-retry a single query can take ~112 s.
**Why.** On a flaky mobile network the whole app freezes for half a minute at every token expiry, in every tab; there is no recovery path from H1 other than closing tabs.
**Root cause.** The 10 s auth timeout assumed one attempt; the app never configures `auth.lock` (auth-js supports a custom lock with acquire timeout / `LockAcquireTimeoutError`).
**Locations.** `lib/supabase.ts:15-17,154-185,207-240,267-278`; the hook call sites above; vendor `_refreshAccessToken`, `lib/helpers.js:173-193`. Map §3.1–§3.2.

### H3 — Timeouts that "give up" convert *unknown* into *anonymous* or *empty*, bouncing signed-in users and hiding failures — **HIGH, verified**
**What.** Three layers each mask a hang with a wrong terminal state:
- `AuthProvider.tsx:277-283`: 12 s timer sets `loading=false` with `user=null`. `RequireAuth.tsx:27-31` then `router.replace('/login?redirect=…')` for a user the proxy has just validated; `LeftSidebar`, `MobileBottomNav`, `Feed` render guest UI; when `getSession()` finally resolves the navigation has already happened.
- `lib/hooks/useTakes.ts:584-594`: 10 s timer forces `loading=false` → empty takes feed with no error and no retry (`fetchMore` gated on `!loading`).
- `components/feed/Feed.tsx:246-267`: 12 s "stuck" auto-retry calls `refresh()` twice while the original 25 s fetch is still in flight → up to three overlapping feed loads.
**Root cause.** Timeouts written as "flip the flag" instead of surfacing an error state; "not signed in" and "don't know yet" share one representation (`user === null`).
**Locations.** as above plus `components/auth/RequireAuth.tsx:27-35`, `app/settings/layout.tsx:26-32`, `app/insights/layout.tsx:26-32`, `app/seller/layout.tsx:41-45`, `components/checkout/CheckoutPage.tsx:475-478`, `components/takes/CreateTake.tsx:436-449`, `components/seller/EditListingPage.tsx:22-36`. Map §3.3, §5.3.

### H4 — `loading` initialised to `true` with early-return paths that never flip it (the May 2026 bug class, re-introduced in 17 hooks) — **HIGH, verified**
**What.** Hooks start with `useState(true)` and `return` before fetching when their key is falsy (modal closed, parent still loading, auth null). Consumers show a skeleton forever.
**Locations.**
- `lib/hooks/useTakes.ts:934-936` `useTakeReactionCounts`, `:1021-1023` `useTakeComments` (callers pass `take?.id || ""`, `TakeDetailModal.tsx:71-72`)
- `lib/hooks/useProfile.ts:466` `useFollowList`
- `lib/hooks/useModQueue.ts:32`
- `lib/hooks.legacy.ts:76` `useCommunity`, `:586` `useCommunityMembers`, `:725` `useCommunityPosts`, `:1161` `useJoinRequests` (pages pass `community?.id || ''`; if `useCommunity` errors the page spins instead of showing the error)
- `lib/hooks/useInsights.ts:134` `useInsightsDashboard`, `:533` `usePostInsights`, `~745` `useTakeInsights`, `:979` `useProfileInsights`, `:1295` `useCommunityInsights`, `:1634` `useContentInsights` (all six spin for a null user — exactly the state H3 produces)
- `lib/hooks/useDisputes.ts:52-96` `useOrderDispute`: no `try/catch`, so a thrown 25 s `AbortError` skips `setLoading(false)`
- `components/messages/MessagesView.tsx:82` (`if (!user) return;` — benign only because the component returns null when `!user`)
Correct examples to copy: `useFeed.ts:354`, `useExplore.ts:742`, `useComments.ts:472`, `useNotifications.ts:145`.
**Root cause.** Guard clauses written as bare `return;`. Map §7.

### H5 — Middleware "timeout" neither cancels the GoTrue call nor clears its timer, and can discard a rotated refresh token — **HIGH, verified code; production incidence suspected**
**What.** `lib/supabase/middleware.ts:60-72`: (1) no `AbortController` / custom fetch is passed to `createServerClient`, so when the 5 s branch wins the `/auth/v1/user` (and any `/token`) request keeps running to undici's ~300 s defaults, one socket per hung request in the proxy; (2) the `setTimeout` is never cleared — it fires after **every** request and logs "exceeded 5000ms; treating as anonymous", so the production log for this symptom is noise; (3) if a refresh completes after the race lost, `setAll` writes cookies to a response already returned — the browser keeps the old refresh token that GoTrue just rotated, and outside GoTrue's reuse window the next refresh fails with `invalid_grant` → `_removeSession` → forced sign-out (suspected contributor to random logouts).
**Root cause.** `Promise.race` is a timer, not a cancellation.
**Locations.** `lib/supabase/middleware.ts:28-47,60-72`; `proxy.ts:24-35`. Map §2.2.

### H6 — `retryWithBackoff` never retries PostgREST errors but *does* retry thrown timeouts: 3 × 25 s × waterfall = multi-minute chains that block other fetches — **HIGH, verified**
**What.** `lib/utils/retry.ts:93-129` retries only when the operation **throws**. postgrest-js resolves `{ error }` (never throws), and callers check `error` after the wrapper, so the "retry" around `useFeed`, `useCommunity` and all `useNotifications` queries is dead weight for real errors. But a `fetchWithTimeout` abort **does** throw, `isRetryableError` matches "timed out", so `useUnreadMessagesCount.fetchCount` — four sequential retry-wrapped queries — can run ~5 minutes on a slow network, during which `isFetchingRef` (`useNotifications.ts:467`) drops every other trigger.
**Locations.** `lib/utils/retry.ts:43-129`; `lib/hooks/useFeed.ts:166-169`; `lib/hooks.legacy.ts:92-117`; `lib/hooks/useNotifications.ts:84-122,231-249,394-404,432-441,478-488,505-518,526-538`. Map §4 (BadgeCountProvider).

### H7 — Realtime channels re-created on unstable effect dependencies (156,550 subscription rows deleted since January) — **HIGH, verified**
**What.** Channels are torn down and re-subscribed on every render-level change of their inputs:
- `lib/hooks/useMessaging.ts:135,148,160,175-182,265` — `message-reactions-${conversationId}` keyed on `messageIdsKey`, which `ChatView.tsx:162` rebuilds from `messages` on **every message, older-page load and read receipt**; the filter `message_id=in.(…)` carries 50–100 UUIDs and optimistic `temp-…` ids (prod log: `invalid input syntax for type uuid`). Primary suspect for the churn.
- `components/messages/MessagesView.tsx:237-239,374` — list channel + 7-query refetch keyed on the `user` **object**, which `AuthProvider.tsx:397,447,453` replaces on every `SIGNED_IN` re-validation (tab focus), `TOKEN_REFRESHED` (hourly), `USER_UPDATED`.
- `components/messages/ChatView.tsx:436` — `chat-${conversationId}` deps include block flags that flip after the first fetch.
- `lib/hooks/useInteractions.ts:433-447,566-592` — two channels per opened post (`PostDetailModal.tsx:192-193`, `app/post/[id]/page.tsx:199-200`), same server filter, re-created on every open/close; each event triggers 2 REST calls.
- `lib/hooks.legacy.ts:2352-2364` — `collab-invites-${userId}` opened every time `NotificationPanel` opens (`NotificationPanel.tsx:1025`).
**Why.** Each subscribe costs the realtime server a subscription row insert/delete and re-arms WAL decoding for 22 tables; at 10k users chatting this is the realtime tier's failure mode ("hit concurrent-connection limits and froze the app" — the May 2026 incident).
**Root cause.** Effects keyed on arrays/objects instead of ids, plus channels created in per-item components. Map §6.2.

### H8 — Fetches silently dropped or overwritten by stale responses — **MEDIUM, verified**
- `lib/hooks/useTags.ts:141` bails on `fetchingRef` after the effect already cleared `posts` for the new tag → new tag never loads, old tag's posts land later; no abort, no `mountedRef`.
- `lib/hooks/useOrders.ts:325-326,414-415` drop a filter change while a fetch is in flight → wrong list, no recovery.
- No `AbortController`/`mountedRef` on `MessagesView.fetchConversations`, `ChatView.fetchData`, `useBuyerOrders/useSellerOrders`, `useOrderDownloads`, `useSavedProducts`, `useSellerSetupStatus`, all `useInsights`, `CheckoutPage.useOrderData`; `useCommunityMembers`/`useCommunityPosts` create a controller but never attach it (`hooks.legacy.ts:589-593,725-729`); `useTags.ts:351-354`, `hooks.legacy.ts:1066-1070,1164-1167,2016-2019` likewise.

### H9 — `useAutoSave` interval restarts on every keystroke, so drafts of actively edited posts are never auto-saved — **MEDIUM, verified**
`lib/hooks/useDrafts.ts:291-299` re-creates the interval whenever `triggerSave` changes; it depends on `getDraftData`, which `components/create/CreatePost.tsx:825-877` recreates on every edit.

### H10 — Missing error / not-found boundaries: any thrown render error replaces the entire shell — **MEDIUM, verified**
`error.tsx` exists only at root and `(feed)`; `loading.tsx` only for `(feed)`, `explore`, `messages`, `studio/[username]`; **no `not-found.tsx` anywhere** (prod 404 returns the default Next page, 24 KB). `/community/*`, `/studio/*`, `/post/*`, `/take/*`, `/seller/*`, `/settings/*`, `/insights/*`, `/sell/*`, `/product/*`, `/commissions/*`, `/takes/*`, `/tag/*` fall through to `app/error.tsx`. `app/community/[slug]/settings/page.tsx:44` and `mod/page.tsx:32` call `router.push()` **during render** (React warns; can loop). Map §5.1.

### H11 — External calls without timeouts on the checkout path — **MEDIUM, verified**
`lib/turnstile-server.ts:77-82` (Cloudflare siteverify, bare `fetch`, no signal) awaited by `app/api/checkout/route.ts:39-46` before Stripe; a Cloudflare stall blocks checkout until the platform kills the function.

### H12 — Cross-region topology plus "every route is dynamic" puts ~1.5–3 s of pure latency in front of every page — **MEDIUM (slowness, not outage), verified**
Vercel functions run in **iad1**; Supabase is in **ap-southeast-1**; users are in the Gulf. Every navigation = proxy GoTrue round trip (iad1↔sin ≈ 230 ms, near expiry ×2) + dynamic RSC render + client 5-stage waterfall at 200–270 ms per stage (`§5.2`). Measured: TTFB 0.55 s warm / 2.0 s cold, data settles at 3.2–4.7 s. Static prose routes (`/help/*`, `/privacy`, `/terms`, guidelines, `/about`, `/login`) also pay the proxy + dynamic render because the root layout reads cookies (`lib/theme/server.ts:18`, `lib/feed-view/server.ts:12`). `app/(feed)/explore/page.tsx:1` and `app/about/page.tsx:1` `force-dynamic` are redundant. Map §1, §5.

---

## 2. Anything that breaks under load (10,000 users doing the same thing)

### L1 — The DM stack: unbounded conversation-list scans, read-receipt fan-out, 60 s polling and HEAD-count storms — **CRITICAL, verified**
One root cause: no server-side aggregate for "last message / unread per conversation", so clients scan and re-scan raw rows, and the per-user broadcast trigger cannot deliver deltas.
- `components/messages/MessagesView.tsx:134-145`: fetches **all `messages` rows of all the user's conversations** (to pick the latest in JS) and **all unread rows** (to count) — on mount, on every auth-object change (H7), and via the UPDATE handler (`:342-350`) 500 ms after **every read receipt**. PostgREST's 1000-row cap silently truncates → wrong "last message".
- Read-receipt chain: `ChatView.tsx:316-321,402-409` marks messages read one UPDATE at a time → trigger `notify_dm_unread_change` (`supabase/migrations/20260621_phase2_…triggers.sql:6-44`) sends to every participant except the **sender**, i.e. to the reader → `useNotifications.ts:617-620` treats any UPDATE as unknown and re-runs the full `fetchCount` (participants → HEAD messages → community RPC) → simultaneously the list refetch above and the reactions refetch (H7). Opening a conversation with N unread = N events × (3 + 7 + 1) requests.
- `useNotifications.ts:350,626-649`: badge chain runs every **60 s** and on every `focus`/`visibilitychange` **unthrottled** (`usePollOnFocus` exists but is not used here). 10k idle tabs ≈ 500 requests/s baseline for nothing.
- `components/notifications/NotificationPanel.tsx:1076-1079` calls `markAllAsRead` on every open → one UPDATE per unread row → one `notification_change` per row → `useNotifications.ts:277-299` refetches HEAD `notifications` per event with no in-flight guard (30 unread = 30 HEADs, each retry-wrapped).
This is why `conversation_participants` (232), HEAD `messages` (177), `get_community_chat_unread_count` (175) and HEAD `notifications` top the 24 h chart for a two-user site.
**Locations.** as above plus `lib/hooks/useNotifications.ts:456-560,582-621`, `components/providers/BadgeCountProvider.tsx:76`, `lib/hooks/useMessaging.ts:272-287` (2 pre-flight reads per reaction click). Map §4, §6.1, §7.

### L2 — A platform-wide, unfiltered `postgres_changes` stream and a 22-table publication — **HIGH, verified**
`lib/hooks/useCommunityChat.ts:958-1017` subscribes to **every** `community_chat_messages` INSERT with no filter and does a DB read per event per client; `community_chat_broadcast` fans out one row per member, so one announcement wakes every open inbox N times. This is the pattern the May 2026 fix removed from `useCommunityChatOverview` (comment at `:230-233`); it survived here. The `supabase_realtime` publication still lists 22 tables, so any open `postgres_changes` channel makes the poller decode WAL for all of them (10.46 M poller calls to date). Map §6.2.

### L3 — Per-row `blocks`/`follows` lookups before every analytics write (18 call sites; `/rest/v1/blocks` is the #2 endpoint) — **HIGH, verified**
`lib/hooks/useTracking.ts:258-297` (`isBlockedEitherWay`, 2 requests) and `:303-332` (`checkIsFollowing`) run inside `recordView` for every post visible ≥1 s (`:390-417`), every take watched 3 s (`:581-611`), every profile (`:739-750`), with a 2-minute cache. Ten posts by ten authors = 30 requests per page per user just to decide whether to log a view. RLS already hides blocked content, so the check is redundant for anything on screen; `is_follower` belongs in a trigger. Other per-request sites: `useProfile.ts:85-101`, `hooks.legacy.ts:2611-2614` (per search keystroke), `useNotifications.ts:397-398`, `useMessaging.ts:280`, `MessagesView.tsx:132-137`, `app/post/[id]/page.tsx:313-326`, `app/take/[id]/page.tsx:131-151`, `useInteractions.ts:616,638,644`. Map §6.3.

### L4 — "Fetch every row and count in JavaScript" instead of aggregates — **HIGH, verified**
Interaction-row scans whose size grows with popularity: `lib/hooks.legacy.ts:803-808` (`useCommunityPosts`: all admires/comments/relays/reactions for 20 posts — the sibling hooks use `(count)` embeds), `lib/hooks/useTakes.ts:427-443,879-882,1519-1541,1680-1690,1809-1819`, `lib/hooks/useComments.ts:106-117,172-208` (all likes and **all reply rows** for 30 comments), `lib/hooks.legacy.ts:2060-2064` (`useSearch` member counts), `lib/hooks/useTags.ts:366-376`, `lib/hooks/useInsights.ts:212-234,1443-1470,1656-1740` (raw `post_views`/`take_views` rows for the period). Map §7, §8.

### L5 — Unbounded result sets (no `limit`/`range`) on ~30 queries — **HIGH, verified**
`useProfile.ts:139-209` (**every published post** of the author with 11 embeds, then `in(all ids)` ×4), `useFeed.ts:438-500,614-648`, `useTakes.ts:956-960,1491-1508,1644-1663,1771-1790`, `useProfile.ts:591-604`, `useModQueue.ts:43-69,89-92`, `useShareToDM.ts:38-55`, `useExplore.ts:251-255`, `hooks.legacy.ts:1074-1091,1171-1184,2311-2316,2435-2440,2474-2478,2533-2545,2753-2764`, `useCommunityChat.ts:448-470,521-553,713-733,883-913`, `useSellerCustomers.ts:85-96`, `useProducts.ts:73-88,1150-1172`, `useOrders.ts:668-673,764-773,906-912`, `useInsights.ts:1643-1653`, `MessagesView.tsx:134-145`. Map §7.

### L6 — Auth and rate limiting are per-request network hops with a DB row lock that fails closed — **HIGH, verified**
- Proxy: `/auth/v1/user` on every matched request incl. RSC prefetches, webhooks, cron (`proxy.ts:37-47`, `middleware.ts:62`); API routes call GoTrue again (`lib/auth-server.ts:54-67`). At token expiry the browser tick and concurrent proxy requests refresh the same cookie in parallel; Supabase's `/token` rate limits then make the proxy treat users as anonymous (H5) and the browser enter its 30 s cooldown.
- `lib/api-security.ts:140-173` → `enforce_api_rate_limit` (`supabase/migrations/20260210_security_hardening.sql:20-113`): `SELECT … FOR UPDATE` + `UPDATE` per API call on `api_rate_limits`, **never pruned** (no migration, cron or route deletes rows); any RPC slowness returns `allowed:false` → **site-wide 429** while the DB is merely slow. Four endpoints share one `"user"` bucket with different limits (`checkout`, `checkout/confirm`, `account` DELETE, `posts/delete`).
Map §2.2–§2.4.

### L7 — Waterfalls, exact counts and duplicate mounts on hot pages — **MEDIUM, verified**
- Waterfalls: `useTags.ts:151-261` (6 stages, ≤9 requests), `useExplore.ts:347-537` (3 stages, ≤10; the third stage is embeddable as `useFeed` proves), `useProfile.ts:61-252` (4 stages), `useTakes.ts:1465-1541,1632-1690,2090-2124`, `hooks.legacy.ts:738-842` (10 requests per community page; pinned posts refetched every page), `useShareToDM.ts:146-189` (4–7 sequential requests **per recipient**), `ChatView.fetchData` (3 stages), `useCommunityChat` inbox (7 requests).
- `{count:"exact"}` per page: `useExplore.ts:390`, `useTags.ts:167-170`, `hooks.legacy.ts:155-156`, `useProfile.ts:195-207`, `useInteractions.ts:291-294`, `useMarketplace.ts:163`, `useOrders.ts:337,420`.
- Duplicate mounts: `useCommunity` in `CommunityLayoutClient.tsx:20` + `page.tsx:92` + every settings/about/members/mod page (16–24 queries per navigation); `useTrendingTags` ×3 on explore (`ExplorePageContent.tsx:54,102` + sidebar; per-instance dedupe makes `refetch` a no-op); `useCommunityMembers` ×3 on the members page; `useCommunityChatOverview` ×2 on `/messages/community`; `useSellerOnboarding` ×2 on the seller dashboard → 2 Stripe `accounts.retrieve` + 2 `seller_accounts` writes per visit (`usePayments.ts:27-63`, `stripe-provider.ts:156-173`); `useCommunityChatMemberSearch` scans all `profiles` before intersecting with members (`useCommunityChat.ts:382-403`).
- Feed focus refetch discards pagination (`useFeed.ts:372-393`); `useTakes` sub-hooks refetch fully when auth resolves (`useTakes.ts:1019,1607,1745,1966`); `StudioProfile` mounts `useUserTakes("")` which still queries `profiles` (`useTakes.ts:1459-1470`).

### L8 — Profile writes and refetches on every page load — **MEDIUM, verified**
`components/providers/FeedViewProvider.tsx:74-87` issues `profiles.update({feed_view_preference:'classic'})` on **every page load** for any user whose stored preference is not `classic` (a write per navigation); `ThemeProvider.tsx:112-122` writes when the preference is null; `app/settings/profile/page.tsx:183` and `app/settings/privacy/page.tsx:37,77` refetch `profiles` although `useAuth().profile` already holds it. Map §4.

### L9 — Non-atomic multi-step client writes — **MEDIUM, verified**
`useProducts.ts:267-281…` (`status:'active'` set on the first insert, then 6–10 more writes/uploads — a mid-way failure publishes a listing with no media/pricing), `useCommissions.ts:81-177`, `useProducts.ts:529-941` and `useCommissions.ts:214-523` (15–30 sequential writes; keywords deleted before new ones inserted), `hooks.legacy.ts:1283-1341,1440-1471,1510-1541` (community create/rules/delete: 12 steps), `ChatView.tsx:255-259` (delete conversation), `useComments.ts:429-436`, `useInteractions.ts:663-712` (block + follow cleanup), `app/api/payments/refund/route.ts:104-142,237-274`, `app/api/takes/delete/route.ts:71-112`, `lib/providers/stripe-provider.ts:86-123` (duplicate Connect accounts on double click). Slug-uniqueness loops: `useProducts.ts:253-264`, `useCommissions.ts:68-79`, `useCollections.ts:365-380,473-488`. Sequential per-row updates for reorder: `usePinnedPosts.ts:136-142,159-167,319-325`, `useCollections.ts:838-845,881-888`, `useFlair.ts:178-185`.

### L10 — Per-event DB reads inside realtime handlers and batch jobs shaped as single requests — **MEDIUM, verified**
`useCommunityChat.ts:791-797,810,969-994`, `useOrders.ts:273,720,803-812`, `useMessaging.ts:195-199`, `useNotifications.ts:175-198` (fan-out cost = events × clients). `app/api/orders/auto-complete/route.ts:47-106` performs ≤50 sequential Stripe transfers in one HTTP request (50/hour cap, timeout mid-loop); `app/api/orders/files/route.ts:96-103` signs 50 URLs sequentially; `StudioProfile.tsx:1116-1131` loops every conversation with one query each; `listings/delete` and `takes/delete` fire-and-forget storage removes (`:118-141`, `:120-128`).

### L11 — Database hygiene that is invisible at 30 MB and decisive at scale — **MEDIUM, verified via advisors and catalog**
Multiple permissive SELECT policies on 8 tables; bare `auth.uid()` on 3; per-row `EXISTS`/function calls in `posts_select_policy`, `community_chat_*`, `product_*`; 5 duplicate index pairs (`community_content_deletions` ×2, `orders`, `product_download_tokens`, `product_purchases`); 9 unindexed FKs; 120 unused indexes (write amplification); Micro compute (60 connections, 2 MB `work_mem`); 725 PostgREST schema reloads from ad-hoc DDL; `api_rate_limits` unbounded growth (L6). Map §6.4.

### L12 — Bundle and render cost paid on every route — **LOW, verified**
15 font families / 46 faces registered (11 families never referenced); 263 KB `globals.css` (62 keyframes, 184 `!important`) on every page; `ModalProvider` statically imports `PostDetailModal` + `TakeDetailModal` into the root chunk; `lib/hooks.ts` barrel (incl. 2,851-line legacy file and side-effectful modules) imported by 57 files; three `.aura-blob` divs with `blur(100px)` + infinite animation on every page; static prose pages are `"use client"`. Map §9.

---

## 3. Security

### S1 — SECURITY DEFINER functions executable by `anon`/`authenticated` with no `auth.uid()` check — **HIGH, verified live**
Root cause is the one recorded in June (C1): `CREATE FUNCTION` grants EXECUTE to PUBLIC by default; every new function inherits it unless revoked. 74 functions are flagged; the ones with concrete impact:
- `enforce_api_rate_limit(p_scope, p_identifier, p_limit, p_window_seconds)` — anyone can burn any bucket: call it with `auth.login.ip` + a victim's IP, or `user` + a victim's user id, and that victim gets 429 on login / checkout / account deletion. Denial of service on every rate-limited route.
- `create_order_notification(p_user_id, p_actor_id, p_type, p_order_id, p_content)` — forges notifications to any user with any actor, bypassing the `notifications_insert` RLS check.
- `get_community_chat_overview(p_user_id)`, `get_community_chat_unread_count(p_user_id)`, `get_user_conversation_ids(user_uuid)` — read another user's community-chat overview (thread previews) and DM conversation ids.
- `auto_complete_orders()`, `reveal_expired_reviews()`, `auto_complete_digital_order()`, `generate_order_download_tokens` (has a check), `ensure_digital_download_tokens_trigger()` — cron/trigger bodies callable on demand by anyone (`auto_decline_expired_orders` correctly checks `auth.role()`).
- `is_blocked_either_way(a,b)`, `is_following(a,b)` — enumerate who blocks/follows whom.
- 25 functions have a mutable `search_path` (advisor `function_search_path_mutable`).
**Fix shape.** One migration: `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on every SECURITY DEFINER function not meant for clients, add `auth.uid()` guards to the `p_user_id`-style ones, set `search_path`. Map §6.1.

### S2 — Stripe webhook pays the seller and marks the order `delivered` the moment a **physical** product is paid — **HIGH, verified**
`app/api/stripe/webhooks/route.ts:175`: `productData?.delivery_type === "digital" || order.listing_type === "product"` — the second clause is true for physical goods. Escrow, tracking (`add_order_tracking`), delivery confirmation and auto-complete are bypassed; a refund must reverse a transfer the seller may already have withdrawn, which `refundPayment` correctly refuses (`stripe-provider.ts:447-460`), leaving the buyer stuck.

### S3 — Refund requests bypass the guarded `request_refund` RPC — **HIGH, verified**
`app/api/payments/refund/route.ts:91-112` updates `orders.status='refund_requested'` directly with the service role for `in_progress/submitted/shipped` too and never checks `escrow_released`; `supabase/migrations/20260621_phase1_request_refund_escrow_guard.sql` exists to forbid exactly this and nothing calls it. Related: `useSellerCustomers` and dashboards disagree on "revenue" (C4).

### S4 — Password/email change revokes every session, forcing a logout on all devices within the hour — **HIGH, verified**
`app/api/auth/change-email/route.ts:118` and `change-password/route.ts:111` call `transient.auth.signOut()` with the default `scope:'global'` → GoTrue revokes all refresh tokens; the browser and the proxy both fail their next refresh → silent sign-out. Fix: `scope:'local'` or no sign-out on a non-persisted client.

### S5 — IP rate limiting trusts a client-spoofable header on Vercel — **HIGH, verified (host confirmed Vercel)**
`lib/api-security.ts:19-33` and `lib/turnstile-server.ts:20-34` prefer `cf-connecting-ip`, which Vercel does not set or strip; a client can send a fresh value per request and get a fresh bucket for `/api/auth/login` (unlimited password guessing against a known email), `signup`, `resend`, `change-*`, `track/profile-view`. Only `x-real-ip` / `x-forwarded-for` are trustworthy on Vercel.

### S6 — Account-security gaps in the auth routes — **MEDIUM, verified**
- `change-password/route.ts:80-83,99-112`: `currentPassword` optional; nothing verifies the session came from a recovery link → any XSS = password takeover.
- `change-email/route.ts:123-126`: `email_confirm:true` immediately, no confirmation of the new address (acknowledged "pre-launch" in the file).
- Session cookies are JS-readable (`logout/route.ts:45-51` `httpOnly:false`, inherent to the browser client) while CSP allows `'unsafe-inline' 'unsafe-eval'` (`next.config.ts:18`).
- `enforceSameOrigin` accepts requests with neither `Origin` nor `Referer` (`lib/api-security.ts:93-97`); `/api/auth/logout` has no auth and no CSRF token.
- `signup/route.ts:168-186` resends confirmation for an existing unconfirmed email under the per-IP limit only (email-bombing, combined with S5).
- Supabase leaked-password protection is off (advisor).

### S7 — Auth/role gating that exists only on the client — **MEDIUM, verified live (anonymous GET returns 200)**
Not in `PROTECTED_PREFIXES`: `/checkout/*`, `/checkout/*/complete`, `/community/create`, `/takes/create`, `/sell`, `/sell/service`, `/sell/edit/[id]`, `/community/[slug]/settings/*`, `/community/[slug]/mod` (role check runs in the client after `useCommunity`, then `router.push` during render). Data is RLS-protected, so this is a UX/consistency hole rather than a leak, but the pages render, fetch and flash before redirecting, and `/login` does not redirect already-signed-in users. `lib/auth/protected-paths.ts:7-8` protects both `/queue` and `/cart`. Map §2.1.

### S8 — Anonymous-writable analytics tables and client-attributed viewer ids — **MEDIUM, verified**
`take_views`, `take_impressions`, `community_views`, `profile_views` have `WITH CHECK (true)` INSERT policies: unauthenticated clients can insert unlimited rows with any `viewer_id`; `app/api/track/profile-view/route.ts:80-111` trusts client `session_id`, `is_follower`, `source`. Analytics (and any future ranking built on them) are trivially inflatable. Map §6.4.

### S9 — Client-authored records that rely entirely on RLS being exactly right — **MEDIUM, verified client side; DB side partially verified**
- `createNotification` (`useNotifications.ts:26-34`, 14 call sites): `actor_id` is enforced by RLS, but `user_id`, `type`, `content`, `post_id` are not — any user can push arbitrary notification text to any user. `useTakes.ts:769-776` stores a take id in `post_id`.
- Community role/status/permission changes and join/leave are direct client writes (`hooks.legacy.ts:943-950,987-991,1574-1578,1610-1615,1730-1734`) guarded by a bypassable client `verifyPermission`; the June RLS fix is the only real guard.
- Follow inserts that skip the private-account request flow: `useTakes.ts:1286`, `useProfile.ts:357-360` (`status` defaults to `accepted`).
- `useUpdateSellerProfile` writes `setup_completed`, `require_approval`, `auto_decline_hours` (`useSellerProfile.ts:114-118,139-145`); `useSendOrderMessage` stores client-supplied attachment URLs (`useOrders.ts:858-866`); sellers write `product_pricing` directly; `useOrderReviews` fetches the counterpart's unrevealed review and hides it in JS (`useReviews.ts:96-121`); `useProduct` returns `product_files(*)` paths to any viewer (`useProducts.ts:176-189`).
- `reports.reported_post_id = takeId` for take reports (`useTakes.ts:818-824,1155-1161`) — suspected FK mismatch.

### S10 — Platform-fee base differs across creation, promo and payout — **MEDIUM, verified**
`create_marketplace_order` computes `platform_fee = item × 0.05` (shipping excluded); `apply_promo_to_order` and `StripeProvider.transferToSeller` use the full amount including shipping. For any shipped order the stored `seller_amount` and the actual transfer differ by 5 % of shipping; dashboards (`SellerDashboard.tsx:89`, `SellerOrdersTable.tsx:99`, `CheckoutPage.tsx:1319`) show the stored figure. Locations: `supabase/migrations/20260511_create_marketplace_order_pwyw.sql:122-125`, `20260621_phase1_apply_promo_recompute_seller_amount.sql:54-56`, `lib/providers/stripe-provider.ts:372-374`.

### S11 — DM attachments live in public buckets; six buckets have no size limit — **MEDIUM, verified live**
`message-media` and `voice-notes` are `public: true` (anyone with the URL can fetch a private voice note or image; URLs are guessable only by path, but they are persisted in `messages` and visible to any participant forever). `avatars`, `covers`, `post-media`, `post-audio`, `message-media`, `voice-notes` have no `file_size_limit`. Map §6.5.

### S12 — Lower-severity items — **LOW, verified**
Turnstile returns 503 for all checkouts on a `NODE_ENV=production` preview without the secret (`lib/turnstile-server.ts:46-52`); Stripe Connect onboarding can create duplicate Express accounts (`stripe-provider.ts:86-123`); `x-forwarded-host` trusted for the same-origin check (`api-security.ts:49-52`). Webhook signature check, cron `timingSafeEqual`, and service-role key handling are correct.

---

## 4. Broken or half-finished

### B1 — Anonymous view tracking never succeeds: `ON CONFLICT` targets a partial unique index — **HIGH, verified (24 errors / 24 h; zero anonymous `post_views` rows ever)**
`lib/hooks/useTracking.ts:413,607,814` and `app/api/track/profile-view/route.ts:106-108` use `onConflict: "post_id,session_id,view_date"` (etc.). The only matching indexes are partial (`… WHERE session_id IS NOT NULL AND viewer_id IS NULL`), which Postgres cannot infer without the predicate, so every anonymous upsert fails with `42P10`. One wasted request per viewed item per logged-out visitor, and no anonymous analytics. Fix is DB-side (non-partial unique index or an RPC).

### B2 — `take_views` inserts are rejected 100 % of the time; `community_views` for non-managers — **HIGH, verified (`take_views` has 0 rows ever)**
`take_views` has INSERT `WITH CHECK (true)` but **no SELECT policy**; PostgREST upserts run `INSERT … RETURNING`, which RLS rejects without a SELECT policy (`useTracking.ts:594-610`). `community_views` SELECT is manager-only (`:806-817`). Every subsequent `take_views.update` matches zero rows. Take insights are therefore empty by construction.

### B3 — Optimistic `temp-…` ids leak into PostgREST and realtime filters — **MEDIUM, verified (prod log ×2)**
`components/messages/ChatView.tsx:162,451,518,585` feeds optimistic ids into `useMessaging.ts:86` (`.in("message_id", …)` → `22P02`) and `:160-182` (realtime filter → subscription error). `useMessaging.ts:326` also uses `temp-${Date.now()}` (project rule is `crypto.randomUUID()`).

### B4 — Social previews point at a dead domain — **MEDIUM, verified live**
Production HTML emits `og:image` = `https://pinkquill.co/og-image.png`; `pinkquill.co` does not resolve. `app/layout.tsx:175` falls back to it because `NEXT_PUBLIC_BASE_URL` is not set in the Vercel environment. Every share on X/Slack/WhatsApp shows no image.

### B5 — Password recovery breaks across browsers and lands its error on a protected page — **MEDIUM, verified structurally**
The PKCE verifier lives in the requesting browser's cookies (`useAuthFlow.ts:165-174`); opening the link elsewhere makes `app/auth/callback/route.ts:60-70` fail → redirect to `/settings/account?error=…` → proxy redirects to `/login` and the message is never shown. Same for the `!code` branch (`:24-28`).

### B6 — Typing indicator never fires — **MEDIUM, verified**
`useTypingIndicator.setTyping` returns early without `currentUserProfile` (`useMessaging.ts:545`); `MessagesView.tsx:452-459` never passes it. The `typing-*` channel and a 1 s interval still run per conversation.

### B7 — Pagination and sort correctness — **MEDIUM, verified**
`useExplore.ts:404-421,667-692`: fetches 30, keeps 20, next page starts at 20 → overlaps/duplicates and duplicate React keys; `useTags.ts:175-179`: `.range()` without `.order()`; `hasMore` counts `post_tags` rows but posts are filtered afterwards; `hooks.legacy.ts:861-891`: `top`/`hot` sorted within the page, pinned posts only shown if in page 0; `useFeed.ts:166,309`: `pagination.total` is never populated.

### B8 — Smaller correctness defects — **LOW, verified**
Heart writes to both `admires` and `reactions` (`PostCard.tsx:121-124`) so one user can be counted twice; `lib/types/index.ts:853-870` papers over it. `useReactionCounts`/`useUserReaction` keep the previous post's values when `postId` becomes `""` (`useInteractions.ts:264-272,483`). `useTrackPostImpression` records anonymous when auth resolves late (`useTracking.ts:349-351`). Refund-declined notification uses `type:"order_paid"` (`refund/route.ts:247-253`). `useSellerCustomers` counts gross amount incl. refunded/disputed (`useSellerCustomers.ts:156-160`). `/login` does not redirect signed-in users. `useDiscoverCommunities` ignores `category`. Sentry disabled → none of the above is observable in production.

---

## 5. Contradictions — two parts of the app doing the same thing differently

### C1 — The realtime rule vs. reality — **MEDIUM, verified**
Project rule (memory, `usePollOnFocus.ts:6-9`): one broadcast channel per user, poll-on-focus elsewhere. Reality: 16 `postgres_changes` sites on 13 channels (§6.2); `usePollOnFocus` has 3 callers while `useFeed.ts:372-393` and `useNotifications.ts:626-649` hand-roll focus polling with different throttles (30 s / none); `useCommunityChatUnreadCount` and `useUnreadMessagesCount` call the same RPC; `useCommunityChatOverview` is mounted twice on one route.

### C2 — Seven ways to build a `Post`, three ways to count a reaction, four ways to check a block — **MEDIUM, verified**
Post enrichment ×7 (`useFeed.ts:223-286,513-526,696-728`, `useExplore.ts:541-572`, `useTags.ts:276-298`, `useProfile.ts:255-274`, `hooks.legacy.ts:854-865`) with drifting field sets (tag pages lose community/flair/styling; relays hard-code user flags false; community posts lose hashtags/mentions). User-flag batch ×5. Counts: `(count)` embeds vs RPC+head vs fetch-all-rows. Block check ×4 implementations + 3 inline copies. Follow toggle ×4 with different semantics (`useProfile` pending+notification, `useTakesFollowing` always accepted, `checkIsFollowing` ignores `status`). Any new post field must be added in seven places — the "type is form" work committed today will hit this immediately.

### C3 — Detail page vs. modal implemented twice; auth gate implemented eight times — **MEDIUM, verified**
`app/post/[id]/page.tsx` (1,349 lines) vs `components/feed/PostDetailModal.tsx` (1,275): 12 identically named handlers; `app/take/[id]/page.tsx` (924) vs `TakeDetailModal.tsx` (731): 9 handlers plus `useTakes.ts:597-787` and `useTakeReactionCounts`. `RequireAuth` vs 7 hand-rolled gates (§5.3). `useCommunity` called independently in 12 files.

### C4 — Money and status vocab in several places — **MEDIUM, verified**
Fee constants ×3 (`lib/payments.ts:21,24`, `lib/types/store.ts:646-657`, SQL literals) with the base mismatch in S10; client still sends `amount/platform_fee/seller_amount` with three different values (`CommissionDetailView.tsx:150-155`, `StudioQueuePage.tsx:295-321`, `lib/types/store.ts:446-455`) that the server ignores; `VALID_TRANSITIONS` (`useOrders.ts:477-487`) duplicates the RPC state machine; `STATUS_CONFIG` ×4 with different colours; `MetricCard` ×5; price formatting ×5; time formatting ×9 local copies despite `lib/utils/time.ts`; find-or-create-DM ×4 (none atomic); "revenue" defined three ways.

### C5 — Small duplications and stale statements — **LOW, verified**
Rate-limit `"user"` bucket shared by 4 endpoints; `getClientIp`, `normalizeUsername`, transient auth client, `verifyCronSecret`, `writeCookie`, idle-defer helper, `generateSlug`, `clampMin` each ×2; `/queue` and `/cart` both live; two Stripe routes lack `runtime` export; stale comments (`useFeed.ts:44` "realtime channel names" with no channels; `AuthProvider.tsx:294` "no network call"; `lib/auth-client.ts:104-108`; `lib/hooks.ts:7-19` migration notes); `docs/ARCHITECTURE.md` claims Sentry, error boundaries and "all foreign keys indexed".

---

## 6. Dead code, redundancy, unused dependencies

### D1 — Exported hooks with zero callers — **LOW, verified by grep**
`hooks.legacy.ts`: `useCollaborators` (opens a channel), `useMentions`, `useMentionedPosts`, `useCommunityInvitations`, `saveCollaboratorsAndMentions`; `useTags.ts`: `usePopularTags`; `useTakes.ts`: `useFavoriteSounds`, `useCreateSound`; `useCollections.ts`: `useCollection`, `useUpdateCollectionItem`, `useDeleteCollection`, `useDeleteCollectionItem`, `useReorderCollectionItems`; `useFlair.ts`: `usePostFlair`; `useTracking.ts`: `getSourceFromUrl`; `useInteractions.ts`: `checkIsBlockedEitherWay`; `useCommunityChat.ts`: `useCommunityChatUnreadCount`; `useOrders.ts`: `useOrderEvents`; `useProducts.ts`: `useUpdateProduct`; `useReviews.ts`: `useSellerReviews`; `useDownloads.ts`: `useGenerateDownloads`; `useDisputes.ts`: `useResolveDispute`; `useAuthFlow.ts` `recovery` OTP branch; `lib/utils/retry.ts:135-212` `categorizeError` (one caller); `lib/posts-client.ts` shim.

### D2 — Fallback branches for a schema that no longer exists — **LOW, verified**
`useInteractions.ts:118,133,148,200,224,303,313,507`, `useTakes.ts:367-374,656-681,828-834,884-902,1164-1171`, `useProfile.ts:319-328,355-370,606-616,650-661`, `hooks.legacy.ts:2320,2755` (`42P01`/`42883` handling); some swallow real RLS errors.

### D3 — Dead config, deps, assets, DB objects — **LOW, verified**
`lib/stripe.ts:21-40` deprecated exports; `lib/payments.ts:24-27`; `CreateOrderData` legacy fields; `NEXT_PUBLIC_SENTRY_DSN`; `@fortawesome/fontawesome-svg-core` (0 imports); `react-intersection-observer` for one call site; 11 unused font families / 34 faces; dead barrels `components/store/index.ts`, `components/store/ProductDetail/index.ts`, `components/takes/index.ts`; `app/(feed)/queue` redirect route; 120 unused + 5 duplicate indexes; `useDiscoverCommunities.category`, `useRelayedTakes.viewerId`, `_userId`-style params; `lib/utils/image.ts:31-41` ignores its `size` argument at 29 call sites; `docs/ARCHITECTURE.md` describes a system that does not match this map.

---

## Root-cause index (what a fix actually has to change)

| Root cause | Findings | Fix surface |
|---|---|---|
| Supabase work inside the auth callback + unbounded auth lock | H1, H2 | `AuthProvider.tsx`, `lib/supabase.ts` |
| "Unknown" represented as "anonymous/empty" | H3, H4 | `AuthProvider`, `RequireAuth`, 17 hooks |
| Timers instead of cancellation; retry wrapper that retries the wrong thing | H5, H6, H11 | `middleware.ts`, `retry.ts`, `turnstile-server.ts` |
| Effects/channels keyed on unstable references; per-item channels | H7, L2, C1 | `useMessaging`, `MessagesView`, `ChatView`, `useInteractions`, `useCommunityChat`, publication |
| No server-side aggregates; client scans rows | L1, L4, L5, L7, B7 | RPCs/views + hooks |
| Client-side relationship checks before writes | L3, S8, B1, B2 | `useTracking`, DB indexes/policies/trigger |
| Default PUBLIC EXECUTE on functions | S1 | one migration |
| Money paths not routed through the guarded RPCs | S2, S3, S10, C4 | webhook, refund route, fee base |
| Proxy-level vs client-level gating drift | S7, H3 | `protected-paths.ts` |
| Duplicated logic | C2–C5, D1–D3 | consolidation |
