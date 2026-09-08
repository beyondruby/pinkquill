# Profile, feed and post view — system map

Written 2026-09-08 from the code on `main` (706a1ab) and the live database
(`loaitxbibjftsytlgddi`). Every claim about the database was verified with a
SELECT against production; every claim about the code has a `file:line`.
Screens were also opened in a browser against the local dev server (desktop
1456px and a 390px viewport) to confirm what users actually see. This
document describes what exists. Judgement is in `01-findings.md`; the fix
sequence is in `02-plan.md`; session state is in `03-progress.md`.

Reading order: §1 vocabulary → §2 studio profile → §3 home feed → §4 post view
(page + modal) → §5 take view (page + modal + vertical feed) → §6 shared
infrastructure → §7 file inventory.

Reactions and comments are documented in `docs/engagement/00-system-map.md`
and are only referenced here.

---

## 1. Vocabulary

| Word | Meaning in code |
|---|---|
| Studio / profile | `/studio/[username]`, `components/studio/StudioProfile.tsx` |
| Post | row in `posts` (types: thought, journal, visual, poem, quote, audio/voice, video, editorial, letter …); rendered by `PostCard` in the feed, by cards/tiles in the profile |
| Take | row in `takes`: short vertical video. Has its own feed `/takes`, page `/take/[id]`, modal `TakeDetailModal`, and tiles `TakePostCard` |
| Relay | repost (`relays` for posts, `take_relays` for takes) |
| Post view | the full page `/post/[id]` **and** `PostDetailModal` opened from a feed card or profile tile |
| Owner / visitor / guest | the logged-in profile owner / another logged-in user / logged-out |

---

## 2. Studio profile

### 2.1 Route → component chain

| Layer | File | Notes |
|---|---|---|
| Layout | `app/studio/layout.tsx:5-17` | Server: `MobileHeader` + `LeftSidebar` + `<main class="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[72px]">` + `MobileBottomNav` |
| Route error | `app/studio/error.tsx:5-7` | `RouteError` for all of `/studio/*`; no `[username]/error.tsx` |
| Route loading | `app/studio/[username]/loading.tsx:1-21` | Static skeleton, `max-w-4xl`, `h-48` cover, 96px avatar, hard-coded greys |
| Page (RSC) | `app/studio/[username]/page.tsx:32-35` | Awaits `params`, renders `<StudioProfileWrapper username>`; passes no data |
| Metadata | `page.tsx:9-30` | Server `profiles.select("display_name, bio")`; title `"${displayName} \| PinkQuill"`, description = bio or "Check out …'s studio on Quill."; no OG image |
| Wrapper | `components/studio/StudioProfileWrapper.tsx:11-21` | `ErrorBoundary section="Profile:${username}" resetKey={username}` → `ProfileErrorFallback` |
| Component | `components/studio/StudioProfile.tsx` | `"use client"`, 2896 lines, everything inline; imports `./studio.css` |
| Collection item | `app/studio/[username]/collections/[collection]/[item]/page.tsx:12-176` | Client page; re-runs `useProfile` only to get `profile.id`, then `useCollectionItem`; renders feed `PostCard`s |

SSR: the shell and `loading.tsx` are server rendered. `StudioProfile` SSRs its
`loading` branch (`useProfile` starts `loading:true`, `lib/hooks/useProfile.ts:27`),
so the shipped HTML is the full-screen "Loading profile" spinner
(`StudioProfile.tsx:1012-1018`), never content. The metadata fetch is not
reused on the client.

### 2.2 Sections in render order (`StudioProfile.tsx`)

Guards first: `if (loading)` → full-screen `<Loading text="Loading profile">`
(1012-1018). `if (error || !profile || isBlockedByUser)` → "User not found /
This user doesn't exist or is unavailable." (1020-1029).

1. **Cover** (1034-1062). `h-[200px] md:h-[320px]`; watercolour layer
   (`studio.css:139`), three animated petals (`globals.css:4672-4711`), two ink
   splashes (`studio.css:153`), `profile.cover_url` as a raw `<img alt="Cover"
   class="… opacity-30">` (1049-1055), paper texture, bottom fade.
2. **Header row** (1067-1223, `studio-section-animated delay-1`). Avatar raw
   `<img>` 96/160px with a remote Unsplash fallback (1071-1075); avatar glow
   animation; `.studio-avatar` forces `border: 4px solid white !important`
   (`globals.css:4767`). `h1` = `display_name || username` (1082), verified badge,
   `@username` (1093), tagline (1096-1100). Actions (1104-1222): logged-in
   visitor → Follow (label: Following / Requested / Request to Follow / Follow)
   + Message (label hidden on mobile); owner → `Link href="/settings"` "Edit
   Profile" (1153-1157); everyone → `ActionMenu`: Share, Copy link, Appearance
   (owner), Block/Unblock + Report (logged-in visitor). Guests get neither
   Follow nor Message nor a sign-in prompt (`!isOwnProfile && user`, 1105).
3. **Private notice** (1226-1263) when `isPrivateAccount && !isOwnProfile &&
   !isFollowing`: "This Account is Private" + a pending/non-pending sentence.
   A "Minimal Stats" block (1245-1260) sits inside it.
4. **Stats row** (1266-1297, `.studio-stats-enhanced`, `globals.css:4787`).
   Posts = `profile.works_count` rendered raw (1269); Followers / Following via
   `formatCount`, each a `<div onClick>` opening `FollowersModal` (1272-1291);
   Admires (1292-1295). Sources (`useProfile.ts:213-227`): works = length of
   the posts array *the viewer was allowed to fetch*; followers/following = two
   `head:true` counts on `follows status='accepted'`; admires = client-side sum
   of `reactions_count` over the fetched posts.
