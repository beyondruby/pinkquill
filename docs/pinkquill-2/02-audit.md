# Current-state audit and preservation contract

Baseline: `e509c5a`, inspected 2026-09-05. This is a planning audit, not a claim that every role, route, or interaction has been tested.

## Evidence and limits

- Source inspection: app routes/layouts; global styles and theme/feed registries; navigation; feed renderers; composer; community header/category definitions; marketplace; public studio; seller layout; order actions; shared UI primitives; existing tests and historical audit/progress documents.
- Browser inspection: local home feed, `/community/writers-in-jeddah`, `/shop`, and `/studio/hadi`. Guest session, desktop viewport, existing Noir appearance. No posts, messages, memberships, orders, or account settings were changed.
- Authenticated flows, payment flows, mobile rendering, other themes, and screen-reader behavior remain to be checked in their implementation batches. Source-backed concerns below are distinguished from browser observations.
- Database/production claims in historical progress documents were not independently reverified. Those documents are contextual evidence only.

## Corrections to older plans

| Older statement | Current evidence | Planning consequence |
|---|---|---|
| Four feed layouts including Magazine | `lib/feed-view/registry.ts` lists Classic, Stream, Gallery; Magazine is retired. | Preserve three current layouts and their persisted IDs. Do not restore Magazine. |
| Alternate feed layouts lack access to all actions | `StreamView.tsx` expands to the real `PostCard`; Gallery opens detail and uses `useTileActions`. | Verify each action path; do not assume every action must be duplicated on every tile. |
| Notification settings route does not exist | `app/settings/notifications/page.tsx` and notification preferences implementation exist. | Redesign and verify the existing feature; do not rebuild it as a new feature. |
| No shared elevation/z-index/type extensions | `app/globals.css` already defines these tokens. | Extend and rationalize existing foundations rather than introducing a competing system. |
| No usable shared controls | Button, Avatar, Loading/Spinner, Modal, Sheet, ActionMenu, MetricCard, and error components exist. | Improve/adopt the existing controls after reviewing their behavior. |
| Orders are the older monolithic view | `components/orders/OrderPage.tsx`, `OrderActionBar.tsx`, and related modules now separate the experience. | Preserve recent action/state handling and redesign these modules. |
| Composer blueprint is the implementation truth | `docs/POST_CREATION_BLUEPRINT.md` contains historical proposals; current format registry has Text, Photo, Video, Audio categories and Music upload behavior. | Use actual code and handlers as the contract; comments about future formats are not capabilities. |

## Findings to carry into implementation

Priority here expresses redesign importance, not a security severity assessment. “Observed” means seen in the browser; “source” means evidenced in current code; “hypothesis” requires usability verification.

| ID | Evidence | Finding and impact | Proposed correction | Phase |
|---|---|---|---|---|
| UX-01 | Source + observed | Desktop rail expands from 72px to 220px on pointer hover; the search area is hidden while collapsed. `LeftSidebar.tsx` uses mouse enter/leave and hides search using opacity/height/pointer events. Search discoverability and keyboard focus need deliberate treatment. | Stable navigation/search presentation; verify no invisible interactive elements remain focusable. | 2–3 |
| UX-02 | Source | Desktop Create exposes Post/Product/Service; mobile Create links directly to `/create`. | Give the same existing creation choices a predictable mobile entry without making all of them primary nav items. | 3–4 |
| UX-03 | Observed + source | Shop opens with a large gradient hero and decorative marketplace illustration; filters/results appear lower down. `MarketplaceHero.tsx` also has a hardcoded white bottom wave visible in Noir. | Compact introduction; bring products/creators and filters into the first view; use semantic surface colors. | 7 |
| UX-04 | Observed + source | Community header occupies a large banner; About/member information is repeated in a right column beside familiar sort strips. | Compact community identity and membership actions; content-led main area; keep rules, members, sort/time-range, and staff tools reachable. | 5 |
| UX-05 | Observed + source | Public studio places a tall cover, identity, statistics, and About block before the work. | Bring work and the person's creative identity earlier; reduce the dominance of metrics and redundant containers. | 6 |
| UX-06 | Source | Community directory and create wizard each maintain category arrays. Directory has 12 named categories plus All; create has additional entries. The directory spotlights a hardcoded subset. | Reconcile display/filter mappings with stored topic values; preserve all existing categories and content, without inventing a new taxonomy. | 5 |
| UX-07 | Source | Shared Button still hardcodes white and hex colors in `outline-gradient`, and uses `bg-purple-50` in ghost state. ActionMenu also has raw light-purple states. | Semantic, tested interaction variants across themes; inspect contrast before rollout. | 2 |
| UX-08 | Source | MainContent and section layouts repeat fixed sidebar/mobile offsets; seller layout adds its own sidebar and sticky mobile navigation. | Shared page frames with explicit focused-task variants; check nested sticky headers, scroll containers, and small-screen content space. | 2–3, 9 |
| UX-09 | Source | Global stylesheet is 8,410 lines; CreatePost is 4,597; StudioProfile is 2,892 at this baseline. | Extract presentation seams as touched; migrate owned styles in bounded batches. Avoid a global replace or unrelated logic rewrite. | 2, 4, 6 |
| UX-10 | Source + observed | The local demo feed is predominantly written content. This is available content, not proof that other formats are unsupported. | Use broad local creative fixtures to validate the redesign; do not alter live posts or change ranking to fake diversity. | 1, 4, 11 |
| UX-11 | Source; active usage to verify | `MarketplaceHero.tsx` commission copy says “vetted creators.” The presence of a vetting guarantee has not been established by this audit. | Trace the rendered commission header and remove unsupported product guarantees from active copy. | 7 |
| UX-12 | Source | Existing accessibility tests primarily check labels/headings and text presence; a test named for contrast does not measure contrast. | Add targeted behavior coverage where meaningful and perform actual contrast/keyboard/visual checks. Do not treat these tests as a full accessibility audit. | 2, each batch, 11 |
| UX-13 | Source; hypothesis | “Studio” is used for public identity and “Seller Studio” for management; personal tools are spread through More menus. | Prove navigation labels and locations with guest/creator/buyer/seller journeys before changing links. | 1, 3, 6, 9 |
| UX-14 | Source | `OrderActionBar.tsx` already derives permitted controls from `actions.can_*` and explains status/actor/timing. | Preserve this strength; prioritize and restyle controls without reimplementing financial eligibility in presentation code. | 8 |

