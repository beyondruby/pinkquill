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

- **Messages:** give incoming bubbles a real fill (an existing subtle-surface token, not a new
  color) so conversations read as two-sided at a glance.
- **Community page header:** swap "Create Post"'s text/fill combo for one that keeps contrast
  against the gradient banner (existing white/near-white token instead of translucent pale pink).
- **Takes navigation:** give the "previous" chevron the same button chrome (ring, background,
  hover) as "next," just without forcing them to look identical if intentionally differentiated —
  at minimum it needs to read as tappable.
- **Insights overview:** swap the "Interactions" card's icon for a distinct existing glyph so it's
  not identical to "Engagement Rate."
- **Marketplace empty state:** branch the copy — genuinely-empty catalog gets different copy/CTA
  than a filtered-to-zero result (still using the existing empty-state icon/heading/CTA pattern,
  just two copy variants instead of one that's wrong half the time). Drop the duplicate "0 results"
  chip.
- **Explore (and any non-home route without the right rail):** re-center or widen the feed column
  when there's no right sidebar, instead of leaving the fixed-width gap.
- **`/settings/notifications`:** smallest-possible real page (or, if scope is off the table this
  wave, a branded "coming soon" page) so the link never drops a user into the raw Next.js 404 —
  this alone fixes the worst single moment found in the audit.
- **Bug fixes (all 7 from the audit — safe, no visual-identity dependency):** literal `&apos;`
  text, dead "Leave Review" anchor, `to-warm-orange` token typo, seller-orders tab under-filtering,
  mod-queue "Send Warning" no-op, notification icon fallback, plus consolidating the 6
  `STATUS_CONFIG` copies into one (fixes the "submitted" mislabeled "Delivered" bug as a side
  effect).
- **Reduced motion:** add a `useReducedMotion` hook and wire it into the handful of JS-driven
  animations (modals, drag interactions) that the CSS-only guard doesn't reach.

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
