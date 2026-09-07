# Engagement audit — findings

Audited 2026-09-07 against `00-system-map.md`. Findings are grouped by root
cause, not by screen. Each root cause lists the symptoms it produces, why it
matters, severity, and every file it touches. Severity: **Critical** = data
is wrong or lost for users today; **High** = users see wrong/inconsistent
state or abuse is possible; **Medium** = degraded behaviour, fragile code;
**Low** = hygiene.

Symptom labels (A-x correctness, B-x consistency, C-x load, D-x security,
E-x UX) are used by `02-plan.md`.

---

## RC-1 — Reactions are written by guessing from client state, and "no error" is treated as success — **Critical**

**What.** There is no atomic "set my reaction" operation. Every reaction
write is a browser-side `insert` / `update` / `delete` chosen from whatever
the component currently believes the user's reaction is
(`lib/hooks/useInteractions.ts:100-145`). Three post surfaces and four take
surfaces each re-implement that choice. The database cannot correct a wrong
guess: on posts, the `reactions` table has **no UPDATE policy**, so the
"change reaction" branch updates 0 rows and returns success (verified
against production as a real user); on takes, `take_reactions` has **no
unique constraint**, so a wrong INSERT or the page's `.upsert()` simply adds
a second row. `react()` swallows every error and returns `{success:false}`
that no caller reads; two of three post surfaces have no `try` at all.

**This is the known bug.** Sequence for the reporter: react with `admire`
(insert, fine) → pick `snap` → client shows snap, DB still says admire →
other users, and the reporter after reload, see admire. On the collection
page or any list that renders `user_reaction_type: null` (saved page,
relays tab, collaborated posts) the same click INSERTs into a unique
constraint, fails silently, and the UI shows the reaction anyway. On takes
each such click adds a row; production already holds 4 duplicate
(take, user) pairs.

**Symptoms.**
- A-1 Changing a reaction on a post never persists (`useInteractions.ts:118-127`; no UPDATE policy).
- A-2 Reacting from a surface with stale/null own-reaction inserts into the unique key, fails silently, UI lies (`PostCard.tsx:259-302`; seeds from `saved/page.tsx:228`, `useFeed.ts:405, 607-610`, `hooks.legacy.ts:2345`, collection page 84-92).
- A-3 Takes: duplicate reaction rows (`app/take/[id]/page.tsx:346-350` upsert-as-insert; `useTakes.ts:1701, 1838` null seeds; `TakeDetailModal.tsx:251-256`).
- A-4 Takes: `.maybeSingle()` errors once duplicates exist → own reaction null → third row (`app/take/[id]/page.tsx:276`).
- A-5 Double-click: no in-flight guard on any post/take reaction handler; two clicks race an insert against a delete (`PostCard.tsx:259-336`, `PostDetailModal.tsx:386-440`, `page.tsx:478-507`, `useTakes.ts:602-693`, `TakePostCard.tsx:145-246`).
- A-6 Error path is dead: `catch` in `PostCard.tsx:297-301` cannot run; modal/page/take handlers have none → on failure the optimistic state sticks, and the notification is still sent (`PostCard.tsx:290-292`, `PostDetailModal.tsx:405-407`, `page.tsx:494-496`).
- A-7 Take handlers publish `onTakeUpdate`/`notifyTakeUpdate` even when the write failed (`TakeDetailModal.tsx:263-269`, `TakePostCard.tsx:180-186`).
- A-8 `TakeReactionPicker` re-selecting the current reaction calls `onReact(sameType)` → the "same type" branch deletes on some surfaces and no-ops on others (`TakeReactionPicker.tsx:243, 318`; `TakeCard.tsx:425-429` omits `onRemoveReaction`).

**Why it matters.** The core action of the app is not reliably saved. Every
other count and notification is downstream of this row.

**Files.** `lib/hooks/useInteractions.ts`, `components/feed/PostCard.tsx`,
`components/feed/PostDetailModal.tsx`, `app/post/[id]/page.tsx`,
`components/feed/ReactionPicker.tsx`, `lib/hooks/useTakes.ts`,
`components/takes/{TakeDetailModal,TakePostCard,TakeCard,TakeReactionPicker}.tsx`,
`app/take/[id]/page.tsx`, DB: `reactions` policies, `take_reactions`
constraints (no tracked migration creates either).

---

