# PinkQuill UI Revamp — Phase 1 Audit (The Contract)

Date: 2026-07-02. Produced by full-codebase sweep (6 parallel section audits). This document is the
feature contract for the redesign: **everything listed here must survive Phase 3 unchanged in
capability.**

---

## 1. Tech stack & hard constraints

| Area | Reality |
|---|---|
| Framework | Next.js 16.1.1 App Router, React 19.2.3, TypeScript 5.9 |
| Styling | Tailwind **v4, CSS-first** — no `tailwind.config.*`; all tokens live in `@theme` in `app/globals.css` (11,563 lines) |
| UI kit | **None.** No Radix/Headless/shadcn/cva/clsx. Everything bespoke |
| Animation | **No JS animation library.** ~40 hand-written CSS `@keyframes` in globals.css |
| Icons | Two systems: FontAwesome (29 files: auth/help/legal/checkout) + hand-rolled inline SVGs everywhere else; `components/ui/Icons.tsx` (19 icons) barely used |
| Fonts | 15 Google fonts via `next/font` — Poppins (`--font-display`, `--font-ui`) + Open Sans (`--font-body`) preloaded; 13 deferred faces for per-post-type creative rendering (Playfair, Lora, Crimson Pro, Caveat, EB Garamond, …). CSP `font-src 'self'` → **no external font CDNs** without CSP edit |
| Theming | 6 full themes via `data-theme` attribute on `<html>` (default, noir, cream, sepia, ocean, sunset). **Zero `dark:` variants in codebase** — theming = CSS variable swap. SSR cookie stamp (`pq_theme`) + inline pre-paint script (no FOUC) + per-user Supabase persistence (`profiles.theme_preference`). This handshake must be preserved |
| Feed layouts | Parallel preference system: 4 feed views (classic/compact/grid/magazine), cookie `pq_feed_view` + `profiles.feed_view_preference`, registry in `lib/feed-view/` |
| Reduced motion | One global kill-switch block in globals.css (line ~5573). No `motion-reduce:` variants, no `useReducedMotion`. Thin but present |
| Images | `next/image` in 30 files, raw `<img>` in 14+. Next 16 `qualities:[60,75,80]` whitelist — new `quality` values must be added to `next.config.ts` |
| CSP | Strict: inline styles OK, Stripe/Cloudflare scripts allowed, `img-src https:` |
| Client/server | 227 files `"use client"`, 0 server actions. Root layout is a server component doing the theme/feed-view SSR stamp |
| Providers (order matters) | Auth → Theme → FeedView → UserEvents → BadgeCount → AuthModal → Lightbox → Modal + sonner `<Toaster>` + 3 fixed `.aura-blob` background divs |
| Monitoring | Sentry configs exist but are **fully commented out / not installed** (Next 16 incompat) — dead weight |
| Tests | Vitest = logic/hooks only (no component tests). Playwright e2e (5 specs) uses **role/name/text selectors, 0 data-testids in source** → redesign must preserve accessible names: nav landmarks, "Home/Explore/Create/Messages/Saved", "More", "Notifications", "Sign In", "Log out", email/password labels, img alts, commission-flow button names ("Add service", "Publish Service", "Start Work", "Mark Complete", "Submit Delivery", "Hire this package") |
| Emails | `email-templates/` — 4 standalone HTML files with hardcoded brand hexes; do NOT inherit tokens; must be updated manually on rebrand |

### Current design tokens (`@theme`, default theme)
- Brand: `purple-primary #8e44ad`, `pink-vivid #ff007f`, `orange-warm #ff9f43` (tri-gradient used everywhere)
- Surfaces: `canvas #fdfdfd`, `surface #fff`, `elevated #fff`, `subtle #f9fafb`, `skeleton #e5e7eb`, `glass rgba(255,255,255,.85)`, `overlay rgba(0,0,0,.4)`
- Ink: `ink #1e1e1e`, `subdued #4a4a4a`, `muted #777`
- Borders: `border-light rgba(0,0,0,.06)`, `border-strong rgba(0,0,0,.12)`
- **No radius / shadow / spacing / z-index tokens exist.** All hardcoded inline
- Legacy duplicate vocabulary: lowercase `--primary-purple`/`--vivid-pink`/`--ink`/`--muted-text` set still consumed by ~11.5k lines of legacy component CSS

---

