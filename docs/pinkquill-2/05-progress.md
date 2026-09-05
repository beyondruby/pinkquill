# Progress and handoff

Last updated: 2026-09-05.
Baseline code: `e509c5a` on `main`; working tree was clean at start.
Active program: the September 5 Pinkquill 2.0 brief, summarized in `README.md`.

## Status

| Phase | Status | Evidence |
|---|---|---|
| 0 — Planning baseline | Complete for planning scope | Direction, source/browser audit, phase plan, and route inventory saved in this directory |
| 1 — Design proof | 1A/1C delivered; 1B implemented with native keyboard check open | Connected local proof; `06-design-proof.md` |
| 2 — Foundations | Implemented and verified (2A tokens, 2B controls/overlays, 2C frames) | `07-foundations.md`; 21 React checks; six-theme reference |
| 3 — Navigation/feed | Complete: 3A shell, 3B Home/feed views, 3C Explore/tags implemented and verified | `07-foundations.md`; shell, feed, explore tests; Playwright guest shots |
| 4 — Creation/content/Takes | 4A post detail (page + modal) implemented and verified; 4B composer and 4C Takes not started | `07-foundations.md`; PostDetail tests; Playwright guest shots |
| 5 — Communities/conversation | Not started | |
| 6 — Studio/collections/saved | Not started | |
| 7 — Commerce discovery/listings | Not started | |
| 8 — Bag/checkout/orders | Not started | |
| 9 — Dashboards/operations | Not started | |
| 10 — Account/support/system | Not started | |
| 11 — Whole-product verification | Not started | |

## Decisions established by the user

- Full redesign, including feed, studio, communities, commerce, commissions, orders, dashboards, and the rest of the app.
- Preserve current colors as the starting identity.
- Welcome all creative disciplines, talent, sports/movement, and ordinary self-expression; no professional or writer-only qualification.
- Avoid tech-site, editorial/magazine, and recognizable clone presentation.
- Fix UI/UX and unify the experience while preserving existing features; future extensibility belongs in the architecture.
- Break the work into resumable phases.

## Proposed choices to prove in Phase 1

- “Room for your kind of creativity” as an internal direction; existing “Show your colors” remains useful brand language.
- Existing UI fonts, quieter chrome, work/media supplying the visual energy, consistent person/work/action composition.
- Stable search/navigation rather than hover-dependent expansion.
- Shared product language with purpose-specific social, focused-task, and management layouts.
- Keep existing names/routes/theme preferences; do not revive the abandoned identity track's renames, theme removal, or new features.

These are proposed design choices, not user-approved final pixels. Routine local work can proceed; there is no pending permission request.

## Planning baseline completed

Direction, source/browser audit, phase plan, and all 85 route assignments are saved. The project README and historical master plan point to this active program. Earlier default/mobile/role verification limits remain historical observations; current proof evidence is separate below.

## Current batch — Phase 1 and first foundation slice

Date / baseline: 2026-09-05 / `e509c5a`.

- **1A:** four connected screens built: Home, community, studios, submitted-delivery order. Varied fictional creators include illustration, dance, music, poetry, skating, clay, acting, and casual expression.
- **1B:** desktop/mobile navigation, creation choices and partial draft form, action menu, notifications, short sheet, long form, local social actions, and both order decision paths implemented. Default/Noir and 360/390/768/1280 layouts checked. Native dialog Tab boundary remains inconclusive in browser automation; explicit handler passes JSDOM. Do not mark 1B fully verified yet.
- **1C:** layout, typography, palette, shape, media, navigation, overlay decisions and limitations recorded in `06-design-proof.md`. The proof's Noir experiment and Gallery initial layout do not replace production preferences.
- **2A-controls / 2B-Button:** new semantic control roles and real shared Button migration. Six supported theme identities retained; Cream/Sepia control contrast corrected. Button native semantics, variants, loading/disabled state, ref, and caller styles preserved. Remaining tokens, primitives, and frames are pending.
- **Files:** `prototype/` (isolated fictional fixtures), `06-design-proof.md`, `07-foundations.md`, `app/design-tokens.css`, `components/ui/button.css`, `components/ui/Button.tsx`, imports in `app/globals.css`, `components/ui/__tests__/Button.test.tsx`, reference builder and generated `foundations/`.
- **Review:** open `prototype/index.html` and `foundations/index.html` directly, or serve this directory on local port 4318. Screenshot evidence was inspected inline; no durable screenshot export is claimed.
- **Checks:** 13 prototype JSDOM behaviors passed; four React Button behaviors passed; TypeScript passed; targeted ESLint passed; actual app CSS compiled for reference; measured all-six-theme control contrast. See linked documents for exact scope and native-browser limitations.
- **Data:** no fixture connected to an account; no live publishing, message, upload, payment, or order mutation. No dependencies/schema/financial rules changed. No commit, push, or deployment performed.
- **Route ledger:** all 85 production routes remain assigned; none is marked fully redesigned based only on this shared-component slice.
- **Revert:** remove the two new global imports and restore Button for runtime rollback; prototype/doc/reference files are independent. Leave unrelated user or OS file changes alone.

