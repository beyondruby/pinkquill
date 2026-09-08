# Profile, feed and post view — findings

Audited 2026-09-08 against `00-system-map.md`. Findings are grouped by root
cause, not by screen; each root cause lists every place it appears. Each
finding has an id (`P-` profile, `F-` feed, `V-` post/take view, `X-` found
during browser verification), a severity, a category, the files it touches
and how it was verified. `02-plan.md` refers to these ids.

Severity: **Critical** = data is exposed or wrong for users today; **High** =
users see broken or inconsistent state in a common path; **Medium** =
degraded behaviour, fragile code; **Low** = hygiene. Category: **A** bug /
correctness, **B** technical quality, **C** UI / UX (concrete, named
problems only).

Anything marked *unverified* was established from code but not exercised in
a browser or against production.

Summary: 23 root causes, 4 Critical, 17 High, ~60 Medium, ~50 Low.

---

## RC-1 — The takes grid paints its own background as the gutter — **Critical**

**Why it matters.** This is the reported bug. `repeat(3, 1fr)` always lays
out three tracks; with fewer than three items per row the empty tracks show
the container's black background as full-height "placeholder" tiles.

**P-1 Takes grid shows black phantom tiles.** Critical, C (verified in the
browser: 1 take → two black columns; 2 takes → one black column; same on
desktop and at 390 px).
`app/globals.css:6892-6897` `.takes-grid { display:grid;
grid-template-columns: repeat(3, 1fr); gap: 1px; background: #000; }` plus
`.take-grid-card { aspect-ratio: 9/16; background:#1a1a1a }` (6906-6912).
The row is as tall as one 9:16 tile (~590 px at desktop width), so the
unused tracks read as tiles. Touches `components/studio/StudioProfile.tsx:2348`
(Takes tab) and `:2523` (Relays → Takes sub-tab), `components/takes/TakePostCard.tsx:270-309`
(the tile), and `app/globals.css:6892-6950`. The tile component imports
`takes.css` but its grid rule lives in `globals.css`.
Exhaustive search for the same pattern: `.takes-grid` is the **only** rule in
the app that combines a container background with a hairline gap. The other
`background:#000` rules (`globals.css:1763, 5522, 6072, 6304, 6970`;
`takes.css:481`; `post-card.css:152, 356`) are video letterboxes. Every other
three-column grid in the profile (`StudioProfile.tsx:1710, 2050, 2233, 590`;
`StoreTab.tsx:130`; `CommissionsTab.tsx:229, 295`) has a transparent
container, and every `Array.from({ length })` grid in the app is a skeleton
or a deliberate upload slot. The mobile block at `globals.css:6900-6903`
repeats the desktop values and does nothing.

---

## RC-2 — Row policies and column grants allow more than the UI intends — **Critical**

**Why it matters.** Client-side filtering is the only thing between a
visitor and data the product treats as private. Verified against
production on 2026-09-08.

**P-2 Every profile view downloads the user's email and Stripe customer id.**
Critical, A (security). `lib/hooks/useProfile.ts:61-66` runs
`profiles.select("*")`. Live DB: policy "Public profiles are viewable by
everyone" is `SELECT USING (true)`; `anon` and `authenticated` hold column
SELECT (and UPDATE) on all 22 columns including `email` and
`stripe_customer_id`; 10/10 rows have an email, 2 have a Stripe id. A
logged-out visitor's profile request returns them. The same `*` is used by
`app/studio/[username]/collections/[collection]/[item]/page.tsx:21`,
`lib/hooks/useTakes.ts:969-973, 1115-1119`, `lib/hooks/useFeed.ts:485-490`
and `app/take/[id]/page.tsx:246-250`. Fix needs both a client column list
and a DB grant change (plan asks before touching the DB).

**V-24 `takes_select` lets anyone read followers-only and private takes.**
Critical, A (security). Live policy: `USING (auth.uid() IS NULL OR author_id
= auth.uid() OR NOT EXISTS (blocks …))` — no `visibility` clause, no
private-account clause; anonymous passes unconditionally. The take page's
"private" / "followers only" branches (`app/take/[id]/page.tsx:180-243`) and
the profile's takes filter (`useTakes.ts:985-1009`) run after the row is
already in the browser. `posts_select_policy` does enforce visibility, so
the two content types disagree. Fix is a DB migration (plan asks first).

---

## RC-3 — Loading and error state is decided by the wrong signal — **High**

**Why it matters.** A user sees "not found" for a user that exists, or an
empty state for a request that failed.

**X-1 "User not found" flashes while the profile is still loading.** High, A
(seen in the browser when navigating from a feed card to `/studio/hadi`).
`lib/hooks/useProfile.ts:239-246`: the `finally` block sets `loading=false`
whenever `mountedRef.current` is true. When a fetch is aborted and a new one
starts (Strict-mode remount in dev, `refetch()`, username change), the
aborted call's `finally` runs after the remount has set `mountedRef` back to
true, so `loading` flips false while `profile` is still null →
`StudioProfile.tsx:1020-1029` renders "User not found". Prod exposure: any
refetch (follow accepted, 891-893 and 1005-1010) and fast navigation between
profiles.

**P-20 Tab fetch errors render as empty states.** Medium, A/C.
`StudioProfile.tsx:811-812` and `:814` ignore the `error` returned by
`useUserTakes` / `useRelayedTakes` / `useCollections`; `useRelays` has no
error state at all (`useFeed.ts:614-616`). A failed request shows "No takes
yet...". `useProfile` folds every thrown error into "User not found"
(`useProfile.ts:239-242`).

**V-48 Distinct failure reasons collapse into "not found".** Medium, C.
`app/take/[id]/page.tsx` computes "This take is private" (186), "You must be
logged in…" (194), "…only visible to followers" (207), "…from a private
account" (225, 238), "Failed to load take" (319) and then renders a fixed
"Take not found" block (539-556) that never reads `error`. `app/post/[id]/page.tsx`
does the same ("Failed to load post" at 456 vs 685-704). A network failure
is reported as a missing post with no retry.

**F-13 The top-level feed error fallback has no retry.** Medium, C.
`app/(feed)/page.tsx:13` passes no `onRetry`; `components/ui/ErrorFallbacks.tsx:57`
renders the button only when it is given.

