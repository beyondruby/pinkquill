# Engagement system map — reactions, comments, likes, replies, tags

Written 2026-09-07 from the code on `main` (a394ba2) and the live database
(`loaitxbibjftsytlgddi`). Every claim about the database was verified with a
query against production; every claim about the code has a `file:line`.
This document describes what exists. Judgement is in `01-findings.md`.

Reading order: §1 rules → §2 data model → §3 reactions → §4 comments → §5 tags
→ §6 notifications → §7 Takes → §8 freshness → §9 lifecycle → §10 rule
disagreements → §11 file inventory.

---

## 1. Vocabulary and the intended rules

Pinkquill has two content types with their own, separately written,
engagement layers:

| | Posts (feed, `/post/[id]`) | Takes (short video, `/take/[id]`, `/takes`) |
|---|---|---|
| Reactions | `reactions` (+ legacy `admires`) | `take_reactions` (+ unused `take_admires`) |
| Comments | `comments` | `take_comments` |
| Comment likes | `comment_likes` | `take_comment_likes` |
| Tags / mentions | `post_mentions` | `take_mentions` |
| Picker | `components/feed/ReactionPicker.tsx` | `components/takes/TakeReactionPicker.tsx` (fork) |
| Comment row | `components/feed/CommentItem.tsx` | `components/takes/TakeCommentItem.tsx` (fork) + inline copy in `TakeCommentsPanel.tsx` |
| Hook | `lib/hooks/useInteractions.ts`, `lib/hooks/useComments.ts` | `lib/hooks/useTakes.ts` |

Six reaction types, in this order everywhere: `admire` (heart, the default
"like"), `snap`, `ovation`, `support`, `inspired`, `applaud`
(`lib/types/index.ts:204-220`; DB CHECK on `reactions.reaction_type`).

### 1.1 Rules as stated to users (help pages)

- **One reaction per user per post.** "You can change your reaction by
  selecting a different one, or remove it entirely by clicking the heart
  again." (`app/help/interactions/page.tsx:183-187`). Click the heart =
  admire; long-press / right-click = picker (170-175). Takes: double-tap to
  admire (177-181), "same interactions as posts" (`app/help/posting/page.tsx:344-348`).
- **Replies nest under the parent comment**, depth unstated
  (`app/help/interactions/page.tsx:201-205`).
- **Anyone can like a comment** (207-211).
- **Own comments can be deleted; "Post authors can also delete any comments
  on their posts."** (213-222).
- **Deleting a post removes all its comments and reactions**
  (`app/help/posting/page.tsx:305-308`).
- **Tagging:** guidelines only ("Only mention people when it's relevant",
  "Ask permission before tagging someone", `app/community-guidelines/page.tsx:611-617`).
  No technical restriction is described.
- **Blocking:** "they can no longer see your content or contact you"
  (`app/help/privacy-safety/page.tsx:117-120`); guidelines add "They can't
  message you or comment on your work" (`app/community-guidelines/page.tsx:851-856`)
  and promise "Comment controls: Manage who can comment on your posts" (768-770).
- **Notifications:** one "Admire — Someone reacted to your post" type is
  listed (`app/help/interactions/page.tsx:296-305`), plus Comment, Reply,
  Comment like, Relay, Save, Follow; settings page adds "Mentions — When
  someone mentions you" (`app/help/settings/page.tsx:237-245`).

### 1.2 Rules as enforced by the code and database (summary; details below)

| Rule | Database | Post client | Take client |
|---|---|---|---|
| One reaction per user | `UNIQUE (post_id, user_id)` on `reactions` | one-at-a-time by branch selection | **no constraint**; branch selection only |
| Change reaction | **no UPDATE policy** → update affects 0 rows | `.update()` | `.update()` / `.upsert()` |
| Reply depth | unlimited (`parent_id` self-FK) | one level, flattened | one level, flattened |
| Author deletes others' comments | **no policy** (only `user_id = auth.uid()`) | not offered | not offered |
| Comment edit | UPDATE policy exists (`comments`, `take_comments`) | **no UI** | **no UI** |
| Blocked user can react/comment | **allowed** (INSERT policy checks only `user_id`) | not checked | not checked |
| Blocked user's comments visible | **yes** (SELECT `true`) | not filtered | not filtered |
| Comment controls | none | none | none |

The full disagreement list is §10.

---

## 2. Data model (verified live 2026-09-07)

### 2.1 Tables