## 2. Route map (every page)

### Core social — `(feed)` group + standalone
| Route | Purpose |
|---|---|
| `/` | Home feed (guest-browsable), 4 switchable layouts |
| `/explore` | Discovery: For You / Trending / Communities / Topics tabs + post-type filters |
| `/create` | Unified composer (posts + takes + music), 4,606-line monolith |
| `/saved` | Saved library: All / Posts / Takes / Products tabs |
| `/pending-collaborations` | Drafts awaiting collaborator acceptance |
| `/post/[id]` | Post detail + threaded comments (own shell, not in `(feed)`) |
| `/tag/[tag]` | Hashtag feed + related tags |
| `/takes`, `/takes/create`, `/take/[id]` | Short-video vertical feed, creator, detail |
| `/messages` | DMs (2-pane realtime chat) |
| `/messages/community` | Community inbox (3-column: announcements, modmail, member threads, appeals) |

### Communities
`/community` (directory: tabs, 13 categories, featured/suggested), `/community/create` (3-step wizard),
`/community/[slug]` (feed: sort hot/top/new + time range, pinned posts, moderation),
`…/about`, `…/members` (roster + mute/ban/promote + join requests), `…/mod` (report queue),
`…/settings` + 6 sub-pages (general, members, moderation w/ mod-log, rules w/ drag reorder, flairs, chat).

### Marketplace / commerce
`/shop` (products+commissions browse, filters, infinite scroll), `/product/[id]` (PWYW, gallery, reviews, JSON-LD),
`/commissions/[id]` (packages, hire modal, FAQs), `/sell` + `/sell/service` + `/sell/edit/[id]` (two 4-step listing wizards),
`/seller/*` (dashboard, orders, listings, earnings, customers, settings, setup wizard, payment onboarding),
`/orders` (buyer dashboard: stats + tabs + tracker cards), `/orders/[id]` (unified order view: timeline,
accept/decline, delivery files, digital download tokens, shipping tracking, order chat, disputes, refunds,
blind-reveal reviews), `/checkout/[orderId]` (+`/complete`) (promo codes, shipping form, Turnstile, Stripe embedded),
`/cart` (localStorage bag; `/queue` = dead redirect; `/commissions/orders/[id]` = dead redirect).

### Identity & system
`/studio/[username]` (profile: 6 tabs — Posts w/ 6 sub-view-modes, Takes, Relays, Store, Commissions, Collections),
`/studio/[username]/collections/[collection]/[item]`, `/insights` + 5 sub-pages (recharts analytics),
`/settings` (profile/account/appearance/privacy — **sidebar links to nonexistent `/settings/notifications`**),
`/login` (full auth flow; auth also exists as modal), notifications = slide-in panel (no route),
search = left-rail dropdown (no route), `/about`, `/help` + 9 sub-pages, `/terms`, `/privacy`,
`/community-guidelines`, `/marketplace-guidelines`.

### App shell
Desktop: hover-expanding left rail (72→220px) with search, notifications panel, create menu, more menu;
right sidebar (trending/who-to-follow/communities) **on homepage only, ≥1024px only**.
Mobile: fixed top header + bottom tab bar (Home/Explore/Create-FAB/Takes/Profile) + slide-over "More" sheet.
Both hidden on `/messages`. Breakpoints: `md:768` = desktop shell, `lg:1024` = right rail.

---

## 3. Feature inventory per surface (the contract)