5. **About the Artist** (1300-1449). Only if bio/role/location/education/
   languages exist. Bio (1315-1319), details row (1322-1362), footer: social
   icons from `parseSocialLinks(profile.website)` (`lib/utils/social.ts:67`),
   community avatar stack (1393-1438 → Communities modal), "Joined Month Year"
   (1441-1444). Has a top accent line (1307).
6. **Tabs** (1455-1498), gated by `(!isPrivateAccount || isOwnProfile ||
   isFollowing)` (1452). `StudioTabButton` (733-761): Posts, Takes, Relays,
   Store, Commissions (`showCommissionsTab = isOwnProfile || hasCommissions ===
   true`, 857), Collections. Labels `hidden md:inline` (755) → icon-only on
   mobile; active = `text-accent-2` + 2px underline (756-758). No
   `role="tablist"`. Tab is read once from `?tab=` (844-849) and never written
   back.
7. **Posts tab** (1501-2331). Sub-tab chips All / Blog / Gallery / Poems /
   Journals / Communities (`StudioSubTabButton` 763-785) in an
   `overflow-x-auto scrollbar-hide` row (1504). Data = `posts` +
   `collaboratedPosts` merged (1539-1545), filtered (1549-1569), pinned-first
   only in "All" (1572-1583). Views: **All** = `grid-cols-1 sm:2 lg:3 gap-5`
   glass cards, `h-48` image or type icon, owner hover pin button, title/
   excerpt `line-clamp-2`, `ReactionCount`/`CommentCount`; cards start
   `opacity-0` until `useScrollReveal` (65-96, 1729). **Blog** = list
   (1952-2045). **Gallery** = `grid grid-cols-3 gap-1 sm:gap-2` square `<img>`
   tiles with hover counts (2048-2097). **Poems** = centred column
   (2100-2161). **Journals** = date groups (2164-2228). **Communities** =
   3-col cards (2231-2325). Every tile is `<article onClick>` →
   `openPostModal(createPostForModal(work))` (1650-1691).
8. **Takes tab** (2334-2355). "Loading takes" → "No takes yet..." →
   `<div class="takes-grid">` of `<TakePostCard variant="grid">`
   (`components/takes/TakePostCard.tsx:270-309`): `<article
   class="take-grid-card">` with `<img>` thumbnail, or a bare `<video src>`
   when `thumbnail_url` is null, plus a hover-only overlay with counts. CSS:
   `app/globals.css:6892-6950` (`.takes-grid { grid-template-columns:
   repeat(3,1fr); gap:1px; background:#000 }`, `.take-grid-card {
   aspect-ratio:9/16; background:#1a1a1a }`).
9. **Relays tab** (2358-2541). Sub-tabs Posts / Takes. Posts →
   `.studio-works-grid` (CSS `columns:3`, `studio.css:5`) of
   `.studio-relay-card` with "Relayed {timeAgo}" badge. Takes → the same
   `.takes-grid` (2523) of `TakePostCard isRelayed`.
10. **Store tab** (2544-2550) → `StoreTab` (`useSellerProducts`; owner status
    filters).
11. **Commissions tab** (2553-2559) → `CommissionsTab` (`useSellerCommissions`,
    `get_seller_stats`, availability probe).
12. **Collections tab** (2562-2641). `CollectionCard` (408-724): owner reorder
    ▲▼, collapse, owner Edit/Delete menu, items `grid-cols-2 sm:3 md:4` with
    hover overlay + owner hover delete.
13. **Pinned posts**: `usePinnedPosts(profile?.id)` (817), max 6; badge +
    owner hover pin buttons in the All view only.
14. **Modals**: `FollowersModal` (2648-2654, always mounted), `ShareModal`,
    inline Block confirm (2668-2706), inline Report (2709-2801, inserts
    `reports`), inline Communities (2804-2893). Edit is a route, not a modal.

### 2.3 Owner vs visitor vs guest

| Element | Owner | Visitor (logged in) | Guest |
|---|---|---|---|
| Follow / Message | hidden | shown | hidden, no sign-in prompt |
| Edit Profile | `/settings` → client redirect `/settings/profile` | hidden | hidden |
| ⋯ menu | Share, Copy link, Appearance | Share, Copy link, Block, Report | Share, Copy link |
| Posts fetched | all published, any visibility (`useProfile.ts:186`) | public + followers-only if accepted follow (187-191) | public |
| Posts / Admires stat | over all own posts | over the posts visible to that viewer | public only |
| Takes | all incl. private (`useTakes.ts:1002-1009`) | public + followers-only if **any** follow row exists (985-991, no status filter) | public |
| Commissions tab | always | only with an active service; hidden while `hasCommissions === null` | same |
| Store tab | always, with status filters | always | always |
| Pin buttons | hover buttons | badge only | badge only |
| Collections empty copy | "Create a collection… Go to Create Post…" | "{name} hasn't created any collections yet." | same |
| Followers modal | Unfollow buttons on Following tab | list | list |
| Profile-view tracking | skipped | POST after 2 s | POST with session id |

### 2.4 Data loading

Fired on mount, in this order:

1. `useProfile(username, user?.id)` (807; `useProfile.ts:39-248`), keyed on
   `username` only (248) — `viewerId` lives in a ref (36-37), so auth
   resolving *after* the first fetch does not refetch. Wave 1
   `profiles.select("*")` (61-66). Wave 2 (visitor) `blocks` + `follows
   accepted` in parallel (85-101). Private early-return (116-136). Wave 3: two
   head counts + posts (195-209); posts select (139-183) = `*` + author +
   media + community + flair + counter columns, ordered desc, **no limit**.
   Wave 4 (logged in) `fetchUserPostFlags` = `saves`/`relays`/`reactions`
   `.in(post_id)` (`lib/posts/enrich.ts:81-87`).