```
reactions        id, post_id→posts CASCADE, user_id→profiles CASCADE, reaction_type CHECK(6 types), created_at
                 UNIQUE (post_id, user_id)
admires          id, user_id→profiles CASCADE, post_id→posts CASCADE, created_at      -- legacy heart
                 UNIQUE (user_id, post_id)                                             -- 0 rows in prod
comments         id, user_id→profiles CASCADE, post_id→posts CASCADE, parent_id→comments CASCADE, content, created_at, updated_at
comment_likes    id, comment_id→comments CASCADE, user_id→profiles CASCADE, created_at
                 UNIQUE (comment_id, user_id)
post_mentions    id, post_id→posts CASCADE, user_id→profiles CASCADE, created_at
                 UNIQUE (post_id, user_id)
notifications    id, user_id, actor_id, type CHECK(…), post_id→posts CASCADE, take_id→takes CASCADE,
                 comment_id→comments SET NULL, community_id, order_id, reaction_type, content, read, metadata, emailed_at, created_at

take_reactions   id, take_id→takes CASCADE, user_id→auth.users CASCADE, reaction_type (NO CHECK), created_at
                 NO unique constraint                                                  -- 4 duplicate (take,user) pairs in prod
take_comments    id, take_id→takes CASCADE, user_id→profiles CASCADE, parent_id→take_comments CASCADE, content, created_at (no updated_at)
take_comment_likes  PK (comment_id, user_id)
take_admires     exists, unused by the app except the delete route
take_mentions    exists
```

Prod volume today: 30 reactions, 0 admires, 29 comments, 9 comment likes,
0 post mentions, 16 take reactions, 21 reaction notifications (1 with no
matching reaction row), 18 comment/reply/like/mention notifications, deepest
comment thread = 1 level.

### 2.2 Row Level Security (all tables RLS-enabled)

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| reactions | `true` | `user_id = auth.uid()` | **none** | `user_id = auth.uid()` |
| admires | `true` | own | none | own |
| comments | `true` | own | own | own |
| comment_likes | `true` | own | none | own |
| post_mentions | `true` | post author | none | post author |
| notifications | `user_id = auth.uid()` | **`actor_id = auth.uid()`** (any type, any recipient, any post) | own | own |
| take_reactions | `true` | own | own | own |
| take_comments | `true` | own | own | own |
| take_comment_likes | `true` | own | none | own |

Consequences that matter later:

- **Changing a reaction on a post is silently impossible.** `UPDATE reactions
  … WHERE post_id AND user_id` under the `authenticated` role updates 0 rows
  and returns no error (verified with a rolled-back transaction as a real
  user). The client treats "no error" as success.
- Nothing in RLS checks post visibility or blocks for reactions/comments:
  a user can react to or comment on a private/followers-only post, or on a
  post whose author blocked them, if they know the post id.
- No RLS on `reactions`/`admires`/`comments`/`comment_likes`/`post_mentions`
  is tracked in `supabase/migrations/` at all (created via dashboard); the
  `take_*` policies are in `20260329_takes_rls_policies.sql`.

### 2.3 Triggers, functions, realtime

- **No triggers** on reactions, admires, comments, comment_likes,
  post_mentions, take_* tables. No count columns are maintained anywhere;
  every count is computed at read time.
- `notifications` has `notifications_notify` (→ `realtime.send` to
  `user-events:<user_id>`, event `notification_change`) and
  `trg_queue_notification_email` (→ pg_net POST `/api/notifications/email`).
- Functions touching these tables: `get_reaction_counts(p_post_id)` (per-type
  SUM + COUNT over `reactions` only, SECURITY INVOKER),
  `get_total_reactions` (service_role only), `moderate_delete_comment`
  (community moderators; cascades likes/replies; SECURITY DEFINER),
  `create_post_with_relations` (writes `post_mentions`), `get_takes_feed`
  (counts + `user_reaction_type` via `LIMIT 1`), insights RPCs (read only).
- **Realtime publication `supabase_realtime` contains only
  `messages`, `community_chat_messages`, `community_chat_threads`.**
  `reactions` was removed on 2026-09-02
  (`20260902_phase2_realtime_dm_aggregates.sql:253-282`); `comments` and
  `comment_likes` were never in it. The `postgres_changes` subscriptions still
  present in `useReactionCounts`/`useUserReaction` are opt-in and, even when
  opted in, never fire.
- Per-user broadcast events that exist today: `dm_unread_change`,
  `follow_change`, `notification_change`, `order_change`, `order_message`.
  There is no `reaction_change` / `comment_change` event.

### 2.4 Indexes (relevant subset)

