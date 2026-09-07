# Engagement rebuild — progress

Read `00-system-map.md` (what existed), `01-findings.md` (root causes),
`02-plan.md` (phases). This file is the hand-off between sessions.

## Status

| Phase | State | Date |
|---|---|---|
| 1 — Reactions save, sync, count, display correctly | **done** (merged to `main`) | 2026-09-07 |
| 2 — Comments, likes, replies | **done** (merged to `main`) | 2026-09-07 |
| 3 — Notifications via DB triggers | **done** (merged to `main`) | 2026-09-07 |
| 4 — Security | **done** (branch `fix/engagement-phase4`, merged to `main`) | 2026-09-07 |
| 5 — Load / live events | **done** (branch `fix/engagement-phase5`, merged to `main`) | 2026-09-07 |
| 6 — UI/UX | **done** (branch `fix/engagement-phase6`, merged to `main`) | 2026-09-07 |

Decisions taken: D1 one reaction per user per post/take; D2 retire `admires`
(folded into `reactions`; the table was dropped in Phase 5); D3 replies are one level deep; D4 post/take authors may delete any
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

---

## Phase 3 — what changed (2026-09-07)

### Database (`supabase/migrations/20260909_engagement_phase3_notifications.sql`, applied to prod)

- Every engagement notification is now created by a trigger, never by the
  browser: `reactions_notify`, `take_reactions_notify` (AFTER INSERT /
  UPDATE OF reaction_type / DELETE — one row per actor+content, re-labelled
  in place on change with `read=false` + fresh `created_at`, deleted on
  un-react), `comments_notify_insert` + `comments_notify_delete` (BEFORE
  DELETE) and the take twins, `comment_likes_notify`,
  `take_comment_likes_notify`, `post_mentions_notify`, `take_mentions_notify`,
  `relays_notify`, `saves_notify`, `take_relays_notify`, `take_saves_notify`.
- Shared rules in `engagement_notify_allowed(recipient, actor, category)`:
  no self-notification, none across a block in either direction, none when
  the recipient muted the category (`profiles.notification_preferences`).
- Comment rows notify the content author (`comment`, comment_id = the
  comment), the person answered (`reply`), and every `@name` that resolves
  to a profile (`mention`), each person at most once per comment; resolved
  handles are stored in `comment_mentions` / `take_comment_mentions`.
- Take rows set `take_id` (post_id stays NULL); reaction rows set
  `reaction_type`; `notifications.comment_id` FK dropped (take comment ids
  live in another table; the BEFORE DELETE triggers do the cleanup).
- `notify_notification_change` also broadcasts an UPDATE when a row's type
  changes so the panel re-labels live.
- Backfill: orphaned reaction / comment_like / reply / save / relay rows
  deleted; `reaction_type` filled; take relays moved from `post_id` to
  `take_id`.

### Client

- Removed every client-side engagement `createNotification` / raw insert:
  `lib/engagement/reactions.ts`, `lib/hooks/useComments.ts`,
  `components/feed/{useTileActions,PostCard,PostDetailModal}.tsx`,
  `app/post/[id]/page.tsx`, `lib/hooks/useTakes.ts` (relay),
  `components/create/CreatePost.tsx` (mention). `createNotification` stays
  for community / collaboration / follow flows until Phase 4.
- `Notification` type gains `take_id`, `reaction_type`, `take`;
  `useNotifications` joins `take:takes(caption, thumbnail_url)` and patches
  `type` / `created_at` on UPDATE events.
- `NotificationPanel`: links resolve takes (`/take/<id>`), and `comment` /
  `mention` rows deep-link with `?comment=`; message says "your take";
  `groupNotifications()` folds consecutive reactions on the same post/take
  from different people into "A and N others reacted to your post" (one row,
  unread if any is unread, click marks all read). Tests in
  `components/notifications/__tests__/groupNotifications.test.ts`.
- Email route + templates: take rows load the take, link to `/take/<id>`,
  coalesce per take.
- Tests: 32 files, 214 passed; `tsc` clean; `next build` clean.

