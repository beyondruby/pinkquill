# Phase 2 — Shared foundation migration

## First slice: control tokens and Button

Implemented September 5, 2026. This is the first slice of 2A/2B, not completion of the foundation phase or any route redesign.

- `app/design-tokens.css` adds semantic roles for primary actions, tinted actions, control borders, destructive actions, and the 11px control radius. It preserves existing palette values, theme IDs, registry, cookie/profile preference handling, and pre-paint theme resolution.
- `components/ui/button.css` owns the Button appearance in Tailwind's component layer. Consumer utility classes remain available for layout overrides. All sizes provide at least a 44px target; large is 48px. Long labels wrap. Focus is a solid 3px outline. Hover/press feedback does not resize the control. Reduced motion disables its transitions and spinner animation.
- `components/ui/Button.tsx` consumes these roles while preserving variants, native type behavior, ref, attributes, caller style/classes, full width, loading labels, and disabled behavior. Existing `outline-gradient` callers remain valid; their appearance becomes a tinted accent control with a readable border instead of a hardcoded white fill. No click handlers or permission logic changed.
- All current Button consumers receive this shared change, including order sheets, composer Next/Publish, commissions, account forms, confirmations, and admin actions. Raw buttons are not silently migrated.

Cream and Sepia use darker action colors in their existing hue families to make small button text readable. Runtime Noir retains cyan. The prototype's experimental purple Noir does not alter its registry or stored identity.

## Second slice: overlay layer, Modal, Sheet, ConfirmationModal, ActionMenu, ReportModal

Implemented September 5, 2026 (2B overlays plus the 2A shape/surface roles they needed).

- `components/ui/overlay/useOverlayLayer.ts` is the single behaviour owner for layered surfaces: a layer registry so only the top-most open layer answers Escape; a counted body scroll lock that restores the previous overflow value (nested sheet-in-modal and menu-in-sheet no longer unlock early); Tab/Shift+Tab containment; initial focus on the first field (skipping `[data-overlay-close]`) or a named element; focus return to the trigger on close. Menus register without scroll lock or focus trapping.
- `components/ui/overlay/Scrim.tsx` dismisses only when a press starts and ends on the scrim, so selecting text inside a dialog and releasing outside no longer closes it.
- `components/ui/overlay.css` owns appearance: `.pq-scrim`, `.pq-dialog` (+ `--xs/--sm/--md/--wide`), head/body/foot, `.pq-confirm`, `.pq-icon-button`, `.pq-menu` and items with semantic tones, `.pq-choice`. Bottom sheet on phones, centred dialog from 768px, dynamic-viewport height caps, safe-area footer padding, reduced-motion handling.
- `app/design-tokens.css` gained shape roles (`--radius-input/card/dialog/menu`) and derived surface roles mixed from the active theme (`--color-line`, `--color-line-strong`, `--color-tint`, `--color-danger-soft`, `--color-success-soft`, `--color-warning-soft`, `--color-scrim`, `--color-scrim-strong`) plus per-theme `--color-danger-ink/success-ink/warning-ink`. Tailwind emits static fallbacks and `@supports (color-mix)` overrides automatically.
- `Modal` no longer renders an `aria-hidden="true"` ancestor around its own dialog (the source-observed defect); API unchanged, `size="md"` added for regular content dialogs. The phone full-screen treatment moved from a fragile `.fixed.inset-0.bg-black\/90 > div` selector in `globals.css` (now inert) to `.pq-dialog--wide`.
- `Sheet` keeps its API (`title`, `subtitle`, `footer`, `busy`, `size`) and gains `bodyClassName`; heading is linked with `aria-labelledby`.
- `ConfirmationModal` now uses the shared layer (it previously reset body overflow to `auto` and had no containment) and focuses the safe choice first; `role="alertdialog"` with title/description ids kept.
- `ActionMenu` keeps its API. Item tones use tokens instead of `red-50`/`emerald-50`/`purple-50` literals that leaked light fills into dark themes; the portal menu uses `--z-popover` instead of `9999`; Tab closes the menu; Escape inside a menu no longer closes the sheet or dialog beneath it.
- `ReportModal` was rebuilt on `Sheet` (first real consumer proof beyond orders/commissions): the fixed 400px card that overflowed 360px phones is gone, the details field has a real label, and the success step has a Done action.

Verification: 9 new React behaviour tests in `components/ui/__tests__/overlays.test.tsx` (Escape ownership across Modal→Sheet→menu, scroll-lock counting, focus entry/containment/return, busy blocking, scrim press semantics, confirmation safe focus, report flow). TypeScript and ESLint pass. Browser check in the running app at 1380px: post action menu, delete confirmation, and post detail dialog in Default and Noir; body overflow and dialog count return to zero after Escape. Reference page rebuilt with real `Sheet` and `ConfirmationModal` rendered inline.

