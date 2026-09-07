# Engagement fix plan

Companion to `00-system-map.md` and `01-findings.md`. Six phases, one root
cause each, ordered by user impact. Every phase is scoped to finish in one
session, be tested with two accounts, and leave `main` committed and
working. Nothing here has been started.

Design rules for all phases: keep Pinkquill's colours, fonts, tokens and
components exactly as they are (`--color-purple-primary`, `--color-pink-vivid`,
`--color-orange-warm`, `.action-btn`, `.action-count`, `Button`,
`ConfirmationModal`, `actionToast`); Instagram-style social app, no
paper/ink/editorial motifs; no accent-line borders; no uppercase tracked
labels, status dots, or SaaS tiles. Money paths are untouched throughout.

---

## Decisions needed before Phase 1

**D1 — One reaction per user per post (recommended: yes, keep).**
The help copy, the database unique key, the picker and the notification
model all assume one reaction that can be changed or removed. The report
"I react with several different reactions and others don't see them" is
explained by the change-reaction write being silently dropped (RC-1), not by
a missing multi-reaction feature. Instagram and Threads are single-reaction.
If you want stacking reactions (Slack/Discord style) say so now: it changes
the unique key, the picker, the counts and the notification grouping, and
Phase 1 would be scoped differently.

**D2 — Retire the legacy `admires` table (recommended: yes).**
It has 0 rows in production. Phase 1 folds it into `reactions` as
`admire`, points the gallery heart at `reactions`, and drops every
`admires` read. Insights RPCs keep reading it until Phase 5 removes the
column references, then the table is dropped.

**D3 — Reply depth (recommended: keep one level, Instagram-style).**
Replies stay flattened under the top-level comment with a visible
"Replying to @name" target instead of a text prefix. The database keeps
`parent_id` as is.

**D4 — Post authors can delete any comment on their own post
(recommended: yes, as the help page already promises).** Requires a new
DELETE policy and a menu item; Phase 2.

**D5 — Comment editing (recommended: do not add).** Neither Instagram nor
Threads allows editing comments; adding it means edited-badges, history and
notification re-evaluation. If you want it anyway it goes in Phase 6.

---

## Phase 1 — Reactions save, sync, count and display correctly, everywhere

**Root causes:** RC-1 (guessed writes), RC-2 (two tables, six formulas),
RC-3 reaction half (no shared state), RC-10 minimum (poll on focus), RC-9
reaction half. Closes symptoms A-1…A-8, B-1…B-8, B-10, B-13, B-15, A-25.
Nothing cosmetic.

### Database (one migration, `20260907_engagement_phase1_reactions.sql`)

1. `set_post_reaction(p_post_id uuid, p_type text)` and
   `clear_post_reaction(p_post_id uuid)` — SECURITY DEFINER, `search_path`
   pinned, `authenticated` only. Atomic `INSERT … ON CONFLICT (post_id,
   user_id) DO UPDATE SET reaction_type = EXCLUDED.reaction_type,
   created_at = now()` / `DELETE`. Both verify the post is visible to the
   caller (reuse the `posts` SELECT policy by selecting the row as invoker)
   and return one JSON row: `{ mine, counts: {admire…applaud,total},
   changed: true|false }` so the client never has to guess and never has to
   refetch.
2. Same pair for takes (`set_take_reaction`, `clear_take_reaction`) after:
   deduplicating the 4 duplicate `(take_id, user_id)` pairs (keep the newest
   row), adding `UNIQUE (take_id, user_id)`, adding the six-type CHECK, and
   re-pointing `take_reactions.user_id` at `profiles(id)` so it cascades like
   everything else.
3. `get_post_reaction_counts(p_post_ids uuid[])` — batched per-type counts
   for a page of posts (one query, `GROUP BY post_id, reaction_type`), and
   the same for takes. Replaces the single-post RPC + `admires` head count.
   Keep `get_reaction_counts` for one release, then drop in Phase 5.
4. Fold `admires` into `reactions` (`INSERT … SELECT … ON CONFLICT DO
   NOTHING`, 0 rows today), then revoke INSERT/DELETE on `admires` from
   `authenticated` so nothing can write it again. Reads stay until Phase 5.
5. Grant/revoke: direct INSERT/UPDATE/DELETE on `reactions` and
   `take_reactions` stay for this phase (nothing else breaks); Phase 4
   removes them once every writer goes through the RPCs.

### Client — one reaction path

