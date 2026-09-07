# PinkQuill — Unified Redesign & Hardening Master Plan

> **⚠️ ABANDONED as of 2026-09-01.** Phase 1 (direction pick) never happened and never will — the
> owner killed the identity-redesign track: no new brand color, no new fonts, no "Inkline" stroke,
> no rename, no theme retirement. `phase2-directions.md` and `mockups/` are historical only.
> `phase1-audit.md` (the feature-contract / route-map / component-reality sections) is still valid
> and was reused as the base for a **polish pass** (fit-and-finish, not redesign) — see
> `docs/polish/`.

Date: 2026-07-12. Supersedes nothing — this document *sequences* the two existing audits into one
phased program:

- `docs/redesign/phase1-audit.md` — the feature contract (Jul 2). Nothing listed there may regress.
- `docs/redesign/phase3-work-inventory.md` — per-surface design-quality / information-completeness /
  branding findings (Jul 12, verified). Feeds the page-by-page rebuild.
- June 2026 functional audit (memory: `full_audit_phase0_jun2026`) — remaining S4/S5/realtime items
  folded into Phases 5–6 below.

**Process rule (locked by owner):** show-before-ship. No redesigned surface replaces the live UI
until the owner has seen and approved it. Every wave in Phase 4 ends with an approval gate.

**Identity decisions already locked:** brand = "PinkQuill" everywhere · new identity ships
light + dark only (noir/cream/sepia/ocean/sunset retire; `data-theme` architecture stays) ·
tri-gradient chrome retires · full action parity across all 4 feed layouts · no accent-line
boxes (full subtle bg + full matching border instead) · PWYW floors ($0 products / $5 commissions).

---

## Phase 0 — Done (reference only)

- Jun 21 functional audit (11 clusters) + Phase 0–3 fixes applied to prod: security CRITICALs
  (RPC grants, free-order bypass, community_members privesc, follower_history RLS, private
  order-files), money correctness (dispute escrow, promo fee recompute, refund guards, download
  tokens for 'both'), migration reconciliation, realtime egress core, blind-reveal reviews,
  seller/order stats RPCs, getTimeAgo/formatDate dedup.
- Jul 2 UI audit confirmed as contract; 3 documented directions + 5 built mockups
  (`docs/redesign/mockups/`: A Wet Ink · B Atelier · C Print Run · D Unbound · E Senses).
- Jul 12 design/content/branding inventory (this program's Phase 3 input).

## Phase 1 — GATE: direction pick (owner decision, blocks all pixels)

Owner picks one of the five mockup directions (or a hybrid). Recommendation on record: **A "Wet
Ink"**, with Atelier's money-accent jurisdiction grafted on. Output: a one-page locked identity
spec (palette light+dark, type stack, radius/shadow/motion language, signature element).

## Phase 2 — Foundations (build, nothing user-visible ships)

1. **Tokens:** two `@theme` sets (light/dark) for the chosen identity; radius / shadow / spacing /
   z-index scales as tokens; semantic state colors; retire the legacy lowercase variable set and
   raw Tailwind palette colors.
2. **Primitives** (the only sane path to 724 raw buttons / 23 hand-rolled overlays): Button,
   Dialog (composed on base Modal: focus trap, `role="dialog"`, esc/overlay close), Avatar +
   AvatarGroup (kills the 5 default-avatar variants), Badge/CountPill, Switch, Tabs, Field
   (Input/Textarea/Select with labels), Tooltip, EmptyState.
3. **Consolidations that unblock restyling:** one order `STATUS_CONFIG`, one `formatNumber`, one
   `transformPostForCard`, one PostSkeleton, one confirm-dialog pattern, one MetricCard,
   legal `LegalPageLayout`.
4. **Brand rename:** "PinkQuill" across titles, copy, storage keys, email templates.
5. **Contract bug fixes** (safe now, no visual dependency): /settings/notifications 404 link
   target, privacy-page entity text, buyer "Leave Review" dead anchor, `to-warm-orange` token typo,
   seller orders multi-status tabs, mod-queue warning no-op, notification icon fallback — plus
   confirmed `bug`-kind findings from the Jul 12 inventory.
6. **A11y baseline:** focus-visible at CSS level, 44px touch targets, `aria-label` on icon
   buttons, keyboard access for hover-only controls, reduced-motion at CSS + JS.

Gate: tokens + primitives reviewed in a Storybook-style sample page (not shipped).

## Phase 3 — Flagship sample: shell + feed (the identity proof)

Rebuild on the new system: app shell (left rail, mobile header/tab bar, More menus, notification
panel, search) + home feed with **all 4 layouts at full action parity** (reactions, relay, share,
menu on compact/grid/magazine).

Gate: **owner sees the live sample and approves before any further rollout.**

## Phase 4 — Rollout waves (each wave: build → show → approve → ship)

| Wave | Surfaces | Structural work bundled in |
|---|---|---|
| 4a | Post detail + comments, composer, takes | Consolidate post-detail page/modal into one; merge CreateTake into composer take-mode |
| 4b | Explore, tags, saved, pending-collabs, notifications panel | Build real `/settings/notifications` preferences page; mobile search entry point |
| 4c | Communities suite, DMs, community inbox | Category taxonomy unify (13 vs 15); inbox/DM asymmetries triaged per inventory |
| 4d | Shop browse, product + commission detail, sell wizards, cart, checkout | One name for the bag concept; save-on-commission-cards parity |
| 4e | Seller studio, buyer orders + order view | Blind-reveal "hidden until reveal" state; buyer order-chat attachments decision |
| 4f | Studio profile + collections, insights, settings, auth | AuthForm/AuthModal dedupe; recharts token-driven colors; commissions-banner info-completeness |
| 4g | About/help/legal (LegalPageLayout), emails, error/404, SEO/OG | Email templates re-branded manually (no token inheritance) |

Each wave consumes its surface section from `phase3-work-inventory.md` (info-completeness,
UX-flow, copy findings) — design findings are fixed *as part of* the restyle, not after.

## Phase 5 — Structural & performance (parallel-safe with late Phase 4)

- StudioProfile 2.9k-line monolith split + tab pagination (fixes the useProfile unbounded posts
  load), explore server-side ranking RPC, seller-customers CRM pagination/search.
- Take interaction logic unified with feed hooks; revenue calc consolidation (3 sources).
- Deferred realtime conversions (DM chat, community threads, order channels, reaction counts) —
  each needs live verification, per Jun audit.
- Dead-code purge: /queue + /commissions/orders redirects, Sentry stubs, TrendingSidebar,
  dead Avatar component, unused handlers.
- `supabase db pull` reproducibility safety net.

## Phase 6 — QA & ship

- Full a11y sweep (dialogs, focus order, sr-only, contrast in both themes), reduced-motion audit.
- Playwright e2e green — accessible names preserved per contract (nav items, auth labels,
  commission-flow buttons).
- Visual QA screenshot pass across all routes in light + dark; Lighthouse/perf pass
  (image `qualities` whitelist respected, CSP unchanged).
- Final self-critique round (process Phase 4 from the Jul 2 plan) + owner sign-off.

---

### Standing constraints (from the contract — apply to every phase)

Preserve: SSR theme handshake + provider order, feed-view registry + cookie, the 13 deferred
per-post-type creative fonts, CSP `font-src 'self'` (next/font only), `next/image` qualities
whitelist, e2e accessible names. Emails don't inherit tokens — update by hand in 4g.
