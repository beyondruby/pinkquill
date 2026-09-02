# Pinkquill — Audit Progress

Audit produced 2026-09-02 (`00-system-map.md`, `01-findings.md`, `02-plan.md`). Work happens on branch `fix/phase1-site-loads` (branched from `main` at `0c9625b`).

## Status by phase
| Phase | Status | Commit(s) | Notes |
|---|---|---|---|
| 1 — Site does not load | **done, needs prod verification** | see `git log fix/phase1-site-loads` | All 7 steps applied; typecheck/lint/tests/build green; local smoke on logged-in + multi-tab OK |
| 2 — Realtime / DM storm | not started | – | |
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

## Next
Deploy the branch (merge to `main` triggers Vercel), watch `vercel logs` for `[auth-diagnostic]` for a day, then start Phase 2 (`02-plan.md`).

## How to resume in a fresh session
1. Read `02-plan.md` for the phase being worked on and `01-findings.md` for the IDs it cites; `00-system-map.md` only as needed.
2. Check this file for the last completed step and its commit.
3. Live-state facts that were true at audit time and should be re-checked before relying on them: Vercel region `iad1`; `NEXT_PUBLIC_BASE_URL` unset in prod; Supabase Micro compute; `supabase_realtime` publication has 22 tables; 74 SECURITY DEFINER functions executable by `anon`.