## RC-2 — Two reaction tables and six formulas for "how many reactions" — **High**

**What.** The legacy heart (`admires`) and the multi-reaction table
(`reactions`) are both live write targets: gallery/stream tiles write
`admires` (`components/feed/useTileActions.ts:80` via `useToggleAdmire`),
everything else writes `reactions`. Nothing migrated one into the other;
instead each reader invented its own merge:

| Formula | Where |
|---|---|
| `reactions ?? admires` (0 beats a legacy count) | `PostCard.tsx:129-131`, `StreamView.tsx:118` |
| `reactions \|\| admires` | `ExplorePageContent.tsx:308`, `tag/[tag]/page.tsx:87` |
| `max(reactions, admires)` | `lib/types/index.ts:884-893` → profile grid, saved, relays |
| `admires` only | `useTileActions.ts:25`, profile header `useProfile.ts:218-221`, explore ranking `useExplore.ts:452,477,501`, community hot/top `hooks.legacy.ts:842-849` |
| RPC + `max(0, admires − admire_reactions)` fold | `useInteractions.ts:236-263` |
| `reactions.length`, labelled "Admires" | `useInsights.ts:583-632`, `app/insights/content/post/[id]/page.tsx:234-236` |

On top of that, list rows carry only a total, so `PostCard.tsx:133-144`
**fabricates** per-type counts (everything in `admire`, other types 0) and
the picker renders them as real numbers and in `aria-label`s.

**Symptoms.**
- B-1 The same post shows different totals on feed, explore, profile, saved, insights.
- B-2 Picker per-type counts in every list surface are invented until the viewer reacts.
- B-3 A gallery heart and a card reaction are two different facts: tile ignores `field:"reactions"`, card ignores `countChange` (`useTileActions.ts:38-43`, `PostCard.tsx:220-223`); a user who hearts a tile then opens the modal sees an empty heart and can react again → counted twice by the fold.
- B-4 Profile "admires" stat, explore ranking and community hot sort ignore reactions entirely.
- B-5 Insights per-post excludes admires while the dashboard includes them.

**Why it matters.** Users compare numbers across screens; creators watch
them. Every mismatch reads as "the app is broken".

**Files.** `lib/posts/enrich.ts`, `lib/types/index.ts`,
`lib/hooks/useInteractions.ts`, `components/feed/{PostCard,StreamView,useTileActions,GalleryView}.tsx`,
`components/explore/ExplorePageContent.tsx`, `lib/hooks/useExplore.ts`,
`app/tag/[tag]/page.tsx`, `lib/hooks.legacy.ts` (`useCommunityPosts`),
`lib/hooks/useProfile.ts`, `components/studio/StudioProfile.tsx`,
`app/(feed)/saved/page.tsx`, `lib/hooks/useInsights.ts`,
`app/insights/content/post/[id]/page.tsx`, DB: `admires` table,
`get_reaction_counts`.

---

## RC-3 — No shared per-post state; each surface owns a private copy and a private transform — **High**

**What.** Seven `Post → card props` transforms (`Feed.tsx:29-73`,
`community/[slug]/page.tsx:38-87`, `ExplorePageContent.tsx:252-322`,
`tag/[tag]/page.tsx:35-97`, `StudioProfile.tsx:1649-1690, 2385-2417`,
`saved/page.tsx:200-232`, collection item page 60-93), two modal `Post`
shapes without a `reactionType`/`reactions` field
(`ModalProvider.tsx:34-69`, `PostDetailModal.tsx:89-121`), and a partial
pub/sub bus (`ModalProvider.tsx:215-240`) that ignores reaction
`countChange` and never receives a `comments` event. After any action, only
the component that performed it knows.

**Symptoms.**
- B-6 Modal and page never refresh reaction counts after reacting; picker totals are frozen at open (`PostDetailModal.tsx:386-440`, `page.tsx:478-507`).
- B-7 Card total does not move when the modal reacts; stream row never moves (`PostCard.tsx:220-223`, `StreamView.tsx:118`).
- B-8 The feed's 30 s focus-refetch re-seeds the fabricated per-type shape over the RPC-refetched counts (`useFeed.ts:264-285` → `useInteractions.ts:280-292`).
- B-9 Comment count on cards never changes after commenting (no emitter of `field:"comments"`; `PostCard.tsx:585-587`).
- B-10 Saved page passes `isAdmired:false, isRelayed:false, relays:0` into the modal (`saved/page.tsx:224-230`); relays tab and collaborated posts hard-code flags; collection page shows 0/0/0 always.
- B-11 `notifyUpdate` identity churns on every card mount (`ModalProvider.tsx:131, 240`) → every card re-renders and rebuilds handlers on every subscription change.
- A-9 Deleted posts stay on the tag page (`tag/[tag]/page.tsx:126-128` no-op).