## Capabilities that must survive

Each implementation batch rechecks the exact current component/hook/API contract. This grouped list prevents aesthetic changes from silently narrowing the product.

| Family | Preserve and test |
|---|---|
| Feed and discovery | Guest reading, current layouts and persisted choice, supported media/types, pagination, sort/filter state, source ordering, visibility/block gates, warning treatment, error recovery, related tags, saved content, pending collaborations. |
| Social actions | Current reactions, comments/replies, relays, saves, shares/DM sharing, follows and requests, pin/edit/delete actions, collaboration actions, reports/blocks, moderator controls; verify across feed, detail, studio, and community entry points. |
| Creation | Existing text styling, uploads, audio/music metadata, video/Takes controls, titles and format-specific options, warnings, audience, tags/mentions, community/flair, collections, collaborators, drafts/recovery, editing, validation, and post-publication destination. |
| Studio | Current profile fields, author content styling, follow/message/privacy behavior, posts/Takes/relays/store/commissions/collections when available, collection item detail, owner actions, follower/following views. |
| Communities | Discover/joined/created, search/categories/sorts, privacy and join/request/invite/cancel states, rules, flairs, pinned content, membership/role permissions, moderation/reports/logs, settings, chat/modmail/appeals. |
| Messaging and notifications | DM conversation states, unread counts, attachments, audio/voice features, shared posts, reactions, realtime behavior and errors; community inbox capabilities as actually implemented; notification action links and preferences. Do not add DM-only capabilities to community chat as an incidental redesign. |
| Products and commissions | Browse/filter/save where supported; listing availability and packages, pricing/variants/PWYW where implemented, galleries, seller context/reviews, creation/editing, requirements/intake/reference files, request handling, existing cart and checkout rules. No new saved-item type or quote/extra feature. |
| Orders and payments | Kind/role/status eligibility, accurate currencies/totals/fees, seller acceptance, payment, revisions, extensions, delivery/files, physical tracking, buyer/seller messages, review visibility, cancellation/refund/dispute access, payout visibility and documents. Preserve server-authorized actions and handlers. |
| Management | Seller setup/onboarding, listings, orders, earnings/payouts, customers, analytics, settings; creator insights; admin order/refund/dispute/payout/system/settings capabilities and authorization. |
| Account and support | Auth modal/page, login/recovery, destination return, profile/account/privacy/appearance/notifications, content warnings, error/not-found/loading, help/legal copy, emails and receipts. Existing legal and financial meaning is preserved. |

## Technical guardrails

- Keep provider ordering, auth/unknown/anonymous distinctions, theme hydration, feed preference cookies and stored IDs, deep links, and existing route permissions.
- Keep payment/RPC/webhook, storage access, money calculations, and policy changes out of cosmetic refactors. Read their contracts when redesigning dependent flows; record any separate functional issue before deciding scope.
- Use existing registries for formats/themes/views; don't create a second switch table in the redesign layer.
- Preserve sanitization, media handling, creator fonts, image quality constraints, and current content visibility checks.
- Use semantic accessible names. If visible labels improve, update relevant tests for the same behavior rather than preserving a misleading label or weakening coverage.
- No adding analytics/tracking, third-party font/icon dependencies, or design-system packages merely to achieve a new look.

## Remaining baseline work

Phase 1 must capture mobile and default-theme evidence and inspect representative authenticated screens when a valid test session is available. Each later family requires controlled fixtures for empty/loading/error and role-dependent states. A lack of authenticated browser evidence must be recorded; it cannot be replaced by a “verified” checkbox based on source inspection alone.
