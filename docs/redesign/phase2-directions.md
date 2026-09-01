# PinkQuill UI Revamp — Phase 2: Design Directions

> **⚠️ ABANDONED as of 2026-09-01.** None of these directions were picked or will be. The owner
> wants a polish pass, not a new identity — see `docs/polish/` instead. Kept for historical
> reference only.

Date: 2026-07-02. Depends on: `phase1-audit.md` (the contract).

## Decisions locked from Phase 1 review
- Audit confirmed as the feature contract.
- Full action parity across all 4 feed layouts (classic/compact/grid/magazine).
- New identity ships as **light + dark only**; themes noir/cream/sepia/ocean/sunset retire.
  (The `data-theme` architecture stays — we just ship two token sets.)
- Brand name: **PinkQuill** everywhere.
- `/settings/notifications` becomes a real notification-preferences page.
- Post-detail page/modal and the two take-creation flows are each consolidated to one implementation.
- Legal/help pages: one shared `LegalPageLayout` + tokens, not bespoke redesigns.

## What grounds these directions
PinkQuill is an expressive **writing-and-art studio with a marketplace** — poems, journals,
letters, essays, visual art, short video, commissions. Its users are makers. Its existing
vocabulary is already art-world: *Studio* (profile), *Takes*, *Relays*, reactions named like
audience responses (*admire, snap, ovation, applaud*), *Collections*, *Commissions*.
The name itself contains the two raw materials of the craft: **a pink instrument, and ink.**

Every direction below is derived from that. None of them would make sense for a generic
social app — that's the test.

