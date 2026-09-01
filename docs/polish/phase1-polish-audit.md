# PinkQuill Polish Pass — Phase 1 Audit

Date: 2026-09-01. Scope: **fit-and-finish only** — no new colors, fonts, layout, or components.
Same design, better made. Route map, feature contract, and component-library inventory are
**reused as-is** from `docs/redesign/phase1-audit.md` (still accurate — verified below); this doc
only adds the polish-specific layer: consistency, hierarchy, states, feedback, motion, fit & finish.

Method: a code-level sweep (greps, current counts, re-verification of the 7 known bugs) plus a
live click-through of the running app (light theme + Noir dark theme) across Home, Explore, Takes,
Notifications, Messages, Composer, Studio profile, Marketplace, Community directory + detail,
Settings, Insights.

---

## 1. Consistency

No shared scale exists for spacing, radius, shadow, or type size — everything is hand-picked
per component, so near-identical elements drift apart over time.

- **Radius:** `rounded-full` ×1016, `xl` ×582, `lg` ×268, `2xl` ×252, `3xl` ×36, plus 27 arbitrary
  `rounded-[…]` one-offs. No token scale.
- **Shadow:** 5 standard Tailwind tiers in heavy use, plus 10 hand-rolled arbitrary `shadow-[…]`
  values (some `color-mix(in oklab, …)`, some raw `rgba()`). No elevation tokens.
- **Spacing:** 98 distinct arbitrary `p-/m-/gap-/w-/h-[…]` values, 308 instances total.
- **Type scale:** beyond Tailwind's 9 standard `text-*` steps, **48 distinct arbitrary
  `text-[…]` sizes, 617 instances** (`text-[11px]` ×77, `text-[0.95rem]` ×61, `text-[10px]` ×59,
  down to one-offs like `text-[0.5rem]`). This is the single largest untracked consistency gap in
  the app — most of it is invisible to a glance-audit but shows up as "why does this label look
  1px off from that one."
- **Z-index:** 21 distinct literal values in use (`z-0` through `z-[9999]`), no scale. Two stacks
  that never reconcile: the modal stack (`ReportModal.tsx`, `ConfirmationModal.tsx`, `Modal.tsx`,
  `PeoplePickerModal.tsx`, `Lightbox.tsx`) vs. the Takes overlay stack (`TakeReactionPicker.tsx`,
  `TakeCommentsPanel.tsx`, `TakePostCard.tsx`) — a Takes overlay and a report modal have no defined
  relationship if both need to show at once.
- **Icons:** three parallel systems — FontAwesome (29 files, mostly auth/help/legal/checkout),
  1,127 hand-rolled inline `<svg>` instances across 138 files, and `components/ui/Icons.tsx` (19
  icons, imported in only 20 files). Same concept can render with a different stroke width/weight
  depending on which system drew it.
- **Tri-gradient CTA** (`from-purple-primary via-pink-vivid to-orange-warm`) is hand-rolled 83
  times in 41 files — no shared gradient class, so any brand-gradient tweak means touching 41 files.
- **Off-token raw Tailwind colors** (`amber-50`, `purple-700`, `indigo-500/10`, `cyan-500/10`,
  `slate-50`) sit inside the same `STATUS_CONFIG` objects as real design tokens — these will not
  adapt to theme switches (see Screen: Settings → Appearance below).
- **Live example — Studio profile social-link row:** the link icon renders bare, Instagram sits in
  a colored rounded-square, LinkedIn sits in a colored rounded-square of a different shape ratio —
  three icon-button treatments in one 4-item row.
- **Live example — brand name:** browser tab title reads "Quill" on `/studio/hadi` and
  `/community/writers-in-jeddah`, but "PinkQuill" on the home feed and `/shop`. Confirms the old
  audit's "brand name split" finding is still live in page `<title>`s, not just copy.

## 2. States

- **724 raw `<button>` elements in 138 files** (no Button primitive exists anywhere:
  `@/components/ui/Button` has zero importers).
- **69% of those buttons (500/724) carry no `hover:`/`focus:`/`focus-visible:`/`active:` class on
  the tag itself** — over two-thirds of clickable controls give no visual acknowledgment that
  they're interactive until something else (an icon color, a cursor) hints at it.
