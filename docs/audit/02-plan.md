# Pinkquill — Phased Fix Plan (2026-09-02)

Rules applied: Phase 1 is only "the site doesn't load". Each phase fixes one root cause everywhere it appears, is sized for one session, and ends with the app running and committed. Phases are ordered by risk to users, not by effort. Finding IDs refer to `01-findings.md`; map sections to `00-system-map.md`.

Every phase ends with: `npm run typecheck && npm run lint && npm run test:run`, a manual smoke of the affected pages on prod-like data, one commit per phase (or per safe sub-step), and an entry in `03-progress.md`.

Global guard-rails while fixing:
- No new `postgres_changes` subscriptions; no new `SECURITY DEFINER` function without an explicit `REVOKE … FROM PUBLIC, anon, authenticated`.
- DB changes go in `supabase/migrations/2026MMDD_<phase>_<slug>.sql` and are applied with `apply_migration`, one file per concern, idempotent.
- Do not touch design/brand rules (no accent borders; show-before-ship for UI changes).

---

## Phase 1 — The site does not load (H1, H2, H3, H4, H5, H6)

**Goal.** A logged-in user on a slow or flaky connection, with several Pinkquill tabs open, always reaches a rendered page within a bounded time, and a signed-in user is never bounced to `/login` by a timeout. Nothing else.

**Root causes fixed.** (1) Supabase work awaited inside `onAuthStateChange` and an auth lock with no acquire timeout; (2) "unknown" auth state represented as "anonymous"/"empty"; (3) timers that do not cancel and a retry wrapper that retries timeouts; (4) `loading` flags that never flip.