**Why it matters.** Users open a post from a card, react, close it, and see
the card disagree with what they just did. Every future feature would have
to be wired seven times.

**Files.** as listed above plus `components/providers/ModalProvider.tsx`,
`components/feed/PostCard/types.ts`, `lib/hooks/useFeed.ts`
(`useSavedPosts`, `useRelays`), `lib/hooks/useCollections.ts`,
`lib/hooks.legacy.ts` (`fetchCollaboratedPosts`).

---

## RC-4 — "Comment count" has two meanings and threads are silently truncated — **High**

**What.** Cards show `comments(count)` over all rows including replies
(`enrich.ts:47, 152`). Modal and page show `comments.length` = loaded
top-level comments, capped at 30 because `loadMore`/`hasMore` are never
destructured (`PostDetailModal.tsx:190, 685, 1047`; `page.tsx:198, 1145,
1193`; `useComments.ts:14, 86`). `fetchReplies` sets `hasMoreReplies` but
nothing renders it (`useComments.ts:234`; `CommentItem.tsx`). Takes count
top-level only in three places and all rows in the RPC (`TakeDetailModal.tsx:438,564`,
`app/take/[id]/page.tsx:713,761`, `TakeCommentsPanel.tsx:411` vs
`get_takes_feed`).

**Symptoms.**
- B-12 Card says 41 comments, modal says 27.
- A-10 A post with more than 30 top-level comments can never show the rest; a comment with more than 20 replies never shows the rest.
- A-11 Replying does not change the modal/page counter; the card's count (which includes replies) is stale in the other direction.
- A-12 Deep links to a comment beyond the first page or to a reply silently do nothing (`page.tsx:204-222`); the modal ignores `?comment=` entirely.

**Files.** `lib/hooks/useComments.ts`, `components/feed/PostDetailModal.tsx`,
`app/post/[id]/page.tsx`, `components/feed/CommentItem.tsx`,
`lib/hooks/useTakes.ts` (`useTakeComments`), `components/takes/{TakeDetailModal,TakeCommentsPanel}.tsx`,
`app/take/[id]/page.tsx`.

---

## RC-5 — Comment mutations are non-atomic and ignore database errors — **Medium**

**What.**
- `toggleLike` never inspects the returned `error`; revert only runs on a thrown JS error (`useComments.ts:372-381, 402-423`). The notification lookup sits inside the same `try`, so a failed lookup reverts a like that did persist (`377-421`).
- `deleteComment` issues three sequential client deletes and only warns on partial failure (`430-437`); likes on child replies rely on the FK cascade; local state recomputes `replies_count = replies.length`, zeroing it for parents whose replies were never loaded (`445-450`).
- `addComment` is confirmed-only (no optimistic row) and the top-level `comment` notification is the caller's job, done twice differently (`page.tsx:541-543`, `PostDetailModal.tsx:514-516`).
- No comment edit exists anywhere (DB allows it, `updated_at` unused).
- Post authors cannot delete comments on their own post (help promises it; no policy, no UI).
- Comment `<input>`s have no length limit and submit on bare Enter with no IME-composition guard (`PostDetailModal.tsx:1180-1184`, `page.tsx:1206-1210`, `CommentItem.tsx:392-396`).
- Takes: `useTakeComments.toggleLike` reads a stale closure, its revert re-toggles (`useTakes.ts:1076-1103`); delete does not cascade client-side and has no confirm (`1124`; `TakeCommentItem.tsx:157-161`); reply submit can double-post (`TakeCommentItem.tsx:142-155`); a reply to a non-top-level parent is dropped from state (`useTakes.ts:1043-1047`).
- `CommentItem` report omits the comment id (`CommentItem.tsx:152-157`); menu guard `(isOwner || !isOwner)` is always true (274).