**F-31 The feed's 12-second auto-retry is silent and its error is colour-only.**
Low, C. `Feed.tsx:242-248, 342`.

---

## RC-4 — supabase-js returns `{ error }` and never throws; write paths assume it throws or never look — **High**

**Why it matters.** Optimistic UI is shown as success after the write
failed; reports silently never reach moderation.

**V-17 `TakePostCard` reports a take through `reported_post_id`.** High, A.
`components/takes/TakePostCard.tsx:204-210` inserts `{ reported_post_id:
take.id, …, type: "take" }`; the column references `posts`, so the insert
fails on the FK. The migration that added `reports.take_id`
(`supabase/migrations/20260902_phase6_hardening.sql:4-17`) documents this
exact bug but this caller was not updated. Report payloads also differ per
surface: `TakeDetailModal.tsx:198-226` and `TakePostCard` omit
`reported_user_id`; the pages concatenate `reason+details`
(`app/post/[id]/page.tsx:570`, `app/take/[id]/page.tsx:429`) where others
split them.

**P-19 The profile Report modal shows "Report Submitted" even when the insert
failed.** High, A. `StudioProfile.tsx:963-968` discards the result of
`supabase.from("reports").insert(...)`. `TakePostCard.tsx:204-217` checks
`error`; this copy does not.

**V-15 Revert-on-error code is dead across the take surfaces.** Medium, A.
`TakeDetailModal.tsx:265-278, 297-311`, `TakePostCard.tsx:134-147, 167-181`,
`useTakes.ts:573-586, 606-620, 784-800` wrap `await supabase…insert()` in
`try/catch` and revert in `catch`, which never runs; `app/take/[id]/page.tsx:366-404`
has no handling at all. `handleSave` on the post page (488) and modal (438)
ignore the boolean returned by `toggleSave` (`lib/hooks/useInteractions.ts:11-19`).

**V-16 Delete and block failures are silent.** Medium, C.
`app/post/[id]/page.tsx:542-545, 603-605`, `PostDetailModal.tsx:264-267`,
`app/take/[id]/page.tsx:414-417`, `TakeDetailModal.tsx:192-195`,
`TakePostCard.tsx:193-196`: `console.error` only; the dialog stays open, no
toast.

**P-21 Collection mutations ignore errors except to skip the refetch.** Low,
A. `StudioProfile.tsx:2623-2633`.

---

## RC-5 — No in-flight guard on toggles — **Medium**

**F-9 Double-clicking Save or Relay leaves the wrong final state.** Medium, A.
`PostCard.tsx:207-238` awaits `toggleSave(post.id, user.id, isSaved)` with the
closure's `isSaved` and no `pendingRef`; the second click inserts a duplicate,
hits the UNIQUE constraint, and the `catch` reverts to *unsaved* although the
row exists. `handleRelay` (240-277) same, plus a double count.
`useTileActions.ts:75-81` has the guard — two behaviours for one action.

**P-6 A failed follow leaves the button disabled forever.** Medium, A.
`StudioProfile.tsx:983-998` has no `try/finally`; `followUserRecord` /
`unfollow` throw (`useProfile.ts:280-288, 330-336`) → `followLoading` stays
true.

---

## RC-6 — The modal shows whatever the opener passed; five hand-written mappers and three `Post` types — **High**

**Why it matters.** The same post renders differently depending on where it
was opened, including skipping a content warning.

**V-1 Content warning is bypassed when a post is opened from a profile tile.**
High, A. `StudioProfile.createPostForModal` (1650-1691) never sets
`contentWarning` (verified: no `contentWarning`, `mentions`, `hashtags` or
`spotify` key in that block); `PostDetailModal` gates the overlay on
`post.contentWarning` (247, 939). The feed mapper passes it (`Feed.tsx:45`).

**V-2 Profile-opened modal drops hashtags, mentions, Spotify track.** Medium,
A. Same mapper; the modal renders `PostTags` from `post.mentions/hashtags`
(975-983) and the embed from `post.spotify_track` (773). The relay mapper at
`StudioProfile.tsx:2391-2416` also omits `reactionCounts`, `collaborators`,
`flair`, `community`, `styling`.

**V-5 / P-29 / F-32 Three `Post` interfaces and six mappers.** Medium, B.
Interfaces: `ModalProvider.tsx:34-70`, `PostDetailModal.tsx:92-125`,
`app/post/[id]/page.tsx:86-106` (author shape differs: `{name, handle:"@u",
avatar}` vs `{username, display_name, avatar_url}`; the modal strips the `@`
back off at 606, 622, 1212). Mappers: `Feed.tsx:29-72`,
`StudioProfile.tsx:1650-1691` and `:2391-2416` (`typeLabel` = capitalised
type at 1662, bypassing `lib/feed-view/post-type-theme.ts`),
`app/(feed)/saved/page.tsx:202-232`, `components/explore/ExplorePageContent.tsx:254-301`
(own `typeLabels`), `app/studio/[username]/collections/[collection]/[item]/page.tsx:60-75`.
`useTileActions.ts:57` passes `relays` from `post.stats` while `PostCard.tsx:187`
passes its live count. `formatCount` exists five times with two outputs
("1.2k" `StudioProfile.tsx:726` vs "1.2K" `TakePostCard.tsx:44`, visible
side by side in the Takes tab). `decodeHtmlEntities` (`StudioProfile.tsx:47-62`)
duplicates `lib/utils/sanitize`; five inline `toLocaleDateString` calls
bypass `lib/utils/time`; the pin-button JSX is duplicated (1761-1790 /
1826-1855).

**V-3 The modal never refetches, so it shows stale content after an edit.**
Low, A. `PostDetailModal.tsx:194-217` has no post query;
`ModalProvider.tsx:154` stores the card object.

**V-14 The modal's owner check for Relay relies on an optional field.** Low,
A. `PostDetailModal.tsx:94, 1014`.

**V-49 `getTypeLabel` on the post page is a private copy of
`getPostTypePhrase`.** Low, B. `app/post/[id]/page.tsx:153-168` vs
`lib/feed-view/post-type-theme.ts:40-50, 74`; lacks `voice`/`sound`.

---

## RC-7 — History is manipulated with `pushState` in both directions — **High**