2. `checkFollowStatus` (867-875) — `follows` row, no status filter; duplicates
   wave 2. Deps `[user, profile, isOwnProfile]` re-run after every refetch.
3. `checkIsBlocked` (897-905) — `blocks` viewer→profile.
4. `useCommunities(profile?.id,'joined')` (813) — `community_members` (limit
   100) then `communities`; feeds only the About-box avatar stack.
5. `usePinnedPosts` (817) — `pinned_posts.select(*)`.
6. `fetchCollaboratedPosts` (908-920) — `post_collaborators` → `posts`, no
   limit, **not** passed through `enrichPost`.
7. `useHasCommissions` (856) — `products` limit 1.
8. `useFollowList(userId,"followers")` inside the always-mounted
   `FollowersModal` (2648; `FollowersModal.tsx:118`) — page 0 fetched while
   the modal is closed.
9. `useTrackProfileView` (861) — POST after 2 s (visitor/guest).

Round trips to first paint (excluding auth, metadata, assets): **owner 14,
visitor 19, guest 12**. Then per tab: Takes +6 (`useTakes.ts:957-1093`:
`profiles` → `follows` → `takes` no limit → 3 flag queries), Relays +2
(`useFeed.ts:455-627`: `profiles` → `relays` with nested post aggregates, no
limit), Relays→Takes +4, Collections +1, Store +1, Commissions +3.

Tab hooks are gated by passing `""`/`undefined` (803-806), which clears each
hook's state → a full refetch on every re-entry to the tab.

Realtime: only `useUserEvent("follow_change")` (879-894). Refetch triggers:
username change; a follow being accepted (891-893 **and** 1005-1010 → two
refetches); `refetchCollections()` after every collection mutation. Follow /
unfollow changes `followStatus` only (983-998) — the counts in the stats row
are not touched.

Indexes (live `pg_indexes`): `posts(author_id, created_at desc)`,
`follows(following_id,status)`, `follows(follower_id,status)`,
`follows(follower_id,following_id,status)`, `takes(author_id)`,
`take_relays(user_id)`, `relays(user_id, created_at desc)`,
`pinned_posts(user_id)`, `blocks(blocker_id,blocked_id)`,
`profiles(username)` — the hot filters are covered.

Live DB facts relevant to the profile: `profiles` SELECT policy is `USING
(true)`; the `anon` and `authenticated` roles hold column SELECT (and UPDATE)
on all 22 columns including `email` and `stripe_customer_id`. `takes_select`
= `auth.uid() IS NULL OR author_id = auth.uid() OR NOT EXISTS(blocks …)` —
no visibility or private-account clause. 6 of 8 takes in prod have no
`thumbnail_url`.

### 2.5 Loading / error / empty states

| Where | Loading | Error | Empty copy |
|---|---|---|---|
| Route | `loading.tsx` skeleton | `RouteError` / "Profile unavailable … Try Again" | — |
| Profile | full-screen "Loading profile" | any error, missing user, or block → "User not found" | — |
| Posts: All / Blog | — | — | "No posts yet..." |
| Gallery / Poems / Journals / Communities | — | — | "No visual posts yet..." / "No poems yet..." / "No journal entries yet..." / "No community posts yet..." |
| Takes | "Loading takes" | hook `error` ignored (811) → shows empty state | "No takes yet..." |
| Relays | "Loading relays" / "Loading relayed takes" | no error state | "No relayed posts yet..." / "No relayed takes yet..." |
| Store | "Opening the store" | "Failed to load products" | owner "Your shelf is still bare" + CTA; visitor "Nothing on the shelf yet" |
| Commissions | skeleton | "Failed to load commissions" | owner "No services yet" + CTA; visitor tab hidden |
| Collections | `<Loading/>` | ignored (814) | "No Collections Yet" |
| FollowersModal | spinner | swallowed | "No followers yet" / "Not following anyone yet" |

What the browser showed (dev server, 2026-09-08): after "Loading profile" the
header appears faded for ~0.7 s (entrance animation); clicking a tab leaves the
tab body blank for ~0.5 s then fades it in; a user with 1 take shows one dark
tile and two full-height black columns; a user with 2 takes shows one black
column; demo posts whose first media URL is dead render the alt text on a
grey box; navigating from a feed card to `/studio/hadi` briefly showed "User
not found" before the profile loaded.

### 2.6 Edit-profile flow

"Edit Profile" → `/settings` (1154) → client redirect to `/settings/profile`
(`app/settings/page.tsx:10-12`). The form (`app/settings/profile/page.tsx`)
is seeded from `useAuth().profile` (40-57). Fields: display_name (no
maxLength, 308-315), username (disabled), tagline (100), bio (500 +
counter), role / location / education / languages (no maxLength), social
links (stored as a JSON string in `profiles.website`, 177-180), cover,
avatar. Validation: ≤5 MB, type jpeg/png/gif/webp (70-94) while the input is
`accept="image/*"`. Upload: buckets `avatars`/`covers`, object name
`${user.id}-${Date.now()}.${ext}` with `ext = file.name.split(".").pop()`,
`upsert:true, cacheControl:'31536000'`, then `getPublicUrl`. Old objects are
never deleted. Save = `profiles.update(...).eq("id")` (182-196), success
banner for 3 s. `refreshProfile()` is **not** called, so the AuthProvider
profile (sidebar avatar) is stale until reload; the public page is fine
because `useProfile` reads the DB directly. No back link, no unsaved-changes
guard. Settings previews the cover at 100 % opacity; the profile paints it at
`opacity-30`.

### 2.7 Mobile vs desktop