`reactions(post_id)`, `(post_id, reaction_type)`, `(user_id)`,
`(user_id, post_id)`, `(reaction_type)`, unique `(post_id, user_id)`;
`comments(post_id, created_at DESC)`, `(parent_id)`, `(user_id)`;
`comment_likes` unique `(comment_id, user_id)`, `(user_id)`;
`take_reactions(take_id)`, `(user_id)` — no composite, no unique.

---

## 3. Post reactions

### 3.1 Source of truth

- **The viewer's own reaction:** the single `reactions` row for
  `(post_id, user_id)`. Loaded in batch per page of posts by
  `fetchUserPostFlags` (`lib/posts/enrich.ts:66-98`) and exposed as
  `post.user_reaction_type`; loaded per post by `useUserReaction`
  (`lib/hooks/useInteractions.ts:381-484`).
- **The count:** three different computations exist and they do not agree
  by construction:
  1. `reactions(count)` embedded aggregate → `post.reactions_count`
     (`enrich.ts:44-48, 154`). Used by every list surface.
  2. `admires(count)` embedded aggregate → `post.admires_count`
     (`enrich.ts:45, 151`), and `getInteractionCount = max(reactions_count,
     admires_count)` (`lib/types/index.ts:884-893`).
  3. RPC `get_reaction_counts` + a separate `admires` HEAD count, folded as
     `admire += max(0, admires − reactions.admire)`
     (`useInteractions.ts:227-260`) → `ReactionCounts` per type + total.
  Because `admires` has 0 rows in prod, (1) and (3) currently agree, but the
  code cannot know that; the legacy heart tile still writes `admires`.

### 3.2 Write paths

All writes are direct PostgREST calls from the browser client with the
user's JWT; there is no RPC, no server route, no transaction.

| Path | File | Table | Logic |
|---|---|---|---|
| `useToggleReaction.react(postId, userId, type, current)` | `useInteractions.ts:100-145` | `reactions` | `current === type` → DELETE; `current` set → **UPDATE** (0 rows, see §2.2); else INSERT |
| `useToggleReaction.removeReaction` | `useInteractions.ts:147-161` | `reactions` | DELETE by (post, user) |
| `useToggleAdmire.toggle` | `useInteractions.ts:11-32` | **`admires`** | insert/delete; caller decides from `user_has_admired` |

The branch is chosen from **client state** (`currentReaction`), never from
the database. If client state is stale (e.g. two tabs, a previous silent
failure, or a card that was rendered with `user_reaction_type: null`) the
client picks the wrong branch: INSERT hits the unique constraint (visible
error), UPDATE does nothing (invisible).

### 3.3 The three interactive surfaces, side by side

Each of these is a separate hand-written handler; there is no shared
"react to post" function above `useToggleReaction`.

| | `PostCard` (feed classic, stream expanded, explore, tag, community, collection) | `PostDetailModal` | `/post/[id]` page |
|---|---|---|---|
| Handler | `components/feed/PostCard.tsx:259-336` | `components/feed/PostDetailModal.tsx:386-440` | `app/post/[id]/page.tsx:478-507` |
| Counts source | seeded from the list row: `initialCounts = {admire: total, others: 0}` (`PostCard.tsx:129-151`, **per-type numbers are fabricated**) | `useReactionCounts` RPC on open (196) | `useReactionCounts` RPC on open (202) |
| Own reaction source | list row `user_reaction_type` via `initialReaction` (152-156) | `useUserReaction` fetch on open (197) | `useUserReaction` fetch on open (203) |
| Optimistic | `setUserReaction` only; total not touched (270-274) | `setUserReaction` only (395-399) | `setUserReaction` only (484-488) |
| Cross-component notify | `notifyUpdate({field:"reactions", countChange})` **before** the DB call (277-283) | `onPostUpdate` **after** the DB call (410-416) | none |
| DB call | `toggleReaction`, result ignored (287) | same (402) | same (491) |
| Notification | only if `!wasReacted && !isSameReaction` (289-292) | if `!isSameReaction` → **also on change** (405-407) | if `!isSameReaction` → **also on change** (494-496) |
| After success | `refetchReactionCounts()` RPC (294-296) | nothing → counts frozen at open values | nothing → counts frozen |
| On error | `catch` reverts + toast (297-301) — **unreachable**, `react()` never throws | none | none |
| Double-click guard | none | none | none |
| Auth | opens auth modal | opens auth modal (also when `post` is null) | picker `disabled={!user}` |

Only `components/feed/useTileActions.ts` (gallery/stream tiles) has an
in-flight guard (`admirePending`, 27/74-75/88) and a working revert, and it
writes the **legacy `admires` table** (`useToggleAdmire`, line 80), not
`reactions`. Its tile ignores `field:"reactions"` bus updates and the card
ignores `countChange` on reactions, so a heart on a tile and a reaction on
the card are two different facts for the same post.