## Batch 2B-overlays — implemented and verified (2026-09-05, baseline `e509c5a`)

- **Routes and components:** shared only; no route status changes. `components/ui/overlay/useOverlayLayer.ts`, `overlay/Scrim.tsx`, `overlay.css`, `Modal`, `Sheet`, `ConfirmationModal`, `ActionMenu`, `ReportModal`; `app/design-tokens.css` shape/surface roles; `app/globals.css` import; reference builder + `foundations/`.
- **Findings addressed:** UX-07 (menu/dialog literals leaking into dark themes), UX-12 (behaviour tests replace label-only checks for overlays), the source-observed `Modal` aria-hidden ancestor, mixed scroll-lock ownership, Escape closing more than one layer, text-selection dismiss, ReportModal overflow on narrow phones.
- **Existing capabilities checked:** every Sheet consumer (orders, commissions, admin) keeps its props; ActionMenu API unchanged for 21 consumers; ConfirmationModal API unchanged for 20 consumers; PostDetailModal/TakeDetailModal receive the wide dialog.
- **Evidence:** 13 UI tests pass (`npx vitest run components/ui`), full suite result recorded below, `tsc` clean, ESLint clean on `components/ui`; browser: post menu, delete confirmation, post detail in Default and Noir at 1380px in the running dev app; reference page rebuilt.
- **Untested:** real-keyboard Tab boundary in a browser, screen reader, phone software keyboard, Sheet consumers in authenticated order flows (not exercised to avoid live mutations), the still-unmigrated overlays listed in `07-foundations.md`.
- **Decisions:** no new `Sheet` side-panel variant until 3A has a real consumer; menus close on Tab; confirmation focuses the safe choice.
- **Revert boundary:** see `07-foundations.md`.

## Batch 2C + 3A — implemented and verified (2026-09-05, baseline `e509c5a`)

- **Routes and components:** every route that used the old shell now renders through `AppShell` (all section layouts, `AdminShell`, `/post/[id]`, `/take/[id]`); shell statuses in `04-route-coverage.md` are unchanged because page content is still old. Files: `components/layout/{shell.css,navigation.tsx,AppShell.tsx,DesktopRail.tsx,TopBar.tsx,MobileBottomNav.tsx,MobileMoreSheet.tsx,PageFrame.tsx,RightSidebar.tsx}`, `components/notifications/NotificationPanel.tsx` (container only), `components/search/{SearchBar,SearchDropdown,SearchResultItem}.tsx`, `components/ui/{Sheet.tsx,overlay.css}` (panel presentation), sticky offsets in feed/community/explore/marketplace/tag/saved/checkout/commission/take, `app/globals.css` (import, canvas, aura), deleted `LeftSidebar.tsx`, `MobileHeader.tsx`, `MainContent.tsx`.
- **Findings addressed:** UX-01 (hover rail, hidden search), UX-02 (phone Create choices), UX-08 (repeated offsets replaced by shell variables), UX-13 (My studio vs Seller Studio labelled and placed), plus the Unsplash fallback avatar in search.
- **Existing capabilities checked:** all destinations and routes preserved; badge counts (messages, notifications, bag) preserved; guest gating derived from `protected-paths`; notification data, mark-as-read, invites and follow requests untouched; search history/results logic untouched; Takes stays immersive; Messages keeps its own header.
- **Evidence:** 21 component tests, full unit suite, `tsc`, ESLint (warnings only); browser at 1380px signed-in; Playwright guest screenshots at iPhone 12 / 768 / 1280 for `/`, `/shop`, `/community` with no horizontal overflow; E2E result below.
- **Untested:** signed-in phone flows (Create sheet, More sheet) only under JSDOM; real keyboard traversal of the rail; theme persistence via the More menu (not exercised to avoid changing the account preference); Messages on desktop now has no top bar (rail only) — Phase 5C decides whether it gets one.
- **Decisions:** guests see all public destinations; phone bottom bar is Home / Explore / Create / Takes / More (profile moved into More and the top-bar avatar); no uppercase tracked eyebrow labels from the proof are carried into production (existing design rule).
- **Revert boundary:** the files above plus the layouts; `git checkout` of `app/**/layout.tsx`, `components/admin/AdminShell.tsx`, the two detail pages and restoring the three deleted layout components returns the old shell.

