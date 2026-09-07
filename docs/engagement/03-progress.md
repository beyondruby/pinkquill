# Engagement rebuild — progress

Read `00-system-map.md` (what existed), `01-findings.md` (root causes),
`02-plan.md` (phases). This file is the hand-off between sessions.

## Status

| Phase | State | Date |
|---|---|---|
| 1 — Reactions save, sync, count, display correctly | **done** (branch `fix/engagement-phase1`, merged to `main`) | 2026-09-07 |
| 2 — Comments, likes, replies | next | |
| 3 — Notifications via DB triggers | | |
| 4 — Security | | |
| 5 — Load / live events | | |
| 6 — UI/UX | | |

Decisions taken (recommended defaults, approved by "go ahead with phase 1"):
D1 one reaction per user per post/take; D2 retire `admires` (folded into
`reactions`, writes revoked, table kept for insights RPCs until Phase 5);
D3/D4/D5 unchanged, still to confirm before Phase 2.

---

## Phase 1 — what changed (2026-09-07)

### Database (`supabase/migrations/20260907_engagement_phase1_reactions.sql`, applied to prod)

- `reactions` got the missing **UPDATE policy** (`user_id = auth.uid()`).
  This alone was the root cause of "my second reaction never shows for
  anyone": the change-reaction UPDATE used to affect 0 rows and return no
  error.
- `admires` rows folded into `reactions` as `admire` (0 rows existed);
  INSERT/UPDATE/DELETE on `admires` revoked from `anon`/`authenticated`;
  its two write policies dropped. Reads remain for the insights RPCs.
- `take_reactions`: 4 duplicate `(take_id, user_id)` pairs collapsed (newest
  kept), `UNIQUE (take_id, user_id)`, six-type `CHECK`, FK re-pointed to
  `profiles(id)`.
- New RPCs (all SECURITY INVOKER, RLS still applies):
  `set_post_reaction(p_post_id, p_type)`, `clear_post_reaction(p_post_id)`,
  `set_take_reaction`, `clear_take_reaction` → `{mine, previous, changed,
  counts}`; `get_post_reaction_summary(p_ids uuid[])`,
  `get_take_reaction_summary(p_ids uuid[])` → per-type counts + the caller's
  own reaction for up to 100 ids; helpers `post_reaction_counts_json`,
  `take_reaction_counts_json`. Writes granted to `authenticated`, reads to
  `anon` + `authenticated`.
- Still present, unused by the app: `get_reaction_counts`,
  `get_total_reactions` (drop in Phase 5).

### Client

- **`lib/engagement/store.ts`** — tab-wide store keyed `post:<id>` /
  `take:<id>`: `{mine, mineFor, counts, totalLoaded, countsLoaded, pending,
  writtenAt}`. `seedReaction` (from list rows; ignores seeds while a write is
  pending or within 5 s after one), `ensureReactionLoaded` (batched
  summary RPC, coalesced per tick, chunked by 100), `setReaction` /
  `clearReaction` / `toggleReaction` / `toggleDefaultReaction` (optimistic →
  RPC → server write-back → revert on error; per-id `pending` guard).
- **`lib/engagement/reactions.ts`** — `useReaction(kind, id, {seed,
  authorId, refreshOnFocus, loadCounts})` returning `{mine, counts,
  countsLoaded, pending, react, unreact, toggleDefault, loadCounts}`. Opens
  the auth modal for signed-out viewers, toasts on failure, sends the
  post-author notification only when a reaction was **added** (null → type),
  re-reads on tab focus when asked.
- **`components/feed/ReactionCount.tsx`** — read-only total bound to the
  store for tiles without a picker.
- **`components/feed/ReactionPicker.tsx`** — one picker for posts and
  takes: `variant="card" | "pill" | "overlay"`, `countsLoaded` (per-type
  numbers blank until real), `onOpen` (loads the split). Re-selecting the
  current reaction always removes it. `components/takes/TakeReactionPicker.tsx`
  deleted.
- Surfaces rewired to the store (local reaction state, handlers and the
  reaction half of the modal bus removed): `PostCard`, `PostDetailModal`,
  `app/post/[id]`, `useTileActions` (gallery/stream tiles now toggle the
  real reaction, not `admires`), `StreamView` rows, `StudioProfile` grid +
  relays tab, `saved` page tiles, `TakeCard`, `TakesFeed` (`l` key →
  `toggleDefaultReaction`), `TakeDetailModal`, `TakePostCard`,
  `app/take/[id]`.