### 3.4 Every surface that shows a reaction number

| Surface | Data hook / query | Number shown | Per-type | Own reaction | Comment count | Freshness after an action |
|---|---|---|---|---|---|---|
| Home feed, classic (`Feed.tsx` → `PostCard`) | `useFeed` (`useFeed.ts:89-184`) + `fetchUserPostFlags` | `stats.reactions ?? stats.admires` (`PostCard.tsx:129-131`) = **R** (`??` means `0` beats a legacy count) | fabricated | flag | `stats.comments` static (585-587) = all rows | own card refetches RPC; list row stale; focus-refetch (30 s, page 0) re-seeds fabricated shape |
| Home feed, stream (`StreamView.tsx`) | same | row: `reactions ?? admires` (118) | n/a | none on row | `stats.comments` (119) | row never updates; expanded card = classic |
| Home feed, gallery (`GalleryView.tsx` + `useTileActions`) | same | **`stats.admires` only** (`useTileActions.ts:25`) = **A** | n/a | `user_has_admired` (24) | not rendered | tile updates itself via bus; ignores reactions |
| Post detail modal | `useReactionCounts` + `useUserReaction` | **RPC** total | real | fetched | `comments.length` = **loaded top-level, ≤30** (685, 1047) | frozen after react; comments local |
| `/post/[id]` page | same (`page.tsx:202-203`); post query has no aggregates (234-267) | **RPC** | real | fetched | `comments.length` ≤30 (1145, 1193) | frozen |
| Profile grid (`StudioProfile.tsx`, `useProfile.ts`) | `useProfile` 141-185 + flags; collaborated posts via `fetchCollaboratedPosts` **without counts or flags** (`hooks.legacy.ts:2338-2355`) | `getInteractionCount` = **MAX(R, A)** (1927, 2027, 2072, 2147, 2310) | none | not shown; modal gets `isAdmired` only | `comments_count \|\| 0` | none |
| Profile header "admires" stat | `useProfile.ts:218-221` | **sum of legacy `admires` only** | | | | |
| Profile relays tab (`useRelays`, `useFeed.ts:455-639`) | own transform 577-580 | MAX | none | **hard-coded null/false** (607-610) | | |
| Explore (`ExplorePageContent.tsx`, `useExplore.ts`) | 348-395 + flags | `reactions_count \|\| admires_count` (308) = **R‖A** | fabricated | flag | static | ranking uses `admires_count` only (452, 477, 501) |
| Saved (`saved/page.tsx`, `useSavedPosts`) | manual flags, **`reactions: new Map()`** (`useFeed.ts:401-406`) | MAX (469) | none | **always null**; modal gets `isAdmired:false, isRelayed:false, relays:0` (224-230) | `comments_count \|\| 0` | none |
| Tag (`tag/page.tsx`, `useTagPosts`) | `useTags.ts:121-288` | `reactions_count \|\| admires_count` (87) | fabricated | flag | static | `handlePostDeleted` no-op (126-128) |
| Community (`community/[slug]/page.tsx`, `useCommunityPosts`) | `hooks.legacy.ts:714-905` (`_agg` aliases) | `reactions_count` (59) | fabricated | flag | static | hot/top sort on `admires_count` (842-849) |
| Collection item page | `useCollections.ts:170-186` **no counts, no flags** | **0 always** (84-92) | 0 | empty heart always | 0 | first click refetches and reveals real numbers |
| Insights per post (`useInsights.ts:519-700`) | `reactions` rows in range (583-588) | `reactions.length`, **excludes admires**, labelled "Admires" (page 234-236) | real | | head count | |
| Insights dashboard | RPC `get_creator_insights_summary` | reactions **+ admires** | | | | |
| Send-to-DM modal | props snapshot from `PostCard` (1238-1243) | snapshot | | | | |

Seven separate `Post → PostProps` transforms produce these rows
(`Feed.tsx:29-73`, `community/[slug]/page.tsx:38-87`,
`ExplorePageContent.tsx:252-322`, `tag/[tag]/page.tsx:35-97`,
`StudioProfile.tsx:1649-1690` and `2385-2417`, `saved/page.tsx:200-232`,
collection item page `60-93`), and the modal's `Post` shape
(`ModalProvider.tsx:34-69`, `PostDetailModal.tsx:89-121`) has no
`reactions`/`reactionType` field at all, so every modal open re-fetches
from scratch.

### 3.5 Cold load / refresh

