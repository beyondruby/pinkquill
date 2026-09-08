# Profile, feed and post view — fix plan

Written 2026-09-08 from `01-findings.md`. Nothing in this plan has been
started. Every change below points at a finding id; a change with no finding
behind it does not happen.

## Rules this plan is bound by

**Design.** The current look and feel stays: same colours, fonts, spacing
scale, radii, shadows, icons and components. This plan fixes the profile,
feed and post view; it does not restyle them. Most changes remove, align,
tighten or fix. Where a fix appears to need a new visual element, colour,
component style or layout pattern, the plan says so and stops for a decision
(see "Decisions needed" at the end). Test for every change: before and after
side by side must look like the same app with fewer things wrong.

**Phases.** Phase 1 is bugs and correctness only, starting with the
empty-grid bug; nothing cosmetic. Phase 2 is technical quality. Phases 3–5
are UI/UX, one screen each: profile, then feed, then post view. Each
sub-phase fixes one root cause everywhere it appears, finishes in one
session, and leaves the app working and committed. Before any UI/UX
sub-phase, every change is described in one plain sentence and approved;
after every sub-phase `03-progress.md` is updated so a fresh session can
continue from the file alone.

**Verification.** Every sub-phase ends with `npm run lint`, `npx tsc
--noEmit`, the existing tests (`npm test`), and a browser check of the
screens it touched at desktop width and 390 px (the iframe trick used in
the audit works: open any page, replace the body with three 390 px iframes).
Profiles to use: `hadi` (owner, 1 take, 30 posts), `hii` (visitor view, 2
takes), `poet1` (5 takes), `poet` (0 takes), `test` (0 posts).

**Money paths are frozen** (memory): nothing in this plan touches
`app/api/checkout/*`, payments, payouts, Stripe webhooks or the checkout
hooks.

---

## Phase 1 — Bugs and correctness

### 1a — Takes grid: stop painting the gutter (RC-1) — start here

Findings: **P-1**.

Changes:
1. `app/globals.css:6892-6897`: remove `background: #000` from `.takes-grid`.
   The 1 px gap stays and is now transparent, so a row with one or two takes
   shows one or two tiles and nothing else.
2. `app/globals.css:6899-6904`: delete the mobile block that repeats the
   desktop values (no-op).
3. No change to `.take-grid-card` (9:16, `#1a1a1a` while the thumbnail loads
   — that is the existing tile look).

Files: `app/globals.css`. Both consumers (`StudioProfile.tsx:2348`, `:2523`)
are fixed by the one rule.