Shared non-negotiables (all directions): WCAG AA contrast, visible focus, 44px touch targets,
`prefers-reduced-motion` honored at both CSS and JS level, skeletons where content shape is
known, the 13 per-post-type creative fonts preserved untouched (chrome stays disciplined so
the user's own typography is the loudest thing on screen).

---

## Direction A — "WET INK" (recommended)

**The idea.** The platform is a living page: everything the UI does, it does *in ink*.
Pink stops being a decoration (today's tri-gradient wash) and becomes **the ink in the quill** —
one saturated, confident inkpink used the way a calligrapher uses ink: deliberately, and
nowhere else. The rest of the interface is page and ink-black, so every post — the user's
own words and art — is the color on the page.

**Palette.**
| Token | Role | Light | Dark ("midnight desk") |
|---|---|---|---|
| `page` | app canvas | `#FAF8F5` warm paper-white | `#141119` |
| `surface` | cards/sheets | `#FFFFFF` | `#1C1824` |
| `ink` | text, icons, borders (via alpha) | `#1B1823` blue-black | `#ECE8E1` |
| `inkpink` | THE accent: primary actions, active states, the Inkline | `#D6136B` | `#FF5C9E` |
| `iris` | secondary accent: links, info, selected-quiet | `#5B51D8` | `#8F86F0` |
| Semantic | success / warning / danger | `#20794D` / `#A85A00` / `#C42B2B` | lightened equivalents |

No gradients in chrome. The current purple→pink→orange gradient (hand-rolled 225×) retires;
gradient survives only inside the reaction ink-bloom and the wordmark stroke.

**Typography.**
- Display: **Bricolage Grotesque** (Google, variable) — a grotesque with visible *ink traps*,
  literally designed around ink behavior. Used with restraint: page titles, empty states,
  counts on stats. Weights 600/800.
- Body: **Schibsted Grotesk** — high x-height, superb at 14–16px in dense feeds, warm without
  being cute. Weights 400/500/700.
- Utility: **Spline Sans Mono** — timestamps, counts, order numbers, tokens/prices set like
  typesetter's marks. One size (12px), weight 500, tracked slightly wide.
- Scale (px / line-height): 12/16 utility · 14/20 body-s · 15/22 body (feed default) ·
  17/26 body-l (post detail) · 20/26 title-s · 24/30 title · 32/38 display · 44/48 hero.

**Layout.** 8pt spacing scale (4-64). Radius language "trimmed paper": 8px controls,
12px cards, 20px sheets/modals, full only for avatars/pills — kills today's 5-value sprawl.
Elevation = ink, not grey: shadows are `ink` at 4–8% alpha, two levels only (rest / raised).
Density: feed comfortable (15px body), detail generous (17px + wider measure ~68ch),
settings/seller compact (14px, tighter rows). Z-index tokenized to 6 layers.

**Motion — "the page writes itself."**
- Loading: no spinners anywhere. A single ink stroke **draws itself** (SVG stroke-dashoffset)
  — the wordmark's underline for full-page loads, a short rule for sections. Skeletons keep
  content shape with a pale ink-wash shimmer.
- Reactions: tap → an ink drop blooms and dries (300ms, scale+fade). The 6 reaction glyphs
  become ink stamps.
- Nav: the active item is marked by a short hand-drawn underline stroke (animated on change).
- Everything else is still: no page transitions, no parallax, no hover-lift on cards.
- `prefers-reduced-motion`: strokes render pre-drawn, blooms become instant state changes.

**The signature — THE INKLINE.** One living ink stroke, one system: it underlines the
wordmark, draws itself as every loading state, marks the active nav item, blooms as the
reaction burst, and rules off post footers. A screenshot of any page shows a hand-drawn ink
line somewhere doing real work — that is the tell. Everything around it is quiet.

**Post identity.** Each of the 10 post types keeps its glyph (from `post-type-theme.ts`) but
rendered as a small **ink stamp** (monogram in a stamped circle, slight texture) — the one
place besides the Inkline where personality lives on a card.

**Why it isn't a template:** no cream+serif+terracotta (paper is neutral-warm, type is
grotesque, accent is saturated inkpink); no dark+acid-green; no hairline broadsheet (rules
are hand-drawn strokes, not hairlines, and only where they end content). Changed during
self-review: body face switched from Inter (default-trap) to Schibsted Grotesk; UI serif
dropped entirely so chrome never competes with the 13 content faces.

---

## Direction B — "THE ATELIER"

**The idea.** The platform is a working gallery. Every post is a *work on display*; the UI
is the wall. Profiles are literally called Studios today — this direction takes the product
at its word. Chrome recedes to plaster and graphite; the one indulgence is the museum label.

**Palette.**
| Token | Role | Light | Dark ("after hours") |
|---|---|---|---|
| `plaster` | canvas | `#F4F2ED` bone | `#17181B` |
| `wall` | cards | `#FDFCFA` | `#1F2125` |
| `graphite` | ink | `#26241F` | `#E9E7E1` |
| `madder` | primary action (rose madder — a real pigment) | `#D23A6E` | `#F0698F` |
| `brass` | commerce accent: prices, seller UI, plaque frames | `#8C6D3F` | `#C9A96A` |
| Semantic | success/warn/danger | pigment-derived greens/ochres/cadmium |

Two accents with strict jurisdiction: madder = social actions, brass = money. Nothing else
gets color.

**Typography.** Display: **Syne** (arts-scene poster face, unmistakable) — headers, section
titles, Studio names. Body: **Hanken Grotesk** 400/500/600. Utility: **Fragment Mono** for
plaque metadata. Scale as Direction A but titles run larger (galleries breathe): display 36,
hero 52.

**Layout.** Wider gutters (12-col desktop grid, 88px max side margins), works float with
generous whitespace; radius minimal (4px controls, 8px cards — frames, not pebbles);
elevation nearly flat, hanging is implied by spacing not shadow. Feed density: lower than
today — fewer, larger works per viewport (compact view preserves the dense option).

**Motion.** Almost none, and that's the statement: fades only (150ms), plus one gesture —
works **settle** 2px downward on first paint, like being hung. Reactions: the label's
reaction count flips like a mechanical counter. Reduced-motion: all instant.

**The signature — THE PLAQUE.** Every post and product carries a museum caption block,
typeset in Fragment Mono: *title · artist · medium (post type) · date* — the metadata IS the
design. On products the plaque gains a brass price line. Screenshot tell: gallery labels
everywhere, doing real informational work.

**Risks (honest).** Flatters visual art more than writing; long text posts read as
"exhibited documents" which can feel cold for journals/letters. Lower feed density is a real
engagement trade-off. Syne polarizes.

**Why it isn't a template:** the label system encodes real metadata (not decorative rules);
brass/madder jurisdiction is a rule no template has; density is an opinion.

---

## Direction C — "PRINT RUN"

**The idea.** The platform is an indie print studio / zine club. Risograph is the most
beloved printing process in the working-artist community PinkQuill serves — and riso's most
famous ink is **fluorescent pink**. The palette isn't "inspired by" anything: it IS the
standard riso ink chart.

**Palette (riso ink chart).**
| Token | Role | Light (uncoated stock) | Dark ("night print") |
|---|---|---|---|
| `stock` | canvas | `#F5F1E8` | `#131520` |
| `sheet` | cards | `#FBF8F1` | `#1B1E2B` |
| `soft-black` | ink | `#1D1D1B` | `#EFEBE0` |
| `fluor-pink` | primary | `#FF48B0` | `#FF5FBB` |
| `riso-blue` | secondary ink | `#0078BF` | `#4FA8E8` |
| Semantic | riso green `#00A95C` / riso orange `#FF6C2F` / bright red `#F15060` | — |

**Overprint rule:** where pink and blue surfaces overlap (chips on banners, active tab on
selected row) they blend multiply into violet — a two-ink press behavior implemented in CSS
`mix-blend-mode`, decorative surfaces only, never over user content.

**Typography.** Display: **Archivo** variable, Expanded width + Black weight — chunky zine
masthead energy. Body: **Karla** 400/500/700. Utility: **Space Mono** (edition numbers,
timestamps, prices). Scale as A, but display sizes tracked tight and set in caps sparingly.

**Layout.** Visible structure: 4px radius everywhere except pills; borders are real
(2px soft-black at 10–14% alpha) instead of shadows — printed, not floating. Spacing 8pt.
Dense feed by default (zines are dense).

**Motion.** Stamps: interactions land like a rubber stamp (scale 1.06→1 with 0.5° settle,
120ms). Save = a "STAMPED" impression. Loading: a registration cross rotates. Hover on cards:
a ≤2px misregistration shift of the type-glyph layer. Reduced-motion: all instant, no shift.

**The signature — OVERPRINT.** The two-ink multiply system + stamped interactions. A
screenshot shows pink and blue layers overprinting into violet — nobody else renders UI
like a print proof.

**Risks (honest).** The loudest direction: it will date fastest, and fluorescent surfaces
compete with user artwork unless jurisdiction is enforced ruthlessly. Multiply-blend needs
care for contrast guarantees. Playful tone may undercut the marketplace's "professional
commission" trust surface.

**Why it isn't a template:** the palette is a real ink chart with a real press behavior
(overprint) as the system rule; nothing hairline, nothing cream-serif, nothing acid-green.

---

## Recommendation

**Wet Ink.** It is the only direction that:
1. Comes straight out of the name — quill → ink → inkpink. Unfakeable provenance.
2. Serves writing and visual art equally (Atelier favors images; Print Run favors vibe).
3. Ages well — the signature is a behavior (the drawn line), not a trend texture.
4. Solves the audit's biggest debt naturally: one accent with strict jurisdiction replaces
   225 hand-rolled gradients; ink-alpha elevation replaces the shadow/border sprawl.
5. Keeps the marketplace credible: calm chrome + mono price marks read "professional studio,"
   not "party flyer."

Runner-up graft if Wet Ink wins: the Atelier's **brass-for-commerce jurisdiction** is worth
stealing — a distinct money accent (`iris` could take this role, or a muted brass) keeps
buy/sell affordances honest across the marketplace.

## Next step
Owner picks a direction (or a hybrid). Then Phase 3 begins in the agreed order:
**tokens + core primitives → feed (all 4 layouts) → shown for approval before anything else
is rolled out.** Nothing is applied to the live UI until the feed sample is approved.
