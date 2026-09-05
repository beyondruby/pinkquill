# Implementation phases

This program is intentionally larger than one session. Work in the batches below, completing one reviewable slice at a time. Do not infer completion from elapsed time or from a file being restyled.

## Phase map

| Phase | Outcome | Dependencies |
|---|---|---|
| 0 | Current product mapped; brand brief and implementation plan saved | Complete for planning scope; role/device audit continues in later phases |
| 1 | One coherent design direction proved across contrasting screens | 0 |
| 2 | Shared design tokens, components, and page frames | 1 |
| 3 | Navigation and core feed implemented | 2 |
| 4 | Creating, viewing, and interacting with all current media redesigned | 3 |
| 5 | Communities, messaging, and notifications redesigned | 3–4 |
| 6 | Public studio, collections, and saved content redesigned | 3–4 |
| 7 | Shop, products, commissions, and listing creation redesigned | 2–3; coordinate creator context with 6 |
| 8 | Bag, checkout, buyer orders, and order workroom redesigned | 7 |
| 9 | Seller tools, insights, and admin redesigned | 6–8 |
| 10 | Account, support, and system surfaces unified | 2–3; reconcile final terminology from 4–9 |
| 11 | Cross-product verification and release preparation | 3–10 |

The dependency map allows independent batches to move if needed; it is not an instruction to launch parallel agents. Preferred order is numerical. Phase 5 and Phase 6 can switch if authenticated community access is unavailable.

## 0 — Establish the contract

Deliver the direction, initial evidence audit, complete page inventory, phased work packages, and progress ledger. Distinguish historical assumptions from current code and browser observations.

Done when every current page has an owning phase, the preservation rules are explicit, and the next batch can start without reconstructing the conversation. This does not mean exhaustive product testing is done.

## 1 — Prove the identity before scaling it

**1A: desktop direction proof.** Build a local, reviewable prototype of four connected surfaces: Home feed, Community, public Studio, and an Order. Use one direction from `01-direction.md`, existing colors and fonts, and fictional fixtures spanning creative disciplines. Include at least one photo, text, audio, and performance/movement example using existing media capabilities. The order proof uses an existing submitted-delivery state with actual permitted action names. The prototype has no live mutations.

**1B: interaction and mobile proof.** Demonstrate shared navigation, existing creation choices, a contextual menu, a notification panel, a short sheet, and a long-form layout. Map all current destinations across desktop and mobile. Check narrow width, keyboard focus/escape/return, and layered surfaces. Include default and Noir appearances.

**1C: resolve the design system.** Review the four screens together. Fix anything that makes the feed feel creative while orders still feel like an unrelated enterprise tool. Record chosen page widths, spacing, radii, type hierarchy, color roles, media treatment, mobile destinations, and overlay behavior. Capture the final proof and any user feedback.

Acceptance: recognizable family resemblance across all four surfaces; work appears early; no writer-only or professional-only framing; a person can find existing primary tasks; no new feature implied by prototype controls. Pixel choices remain adjustable during review; the prototype must be concrete before a direction question is needed.

## 2 — Build shared foundations

**2A: token reconciliation.** Extend the existing semantic token system with the chosen surface/type/radius/layout roles. Keep theme IDs and persistence; verify all six existing themes. Reduce conflicting global selectors in touched areas, with a component ownership map. Do not globally replace palette literals without checking their purpose.

**2B: interactive primitives.** Improve existing Button, Avatar, Loading/Spinner, Modal, Sheet, and ActionMenu first. Add shared field/tab/status/empty-state patterns only where repeated real needs justify them. Establish consistent disabled, pending, error, focus, selection, and destructive states. Include form labels, focus return, scroll lock, menu collision, and contrast verification.

**2C: page frames and component reference.** Create reusable social, discovery, studio, focused-task, and management frames sharing the same navigation and tokens. Render representative states in a local component reference. Define how focused Messages, Takes, checkout, and order screens reconnect to the wider app.

Acceptance: components work with keyboard and touch; no hardcoded light surfaces leak into dark themes; no theme flash introduced; at least one real use proves each new abstraction. Keep temporary prototype styling separate from runtime components until migrated deliberately.

## 3 — Navigation and the feed

**3A: application shell.** Migrate desktop rail, mobile header/bottom navigation/More, search, create entry, and notification trigger. Reconcile offsets and focus behavior. Check guest, authenticated, profile-loading, and unknown-auth states. Preserve counts, destinations, and return navigation.