Every surface is a client component fetching in `useEffect`; nothing
server-renders counts. The modal has no URL of its own: `openPostModal`
pushes `/post/[id]` (`ModalProvider.tsx:150`), so a refresh lands on the
page, which uses different count semantics than the card the user came
from. `/post/[id]` runs `fetchData` twice for logged-in users (deps include
`user`, 471-475) and a cold load is roughly 8-10 requests (post, visibility
checks, comments, RPC counts, admires head count, own reaction, relays
list, save check).

---

## 4. Post comments, likes, replies

### 4.1 Source of truth

- Comments: rows in `comments`; `parent_id` null = top-level.
- Comment count on a post: `comments(count)` embedded aggregate →
  `post.comments_count` (`enrich.ts:47, 152`), which counts **top-level and
  replies together**.
- Like count per comment: `comment_likes(count)` embedded aggregate on the
  top-level page (`useComments.ts:76`), a full `comment_likes` row fetch
  counted in JS for replies (`useComments.ts:200-211`).
- Reply count per top-level comment: `comments!parent_id(count)` aggregate
  (`useComments.ts:77`); replies themselves are hard-coded `replies_count: 0`
  (`useComments.ts:222`).
- Viewer's like state: a second query on `comment_likes` filtered by
  `user_id` and the page's comment ids (`useComments.ts:100-108`).

### 4.2 Loading (`useComments`, `lib/hooks/useComments.ts`)

- Top-level only, newest first, 30 per page, `range()` pagination
  (`54-164`); replies lazy per comment, oldest first, 20 per page
  (`173-247`), stored on the parent's `replies[]`, `hasMoreReplies` flag.
- `AbortController` + `mountedRef` guard against stale responses; `userId`
  read through a ref so auth resolving does not refetch.
- Depth: whatever is stored is flattened to one level at write time — the
  reply composer sends `effectiveParentId = comment.parent_id || comment.id`
  (`components/feed/CommentItem.tsx:100`) and pre-fills `@username` as
  plain text when replying to a reply (`CommentItem.tsx:103-113`).

### 4.3 Mutations

| Action | Where | DB | Local state | Notification |
|---|---|---|---|---|
| Add comment / reply | `useComments.addComment` (`250-346`) | INSERT + `.select().single()` (confirmed, **not optimistic**) | prepend top-level / append to parent's `replies[]`, dedupe by id | reply → `reply` to parent author (`318-327`); top-level → `comment` created by the **caller** (`app/post/[id]/page.tsx:541-543`, `PostDetailModal.tsx:514-516`) without `comment_id` |
| Like / unlike | `useComments.toggleLike` (`349-422`) | INSERT / DELETE `comment_likes` (errors from PostgREST are not thrown, so revert only fires on a thrown exception) | optimistic ±1 + flag, revert in place | like → `comment_like` (`390-399`); unlike → nothing removed |
| Edit | **does not exist** (no UI, no hook function; DB policy allows it) | | | |
| Delete (own) | `useComments.deleteComment` (`425-462`) | three client DELETEs: likes on the comment, child replies, the comment. Likes on child replies are left to the FK cascade | remove from tree, recompute `replies_count = replies.length` (wrong if replies were not loaded) | none removed |
| Delete (community moderator) | `useCommunityModeration.deleteComment` (`lib/hooks.legacy.ts:1560-1581`) | RPC `moderate_delete_comment` | caller refetches | mod chat message |
| Delete (post author, non-mod) | **not possible** (no UI, no policy) | | | |
| Report | `CommentItem.tsx` report flow | `reports` INSERT | | |

Double-submit: `CommentItem` reply form guards with `submitting`
(`CommentItem.tsx:176`); the top-level composer guard depends on the surface
(§3.4). `toggleLike` has no in-flight guard.

---

## 5. Tags / mentions

Two unrelated mechanisms share the word "mention":

**Post-level tags ("Tag people").** Chosen in `PeoplePickerModal`
(`components/ui/PeoplePickerModal.tsx`, `mode="mentions"`, max 50) which
searches `profiles` by username/display name via `useUserSearch`
(`lib/hooks.legacy.ts:2212-2270`) and filters out self and users blocked
either way **on the client**. Persisted by RPC `create_post_with_relations`
(`p_mentions uuid[]`, distinct, self removed, `ON CONFLICT DO NOTHING`; no
block or privacy check) on create, and by a client-side diff on
`post_mentions` on edit (`components/create/CreatePost.tsx:2240-2276`).
Displayed as "with @a, @b, +N" (`components/feed/PostCard/MentionsDisplay.tsx`)
and in `PostTags` on detail views. A `mention` notification is created
client-side only on the **new post** path (`CreatePost.tsx:2293-2303`), not
on edit. Only the author can remove a tag; the tagged person has no
"remove me". Takes write `take_mentions` directly (`CreateTake.tsx:411-422`)
with no notification.

