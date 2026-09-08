# Profile, feed and post view — progress

Read `00-system-map.md` for what exists, `01-findings.md` for what is wrong
(ids), `02-plan.md` for the sequence. This file is the only place session
state lives; update it at the end of every sub-phase.

## Status

| Sub-phase | Root cause | Status | Commit | Notes |
|---|---|---|---|---|
| 1a | RC-1 takes grid gutter | **done 2026-09-08** | see git log `fix(profile): stop the takes grid` | removed `background:#000` + the no-op mobile block from `.takes-grid` (app/globals.css). Verified 0/1/2/5 takes and Relays→Takes at 1400 px and phone width; tsc 0 errors, lint 0 errors (166 pre-existing warnings), 223 tests pass |
| 1b | RC-2 policies / grants | **done 2026-09-08, applied to prod** | see git log `fix(profile): hide email from the browser` | migration `20260913_profile_phase1b_grants.sql` (table grant on profiles replaced by column lists for anon/authenticated; `takes_select` mirrors `posts_select_policy`). Client: `lib/profiles/columns.ts`, explicit columns in `useProfile` + `AuthProvider`, client insert no longer writes email. Verified: DB role checks, REST as anon (select=* → 401, select=email → 42501, id/username → 200), feed/profile/settings in browser as owner. Found decision 10 (private accounts not enforced server-side for posts or takes) |
| 1c | RC-3 loading/error signal | **done 2026-09-08** | see git log `fix(profile): show errors as errors` | `useProfile` finally only clears loading for the run that owns the abort controller (X-1); `useUserTakes`/`useRelayedTakes` get a cancelled flag + `refetch`, `useRelays` gets `error` + `refetch` + ownership guard; a failed profile lookup in those hooks throws instead of rendering as empty; profile tabs render `TabErrorState` (Couldn't load … / Try again) before the empty state (P-20); post + take pages split network failure (Couldn't load … / Try again) from not-found, incl. the first query's `{ error }` (V-48); `FeedBoundary` client wrapper gives the feed fallback a working retry (F-13); feed shows "Still loading — trying again…" when the 12 s auto-retry fires (F-31). Also finished the 1b leftover: client-side take visibility checks removed from `useUserTakes` and `/take/[id]` (RLS owns it). Browser-verified: no not-found flash feed → profile; Takes tab failure + retry; post page failure + retry; not-found on post + take; feed retry note. Not browser-verified: the take page failure branch (its data loads before a fetch patch can land; same code as the post page) |
| 1d | RC-4 unchecked writes | **done 2026-09-08** | see git log `fix(profile): check every write` | New `lib/reports.ts` `submitReport` is the one insert shape (matches the live table: `post_id` / `take_id` / `reported_user_id` / `details` separate from `reason`); used by PostCard, PostDetailModal, post page, TakePostCard, TakeDetailModal, take page, `useTakes.reportTake`, StudioProfile (user report). Discovered the `reports` table was empty: post reports wrote a non-existent `reported_post_id` (X-4); take-comment reports used a rejected type (X-5, fixed). Save/relay/follow toggles on takes check `{ error }`, revert and toast (TakePostCard, TakeDetailModal, take page, useTakes); post page + modal save/relay catch the throwing toggles and revert; delete + block failures toast on both pages, both modals and TakePostCard; collection deletes toast. Browser-verified: take report row lands (type take, take_id, reported user), post report row lands (type post, post_id), failed take save reverts with "Failed to save take" toast; test rows deleted afterwards |
| 1e | RC-5 in-flight guards | **done 2026-09-08** | see git log `fix(profile): one save or relay in flight` | `PostCard` save/relay get `savePending`/`relayPending` refs (same pattern as `useTileActions`) and re-notify the bus on revert; `StudioProfile.handleFollow` gets try/catch/finally + toast so a failed follow/unfollow re-enables the button. Browser-verified: triple-click Save → one POST, final state saved, undo → one DELETE; unfollow with the request forced to fail → "Failed to unfollow" toast, button enabled, still Following; DB checked afterwards (follow intact, no stray save) |
| 1f | RC-6 one mapper | **done 2026-09-08** | see git log `fix(profile): one post-to-card mapper for every opener` | New `lib/posts/toPostProps.ts` (`toPostProps` / `toModalPost`, `PostLike` input) replaces the six mappers: Feed, Explore, saved page, collections item page, StudioProfile (posts + relays). One `ModalPost` type in `components/feed/PostCard/types.ts` used by `ModalProvider` and `PostDetailModal` (their two `Post` copies deleted; `authorId` now required). `useProfile` posts query now selects collaborators / mentions / tags through `POST_RELATIONS_SELECT` so those reach the modal from the profile. `lib/utils/format.ts` `formatCount` replaces the copies in StudioProfile, TakePostCard, TakeCard ("1.2K"); `decodeHtmlEntities` → `stripHtml`; the five inline `toLocaleDateString` calls use `lib/utils/time` (`shortDate`, `fullDate`, `formatDate`, new `mediumDate` / `monthYear`); post page `getTypeLabel` → `getPostTypePhrase`. Visible consequences, all inside findings: modal avatar fallback is `/defaultprofile.png` everywhere (P-42), profile card dates from before this year gain the year via `shortDate`, counts ≥1000 read "1.2K" not "1.2k". Browser-verified: content warning overlay from a profile tile (temporary warning set on my own post, then removed), hashtags from a profile tile, journal modal from the profile, explore + saved pages load, no console errors. Left alone: `formatCount` copies in CommunityHeader / CommunityCard (outside this audit) |
| 1g | RC-7 modal history | not started — **next** | — | |
| 1h | RC-8 pub/sub + memo | not started | — | |
| 1i | RC-9 follow | not started | — | |
| 1j | RC-10 enrichPost / stats | not started | — | decision 2 |
| 1k | RC-11 pagination | not started | — | decision 9 |
| 1l | RC-12 take player | not started | — | decision 3 for V-19 |
| 2a–2f | technical quality | not started | — | |
| 3 | profile UI/UX | not started | — | one-sentence list needs approval first |
| 4 | feed UI/UX | not started | — | same |
| 5 | post/take view UI/UX | not started | — | same; decision 8 |