### Tested (two accounts + a third for mentions, 2026-09-07)

Through the RPCs as `hadi` (A), `poet` (B) and `hii` (C), then the panel in
Chrome as A.

| Step | Result |
|---|---|
| A reacts admire → snap on B's post | B has exactly one row, type/reaction_type `snap`, unread |
| A un-reacts | row gone |
| A comments "hey @poet and @hii and @nobody_here" | B gets `comment` with comment_id (no duplicate mention); C gets `mention`; unknown handle ignored; both in `comment_mentions` |
| B likes then unlikes A's comment | `comment_like` appears for A, then disappears |
| A deletes the comment | its `comment` and `mention` rows gone; zero orphaned comment notifications |
| B mutes "Post activity", A reacts | no row created |
| C blocks A, A mentions @hii | no row created |
| A reacts on C's take | row with `take_id`, post_id NULL |
| B and C react to A's post | A's panel shows one grouped row |

### Known gaps left for later phases

- Community / collaboration / follow notifications are still client inserts
  and the `notifications` INSERT policy is still open (Phase 4).
- Mentioning a private account in a comment notifies them regardless of
  follow state (Phase 4 privacy rules).
- Grouped rows show one avatar and a text count; stacked avatars are Phase 6.

---

## Phase 4 — what changed (2026-09-07)

### Database (`20260910_engagement_phase4_security.sql` + `20260910_engagement_phase4b_hardening.sql`, applied to prod)

- Visibility and block rules as SECURITY DEFINER helpers that only answer
  about the caller: `engagement_blocked`, `engagement_can_view_post` (mirrors
  `posts_select_policy`), `engagement_can_view_take`, `engagement_can_engage`,
  `engagement_can_tag` (no self, no block, private accounts only if they
  already follow the author), `engagement_rate_limit` (on top of
  `enforce_api_rate_limit`).
- **Clients can no longer write engagement tables directly.** INSERT/UPDATE/
  DELETE on `reactions`, `take_reactions` and INSERT/UPDATE on `comments`,
  `take_comments`, INSERT/UPDATE/DELETE on `comment_likes`,
  `take_comment_likes` revoked from `anon`/`authenticated`. All writes go
  through SECURITY DEFINER RPCs with explicit checks + rate limits:
  `set_/clear_post_reaction`, `set_/clear_take_reaction` (60/min),
  `add_post_/take_comment` (20/min), `set_post_/take_comment_like` (60/min);
  `delete_*_comment` stays SECURITY INVOKER on the owner/author policies.
- **Reads respect visibility and blocks:** SELECT policies on reactions,
  comments, take_reactions, take_comments require the post/take to be
  visible to the viewer and hide rows from anyone blocked either way;
  comment likes are visible only where the comment is. Anonymous viewers see
  nothing on non-public posts (counts included).
- **Tagging:** restrictive INSERT policies on `post_mentions`/`take_mentions`
  and the same rule inside `create_post_with_relations` (which now also
  skips blocked collaborators); `remove_self_mention(kind, id)` plus
  self-delete policies so tagged people can untag themselves.
- **Notifications are server-only:** the `notifications` INSERT policy is
  dropped and INSERT revoked. Follows (`trg_follows_notify`: follow,
  follow_request, follow_request_accepted; deleted on unfollow/decline),
  collaborations (`trg_post_collaborators_notify`: invite, accepted/declined
  + invite marked read, removed on self-removal), community role/mute/ban
  (`trg_community_members_notify`, content built in SQL) are triggers;
  moderator warnings go through `send_community_warning`.
- `block_user(p_blocked)` RPC: block row, follows both ways, both users'
  reactions/likes/tags on each other's content, and every notification
  between them, in one transaction.
- Mentions in a comment capped at 10. Trigger bodies and internal helpers
  are not executable through the API.

### Client

- Removed the last client-side notification inserts and the
  `createNotification` helper itself (`lib/hooks/useNotifications.ts`,
  `useProfile.ts`, `hooks.legacy.ts`, `CreatePost.tsx`, `ModQueuePage.tsx`
  → `send_community_warning` RPC).