**Why it matters.** Back does not do what the user expects; the feed can be
shown under a `/post/x` URL; a reload at that point renders a different page.

**V-6 / F-6 Closing a modal pushes a new entry instead of going back.** High,
A. `ModalProvider.tsx:152` pushes `/post/{id}` on open; `:161` pushes the
original URL on close (takes: 174, 183). After open + close the stack is
`[feed, /post/x, feed]`; Back activates `/post/x`, `handlePopState`
(193-204) only closes and never re-opens, so the feed is displayed under the
post URL. Each open/close adds two entries. `ModalProvider.test.tsx:35`
asserts only the pathname after close.

**V-7 Opening a second modal while one is open captures `/post/x` as the
original URL.** Medium, A. `ModalProvider.tsx:149, 171` read
`location.pathname + search` unconditionally; a double-tap on a card ends
with the URL at `/post/A` and no modal.

**V-8 The URL change re-renders pathname-driven chrome under the modal.**
Medium, B (*unverified at runtime*). `ConditionalRightSidebar.tsx:27-45`
returns null when `pathname !== "/"` and refetches on return;
`MobileBottomNav.tsx:51` keys its active state on pathname.

**V-46 The first modal open after page load shows nothing until the chunk
arrives.** Low, C. `ModalProvider.tsx:116-117` `dynamic(..., {ssr:false})`
without a `loading` component.

---

## RC-8 — The ModalProvider pub/sub bus is only partially wired; the card memo hides content changes — **Medium**

**V-9 Deleting a post from a modal opened anywhere but the home feed leaves
the tile on screen.** Medium, A. `subscribeToDeletes` has one consumer
(`Feed.tsx:278-282`); `StudioProfile`, `saved/page.tsx`,
`ExplorePageContent` and the collections item page never subscribe.

**V-10 `notifyTakeDelete` has zero subscribers.** Medium, A. A take deleted
in `TakeDetailModal` stays in the profile grid and feed;
`TakePostCard.tsx:41` accepts `onTakeDeleted` but the modal path (109) does
not pass it; `ModalProvider.tsx:299-305`.

**F-14 Blocking a user removes only the one card.** Medium, A.
`PostCard.tsx:373-380` calls `onPostDeleted(post.id)` only; the author's
other posts stay until the next fetch.

**F-16 Edited posts keep the old title/body/media after a refetch.** Medium,
A. `PostCard.tsx:1267-1284` memo comparator compares id + five counters and
flags; `title`, `content`, `media`, `contentWarning`, `styling` are ignored.

**V-11 Profile tiles do not subscribe to save/relay updates.** Low, A.
`StudioProfile.tsx:1675-1679` re-seeds the modal from static row flags.

**F-17 Stream rows show a frozen comment count.** Low, A.
`StreamView.tsx:125` reads `post.stats?.comments` while admires use the
store (121-124); Gallery shows no comment count (`GalleryView.tsx:272-295`).

**F-18 `SendToDMModal` mixes store and row counts.** Low, A.
`PostCard.tsx:1120-1125`.

---

## RC-9 — The follow relationship is computed three ways and counts are never updated — **Medium**

**P-4 Takes visibility uses "any follow row", posts use "accepted".** Medium,
A. `useTakes.ts:985-991` has no `status='accepted'` filter (gate at
1002-1008) while `useProfile.ts:93-100` filters on accepted. A pending
requester sees followers-only takes (until V-24 is fixed this is the only
gate).

**P-5 Follower counts are stale after follow/unfollow.** Medium, A/C.
`StudioProfile.tsx:983-998` and `FollowersModal.tsx:46-61` never touch
`profile.followers_count` (rendered at 1279).

**V-23 The take page's Follow button bypasses the request flow.** Medium, A.
`app/take/[id]/page.tsx:400-404` inserts into `follows` directly; the DB
trigger `enforce_follow_request_status` forces `pending` for private
accounts, so the button reads "Following" (600) while a request was created,
and the next tap deletes the request.

**P-13 The followers list pages without an `order()` and double-fetches on
type change.** Medium, A. `useProfile.ts:437-455, 462-480` use `.range()`
with no ordering → non-deterministic "Load more"; reset effect (520-524) +
page effect (507-517) fire together.

**P-7 Duplicate follow/block queries.** Low, B. `useProfile.ts:85-101` and
`StudioProfile.tsx:868-875` both fetch the follow row; `follow()` refetches
`is_private` (`useProfile.ts:276`) though it is in state.

**P-8 A private-follow acceptance triggers two full profile refetches.** Low,
B. `StudioProfile.tsx:891-893` and `1005-1010`.

**P-47 `follows` rows are deleted directly from three places.** Low, B.
`FollowersModal.tsx:50-54`, `useProfile.ts:330-336`, `useFollowRequests`.

---

## RC-10 — Post objects are built by hand instead of through `enrichPost`; stats are derived from the viewer's filtered list — **High**

**P-3 Every relayed post shows 0 reactions / 0 comments and reads "not
relayed" for the owner.** High, A (verified: the select at
`useFeed.ts:500-533` requests `reactions:reactions(count)` aggregates and
never the counter columns, then `:596-598` reads `post.reactions_count ?? 0`).
A seeded 0 marks the engagement store entry as loaded (`store.ts:169-181`),
so nothing refetches. Flags are hard-coded false/null (599-601). No
`styling`/`post_location`/`metadata` are selected although
`StudioProfile.tsx:2406-2408` forwards them.

**P-9 Posts and Admires stats vary per viewer and exclude collaborations.**
Medium, A. `useProfile.ts:213-219`: `works_count = postsData.length` after
the visibility filter (186-191); admires = client sum. The grid merges
`collaboratedPosts` (`StudioProfile.tsx:1540-1545`) that the count does not.
The Posts stat is rendered raw (1269) next to `formatCount` values.

**P-14 Collaborated posts bypass `enrichPost`.** Medium, A.
`lib/hooks/hooks.legacy.ts:2291-2296` → unsorted media, no viewer flags;
used at `StudioProfile.tsx:1542-1544, 1677-1679`.