**Symptoms.** A-13 failed like stays lit; A-14 half-deleted comment leaves orphan likes and a wrong reply count; A-15 owner cannot moderate their own post; A-16 no edit; A-17 take comments double-post / vanish.

**Files.** `lib/hooks/useComments.ts`, `components/feed/CommentItem.tsx`,
`components/feed/PostDetailModal.tsx`, `app/post/[id]/page.tsx`,
`lib/hooks/useTakes.ts`, `components/takes/{TakeCommentItem,TakeCommentsPanel,TakeComments}.tsx`,
DB: `comments` DELETE policy.

---

## RC-6 — Notifications are unguarded client-side inserts, never reconciled with the action — **High** (security part: **Critical**)

**What.** `createNotification` (`lib/hooks/useNotifications.ts:14-55`) is a
raw insert with one guard (`userId === actorId`). RLS allows any
authenticated user to insert any `type` for any `user_id`, `post_id`,
`content`. Nothing deletes a notification when the action is undone, and
each surface decides differently when to send one.

**Symptoms.**
- A-18 React → un-react → react = two notifications; like → unlike → like = two (`PostCard.tsx:289-292`, `useComments.ts:390-399`).
- A-19 Changing a reaction on the modal/page sends a second notification of the new type; on the card it sends none (`PostDetailModal.tsx:405-407`, `page.tsx:494-496` vs `PostCard.tsx:290`). Production already holds a reaction notification with no matching reaction row.
- A-20 `comment` notifications carry no `comment_id` → no deep link (`page.tsx:541-543`, `PostDetailModal.tsx:514-516`); `reply` notifications carry the **parent's** id → link scrolls to the recipient's own comment (`useComments.ts:326`); post authors are not told about replies on their post.
- A-21 Takes: **no notification at all** for reactions, comments, replies, comment likes, mentions; take relay stores the take id in `post_id` → panel links to `/post/<takeId>` (404) (`useTakes.ts:763-770`, `NotificationPanel.tsx:924-926`).
- A-22 Tagging on post **edit** sends no notification (`CreatePost.tsx:2240-2276` vs `2293-2303`); take tags never notify (`CreateTake.tsx:411-422`); comment/reply `@mentions` never notify (§RC-8).
- A-23 Notifications are sent before/without checking that the write succeeded (RC-1 A-6).
- D-1 **Forgery/spam/email abuse:** any logged-in user can insert e.g. `type='comment', content='<anything>'` or `type='order_refunded'` to any user; it pops live via the broadcast trigger and queues an email through `queue_notification_email` (`supabase/migrations/20260904_email_sitewide.sql`, `app/api/notifications/email/route.ts`). The hourly email cap (20) is the only limit; in-app rows are unlimited.
- D-2 Blocked users can notify their blockers (no block check anywhere in the notification path).
- E-1 No grouping ("X and 3 others"), so reaction noise pushes real items out of the 50-row window (`NotificationPanel.tsx:1238-1245`, `useNotifications.ts:111`).
- Low: `notifications.reaction_type` and `take_id` columns are never written; `comment` content is the full raw comment with no cap.

**Why it matters.** Notifications are how creators learn about engagement;
duplicates, orphans and 404 links erode trust, and the insert policy is an
open door for harassment.

**Files.** `lib/hooks/useNotifications.ts`, `components/feed/{PostCard,PostDetailModal,useTileActions}.tsx`,
`app/post/[id]/page.tsx`, `lib/hooks/useComments.ts`, `lib/hooks/useTakes.ts`,
`components/create/CreatePost.tsx`, `components/takes/CreateTake.tsx`,
`components/notifications/NotificationPanel.tsx`, `app/api/notifications/email/route.ts`,
`lib/email/{preferences,templates}.ts`, DB: `notifications` INSERT policy, no triggers on engagement tables.

---

## RC-7 — Engagement writes and reads ignore post visibility and blocks — **High** (security)

**What.** `reactions`, `comments`, `comment_likes`, `take_*` INSERT policies
check only `user_id = auth.uid()`; SELECT is `true`. Posts and takes hide
blocked/private content in their own SELECT policies
(`20260902_phase6_hardening.sql:32-75`), but nothing stops a user who knows
a post id from reacting to or commenting on a private, followers-only, or
blocked author's post, and nothing hides a blocked user's existing comments
or reactions from the author. The help copy promises "they can't comment on
your work" and "comment controls"; neither exists. `useBlock.blockUser`
only removes follows (`useInteractions.ts:534-591`).

