# PinkQuill Polish Pass — Phase 2 Proposed Fixes

Status: **proposal, not started.** Nothing in this document has been implemented. Waiting on
owner approval (per screen or per wave — owner's call) before any code changes.

Constraint carried through every item below: **no new colors, fonts, radii, or layout shapes.**
Every fix either (a) picks one existing value to standardize on where several currently compete,
or (b) adds a missing state/transition using colors/timings already in the design system.

---

## Wave A — Foundation tokens (touch `globals.css` only, invisible on its own)

Nothing ships visually different from this wave alone — it just gives every later fix something
consistent to point at, instead of picking a fresh arbitrary value each time.

1. **Spacing/radius/shadow/z-index/duration scales as CSS variables**, values chosen to match the
   *most common* existing usage (not new numbers) — e.g. z-index gets 6-8 named steps
   (`--z-dropdown`, `--z-modal`, `--z-toast`, …) replacing the 21 scattered literals; duration
   collapses onto `--duration-fast/base/slow` matching the existing 150/300/500 cluster.
2. **One shared type-scale check:** don't force every `text-[…]` onto the 9 standard steps in one
   pass (too risky for a first wave) — instead add 2-3 of the *most repeated* arbitrary sizes
   (`0.95rem`, `11px`, `10px`) as named tokens so new code has a real option other than another
   one-off, and file-by-file cleanup happens as each screen gets touched in Wave C.

## Wave B — Primitives (the 500-button problem, in one place)

**Status: started.** Landed so far:

3. **`Button`** (`components/ui/Button.tsx`) — done. 6 variants (`primary`, `secondary`, `outline`,
   `outline-gradient` for the composer/wizard "Next" pattern, `ghost`, `danger`), 3 sizes, all with
   hover/focus-visible/active/disabled/loading baked in once. Migrated: `ConfirmationModal` (~20
   usage sites inherit the fix at once) and `ReportModal` (~10 sites) — both also had their
   `z-[…]` literals pointed at the Wave A `--z-modal` token. **Not yet migrated:** the other ~700
   raw buttons (nav, composer, wizards, seller/settings pages) — next slice of this wave.
4. **`Avatar`** — the primitive already existed (`components/ui/Avatar.tsx`) but had zero
   importers. Wired it into the entire Messages surface as planned: `ConversationList`,
   `ChatView` (x2), `TypingIndicator`, `SharedPostCard`, `NewMessageModal`, `SendToDMModal` (x2).
   One of these (`NewMessageModal`) was hard-coding an Unsplash URL as its avatar fallback — one of
   the audit's "5 default avatar variants" instances, now gone. Also fixed, in the same file: a
   `border-l-[3px]` accent-line selected-state in `ConversationList` that violated the existing
   "no accent-line boxes" rule — swapped for full bg + full border per that rule.
   **Not yet migrated:** Avatar usage outside Messages (studio profile, feed post cards, community
   member lists, etc.) — still raw `<img>`/`getOptimizedAvatarUrl` call sites.
5. **`Loading`/`Spinner`** — the full `Loading` block already existed and is solid (it's the
   Messages "Loading chat" pattern); added a new small `Spinner` export for inline/button use
   (Button's own `loading` state uses it). Swapped 2 of the ~50 bare `animate-spin` instances
   (`SendToDMModal`) as a proof point. **Not yet done:** the other ~48, notably the copy-pasted
   cluster across `app/community/**` pages — good next batch since they're near-identical.

The incoming/outgoing message-bubble contrast fix mentioned above is still Wave C (visual fix, not
a primitive) — not done yet.

**Second pass landed:** consolidated the copy-pasted `app/community/[slug]/**` loading-spinner
cluster (mod queue, settings, moderation, chat, flairs, members — 9 identical/near-identical
instances, including the role-colored variants on the members page) onto `Spinner`, plus migrated
their adjacent submit/action buttons (chat settings save, community delete confirm) onto `Button`.
Same treatment for `app/settings/{privacy,account,profile}` (unblock button, update-email, update-
password, save-profile — all now `Button`; cover/avatar upload spinners now `Spinner`) and one-off
spots in `app/tag/[tag]` and the checkout-complete page (also dropped a FontAwesome `faSpinner`
import there in favor of `Spinner`, one small dent in the icon-fragmentation finding).
`app/settings/profile/page.tsx`'s avatar preview had its own hardcoded Unsplash fallback — a third
instance of the "5 default avatars" finding — now on `Avatar`.

Bare `animate-spin` count: **~64 remaining across 35 files** (was ~50 files at Wave B start),
concentrated now in feed/post-card, takes, auth, communities-modals, and marketplace — good next
slice. Raw-button count not re-measured yet.

**Third pass landed:** the feed/post-card cluster — the single highest-traffic surface in the app.
`components/feed/PostCard/{Block,Delete}ConfirmModal.tsx`, and the two hand-rolled block/
moderator-delete dialogs inside `PostCard.tsx` and `PostDetailModal.tsx`, all migrated to `Button`
(their z-index literals also pointed at `--z-modal`) — moderator-only "sweep"/"delete" actions kept
their deliberate orange color (not flattened into the red `danger` variant) but gained the same
focus-visible/active states by hand. `Feed.tsx`'s infinite-scroll spinner and `CommentItem.tsx`'s
two spinners + moderator-delete dialog also done. The composer (`CreatePost.tsx`, 4,606 lines) got
its 7 spinner instances consolidated and its **Next**/**Publish** buttons — the app's other major
recurring button shape (white fill + gradient border, also used in the commission/product wizards)
— migrated onto `Button`'s new `outline-gradient` variant; `Save Draft`'s 3-way color state
(default/saving/saved-green) was deliberately left as a bespoke button since `Button` doesn't
support a custom color per state, only its inline spinner was swapped. Verified live: composer
Next → Publish flow end-to-end, and the feed's block-user confirm dialog.

Bare `animate-spin`: **48 remaining** (was 64). Good next batches: takes, auth modals
(`AuthModal`/`AuthForm` — high traffic, login/signup), and the communities modals (Invite,
ModeratorPermissions, JoinButton).

## Wave C — Screen-by-screen fit & finish

Each item below is independently shippable and small; owner can approve them individually or as
a batch.

**Status: mostly done.** Landed:

- ✅ **Messages:** incoming bubbles across DMs (`ChatView.tsx`, 4 message-type variants) and the
  community inbox (`CommunityInboxView.tsx`, 2 variants) swapped from `bg-surface` (near-white on
  near-white — the actual bug) to `bg-subtle`. Verified live.
- ✅ **Community page header:** "Create Post" now matches the `JoinButton` convention already used
  next to it (`bg-surface/90 text-purple-primary`, high contrast) instead of the old translucent
  `bg-surface/20 text-white`. Verified live.
- ❌→✅ **Takes navigation — correction, not a bug.** Re-checked live: both arrows share identical
  CSS (`.takes-nav-arrow`, same 56px gradient-ring styling). The "invisible" up-arrow in the
  original audit screenshot was the *correctly disabled* state at the first take (`activeIndex ===
  0`) — confirmed by navigating to a later take, where both arrows render identically. No change
  made; audit finding retracted.
- ✅ **Insights overview:** "Interactions" now uses a distinct chat-bubble icon (matching the file's
  existing inline-SVG style) instead of a second heart. Verified live.
- ✅ **Marketplace empty state:** copy now branches on `hasActiveFilters` — a genuinely empty
  catalog says "No products/commissions yet — check back soon," a filtered-to-zero result keeps
  the old "adjust your filters" copy + Clear-filters CTA (hidden entirely for the empty-catalog
  case, since there's nothing to clear). Dropped the duplicate "N results" text in
  `MarketplaceHeader.tsx` (kept the richer badge cluster in `DiscoveryStrip`).
- ✅ **All 7 known bugs:**
  - literal `&apos;` in `settings/privacy` → real apostrophe.
  - "Leave Review" now links `?tab=reviews` (matches what `OrderView` actually reads) instead of
    the dead `#reviews` hash.
  - `to-warm-orange` typo → `orange-warm` (real token) in `FollowRequestCard`.
  - Seller orders tabs rebuilt on the same `{statuses: [...]}` multi-status pattern already used
    (and already correct) in `BuyerDashboard` — "Active" and "Pending" no longer hide
    paid/processing/pending-acceptance orders.
  - Mod-queue "Send Warning" now actually notifies the reported user — required a new
    `community_warning` notification type, which needed a live Supabase migration (additive CHECK
    constraint change, applied with your explicit go-ahead) since the `notifications.type` column
    is constrained. Also added the missing icon/message-copy wiring for it.
  - Notification icon fallback changed from the misleading heart to a dedicated warning-triangle
    icon (also now used for `community_warning` itself).
  - **`STATUS_CONFIG` consolidated**: new `lib/utils/orderStatus.ts` is the single source for
    `OrderCard`, `SellerDashboard`, `SellerOrdersTable`, and `CustomersCRM` (4 of the 6 — these
    shared an identical shape). `OrderView.tsx` kept its own copy (it also carries per-status SVG
    icon paths the others don't have — merging it in would've meant inventing icons for statuses
    that don't need them) but got the same one-line "submitted" mislabel fix. Net: "submitted"
    reads "Submitted," not "Delivered," everywhere now.
- ⬜ **`/settings/notifications`:** not started — still 404s. Biggest remaining item.
- ⬜ **Explore (and other non-home routes without the right rail):** not started — still leaves
  the fixed-width dead zone.
- ⬜ **Reduced motion hook:** not started.

## Explicitly out of scope for this pass

- Icon-system unification (FontAwesome vs. inline SVG vs. `Icons.tsx`) — real effort, no visible
  win on its own; revisit only if it blocks a Wave B primitive.
- The 617 arbitrary `text-[…]` instances beyond the 3 tokenized in Wave A — file-by-file as each
  screen is touched, not a dedicated sweep.
- `next/image` migration for the 111 raw `<img>` instances — performance work, not fit-and-finish;
  flag separately if the owner wants it.
- Anything from the old `docs/redesign/` identity track (new brand color, fonts, Inkline stroke,
  theme retirement, rename) — dead, per owner decision 2026-09-01.

---

## Suggested order

Wave A and B are prerequisites that make Wave C cheaper and more consistent — recommend doing
A → B → C in that order rather than jumping straight to visible fixes, but happy to reorder
(e.g. ship the `/settings/notifications` 404 and the 7 known bugs first as quick, isolated wins)
if the owner wants visible progress sooner.

**Waiting for approval on scope/order before writing any code.**