## Batch 3B — Home and the three feed views — implemented and verified (2026-09-05, baseline `e509c5a`)

- **Routes and components:** `/` (Home). `components/feed/{Feed.tsx,FeedViewSwitch.tsx,ComposerPrompt.tsx,PostSkeleton.tsx,feed.css}` (new switch, prompt, skeleton, frame stylesheet; `FeedViewMenu.tsx` deleted), `components/layout/RightSidebar.tsx`, `components/layout/navigation.tsx` (image/video/music icons), `components/feed/{StreamView,GalleryView}.tsx` (minor), and the shared post-card rules in `app/globals.css` ("POST CARDS", actions bar, stream, gallery).
- **What changed:** Home renders inside `PageFrame` (690px Classic column, 800px Stream, full width Gallery). The floating icon-only layout pill became a labelled segmented control in an in-page toolbar with a sentence-case section heading ("From your creative world" / "What people are making" for guests). Signed-in people get a quiet composer prompt linking to `/create`. The shared `.post` card is now one 17px radius, one soft line, no shadow or hover lift, 40px avatar, 13px name, 12px meta, and a calm action row with 42px targets and a tinted pressed state; audio/video/carousel type overrides inherit it. Stream rows and Gallery tiles use the same tokens (no lift, no image zoom, 40px action targets, tint hovers). Loading, empty, error and end states are distinct: error is an alert with Try again; empty differs for guests (Sign in) and members (Share something). The right column lost gradient titles, rank numbers, the Unsplash fallback portrait and gradient follow buttons; it uses the shared Button and tokens.
- **Findings addressed:** UX-01 follow-through (layout control visible and labelled on every width), UX-10 (fixtures not needed: real content shows the family resemblance), the proof's "creator, work, quiet action row" composition carried into production, the `home-feed-modern` style-jsx override removed.
- **Existing capabilities checked:** three view IDs and persistence untouched (`FeedViewProvider`); reactions, comments, relay, share, save, post menu, content warnings, collaborators, community header variant, infinite scroll, auto-retry, delete subscription all preserved (PostCard logic untouched); Stream expand-in-place and Gallery tile actions preserved.
- **Evidence:** 6 feed tests (`components/feed/__tests__/feed.test.tsx`: switch radiogroup and arrow keys; guest vs member empty states; error alert with retry; classic column and end line; stream/gallery routing); full suite 229 passing; `tsc` clean; ESLint warnings only. Browser (signed in, 1380px): Classic, Stream and Gallery in Default and Noir; Playwright guest `/` at iPhone 12 / 768 / 1280 with no horizontal overflow.
- **Untested:** posts with images/video/audio in the redesigned card (the local feed is text-only; verify on a media-rich account or fixtures in Phase 4), studio/community pages that share `.post` (they inherit the new card; their own frames are Phases 5–6), keyboard traversal of tiles in the browser.
- **Decisions:** no greeting hero on Home; work starts after one toolbar row. Follow buttons in the aside are outline, not primary, so Create stays the only purple button in view.
- **Revert boundary:** the files above; `git checkout app/globals.css components/feed components/layout/RightSidebar.tsx components/layout/navigation.tsx` and restore `FeedViewMenu.tsx`.

## Batch 3C — Explore and tags — implemented and verified (2026-09-05, baseline `e509c5a`)