- `useBlock.blockUser` calls `block_user`.
- `PostTags` shows "Remove me" to a tagged viewer (`kind`, `contentId`,
  `currentUserId` props; wired on the post page, post modal, take page,
  take modal).
- Tests: 212 passed; `tsc` clean; `next build` clean.

### Tested (2026-09-07, as hadi / poet / hii through the RPCs, plus Chrome as hadi)

| Check | Result |
|---|---|
| Insert a forged notification as a user | rejected (42501) |
| Insert directly into reactions / comments / comment_likes | rejected (42501) |
| Comment or react on a post made private, as a non-follower | `POST_NOT_FOUND`; the user and anonymous viewers see 0 comments and a 0 reaction total; public again → visible |
| poet blocks hadi via `block_user` | hadi's reaction on poet's post removed, notifications between them gone, poet no longer sees hadi's comments, hadi cannot comment (`POST_NOT_FOUND`) |
| 61 reactions in one minute | 61st rejected with `RATE_LIMITED` |
| Tag a private account that does not follow you (RPC and direct insert) | 0 added / rejected; a private account that already follows you can be tagged |
| Ask the visibility helper about another viewer | false (helpers only answer for the caller) |
| Follow / unfollow | `follow` row appears then disappears |
| Collaboration invite → accept | invite row for the invitee, `collaboration_accepted` for the author, invite marked read |
| Tagged viewer clicks "Remove me" | tag row and its `mention` notification gone, chip disappears |
| React + comment on a post after the grant changes (Chrome) | works, no console errors |
| Security advisor | no engagement-table findings after 4b |

### Known gaps left for later phases

- SELECT policies call a definer function per row; fine at today's volume,
  Phase 5 replaces per-row counts with counter columns.
- Community invite / join-request / join-approved notifications still come
  from the membership RPCs (server-side already, unchanged).
- Rate limits are per user per minute; there is no per-IP limit for
  anonymous traffic (nothing anonymous can write).

## Phase 5 — what changed (2026-09-07)

### Database (`20260911_engagement_phase5_load.sql` + `20260911_engagement_phase5b_trigger_fix.sql`, applied to prod as `..._phase5_load`, `..._phase5b_trigger_fix`, `..._phase5c_bump_grants`)

- **Counter columns instead of counting rows.** `posts.reactions_count`,
  `comments_count`, `relays_count`, `reaction_counts jsonb` (per type) and
  `takes.reactions_count`, `comments_count`, `relays_count`, `saves_count`,
  `reaction_counts`. Maintained by AFTER triggers on `reactions`,
  `take_reactions` (insert / type change / delete), `comments`,
  `take_comments`, `relays`, `take_relays`, `take_saves` through two
  trigger-only helpers (`engagement_bump_reaction`, `engagement_bump_counter`,
  not executable from the API). Backfilled once by
  `engagement_reconcile_counts()`, which also runs nightly (pg_cron
  `engagement-reconcile`, 03:17) and returns the number of rows it had to
  fix (0 after the backfill, 0 after the tests below).
- `get_post_/take_reaction_summary(p_ids)`, `post_/take_reaction_counts_json`
  and `get_takes_feed` read the columns. The summary LEFT JOINs the content
  table so an id the viewer may not see comes back as zeros (RLS still
  applies to the row).
- **Live content events.** `trg_content_events` on reactions / take_reactions
  / comments / take_comments calls `realtime.send` on the public channel
  `content-events:<kind>:<id>` with `{kind, id, what, op, counts, comments,
  actor_id, comment_id?, parent_id?}`. Nothing is subscribed per user; a
  surface subscribes only while a post/take is open.
- Dropped: `admires`, `take_admires` (the insights RPCs
  `get_creator_insights_summary` / `get_community_insights_summary` were
  rewritten without them), `get_reaction_counts`, `get_total_reactions`,
  the redundant single-column indexes `idx_reactions_post_id`,
  `idx_comments_post_id` (the UNIQUE / composite indexes cover them).