**`@username` inside comment text.** Pure text. The comment composer is a
bare `<input>` with no autocomplete (`app/post/[id]/page.tsx:1207-1215`,
`CommentItem.tsx:392-401`). At render, a regex `/@([a-zA-Z0-9_]+)/g` turns
every match into a link to `/studio/<username>` without checking that the
user exists (`CommentItem.tsx:38-73`, using `dangerouslySetInnerHTML` on the
non-mention segments after a hand-rolled `<`/`>` escape;
`TakeCommentItem.tsx:26-58` uses plain children). Nothing resolves the
username to a user id, nothing checks blocks, and **no notification is ever
sent for a comment or reply mention.**

---

## 6. Notifications for engagement

### 6.1 Creation

Every engagement notification is a browser-side
`supabase.from("notifications").insert()` through `createNotification(userId,
actorId, type, postId?, content?, communityId?, commentId?)`
(`lib/hooks/useNotifications.ts:14-55`). The only guard is
`userId === actorId → skip`. No dedupe, no block check, no preference check,
no existence check of the referenced post/comment, never throws. The DB
columns `reaction_type` and `take_id` are never written by the app; the
reaction is encoded in `type` itself (`admire`, `snap`, …).

| Action | Type | Created at | Recipient | Extra |
|---|---|---|---|---|
| New reaction (PostCard) | `<reactionType>` | `PostCard.tsx:289-292` guarded by `!wasReacted && !isSameReaction` | post author | `post_id` |
| New reaction (post page / modal) | `<reactionType>` | `app/post/[id]/page.tsx:494-496`, `PostDetailModal.tsx:405-407` guarded by `!isSameReaction` only | post author | **fires again on change** |
| Heart on gallery/stream tile | `admire` | `components/feed/useTileActions.ts:81-83` (writes `admires`) | post author | |
| Comment | `comment` | page/modal callers (see §4.3) | post author | **no `comment_id`**, full raw text as `content` |
| Reply | `reply` | `useComments.ts:318-327` | parent comment author only | `comment_id` = **parent** id |
| Comment like | `comment_like` | `useComments.ts:390-399` | comment author | `comment_id` = liked comment |
| Post tag | `mention` | `CreatePost.tsx:2293-2303` (new post only) | tagged user | |
| Un-react / unlike / delete comment / untag | — | nothing is deleted | | |
| Any take reaction/comment/reply/like/mention | — | **never created** | | |
| Take relay | `relay` | `useTakes.ts:763-770` (raw insert) | take author | take id stored in `post_id` → panel links to `/post/<takeId>` |

### 6.2 Delivery

`notifications_notify` trigger → `realtime.send` on `user-events:<user_id>`
→ `UserEventsProvider` → `useNotifications` hydrates the row with a second
select (`useNotifications.ts:176-206`) and `useUnreadCount` applies ±1
deltas (`300-328`) with a 30 s poll-on-focus fallback. Email:
`queue_notification_email` → `/api/notifications/email` with category
preferences (`post_activity` = all reaction types + relay + save, default
OFF; `comments` = comment/reply/comment_like/mention, default ON), read
gate, 20/hour cap, per-post coalescing (`lib/email/preferences.ts`,
`app/api/notifications/email/route.ts`).

### 6.3 Display

`components/notifications/NotificationPanel.tsx`: one row per DB row (no
"X and 3 others"), verb per reaction type (754-873), deep link
`/post/<id>?comment=<comment_id>` only for `reply`/`comment_like`
(891-928). The post page scrolls to `#comment-<id>` after comments load
(`app/post/[id]/page.tsx:204-222`) — only works if the comment is in the
first 30 top-level comments; `PostDetailModal` ignores `?comment=`. Opening
the panel marks everything read (`1116-1119`). A deleted post leaves the row
with a dead link; a deleted comment leaves `comment_id = NULL` and the old
text.

---

## 7. Takes — the parallel copy

Takes re-implement everything above with drift. Facts (all
`lib/hooks/useTakes.ts` unless noted):