Tailwind `md` (768) for header, `sm` (640) for grids; CSS 900/600 for
`.studio-works-grid` (`studio.css:10-21`). Cover 200 → 320 px; avatar 96 →
160 px and centred on mobile (1069); name/tagline centred; action buttons
wrap and centre (1104); Message label hidden (1148); tab labels hidden (755)
→ up to six icon-only tabs; stats centred `gap 1.5rem` → left `gap 3rem`
(`globals.css:4787-4801`). All-grid 1 → 2 → 3 columns; Gallery always 3;
Takes always 3 (the `max-width:768px` block at `globals.css:6900-6903`
repeats the desktop values); Relays 3 → 2 → 1; Collection items 2 → 3 → 4.
`MobileHeader` has logo, messages, notifications — no back button
(`MobileHeader.tsx:33-45`).

---

## 3. Home feed

### 3.1 Route → component chain

| Layer | File | Notes |
|---|---|---|
| Route | `app/(feed)/page.tsx:9-17` | Server component; `<ErrorBoundary section="HomeFeed" fallback={<FeedErrorFallback/>}><Feed/>`. Public: guests can browse, actions are gated at the point of action |
| Route loading | `app/(feed)/loading.tsx:3-10` | 3 × `PostSkeleton` in `max-w-2xl` |
| Route error | `app/(feed)/error.tsx:16-35` | "Something went wrong" + "Try Again" |
| Group layout | `app/(feed)/layout.tsx:12-29` | `MobileHeader`, `LeftSidebar`, `MainContent`, `ConditionalRightSidebar`, `MobileBottomNav` |
| Main column | `components/layout/MainContent.tsx:16-22` | `pt-16 pb-20 md:pt-0 md:pb-0 md:ml-[72px] lg:mr-[280px]` |
| Feed | `components/feed/Feed.tsx:207` | Client; the server only ever emits the skeleton branch because `AuthProvider` starts `loading=true` (`AuthProvider.tsx:92`) and `Feed.tsx:307` returns skeletons while `authLoading` |
| Data | `lib/hooks/useFeed.ts:46-288` | Direct PostgREST select, no RPC |
| Right rail | `ConditionalRightSidebar.tsx:26-50` → `RightSidebar.tsx` | Only on `/`; `lg:` only; data deferred by `requestIdleCallback` |
| View preference | `components/providers/FeedViewProvider.tsx:37-113` | SSR/hydration always `classic`; cookie adopted after mount; a fresh login resets to Classic (57-78) |
| Post modal | `components/providers/ModalProvider.tsx:129-362` | see §6.1 |

### 3.2 Composition

Above the posts there is **only** the fixed view-switcher pill
(`FeedViewMenu.tsx:87`: desktop `fixed top-6 md:top-8 right-4
lg:right-[296px] z-20`; mobile `fixed top-[60px] right-2 md:hidden`,
collapsed to one 28 px button, 117-156). No composer, no Following/For-you
tabs, no filters, no pinned posts, no inline suggested users; takes are not
rendered inline. `PostCard` accepts pinned/moderator props (`PostCard.tsx:73-77`)
but `Feed.tsx:391-395` never passes them.

Three views (`lib/feed-view/registry.ts:20-40`; containers `Feed.tsx:78-82`):

| id | label | container | renderer |
|---|---|---|---|
| `classic` (default) | Classic | `max-w-[580px]` | `Feed.tsx:385-397` → `<ErrorBoundary key=id><PostCard/>` |
| `compact` | Stream | `max-w-[780px]` | `StreamView.tsx:233-279`, grouped by day; row expands in place into a full `PostCard` (220-223) |
| `grid` | Gallery | `max-w-[1240px]` | `GalleryView.tsx:305-326`, JS-balanced masonry 2/3/4 columns |

Classic card per type (`PostCard.tsx:863-1070`, forms from
`lib/feed-view/post-type-theme.ts:39-51`): audio → gradient banner + sound
bars + `AudioPlayer`; video → `VideoPlayer` mounted immediately with
`preload="none"` (901-941); everything else → `FormBody`
(`PostCard/FormBody.tsx:175-203`: poem 12 lines, quote 360 chars, journal
320, editorial deck + read time, letter 380, default `TruncatedContent` 250)
then media: `visual` → `MediaCarousel` (`PostCard/MediaCarousel.tsx`), others
→ 2×2 grid capped at 4 with "+N" (971-1004). Header: community-first when
`post.community` (633-713), else avatar + "Name shared a thought" + time ago
(716-815). Action row (410-465): `[ReactionPicker][Comments][Relay — hidden
for own]` left, `[Share][Save]` right. `AuthorHeader` (631) and
`ContentSection` (819) are declared **inside** the component body.

### 3.3 Data loading

Initial query (`useFeed.ts:88-164`): `.from("posts").select("*, styling,
post_location, metadata, author:profiles!…, media:post_media,
collaborators:post_collaborators(user:profiles), mentions:post_mentions(user:
profiles), tags:post_tags(tag:tags(name)), community:communities,
flair:community_flairs, reactions_count, comments_count, relays_count,
reaction_counts").eq("status","published").order("created_at",
{ascending:false}).range(from,to)`. Page size 10 (`Feed.tsx:220`), **offset**
paging (`useFeed.ts:84-85`), chronological, no ranking. `retryWithBackoff`
×3. Then `fetchUserPostFlags` = three parallel queries (`enrich.ts:81-87`) →
**4 round trips per page** logged in, 1 as guest. `hasMore = length ===
pageSize` (200); `total` never populated. Prod index
`idx_posts_status_created` is used (verified). 44 published posts in prod.

Next page: `IntersectionObserver` on a 16 px sentinel, `rootMargin:"100px"`
(`Feed.tsx:257-267`); effect `if (inView && hasMore && !postsLoading)
loadMore()` (270-274). No dedupe on append (`useFeed.ts:186-192`); cap
`MAX_FEED_POSTS = 200` dropping from the **front** (188-190).

