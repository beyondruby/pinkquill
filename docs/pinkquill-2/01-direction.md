# Brand and experience direction

Status: proposed implementation direction, grounded in the September 5 brief. These are design decisions to prove in Phase 1, not claims of completed UI changes.

## The idea: room for your kind of creativity

Pinkquill should feel welcoming, expressive, personal, and unhurried. Its existing “Show your colors” line is a useful starting point. The work supplies the energy; the interface supplies clarity and room to participate.

The design must welcome beginners, people without a professional label, and people whose creativity crosses disciplines. A creator does not need a portfolio, a shop, or an audience to belong here. Sharing a voice is enough.

Use familiar interaction mechanics so the product is easy to learn. Create originality through the relationship between people, work, shared spaces, and creative exchange: composition, material, rhythm, and hierarchy. Do not invent cryptic navigation names to manufacture novelty.

## A recognizable visual language

**Color.** Keep purple `#8e44ad`, pink `#ff007f`, and orange `#ff9f43`. Let purple ground navigation and key actions, pink punctuate expression, and orange provide occasional warmth. Reserve the full gradient for a small number of identity moments. Give ordinary controls and content backgrounds quiet, mostly solid surfaces. Derive subtle tints from existing colors rather than introducing a competing palette. Validate readable foreground/background pairs; the brand colors themselves are not automatically suitable behind small white text. Existing success, warning, and error semantics remain distinct from decoration.

**Typography.** Begin with the existing Poppins/Open Sans UI stack. Improve weight, scale, line length, and spacing before adding fonts. Use conversational sentence case and readable labels. Keep creative typefaces inside the works that use them; the surrounding application should not turn every creator's work into an editorial page. Preserve author-selected typography and line breaks.

**Shape.** Soft rectangular content surfaces, restrained borders, and generous but purposeful spacing. Circular shapes belong primarily to people and compact controls. Avoid turning every filter, stat, form field, and section into a pill. Use one small radius scale with explicit component roles, selected in the prototype.

**Depth.** Media, foreground controls, and overlays should have clear layers. Ordinary content needs little or no shadow; popovers and dialogs need enough separation to remain legible. Reduce persistent background glows, floating ornaments, glass panels, and oversized promotional gradients where they compete with the work.

**Composition.** A stable navigation frame surrounds content whose shape responds to its medium. A photograph, performance video, audio work, and written piece should each retain their own proportions while sharing authorship, metadata, and interaction placement. The recurring recognizable element is the work together with its creator and a calm action row, carried from feed to community to studio to shop.

**Motion.** Short, purposeful state changes. No continuous decorative motion or controls that shift position on hover. Respect reduced-motion preferences. Playback progress remains functional.

**Themes.** Design the default palette first and prove Noir alongside it. Migrate the remaining existing themes through semantic tokens; preserve preference identifiers and the server/client theme handshake. A different theme must still feel like the same product.

## Navigation and information hierarchy

Use a shared navigation model across desktop and mobile, with a deliberate compact presentation on phones. Keep existing destinations and routes.

| Area | Proposed rule |
|---|---|
| Main destinations | Home, Explore, Communities, Shop, Messages, and the person's Studio are easy to find. Takes remains directly reachable; do not silently remove an existing mobile destination to make a mockup cleaner. |
| Create | One recognizable creation entry. Expose the existing Post, Product, and Service choices consistently across devices, with appropriate auth and seller-state handling. A product/service choice can be labeled in clearer language without changing its stored type. |
| Search | Visible and keyboard-accessible without requiring a hover-expanded rail. Retain the existing search capability and result behavior. |
| Personal tools | Saved, Bag, Orders, Insights, Seller Studio, Settings, and Help occupy predictable secondary navigation. Preserve badge counts and deep links. |
| Public vs private studio | “My studio” takes the person to their public identity; “Seller Studio” identifies management. Label the distinction explicitly instead of creating a new dashboard concept. |
| Context | Community, settings, seller, and order navigation stays within its own content frame, with a clear way back to the wider application. |
| Mobile | Keep a compact bottom bar plus a labeled route to secondary destinations. Resolve the exact slot allocation with all existing destinations visible in the Phase 1 navigation map. No essential control may depend on hover. |

The exact desktop width and mobile slot allocation are prototype decisions. They are not excuses to leave features without an entry point.

## What each area should feel like