**Steps (each independently committable; the app runs after every step).**
1. **Break the deadlock** — `components/providers/AuthProvider.tsx`: the `SIGNED_IN` handler only records `session` in state/refs and returns synchronously; profile fetch/create moves to an effect keyed on `user?.id` (or is dispatched with `setTimeout(…, 0)`). Remove `supabase.auth.signOut()` from `createProfile` (surface an error state instead). Keep `TOKEN_REFRESHED`/`USER_UPDATED` from replacing the `user` object when the id is unchanged (compare by id) — this also removes the H7 `[user]`-keyed churn at the source.
2. **Bound the auth lock** — `lib/supabase.ts`: pass `auth: { lock }` to `createBrowserClient` wrapping `navigatorLock` with an acquire timeout (e.g. 8 s) that falls back to running the callback un-locked (or rejects with `LockAcquireTimeoutError`, caught by `customFetch`) so no query can wait forever on another tab. Reconcile `TIMEOUT_AUTH` with auth-js's 30 s retry window (either one attempt by raising it, or accept the bounded lock as the guard).
3. **Unknown ≠ anonymous** — `AuthProvider`: on the 12 s timer expose `status: 'unknown'` (or keep `user` unresolved) instead of `user=null`; `components/auth/RequireAuth.tsx` and the 7 hand-rolled gates (`app/settings|insights|seller/layout.tsx`, `CheckoutPage`, `CreateTake`, `EditListingPage`, `/saved`) redirect only on a *resolved* signed-out state and otherwise show a retry UI. Optional but recommended: pass the proxy's already-validated user into the root layout (cookie decode, no network) as `initialUser` so the client never starts from "unknown".
4. **Real cancellation in the proxy** — `lib/supabase/middleware.ts`: custom `global.fetch` with `AbortSignal.timeout(5000)`, `clearTimeout` on completion, and on timeout return the *original* response without touching cookies. Skip `updateSession` for `/api/stripe/webhooks`, `/api/orders/auto-*`, `/auth/callback` and pure-static prose paths via the matcher.
5. **Retry wrapper** — `lib/utils/retry.ts`: do not retry `AbortError`/timeouts (or cap total budget at ~10 s); remove `retryWithBackoff` from the `useUnreadMessagesCount` waterfall and `useNotifications` HEAD counts. `components/feed/Feed.tsx` auto-retry: cancel the in-flight request before refreshing (use `useFeed`'s abort) and stop at one retry; `useTakes.ts:584-594` forced flag → error state.
6. **Loading flags** — add `setLoading(false)` (and the `finally`) on every early-return path listed in H4 (17 hooks) and wrap `useOrderDispute` in `try/catch/finally`.
7. **Instrumentation to confirm H1 in prod** — re-enable Sentry if `@sentry/nextjs` supports Next 16.1 today (check before assuming); otherwise a 40-line client reporter that posts `navigator.locks.query()` + auth-init timing to a tiny API route when auth init exceeds 8 s. Without this the team cannot tell whether the deadlock is the live cause.

**Not in this phase.** Realtime churn, DM scans, security, region. (Step 1 incidentally removes the `[user]` object churn; that is a side effect, not scope creep.)

**Verification.** (a) Two tabs open, throttle network to "Slow 3G" in one, switch focus back and forth for 2 minutes, reload both — both render. (b) Sign in, block `*/auth/v1/user` in DevTools, reload — page renders as signed-in (from cookie), no bounce to `/login`. (c) Open a post modal / community page with auth still resolving — no permanent skeleton. (d) `git grep -n "await .*supabase" components/providers/AuthProvider.tsx` shows nothing inside the `onAuthStateChange` callback. (e) Playwright smoke on `/`, `/explore`, `/messages`, `/community/<slug>`, `/studio/<user>`.

**Rollback.** Each step is a separate commit; step 2 (custom lock) is the only behavioural change to vendor semantics and can be reverted alone.

---

## Phase 2 — Realtime churn and the DM/badge request storm (H7, L1, L2, C1)

**Goal.** Per-user realtime cost is one channel; a chat session does O(1) requests per message, not O(N).

**Root cause fixed.** Channels/effects keyed on unstable references, per-item channels, and no server-side aggregates for the conversation list and unread counts.

**Steps.**
1. DB: `notify_dm_unread_change` includes `old.is_read`/`new.is_read` and never addresses the row's own updater; a `get_conversation_overview(p_user_id)` RPC (SECURITY DEFINER, `auth.uid()` check) returns last message + unread count per conversation; `mark_conversation_read(conversation_id)` does one UPDATE and one event; `mark_all_notifications_read()` likewise.
2. `MessagesView`: use the RPC, key effects on `user.id`, apply `dm_unread_change` deltas instead of refetching; drop the list channel's UPDATE handler.
3. `ChatView` + `useMessaging`: remove the per-message reactions channel (fold reactions into the existing per-conversation channel or poll-on-focus); stable `messageIds` key without `temp-` ids (fixes B3); pass `currentUserProfile` (fixes B6) or delete the typing feature.
4. `useUnreadMessagesCount` → `usePollOnFocus` (10 s throttle) for the community part only, in-flight guard, no 60 s interval; `useUnreadCount` debounced with a guard; `NotificationPanel` uses the single-UPDATE RPC.
5. `useCommunityAnnouncements`: replace the unfiltered stream with poll-on-focus or a filtered per-community trigger event; `useInteractions` reaction channels → one per opened post with `disableRealtime` default true; `collab-invites` → `useUserEvent`.
6. Shrink `supabase_realtime` publication to the tables that still have a live subscriber after steps 2–5.

**Verification.** Realtime inspector shows one `user-events:` channel per tab on `/` and ≤2 on a chat page; `select count(*) from realtime.subscription` stays flat while chatting; 24 h edge log for `conversation_participants`/HEAD `messages` drops by >80 %.

---

## Phase 3 — Security and money correctness (S1–S5, S10, S7, S11)

**Goal.** Nothing callable by `anon` that should not be; sellers are not paid before shipping; refunds respect escrow; rate limits cannot be spoofed or weaponised.

**Root causes fixed.** Default PUBLIC EXECUTE on functions; money paths that bypass the guarded RPCs; client-spoofable IP; global sign-out.

**Steps (all small; mostly SQL).**
1. Migration: `REVOKE EXECUTE … FROM PUBLIC, anon, authenticated` on every SECURITY DEFINER function not called from the client (list from §6.1); add `IF auth.uid() <> p_user_id THEN RAISE` to `get_community_chat_overview`, `get_community_chat_unread_count`, `get_user_conversation_ids`; lock `enforce_api_rate_limit`, `create_order_notification`, `auto_complete_orders`, `reveal_expired_reviews` to `service_role`; `SET search_path = public` on the 25 flagged functions; enable leaked-password protection in the dashboard.
2. `app/api/stripe/webhooks/route.ts:175` → `delivery_type === 'digital'` only. `app/api/payments/refund/route.ts` buyer path → call `request_refund` RPC. Fee base: pick one (recommend item + shipping, matching Stripe) and align `create_marketplace_order`; recompute nothing retroactively (2 orders exist).
3. `lib/api-security.ts` / `lib/turnstile-server.ts`: trust only `x-real-ip` on Vercel; split the shared `"user"` bucket into per-route scopes; add a daily prune of `api_rate_limits` to the auto-decline cron.
4. `change-email` / `change-password`: `signOut({ scope: 'local' })`; require `currentPassword` unless the JWT `amr` contains `recovery`.
5. `lib/auth/protected-paths.ts`: add `/checkout`, `/community/create`, `/takes/create`, `/sell`; drop `/queue`; move community settings/mod role gating into the `[slug]/settings/layout` effect (no `router.push` in render). `/login` redirects signed-in users.
6. Buckets: make `message-media` and `voice-notes` private (signed URLs via the existing `/api/orders/files`-style route), set `file_size_limit` on the six unlimited buckets.

**Verification.** Supabase security advisor shows 0 `anon_security_definer_function_executable`; `curl` as anon to `rpc/enforce_api_rate_limit` returns 42501; a Stripe test payment for a physical product leaves the order `paid` with no transfer; anonymous GET of `/checkout/x` is a 307.

---

## Phase 4 — The analytics/tracking layer (L3, B1, B2, S8)

**Goal.** Recording a view costs one request, always succeeds, and cannot be spoofed.

**Root cause fixed.** Client-side relationship checks and client-attributed rows in front of analytics writes; partial-index `ON CONFLICT`; missing SELECT policies.

**Steps.** One `record_view(kind, id, source, read_time)` SECURITY DEFINER RPC (or per-table) that derives `viewer_id` from `auth.uid()`, computes `is_follower` server-side, skips blocked pairs, and upserts with the correct conflict target; non-partial unique indexes on `(x_id, session_id, view_date)`; SELECT policies scoped to own rows on `take_views`/`community_views`/`profile_views`; `useTracking.ts` calls the RPC and drops `isBlockedEitherWay`/`checkIsFollowing`; remove the other 14 client `blocks` lookups that guard reads RLS already filters (`useProfile`, `/post/[id]`, `/take/[id]`, `useUserSearch`, `MessagesView`), keeping the ones that gate writes (block button, DM send).

**Verification.** Postgres log shows 0 `42P10` and 0 RLS violations on `take_views` in 24 h; `select count(*) from take_views` grows; `/rest/v1/blocks` leaves the top-10 endpoints.

---

## Phase 5 — Read-path efficiency and latency (L4, L5, L7, L8, L11, H12, B7)

**Goal.** Every list is paginated, counts come from aggregates, hot pages fetch each dataset once, and the page is served from the same region as the database.

**Root causes fixed.** No server-side aggregates; duplicate mounts; every route dynamic; region mismatch.

**Steps (split across two sessions if needed; each sub-step is safe alone).**
1. Infra: set Vercel function region to `sin1` (`vercel.json` `regions`), set `NEXT_PUBLIC_BASE_URL` (fixes B4), move `pq_theme`/`pq_feed_view` cookie reads out of the root layout so prose routes (`/help/*`, `/privacy`, `/terms`, guidelines, `/about`, `/login`) become static; remove `"use client"` from those pages.
2. Aggregates: `(count)` embeds or RPCs replace the ~12 fetch-all-rows sites (L4); `count:'exact'` → `planned`/none on explore, tags, community, profile, marketplace, orders.
3. Pagination on the ~30 unbounded queries (L5), starting with `useProfile` posts (tabbed pagination in `StudioProfile`), `useSavedPosts`, `useRelays`, community chat, seller lists.
4. Dedupe mounts: lift `useCommunity` into `CommunityLayoutClient` context; single `useTrendingTags` instance; one `useSellerOnboarding` with a 5-minute cache; `useCommunityMembers` one query with client-side status split.
5. Stop the per-page-load `profiles.update` in `FeedViewProvider`/`ThemeProvider` (write only on user action); settings pages read `useAuth().profile`.
6. DB hygiene migration: drop 5 duplicate indexes, add the 9 FK indexes, wrap the 3 bare `auth.uid()`, merge the multiple permissive SELECT policies on 8 tables; review the 120 "unused" indexes after two weeks of real traffic (not now).
7. Fix pagination correctness (B7): explore offset math + de-dupe, tag `.order()`, community sort server-side.

**Verification.** `/` data settles in <1.5 s from Riyadh; profile page of the most prolific author transfers <200 KB; advisor `duplicate_index`/`unindexed_foreign_keys` = 0.

---

## Phase 6 — Hang-adjacent and half-finished behaviour (H8, H9, H10, H11, B5, B8, S6, S9)

**Goal.** No silent failures; every route has boundaries; auth edge cases behave.

**Steps.** `AbortController`/`mountedRef` on the H8 hooks and correct in-flight handling in `useTags`/`useOrders`; `useAutoSave` stable interval; `not-found.tsx` + route-group `error.tsx`/`loading.tsx` for community, studio, post, take, seller, settings, insights, sell, product, commissions, tag; Turnstile fetch timeout; recovery-link error surfaced on `/login`; new-email confirmation; `notifications` INSERT policy constrains `type`/`user_id` (or route all creation through triggers/RPC); follow inserts through `useFollow` only; `reports` FK for takes; the B8 list.

---

## Phase 7 — Consolidation (C2, C3, C4, C5, L9)

**Goal.** One implementation per concern so the next feature is added once.

**Steps (one concern per commit).** `lib/posts/enrich.ts` (single raw-row → `Post` + user-flag batch) adopted by the 7/5 sites; one reaction write target; one block-check helper; `PostDetail`/`TakeDetail` shared body used by page and modal; `RequireAuth` everywhere; `ORDER_STATUS_CONFIG`, `MetricCard`, price/time formatters, DM find-or-create, fee constant single-sourced; product/commission create+update moved into RPC transactions (fixes L9 for the money paths); community create/delete into RPCs.

---

## Phase 8 — Dead code and bundle (D1–D3, L12)

**Steps.** Delete the dead hooks, schema-fallback branches, dead barrels, deprecated exports, `react-intersection-observer` (one hand-rolled observer), 11 unused fonts (keep Poppins, Open Sans, Playfair, Lora — and either wire the composer's font picker to the `next/font` variables or drop those fonts too), split `globals.css` by route group, lazy-load `PostDetailModal`/`TakeDetailModal` in `ModalProvider`, replace the `lib/hooks.ts` barrel imports with direct paths, retire the aura blobs on mobile; rewrite `docs/ARCHITECTURE.md` from `00-system-map.md`.

---

## Ordering rationale

1. Phase 1 first because it is the outage.
2. Phase 2 before security because with real users messaging, the DM storm takes the realtime tier and then the database down for everyone (the May incident), whereas the security items affect individual actors.
3. Phase 3 before performance because S1 is a one-request denial of service on login and S2 moves money the wrong way on the first physical sale.
4. Phases 4–5 are what "slow" actually is once "down" is fixed.
5. Phases 6–8 are hygiene and can be interleaved with feature work.

If launch traffic is commerce-first rather than chat-first, swap Phases 2 and 3.