### 3.1 Feed & posts
- **Post types (10 in picker):** thought, poem, journal, essay, blog, story, letter, quote, visual, take (+ audio/"Music", video via formats registry). Canonical theming per type in `lib/feed-view/post-type-theme.ts`.
- **Classic PostCard (1,406 lines):** 6 reactions (admire/snap/ovation/support/inspired/applaud — gradient SVGs, realtime counts, optimistic), save, relay/repost, share modal, send-to-DM, comment count, post menu (share/copy/pin/unpin/edit/delete/mod-delete/remove-self-collaborator/block/report), content-warning blur, view+impression tracking, community+flair badges, collaborator avatar stack, mentions+hashtags, Spotify chip, inline audio player, per-type layouts, read-only mode for muted members.
- **Alternate cards (compact/grid/magazine):** admire + save only — **feature-parity gap vs classic** (no reactions/relay/share/menu). Keyboard accessible (good). Content-driven grid/magazine span sizing.
- **Feed plumbing:** infinite scroll, realtime delete sync, 12s stuck-loading auto-recovery, per-post error boundaries, SSR-persisted view choice, `FeedViewMenu` switcher (mobile buttons 28px — under 44px target).
- **Post detail (page AND modal — two parallel ~1,400-line implementations):** full security gating (blocks, visibility, private accounts), reactions, threaded comments (like/reply/lazy-load/delete/report/block/mod-delete, flat threading w/ @prefill), media gallery + lightbox, journal metadata header (mood/weather/temp/location), Spotify embed, per-type typography (drop cap, poem centering, line spacing), `?comment=` deep-link highlight, `?media_failed=` notice.
- **Composer (4,606 lines):** two-step flow; rich text (bold/italic/underline, fonts, text color, highlight, DOMPurify); alignment/line-spacing/drop-cap; background picker; media upload (50MB); journal metadata; quote attribution; essay/blog subtitle; music metadata + cover; Spotify attach; collaborators (draft-until-accepted); tag people; hashtags (max 20); community + flair; collections (+create inline); visibility public/followers/private; content warning presets; localStorage drafts w/ recovery banner; full Takes video editor embedded (ratio, speed, filters, effects, sounds w/ volumes, thumbnail, tabs); edit mode. **No polls. No scheduling.**
- **Takes:** vertical feed (`?community`, `?sound`, `?id` params), separate `CreateTake` flow (duplicate of composer take-mode), take detail w/ 6 reactions/save/relay/follow/comments — all via raw supabase calls, not hooks.