**Symptoms.**
- D-3 Comment on a private post by id.
- D-4 Blocked user keeps reacting/commenting on the blocker's posts; their comments remain visible to the blocker and to everyone.
- D-5 No rate limit on any engagement insert (the `api_rate_limits` machinery exists only for API routes) → comment/reaction spam at PostgREST speed.
- D-6 `reactions`/`comments` readable by `anon` for any post id, including posts the reader could not see (counts leak existence of private posts).
- D-7 Post-level tagging: private accounts can be tagged and listed publicly "with @user"; no untag; block filter is client-only (`hooks.legacy.ts:2247-2264`; RPC `create_post_with_relations` filters self only).

**Files.** DB policies for `reactions`, `comments`, `comment_likes`,
`post_mentions`, `take_reactions`, `take_comments`, `take_comment_likes`;
`lib/hooks/useInteractions.ts` (`useBlock`), `lib/hooks/useComments.ts`,
`components/feed/CommentItem.tsx` (block action), `components/ui/PeoplePickerModal.tsx`,
`lib/hooks.legacy.ts` (`useUserSearch`), `create_post_with_relations`.

---

## RC-8 — "Mention" means two unrelated things, and the comment one is cosmetic — **Medium**

**What.** Post tags are a picker + `post_mentions` rows + (sometimes) a
notification. Comment `@username` is plain text linkified at render by a
regex with no word boundary (`CommentItem.tsx:38-73`,
`TakeCommentItem.tsx:26-58`), never resolved to a user, never notified,
never checked against blocks/privacy/existence. There is no autocomplete in
any comment composer. `CommentItem` renders the non-mention text through
`dangerouslySetInnerHTML` after a hand-rolled `<`/`>` escape (`33-35, 50,
69, 72`) — not exploitable today, but the wrong tool. Reply-to-reply
pre-fills `@name` as text and notifies the top-level author instead
(`CommentItem.tsx:100-113`, `useComments.ts:318-327`).

**Symptoms.** E-2 no autocomplete; A-24 `@name` links to 404 profiles and
`a@b.com` becomes `@b`; A-22 no mention notifications for comments; D-7
tagging privacy (RC-7).

**Files.** `components/feed/CommentItem.tsx`, `components/takes/{TakeCommentItem,TakeCommentsPanel}.tsx`,
`lib/hooks/useComments.ts`, `lib/utils/sanitize.ts` (no mention support),
`components/create/CreatePost.tsx`, `components/takes/CreateTake.tsx`,
`components/ui/PeoplePickerModal.tsx`, DB: no comment-mention storage.

---

## RC-9 — Takes are a drifted fork of the post engagement code — **High**

**What.** `useTakes.ts` re-implements reactions, counts, comments, likes and
the picker (`TakeReactionPicker.tsx` ~90% copy of `ReactionPicker.tsx`;
`TakeCommentItem.tsx` + an inline `CommentItem` in `TakeCommentsPanel.tsx`
+ dead `TakeComments.tsx`; duplicate `TakeReactionType`/`TakeReactionCounts`
types at `useTakes.ts:14-24`). Each copy fixed or broke different things.
Beyond RC-1/RC-4/RC-5/RC-6 symptoms already listed:

- B-13 Profile take grid shows 0 reactions for every take (`useTakes.ts:1570` zero-fills `reaction_counts`; `TakePostCard.tsx:56-66, 427`); relays tab omits `reaction_counts` (1688-1704).
- B-14 `saves_count` from `get_takes_feed` is the viewer's own 0/1 because the RPC is SECURITY INVOKER and `take_saves` SELECT is owner-only.
- B-15 Modal reaction counts are fetched once and never updated, even by the viewer's own reaction (`TakeDetailModal.tsx:72, 549-556`).
- C-1 Take comments load the entire thread with no pagination plus a full `take_comment_likes` row fetch (`useTakes.ts:927-996`); `addComment` does a second round-trip for the author profile (1025-1029).
- B-16 Feed cards never learn about comments added in the panel (`TakesFeed.tsx:385-392`); `TakePostCard` re-subscribes to the bus on every reaction change (84-115).
- Low: `TakeComments.tsx` unused; `app/take/[id]` comment button has no handler (709-714); `TakeCommentItem` report lacks the comment id (114-124); `?comment=` links have no target (199).