6. `lib/engagement/reactions.ts`: `useReaction(postId | takeId, kind)`
   built on a tab-wide store (`lib/engagement/store.ts`,
   `useSyncExternalStore`, keyed by content id) holding `{ mine, counts,
   commentsCount, pending }`. List hooks seed the store from their rows
   (`reactions_count`, `user_reaction_type`); opening a picker or a post
   fetches per-type counts through the batched RPC; `react(type)` /
   `unreact()` do optimistic `mine` + `counts` updates with a per-id
   `pending` guard, call the RPC, then write the server's answer back
   (which is what makes every surface agree). Errors revert and toast via
   `actionToast.reactionError`. This replaces `useToggleReaction`,
   `useReactionCounts`, `useUserReaction`, `useToggleAdmire`, the
   `ModalProvider` bus for `reactions`/`admires`, and the seven per-surface
   count formulas.
7. Wire every surface to it and delete the local handlers: `PostCard`,
   `PostDetailModal`, `app/post/[id]`, `useTileActions` (gallery/stream
   tiles now show and toggle the real reaction), `StreamView` row,
   `StudioProfile` grid + relays tab, saved, explore, tag, community,
   collection item page (fetch its counts and flags like everyone else),
   `SendToDMModal` props. `getInteractionCount` becomes
   `reactions_count` only; `Feed/Explore/Tag/Community/Profile/Saved/Collection`
   transforms stop computing totals.
8. Takes: `useTakes.toggleReaction`, `TakeDetailModal`, `TakePostCard`,
   `app/take/[id]` all call the same `useReaction(id, "take")`;
   `useUserTakes`/`useRelayedTakes`/`useSavedTakes` seed real values
   instead of zeros/nulls; `TakeReactionPicker` is deleted and
   `ReactionPicker` gains the `compact`/overlay variants it needs
   (pure prop, same styles). `TakeReactionType`/`TakeReactionCounts` go.
9. Freshness: the modal and the post/take page call `usePollOnFocus` to
   re-pull counts + own reaction (10 s throttle, project standard). This is
   the minimum "other users see it" path; live events are Phase 5.
10. Notifications in this phase: keep the existing client `createNotification`
    call but fire it only when the RPC reports `changed` and `mine` went from
    null to a value, so react/unreact/react and change-reaction stop
    duplicating (A-18, A-19). Full reconciliation is Phase 3.
11. Remove dead code that would otherwise mislead: the `postgres_changes`
    branches, `useToggleAdmire` import in `PostCard`, `get_total_reactions`.

### Tests and verification

- Unit: `useReaction` (optimistic + pending + revert + server write-back),
  `enrichPost` seeding, RPC contract test via the Supabase client in
  `lib/hooks/__tests__`.
- Two-account test script (both in `03-progress.md`): account A reacts
  `admire` → changes to `snap` → removes → reacts `applaud` on a post;
  account B sees the same total and type on feed card, gallery tile, stream
  row, modal, `/post/[id]`, profile grid, explore, saved, tag, community,
  collection page after focus; reload on both sides matches; double-click
  leaves exactly one row; repeat once on a take from the feed, the modal
  opened from the relays tab, and `/take/[id]`; production `take_reactions`
  has no duplicate pairs.
- Commit: `fix(engagement): one atomic reaction path for posts and takes`.

---

## Phase 2 — Comments, likes and replies count and behave correctly

**Root causes:** RC-4, RC-5, RC-3 comment half, RC-9 comment half.
Closes A-10…A-17, B-9, B-12, B-16, C-3, C-7, E-9 (optimistic add is
correctness here: the typed text must not be lost).

1. **One count.** `commentsCount` in the engagement store = `comments(count)`
   over all rows, seeded by every list, incremented/decremented by
   add/delete (including replies), shown identically on cards, modal, page,
   take cards, take modal, take page, take panel.
2. **Pagination wired.** Modal and page render "Load more comments" from
   `hasMore`/`loadMore`; `CommentItem` renders "View more replies" from
   `hasMoreReplies`; reply like counts come from the `comment_likes(count)`
   aggregate instead of fetching rows. Deep links (`?comment=`) fetch the
   target comment's page/parent first, in both modal and page.
3. **Atomic mutations.** `delete_comment(p_comment_id)` RPC (owner, post
   author per D4, or community moderator via the existing permission
   check) deletes likes/replies/comment in one transaction and returns the
   new count. `toggleLike` checks the returned error, keeps the notification
   lookup outside the revert scope, and has a per-comment pending guard.
   `addComment` inserts an optimistic row (temp `crypto.randomUUID()`),
   replaces it on success, restores the text on failure. Comment length
   capped (2,200 chars, Instagram parity) client + `CHECK`.