**P-22 Profile tiles render `media[0]` as an image regardless of type.**
Medium, A (verified in the browser: demo posts with a dead first URL render
the alt text on a grey box). `StudioProfile.tsx:1556` filters on
`media.length > 0`; `:2060-2064, 1743, 1977, 2207, 2250, 2467` use
`<img src={work.media[0].media_url}>`; `media_type` is selected
(`useProfile.ts:152-157`) but never checked. `GalleryView.tsx:88-123`
already does this correctly (`firstVisualMedia`).

**P-46 A viewer who logs in after the first fetch keeps the guest result.**
Medium, A (*timing unverified*). `useProfile.ts:36-37, 248`: keyed on
`username` only, `viewerId` in a ref.

---

## RC-11 — Offset pagination, replace-on-refresh, and effects keyed on whole lists — **High**

**F-1 Duplicate and skipped posts across feed pages.** High, A.
`useFeed.ts:84-85, 157` offset `.range(from,to)` on `created_at DESC`, no
dedupe on append (186-192). Any publish/delete between pages shifts offsets
→ duplicates (same React key, `Feed.tsx:387`) or skips.

**F-2 Tab refocus collapses the feed to page 0.** High, A/C.
`useFeed.ts:270-277` → `setPosts(typedPosts)` (194) replaces every page; a
user six pages down returns to ten posts.

**F-4 Feed state and scroll position are lost on every navigation away and
back.** High, C (*structural; runtime unverified*). All state is `useState`
(`useFeed.ts:49-56`); `Feed` remounts to skeletons (`Feed.tsx:307`); there
is no scroll-restoration code.

**V-31 With `?id=`, every page load or "Not interested" scrolls the takes feed
back to the deep-linked take.** High, A. `TakesFeed.tsx:85-94` effect keyed
on `[initialTakeId, visibleTakes]`; `visibleTakes` is a new array on every
`fetchMore`/hide, so the user is yanked back. Saved-page take tiles always
enter through `/takes?id=` (`app/(feed)/saved/page.tsx:498`).

**F-3 The 200-post cap drops the newest posts.** Medium, A.
`useFeed.ts:188-190` keeps the *last* 200 of a newest-first list.

**F-5 `pagination.total` is dead; an extra empty request fires at exact
multiples of 10.** Low, B. `useFeed.ts:166, 200`.

**V-30 `checkFollowing` re-queries every author on every list change.** Low,
B. `TakesFeed.tsx:64-69`, `useTakes.ts:759-769`.

**V-29 `TakeDetailModal` metadata effect has no cancellation.** Low, A.
`TakeDetailModal.tsx:113-168`; a failed fetch keeps the previous take's
hashtags (130-132).

---

## RC-12 — The take page and modal use a raw `<video>` and a local `Take` type — **High**

**V-18 A take with an added sound, speed or filter plays differently on its
own page and modal than in the feed.** High, A. `TakePlayer.tsx:72-152,
257-294` honours sound/speed/filter; `app/take/[id]/page.tsx:636-645` and
`TakeDetailModal.tsx:445-455` render `<video src={video_url}>` and their
`Take` types (`page.tsx:29-47`) lack those fields. A take with original
audio at 0 plays silent on share links.

**V-20 Mute state is not shared with the modal.** Medium, C.
`TakeDetailModal.tsx:65` local `isMuted=true`; feed and page use
`useMuted()` (`useTakes.ts:698-719`).

**V-22 Direct-link and modal views of a take are never counted.** Medium, A.
`useTrackTakeView` is used only by `TakeCard.tsx:91-93`.

**V-19 `aspect_ratio` and `text_overlays` are stored and never rendered.**
Medium, C. 16:9 / 1:1 / 4:5 takes are centre-cropped everywhere
(`globals.css:5516-5527, 6068-6074`; `page.tsx:635-639`). Needs a decision
(see plan).

**V-21 `isPlaying` is manual state, not the element's.** Low, A.
`page.tsx:481-490`, `TakeDetailModal.tsx:172-177`.

---

## RC-13 — Unbounded, uncached and duplicate fetches — **High**

**P-10 Profile posts cannot be paginated because the count is `length`.**
High, B. `useProfile.ts:139-183` has no `.limit/.range`; 500 posts → 500
rows + three flag queries with 500 ids + 500 eager `<img>` without
`loading="lazy"` (`StudioProfile.tsx:1743, 1977, 2060, 2207, 2250`).

**P-11 Tab data is unbounded and thrown away on every tab exit.** Medium, B.
Takes / relays / relayed takes / collections have no pagination
(`useTakes.ts:995-999, 1127-1146`; `useFeed.ts:500-533`;
`useCollections.ts:59-69`) and are cleared by the `""`/`undefined` gating
(`StudioProfile.tsx:811-814` → `setTakes([])` at `useTakes.ts:1087`,
`setRelays([])` at `useFeed.ts:466-470`, `setCollections([])` at
`useCollections.ts:46-50`); each re-resolves `profiles` by username.

**P-12 Data fetched on every profile mount regardless of use.** Medium, B.
`useCommunities` (813; two requests for the About-box avatar stack),
`fetchCollaboratedPosts` (908-920), `useFollowList` page 0 inside the closed
`FollowersModal` (2648; no `enabled` flag, `useProfile.ts:419-423`), all
posts even on `?tab=takes`. Owner first paint = 14 round trips, visitor 19.

**V-25 `/take/[id]` performs up to 11 sequential round trips and queries
`follows` three times.** Medium, B. `app/take/[id]/page.tsx:163-314`.

**F-24 The feed selects `*` plus eight embeds and full HTML bodies for every
row; four requests per page.** Medium, B. `useFeed.ts:91-152`,
`lib/posts/enrich.ts:81-87`.

**V-26 The post page over-selects and re-queries.** Low, B.
`app/post/[id]/page.tsx:283-312, 560-564`; `PostDetailModal.tsx:282-286`.

**V-27 Both modals fetch comments on open although the panel is hidden.**
Low, B. `PostDetailModal.tsx:173, 194-204`; `TakeDetailModal.tsx:52, 76-86`.

**F-26 DOMPurify runs over the whole list on every append.** Low, B.
`GalleryView.tsx:307, 48-67`; `TruncatedContent.tsx:22-30`;
`Feed.tsx:292-298`.

**P-15 Unpin issues up to five sequential UPDATEs.** Low, B.
`usePinnedPosts.ts:136-142`.

---