- **Five independent write paths to `take_reactions`**: `useTakes.toggleReaction`
  (602-693), `TakeDetailModal.handleReaction` (`components/takes/TakeDetailModal.tsx:229-270`),
  `TakePostCard.handleReaction` (`components/takes/TakePostCard.tsx:145-213`),
  `app/take/[id]/page.tsx:311-352` (**`.upsert()` on a table with no unique
  key = plain INSERT**), plus three `handleRemoveReaction`s. Each chooses
  insert/update/delete from local state; none has an in-flight guard; two
  list hooks hard-code `user_reaction_type: null` (`useRelayedTakes` 1701,
  `useSavedTakes` 1838) so the modal opened from those tabs always INSERTs.
  This is how the 4 duplicate rows in prod were created.
- Counts: feed = RPC `get_takes_feed` (COUNT(*) → duplicates inflate,
  `user_reaction_type` = arbitrary `LIMIT 1` row); modal =
  `useTakeReactionCounts` (own SELECT, never refetched, not updated on
  react); `/take/[id]` = own SELECT + `.maybeSingle()` (errors → null when
  duplicates exist → next click inserts a third row); profile grid =
  `reaction_counts` zero-filled (1570) → shows 0; comments count = RPC
  counts replies, modal/page/panel use `comments.length` (top-level only).
- Comments: `useTakeComments` (922-1171) loads the **whole thread** (no
  pagination) + 3 lookups; add is not optimistic and does a second
  round-trip for the author profile; `toggleLike` reads `comments` from a
  stale closure and its revert re-toggles; PostgREST errors are not thrown so
  reverts are dead; delete does not cascade likes/replies client-side; no
  edit; no confirm on delete; no notifications of any kind.
- Three comment-row UIs: `TakeCommentItem.tsx`, an inline `CommentItem` in
  `TakeCommentsPanel.tsx`, and `TakeComments.tsx` (imported nowhere).
- `TakeReactionPicker.tsx` is a ~90% copy of `ReactionPicker.tsx` with
  divergent semantics: re-selecting the current reaction calls `onReact`
  (no-op / duplicate) instead of remove; `onRemoveReaction` optional and
  omitted by `TakeCard`.
- Types `TakeReactionType`/`TakeReactionCounts` (14-24) duplicate
  `ReactionType`/`ReactionCounts`.
- Cross-surface sync only through `ModalProvider`'s pub/sub
  (`components/providers/ModalProvider.tsx:257-298`); the feed does not
  subscribe; no `comments` field update is ever published.
- `app/api/takes/delete/route.ts` (service role) is the only place that
  deletes engagement notifications (`.eq("post_id", takeId)`).

---

## 8. Freshness architecture (what "realtime" means here)

- Project rule since May 2026: one private broadcast channel per user
  (`user-events:<userId>`), DB triggers fan out targeted events, everything
  else polls on focus (`lib/hooks/usePollOnFocus.ts`). Reactions and
  comments have **no** trigger, **no** event, and **no** poll-on-focus. The
  only cross-user freshness for engagement is a full reload / re-navigation.
- Cross-component (same user, same tab) sync for posts goes through
  `ModalProvider.subscribeToUpdates/notifyUpdate` (`ModalProvider.tsx:257-298`)
  and `useTileActions` (`components/feed/useTileActions.ts`), and through
  `onPostUpdate`-style callbacks documented per surface in §3.4.
- The `postgres_changes` code in `useReactionCounts`/`useUserReaction`
  (`useInteractions.ts:317-372, 437-484`) is dead unless a caller passes
  `disableRealtime: false`, and would still never fire (§2.3).

---

## 9. Lifecycle: deletion, blocking, account deletion

| Event | What happens |
|---|---|
| Post deleted (`app/api/posts/delete/route.ts`) | `posts` row deleted; FK cascades remove reactions, admires, comments (and their likes), post_mentions, **and notifications with that `post_id`** (CASCADE). Matches the help copy. |
| Comment deleted by owner | client deletes likes, then child replies, then the comment (`useComments.ts:430-437`); FK cascade covers the rest; `notifications.comment_id` → NULL, rows stay. |
| Comment deleted by moderator | `moderate_delete_comment` RPC cascades and logs. |
| Take deleted | service route deletes likes, comments, reactions, admires, notifications by `post_id`. |
| User blocks another | `useBlock.blockUser` inserts `blocks` + removes follows both ways (`useInteractions.ts:534-591`). Posts/takes SELECT policies hide content both ways. **Existing reactions/comments by the blocked user remain visible on the blocker's posts and they can keep adding more**; notifications from them still arrive. |
| Tagged user does not exist | Post tags: ids come from the picker so this cannot happen. Comment `@name`: rendered as a link to a 404 profile; no lookup. |
| Account deleted (`app/api/account/route.ts`) | `auth.admin.deleteUser` then `profiles` delete → FK cascades remove reactions, admires, comments, likes, mentions, notifications (as actor and recipient), take_reactions (via auth.users). Counts on other users' posts drop accordingly because counts are computed live. |