- 5b: the first trigger version referenced `NEW.take_id` inside a CASE on a
  `reactions` row; plpgsql resolves record fields even in the branch that is
  not taken, so every post reaction failed until the triggers were changed
  to read the id through `to_jsonb(NEW)`. 5c: the security advisor flagged
  the bump helpers as callable by `authenticated`; EXECUTE revoked (a caller
  could otherwise have inflated any counter).

### Client

- Every list read (`lib/posts/enrich.ts` `POST_COUNTS_SELECT`, `useFeed`,
  `useProfile`, `useTags`, `useExplore`, `hooks.legacy`, the `useTakes`
  fallback path and `useUserTakes` / `useRelayedTakes` / `useSavedTakes`, the
  take page) selects the counter columns instead of `reactions(count)` embeds
  or fetching every reaction/comment/save/relay row. `enrichPost` exposes
  `Post.reaction_counts`.
- Cards seed the store with the per-type split (`PostStats.reactionCounts`,
  passed from Feed, community page, explore, tag page, studio profile), so
  the picker opens with real numbers and the modal/page do not refetch what
  the list already knew.
- `lib/engagement/live.ts` — `subscribeContentEvents(kind, id, listener?)`:
  one channel per content id per tab, reference-counted, at most 4 idle
  channels. Counts go into the store via `applyLiveCounts` (ignored while
  this tab has a write in flight or within the 5 s post-write grace, same
  rule as seeds). `useReaction({ live: true })` and
  `useComments({ live: true })` (refetches page 0, coalesced 400 ms, when
  another user adds or removes a comment) are wired on the post page, post
  modal, take page, take modal and the takes comments panel. Feed cards keep
  poll-on-focus.
- `ModalProvider`: subscribers live in refs and `notifyUpdate` /
  `notifyTakeUpdate` are stable (no `selectedPost` dependency), so a count
  change no longer re-runs every card's subscribe effect.
- Post page and take page fetch once per (id, viewer id): they wait for
  `status !== "loading"` from `useAuth` instead of running anon-then-user.
  The take page also clears a stale error on refetch (the anon miss used to
  leave "Take not found" on screen) and no longer runs the two `take_saves`
  / `take_relays` count queries that returned 400 (those tables have no
  `id` column). The post page's client-side visibility / private-account /
  follower checks are gone; `can_view_post` in RLS decides.
- `useInsights` no longer queries `admires` (the one place that needed
  engagement rows for the top-posts list reads `reactions`);
  `app/api/takes/delete` no longer deletes from `take_admires`.
- Tests: `lib/engagement/__tests__/live.test.ts` (new) + `applyLiveCounts`
  cases in `store.test.ts`; suite 218 passed; `tsc` clean; eslint 0 errors;
  `next build` clean.

### Tested (2026-09-07, hadi in Chrome = A, poet / hii through the RPCs = B)

| Check | Result |
|---|---|
| A has poet's post open; B (poet) reacts `snap` and comments through the RPCs | A's page shows 1 reaction, "Discussion (4)" and the new comment within a second, no reload |
| A then reacts `admire` on the same post | A sees admire 1 + snap 1 = 2; B's `get_post_reaction_summary` returns the same split, total 2, comments 4 |
| Studio profile cards and the header stat | 1/1, 2/4, 0/0 match `posts.reactions_count` / `comments_count`; header "Admires 3" = sum of the columns |
| A has hii's take open; B (hii) reacts `snap` and comments | A sees 2 reactions, "Discussion (2)", the comment appears live |
| `engagement_reconcile_counts()` after all of the above | 0 rows corrected (columns = row counts for every post and take) |
| Security advisor | no findings on the new functions after 5c |

**Load test not run.** The plan's 10k-users-on-one-post scenario needs a
Supabase branch (billed) or a synthetic dataset; prod has 37 posts, 28
reactions, 34 comments, 7 takes. What was measured instead: the batched
summary for 30 posts as an authenticated user is one function scan plus the
RLS filter, 12 ms end to end on this data (EXPLAIN ANALYZE), with no
per-post subquery; the per-row cost is now the RLS policy, not counting.
The write path is one row insert + one indexed UPDATE on the parent + one
broadcast, so hot-post contention is on the parent row lock (Postgres
serialises those; a burst on one post queues rather than fails). This is
reasoning, not a measurement.

