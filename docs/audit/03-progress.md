# Pinkquill — Audit Progress

Audit produced 2026-09-02 (`00-system-map.md`, `01-findings.md`, `02-plan.md`). Work happens on stacked branches: `fix/phase1-site-loads` (from `main` at `0c9625b`) → `fix/phase2-realtime`.

## Status by phase
| Phase | Status | Commit(s) | Notes |
|---|---|---|---|
| 1 — Site does not load | **done, needs prod verification** | see `git log fix/phase1-site-loads` | All 7 steps applied; typecheck/lint/tests/build green; local smoke on logged-in + multi-tab OK |
| 2 — Realtime / DM storm | **done, needs prod verification** | see `git log fix/phase2-realtime` | Migration applied to prod; typecheck/lint/tests/build green; local smoke on /messages OK |
| 3 — Security + money | not started | – | |
| 4 — Tracking layer | not started | – | |
| 5 — Read path + latency | not started | – | |
| 6 — Hang-adjacent + half-finished | not started | – | |
| 7 — Consolidation | not started | – | |
| 8 — Dead code + bundle | not started | – | |

## Phase 1 — what changed (2026-09-02)

Root causes addressed: H1, H2, H3, H4, H5, H6 from `01-findings.md`.

| Step | Change | Files |
|---|---|---|
| 1 | `onAuthStateChange` callback is now synchronous and makes no Supabase calls; it only applies the session to React state. Profile fetch/create moved to an effect keyed on `user.id` (`profileNonce` re-triggers it on tab return / retry). `supabase.auth.signOut()` removed from `createProfile`. `user` object is no longer replaced on same-id `SIGNED_IN`/`TOKEN_REFRESHED` (only `USER_UPDATED`), which also removes the `[user]`-keyed refetch/re-subscribe churn in `MessagesView` at the source. | `components/providers/AuthProvider.tsx` (rewritten) |
| 2 | Custom `auth.lock` (`boundedAuthLock`) wraps the Web Locks request with an 8 s acquire timeout; on timeout it runs the operation un-locked and reports `auth_lock_timeout`. `acquireTimeout === 0` (background refresh tick) semantics preserved. `TIMEOUT_AUTH` left at 10 s. | `lib/supabase.ts` |
| 3 | New `status: "loading" \| "authenticated" \| "anonymous" \| "unknown"` + `isAnonymous` + `retryAuth()` on the auth context. The 12 s init timeout now yields `unknown` (never `anonymous`). Route guards redirect to `/login` only on `isAnonymous`; on `unknown` they render `AuthUnavailable` (retry / sign-in panel). | `components/auth/AuthUnavailable.tsx` (new), `components/auth/RequireAuth.tsx`, `app/settings/layout.tsx`, `app/insights/layout.tsx`, `app/seller/layout.tsx`, `components/checkout/CheckoutPage.tsx`, `components/takes/CreateTake.tsx`, `components/seller/EditListingPage.tsx` |
| 4 | Middleware uses a real `AbortController` threaded into the auth client's `fetch`, clears its timer, and on timeout returns the untouched response (no half-applied cookies). Proxy matcher now skips `/api/stripe/webhooks`, `/api/orders/auto-*`, `/api/diagnostics/*`, `/auth/callback`. | `lib/supabase/middleware.ts`, `proxy.ts` |
| 5 | `isRetryableError` returns false for `AbortError` (client timeouts/cancels are never retried — this alone removes the 3×25 s stalls; the `retryWithBackoff` wrappers were left in place because they now only retry real network errors). `Feed` auto-retry reduced to one attempt. `useTakes` 10 s timeout now aborts the request and sets an error (feed shows retry UI) instead of silently showing an empty feed. | `lib/utils/retry.ts`, `components/feed/Feed.tsx`, `lib/hooks/useTakes.ts` |
| 6 | `setLoading(false)` on every early-return path: `useTakeReactionCounts`, `useTakeComments`, `useFollowList`, `useModQueue`, `useCommunity`, `useCommunityMembers`, `useCommunityPosts`, `useJoinRequests`, all six `useInsights*` hooks; `useOrderDispute` wrapped in try/catch/finally. | `lib/hooks/useTakes.ts`, `useProfile.ts`, `useModQueue.ts`, `hooks.legacy.ts`, `useInsights.ts`, `useDisputes.ts` |
| 7 | Diagnostics: client posts `auth_init_slow` (>8 s), `auth_init_timeout`, `auth_init_error`, `auth_lock_timeout` with the Web Locks snapshot to `POST /api/diagnostics/auth`, which logs `[auth-diagnostic] {...}` to the server console. **Read with:** `vercel logs <deployment-url> \| grep auth-diagnostic`. `@sentry/nextjs` 10.73 now supports Next 16 — re-enabling it is recommended in Phase 6 (needs the DSN in Vercel env and the `instrumentation-client.ts` layout). | `lib/diagnostics/authDiagnostics.ts`, `app/api/diagnostics/auth/route.ts` |
| – | Stale test updated: `useFeed` no longer opens a realtime channel (since May 2026), the test now asserts that. | `lib/hooks/__tests__/useFeed.test.ts` |