## RC-14 — Media elements are chosen by position or mounted without lazy/preload — **Medium**

**V-28 / P-23 `TakePostCard` mounts a `<video>` per tile without
`preload="none"` or a poster.** Medium, B (verified: 6 of 8 takes in prod
have no `thumbnail_url`; the tile shows as a blank dark rectangle until the
first frame arrives). `TakePostCard.tsx:285-289` grid, `:376-384` feed; the
`<img>` thumbnail (280-284) is not lazy.

**F-25 Every non-player video thumbnail is a `<video preload="metadata">`.**
Medium, B. `PostCard.tsx:983`, `StreamView.tsx:186`, `GalleryView.tsx:104-114`;
`MediaCarousel.tsx:60-63` mounts a `VideoPlayer` per video slide.

**F-12 Video posts never get a poster; the play-first branch is unreachable.**
Medium, C. `PostCard.tsx:902` `post.image || null` is always null; 908-909
mounts `VideoPlayer` unconditionally so 911-930 never renders.

**F-33 Audio and video players do not pause each other.** Low, C.
`AudioPlayer.tsx:28-34` vs `VideoPlayer.tsx:236-243`.

**F-34 Hidden carousel video slides remain tabbable.** Low, C.
`MediaCarousel.tsx:60-63` + `VideoPlayer.tsx:465`.

---

## RC-15 — Components defined inside render; one giant render pass — **High**

**F-8 `AuthorHeader` and `ContentSection` are re-created every render, so the
carousel index resets, videos restart and the audio graph is torn down.**
High, A (verified: `PostCard.tsx:631` and `:819` declare them inside the
component body). They wrap `VideoPlayer` (907-909), `MediaCarousel` (961)
and `AudioPlayer` (1053-1061, whose cleanup closes the AudioContext).
`PostCard` re-renders on every store emit, save/relay, or any of 15 modal
states; `memo` (1267) only guards props.

**P-28 `StudioProfile` is one 2896-line component with 22 `useState`s that
rebuilds every view on every render.** Medium, B. All six views are built
inside an IIFE (1537-2329) that re-merges, sorts, filters, regex-strips HTML
per card (1715-1717, 1958-1960, 2104-2106, 2188-2190, 2236-2238, 2419-2421)
and formats dates inline; typing in the Report textarea (2744-2749)
re-renders the grid. No `useMemo`, no memoised card; effects keyed on
`profile` identity (867-875, 897-905).

**F-27 Three IntersectionObservers per classic card plus one per video.** Low,
B. `useTracking.ts:381-416`, `VideoPlayer.tsx:244-258`, the sentinel.

**F-28 Gallery tiles remount when the column count changes.** Low, B/C.
`GalleryView.tsx:311-323` columns keyed by index.

**V-55 `onLoadReplies` identity changes on every comment change.** Low, B.
`useComments.ts:266`; comparator at `CommentItem.tsx:588` not read.

---

## RC-16 — Entrance animations and mismatched skeletons gate content — **High**

**P-16 Every tab click blanks the tab body for 0.5 s then fades it in over
0.6 s; the header fades in after load.** High, C (verified in the browser).
`globals.css:4952-4964` `.studio-section-animated { opacity:0 }` +
`.loaded { animation .6s forwards }` + `.delay-5 { animation-delay:.5s }`;
every tab body is a freshly mounted `delay-5` element
(`StudioProfile.tsx:1502, 2335, 2359, 2563`; `StoreTab.tsx:41/51/68/103`;
`CommissionsTab.tsx:186/195/217`); header rows use delay-1…4 (1067, 1227,
1267, 1301, 1455) after a 100 ms `pageLoaded` timer (837-842).

**P-17 Three different loading visuals before the profile appears.** Medium,
C. Route skeleton (`loading.tsx`, `max-w-4xl`, `h-48`, `bg-gray-300`) →
full-viewport spinner (1012-1018) → the real 1100 px / 320 px layout; two
layout jumps.

**F-22 The feed skeleton does not match the card.** Low, C.
`PostSkeleton.tsx:32-37, 51, 64, 87, 111` hard-coded greys, radius 16 /
padding 24 vs `Feed.tsx:96-107`; four equal action bars vs 3 + 2;
`app/(feed)/loading.tsx:5` uses `max-w-2xl` vs 580 px.

**F-23 First paint is always the Classic skeleton, then switches to the
cookie'd view.** Low, C. `FeedViewProvider.tsx:41-48`.

**P-18 Profile cards start `opacity-0` until an IntersectionObserver fires;
the reduced-motion block does not cover them.** Low, C/B.
`StudioProfile.tsx:65-96, 1729`; `globals.css:5072-5099`.

---

## RC-17 — Three CSS layers for one element, hard-coded colours, dead code — **Medium**

**F-10 The feed card shell, header, action row and media grid are each
defined three times with conflicting values.** Medium, B. `.post`
`globals.css:1023-1036` (radius 20) vs `post-card.css:10-13` vs
`Feed.tsx:96-108` (radius 22); `.author-header` margin 1.25 / 1.25 /
1.05 rem; `.actions/.action-btn` min-height 38 vs 40, three gap values, two
font variables; `.post-menu-btn` 32 vs 34 px; `.unified-media-grid` gap
4/6/6 px; `.pq-media-count-*` (`post-card.css:239-243`) overrides the
`:has()` rules (`globals.css:1856-1877`).

**P-30 Profile styling is split across Tailwind, `studio.css` and
`globals.css` with hard-coded colours.** Medium, C/B. `.studio-avatar {
border: 4px solid white !important }` (`globals.css:4767`) overrides
`border-surface` (1074); `.studio-relay-card` `#fdfcff/#f8f6fc` (4530);
`.studio-relay-footer rgba(255,255,255,.5)` (`studio.css:91`);
`loading.tsx` `bg-gray-300 border-white`; `FollowersModal.tsx:69`
`border-white`. `.studio-works-grid { columns:3 }` has no `break-inside:
avoid` on `.studio-relay-card` (*visually unverified*). The About box top
accent line (1307) violates the no-accent-borders rule.

**V-51 `TakePlayer`/`TakeCard`/`PostDetailModal` are styled from Tailwind,
`takes.css` and `globals.css` at once.** Medium, B. The mobile modal is
~400 lines of `!important` overrides keyed on utility selectors
(`globals.css:2635-3047`); any class edit in the TSX silently disables a
rule (four already broke, see V-50).