**Files.** `lib/hooks/useTakes.ts`, `components/takes/*.tsx`, `app/take/[id]/page.tsx`,
`app/api/takes/delete/route.ts`, `supabase/migrations/20260429_takes_reels_feed_rpc.sql`,
`20260329_takes_rls_policies.sql`.

---

## RC-10 — Freshness: no path for another user's action to reach the screen — **High**

**What.** No trigger, broadcast event, or poll-on-focus exists for
reactions or comments. The `postgres_changes` subscriptions in
`useReactionCounts`/`useUserReaction` are opt-in, unused, and would never
fire because the tables left the publication (`useInteractions.ts:317-372,
437-484`). Only the home feed refetches page 0 on focus (30 s). A user
looking at a post sees other people's reactions and comments only after a
full reload or re-navigation.

**Symptoms.** A-25 other users' reactions/comments never appear while a
post is open; A-26 two tabs of the same user diverge (and then RC-1 makes
the wrong-branch write).

**Files.** `lib/hooks/useInteractions.ts`, `lib/hooks/useComments.ts`,
`components/feed/PostDetailModal.tsx`, `app/post/[id]/page.tsx`,
`lib/hooks/usePollOnFocus.ts` (the project's standard, unused here), DB
triggers (`user-events` broadcast).

---

## RC-11 — Load and concurrency at 10,000 users on one post — **Medium**

Assessed for a viral post with 10k reactions/comments in a minute.

- C-2 **Counts are computed on every read.** Every list row does four correlated `count(*)` subqueries (`POST_COUNTS_SELECT`); the modal/page does an RPC scan of all `reactions` rows for the post plus an `admires` HEAD count (`useInteractions.ts:236-243`). Indexes cover it (`idx_reactions_post_type`), so a 10k-row post costs ~10k index entries per open × every viewer. Tolerable at today's scale; the fix is cheap (per-type counts in one aggregate and a cached/materialised count only if it ever shows in `pg_stat_statements`).
- C-3 **Replies fetch every like row** (`useComments.ts:200-216`) — 20 replies × 500 likes = 10k rows per expand. Take comments fetch the whole thread and every like row (`useTakes.ts:933-954`).
- C-4 **`/post/[id]` fires ~8-10 requests on cold load and runs `fetchData` twice** (`page.tsx:471-475`); the modal opens with 4 (RPC, admires head, own reaction, comments) plus the user-likes query.
- C-5 **Double-submit** (RC-1 A-5) and **stale-closure toggles** (RC-5) turn concurrent clicks into wrong rows; under load the insert/delete race is easier to hit.
- C-6 **Context churn**: `ModalProvider` keeps subscribers in state and rebuilds `notifyUpdate` (and the context value) on every card mount (`ModalProvider.tsx:131, 240, 315-343`) → O(cards) re-renders per subscription change; at 100 cards each scroll batch re-renders the whole feed.
- C-7 **No pagination for takes comments**; **no "load more" wiring for post comments** (RC-4), so long threads either truncate or load everything.
- C-8 **Notification fan-out is one row per action, no grouping, no rate limit**: 10k reactions = 10k rows + 10k broadcast sends to one user + 10k email-queue HTTP posts (`queue_notification_email` fires pg_net per insert; the email route then rejects most).
- C-9 **No server-side rate limiting** on engagement inserts (D-5).
- C-10 Dead subscriptions cannot pile up today (disabled), but the code path remains and re-enabling it would open two channels per open post.
- Unused indexes flagged by the advisor on `reactions(post_id)`, `reactions(reaction_type)`, `comments(post_id)`, `comments(parent_id)`, `comment_likes(user_id)`, `take_reactions(*)` — because reads go through other indexes or the tables are tiny; harmless, revisit after the query shapes change.

---

## RC-12 — UI/UX gaps against Instagram and Threads — **Medium**

Judged on: instant, obvious, undoable, feels good, mobile.

Reactions
- E-3 **The picker cannot be opened on touch devices.** It opens on mouse hover after 500 ms or via arrow keys (`ReactionPicker.tsx:172-200, 283-296`); there is no `touchstart`/long-press/`contextmenu` handler in either picker, so on a phone a tap always toggles `admire` and the five other reactions are unreachable, even though a mobile bottom-sheet style exists in CSS (`app/globals.css:2895-2913`).
- E-4 **Not instant**: the count does not change optimistically on cards/modal/page (only the heart does); the modal/page never update the count at all (RC-3 B-6).
- E-5 **Not obvious what happened**: per-type numbers in the picker are fabricated on lists (RC-2 B-2); no "who reacted" view for posts (only DMs have one, `MessageReactionPicker.tsx:138`); no facepile/top-3 reaction summary on the card, only a number.
- E-6 **Undo is inconsistent**: tapping the heart removes any reaction on posts; in the take picker re-selecting your reaction does nothing; error states never revert (RC-1).
- E-7 Feel: no press/pop animation on count change; heart tap on gallery tiles and card are different systems.

Comments
- E-8 **Composer is a bare single-line `<input>`**: no multiline/auto-grow, no character counter or limit, bare Enter submits (no Shift+Enter, no IME guard), no @autocomplete, no emoji, no reply-target chip ("Replying to @x ×") — the reply target is a text prefix (`CommentItem.tsx:106-108`).
- E-9 **Posting a comment is not optimistic** (`useComments.ts:250-346`): the input clears only after the round-trip; on failure the text is lost (take panel clears unconditionally, `TakeCommentsPanel.tsx:358-366`).
- E-10 **Threads**: replies collapse under "View N replies" but there is no "load more replies"; no "hide replies"; "View replies" state is lost on re-render of the parent list.
- E-11 **No edit**; delete has a confirm on posts (`ConfirmationModal`) but none on takes.
- E-12 **Like on comment**: instant, but no animation, no like count facepile, and the failure path is silent.
- E-13 **Empty/loading**: modal has an empty state string (`PostDetailModal.tsx:1146`) but no skeleton for comments; page similar; take panel has its own.
- E-14 **Mobile**: modal comment input is below the fold on small screens; no sticky composer; take comments panel is a separate, differently styled sheet.

Notifications
- E-1 no grouping; E-15 deep links only work for the first 30 top-level comments; E-16 take relays link to a 404.

What Instagram/Threads have that Pinkquill lacks: long-press picker on
touch, "liked by A, B and N others" with a tappable list, optimistic
comment insert with retry, "Replying to @x" chip, view/hide replies with
paging, sticky composer with @/# autocomplete, grouped notifications with
avatars, post-author moderation of comments.

---

## RC-13 — Dead and misleading code — **Low**

- `useReactionCounts`/`useUserReaction` realtime branches (`useInteractions.ts:317-372, 437-484`).
- `PostCard.tsx:13, 124` imports `useToggleAdmire` and never calls it.
- `components/takes/TakeComments.tsx` imported nowhere.
- `useComments.refetch` (`useComments.ts:493`), `useTakeReactionCounts.refetch`, `useTakeComments.refetch` never called.
- `notifications.reaction_type`, `notifications.take_id` never written; `Mention` type in `hooks.legacy.ts:2014-2025` unused; `get_total_reactions` RPC unused by the app.
- `ModalProvider.notifyUpdate` `comments` branch unreachable (`ModalProvider.tsx:233-236`).
- Tests: no coverage of change-reaction, double-click, revert, notification cleanup, `toggleLike`, `fetchReplies`, `loadMore`; no e2e for any engagement action.

---

## Severity summary

| Root cause | Severity | Phase (see 02-plan.md) |
|---|---|---|
| RC-1 reaction writes guessed from client state | Critical | 1 |
| RC-2 two tables, six formulas, fabricated per-type | High | 1 |
| RC-3 no shared per-post state | High | 1 (reactions), 2 (comments) |
| RC-4 comment count semantics + truncation | High | 2 |
| RC-5 comment mutations non-atomic | Medium | 2 |
| RC-6 notifications unguarded/unreconciled | High / Critical (D-1) | 3 (correctness), 4 (policy) |
| RC-7 visibility & blocks not enforced | High | 4 |
| RC-8 mentions cosmetic | Medium | 3 (notify), 6 (autocomplete) |
| RC-9 takes fork | High | 1, 2, 3 (each phase covers takes) |
| RC-10 no freshness path | High | 1 (poll on focus), 5 (events) |
| RC-11 load/concurrency | Medium | 5 |
| RC-12 UI/UX | Medium | 6 |
| RC-13 dead code | Low | folded into 1-5 |