---

## 10. Where code, database and UI copy disagree

| # | Topic | Help copy / UI | Code | Database |
|---|---|---|---|---|
| R1 | Change reaction | "select a different one" replaces it | `.update()` and optimistic swap | **UPDATE denied by RLS → 0 rows** |
| R2 | One reaction per user on takes | same as posts | branch by local state, `.upsert()` on page | **no unique constraint; duplicates exist** |
| R3 | Heart button | "click the heart" = admire | Gallery/Stream tiles write `admires`; PostCard writes `reactions` | two tables, two counts, max() at display |
| R4 | Notification "Admire — someone reacted" | one type | six types, one per reaction | CHECK lists six |
| C1 | Nested replies | "indented under the parent" (depth unstated) | flattened to one level, `@name` prefix as text | unlimited depth allowed |
| C2 | Post author deletes any comment | promised | no UI | **no policy** (only own) |
| C3 | Comment editing | not mentioned | no UI (`updated_at` column unused) | allowed |
| C4 | "Comment controls: manage who can comment" | promised in guidelines | none | none |
| B1 | Blocking: "can't comment on your work" | promised | not enforced | not enforced (INSERT checks only `user_id`) |
| B2 | Blocking hides their content | promised for posts | comments/reactions by blocked users still shown | SELECT `true` |
| T1 | Tag anyone | guidelines only | picker filters self + blocks client-side; private accounts taggable; no untag | RPC filters self only |
| T2 | Mention notifications | "Mentions — when someone mentions you" | only on new-post tags; never for comments, replies, edits, or takes | `mention` type exists |
| T3 | Takes "same interactions as posts" | promised | no notifications for take reactions/comments/likes | `take_id` column never used |

---

## 11. File inventory

Post engagement: `lib/hooks/useInteractions.ts` (636), `lib/hooks/useComments.ts` (495),
`lib/posts/enrich.ts` (172), `lib/hooks/useFeed.ts` (639), `lib/hooks/useProfile.ts` (699),
`lib/hooks/useExplore.ts` (631), `lib/hooks/useTags.ts` (292), `lib/hooks.legacy.ts` (`useCommunityPosts` 714-905, `useUserSearch` 2212-2270),
`components/feed/ReactionPicker.tsx` (562), `components/feed/PostCard.tsx` (1409),
`components/feed/PostDetailModal.tsx` (1291), `app/post/[id]/page.tsx` (1332),
`components/feed/CommentItem.tsx` (602), `components/feed/useTileActions.ts` (146),
`components/feed/{Feed,StreamView,GalleryView}.tsx`, `components/providers/ModalProvider.tsx`,
`components/feed/PostCard/{MentionsDisplay,types}.tsx`, `components/feed/PostTags.tsx`,
`components/ui/PeoplePickerModal.tsx`, `components/create/CreatePost.tsx` (mentions 2240-2306).
Takes: `lib/hooks/useTakes.ts` (2074), `components/takes/{TakeReactionPicker,TakeComments,TakeCommentsPanel,TakeCommentItem,TakeDetailModal,TakeCard,TakePostCard,TakesFeed,CreateTake}.tsx`,
`app/take/[id]/page.tsx`, `app/api/takes/delete/route.ts`.
Notifications: `lib/hooks/useNotifications.ts`, `components/notifications/NotificationPanel.tsx`,
`lib/utils/notificationCategories.ts`, `lib/email/{preferences,templates}.ts`, `app/api/notifications/email/route.ts`.
Types: `lib/types/index.ts` (129-220 Post/ReactionType/ReactionCounts, 279-297 Comment, 374-401 Notification, 884-893 getInteractionCount).
Tests: `lib/hooks/__tests__/{useInteractions,useComments,useNotifications}.test.ts`,
`components/feed/__tests__/useTileActions.test.tsx`; no e2e coverage of any engagement action.
SQL: `supabase/migrations/20260203_get_reaction_counts_function.sql`, `20260203_performance_indexes.sql`,
`20260119_notification_comment_id.sql`, `20260207_moderate_delete_rpc.sql`, `20260329_takes_rls_policies.sql`,
`20260429_takes_reels_feed_rpc.sql`, `20260902_phase2_realtime_dm_aggregates.sql`, `20260902_phase6_hardening.sql`.
No migration creates `reactions`, `admires`, `comments`, `comment_likes`, `post_mentions` or their policies.