**V-50 Dead CSS (0 references, grep-verified).** Medium, B.
`globals.css:6095-6296` (`.tiktok-comments-*`, ~200 lines), `5655-5719`
(`.tiktok-menu-*`), `6403-6405`, `2726-2733`, `2409-2465`, `2957-2965`,
`2843-2848`; `takes.css:142-221, 398-471, 510-561` (three definitions of
`.take-comments-input*`), `225-227`, `364-394`, `496-507`.

**P-27 Dead profile CSS.** Low, B. `globals.css:4968-4988`
(`.studio-tabs-container`), `4990-5064` (`.studio-tab-btn*`), `4125-4168`,
`4316-4340`, `4347-4522` (`.studio-work-card*`), `4884-4940`
(`.studio-bio-*`); `6900-6903` no-op mobile block.

**F-11 Dead feed CSS and modules.** Low, B. `post-card.css:361-362`;
`globals.css` `.type-carousel`, `.type-manifesto`, `.community-post-meta`,
`.post-type-indicator`, `.collab-role-tooltip`; `PostCard/PostMenu.tsx`,
`DeleteConfirmModal.tsx`, `StyledTypeLabel.tsx`, `constants.tsx`,
`journalIcons.tsx:18-23`, `types.ts:97-127` referenced only by `index.ts`;
`PostCard.tsx:43-44` imports `BlockConfirmModal`/`MentionInfo` unused;
`PostProps.image/audioDuration/videoDuration` never assigned yet branched on
(866, 872, 902, 929, 962-968, 1005-1010); `typeLabel` computed
(`Feed.tsx:39`) but unread; `useFeed` `communityId` has no caller.

**P-24 The private "Minimal Stats" block is unreachable.** Low, B.
`StudioProfile.tsx:1245-1260`; the private path nulls both counts
(`useProfile.ts:129-130`).

**P-25 The "Blog" sub-tab is the "All" filter.** Low, C/B.
`StudioProfile.tsx:1563-1567`; identical empty copy and duplicated SVG
(1592-1604). Removing a tab needs a decision (plan).

**P-26 Unused code in the profile.** Low, B. `icons.link` (252),
`icons.quoteLeft` (319), `icons.community` (329),
`StudioSubTabButton.accentClass` (771), `AppRouterInstance` import (42),
`typeLabels` defined twice (1693, 2423), `useFollow` helpers,
`lib/hooks/useSellerProfile.ts` (not used by the page).

**V-53 Dead state and branches in the views.** Low, B.
`app/take/[id]/page.tsx:64, 267, 371` `savesCount`;
`PostDetailModal.tsx:926-936` `post.image`; `TakeCard.tsx:111-126`
`handleDoubleTap(e?)` always called without an event so the heart burst
draws at (50, 50); `useTakes.ts:364-494` fallback duplicates the RPC.

**V-12 Dead `openAuthModal` branches in the modal.** Low, B.
`PostDetailModal.tsx:419-422, 442-445` behind `disabled={!user}` (1019, 1053).

**P-45 Upload extension taken from the file name; old avatar/cover objects
never deleted.** Low, B. `app/settings/profile/page.tsx:95-107`.

---

## RC-18 — Page and modal are copy-pasted and have drifted — **Medium**

**V-52 ~600 lines of the post page and ~600 of the modal are the same code
with divergent edits.** Medium, B. Blocks and line ranges are tabulated in
the post-view section of the audit source: weather/mood maps, style
derivation, journal header, Spotify, title + body, media gallery,
content-warning overlay (five copies incl. takes), action row (four),
comments list + composer (five), comment handlers (five), report handler
(six), block dialog (four), take metadata fetch (two), take save/relay
writes (four), `formatCount` (two), `Take` interface (two).