Freshness: no realtime. On `visibilitychange`/`focus` after 30 s,
`fetchPosts(0,false)` **replaces** the whole list (264-285). No
pull-to-refresh. Back navigation: all state is `useState` (49-56); returning
to `/` remounts → skeleton → page 0; there is no scroll-restoration code
anywhere. Auto-recovery: one `handleRefresh()` if the first page is still
loading at 12 s (`Feed.tsx:231-254`).

Cross-surface state: reaction and comment counts live in
`lib/engagement/store.ts` (one entry per `post:<id>`; card seeds at
`PostCard.tsx:98-101`, modal reads at `PostDetailModal.tsx:218`). Save/relay
state is local `useState` per card (`PostCard.tsx:103-105`) plus the
`ModalProvider.notifyUpdate` bus (`ModalProvider.tsx:210-240`). Deletes:
`subscribeToDeletes` → `deletedIds` filter (`Feed.tsx:277-289`).
Impressions: batched `post_impressions` inserts per mount, `record_content_view`
after 1 s at ≥50 % visibility (`useTracking.ts:276-416`).

### 3.4 State changes on scroll, tap, refresh

| Trigger | What changes | Where |
|---|---|---|
| Mount (auth resolving) | skeletons | `Feed.tsx:307` |
| Auth resolved | `fetchPosts(0)`; list replaced | `useFeed.ts:238-257` |
| Sentinel in view | `loadMore()`; bottom spinner | `Feed.tsx:270-274, 407-411` |
| 200 posts | newest posts dropped | `useFeed.ts:188-190` |
| Tab refocus ≥30 s | replace with page 0; sentinel usually in view → page 1 refetched | `useFeed.ts:270-277` |
| Tap card / Comments / Continue reading / media | `openPostModal(snapshot)` + `pushState('/post/<id>')` | `PostCard.tsx:172-193`, `ModalProvider.tsx:147-156` |
| Close modal (X / Esc / backdrop) | `pushState(originalUrl)` — a second history entry | `ModalProvider.tsx:158-167` |
| Browser back while modal open | `popstate` closes the modal | `ModalProvider.tsx:192-208` |
| React | store optimistic → RPC → server counts | `store.ts:409-474` |
| Save / relay (card) | local state + `notifyUpdate`; DB; toast; revert on error | `PostCard.tsx:207-277` |
| Delete / block / mod-delete | `onPostDeleted(id)` → `deletedIds` | `PostCard.tsx:279-315, 369-385` |
| View switch | cookie + `profiles.feed_view_preference`; renderer swap | `FeedViewProvider.tsx:80-101` |
| Card render error | per-card boundary "This post couldn't be displayed / Try again" | `Feed.tsx:386-390` |

### 3.5 Media

Images: `next/image` everywhere in the feed (grid `400×400 sizes="(max-width:
640px) 90vw, 600px" loading="lazy"`, `PostCard.tsx:989-998`; carousel
`1200×800`, slide 0 eager, `MediaCarousel.tsx:72-82`; gallery `fill`).
No blur placeholders. `remotePatterns` = `**.supabase.co`,
`images.unsplash.com`. Videos: `VideoPlayer` — no autoplay, `preload="none"`
(486), one at a time via a window `CustomEvent` (236-243), pauses below 20 %
visibility, volume in `localStorage`. Video *thumbnails* in non-video posts
are raw `<video preload="metadata">` (`PostCard.tsx:983`, `StreamView.tsx:186`,
`GalleryView.tsx:104-114`). Audio: `AudioPlayer` with its own registry;
audio and video registries do not know about each other. Carousel: translateX,
swipe ≥40 px, arrow keys, `n / N` counter, 7 px dots, 38 px prev/next hidden
until hover but forced visible on `(hover:none)` (`post-card.css:200-213`).

### 3.6 Loading, error, empty states

| State | Copy | Where |
|---|---|---|
| First load (Classic) | 3 × `PostSkeleton` | `Feed.tsx:312-313` |
| First load (Stream/Gallery) | 6 × `h-32` / 8 × bento pulse boxes | `Feed.tsx:314-330` |
| Next page | centred `Spinner size="xl"` | `Feed.tsx:407-411` |
| End | "You've reached the end of the feed" | `Feed.tsx:413-419` |
| Empty | "The canvas awaits" / "No posts yet. Be the first to share your creative voice." / "Create Something" → `/create` | `Feed.tsx:355-377` |
| Query error | categorized message + "Try Again" | `Feed.tsx:336-353` |
| Feed render error | "Couldn't load feed" — no button (`page.tsx:13` passes no `onRetry`) | `ErrorFallbacks.tsx:31-67` |
| Content warning | amber chip + "Show Content" | `PostCard.tsx:819-850` |

Skeleton vs card: skeleton radius 16 / padding 24 / hard-coded greys
(`PostSkeleton.tsx:32-37, 51, 111`) vs card radius 22 (18 mobile)
(`Feed.tsx:96-107`); `loading.tsx` column is `max-w-2xl` (672 px) vs 580 px.

### 3.7 Mobile vs desktop

Desktop main = viewport − 72 − 280; column 580/780/1240. Mobile full width
`px-4`. Fixed chrome: `MobileHeader` `h-14 z-50`, `MobileBottomNav` `h-16
z-50` with a `safe-area-bottom` class that is **not defined** in any CSS
file, `FeedViewMenu` fixed on both breakpoints, `LeftSidebar` `fixed z-[100]`
expanding 72 → 220 px on hover over the content. In the browser at 390 px the
view pill sits over the top-right corner of the first card.

---

## 4. Post view — page and modal

### 4.1 Entry points