**3B: Home and all three feed views.** Redesign Classic, Stream, Gallery, layout selector, creator identity, media/content framing, skeletons, errors, and empty states. Retain order/pagination and full action reachability through the appropriate post/expanded/detail surface. Gallery must have a meaningful keyboard reading order.

**3C: Explore and tags.** Carry the system through filters, sorting, query state, related tags, and discovery content. Check back navigation and saved view preferences. Keep existing recommendation/ranking behavior.

Acceptance: guest can browse and reach sign-in at the right interaction; returning creator can navigate/create/find a person without hover discovery; every current layout survives refresh and provides its supported paths to actions. Compare desktop/mobile screenshots and inspect media at varied ratios.

## 4 — Expression and social interaction

**4A: post detail and actions.** Reconcile page/modal presentation through shared view components where feasible. Preserve comments, deep links/highlights, reactions, relays, saves, shares/DM share, menus, collaborations, moderation, warnings, and visibility gates. Full-page and overlay navigation each need an explicit back/close contract.

**4B: composer.** Refactor presentation in small seams around the existing draft/upload/publish logic. Make media choices equally legible. Group optional format controls; retain creative styling, metadata, community/flair, audience, collections, collaborators, warnings, edits, and recoverable errors. Test a text post, image set, uploaded audio, and video using isolated fixtures or a designated test environment.

**4C: Takes and pending collaborations.** Redesign playback/creation/detail/comments/control layering and collaboration invitation states. Consolidate duplication only where behavior matches; do not merge separate flows by removing options.

Acceptance: each currently supported format retains its expressiveness; failed upload/publish does not erase work; member/moderator/owner menus remain correct; video overlays never conceal a required dialog; mobile keyboard does not cover critical actions.

## 5 — Communities and conversation

**5A: discovery and community home.** Redesign directory cards, categories, joined/created views, create flow, community identity, contribution entry, post feed, pinned content, and sorts. Reconcile existing taxonomy mappings. Keep the word Communities; no cosmetic renaming into a fictional feature.

**5B: membership, rules, moderation, settings.** Bring About/Members, invitations/requests, role controls, mod queue, and every settings tab into one local navigation system. Clearly express public/private/requested/joined/invited/muted/banned states and role-limited actions. Keep risky actions deliberate and separated.

**5C: DMs, community inbox, notifications.** Unify conversation framing, unread/read states, composition, attachments where supported, and mobile return behavior. Redesign notification panel and its links to preferences. Preserve existing capability differences between messaging systems.

Acceptance: a member can discover, understand, join/request, contribute, and find rules; a moderator can resolve an issue with the proper authority; a user can open a message/notification and return without losing context. Verify sparse and busy communities.

## 6 — People, studios, and collections

**6A: public studio.** Rebalance cover, identity, bio, social actions, metrics, and work. Use the existing fields and tabs; preserve owner/visitor/private/blocked states. Show a convincing text-only studio and a mixed-media studio.

**6B: studio content and collections.** Apply shared post/media/store treatments to existing tabs and collection item views. Preserve collection management and content permissions. Refactor the large StudioProfile component along these presentation boundaries.

**6C: saved library.** Unify saved Posts/Takes/Products views, removal/empty/error behavior, and navigation back to source content. Do not add saving for content types that lack the capability.

Acceptance: a visitor understands the person and encounters their work quickly; own-profile management is clearly distinct from public content; absence of a shop or commissions does not make the studio feel incomplete.

## 7 — Creative commerce

**7A: Shop and store browsing.** Replace the oversized generic hero with a concise creative introduction and work near the top. Unify cards, filters, empty/error states, search, sorting, availability, and maker attribution. Keep product and commission differences explicit.

**7B: product and commission detail.** Redesign galleries, options/packages, prices, specifications, reviews, availability, requirements/FAQ, seller context, and related actions. Build the request sheet on the shared overlay/form system. Keep scope and timing visible during selection; ensure the selected package remains clear through intake and handoff.

**7C: listing creation/editing.** Migrate product/service wizards and edit flows. Preserve category-specific fields, uploads, pricing rules, package limits, existing intake configuration, listing management, validation, and review/publish state.

Acceptance: a buyer can distinguish a ready-made product from a commission, understand the deliverable/cost/timing, and reach the correct existing next step. A seller can publish/edit supported listings without losing options or values. Validate short/long titles and missing media.

## 8 — Bag, payment, and orders

**8A: Bag and checkout.** Unify summary, selected options, shipping, discount/fee/currency labels, payment states, and completion page. Preserve all existing compatibility and checkout constraints; do not turn an existing cart into a new multi-seller payment system. No live payment is required for visual proof.