### Known gaps left for later phases

- `saves` on posts has no counter column (nothing displays a post save
  count today).
- The take page still runs its own client-side visibility checks (the post
  page's were removed); `can_view_take` in RLS makes them redundant.
- `useInsights` shows `reactions` where "admires" used to be counted; the
  labels in the insights UI still say "admires" (Phase 6 wording).
- Feed cards refresh counts on focus only; live events are opt-in per open
  surface by design.

## Phase 6 — what changed (2026-09-07)

### Database (`20260912_engagement_phase6_ui.sql`, applied to prod)

- `get_post_reactors` / `get_take_reactors(p_id, p_type, p_limit, p_before)`:
  who reacted, newest first, per type, with the viewer's follow status.
  SECURITY INVOKER, so the Phase 4 read policies decide what is listed.
- `get_post_/take_reaction_summary` return `top_reactor` (someone the viewer
  follows, else the latest reactor, never the viewer) for the card line.
- `search_mention_candidates(p_query, p_limit)` for the composer's `@`
  autocomplete: people you follow first, then a name search; excludes
  yourself, anyone blocked either way, and private accounts that do not
  follow you (the tagging rule). Authenticated only.

### Client

Reactions
- `ReactionPicker`: long-press (450 ms) on touch and right-click open the
  picker; the click that follows does not toggle; tap still toggles the
  default; haptic tick where `navigator.vibrate` exists; tap outside
  closes; the synthetic hover after a tap no longer opens it. Count and
  icon pop (`.animate-pop`, existing `pop` keyframe) whenever the total
  changes, including live events. Mobile uses the existing fixed
  bottom-sheet styles (`.reaction-picker-dropdown`, arrow hidden).
- `components/feed/ReactionSummary.tsx`: top-3 reaction icons + "You, poet
  and 3 others reacted" (falls back to "4 reactions" until the summary is
  loaded). On every feed card (under the actions), the post page, post
  modal, take page and take modal (above the action bar). Tapping opens
  `components/feed/ReactionsSheet.tsx` (the `Sheet` primitive): a tab per
  type with counts, people with their reaction, Follow / Requested /
  Following buttons through `useFollow`, "Show more" paging.
- `useReaction({ loadSummary })` + store fields `topReactor`,
  `summaryLoaded`; the summary RPC is only requested when the total is > 0
  (one batched call per feed page).

Comments
- `components/feed/CommentComposer.tsx` is the one input everywhere (post
  page, post modal, take page, take modal, takes panel, and replies inside
  `CommentItem`): auto-growing textarea, Enter sends / Shift+Enter newline /
  IME-safe, counter from 2,000 of 2,200 (over the limit blocks sending),
  emoji button (existing `EmojiPicker`), "Replying to @name ×" chip, `@`
  autocomplete (people you follow first) and `#` autocomplete (tags),
  arrow keys / Enter / Tab / Escape. Failed posts keep the text.
- Pages: the composer sits at the bottom of the discussion card and
  sticks there while the list scrolls; skeleton rows (`CommentSkeleton`)
  while loading; an empty state that invites the first comment. The take
  page now stacks on phones (it was a fixed two-column desktop layout).
- `CommentItem`: like heart and count pop; Reply button carries
  `data-reply-toggle` so a deep link can open it.
- Deep links: `?comment=<id>&reply=1` scrolls to the comment (any page,
  any reply) and opens its reply composer, on both the post page and the
  take page (the take page had no deep-link handling before; E-15). Waits
  for auth so the toggle is enabled.

Notifications
- Grouped reaction rows stack up to three actors' avatars, show the
  reaction icon in the badge and the distinct reaction icons after the
  text. Comment / reply / mention rows have a **Reply** quick action that
  marks the group read and opens the thread with the composer on that
  comment. Take rows show the take thumbnail.