| Entry | Surface | URL / history | Back / Escape / backdrop | Underlying list keeps scroll? |
|---|---|---|---|---|
| Feed card tap (`PostCard.tsx:171-193`; Stream/Gallery via `useTileActions.ts:45-63`) | `PostDetailModal` (dynamic import, `ModalProvider.tsx:116`) | `pushState({postId}, '', /post/{id})` (`:152`); **close pushes again** (`:161`) | `popstate` closes (`:192-208`); Escape/backdrop → `onClose` via `useDialog` | Yes — feed stays mounted, body scroll locked (`lib/hooks/useDialog.ts:18-21`) |
| Profile tile tap (`StudioProfile.tsx:1728, 1971, 2057, 2116, 2202, 2244, 2439`) | same modal, fed by `createPostForModal` (1650-1691) | same | same | Yes |
| Saved / Explore / collections item | same modal | same | same | Yes |
| Direct URL, share link, DM `SharedPostCard`, create-post redirect | full page `app/post/[id]/page.tsx` | normal navigation | leaves the page; no back affordance | No — feed remounts |
| Notification link (`NotificationPanel.tsx:951-970`) → `/post/{id}?comment=…&reply=1` | full page (never the modal) | normal | — | No |

`openPostModal` stores `pathname + search` (`ModalProvider.tsx:149`)
unconditionally (not guarded by `isModalOpen`), pushes `/post/{id}`;
`closePostModal` **pushes** the stored URL back rather than calling
`history.back()`, so every open/close leaves `[feed, /post/x, feed]`. The
popstate handler only closes; it never re-opens a modal when the user
navigates forward to a `/post/x` entry. Next ≥14.1 syncs external
`pushState` into `usePathname`, so `ConditionalRightSidebar` (renders only
when `pathname === "/"`) and `MobileBottomNav` (active state by pathname)
re-render under the modal.

### 4.2 Render order

**Page** (`app/post/[id]/page.tsx:748-1308`): `MobileHeader` (no back
button) + `LeftSidebar`; author row with raw `<img>` avatar (Unsplash
fallback), name, flair, type phrase from a local `getTypeLabel` (153-168),
time ago, `ActionMenu` (only when `user`); `?media_failed=` notice;
background layer; journal header (852-929); Spotify iframe; `<h1>` title;
body via `cleanHtmlForDisplay` (965-976), no truncation; `AudioPlayer`;
media gallery = current item (`VideoPlayer maxHeight 500` or `<img
object-cover max-h-[500px]>` → lightbox), always-visible prev/next arrows
without `aria-label`, caption, thumbnail strip in a `flex gap-2
justify-center` row with no wrap or overflow (1034); content-warning
overlay; `PostTags`; action row = `ReactionPicker` (`disabled={!user}`) ·
Comment pill **with no onClick** (1112-1118) · Relay (hidden for owner) ·
Share · Save (1098-1157). Right column `lg:sticky top-[86px]`: "Discussion
(N)", list, composer `sticky bottom-0` with no z-index (1219) or "Sign in to
comment" → `/login` without a redirect param.

**Modal** (`components/feed/PostDetailModal.tsx:555-1251`) inside `Modal`
(`w-full h-full md:w-[95%] md:max-w-[1000px] md:h-[90vh]`, `Modal.tsx:27`;
`Modal` renders **no close button**): background layer; header with a
mobile-only back chevron (`md:hidden`, 591-605), `next/image` avatar, name,
flair, `PostTypeChip variant="label"`, `timeAgo` string from the card, a
desktop-only "Discussion" button with badge (`hidden md:flex`, 644-653),
`ActionMenu` (only when `user`); journal header only if `createdAt` was
passed; a non-journal location line the page does not have (762-770);
Spotify; `<h2>` title; body via `createSafeHtml`; `AudioPlayer`; media =
`VideoPlayer maxHeight 450` or `next/image 900×500 object-cover
max-h-[450px]` with arrows `opacity-0 group-hover:opacity-100`
(867, 876), Roman-numeral caption, thumbnail strip (895); a dead legacy
`post.image` branch (926-936); content-warning overlay gated on
`post.contentWarning` (939); `PostTags`; action row = `ReactionPicker` (not
disabled) · Comment → `setShowComments(true)` · Relay (hidden when `user?.id
=== authorId`, `authorId` optional) · Share · Save (986-1070);
`.discussion-panel` only when `showComments` (starts `false`, 173).

Page vs modal differences (same post): data source (page fetches, modal
never fetches); type phrase; time source; `h1` vs `h2`; sanitiser; location
line; media arrows; `<img>` vs `next/image`; caption style; owner menu
(Share/Copy/Edit/Delete vs Edit/Delete); visitor menu (Share/Copy/Block/
Report vs Block/Report); guest reaction (disabled vs auth modal); comment
pill (no-op vs opens panel); comments (always vs hidden); delete copy
("Delete Post?" vs "Erase this from your studio?"); block copy; after delete
(`router.push("/")` vs `onClose` + `onPostDeleted`, consumed only by
`Feed.tsx`); `?comment=` deep link (page only).

### 4.3 Data loading

Page (`page.tsx:272-468`), after auth settles: `posts.select("*", author,
media, community, flair).eq(id).single()` (RLS `posts_select_policy`
enforces visibility, followers and blocks server-side); collaborator lookup
for drafts; `Promise.all` of mentions, tags, collaborators, viewer relay,
viewer save; `useComments("post", id, {live:true})` page 0 of 30 + viewer
likes; `useReaction` batched RPC + live channel `content-events:post:{id}`.
The report handler re-selects `community_id` (560-564).