- **Pressed/tactile feedback is nearly absent:** `active:` variants appear only **18 times** in
  the entire codebase, including on the tri-gradient CTA itself — buttons don't visibly compress
  or dim on click.
- **Disabled state is inconsistently styled:** 242 `disabled={…}` attributes vs. only 224
  `disabled:` Tailwind classes — many disabled buttons are functionally inert but look identical
  to enabled ones (invites a rage-click).
- **`focus-visible:` (the correct keyboard-only variant) is used in only 8 files / 26 instances**,
  vs. `focus:` in 61 files — where focus rings do exist they often also fire on mouse click,
  which reads as a flicker/glitch to mouse users.
- **Live example — Takes navigation:** the "previous take" control is a bare gray up-chevron with
  no button chrome, hover state, or hit-target visible; the "next take" control two rows below is
  a fully-realized pink-gradient ringed circular button. Same semantic action (navigate between
  takes), two completely different levels of visual weight — the up control barely reads as
  tappable.
- Sub-44px touch targets remain widespread: `FeedViewMenu.tsx:150,167` buttons are 28px; codebase-
  wide, `h-6/w-6` appears 132/121×, `h-7/w-7` 67/61×, `h-8/w-8` 145/144× — hundreds of
  interactive elements under the 44px target size, mobile especially.

## 3. Feedback

- Toast system is well-contained (sonner wired once in `app/layout.tsx`, `lib/utils/toast.ts`
  exposes 33 domain presets via `actionToast`, only 3 files touch `sonner` directly) — this part
  is genuinely solid and should be the pattern everything else follows.
- **Optimistic updates exist in only 4 of 36 hook files** (`useFeed`, `useComments`,
  `useMessaging`, `useTakes`). Orders, seller dashboard, marketplace, notifications, and
  communities appear to do plain await-then-refetch — an action fires and nothing visibly happens
  until the network round-trip completes.
- **Four different loading idioms coexist** and are drifting further apart rather than converging:
  route-level `loading.tsx` (4 files), the shared `Loading` component (27 files), bare
  `animate-spin` spinners outside that component (**50 files** — now the single most common
  idiom), and `Skeleton` + 8 presets (18 files). Two nearly identical loading spots in the same
  flow can render completely differently.
- **Live example — Messages loading state is one of the better ones in the app:** brand-icon
  spinner + pulsing dots + "Loading chat" label. Worth using as the reference pattern when
  consolidating the other 3 idioms, not replacing it.
- **Live example — Marketplace empty state:** "No products found" / "Try adjusting your filters to
  find what you're looking for" / "Clear all filters" CTA — shown even when **no filters are
  applied and the catalog is genuinely empty**. The empty-state copy assumes a cause (over-
  filtering) that isn't true here; a first-time visitor with zero listings sees advice that doesn't
  apply to them.
- **Live example — Marketplace result count:** "0 results" is rendered twice in adjacent UI (once
  next to the sort dropdown, once inside the section header chip) — same number, two places,
  no added information.

## 4. Motion

- **62 `@keyframes`** in `globals.css` (grown from an earlier count of ~40) with **one** CSS-only
  `@media (prefers-reduced-motion: reduce)` guard (`globals.css:5573`) and **no** `motion-reduce:`
  Tailwind variants or `useReducedMotion` hook anywhere in client code — any new JS-driven
  animation (a modal enter, a drag interaction) has no reduced-motion path by default.
- **`transition-all` (539 instances) is used almost as often as `transition-colors` (478),
  `transition-transform` (86), `transition-opacity` (72), and `transition-shadow` (5) combined** —
  animating "all" on a hover state that only changes color is a common cause of janky/expensive
  repaints and makes motion feel less intentional.
- **No standard duration token:** 9 distinct `duration-*` values in active use (300 most common at
  92 instances, down to one-offs at 100/400/1000). Two near-identical hover interactions in
  different files commonly land on different speeds purely because of who wrote them.

## 5. Fit & finish (concrete bugs, verified live where possible)

All 7 bugs from the original audit are still present, unchanged:

1. **`/settings/notifications` is a dead link → generic black Next.js 404 page.** Verified live:
   clicking "Notifications" in Settings drops the user out of the entire app shell into an
   unbranded, unstyled error page with no way back except the browser back button. This is the
   single worst fit-and-finish moment found in the whole pass — everywhere else in the app, even
   empty states have an icon/heading/CTA; this has none of that.
