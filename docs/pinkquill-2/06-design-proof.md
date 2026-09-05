# Phase 1 — Design proof and decisions

2026-09-05. [Open the local proof](prototype/index.html). Run instructions and simulated behavior: [prototype README](prototype/README.md).

The four connected screens establish a social home in which the work and its creator carry the visual energy. Community identity is compact; studios lead into work; the order uses the same identity/control language while giving priority to what happens next. The default pink/purple/orange identity, existing quill, and Poppins/Open Sans stack remain.

## Decisions to carry into implementation

| Role | Proof choice / migration rule |
|---|---|
| Canvas | Default `#fcfafc`, solid white surfaces, restrained borders; reconcile with existing semantic tokens |
| Text | Default ink `#302637`, secondary `#685d70`; no brand-colored small text without contrast measurement |
| Accent | Purple `#8e44ad` for primary actions; pink `#ff007f` and orange `#ff9f43` as limited identity accents |
| Type | Poppins UI, Open Sans body; desktop page title 29px, phone 23–26px; creator-selected serif stays inside creative content |
| Production readability | Proof has some 10–11px metadata; increase reusable production labels to at least 12px rather than copying all fixture sizes |
| Shape | Control 11px, input 9px, content card 17px, dialog 20px; avatars circular |
| Spacing | Reconcile proof's near-duplicate values to a 4px-based production scale, keeping media composition responsive |
| Frame | 214px stable desktop rail, 188px at compact desktop; 1216px maximum main region including gutters, Classic feed about 690px |
| Gutters | Proof 38px wide / 25px compact / 18px phone (14px at 360); normalize production to 40 / 24 / 16px |
| Actions | Minimum 44px major touch controls; fixed bottom order actions leave safe-area space and a More route back to the app |
| Content | Creator, work, then a quiet action row; row-major gallery reading order; no image requirement for a complete-looking studio |
| Overlays | Anchored collision-aware action menu; trailing desktop notifications/More panel; phone short sheets; full-height phone long form |
| Focus | Escape and return focus, no navigation scroll jump, dialog containment, visible focus ring; native boundary verification remains open below |

These are working implementation decisions, not a record of user approval of final pixels. The user approved proceeding with the plan. No new direction permission is pending.

## Navigation allocation

Desktop: Home, Explore, Communities, Shop, Messages, My studio, Orders, More, with persistent Create/search/account/notifications. Phone: Home, Explore, Create, Takes, More. More exposes studios, communities, orders, messages, shop, saved, bag, pending collaborations, insights, Seller Studio, settings, and help. Secondary destinations keep their current names and routes.

The phone order screen replaces the regular bottom navigation with the current permitted task actions plus More. This keeps approval/revision reachable without isolating the user. Account-specific gates/counts are not modeled by the fixture.

Gallery is only the preview's initial layout. Production keeps its existing preference/default contract. The proof's lavender Noir is an experiment; runtime migration preserves all six theme IDs and current theme identity, including cyan Noir. Do not copy the two-theme preview toggle into production.

## Verification evidence

Browser: Codex in-app browser, local static server, September 5. Screenshots were inspected inline during the working session; no durable screenshot files were exported. Reproduce them with the routes and sizes below.

- Home, community, studio, and order at 360, 390, 768, and 1280px: no horizontal overflow. Default desktop/mobile compositions and Noir desktop/mobile order were visually inspected. Four Noir routes also fit at 1280px. Loaded assets were inspected with no broken images.
- Browser interactions checked: save focus/pressed state; menu arrow/Escape/return; studio commission open/close; draft medium switching and recovery; search-to-studio navigation; local order messaging; revision submission; approval confirmation to completed; mobile More navigation.
- 13 JSDOM behavior checks passed: gallery sequence, save focus, dialog key handler wrapping, draft recovery, menu keys, search escaping/navigation, owner attribution/actions, independent follows, community leave/join, revision feedback, approval, escaped messages, error retry.
- Empty/loading/error views are local content-region simulations. Their presence does not establish actual network/retry integration.

Measured contrast ratios (sRGB):

| Pair | Default | Proof Noir |
|---|---:|---:|
| Main text / canvas | 13.87 | 16.45 |
| Secondary text / surface | 6.20 | 7.83 |
| Primary button text / fill | 5.87 | 8.78 |
| Selected text / tint | 6.95 | 8.72 |

Only these pairs were measured; this is not whole-product accessibility certification.

## Findings addressed and remaining checks

Fixed during proof: gallery's initial column-major DOM order, follow state incorrectly shared across people, lost revision feedback after submission, mobile order controls below a long summary, focus return scrolling the global header out of view, and undersized mobile action targets.

Native dialog keyboard boundary testing is **inconclusive**: in-app automation placed focus on the document body without delivering the expected Tab keydown to the page. Explicit containment passes the JSDOM handler checks, while Escape/return and menu keys worked in the browser. Verify real keyboard Tab/Shift+Tab with the runtime dialog primitive before declaring Phase 1B fully verified. Do not mark that browser check passed based on JSDOM.

Also pending for integrated components: screen reader review, 200% zoom, OS reduced motion, phone software keyboard, all six themes, real role/permission states, failed uploads, financial transitions, and persisted preferences. The proof adds CSS reduced-motion handling but that OS setting was not tested here.

## Handoff

Phase 1A and 1C are delivered; 1B is implemented with the native-keyboard verification limit above. Shared foundations can proceed; that open check belongs to the Phase 2 overlay work. Do not spread prototype JavaScript or fixture actions into production. Extend the real semantic tokens and existing primitives, preserving application hooks and server authority.