Verification done locally (dev server, prod Supabase, signed-in session): `/` renders 10 posts with profile in sidebar; second tab on `/messages` passes the guard; navigation between tabs and to `/community` leaves `navigator.locks.query()` empty in both tabs; anonymous `curl /messages` → 307 to `/login`; `POST /api/diagnostics/auth` → 204 (valid) / 400 (invalid kind); `npm run typecheck`, `lint` (0 errors), `test:run` (136/136), `build` all green.

Not verified (needs production or a throttled network): the deadlock itself was never reproduced, so watch the `[auth-diagnostic]` log after deploy — if `auth_lock_timeout` or `auth_init_timeout` appears with a `held` lock from another `clientId`, H1 is confirmed as the live cause and the bounded lock is what is keeping the site up.

Pre-existing, out of scope, noticed during smoke: `[useDiscoverCommunities] Error: Object` logged once on first load of `/` (present on `main` too; belongs to Phase 6 error-handling).

## Phase 2 — what changed (2026-09-02)

Root causes addressed: H7, L1, L2, C1 (and B3, B6 as side effects) from `01-findings.md`.

| Step | Change | Files |
|---|---|---|
| DB | Migration `20260902_phase2_realtime_dm_aggregates.sql` — **applied to prod via MCP.** (a) `notify_dm_unread_change`: emits only on INSERT/DELETE and on read-state flips, carries `was_read` + preview fields, addresses all participants (clients ignore what does not apply). (b) `notify_notification_change`: skips no-op UPDATEs, carries `was_read`. (c) New `get_dm_conversation_overview()` (list: other participant, last message, unread, block-aware, `auth.uid()`-scoped) and `get_dm_unread_summary()` (badge: count + conversation ids + blocked ids), both `authenticated` only. (d) `supabase_realtime` publication shrunk from 22 tables to 5: `messages`, `community_chat_threads`, `community_chat_messages`, `orders`, `order_messages`. | `supabase/migrations/20260902_phase2_realtime_dm_aggregates.sql` |
| MessagesView | One RPC call instead of 7 queries (2 of them unbounded `messages` scans); no `postgres_changes` channel; `dm_unread_change` events applied as deltas (INSERT updates preview/unread, read flips ±1, DELETE/unknown → debounced refetch); `usePollOnFocus` 30 s backstop; effects keyed on `user.id`; passes `currentUserProfile` to ChatView (typing indicator now works — B6). | `components/messages/MessagesView.tsx` |
| useMessaging | Rewritten: one **broadcast** channel `dm-live-<conversationId>` per open chat carries typing + reaction events; the per-message `message_reactions` `postgres_changes` channel (primary churn source) is gone. Reactions fetched incrementally for new ids only; single `upsert` instead of read-then-insert/update + 2 pre-flight reads; optimistic ids use `crypto.randomUUID()`. | `lib/hooks/useMessaging.ts` |
| ChatView | `messageIds` excludes `temp-` ids (B3: no more `invalid input syntax for type uuid`); chat channel no longer re-created when block flags resolve (refs). Still uses a scoped `postgres_changes` on `messages` for the open conversation (planned deferred item). | `components/messages/ChatView.tsx` |
| Badges | `useUnreadMessagesCount`: DM half = `get_dm_unread_summary` RPC, community half = existing RPC, both in parallel; `dm_unread_change` applied as ±1 deltas (no refetch on read receipts); **60 s interval and unthrottled focus listeners removed**, replaced by `usePollOnFocus(30 s)`. `useUnreadCount`: read flips/deletes applied as ±1 from `was_read`; refetch only when prior state is unknown, debounced + in-flight guard (panel open with N unread → 0 HEAD requests instead of N). | `lib/hooks/useNotifications.ts` |
| Announcements | Platform-wide unfiltered `community_chat_messages` INSERT stream removed; list refreshes on focus (members already get broadcast rows via their thread channel). | `lib/hooks/useCommunityChat.ts` |
| Reactions | `useReactionCounts`/`useUserReaction` default to `disableRealtime: true` (post modal / post page opened 2 channels per post). Opt-in still exists but `reactions` is no longer in the publication. | `lib/hooks/useInteractions.ts` |
| Collab invites | `collab-invites-*` channel (re-created on every notification-panel open) replaced by `useUserEvent("notification_change")` filtered on `collaboration_invite`. | `lib/hooks.legacy.ts` |
| Types | `DmUnreadChangePayload` / `NotificationChangePayload` gained `was_read` and preview fields. | `components/providers/UserEventsProvider.tsx` |