**V-4 Page and modal disagree on copy, actions and semantics for the same
post.** Medium, C/B. Type phrase; delete copy ("Delete Post?" vs "Erase this
from your studio?"); block copy ("Block @user?" vs "Close the door on
@user?"); owner menu (Share/Copy/Edit/Delete vs Edit/Delete); visitor menu
(Share/Copy/Block/Report vs Block/Report); guest reaction (disabled vs auth
modal); non-journal location line (modal only, `PostDetailModal.tsx:762-770`);
after delete (`router.push("/")` vs close). `TakeDetailModal` has no Block
and no Follow; the take page has both.

---

## RC-19 — Guest / owner gating is duplicated per surface and drifts — **Medium**

**F-15 Guest gating differs between card and modal.** Medium, C. Card → auth
modal (`PostCard.tsx:209-212, 242-245`); modal → greyed `disabled={!user}`
buttons (`PostDetailModal.tsx:1019, 1051`); page → disabled reaction picker.
Guests have no ⋯ menu on cards (617) so no Copy link / Report.

**V-13 The comment pill on both full pages does nothing.** Low, C.
`app/post/[id]/page.tsx:1112-1118`, `app/take/[id]/page.tsx:719-725` —
`<button>` with an aria-label and count but no `onClick`.

**P-35 Guests get neither Follow nor Message nor a sign-in prompt on a
profile.** Low, C. `StudioProfile.tsx:1105`.

**V-47 "Sign in to comment" links drop the return URL.** Low, C. Five
surfaces link to `/login` without `?redirect=` (`page.tsx:1232`,
`PostDetailModal.tsx:1167`, `take/[id]/page.tsx:839`,
`TakeDetailModal.tsx:668`, `TakeCommentsPanel.tsx:194`).

**F-35 The feed's empty-state CTA sends guests to an auth-gated route.** Low,
C. `Feed.tsx:355-377` → `/create`.

---

## RC-20 — Navigation chrome and navigation state were done per surface — **High**

**V-34 `/take/[id]` has no navigation chrome on mobile.** High, C. The page
renders only `LeftSidebar` (`hidden md:flex`) and keeps `pt-14 pb-20`
(`app/take/[id]/page.tsx:561`) while importing neither `MobileHeader` nor
`MobileBottomNav` (24-27): a shared take link shows a 56 px blank band, no
logo, no back, no tabs.

**V-36 Neither modal has a visible close control on desktop;
`TakeDetailModal` has none on mobile either.** High, C. `Modal.tsx` renders
no close button; `PostDetailModal` has only the `md:hidden` back chevron
(591-605); `TakeDetailModal.tsx:363-675` has no close/back at any
breakpoint and its mobile card is `100%×100%` (`globals.css:2648-2655`) so
the backdrop is unreachable.

**V-42 `TakeDetailModal` is desktop-only markup.** Medium, C. `p-10`, no
`md:` variants, none of the `.post-detail-*` hooks the mobile CSS targets
(`TakeDetailModal.tsx:369-419`).

**V-35 The post page composer scrolls under the fixed bottom nav on mobile.**
Medium, C. Composer `sticky bottom-0` with no z-index
(`app/post/[id]/page.tsx:1219`) vs `MobileBottomNav` `fixed bottom-0 z-50`
64 px (`MobileBottomNav.tsx:45-46`).

**V-37 The page version has no back affordance.** Medium, C.
`MobileHeader.tsx:33-70` = logo + messages + notifications; post/take pages
add none.

**F-19 The view-switcher pill overlays the first card on mobile and the card
header at `md`.** Medium, C (verified at 390 px: the pill sits over the
first card's top-right corner). `FeedViewMenu.tsx:117` `fixed top-[60px]
right-2`; at 768–1023 px the rail at `right-4` (87) overlaps the 580 px
column by ≈78 px (*arithmetic, not browser-verified*).

**F-20 The bottom nav's `safe-area-bottom` class is undefined; `pb-20` lacks
`env(safe-area-inset-bottom)`.** Medium, C (*device unverified*).
`MobileBottomNav.tsx:45`, `MainContent.tsx:13`, no rule in any CSS file.

**P-36 The active profile tab is not in the URL.** Medium, C. `?tab=` is read
once (`StudioProfile.tsx:844-849`), never written (1462-1494);
`postViewMode`/`relaySubTab` never persisted → refresh and Back lose the
tab. `CommissionsTab.tsx:133-141` does write `panel`/`filter` params.
"Edit Profile" → `/settings` → client redirect (`app/settings/page.tsx:10-12`)
is an extra hop.

**V-41 The desktop modal hides the comments until "Discussion" is clicked;
the mobile header's Discussion button is desktop-only.** Low, C.
`PostDetailModal.tsx:173, 646`.

**F-21 Hovering the left sidebar covers 148 px of the feed.** Low, C.
`LeftSidebar.tsx:159-164` expands 72 → 220 px at `z-[100]`;
`MainContent.tsx:17` keeps `ml-[72px]`.

**V-33 The takes feed's mobile "back" is a hard link to `/`.** Low, C.
`TakesFeed.tsx:279-287`.

**P-40 The Commissions tab pops in late for visitors, shifting the tab bar.**
Low, C. `StudioProfile.tsx:857` while `hasCommissions === null`.

---

## RC-21 — No text-overflow strategy — **Medium**

**P-31 Display name, handle, tagline and bio have no truncation or wrapping
rules; display name has no max length.** Medium, C.
`StudioProfile.tsx:1082-1084, 1093, 1097, 1316-1318` (no `truncate` /
`break-words`; bio lacks `whitespace-pre-line` so textarea newlines
collapse); `app/settings/profile/page.tsx:308-315` (no `maxLength`) and
376-436 (role/location/education/languages unlimited) feeding the
`flex-wrap` bullet row (1322-1362). DB length constraints *unverified*.

**P-32 Fixed-width dialogs overflow at 320–390 px.** Medium, C. Report modal
`w-[480px]` with no `max-w` (`StudioProfile.tsx:2715`); `TakePostCard.tsx:496`
block modal `w-[420px]`.

**X-3 The profile sub-tab chip row is cut mid-word at phone width with the
scrollbar hidden.** Low, C (verified at 390 px: "Communities" shows as "C").
`StudioProfile.tsx:1504` `overflow-x-auto scrollbar-hide`, no fade or
indicator that the row scrolls.

**F-35b Long titles are not clamped in Classic; a long handle in the community
header pushes the ⋯ button; `timeAgo` never ticks.** Low, C.
`PostCard.tsx` header (716-815), `Feed.tsx:40`.

**P-44 "Continue reading" at 240 characters cuts mid-word.** Low, C.
`StudioProfile.tsx:2135`.

---

## RC-22 — Hover-only affordances, non-semantic click targets, small targets — **Medium**

**P-33 Pin, collection-item delete, gallery counts and take-tile counts are
hover-only.** Medium, C. `StudioProfile.tsx:1771, 1836, 636, 616, 2067`;
`TakePostCard.tsx:274-293` (`onMouseEnter`) — no touch path to pin/unpin or
delete.

**V-38 Modal carousel arrows are invisible on touch.** Medium, C.
`PostDetailModal.tsx:867, 876` `opacity-0 group-hover:opacity-100`; the
page's arrows (`app/post/[id]/page.tsx:1011-1022`) are visible but
unlabelled.

**V-39 The thumbnail strip cannot show more than ~8 items.** Medium, C.
`page.tsx:1034`, `PostDetailModal.tsx:895` `flex gap-2 justify-center` with
no wrap or `overflow-x-auto`; for 20 images (prod max) the first and last
thumbnails are unreachable; no `n / N` index; no arrow keys or swipe.

**V-40 Tall artwork is centre-cropped in both post surfaces.** Medium, C.
`page.tsx:1000` `max-h-[500px] object-cover` (raw `<img>`, no `sizes`,
`alt=""`); `PostDetailModal.tsx:848` `max-h-[450px] object-cover` (260 px on
mobile, `globals.css:2790-2793`).

**F-29 / P-34 / V-44 Cards and tiles are click targets without keyboard or AT
semantics; interactive elements nested in `role="button"`; tabs without
`tablist`; inline dialogs without `role="dialog"`.** Medium, C.
`PostCard.tsx:874, 904, 1016-1019`; `StreamView.tsx:139-156`;
`GalleryView.tsx:243-249`; `StudioProfile.tsx:1272-1291, 1457-1496,
745-784, 1724, 1969, 2055, 2114, 2200, 2242, 2437, 2668, 2709, 2804`;
`TakePostCard.tsx:272-277`; `Modal.tsx:13` labels every modal "Modal
dialog"; unlabelled icon buttons on `page.tsx:1139-1156`,
`take/[id]/page.tsx:685-690, 746-763`, `TakeDetailModal.tsx:501-509,
562-586`, `TakeCard.tsx:438-486`.

**F-30 / V-43 Tap targets under 40 px.** Medium, C. `FeedViewMenu.tsx:135,
152` 28 px; carousel dots 7 px (`MediaCarousel.tsx:104-116`); gallery
heart/save 30 px (`globals.css:727-731`); `.post-menu-btn` 32 px;
`.tiktok-mute-btn`/`.tiktok-menu-btn` 32 px; `.tiktok-follow-btn` 24 / 20
px; discussion close `w-9 h-9`; "Continue reading" bare text
(`TruncatedContent.tsx:40-48`).

---

## RC-23 — Copy and asset inconsistencies — **Low**

**P-42 / V-45 Two different default avatars.** Low, C. Remote Unsplash
portrait in `StudioProfile.tsx:1072, 1659, 2397, 2479`,
`app/post/[id]/page.tsx:765`, `TakeDetailModal.tsx:377`,
`TakePostCard.tsx:338` (14 files); `/defaultprofile.png` in
`FollowersModal.tsx:67`, `Feed.tsx:36`, `app/take/[id]/page.tsx:571`,
`lib/utils/image.ts:40`. `RightSidebar.tsx:245` falls back to a random
Unsplash portrait.

**P-37 The Message button reads "Following…" while opening a conversation.**
Low, C. `StudioProfile.tsx:1148`.

**P-38 "Copy link" gives no feedback.** Low, C. `StudioProfile.tsx:1172`.

**P-39 The cover is painted at `opacity-30` under four gradients on the
profile but at 100 % in the settings preview.** Low, C.
`StudioProfile.tsx:1049-1055`, `app/settings/profile/page.tsx:229-235`.

**P-41 Metadata description says "Quill"; no OG image or url.** Low, C.
`app/studio/[username]/page.tsx:20`, `app/post/[id]/layout.tsx`,
`app/take/[id]/layout.tsx`.

**V-32 "Not interested" is session-only; the takes empty state ignores active
filters.** Low, C. `TakesFeed.tsx:33, 58-61, 264-265`.

**P-43 Journal grouping relies on object key order and `en-US` strings.**
Low, B. `StudioProfile.tsx:2166-2182`.

**V-54 Body scroll lock is coordinated only among `useDialog` users.** Low,
A (*unverified interaction*). `NotificationPanel.tsx:1209-1214`,
`MobileMoreSheet.tsx:30-32`, `NewMessageModal.tsx:151-154` write
`body.style.overflow` directly.

**P-45b `refreshProfile()` is not called after saving the profile form.** Low,
A. `app/settings/profile/page.tsx:182-196`; the sidebar avatar is stale
until reload.

---

## Instagram structure cross-check (behaviour, not style)

| Instagram | Pinkquill today | Findings |
|---|---|---|
| Header → stats → tabs → grid | Same order, but the About box sits between stats and tabs and pushes the grid below the fold on mobile | — (layout decision, not a defect) |
| Tabs with an active state, in the URL | Underline yes; icon-only on mobile; not in the URL; no `tablist` | P-36, P-34 |
| 3-column grid, no placeholder tiles | Takes grid paints black placeholders; only the Gallery view is grid-like | P-1 |
| Instant tab switch, paginated grid | 0.5 s blank + fade per switch; no pagination | P-16, P-10, P-11 |
| Tap opens the post, Back returns to the grid at the same position | Modal + pushState works from the grid; Back after close lands on a stale URL; the full page loses the feed position | V-6, F-4 |
| Counts update on follow | Not updated | P-5 |
| Cursor paging, no duplicates | Offset paging, no dedupe | F-1, F-3 |
| One video plays at a time | Yes among `VideoPlayer`s; audio and takes are independent | F-33 |
| Visible close (desktop) / back (mobile) on the post view | No close control on desktop; take modal has none anywhere | V-36 |
| Skeleton matches the card | No | F-22, P-17 |

## Verified correct (no finding)

Post visibility, followers-only and blocks are enforced server-side by
`posts_select_policy` (live). Reaction and comment counts are shared through
the engagement store with no per-card fetch when seeded. Requests are aborted
on unmount and abort errors ignored (`useFeed.ts:66-69, 205-207, 249-256`;
`useProfile.ts:39-56`). Context values are memoised
(`ModalProvider.tsx:307-335`, `FeedViewProvider.tsx:103-106`). No `window` /
`Date` access on the SSR path. List keys are ids. Comments are not duplicated
after posting (`useComments.ts:389-420`). Escape, Tab trap and focus restore
work for both modals (`useDialog.ts`). The feed query uses
`idx_posts_status_created`; the profile's hot filters are indexed.

---

## Addendum (found while fixing, 2026-09-08)

**X-4 Post reports never reached the database; the moderation queue reads a
column that does not exist.** High, A (found in 1d). The live `reports`
table has `post_id`, `take_id`, `comment_id`, `reported_user_id`, `reason`,
`details`, `type`, `community_id`; there is no `reported_post_id`. The feed
card (`components/feed/PostCard.tsx`), the post page and `PostDetailModal`
inserted `reported_post_id`, so every post report failed (the table had 0
rows in production). Fixed in 1d through `lib/reports.ts`. Still open:
`lib/hooks/useModQueue.ts:60, 104` embeds `posts!reported_post_id` and
filters on `reported_post_id`, and `components/communities/ModQueue/ModQueuePage.tsx:36-46`
reads `report.reported_post_id` — the community mod queue cannot show post
reports. Outside this audit's screens; needs its own fix.

**X-5 Take-comment reports used a type the check constraint rejects.**
Medium, A (found in 1d). `components/feed/CommentItem.tsx:167` wrote
`type: "take_comment"`; `reports_type_check` allows only user / post /
comment / take / community. Fixed in 1d (`type: "comment"` with `take_id`
set).

**X-6 The report dialog says "Report this post" for takes.** Low, C
(seen in the browser during 1d). `components/ui/ReportModal.tsx` copy is
post-only. Belongs to Phase 5 (V-4 copy drift).