### 3.2 Communities & messaging
- Directory (search, 13 categories, sort, featured ranks, suggested), 3-step create wizard (15 categories — **taxonomy drift vs directory's 13**), community feed (sort + time-range, pinned, per-permission moderation), about (rules, tags, mod list), members (role filters, mute w/ durations, ban w/ presets, promote w/ 7-permission modal, invite, join requests), mod queue (report cards, resolutions: delete/mute/ban/dismiss — `warning_sent` option is a **no-op**), settings suite, flairs (20 max, colors, emoji, contrast-aware badge), community chat settings.
- Join button state machine: join / leave / request (private, w/ message) / cancel / accept-decline invitation (RPCs).
- **DMs:** batched conversation list w/ block-awareness + unread badges, realtime channels, optimistic send, voice notes (recorder w/ live waveform, 300s), media w/ validation + lightbox, post shares, emoji picker, message reactions, typing indicators, read receipts (double-check), date dividers, block/report/delete-conversation (client-side cascade delete — risky), new-message modal.
- **Community inbox:** 3-column; member join/leave chat, community thread, announcements (staff broadcast via `/announce` slash commands), modmail, muted/banned appeal mode, staff member-search + threads + localStorage recents, system messages, role badges, welcome message pinned. **No reactions/typing/voice/media/pagination — asymmetric with DMs.**

### 3.3 Marketplace
- Browse: section toggle (products/commissions synced to `?section=`), debounced search, sort, category+subcategory, filter panel (delivery type, days, revisions, price), active-filter chips, infinite scroll, save on product cards (**not on commission cards**).
- Product detail: gallery + fullscreen lightbox, pricing options (original/reproduction/digital), **PWYW with floor**, buy-now → checkout, add-to-bag, save, share, owner edit/archive-delete, specs/shipping/tags, seller card + aggregate rating + reviews, JSON-LD + service-type redirect.
- Commission detail: package planner, process/includes/requirements/FAQs, hire modal (brief + timeline + notes) → pending-acceptance or checkout, add-to-bag, $5 floor, no PWYW.
- Wizards: product (delivery→category→media+digital files→details w/ per-type fields, PWYW floors) and commission (category→details→packages ≥$5→portfolio, 1,285 lines); shared edit mode.
- Seller studio: dashboard (metrics, pending-acceptance accept/decline, recent orders), orders table (**single-status tab filters miss statuses** — buyer side does multi-status correctly), listings grid (pause/activate/archive/delete; **fetch error silently swallowed**), earnings (transactions, fees, payout dashboard), customers CRM (search, expandable rows, addresses), settings (approval toggle + auto-decline hours), 4-step setup wizard, payment onboarding (3 states, placeholder-mode aware).
- Buyer: dashboard (4 stat cards, multi-status tabs, order cards w/ tracker + quick actions — **"Leave Review" links `#reviews` but order view reads `?tab=reviews`: dead anchor**), unified order view (see route map — timeline, delivery, downloads w/ token limits/expiry, shipping w/ carrier deep-links, order chat **without buyer attachments**, disputes, refunds, auto-completion countdown, blind-reveal reviews **with no "hidden until reveal" pending state shown**).
- Checkout: promo codes (strikethrough totals, session re-create), note to seller, shipping form gate, Turnstile, Stripe embedded / placeholder / free-order paths, 5% fee display; complete page polls status (success/failed/expired).
- Bag: localStorage only (no server sync), per-item checkout (no combined payment), services require inline brief; **four names for one concept** (Bag UI / cart route / queue directory / StudioCartPage component).

### 3.4 Identity & system
- Studio profile (2,912 lines): 6 tabs + 6 post view-modes (All/Blog/Gallery/Poems/Journals/Communities), follow/request-follow (private accounts), block, report, message, share, pin posts (max 6), collections (reorder, collapse, edit, delete), followers/following modal, communities modal, collaborated posts merge, 18 social platform links, profile-view tracking, watercolor cover.
- Insights: overview/audience/communities/content + per-post/per-take detail; metric cards w/ trends, recharts (views/traffic/growth — **hardcoded hex colors, dark-mode broken**), locations w/ flags, best-times heatmap, content table w/ sort/filter.
- Settings: profile editor (avatar/cover upload 5MB, socials w/ auto-detect), account (email/password change, recovery flow, typed DELETE account deletion), appearance (6-theme picker + 4-layout feed picker, instant persist), privacy (private-account toggle w/ auto-accept, blocked list w/ unblock).
- Auth: login (email-or-username), signup (validation + strength meter), OTP 6-digit (auto-advance, paste, resend cooldown), forgot/reset, `?redirect=` honoring; **AuthForm page + AuthModal are ~90% duplicated JSX**. No OAuth. No onboarding wizard.
- Notifications: slide-in panel (from the **left**), ~40 types (social + community + full commerce set), deep links per type, follow-request + collab-invite action cards, auto mark-all-read, skeletons. No route, no pagination, no preferences UI.
- Search: left-rail dropdown only — people/communities/tags, 2-char min, per-user localStorage history. **No mobile entry point, no posts search, no keyboard nav.** Community history links reconstruct slug from label (fragile).

---

## 4. Component library reality

**Shared and healthy:** `Loading` (27 files), `ActionMenu` (20 — excellent ARIA menu), `ConfirmationModal` (20), `Icons` (20), `Skeleton` + 8 presets (18), toast system (sonner + 30 domain presets), `ShareModal` (10), `ReportModal` (10), `ErrorBoundary` + 7 fallbacks (8), `Lightbox` (event-bus), `PeoplePickerModal`, `EmojiPicker`, theme components (`QuickThemeToggle`/`ThemePicker`/`ThemePreview`).

**Missing or dead:**
- **No Button primitive.** 724 raw `<button>`s in 138 files; the tri-gradient CTA hand-rolled **225 times in 107 files**.
- **Base `Modal` used by 2 files**; 23 files hand-roll overlays (4+ divergent overlay/blur/radius/z-index conventions; most lack focus traps).
- **`Avatar`/`AvatarGroup`: 0 imports (dead)** — every avatar is a raw `<img>` with per-site styling.
- No Tooltip, Tabs, Badge, Switch, Input/Field primitives (two ad-hoc toggle implementations, unlabeled selects).
- Badge-count pill logic duplicated 3× with different sizes/offsets.
- Nav menus duplicated: LeftSidebar "More" vs MobileMoreSheet = same items, two icon sets, two renderers.

**No scales:** radius sprawl (`rounded-full` ×1016, `xl` ×582, `lg` ×268, `2xl` ×252, `3xl` ×36); 15 ad-hoc z-index literals (60→9999).

---

## 5. Dead weight, bugs, and gaps found

**Actual bugs (visible today):**
1. `/settings/notifications` linked in sidebar + mobile tabs → **404** (page doesn't exist).
2. `settings/privacy` renders literal text `You haven&apos;t blocked anyone` (entity inside JS string).
3. Buyer "Leave Review" quick action → `#reviews` hash but OrderView expects `?tab=reviews` (does nothing).
4. `FollowRequestCard` uses typo'd token `to-warm-orange` (real token `orange-warm`) — gradient silently broken.
5. Seller orders "Active"/"Pending" tabs filter single statuses, hiding paid/shipped/pending-acceptance orders.
6. Mod queue "Send warning" resolution has no handler (silent no-op).
7. Notification icon fallback = heart/admire icon for unknown types (misleading).

**Systemic inconsistencies:**
- 5 different default avatars (Unsplash URL ×3 variants, `/defaultprofile.png`, `/default-avatar.png`, `DEFAULT_AVATAR` util used once).
- 4 loading idioms (route skeletons / `Loading` spinner / bare spinners / blank-null) mixed within single flows.
- 6 divergent copies of order `STATUS_CONFIG` with conflicting colors; `submitted` labeled "Delivered".
- 4 confirm-dialog patterns (shared modal / bespoke overlays / inline confirm / `window.confirm`).
- `transformPostForCard` ×4, `PostSkeleton` ×3, `formatNumber` ×5+, legal-page scaffolding ×4, helpCategories ×2, DM vs community-chat date/bubble code ×2.
- Brand name split: "Quill" vs "PinkQuill" across titles/copy/storage keys.
- Off-token raw Tailwind colors (red-50/emerald-600/purple-100/yellow-*) throughout moderation, settings, auth, insights — **will not adapt to the 6-theme system**.
- Dual admire systems: legacy `admires_count` (alternate cards, takes) vs reaction-`admire` (classic).

**Dead code:** `/queue` + `/commissions/orders/[id]` redirect stubs, Sentry configs (commented out, package not installed), `TrendingSidebar` declared-never-rendered, `Avatar` component, `_handlePromote*` handlers, ConversationList online-indicator, `CommunityCard` join props, `icons.checkAll`.

**Accessibility (systemic, current state):**
- `sr-only` used in exactly 1 file; 10 `outline:none` in globals with no focus-visible replacement at CSS level (63 files do add Tailwind focus rings).
- Hover-only controls (member action menus, message reaction picker, saved-page unsave) unusable on touch/keyboard.
- Clickable `<div>`s without roles (saved cards, studio stats); bespoke modals without `role="dialog"`/focus trap (block/report/hire/mute/ban/communities).
- Icon buttons missing `aria-label` on post/take detail pages (present on PostCard — inconsistent standard).
- Sub-44px touch targets (FeedViewMenu 28px, several 32–36px buttons).
- Comment inputs are single-line `<input>`s, no mention autocomplete.
- Redirect-in-render authz pattern on community settings pages (content flash).

---

## 6. Open questions for the owner (answer before Phase 2 build)

1. **Alternate feed cards** (compact/grid/magazine) support only admire+save. Intentional "calm views," or should the redesign restore full parity (reactions/relay/share/menu) everywhere?
2. **Brand name:** "PinkQuill" or "Quill"? And the bag: "Bag" everywhere?
3. **`/settings/notifications`:** build a notification-preferences page, or drop the link?
4. **6-theme system** (default/noir/cream/sepia/ocean/sunset): does the new identity replace all six (new palette in light+dark), or do the extra 4 themes survive re-skinned?
5. **Post detail page vs modal** and **CreateTake vs composer take-mode**: OK to consolidate each pair into one implementation (same UX, one codebase)?
6. **Scope of Phase 3:** legal/help/static pages included in the revamp, or system-tokens-only touch-up there?

## 7. Redesign ground rules derived from this audit

- Build the missing primitives first (Button, Modal-composed dialogs, Avatar, Badge, Switch, Tabs, Field) — they are the only sane path to restyling 724 buttons and 23 overlay implementations.
- All color must route through `@theme` tokens (including semantic states) so all themes + dark mode work; kill raw Tailwind palette colors and the legacy lowercase variable set.
- Introduce radius/shadow/spacing/z-index scales as tokens; collapse the 15 z-index literals.
- Preserve: SSR theme handshake, provider order, feed-view registry, accessible names used by e2e, `next/image` quality whitelist, CSP, the 13 deferred creative fonts (post-type rendering depends on them).
- Consolidate: status configs, default avatar, transforms, skeletons, confirm dialogs, date/bubble helpers, legal scaffolding.
- Fix the 7 listed bugs as part of their pages' redesign.