Remaining `postgres_changes` subscriptions (all scoped, in-view only, as the plan deferred): ChatView `messages` per open conversation; `useCommunityChatThreads` (staff) + `useCommunityChatMessages` per thread; `useOrders` per order / per seller. Dead `useCollaborators` in `hooks.legacy.ts` still references a channel on `post_collaborators` (table no longer published) — delete in Phase 8.

Verification: typecheck, lint (0 errors), 136/136 tests, production build green. Local `/messages` (signed in, prod DB): list renders from `get_dm_conversation_overview`; badge from 2 RPCs; opening a conversation issues one `message_reactions` query; no console errors; none of `blocks`, `conversation_participants`, HEAD `messages` appear in the network log. Publication verified as 5 tables; RPC grants verified `authenticated`+`service_role` only.

Not verified (needs two users): live delta path end-to-end (peer sends → list preview/unread update without a request; read receipt → badge −1; reaction/typing over the broadcast channel). Watch the Supabase realtime inspector after deploy: one `user-events:` + at most one `dm-live:` + one `chat-` channel per open conversation.

Deploy note: the migration is already live. Until this branch deploys, the **currently deployed** client keeps subscribing to a few tables that are no longer published (`conversation_participants`, `message_reactions`, `reactions`, `post_collaborators`) — those channels simply go quiet; nothing errors. Deploy Phases 1+2 together.

## Next
Deploy `fix/phase2-realtime` (contains Phase 1; merge to `main` triggers Vercel), watch `vercel logs` for `[auth-diagnostic]` and the realtime inspector for a day, then start Phase 3 (`02-plan.md`).

## How to resume in a fresh session
1. Read `02-plan.md` for the phase being worked on and `01-findings.md` for the IDs it cites; `00-system-map.md` only as needed.
2. Check this file for the last completed step and its commit.
3. Live-state facts that were true at audit time and should be re-checked before relying on them: Vercel region `iad1`; `NEXT_PUBLIC_BASE_URL` unset in prod; Supabase Micro compute; `supabase_realtime` publication has 22 tables; 74 SECURITY DEFINER functions executable by `anon`.