Modal: **no post fetch**; seeded from the opener. `Feed.tsx:29-72` passes
contentWarning, createdAt, media, mentions, hashtags, collaborators,
styling, location, metadata, spotify_track. `StudioProfile.createPostForModal`
(1650-1691) passes **none of** contentWarning / mentions / hashtags /
spotify_track. Comments page 0 is fetched on mount although the panel is
hidden (173, 194-204). Save/relay flow back through `onPostUpdate` →
`notifyUpdate` (`ModalProvider.tsx:219-240`); `PostCard` and `useTileActions`
subscribe, `StudioProfile` does not (no `subscribeToUpdates` /
`subscribeToDeletes` in that file).

### 4.4 Media, keyboard, states

Page image: `<img class="w-full max-h-[500px] object-cover">` (997-1006), no
`sizes`, `alt=""`; modal: `next/image` with `sizes`, mobile CSS caps at 260
px (`globals.css:2790-2793`). Both crop tall images; the full image is only
in `Lightbox`. Carousel index shown only by the thumbnail strip — no `n/N`,
no swipe, no keyboard. Keyboard: modal Escape closes, Tab trapped, focus
restored (`useDialog.ts:33-60`); page has no Escape/back key.

States: page loading "Unfolding the page" with full chrome (667-682); not
found / RLS-hidden / network failure all render "Post not found — This post
may have been removed or doesn't exist. — Back to feed" (685-704; the
internal "Failed to load post" string is never shown). Modal: nothing
visible until the dynamic chunk loads (`dynamic(..., {ssr:false})` without
`loading`). Deleted post: hard delete → "Post not found"; the feed card is
removed only if `Feed.tsx` was the opener. No comments: "No comments yet /
Be the first to share what you think." Long caption/title: no truncation,
no expand. 20 images (prod max): thumbnail strip clipped on both ends.
Mobile modal styling: ~400 lines of `!important` overrides keyed on Tailwind
utility selectors (`globals.css:2635-3047`).

---

## 5. Take view — page, modal, vertical feed

### 5.1 Surfaces

| | `/take/[id]` (`app/take/[id]/page.tsx`) | `TakeDetailModal` | `TakeCard` (vertical feed `/takes`) | `TakePostCard` (home feed / profile) |
|---|---|---|---|---|
| Chrome | `LeftSidebar` only — no `MobileHeader`/`MobileBottomNav`, but `main` keeps `pt-14 pb-20` (561) | `Modal`, `p-10` column, no `md:` variants, **no close/back control** | full-screen snap feed; mobile "back" is `<Link href="/">` (`TakesFeed.tsx:279-287`) | card in feed; grid tile in profile |
| Player | raw `<video>` 9:16 `object-cover`, `muted={useMuted}` + `useVolume` (636-645) | raw `<video object-contain maxHeight 480>`, local `isMuted=true` (65), autoplays on open (172-177) | `TakePlayer` (sound track, speed, filter, progress, double-tap) | raw `<video muted loop>` hover-play; grid = `<img>` thumbnail or bare `<video src>` |
| sound / playback_speed / effects honoured | no | no | yes (`TakePlayer.tsx:72-152, 257-294`) | no |
| `aspect_ratio` / `text_overlays` | never read anywhere | | | |
| Actions | React · Comment (no-op) · Relay · ⋯ · Share · Save | React · Comment · Relay (always rendered, disabled for owner) · ⋯ · Share · Save | vertical: Avatar+Follow · React · Comment · Save · Relay · Share | React · Comment · Relay · ⋯ · Share · Save |
| Menu | Delete / Block, Report | Delete / Report | Share, Copy link, Not interested, Delete, Report | Delete / Block, Report |
| Follow | header button (591-602) — inserts into `follows` directly (400-404) | none | badge on avatar via `followUserRecord` | none |
| Views tracked | no | no | `useTrackTakeView` + impression (`TakeCard.tsx:91-102`) | no |
| Report payload | `take_id, reported_user_id, reason+details` | `take_id, reason, details` | `useTakes.reportTake` | **`reported_post_id: take.id`** (`TakePostCard.tsx:204-210`) |

### 5.2 Data loading

Page (`take/[id]/page.tsx:157-324`), sequential: `takes.select("*").single()`
→ (followers-only) `follows count` → `profiles.is_private` → (private)
`follows count` again → author `profiles` → `Promise.all(take_tags,
take_collaborators, take_mentions)` → collaborator profiles → mention
profiles → (`user`) `Promise.all(take_saves, take_relays, follows count)` —
up to 11 round trips, `follows` up to three times. Because `takes_select`
only filters blocks (verified live), these visibility checks run *after* the
row has been returned. Then `useComments("take")` + `useReaction("take")`.

Modal: no take fetch (seeded from `TakePostCard.handleOpenModal`, 108-118);
metadata effect on `[take?.id]` (`TakeDetailModal.tsx:113-168`) = 3 parallel
+ up to 2 profile queries, no abort; comments fetched on mount regardless of
the panel.

Vertical feed: `get_takes_feed(p_viewer_id, p_limit=10, p_offset,
p_community_id, p_sound_id, p_author_id, p_initial_take_id)`
(`useTakes.ts:326-336`; SQL `20260911_engagement_phase5_load.sql:281-397`):
public takes only, `LIMIT LEAST(p_limit,30) OFFSET`, initial take prepended
on page 0. `useTakesFollowing.checkFollowing` re-queries `follows` for every
author on every `visibleTakes` change (`TakesFeed.tsx:64-69`).

### 5.3 Vertical feed behaviour