| Surface | Design intent | Concrete change to prove |
|---|---|---|
| Feed | A place to encounter people's work at your own pace | Work appears early; creator identity is clear; three existing layouts serve different browsing needs; reactions and counts remain available without dominating the composition. |
| Composer | An inviting place to express something | Existing Text, Photo, Video, and Audio capabilities have equal discoverability. Put relevant tools beside the content; keep audience, community, warnings, and collaborators clear before publishing. Preserve drafts and recovery. |
| Takes | A focused performance and video experience | Controls remain visible against varied footage, reachable on phones, and separate from global navigation; preserve existing viewing and creation behavior. |
| Public studio | The person and the range of what they make | Bring work into view earlier. Keep biography, follow/message actions, existing tabs, collections, and commerce easy to reach. Use available fields; no new profile sections requiring new data. |
| Communities | A shared creative space with a clear purpose | Combine existing cover/avatar, description, membership state, rules entry, and contribution action into a compact identity area. Put members' work at the center. De-emphasize forum-style banner/sidebar/sort-strip repetition while keeping sorts, pinned posts, rules, and moderation. |
| Messages | A quiet conversation | Distinct incoming/outgoing surfaces, a clear conversation hierarchy, legible timestamps, reachable attachments, and predictable mobile back behavior. Retain existing differences between DMs and community messaging. |
| Shop and store | Creative work connected to its maker | Show work and creators near the top; reduce generic marketing banners. Make Products vs Commissions explicit. Keep price, format, availability, and delivery information easy to compare. |
| Commissions | A clear invitation to work with a creator | Lead with examples and the creator; show package scope, price, revisions, availability, requirements, and timing where a buyer chooses. Preserve request-before-payment behavior where applicable. |
| Orders | A clear place for buyer and creator to work together | A compact status sentence explains what happened, who acts next, and when. Group scope, messages, deliveries, and activity coherently. Keep financial and cancellation details precise and discoverable. |
| Dashboards | Practical tools belonging to this creative home | Prioritize actionable existing information over walls of equal-weight metric cards. Preserve reporting meaning, date ranges, tables, exports, and operational detail. Use calm typography and the same component language. |
| Settings, auth, help | A reassuring continuation of the product | Clear labels, focused forms, consistent feedback, and minimal distractions. Preserve privacy and recovery behavior. Public copy should welcome all kinds of creativity. |

## Interaction rules that answer “should this go here?”

1. **Action hierarchy:** one clearly dominant task per local context, with related secondary choices nearby. A status change or pending extension can change priority. Destructive actions are separated and explicitly labeled; support and dispute access must remain discoverable.
2. **Menus:** open beside their trigger, aligned to the content edge, and flip when space is insufficient. Dismiss on Escape, return focus, support keyboard traversal, and avoid off-screen placement. A menu is for short choices, not a long form.
3. **Context panels:** use the trailing side on wide screens so related content remains visible. On phones, use a bottom sheet for short tasks and a full-height surface for long forms or keyboards. The edge follows purpose and available space, not a global rule that every overlay opens on the same side.
4. **Navigation sheets:** originate from the navigation control's region. Keep navigation, notifications, and content actions visually distinguishable. Document stacking so a dialog cannot appear behind a video or reaction panel.
5. **Forms:** visible labels, errors next to the field, readable requirements before submission, a clear pending state, and preserved input after recoverable failures. Focus the first invalid field; don't rely solely on a toast.
6. **Long creation tasks:** preserve draft/edit state through steps and back navigation. Group existing advanced controls using progressive disclosure; do not drop them. Never make a destructive reset look like “Back.”
7. **Feedback:** consistent loading, success, empty, error, disabled, and unavailable states. Distinguish an empty catalog from filters returning zero results and a fetch failure. Preserve optimistic updates and their rollback behavior.
8. **Safety:** block, report, mute, privacy, content warnings, and community rules must remain understandable and reachable. Sanctuary is an experience goal, not a claim that moderation eliminates all harm.
9. **Responsive behavior:** test narrow phones, tablets, laptops, and wide screens. Sticky controls must leave enough content space and avoid the on-screen keyboard and device safe area. Preserve readable focus and touch targets; use logical layout properties where appropriate.
10. **Global audience:** check long names, mixed-direction text, non-Latin content, date/currency labels, and creator media of varied proportions. This is resilient presentation, not a new translation feature.

## Design proof content

Use local fictional fixtures, clearly separated from live data, that include illustration, photography, dance, acting, music, sports/movement, crafts, writing, and a casual personal post. Exercise all supported media; do not invent unsupported formats for these disciplines. Also include a text-only creator, a creator with no store, a creator with commissions, a new community, and a busy community.

A surface passes the identity review when it welcomes this mix, reads as Pinkquill without needing the logo repeated everywhere, and preserves a clear path to the existing task. Rich artwork must not be the only thing making the layout feel finished: empty, text-only, error, and ordinary-content states need equal attention.