4. **Takes share it.** `useTakeComments` is replaced by `useComments(id,
   "take")`; `TakeCommentItem`, the inline item in `TakeCommentsPanel` and
   the dead `TakeComments.tsx` collapse onto `CommentItem` (kind-aware).
   `TakeCommentsPanel` becomes a thin shell. Take comment delete gets the
   same confirm.
5. **Reply target** (D3): replies to replies keep `parent_id = top-level`
   and store the replied-to user in a new `comments.reply_to_user_id`
   column so the UI can show "Replying to @name" and notify the right person
   (used by Phase 3). No text prefix.
6. Post-author delete policy + menu item (D4). `CommentItem` report includes
   the comment id; the always-true menu guard is removed.

Two-account test: A comments, replies, likes, deletes on a post and a take;
B sees counts and threads match on every surface, including after "Load
more"; a 35-comment post shows all of them; deleting a parent removes its
replies and likes for both; author deletes B's comment.
Commit: `fix(engagement): one comment model with real counts and paging`.

---

## Phase 3 — Notifications reflect the action, exactly once, with the right link

**Root cause:** RC-6 correctness half, RC-8 notify half, RC-9 notification
half. Closes A-18…A-23, E-15, E-16.

1. Move creation into the database: `AFTER INSERT/UPDATE/DELETE` triggers
   on `reactions`, `take_reactions`, `comments`, `take_comments`,
   `comment_likes`, `take_comment_likes`, `post_mentions`, `take_mentions`.
   Insert on action (skip self, skip blocked-either-way, skip muted
   category), **update in place** on reaction change (one row per
   `(actor, post, type-family)`), **delete** on undo/comment delete. Set
   `reaction_type`, `take_id`, `comment_id` correctly (`comment_id` = the
   new comment for `comment`/`reply`; `reply_to_user_id` gets the `reply`;
   the post author gets `comment` for a reply on their post).
2. Comment `@mentions`: the comments trigger resolves `@username` tokens
   against `profiles`, writes `comment_mentions(comment_id, user_id)`,
   notifies `mention` (blocks/privacy respected), and the client renders
   links only for resolved rows. Post-edit tagging and take tagging notify
   through the `post_mentions`/`take_mentions` triggers.
3. Remove every client `createNotification` call for engagement (posts,
   takes, tiles, tags); keep the helper for community/collaboration until
   Phase 4 moves those too.
4. Panel: `getNotificationLink` handles `take_id`; deep links resolve via
   Phase 2's fetch-target path; server-side grouping view
   (`notifications_grouped`) collapses same `(post, type-family)` rows into
   "A, B and 3 others reacted" for the list (display only; rows stay
   separate for read state). Email copy reads `reaction_type`.
5. Backfill: delete the orphaned reaction notification(s) that have no
   matching row; rewrite take-relay rows' `post_id` into `take_id`.

Two-account test: for each action and its undo, B's panel and unread badge
show exactly one row that appears and disappears; change reaction updates
the verb in place; reply deep-links to the reply; mention in a comment
notifies C; a take reaction notifies; email preview route renders each.
Commit: `fix(notifications): engagement notifications created and reconciled in the database`.

---

## Phase 4 — Security: only allowed actions, only visible content, no forgery

**Root causes:** RC-7, RC-6 policy half. Closes D-1…D-7.

1. `notifications`: drop the client INSERT policy. Community role/mute/ban,
   mod warnings and collaboration notifications move into their existing
   RPCs or new small ones; the email route and webhooks already use the
   service role.
2. `reactions`, `take_reactions`: revoke direct INSERT/UPDATE/DELETE from
   `authenticated` (all writers use Phase 1 RPCs). `comments`,
   `comment_likes`, `take_*`: INSERT policies gain `can_engage(post_id)` —
   post visible to the caller under its SELECT policy **and** no block
   either way; SELECT policies hide rows whose author is blocked
   either-way with the viewer (same shape as `posts_select_policy`).
   Anonymous SELECT on reactions/comments restricted to posts that are
   public.
3. `post_mentions`/`take_mentions`: RPCs reject blocked and private-account
   targets server-side; tagged users get "Remove me from this post"
   (`remove_self_mention` RPC, deletes the row and the notification).
4. Rate limits in the RPCs (per user: 60 reactions/min, 20 comments/min,
   10 mentions/comment) using the existing `api_rate_limits` table; comment
   content length `CHECK`; `content` for notifications capped at 280.
5. Blocking cascades: `block_user` RPC (replaces `useBlock.blockUser`'s
   three client calls) removes follows, deletes the blocked user's
   reactions/likes on the blocker's content, deletes pending
   notifications between them.