`.tiktok-feed` `height:100vh; scroll-snap-type:y mandatory`
(`globals.css:5470-5476`); IO threshold 0.6 sets `activeIndex`
(`TakesFeed.tsx:97-115`); `activeIndex >= len-2` → `fetchMore` (117-121).
Cards within ±2 of active mount `TakeCard`, others a placeholder (343-372);
up to 5 `<video>` + 5 `<audio>` exist. `?id=` deep link: `p_initial_take_id`
puts the take first, then an effect keyed on `[initialTakeId, visibleTakes]`
scrolls to it (85-94). Keyboard: `ArrowDown/j`, `ArrowUp/k`, `m`, `l`, `c`,
`Escape` (123-166). Comments: `TakeCommentsPanel` — desktop 380 px right
panel, mobile 85vh bottom sheet with backdrop; no dialog role or focus trap.
"Not interested" is component state only (33), reset on filter change.

### 5.4 States

Page loading "Loading the take" (523-536); any failure → "Take not found —
This take may have been removed or doesn't exist. — Browse Takes"
(539-556) — the computed strings "This take is private", "You must be logged
in…", "…only visible to followers", "…from a private account", "Failed to
load take" are never rendered. Feed: skeleton card; "Failed to load Takes" +
"Try again"; after 10 s "Takes are taking too long to load. Please try
again."; empty "No Takes yet / Be the first to share a Take!" (also for an
empty `?community=`/`?sound=` result). `TakeCard` caption: 10-word
truncation + more/less; `TakePostCard`: 200 chars + "…" with no expand;
page/modal: full caption, no truncation.

---

## 6. Shared infrastructure

### 6.1 ModalProvider (`components/providers/ModalProvider.tsx`)

Holds `selectedPost` / `selectedTake`, `openPostModal` (147-156),
`closePostModal` (158-167), `openTakeModal` (169-178), `closeTakeModal`
(180-190), a `popstate` listener (192-208), and two pub/sub buses:
`notifyUpdate`/`subscribeToUpdates` (saves, relays) and
`notifyDelete`/`subscribeToDeletes`, plus take equivalents. Consumers:
`PostCard` (updates), `useTileActions` (saves only), `Feed.tsx` (deletes).
`subscribeToTakeDeletes` has no consumer. `PostDetailModal` and
`TakeDetailModal` are `dynamic(..., { ssr:false })` without a `loading`
component (116-117). Context value is memoised (307-335).

### 6.2 Engagement store (`lib/engagement/store.ts`)

One entry per `post:<id>` / `take:<id>`: total, mine, counts, comments.
Every surface (`ReactionCount`, `CommentCount`, `ReactionPicker`,
`useReaction`) reads the same entry; seeds from list rows mark
`totalLoaded`; unknown ids are batched into one `get_post_reaction_summary`
RPC per tick (281-303). A seeded **0** is treated as loaded (169-181).

### 6.3 Dialog behaviour (`lib/hooks/useDialog.ts`)

Stack of open dialogs; sets `document.body.style.overflow="hidden"` on open
and restores the previous value when the stack empties (18-21, 58); Escape,
Tab trap and focus restore (33-60). `NotificationPanel`, `MobileMoreSheet`
and `NewMessageModal` write `body.style.overflow` directly instead.

### 6.4 Post → modal mappers

`Feed.tsx:29-72`, `StudioProfile.tsx:1650-1691` and `:2391-2416` (relays),
`app/(feed)/saved/page.tsx:202-232`, `components/explore/ExplorePageContent.tsx:254-301`,
`app/studio/[username]/collections/[collection]/[item]/page.tsx:60-75`. Three
`Post` interfaces: `ModalProvider.tsx:34-70`, `PostDetailModal.tsx:92-125`,
`app/post/[id]/page.tsx:86-106`.

### 6.5 CSS layers

The same elements are styled from three places: Tailwind classes in TSX,
`components/feed/post-card.css` / `components/studio/studio.css` /
`components/takes/takes.css`, and `app/globals.css` (studio block
4665-5099, post modal block 2130-2475 + 2635-3047, takes block 5176-6480 +
6892-6950). `.takes-grid` and `.take-grid-*` live in `globals.css` while
`TakePostCard` imports `takes.css`.

---

## 7. File inventory

| Area | Files (lines) |
|---|---|
| Profile | `components/studio/StudioProfile.tsx` (2896), `StudioProfileWrapper.tsx` (21), `FollowersModal.tsx` (200), `studio.css` (176); `app/studio/**` (5 files); `lib/hooks/useProfile.ts` (695), `usePinnedPosts.ts` (345), `useSellerProfile.ts` (197, unused by the page); `app/settings/profile/page.tsx` |
| Feed | `components/feed/Feed.tsx` (423), `PostCard.tsx` (1286), `PostCard/*` (15 files), `StreamView.tsx` (281), `GalleryView.tsx` (328), `FeedViewMenu.tsx`, `FeedViewPicker.tsx`, `PostSkeleton.tsx` (146), `VideoPlayer.tsx` (669), `AudioPlayer.tsx` (489), `post-card.css` (453), `video-player.css` (385), `useTileActions.ts`; `lib/hooks/useFeed.ts` (630); `lib/feed-view/*`; `components/layout/*` |
| Post view | `app/post/[id]/page.tsx` (1310), `layout.tsx`; `components/feed/PostDetailModal.tsx` (1257); `components/providers/ModalProvider.tsx` (361); `components/ui/Modal.tsx`; `lib/hooks/useDialog.ts` |
| Take view | `app/take/[id]/page.tsx` (912); `app/takes/**`; `components/takes/TakeDetailModal.tsx` (714), `TakePlayer.tsx` (355), `TakeCard.tsx` (524), `TakePostCard.tsx` (531), `TakesFeed.tsx` (394), `TakeCommentsPanel.tsx` (204), `takes.css` (581); `lib/hooks/useTakes.ts` (1525) |
| Shared | `lib/posts/enrich.ts`, `lib/engagement/*`, `lib/hooks/useComments.ts`, `lib/hooks/useInteractions.ts`, `app/globals.css` (≈7000 lines) |
