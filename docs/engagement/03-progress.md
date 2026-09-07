# Engagement rebuild — progress

Read `00-system-map.md` (what existed), `01-findings.md` (root causes),
`02-plan.md` (phases). This file is the hand-off between sessions.

## Status

| Phase | State | Date |
|---|---|---|
| 1 — Reactions save, sync, count, display correctly | **done** (merged to `main`) | 2026-09-07 |
| 2 — Comments, likes, replies | **done** (branch `fix/engagement-phase2`, merged to `main`) | 2026-09-07 |
| 3 — Notifications via DB triggers | next | |
| 4 — Security | | |
| 5 — Load / live events | | |
| 6 — UI/UX | | |

Decisions taken: D1 one reaction per user per post/take; D2 retire `admires`
(folded into `reactions`, writes revoked, table kept for insights RPCs until
Phase 5); D3 replies are one level deep; D4 post/take authors may delete any
comment on their content; D5 no comment editing. All approved 2026-09-07.

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

---

## Phase 2 — what changed (2026-09-07)

### Database (`supabase/migrations/20260908_engagement_phase2_comments.sql`, applied to prod)

- `comments` / `take_comments`: `reply_to_user_id` (FK → profiles, SET NULL)
  so "Replying to @name" is data; `CHECK (1..2200 chars, trimmed)`;
  DELETE policies letting the post/take author delete any comment on their
  content (D4); index on `take_comments(take_id, created_at)`.
- `reports.comment_id` so comment reports finally point at the comment.
- RPCs (SECURITY INVOKER): `add_post_comment` / `add_take_comment`
  (validates, flattens a reply-to-reply under the top-level comment and
  records `reply_to_user_id`, returns `{id, created_at, parent_id,
  reply_to_user_id, comments_count}`); `delete_post_comment` /
  `delete_take_comment` (RLS decides owner/author; FK cascade removes
  replies + likes; returns `{deleted, comments_count}`);
  `set_post_comment_like` / `set_take_comment_like` (`{liked, likes_count}`).
- `get_post_reaction_summary` / `get_take_reaction_summary` now also return
  `comments` (all rows) so one batched read seeds both counts.

### Client

- **`lib/hooks/useComments.ts`** is now the one comments hook for both kinds:
  `useComments(kind, id, {authorId})` → `{comments, loading, hasMore,
  loadingMore, loadMore, addComment(content, {parentId, replyToUserId}),
  toggleLike(id), deleteComment(id), fetchReplies(id, {more}),
  ensureCommentVisible(id), refetch}`. Top-level paginated (30), replies
  lazy + paginated (20) with `hasMoreReplies`; optimistic add (temp row,
  replaced by the confirmed row, removed on failure so the composer restores
  the text); optimistic like with per-comment in-flight guard and revert;
  delete removes the subtree and writes the server's count back. Comment
  notifications (posts only, until Phase 3): `comment` → post author with
  the new `comment_id`; `reply` → the person replied to; the post author
  also gets `comment` for a reply on their post.
- **`lib/engagement/store.ts`** gained `comments` / `commentsLoaded`,
  `setCommentsCount`, `bumpComments`; `useReaction` returns `comments` and
  accepts `loadComments`; **`components/feed/CommentCount.tsx`** binds any
  tile to it. Every comment number on cards, tiles, modal, page, take
  cards, take modal, take page and the takes panel is the same store value
  (all rows, top-level + replies).
- **`components/feed/CommentItem.tsx`** is kind-aware and shared by posts
  and takes: "Replying to @name ×" chip on the reply composer, "@name"
  link on replies that answer someone other than the thread author, "View
  more replies", post-author delete, mention rendering as React children
  (no `dangerouslySetInnerHTML`), IME-safe Enter, 2,200-char cap, report
  carries `comment_id` + post/take id, pending style for optimistic rows.
- Modal, post page, take modal, take page: "Load more comments"; counts
  from the store; composer restores text on failure. Post page deep link
  (`?comment=`) uses `ensureCommentVisible` (any page, any reply) and
  expands the parent thread.
- Takes: `TakeCommentsPanel` is a thin shell over the shared hook + item;
  `TakeCommentItem.tsx`, `TakeComments.tsx`, `useTakeComments` deleted.
- Tests: `lib/hooks/__tests__/useComments.test.ts` rewritten (8 cases: load,
  optimistic add + confirm + count + notification, rollback, reply
  notifications, like write-back, like revert, delete, take tables).
  `npx vitest run`: 30 files, 212 passed. `tsc --noEmit` clean; `next build`
  clean.

### Tested (two accounts, 2026-09-07)

Account A = `hadi` in Chrome; account B = `poet` through the same RPCs the
client calls, as `role = authenticated` with poet's JWT `sub`.

| Step | A's screen | DB | B sees |
|---|---|---|---|
| A comments on poet's post | row appears instantly, Discussion (1), card 1 | 1 row; `comment` notification to poet with `comment_id` | summary `comments: 1` |
| A likes own comment, replies | like 1; reply under thread; count 2 in both places | like row; reply `parent_id` = top, `reply_to_user_id` null (self) | `comments: 2` |
| A replies to the reply | "Replying to @hadi ×" chip; reply stored flat under the top comment; count 3 | `parent_id` = top-level | |
| B comments and likes A's comment (RPC as poet) | after reload: poet's comment first, A's comment shows ❤ 2, Discussion (4) | 4 rows, 2 likes | `comments: 4` |
| A tries to delete poet's comment (RPC as hadi) | menu shows no delete | rejected, row still there | |
| Deep link `?comment=<nested reply>` | thread auto-expanded to the reply | | |
| B (post author) deletes A's thread (RPC as poet) | after reload: only poet's comment, Discussion (1) | `deleted: 3`, likes cascaded to 0 | `comments: 1` |
| A comments on a take from the takes panel | "Posting…" row → confirmed; card count 0 → 1 without reload | 1 `take_comments` row | take summary `comments: 1` |

No console errors on any step.

### Known gaps left for later phases

- Take comment notifications and `mention` notifications for `@name` in
  comment text (Phase 3, DB triggers); un-like / delete do not remove
  notifications (Phase 3).
- Another user's new comment appears on the open page only after reload;
  the count refreshes on tab focus (Phase 5 live events).
- No `@` autocomplete in the composer (Phase 6).

## Next session

Phase 3 (notifications). Start from `02-plan.md` §Phase 3. Migration name:
`20260909_engagement_phase3_notifications.sql`. The client-side
`createNotification` calls to remove are in `lib/hooks/useComments.ts`
(`notify`), `lib/engagement/reactions.ts` (`afterWrite`),
`components/feed/useTileActions.ts` (save), `PostCard`/`PostDetailModal`/
`app/post/[id]` (save, relay), `lib/hooks/useTakes.ts` (relay),
`components/create/CreatePost.tsx` (mention).