## How to resume

1. `git status` must be clean except `tsconfig.tsbuildinfo`.
2. Pick the first row above that is "not started" or "in progress".
3. Re-read that sub-phase in `02-plan.md`; confirm the findings it cites
   still reproduce (the `file:line` references were taken at commit 706a1ab
   and will drift as phases land).
4. Dev server: `npm run dev` (port 3000). Test users: `hadi` (owner, 1
   take), `hii` (2 takes), `poet1` (5 takes), `poet` (0 takes).
5. On finish: lint, typecheck, tests, browser check at desktop and 390 px,
   commit with the message given in the plan, update this table.

## Session log

- 2026-09-08 — plan approved by the user; 1a done and committed.
- 2026-09-08 — 1b SQL shown, user replied "apply"; migration applied to prod and committed.
- 2026-09-08 — 1f done and committed. Rule: any new list that opens the post modal or renders PostCard goes through `toPostProps` / `toModalPost`; never hand-build the shape.
- 2026-09-08 — 1e done and committed.
- 2026-09-08 — 1d done and committed. Open item outside this audit: the community mod queue (`useModQueue`, `ModQueuePage`) still reads `reported_post_id` (X-4).
- 2026-09-08 — 1c done and committed. Browser trick for failure states: patch `window.fetch` to reject a `/rest/v1/<table>?` URL right after navigation, then restore it and click Try again. New column on `profiles` = add it to the GRANTs and `lib/profiles/columns.ts`.

## Decisions log

| # | Question (see plan) | Answer | Date |
|---|---|---|---|
| 1 | 1b DB changes | approved ("apply") | 2026-09-08 |
| 2–10 | — | pending | — |