Verify: Takes tab for `hadi` (1), `hii` (2), `poet1` (5), `poet` (0 → "No
takes yet..."); Relays → Takes for a user with relayed takes; desktop and
390 px. Screenshot before/after.

Commit: `fix(profile): stop the takes grid painting empty columns black`.

### 1b — Row policies and column grants (RC-2)

Findings: **P-2**, **V-24**. Both need a database change, so this sub-phase
starts by showing the exact SQL and waits for approval before applying it
to production.

Changes:
1. Client: replace `profiles.select("*")` with an explicit column list
   (everything the profile renders, never `email`/`stripe_customer_id`) in
   `lib/hooks/useProfile.ts:61-66`, `lib/hooks/useTakes.ts:969-973,
   1115-1119`, `lib/hooks/useFeed.ts:485-490`, `app/take/[id]/page.tsx:246-250`,
   and the collections item page. Grep every other `from("profiles")` and
   list what still reads those two columns (settings/account and money paths
   are expected; they use the owner's own row).
2. DB (after approval): `REVOKE SELECT (email, stripe_customer_id) ON
   public.profiles FROM anon, authenticated` plus a `SECURITY DEFINER`
   accessor or an owner-only view for the two legitimate readers found in
   step 1, if any read them client-side. If any of the frozen money paths
   read `stripe_customer_id` through the service role, they are unaffected
   (service role bypasses grants) — confirm before applying.
3. DB (after approval): replace `takes_select` with a policy that mirrors
   `posts_select_policy`: public takes for everyone; followers-only takes
   for accepted followers; private takes for the author; plus the existing
   block clause and a private-account clause. Then delete the now-redundant
   client checks in `app/take/[id]/page.tsx:180-243` and
   `useTakes.ts:985-1009` (they become "not found" handling).

Files: the five hooks/pages above; one migration
`supabase/migrations/2026MMDD_profile_phase1b_grants.sql`.

Verify: as `anon` via REST, fetch a profile and confirm the two columns are
absent; as the seller account, load a followers-only take of a user they do
not follow and confirm "not found"; owner still sees their private takes.

### 1c — Loading and error state decided by the wrong signal (RC-3)

Findings: **X-1**, **P-20**, **V-48**, **F-13**, **F-31**.

Changes:
1. `useProfile.ts:239-246`: only the fetch that owns the current
   `AbortController` may clear `loading` (compare `signal` to
   `abortControllerRef.current.signal` in `finally`). Same pattern in the
   three tab hooks if they share it.
2. `StudioProfile.tsx:811-814`: read the `error` from `useUserTakes`,
   `useRelayedTakes`, `useCollections`; add an `error` to `useRelays`
   (`useFeed.ts:614-616`); render the existing error fallback
   (`ProfileErrorFallback` / the Store tab's error block) instead of the
   empty state.
3. `app/take/[id]/page.tsx:539-556` and `app/post/[id]/page.tsx:685-704`:
   render the computed `error` string with the existing "Try again" button
   from `RouteError` for network failures; keep "not found" only for a
   missing row.
4. `app/(feed)/page.tsx:13`: pass `onRetry` to `FeedErrorFallback`.
5. `Feed.tsx:242-248`: show the existing retry spinner text when the 12 s
   auto-retry fires.

Files: `lib/hooks/useProfile.ts`, `useTakes.ts`, `useFeed.ts`,
`useCollections.ts`, `components/studio/StudioProfile.tsx`,
`app/take/[id]/page.tsx`, `app/post/[id]/page.tsx`, `app/(feed)/page.tsx`,
`components/feed/Feed.tsx`.

Verify: navigate feed → profile → feed → profile rapidly, no "User not found"
flash; kill the network and open the Takes tab → error state with retry.

### 1d — Writes that never check the result (RC-4)

Findings: **V-17**, **P-19**, **V-15**, **V-16**, **P-21**.

Changes:
1. `TakePostCard.tsx:204-210`: insert `take_id` and `reported_user_id`, not
   `reported_post_id`. Unify the report payload shape across the six report
   handlers (same columns, `details` separate from `reason`).
2. Every `await supabase.from(...).insert/update/delete` in the listed
   locations checks `{ error }` and reverts the optimistic state plus shows
   `actionToast` (the existing helper) on failure: `StudioProfile.tsx:963-968`,
   `TakeDetailModal.tsx:265-278, 297-311`, `TakePostCard.tsx:134-147,
   167-181`, `useTakes.ts:573-586, 606-620, 784-800`,
   `app/take/[id]/page.tsx:366-404`; post page/modal `handleSave` read the
   boolean from `toggleSave`.
3. Delete/block handlers on both pages and both modals surface failure via
   `actionToast` and keep the dialog open only while pending.
4. `StudioProfile.tsx:2623-2633`: collection mutations toast on error.

Files: as listed. Verify: report a take from the feed card as the seller and
confirm the row in `reports` with `take_id`; force an RLS failure (save a
take as guest via devtools) and confirm the revert.

### 1e — No in-flight guard on toggles (RC-5)

Findings: **F-9**, **P-6**.

Changes: `pendingRef` pattern (memory) in `PostCard.handleSave`/`handleRelay`
(207-277) using the latest state, matching `useTileActions.ts:75-81`;
`try/finally` around `handleFollow` (`StudioProfile.tsx:983-998`). Files:
`components/feed/PostCard.tsx`, `components/studio/StudioProfile.tsx`.

### 1f — One post → modal mapper, one modal `Post` type (RC-6)

Findings: **V-1**, **V-2**, **V-5 / P-29 / F-32**, **V-3**, **V-14**,
**V-49**.

Changes:
1. Move `Feed.tsx:29-72` to `lib/posts/toModalPost.ts` (name to match the
   existing `lib/posts/enrich.ts`), typed against the `Post` in
   `ModalProvider.tsx`; delete the `Post` copies in `PostDetailModal.tsx:92-125`
   and `app/post/[id]/page.tsx:86-106` in favour of it.
2. Use it in all six openers: `Feed.tsx`, `StudioProfile.tsx:1650-1691` and
   `:2391-2416`, `app/(feed)/saved/page.tsx`, `ExplorePageContent.tsx`,
   the collections item page. This carries `contentWarning`, `mentions`,
   `hashtags`, `spotify_track`, `authorId` and `typeLabel` from
   `post-type-theme.ts` everywhere.
3. `formatCount` → one export in `lib/utils` (pick the existing "1.2K"
   output used by takes and the feed); delete the five copies.
   `decodeHtmlEntities` → `lib/utils/sanitize`. Inline
   `toLocaleDateString` calls → `lib/utils/time`.
4. `app/post/[id]/page.tsx:153-168`: use `getPostTypePhrase`.
5. `PostDetailModal`: make `authorId` required on the modal `Post`.

Files: as listed plus `lib/posts/toModalPost.ts` (new module, no UI).
Verify: open the same content-warned post from the feed and from the
profile Gallery; both show the interstitial; hashtags and Spotify embed
present from both.

### 1g — Modal history (RC-7)

Findings: **V-6 / F-6**, **V-7**, **V-8**, **V-46**.

Changes:
1. `ModalProvider.tsx:147-190`: on open, if a modal is already open do not
   overwrite `originalUrlRef`; push exactly one entry with a marker in
   `history.state`. On close, if `history.state` carries our marker call
   `history.back()` and let `popstate` finish the close; otherwise (deep
   link, reload) replace state with the original URL. Result: one entry per
   open, none left behind.
2. Confirm in the browser whether `usePathname` changes under the modal
   (V-8); if it does, have `ConditionalRightSidebar` and `MobileBottomNav`
   treat the modal-open state as "still on the feed" using the existing
   `useModal()` context.
3. `ModalProvider.tsx:116-117`: give the two `dynamic()` imports the existing
   `Loading` component as `loading`.
4. Extend `ModalProvider.test.tsx` to assert history length and URL after
   open → close and after open → Back.

Files: `components/providers/ModalProvider.tsx`, `ModalProvider.test.tsx`,
`components/layout/ConditionalRightSidebar.tsx`, `MobileBottomNav.tsx`.

### 1h — Pub/sub wiring and the card memo (RC-8)

Findings: **V-9**, **V-10**, **F-14**, **F-16**, **V-11**, **F-17**, **F-18**.

Changes: subscribe `StudioProfile`, `saved/page.tsx`, `ExplorePageContent`
and the collections page to `subscribeToDeletes` / `subscribeToUpdates`
(remove tile, update flags); add a `subscribeToTakeDeletes` consumer in
`StudioProfile` and `TakePostCard`'s parents; `PostCard.tsx:373-380` on
block removes every card by that author (the feed already has
`deletedIds`; add an `authorId` filter); `PostCard.tsx:1267-1284` comparator
also compares `title`, `content`, `media`, `contentWarning`, `styling`;
`StreamView.tsx:125` and `PostCard.tsx:1120-1125` read counts from the store.

### 1i — Follow relationship computed three ways (RC-9)

Findings: **P-4**, **P-5**, **V-23**, **P-13**, **P-7**, **P-8**, **P-47**.

Changes: `useTakes.ts:985-991` filter `status='accepted'`; `handleFollow`
and `FollowersModal.handleUnfollow` adjust `followers_count` locally (with
revert on error) and the `follow_change` event refetches only the counts,
not the whole profile; `app/take/[id]/page.tsx:400-404` uses
`followUserRecord` / `unfollow` from `useProfile.ts`; followers list adds
`.order("created_at", { ascending:false })` and merges the two effects;
delete the duplicate follow/block queries in `StudioProfile.tsx:867-875`
(use `useProfile`'s result) and route every unfollow through the one helper.

### 1j — Build posts through `enrichPost`; stats from the server (RC-10)

Findings: **P-3**, **P-9**, **P-14**, **P-22**, **P-46**.

Changes: `useFeed.ts:500-533` select the counter columns and
`styling/post_location/metadata` and run rows through `enrichPost` with
`fetchUserPostFlags`; `hooks.legacy.ts:2291-2296` same for collaborated
posts; Posts stat = `count: "exact", head: true` on the author's published
posts, Admires = the server sum (an RPC already returns seller stats; add a
small `get_profile_counts` only if no existing RPC covers it — DB change,
ask first); profile tiles pick the first `media_type === "image"` item the
way `GalleryView.tsx:88-123` does, and fall back to the type icon otherwise;
`useProfile` re-runs the viewer-dependent wave when `viewerId` changes.

### 1k — Offset paging, replace-on-refresh, list-keyed effects (RC-11)

Findings: **F-1**, **F-2**, **F-3**, **F-5**, **V-31**, **V-30**, **V-29**.

Changes: `useFeed.ts` keyset pagination on `(created_at, id)` with dedupe by
id on append; focus refresh fetches only rows newer than the first loaded
one and prepends them (no page-0 replace); drop the 200 cap or cap from the
end; remove the dead `total`; `TakesFeed.tsx:85-94` runs the deep-link
scroll once (ref flag) and `checkFollowing` only for newly appended authors;
`TakeDetailModal.tsx:113-168` gets an `AbortController` and resets metadata
on take change.

### 1l — Take page and modal use `TakePlayer` (RC-12)

Findings: **V-18**, **V-20**, **V-22**, **V-21**; **V-19** waits for a
decision.

Changes: `app/take/[id]/page.tsx` and `TakeDetailModal.tsx` render
`TakePlayer` with the full `Take` from `useTakes.ts` (delete the local
`Take` interface); both use `useMuted()`/`useVolume()`; both call
`useTrackTakeView`; `isPlaying` derives from `onPlay`/`onPause`. Visual
result must be the same frame the feed shows for that take.

---

## Phase 2 — Technical quality

### 2a — Fetch volume and caching (RC-13, plus F-4)

Findings: **P-10**, **P-11**, **P-12**, **V-25**, **F-24**, **V-26**,
**V-27**, **F-26**, **P-15**, **F-4**.

Changes: profile posts paginated (page of 24, "load more" via the existing
sentinel pattern from `Feed.tsx`); tab hooks keep their data when the tab is
left (`enabled` flag instead of `""` gating) and accept `profileId` instead
of re-resolving `username`; `useFollowList` gets `enabled` and only fetches
when the modal opens; `useCommunities` only when the About box is on
screen; collaborated posts fetched lazily; the take page's eleven calls
collapse to one `takes` select with embeds plus one `follows` query;
comments fetched when the panel opens; DOMPurify stripping memoised per
post id; unpin is one UPDATE. Feed: keep the loaded pages and scroll offset
in a module-level store keyed by view id so returning to `/` restores both
(the same pattern `FeedViewProvider` uses for the view cookie), which is
F-4. Round-trip targets: owner profile first paint ≤ 7, visitor ≤ 9.

### 2b — Re-render storms (RC-15)

Findings: **F-8**, **P-28**, **F-27**, **F-28**, **V-55**.

Changes: hoist `AuthorHeader` and `ContentSection` out of `PostCard` (no
markup change); split `StudioProfile.tsx` into per-tab components with
`useMemo`'d derived lists and a memoised tile (no markup change — verify by
diffing rendered HTML before/after); one shared IntersectionObserver for
tracking; Gallery columns keyed by post id; `fetchReplies` stable via ref.

### 2c — Media loading (RC-14)

Findings: **V-28 / P-23**, **F-25**, **F-12**, **F-33**, **F-34**.

Changes: take tiles use `<img loading="lazy">` when a thumbnail exists and
`<video preload="metadata" muted playsinline poster>` otherwise (and the
upload path should generate thumbnails — separate ticket, noted only);
video thumbnails in Stream/Gallery/card grid use the existing poster path
or `preload="none"`; `VideoPlayer` gets its poster from
`media.thumbnail_url` so the play-first branch is reachable; one media bus
so audio and video pause each other; hidden carousel slides get `inert`.

### 2d — CSS layers and dead code (RC-17)

Findings: **F-10**, **P-30**, **V-51**, **V-50**, **P-27**, **F-11**, **P-24**,
**P-26**, **V-53**, **V-12**, **P-45**.

Changes: for each element styled in three places keep the value the browser
actually applies today (inspect computed style), write it once in the
component's CSS file (the Phase-8 split rule), delete the other two;
`.takes-grid`/`.take-grid-*` move to `takes.css`; hard-coded whites/greys
become the existing tokens (`bg-elevated`, `border-surface`, `bg-skeleton`)
only where the rendered colour is identical; delete every zero-reference
rule and module listed; remove the About-box accent line **only if** the
user confirms (it is a visible change — Phase 3 item P-30b). Pixel-diff
screenshots before/after are the acceptance test.

### 2e — Page/modal duplication, posts (RC-18)

Findings: **V-52**, **V-4** (post side).

Changes: extract `PostBody` (journal header, Spotify, title, body, audio),
`PostMediaGallery`, `PostActionRow`, `DiscussionPanel` from
`PostDetailModal` and use them in `app/post/[id]/page.tsx`; one delete/block
dialog with one copy each (the modal's copy is the app's voice; the page's
plain copy goes). Behaviour parity table from `00-system-map.md §4.2` is the
checklist.

### 2f — Page/modal duplication, takes (RC-18)

Same for `app/take/[id]/page.tsx`, `TakeDetailModal`, `TakePostCard`,
`TakeCard`: one report handler, one save/relay path (through `useTakes`),
one content-warning overlay.

---

## Phase 3 — Profile UI/UX

Before code: this list is restated as one-sentence changes and approved.
Candidate changes, each with its finding:

- Remove the entrance fade on tab bodies so a tab shows its content
  immediately; keep the header's single fade on first load (P-16).
- Replace the route skeleton with one that matches the real layout widths,
  and drop the full-screen spinner so there is one loading visual (P-17).
- Render profile cards visible by default; keep the scroll-reveal only where
  reduced-motion is off (P-18).
- Write the active tab and sub-tab to `?tab=`/`?view=` and read them on load
  so refresh and Back keep the tab (P-36).
- Reserve the Commissions tab slot while `hasCommissions` is unknown so the
  tab bar does not jump (P-40).
- Add `truncate`/`break-words` to name, handle and tagline, `whitespace-pre-line
  break-words` to the bio, and a `maxLength` on display name and the four
  detail fields (P-31).
- Give the Report and Block dialogs `max-w-[calc(100vw-2rem)]` (P-32).
- Show the sub-tab row's scrollbar on touch or add the existing edge fade
  used by the tab bar so the cut-off chip reads as scrollable (X-3).
- Truncate "Continue reading" at a word boundary (P-44).
- Make pin, collection-item delete and tile counts reachable on touch by
  showing them on the tile's existing overlay when the device has no hover
  (P-33).
- Add `role="tablist"/"tab"/aria-selected` to the tab bar, `role="button"`
  + `tabIndex` + Enter/Space to tiles and stat cells, `role="dialog"` +
  `useDialog` to the three inline modals (P-34).
- Show Follow and Message to guests and route them to the auth modal on tap,
  as the feed does (P-35).
- Message button label "Message" while opening (P-37); "Link copied" toast
  via `actionToast` (P-38).
- Use `/defaultprofile.png` everywhere the profile falls back to Unsplash
  (P-42).
- Fix the metadata description to "PinkQuill" and add the OG image/url that
  the post layout already sets (P-41).
- Align the takes grid gutter and tile radius with the Gallery view's
  `gap-1 sm:gap-2` / `rounded-sm sm:rounded-lg` so the two grids on the same
  page match (P-1 follow-up, P-30).
- Decisions: remove the "Blog" sub-tab (P-25); show the cover at the same
  opacity in settings and on the profile (P-39); remove the About-box accent
  line (P-30).

## Phase 4 — Feed UI/UX

Candidate changes, approved as one-sentence items first:

- Move the mobile view-switcher pill out of the card column (into the
  `MobileHeader` action row, which already has icon buttons) and fix the
  `md` overlap by using the same `lg:right-[296px]` offset logic for the
  580 px column (F-19).
- Define `safe-area-bottom` and add `env(safe-area-inset-bottom)` to
  `MainContent`'s bottom padding (F-20).
- Give the hovered left sidebar a translucent backdrop or stop it
  overlapping (decision) (F-21).
- Match the skeleton to the card (radius, padding, 3 + 2 action buttons,
  tokens instead of greys) and the loading column to 580 px (F-22).
- Read the view cookie during SSR so the first skeleton matches the view
  (F-23).
- Same guest gating on card, modal and page: tap → auth modal (F-15).
- Empty-state CTA for guests opens the auth modal (F-35).
- Cards get `role="button"`/`tabIndex`/keyboard; Stream and Gallery tiles
  stop nesting links in buttons (F-29).
- Tap targets to 40 px: view menu, carousel dots (bigger hit area, same
  look), gallery heart/save, `.post-menu-btn`, "Continue reading" (F-30).
- Feed error state gets an icon and text, not colour alone; the auto-retry
  says so (F-31).
- Long titles clamp; community header author truncates; `timeAgo` ticks
  once a minute (F-35b).

## Phase 5 — Post and take view UI/UX

Candidate changes, approved as one-sentence items first:

- `/take/[id]` gets the same `MobileHeader` and `MobileBottomNav` as
  `/post/[id]` (V-34).
- Give the composer on both pages a z-index above the bottom nav and pad the
  discussion column by the nav height (V-35).
- `TakeDetailModal` adopts the `PostDetailModal` mobile structure (sticky
  header with back chevron, fixed action bar) — no new styles, the
  `.post-detail-*` rules already exist (V-42).
- Decision: add a close control on desktop modals and a back control on the
  mobile pages (V-36, V-37) — these are new elements; see below.
- Carousel arrows visible on `(hover:none)` like the feed carousel already
  does (V-38).
- Thumbnail strip `overflow-x-auto` with the active thumb scrolled into view,
  and the feed carousel's existing `n / N` counter (V-39).
- Images `object-contain` inside the existing max-height box instead of
  `object-cover`, page image via `next/image` with `sizes` and alt (V-40).
- Desktop modal opens with the discussion panel visible; mobile keeps the
  comment pill (V-41).
- Tap targets to 40 px (V-43); aria labels on every icon button and a real
  `ariaLabel` per modal (V-44).
- `/defaultprofile.png` everywhere (V-45); sign-in links carry `?redirect=`
  (V-47); comment pill on the pages scrolls to the discussion column (V-13);
  takes empty state names the active filter; "Not interested" persisted in
  localStorage (V-32); takes mobile back uses `router.back()` with `/` as
  fallback (V-33); the three direct `body.style.overflow` writers use
  `useDialog` (V-54).

---

## Decisions needed before the relevant sub-phase

1. **1b** — approve the two DB changes (column revoke on `profiles`, new
   `takes_select` policy). SQL will be shown first.
2. **1j** — whether a small `get_profile_counts` RPC may be added if no
   existing RPC returns post/admire totals.
3. **1l / V-19** — takes uploaded as 16:9 / 1:1 / 4:5 are centre-cropped to
   9:16 everywhere. Options: honour `aspect_ratio` with letterboxing inside
   the existing 9:16 frame (uses the existing `#000` letterbox look), or
   keep cropping and stop offering those ratios in the composer.
4. **2d / P-30** — remove the About-box top accent line (violates the
   no-accent-borders rule but is a visible change).
5. **3 / P-25** — remove the "Blog" sub-tab (it is identical to "All").
6. **3 / P-39** — cover opacity: match settings to the profile (30 %) or the
   profile to settings (100 %).
7. **4 / F-21** — left sidebar hover expansion: keep overlapping, or push
   content.
8. **5 / V-36, V-37** — a close "X" on desktop modals and a back arrow in
   `MobileHeader` on post/take pages are new visual elements. Instagram has
   both; today the only exits are Escape, the 2.5 % backdrop, or the OS
   gesture. I will not add them without a yes. If yes, they use the existing
   icon-button style from `MobileHeader`.
9. **1k** — cursor pagination changes feed ordering semantics slightly
   (strictly newest-first by `(created_at, id)`); confirm that is acceptable.