Tests: `components/feed/__tests__/composer.test.ts` (token parsing,
summary wording); suite 223 passed; `tsc` clean; eslint 0 errors;
`next build` clean.

### Tested (2026-09-07, hadi in Chrome = A, poet / hii through the RPCs = B; phone widths through same-origin 390 px and 360 px frames because the Chrome window would not resize)

| Check | Result |
|---|---|
| Card line on poet's post | "You and poet reacted" with the two icons; tapping opens the sheet with All 2 / Admire 1 / Snap 1, hadi + poet rows, Follow button on poet |
| B's view of the same lists | `get_post_reactors` returns hadi (admire) + poet (snap, is_me); `top_reactor` for poet = hadi |
| Type "nice one @po" in the composer | dropdown lists poet1 (followed) first, then poet; ↓ Enter inserts `@poet `; Enter posts; comment renders with the mention link; B receives a `comment` notification carrying `comment_id` |
| `search_mention_candidates` as B | "ha" → hadi; "" → followed first; blocked and non-following private accounts absent |
| Right-click the heart | picker opens with per-type counts; Escape closes |
| Reply on a comment | compact composer with "Replying to @hadi ×" chip |
| B comments on A's post; A opens Notifications | row shows the comment text and a **Reply** button; clicking it lands on `/post/<id>?comment=<id>&reply=1` with the reply composer open on that comment; A's reply appears nested under "Hide 1 reply"; B's thread query shows both rows |
| Grouped reaction row | "jane doe and 1 other reacted to your thought" with stacked avatars and the snap icon |
| 390 px / 360 px | feed card with summary line, post page (summary above the action bar, sticky composer), take page (stacked columns, no mid-word wrap), takes feed overlay all fit without horizontal scroll |

Not verified on a real touch device: long-press and haptics were written to
the Touch Events + `navigator.vibrate` APIs but only right-click was
exercised (no touch emulation available in this session).

### Follow-up (2026-09-07, after review)

- The post modal showed a purple box around the author's avatar: `useDialog`
  focused the first control in the dialog (the avatar link) and Chrome paints
  the `:focus-visible` ring on script-focused controls. Dialogs now focus
  the panel itself; Tab still goes to the first control.
- The who-reacted line moved under the action bar on every open surface
  (it floated above the divider on the modal / page) and now bolds the
  names: "**You** and **poet** reacted", icons 18 px with a surface ring.
- The deep-link highlight is applied to the comment bubble, not the whole
  row with the avatar.

### Follow-up 2 (2026-09-07): Instagram-style action row

- Action rows are plain 24 px icons with no numbers on them (cards, post
  page, post modal, take page, take modal): reaction, comment, relay on
  the left; share, save on the right. Hover is a soft circle; no pills.
- Under the row: a facepile of up to three reactors (people you follow
  first) and "**You** and **poet** reacted" / "**poet** and **12 others**
  reacted" / "**12 reactions**". Migration
  `20260912_engagement_phase6b_top_reactors.sql`: the summaries return
  `top_reactors` (username, display_name, avatar_url ×3) instead of
  `top_reactor`.
- Cards show "View all N comments" under that line
  (`components/feed/ViewCommentsLink.tsx`), which opens the post.
- The picker is a Facebook-style pill of six 32 px icons that scale up on
  hover, with the label as tooltip; per-type counts and the chip row are
  gone (the Reactions sheet tabs carry the per-type numbers).
- Relay counts are no longer shown on the row (Instagram shows no numbers
  on icons); they remain in insights.

### Known gaps left

- Wording: the card line says "… reacted" rather than the plan's "Liked
  by …" because Pinkquill's reactions are not likes.
- Insights labels still say "admires" (copy only).
- `saves` on posts has no counter column (nothing displays it).

## Next session

The six phases of the engagement rebuild are complete. Remaining items
from the audit are in each phase's "Known gaps" list above; the go-live
checklist is unchanged (`docs/commissions/03-progress.md`).