- **Routes and components:** `/explore`, `/tag/[tag]`. `components/explore/ExplorePageContent.tsx` (rewritten on `PageFrame`/`PageHeader`), `app/tag/[tag]/page.tsx` (rewritten), `app/tag/[tag]/layout.tsx` (now renders inside `AppShell`; the route previously had no rail or bottom bar at all), new shared `components/ui/Tabs.tsx` + `components/ui/tabs.css` (tab row, chips, list rows), `components/search/SearchResultItem.tsx` (tag results now open `/tag/<name>`).
- **What changed:** Explore has a page title and one-line lede, a real `tablist` (For you, Trending, Communities, Topics) with arrow-key movement and an underline, and the post-type filter as a shared ActionMenu on a chip trigger that names the active type; the desktop dropdown and the hand-rolled phone bottom sheet are gone. Topics is a list of rows without rank badges (count and "this week" as quiet meta). States use the shared feed states: alert with Try again, per-tab empty copy with a "Show all types" escape when a type filter hides everything, skeletons, end line. The tag page gets a back control, the tag as the title, the count as a lede, related tags as chips, and guest/member empty states. Both pages reuse `getPostTypePhrase` and the default avatar instead of a duplicated label table and a missing `/default-avatar.png`.
- **Findings addressed:** UX-01 follow-through on discovery pages; a real bug: search tag results linked to `/explore?tag=` which Explore never read, so a tag search landed on an unfiltered page.
- **Existing capabilities checked:** `useExplore` tabs, type filters, pagination, refresh and auto-retry untouched; `useTagPosts`/`useTrendingTags` untouched; PostCard actions preserved; Explore's ranking and recommendation behaviour untouched. No URL query state existed before and none was added.
- **Evidence:** 4 tests in `components/explore/__tests__/explore.test.tsx` (TabRow semantics and keys; Explore tabs + type menu; filtered empty state escape; error retry and Topics rows); full suite 233 passing; `tsc` clean; ESLint warnings only. Browser (signed in, 1380px): Explore tabs, type menu (computed: fixed, z 1100, opaque), Topics, `/tag/color`. Playwright guest `/explore` and `/tag/poetry` at iPhone 12 / 768 / 1280 with no horizontal overflow.
- **Untested:** a data set with trending tags (the local database returns none, so Topics shows its empty state); Communities tab with real community posts; real keyboard traversal of the tab row in a browser.
- **Decisions:** a type filter is shown as "For you" in the tab row plus the named chip, not as a fifth tab; Explore is a 690px reading column like Classic Home.
- **Revert boundary:** the files above; restoring `ExplorePageContent.tsx`, the tag page/layout and `SearchResultItem.tsx` from `e509c5a` and deleting `Tabs.tsx`/`tabs.css` (and its import) returns the old pages.

## Batch 4A — post detail page and modal — implemented and verified (2026-09-05, baseline `e509c5a`)

