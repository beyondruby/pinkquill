# Pinkquill 2.0

Started 2026-09-05 · baseline commit `e509c5a` · status: proof, foundations, shell and Phase 3 discovery pages done; Phase 4 expression surfaces next.

Pinkquill is a social home for creativity in every form. Someone sharing a dance rehearsal, a drawing, a song, a sporting skill, a poem, or an ordinary thought should feel equally at home. The redesign must make that promise visible throughout the product.

This is the active plan for the September 5 brief. The abandoned identity proposals in `docs/redesign/` and the narrower constraints in `docs/polish/` are historical references. They do not override the new request for a complete redesign. Their useful findings must be checked against current code before reuse. This plan preserves the existing palette and capabilities; it does not revive previously proposed features, renames, or theme removals.

## Read in this order

1. [Brand and experience direction](01-direction.md): the creative strategy and concrete interaction rules.
2. [Current-state audit](02-audit.md): observed problems, source evidence, preservation contract, and verification limits.
3. [Implementation phases](03-phases.md): small work packages, dependencies, and completion criteria.
4. [Route coverage](04-route-coverage.md): every current page assigned to a phase, plus overlays and supporting surfaces.
5. [Progress and handoff](05-progress.md): completed work, next task, decisions, and unresolved verification.
6. [Design proof and decisions](06-design-proof.md): interactive screens, responsive decisions, and verification limits.
7. [Shared foundations](07-foundations.md): runtime control migration, six-theme reference, and component ownership.

## The implementation method

Prove one coherent direction across contrasting surfaces before spreading it through the application. The first design proof covers the feed, a community, a public studio, and an order. A design that only works for a beautiful image feed is insufficient.

Then build shared foundations and migrate complete journeys in small batches. Each batch includes its responsive layout, states, interactions, copy, and verification. Avoid an app-wide cosmetic replacement that leaves navigation and flows inconsistent underneath.

Completion is evidence-based: all routes accounted for, existing capabilities preserved, meaningful journeys checked, and visual consistency reviewed. A green build alone does not complete a design phase.

## Scope boundaries

- Keep the existing pink, purple, and orange identity. Preserve supported appearance preferences and their persistence.
- Redesign information hierarchy, navigation, layouts, presentation, component styling, and existing flows.
- Preserve existing content formats, creator controls, social actions, moderation, privacy, commerce, and financial behavior.
- Make room for future capabilities through reusable components and existing registries. Do not add new product capabilities, data fields, ranking systems, subscriptions, events, or other speculative features.
- Local design and implementation are authorized by the current request. Review checkpoints are concrete outputs, not automatic permission stops before routine work. Publication and any action beyond the redesign scope must be considered separately in context.

Review the [connected design proof](prototype/index.html) and the [real shared control reference](foundations/index.html). The four prototype screens use fictional local content. Runtime changes cover the shared Button, the layered surfaces (Modal, Sheet, ConfirmationModal, ActionMenu, ReportModal, notifications panel) on one overlay foundation, and the application shell (rail, top bar with visible search, phone bottom bar, More and Create sheets) on one navigation registry. Phase 3 (shell, Home and its three views, Explore, tags), 4A (post detail page and modal on shared seams) and 4B (composer) are complete. Next is **4C**, Takes and pending collaborations; see [the handoff](05-progress.md).