- Removed: `useToggleAdmire`, `useToggleReaction`, `useReactionCounts`,
  `useUserReaction` (`lib/hooks/useInteractions.ts` keeps save/relay/block);
  `useTakes.toggleReaction/toggleAdmire/useTakeReactionCounts`;
  `Post.admires_count`, `Post.user_has_admired`, `getInteractionCount`;
  `PostStats.admires`, `PostProps.isAdmired`; `Take.admires_count`,
  `Take.is_admired`; `PostUpdate.field` no longer has `admires`/`reactions`;
  `TakeUpdate.field` no longer has `reactions`; the `disableRealtimeSubscriptions`
  prop; every `admires(count)` embed and the `admires` flag query.
- Ranking/stats now use reactions: explore scoring and interest signals
  (`useExplore.ts`), community hot/top (`hooks.legacy.ts`), profile
  "Admires" stat (`useProfile.ts` sums `reactions(count)`).
- `useSavedPosts` uses `fetchUserPostFlags` (reactions included) instead of
  a hand-built flag set; the collection item page passes no counts and lets
  the store fetch; `PostStats.reactions` and `PostProps.reactionType` are
  optional where `undefined` means "unknown, fetch it".
- Tests: `lib/engagement/__tests__/store.test.ts` (11), rewritten
  `components/feed/__tests__/useTileActions.test.tsx`, trimmed
  `useInteractions.test.ts`, fixtures in `useFeed/useProfile/ModalProvider`
  tests. `npx vitest run`: 30 files, 212 passed, 7 skipped. `tsc --noEmit`
  clean; `next build` clean.

### Tested (two accounts, 2026-09-07)

Account A = `hadi` in Chrome (dev server on :3000). Account B = `hii` and
`poet`, exercised through the same RPC the client uses
(`get_post_reaction_summary` / `get_take_reaction_summary`) inside a
rolled-back transaction with `role = authenticated` and their JWT `sub`, plus
direct row checks. No second browser profile was available.

| Step | A sees | DB row | B sees |
|---|---|---|---|
| Heart on poet's post `/post/6a24ca9a…` | ❤ 1 | `admire` | — |
| Picker → snap (the reported bug) | snap 1 | **`snap`** (previously stayed `admire`) | `snap:1, total:1` |
| Picker → snap again (remove) | ♡ 0 | none | — |
| Picker → applaud | applaud 1 | `applaud` | — |
| Double-click the heart | ♡ 0 | none (second click ignored while pending) | — |
| Profile grid → modal → ovation → close | grid tile 0 → 1 without reload | `ovation` | `ovation:1, total:1, mine:null` |
| Reload `/post/…` | ovation 1 | | |
| `/takes` heart | ❤ 1 | `admire` | |
| `/takes` picker → applaud | applaud 1 | one row `applaud`, 0 duplicate pairs | `applaud:1, total:1` |
| Home feed classic + gallery | render, counts present, no console errors | | |

Notifications: A's admire and A's applaud each produced one row for poet;
the admire → snap change produced none; removal did not delete the admire
row (Phase 3 reconciles). Production `take_reactions` has 0 duplicate pairs.

### Known gaps left for later phases (unchanged from the plan)

- Comment counts on cards still static; modal/page count = loaded top-level
  (Phase 2).
- Notifications not deleted on un-react; none for takes (Phase 3).
- No block/visibility enforcement in reactions RLS beyond post SELECT
  (Phase 4). Direct INSERT/DELETE on `reactions`/`take_reactions` still
  granted (Phase 4 revokes once nothing else writes them).
- `useRelays` still hard-codes `user_reaction_type: null`; the relays tab
  works because its tiles/modal treat the value as unknown and fetch.
- Picker has no touch/long-press (Phase 6).

## Next session

Phase 2 (comments). Start from `02-plan.md` §Phase 2; confirm D3 (one-level
replies), D4 (author can delete comments on own post), D5 (no comment
edit) first. Migration name: `20260908_engagement_phase2_comments.sql`.