- **Routes and components:** `/post/[id]` and the post modal opened from any feed. New shared seams in `components/feed/PostDetail/` (`PostDetailHeader`, `PostDetailBody` with `JournalHeader` and `MediaGallery`, `PostDetailActions`, `Discussion`, `types.ts` with the one `DetailPost` shape and background tone helper) plus `components/feed/post-detail.css`. `app/post/[id]/page.tsx` and `components/feed/PostDetailModal.tsx` keep all of their data fetching, hooks and handlers and now render only through those seams; roughly 1,100 lines of duplicated markup are gone. The legacy phone override block (`.post-detail-*`, `.post-actions-bar`, `.discussion-panel` mobile rules, ~400 lines of `!important`) was removed from `globals.css`; `.view-discussion-btn` stays until Takes (4C) stops using it.
- **What changed:** both surfaces share the card language from 3B: creator row (avatar, name, flair, type chip, time), the work (journal header on tokens with no gradient text, music embed, sound player, title, text honouring creator alignment/spacing/drop cap/background, media stage with quiet arrows, captions and thumbnails with `aria-current`), tags, and the same `.actions` row as the feed card. The content warning blurs the work and offers "Show the work" on a shared Button. The conversation is one component: a count, the thread, one field with a send control, or a Sign in link for guests. The page adds a Back control (history back, or Home) and lays the work and the conversation side by side from 1024px with a sticky conversation card. The modal shows a Conversation chip on desktop that opens a side panel and, on phones, a full-screen panel with a Back control; Close sits top-right on desktop and Back top-left on phones. The wide dialog now sizes to its content (18rem floor, 90dvh cap) instead of always filling the viewport. Both hand-rolled Block dialogs became `ConfirmationModal`; the page's delete copy matches the card's.
- **Back/close contract:** page: the Back control returns to the previous page, or Home when the page was opened directly; the browser Back also works. Modal: Escape, the scrim, Close (desktop) or Back (phone) all call the provider's close, which restores the underlying URL; inside the modal, creator, tag and mention links close it before navigating.
- **Findings addressed:** UX-09 (seams extracted from two 1,300-line files), the Unsplash fallback avatars in headers and comment fields, the missing `/default-avatar.png` path, the `!important` phone override cascade.
- **Existing capabilities checked:** comments (add, like, reply, load replies, delete, moderator delete), deep-link comment highlight effect (page), reactions, relays (hidden for the owner), saves, share, DM share (card), menu (share, copy link, edit, delete, block, report, pin/unpin via card, remove-me-as-collaborator via modal), collaborations, mentions, hashtags, content warnings, journal metadata, music embed, audio player, creator backgrounds, failed-upload notice via `?media_failed`, auth gating at the point of action.
- **Evidence:** 4 tests in `components/feed/PostDetail/__tests__/postDetail.test.tsx` (actions gating for guest/owner and share; conversation guest prompt and Enter submit; content-warning reveal and media stepping; header links and slots); full suite 237 passing; `tsc` clean; ESLint warnings only. Browser (signed in, 1380px): page for a poem, modal from Home for a quote, Conversation panel, Escape restores `/` and unlocks scroll. Playwright guest: page at iPhone 12 / 768 / 1280 with no overflow; modal on phone (full screen, Back) and desktop (side panel).
- **Untested:** posts with images or video in the redesigned gallery (local data is text-only), creator backgrounds in the new tone mapping, journal entries with weather/mood, a post with comments in the new thread styling, real keyboard traversal of the gallery.
- **Decisions:** the quote form in detail stays plain text for now (the card's quote styling comes from `FormBody`, which is card-specific; unifying it is 4B territory). The modal keeps its existing "conversation hidden until asked" behaviour on desktop.
- **Revert boundary:** `components/feed/PostDetail/`, `components/feed/post-detail.css` and its import, `app/post/[id]/page.tsx`, `components/feed/PostDetailModal.tsx`, the `.pq-dialog--wide` sizing in `overlay.css`, and the removed block in `app/globals.css` (restore from `e509c5a`).

## Exact next task: 4B composer

Read `03-phases.md` §4B and the 4A entry above. `components/create/CreatePost.tsx` is ~4,600 lines: refactor presentation in small seams around the existing draft/upload/publish logic, on `PageFrame` and the shared controls (Button, Sheet, ActionMenu, TabRow, chips). Make Text, Photo, Video and Audio equally discoverable; group optional format controls with progressive disclosure; keep creative styling, metadata, community/flair, audience, collections, collaborators, warnings, edit mode, drafts/recovery and every validation. Use `FormBody`/detail seams so the preview matches what the feed and detail show. Test a text post, an image set, an uploaded audio and a video with isolated fixtures or a designated test account (no live publishing from the user's session). Also migrate `CommentItem` styling and `PeoplePickerModal`/`ShareModal`/`SendToDMModal` onto the overlay layer as they are touched.

## Open verification

- Native dialog Tab/Shift+Tab boundary; screen reader; 200% zoom; OS reduced motion; phone software keyboard.
- Authenticated creator/member/moderator/buyer/seller/admin integration journeys and actual preference persistence were not exercised with live mutation. Use controlled fixtures or designated test sessions.
- Full composer/upload/media behavior and financial server eligibility remain owned by their later phases.
- Other primitive themes and global consumer-specific overrides need verification as they migrate.
- The user approved proceeding with the plan; there is no pending permission request and no claim of final pixel approval or production release readiness.

## Batch entry template

Copy this for each future entry:

```text
Date / baseline commit:
Batch ID and status (in progress / implemented / verified / complete):
Routes and components:
Findings addressed:
Existing capabilities checked:
Files changed:
Preview / screenshot evidence:
Tests and manual checks (exact result):
Untested states / blockers / risks:
Decisions and user feedback:
Revert boundary:
Exact next task:
```

“Implemented” means code exists. “Verified” means the stated checks passed. “Complete” additionally means route coverage and handoff are updated and no required work remains for that batch. Never infer a deployed result from any of these labels.