Two-account test: B blocked by A cannot react/comment on A's post (error
toast, no row), A no longer sees B's old comments, B cannot tag A; a
hand-crafted insert to `notifications` from the browser console is
rejected; a private post id cannot be commented on; spam loop is throttled.
`get_advisors(security)` clean for these tables.
Commit: `fix(security): engagement RLS, RPC-only writes, block enforcement`.

---

## Phase 5 — Load, concurrency and live freshness

**Root causes:** RC-11, RC-10 remainder, RC-13. Closes C-1…C-10, A-26.

1. Counter columns maintained by trigger: `posts.reactions_count`,
   `posts.comments_count`, `takes.*` (and per-type `reaction_counts jsonb`
   or a `post_reaction_counts` side table), updated in the Phase 3
   triggers; list selects read the columns instead of four correlated
   `count(*)`; the batched RPC becomes a plain select. Backfill + a nightly
   reconciliation job (`pg_cron`, already used for payouts) that repairs
   drift.
2. Freshness: reuse the per-user broadcast channel — the post/take you
   have open subscribes to `content-events:<id>` (one channel per open
   post, torn down on close) fed by a trigger that sends
   `{counts, comment_id, op}` deltas; feed cards keep poll-on-focus. Cap at
   one content channel per tab.
3. `ModalProvider`: subscribers in a ref, stable `notifyUpdate`, context
   value memoised; remaining bus fields (saves/relays) unchanged.
4. `/post/[id]`: single `fetchData` (drop the `user` dependency by
   deriving auth-dependent checks from the RLS result), single request for
   post + counts + own flags; modal open = one RPC.
5. Drop `admires` table, `get_reaction_counts`, `get_total_reactions`,
   dead tests/types; delete unused indexes flagged by the advisor after
   checking `pg_stat_user_indexes` post-change.
6. Load test: script inserting 10k reactions + 2k comments on one post from
   200 simulated users (service role, staging branch); feed p95 and post
   open p95 recorded before/after in `03-progress.md`.

Commit: `perf(engagement): counter columns, live content events, single-fetch post page`.

---

## Phase 6 — UI/UX to Instagram/Threads standard, same design system

**Root cause:** RC-12 (+ RC-8 autocomplete). Closes E-1…E-16.

Reactions
- Long-press (touch) and right-click open the picker; tap toggles the
  default; bottom-sheet on mobile using the existing `.reaction-picker-dropdown`
  mobile styles; press animation on the count using the existing `pop`
  keyframe; haptic on supported devices.
- Card summary: top-3 reaction icons + "Liked by **name** and 12 others";
  tapping opens a "Reactions" sheet listing people grouped by type (new
  `ReactionsSheet`, built from `Modal`/sheet primitives already in
  `components/ui`), with follow buttons.
- Same picker component everywhere (posts, takes, tiles), one set of icons.

Comments
- Composer: auto-growing textarea, sticky at the bottom of modal/page and
  the take panel, 2,200 counter appearing at 2,000, Enter sends /
  Shift+Enter newline / IME-safe, emoji button, "Replying to @name ×" chip,
  `@` autocomplete (people you follow first, then search; reuses
  `useUserSearch`; blocked/private excluded) and `#` autocomplete.
- Thread: "View 12 replies" / "Hide replies" / "View more replies", reply
  target rendered as a link, like button with pop animation and count,
  optimistic add with a subtle "posting…" state and retry on failure,
  skeleton rows while loading, empty state with an invitation.
- Owner/author menu: delete (confirm), copy link, report with the comment
  id; edit only if D5 is reversed.

Notifications
- Grouped rows with stacked avatars ("A, B and 3 others reacted ❤️👏"),
  reaction icon per row, take thumbnails, "Comment" and "Reply" rows with
  a "Reply" quick action that opens the composer with the target chip.

Mobile pass on every surface above at 360 px and 390 px widths.
Two-account test: full flow on iPhone-width Chrome emulation and desktop.
Commit: `feat(engagement): reaction sheet, composer, threads, grouped notifications`.

---

## Session protocol (every phase)

1. Read `00`, `01`, this file, and `03-progress.md`.
2. Branch `fix/engagement-phase-N`; migration first, applied to prod with
   `apply_migration` only after the plan for that phase is approved; then
   client.
3. `npm run lint && npm run test` green; `npm run build` green.
4. Two-account manual test as listed; screenshots of both sides.
5. Update `03-progress.md`: what changed (files, migration names), what was
   tested (both accounts), what is next, any decision taken. Commit and
   merge to `main`.