Not migrated in this slice (owned by later phases): `NotificationPanel`, `MobileMoreSheet` (3A shell), `ShareModal`, `PeoplePickerModal`, `NewMessageModal`, `SendToDMModal`, `InviteModal`, `FollowersModal`, `NewCollection*Modal`, `AuthModal`, `Lightbox`, Takes pickers/panels. They still write `document.body.style.overflow` directly and use raw z-index literals; each migrates onto `useOverlayLayer` when its phase touches it.

## Third slice: page frames (2C) and the application shell (3A)

Implemented September 5, 2026.

- `components/layout/shell.css` owns the frame: `--pq-rail` (0 / 188px / 214px at phone / tablet / ≥1280px), `--pq-topbar` (56px / 64px), `--pq-bottom-nav` (64px / 0), `--pq-aside` (280px on the home discovery column at ≥1024px) and `--pq-gutter` (16 / 24 / 40px). Pages never hardcode the rail width again; `.pq-main` reads the variables. `.pq-page` (+ `--reading` 860px, `--narrow` 690px) and `.pq-page-head` are the page-width and title roles from the proof; `PageFrame`/`PageHeader` in `components/layout/PageFrame.tsx` render them (first consumer: the post detail loading/error states).
- `components/layout/navigation.tsx` is the single registry of destinations, icons, gating (via `isProtectedPath`), badge keys and active-state matching. The rail, the phone bottom bar, the More sheet and the Create choices all read it. Guests now see every public destination (Home, Explore, Communities, Shop, Takes) instead of only Home/Explore.
- `AppShell` (`components/layout/AppShell.tsx`) replaces the hand-assembled `MobileHeader` + `LeftSidebar` + `MainContent` + `MobileBottomNav` combination in all ten section layouts, `AdminShell`, and the post/take detail pages. `chrome="rail"` keeps Takes immersive; Messages is treated the same because it owns its header. `LeftSidebar.tsx`, `MobileHeader.tsx` and `MainContent.tsx` are deleted.
- `DesktopRail`: stable width, no hover expansion (UX-01), labelled links with `aria-current`, unread count on Messages, Create as a shared Button opening the existing Post/Product/Service menu, account row linking to the public studio plus a More menu (Saved, Bag, Pending collaborations, Insights, Seller Studio, Settings, Help, appearance, log out).
- `TopBar`: search always visible on every width (UX-01), notifications bell with count, studio avatar on desktop, brand + Messages on phones, Sign in for guests with a return redirect.
- `MobileBottomNav`: Home, Explore, Create, Takes, More (guests: Sign in instead of Create). Create opens the same three choices as desktop on a short Sheet (UX-02). `MobileMoreSheet` is rebuilt on `Sheet` with the account card, grouped destinations, appearance and log out.
- `NotificationPanel` keeps all of its data/actions and now renders inside `Sheet presentation="panel"` (new trailing side-panel presentation, full screen on phones): Escape ownership, focus and scroll lock come from the shared layer; the hand-rolled 9998/9999 z-indexes and body-overflow writes are gone.
- Search: `SearchBar` field and `SearchDropdown` results restyled on tokens, results open below the field (not beside a rail), native search cancel button hidden, and the random Unsplash portrait used as a fallback avatar in results is replaced by the default avatar.
- Sticky page headers that assumed no top bar (community header, explore, marketplace header, tag, saved, feed layout picker, checkout/commission summaries, section tab strips) now offset by `--pq-topbar`.
- Canvas token moved to the proof's `#fcfafc`; the aura blobs are kept but at 0.12 opacity so the work carries the colour.

Verification: 8 shell tests (`components/layout/__tests__/shell.test.tsx`) cover the registry (guest gating, studio href/active), rail states (guest vs signed-in, badges, Create and More menus), top bar (search for guests, notification count and panel), bottom bar (guest slots, Create sheet, More sheet with badges and log out). Full unit suite, `tsc` and ESLint pass (warnings only, `<img>` and pre-existing). Browser: signed-in home at 1380px (rail, top bar, right column, notifications panel, search results); guest `/`, `/shop`, `/community` at iPhone 12, 768px and 1280px via Playwright with no horizontal overflow. Playwright E2E result is recorded in the ledger.

Not in this slice: the content of Home/Explore/Shop/Community pages (their heroes, cards and toolbars are Phases 3B–7), `RightSidebar` content, `AuthModal`, the Messages header, and the standalone Help/legal/About headers which still draw their own fixed bars.