2. `app/settings/privacy/page.tsx:220` — literal `&apos;` renders as text, not an apostrophe
   ("You haven&apos;t blocked anyone").
3. `components/orders/OrderCard.tsx:45` — "Leave Review" links to `#reviews`, but `OrderView.tsx`
   reads `?tab=reviews` — the button does nothing.
4. `components/notifications/FollowRequestCard.tsx:50` — `to-warm-orange` is not a real token
   (real one is `orange-warm`), so the gradient's third stop silently no-ops.
5. `components/seller/SellerOrdersTable.tsx:15-46` — "Active"/"Pending" tabs filter only
   `in_progress`/`pending_payment`; orders in `pending_acceptance`, `paid`, `processing`,
   `submitted` are invisible under either tab.
6. `components/communities/ModQueue/ReportCard.tsx:217` — "Send Warning" resolution option has no
   handler; it's a silent no-op.
7. `components/notifications/NotificationPanel.tsx:704-706` — unknown notification types fall back
   to the heart/admire icon, which misrepresents what happened.

Plus, still present:
- **6 divergent `STATUS_CONFIG` copies** across seller/order surfaces, each with different colors
  for the same status; `submitted` is labeled "Delivered" in two of them.
- `components/ui/Avatar.tsx` and `TrendingSidebar` (in `ExplorePageContent.tsx`) are dead code —
  every real avatar site hand-rolls its own `<img>`/`next/image` instead.
- Raw `<img>` now used in **51 files / 111 instances** vs. `next/image` in 31 files (image
  optimization, lazy-loading, and layout-shift protection are being skipped in the majority of
  image call sites).
- **Live example — Community page header:** the "Create Post" pill sits directly next to the
  "Joined" pill in the same row. "Joined" is a crisp white background with bold purple text —
  fully legible. "Create Post" is near-white text on a translucent pale-pink fill over a pink/
  orange gradient banner — low enough contrast that it's genuinely hard to read at a glance,
  right next to a button that has no such problem.
- **Live example — Messages, incoming vs. outgoing bubbles:** outgoing messages are bold gradient-
  filled pills with white text, checkmarks, and reactions. Incoming messages have a barely-visible
  off-white fill with no border and no shadow — close enough to the page background that a
  conversation reads as one-sided at a glance, and it takes a second look to realize the other
  person's replies are there at all.
- **Live example — Explore (and any route without the homepage-only right rail):** the feed column
  stays pinned to the same fixed width used on Home, and the right sidebar simply isn't rendered —
  leaving a large asymmetric dead zone (roughly a third of the viewport on a 1512px window) instead
  of the content re-centering or expanding to use the space.
- **Live example — Insights overview:** "Engagement Rate" and "Interactions" are two different
  metric cards that both use the identical heart icon, with no other distinguishing glyph — at a
  glance there's no way to tell the two cards apart except by reading the label text.

---

## What's already working well (don't touch, use as reference)

Useful context for prioritization — these are the patterns other areas should be brought up to,
not rebuilt:

- **Empty states** on Messages and Marketplace (icon + heading + subtext + CTA) are clean and
  consistent with each other.
- **Loading state on Messages** (brand-icon spinner + pulsing dots + label) is the best of the 4
  competing loading idioms.
- **Studio profile** post-type cards (colored background + faint pattern + type-glyph watermark +
  pill badge) are one of the most visually resolved surfaces in the app.
- **Toast system** (`lib/utils/toast.ts` + `actionToast`) is well-contained and should be the model
  for consolidating the loading-state and optimistic-update sprawl.
- Theme switching itself (verified by toggling to Noir) holds up structurally — no broken layouts,
  legible contrast — across Home, Insights (including its recharts line/donut charts), Settings,
  and Messages.

---

## Net read

Nothing here requires new colors, fonts, or layout — every finding above is a "wire the existing
tokens/states onto the existing markup" problem, which matches the brief. The two largest
untapped-value items are (a) the 500 buttons with no hover/focus/active treatment and (b) the four
competing loading/feedback idioms, because fixing those two systemically (via a small number of
shared primitives + a duration/elevation/z-index token pass) will silently fix a large fraction of
the "screen by screen" findings above without touching most files by hand.

See `phase2-proposed-fixes.md` for the concrete proposal, grouped and prioritized, pending
approval before any code changes.