**8B: buyer orders and workroom.** Use existing `OrderPage`, `OrderActionBar`, and related modules. Present current state, actor, deadline, and next action first; make scope, deliveries, messages, activity, and documents easy to find. Test buyer and seller for commission/digital/physical/combined kinds as supported. Preserve requests, revisions, extensions, and review reveal rules.

**8C: exceptional states and documents.** Verify decline, expiry, cancellation, refund request/decision, disputes/evidence, delays, unavailable files, and payout-related messaging. Style receipt/invoice/download surfaces consistently without altering their meaning or money calculations.

Acceptance: for each allowed state, a person can identify what happened, whether payment has occurred, who acts next, and their available actions. Server action eligibility remains authoritative. No button gains authority merely because it is visible. Financial testing uses an identified safe test environment; otherwise record the unverified path.

## 9 — Creator and operational tools

**9A: seller overview, orders, listings, setup.** Make existing pending work and next actions easy to scan. Unify seller navigation, setup/onboarding presentation, and listing/order management; keep data-rich tables where they support the job.

**9B: earnings, payouts, customers, analytics, settings.** Apply shared layouts, date/filter controls, empty states, charts, and financial formatting. Keep gross/net/fees/payout distinctions and existing data definitions intact.

**9C: creator insights and administration.** Carry the same identity through insights overview/content/audience/community and detail pages, then admin orders/refunds/disputes/payouts/settings/system. Functional density can differ while typography, controls, states, and spacing remain unified.

Acceptance: actionable information has priority; data is neither hidden nor embellished to make dashboards more decorative. Reports retain their meaning and filters; all privileged controls retain their access restrictions. Verify zero-data and high-density examples.

## 10 — Account and supporting surfaces

**10A: auth and settings.** Redesign auth page/modal, auth-unavailable states, and profile/account/privacy/appearance/notification settings. Verify form errors, pending states, successful return paths, and actual theme/preference persistence when a test account is available.

**10B: About, Help, and policies.** Unify page framing, navigation, reading widths, and inclusive platform copy. Retain factual policy/financial meaning. Help should use the final interface vocabulary and examples across disciplines.

**10C: system surfaces and communication.** Error/not-found/loading, confirmation/report/share dialogs not already migrated, receipts/payout statements, transactional/auth emails, metadata, and social preview assets. Email/document styling is explicit; it does not inherit application CSS.

Acceptance: there is no old-design detour when a person signs in, encounters an error, reads help, or receives an email. All links and existing templates remain usable.

## 11 — Verify the whole product

**11A: route and state coverage.** Reconcile every row in `04-route-coverage.md` with evidence. Traverse the primary guest, creator, member/moderator, buyer, seller, and admin journeys. Record inaccessible roles and unresolved cases explicitly.

**11B: visual and accessibility consistency.** Compare cross-family screenshots at 360/390px, 768px, 1280px, and wide desktop as applicable. Check default/Noir in depth and all supported themes for semantic regressions. Exercise 200% zoom, keyboard/focus, menu collision, reduced motion, long names, mixed-direction text, unusual media ratios, errors, empties, and slow loading. Use contrast measurement, not visual guesses alone.

**11C: regression and release preparation.** Run relevant unit/hook tests and targeted E2E during batches; complete typecheck, lint, build, and broader regression suites before release. Compare baseline and new asset/request/layout behavior under equivalent conditions; investigate regressions. Remove obsolete owned styles/components only after checking references. Produce a concrete change summary, remaining limitations, and rollback boundary for release.

Acceptance: no unexplained failed required checks, no unowned route, no known feature loss, and no unresolved critical journey defect. Keep any unavailable environment validation visible rather than declaring the overhaul perfect. Deployment is a separate, explicit step with a verified result.

## Completion contract for every batch

1. Read the ledger and current relevant code; identify baseline changes since the prior session.
2. Name the route/component boundary, existing behaviors, and specific UX issues being addressed.
3. Build the whole slice, including loading/empty/error/disabled/permission states and responsive behavior.
4. Verify interactions with appropriate tests and browser checks. For money, publishing, messaging, or role changes, use controlled local fixtures/test environments; do not mutate live records for a screenshot.
5. Compare against at least two previously redesigned surfaces to catch visual drift.
6. Update the route row, findings IDs, files changed, evidence, limitations, decisions, and exact next step in `05-progress.md`.
7. Leave the application runnable. Keep a coherent revert boundary; don't commit/push user changes incidentally or combine redesign work with unrelated changes.

Each batch should be small enough to end at a stable checkpoint. If it grows beyond that, split it into named sub-batches and record the seam before continuing. Never mark a partial batch complete to fit a session.