## Local reference

[Open shared controls](foundations/index.html). This is static server-rendered output of the **real** React Button and compiled app stylesheet, not a second handwritten button implementation. It contains inert examples and a document-only theme selector. No application route or account connection was added.

Rebuild after changing the component or stylesheet:

```sh
npx tsx scripts/build-design-reference.tsx
```

Open the file directly, or serve the whole program folder:

```sh
python3 -m http.server 4318 --bind 127.0.0.1 --directory docs/pinkquill-2
```

Reference URL: <http://127.0.0.1:4318/foundations/>. Connected proof: <http://127.0.0.1:4318/prototype/>. Generated `foundations/index.html` and `app.css` are review artifacts; production imports no file from this directory.

## Verification

- Four React tests pass: native submit and pending prevention; explicit non-submit/ref/expanded state; disabled state after pending ends; composer variant/caller style compatibility.
- TypeScript and targeted ESLint pass. The actual global stylesheet compiles through the installed Tailwind/PostCSS pipeline for the reference.
- Browser inspection confirms the expected solid controls, 11px radius, 44px/48px targets, long-label wrapping, Default/Cream/dark appearances, and no horizontal overflow at 360px and 1280px in the reference. Runtime integration evidence is recorded in the progress ledger.
- Resolved tokens were measured for every supported theme. A first rapid-toggle measurement caught colors mid-transition; final ratios below use resolved tokens, with settled Default/Noir computed button colors also inspected. Do not reuse intermediate animation readings as failures or passes.

| Theme | Primary text | Tinted action text | Ghost text | Destructive text | Outline border | Focus ring |
|---|---:|---:|---:|---:|---:|---:|
| Default | 5.87 | 6.95 | 8.26 | 6.11 | 3.33 | 5.87 |
| Cream | 5.72 | 6.17 | 7.16 | 6.11 | 3.44 | 5.72 |
| Sepia | 5.36 | 6.21 | 7.51 | 6.11 | 3.31 | 5.36 |
| Noir | 10.66 | 8.94 | 12.13 | 8.84 | 4.03 | 9.88 |
| Ocean | 8.46 | 7.37 | 9.64 | 8.84 | 4.34 | 7.04 |
| Sunset | 8.31 | 7.94 | 10.96 | 8.84 | 5.00 | 7.73 |

Ratios compare normal text to its fill and border/focus to the existing surface token. Disabled controls, imagery behind transparent controls, forced-color mode, animation intermediate frames, and every consumer-specific override are outside this measurement. No full-product accessibility or financial workflow verification is claimed.

## Ownership and remaining work

| Area | Owner / next migration |
|---|---|
| Theme identities and base surfaces | Existing `app/globals.css`, `lib/theme/registry.ts`, theme provider/server handshake; preserve behavior |
| Migrated control roles | `app/design-tokens.css`; extend by semantic purpose as consumers migrate |
| Button | `components/ui/Button.tsx` + `button.css`; styling no longer duplicated in the component |
| Avatar, Loading | Existing UI primitives; reconcile when the first redesigned frame (3A/3B) consumes them |
| Modal, Sheet, ConfirmationModal, ActionMenu, ReportModal | Migrated onto `overlay/useOverlayLayer.ts` + `overlay.css`; remaining hand-rolled overlays migrate with their phase |
| Legacy global post/dialog selectors | Do not sweep-delete. Move owned rules when the corresponding component migrates in Phases 3–5; broad selectors can override component-layer rules and require consumer checks |
| Page spacing/type/surface roles | Remaining 2A work; normalize proof values with first real frame consumers |
| Application frame, page widths | `components/layout/shell.css`, `AppShell`, `PageFrame`/`PageHeader`; section sidebars (settings, seller, insights, console) stay with their phases |
| Navigation destinations | `components/layout/navigation.tsx`; add or gate a destination here, never in a component |

The `Modal` `aria-hidden` ancestor is fixed and covered by a test. Phase 1B's native Tab/Shift+Tab boundary is covered by the JSDOM containment test and the shared handler; a real-keyboard pass in a browser is still listed as open verification.

Revert boundary for runtime changes: the three stylesheet imports in `app/globals.css`, `app/design-tokens.css`, `components/ui/button.css`, `components/ui/overlay.css`, `components/ui/overlay/*`, and the five migrated components (`Button`, `Modal`, `Sheet`, `ConfirmationModal`, `ActionMenu`, `ReportModal`). Fixtures, docs, tests, and the reference builder are separate. No dependencies, business rules, API routes, deployment, or database schema changed.
