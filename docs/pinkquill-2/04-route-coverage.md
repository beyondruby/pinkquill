# Route coverage

Generated from the current `app/**/page.tsx` files on 2026-09-05 at baseline `e509c5a`. Route groups are removed from URLs. This is a coverage inventory, not a claim that the pages were all browser-tested.

**85 page files; 85 unique route patterns; every page has an owning implementation phase.**

Phase 2 owns shared foundations; Phase 11 verifies every row. Set individual status only after actual work. Add concrete screenshot/test evidence as routes are verified. Guest desktop browser observations apply only to the sample URLs listed in `02-audit.md`.

September 5 update: the four-screen proof and component reference live outside application routing. Shared Button, Modal, Sheet, ConfirmationModal, ActionMenu and ReportModal styling reach existing consumers on every route that uses them, and every route inside the app now renders through the new `AppShell` (rail, top bar, bottom bar). Page content is still the old design, so route statuses below remain unchanged until their phase. Foundation evidence is in `07-foundations.md`.

| Route pattern | Source | Phase | Redesign status |
|---|---|---|---|
| `/` | [app/(feed)/page.tsx](../../app/(feed)/page.tsx) | 3 | Redesigned in 3B (frame, toolbar, three views, states, right column); media-rich cards to verify in Phase 4 |
| `/explore` | [app/(feed)/explore/page.tsx](../../app/(feed)/explore/page.tsx) | 3 | Redesigned in 3C (frame, tab row, type menu, topics list, states) |
| `/tag/[tag]` | [app/tag/[tag]/page.tsx](../../app/tag/[tag]/page.tsx) | 3 | Redesigned in 3C (now inside AppShell; header, chips, states) |
| `/create` | [app/(feed)/create/page.tsx](../../app/(feed)/create/page.tsx) | 4 | Redesigned in 4B (frame, steps, toolbar, media, format choice, extras, footer menus); Take editor on shared pieces in 4C |
| `/pending-collaborations` | [app/(feed)/pending-collaborations/page.tsx](../../app/(feed)/pending-collaborations/page.tsx) | 4 | Redesigned in 4C (narrow frame, note, draft list with counts and buttons) |
| `/post/[id]` | [app/post/[id]/page.tsx](../../app/post/[id]/page.tsx) | 4 | Redesigned in 4A (shared PostDetail seams, conversation card, back contract); media-rich and commented posts to verify |
| `/take/[id]` | [app/take/[id]/page.tsx](../../app/take/[id]/page.tsx) | 4 | Redesigned in 4C (PostDetail seams + TakeStage; auth-wait and error-clear bug fixed) |
| `/takes` | [app/takes/page.tsx](../../app/takes/page.tsx) | 4 | Redesigned in 4C (immersive feed on tokens, quiet arrows, rail states, comments on Sheet) |
| `/takes/create` | [app/takes/create/page.tsx](../../app/takes/create/page.tsx) | 4 | Redesigned in 4C (reading frame, shared Take editor pieces, disclosures) |
| `/community` | [app/community/page.tsx](../../app/community/page.tsx) | 5 | Redesigned in 5A (frame, search + sort, tabs, one category row, quiet cards, states) |
| `/community/[slug]` | [app/community/[slug]/page.tsx](../../app/community/[slug]/page.tsx) | 5 | Redesigned in 5A (compact identity + tab row in the layout client, feed with sorts/pinned/welcome, rules aside, gates) |
| `/community/[slug]/about` | [app/community/[slug]/about/page.tsx](../../app/community/[slug]/about/page.tsx) | 5 | Redesigned in 5B (about, rules, tags, details, run-by list) |
| `/community/[slug]/members` | [app/community/[slug]/members/page.tsx](../../app/community/[slug]/members/page.tsx) | 5 | Redesigned in 5B (search, invite, requests, tabs, person rows with a real menu, mute/ban sheets) |
| `/community/[slug]/mod` | [app/community/[slug]/mod/page.tsx](../../app/community/[slug]/mod/page.tsx) | 5 | Redesigned in 5B (Reports inside the settings frame; queue hook column fixed) |
| `/community/[slug]/settings` | [app/community/[slug]/settings/page.tsx](../../app/community/[slug]/settings/page.tsx) | 5 | Redesigned in 5B (local nav frame, overview rows, typed delete) |
| `/community/[slug]/settings/chat` | [app/community/[slug]/settings/chat/page.tsx](../../app/community/[slug]/settings/chat/page.tsx) | 5 | Redesigned in 5B (welcome message, switches) |
| `/community/[slug]/settings/flairs` | [app/community/[slug]/settings/flairs/page.tsx](../../app/community/[slug]/settings/flairs/page.tsx) | 5 | Redesigned in 5B (FlairManager on shared fields and rows) |
| `/community/[slug]/settings/general` | [app/community/[slug]/settings/general/page.tsx](../../app/community/[slug]/settings/general/page.tsx) | 5 | Redesigned in 5B (fields, cover/mark pickers, choice cards) |
| `/community/[slug]/settings/members` | [app/community/[slug]/settings/members/page.tsx](../../app/community/[slug]/settings/members/page.tsx) | 5 | Redesigned in 5B (moderators and requests tabs) |
| `/community/[slug]/settings/moderation` | [app/community/[slug]/settings/moderation/page.tsx](../../app/community/[slug]/settings/moderation/page.tsx) | 5 | Redesigned in 5B (log sentences, muted/banned rows) |
| `/community/[slug]/settings/rules` | [app/community/[slug]/settings/rules/page.tsx](../../app/community/[slug]/settings/rules/page.tsx) | 5 | Redesigned in 5B (editable numbered rows, add panel) |
| `/community/create` | [app/community/create/page.tsx](../../app/community/create/page.tsx) | 5 | Redesigned in 5A (three composer steps on the shared taxonomy) |
| `/messages` | [app/(feed)/messages/page.tsx](../../app/(feed)/messages/page.tsx) | 5 | Redesigned in 5C (list, thread, composer, voice on `messages.css`; one phone pane state) |
| `/messages/community` | [app/(feed)/messages/community/page.tsx](../../app/(feed)/messages/community/page.tsx) | 5 | Redesigned in 5C (three panes on the DM frame, announcements as labelled bubbles) |
| `/saved` | [app/(feed)/saved/page.tsx](../../app/(feed)/saved/page.tsx) | 6 | Not started |
| `/studio/[username]` | [app/studio/[username]/page.tsx](../../app/studio/[username]/page.tsx) | 6 | Not started |
| `/studio/[username]/collections/[collection]/[item]` | [app/studio/[username]/collections/[collection]/[item]/page.tsx](../../app/studio/[username]/collections/[collection]/[item]/page.tsx) | 6 | Not started |
| `/commissions/[id]` | [app/commissions/[id]/page.tsx](../../app/commissions/[id]/page.tsx) | 7 | Not started |
| `/product/[id]` | [app/product/[id]/page.tsx](../../app/product/[id]/page.tsx) | 7 | Not started |
| `/sell` | [app/sell/page.tsx](../../app/sell/page.tsx) | 7 | Not started |
| `/sell/edit/[id]` | [app/sell/edit/[id]/page.tsx](../../app/sell/edit/[id]/page.tsx) | 7 | Not started |
| `/sell/service` | [app/sell/service/page.tsx](../../app/sell/service/page.tsx) | 7 | Not started |
| `/shop` | [app/(feed)/shop/page.tsx](../../app/(feed)/shop/page.tsx) | 7 | Not started |
| `/cart` | [app/(feed)/cart/page.tsx](../../app/(feed)/cart/page.tsx) | 8 | Not started |
| `/checkout/[orderId]` | [app/(feed)/checkout/[orderId]/page.tsx](../../app/(feed)/checkout/[orderId]/page.tsx) | 8 | Not started |
| `/checkout/[orderId]/complete` | [app/(feed)/checkout/[orderId]/complete/page.tsx](../../app/(feed)/checkout/[orderId]/complete/page.tsx) | 8 | Not started |
| `/orders` | [app/(feed)/orders/page.tsx](../../app/(feed)/orders/page.tsx) | 8 | Not started |
| `/orders/[id]` | [app/(feed)/orders/[id]/page.tsx](../../app/(feed)/orders/[id]/page.tsx) | 8 | Not started |
| `/orders/[id]/receipt` | [app/orders/[id]/receipt/page.tsx](../../app/orders/[id]/receipt/page.tsx) | 8 | Not started |
| `/admin` | [app/admin/page.tsx](../../app/admin/page.tsx) | 9 | Not started |
| `/admin/disputes` | [app/admin/disputes/page.tsx](../../app/admin/disputes/page.tsx) | 9 | Not started |
| `/admin/disputes/[id]` | [app/admin/disputes/[id]/page.tsx](../../app/admin/disputes/[id]/page.tsx) | 9 | Not started |
| `/admin/orders` | [app/admin/orders/page.tsx](../../app/admin/orders/page.tsx) | 9 | Not started |
| `/admin/payouts` | [app/admin/payouts/page.tsx](../../app/admin/payouts/page.tsx) | 9 | Not started |
| `/admin/refunds` | [app/admin/refunds/page.tsx](../../app/admin/refunds/page.tsx) | 9 | Not started |
| `/admin/settings` | [app/admin/settings/page.tsx](../../app/admin/settings/page.tsx) | 9 | Not started |
| `/admin/system` | [app/admin/system/page.tsx](../../app/admin/system/page.tsx) | 9 | Not started |
| `/insights` | [app/insights/page.tsx](../../app/insights/page.tsx) | 9 | Not started |
| `/insights/audience` | [app/insights/audience/page.tsx](../../app/insights/audience/page.tsx) | 9 | Not started |
| `/insights/communities` | [app/insights/communities/page.tsx](../../app/insights/communities/page.tsx) | 9 | Not started |
| `/insights/content` | [app/insights/content/page.tsx](../../app/insights/content/page.tsx) | 9 | Not started |
| `/insights/content/post/[id]` | [app/insights/content/post/[id]/page.tsx](../../app/insights/content/post/[id]/page.tsx) | 9 | Not started |
| `/insights/content/take/[id]` | [app/insights/content/take/[id]/page.tsx](../../app/insights/content/take/[id]/page.tsx) | 9 | Not started |
| `/seller/analytics` | [app/seller/(studio)/analytics/page.tsx](../../app/seller/(studio)/analytics/page.tsx) | 9 | Not started |
| `/seller/customers` | [app/seller/(studio)/customers/page.tsx](../../app/seller/(studio)/customers/page.tsx) | 9 | Not started |
| `/seller/dashboard` | [app/seller/(studio)/dashboard/page.tsx](../../app/seller/(studio)/dashboard/page.tsx) | 9 | Not started |
| `/seller/earnings` | [app/seller/(studio)/earnings/page.tsx](../../app/seller/(studio)/earnings/page.tsx) | 9 | Not started |
| `/seller/listings` | [app/seller/(studio)/listings/page.tsx](../../app/seller/(studio)/listings/page.tsx) | 9 | Not started |
| `/seller/onboarding` | [app/seller/(studio)/onboarding/page.tsx](../../app/seller/(studio)/onboarding/page.tsx) | 9 | Not started |
| `/seller/orders` | [app/seller/(studio)/orders/page.tsx](../../app/seller/(studio)/orders/page.tsx) | 9 | Not started |
| `/seller/payouts/[id]` | [app/seller/payouts/[id]/page.tsx](../../app/seller/payouts/[id]/page.tsx) | 9 | Not started |
| `/seller/settings` | [app/seller/(studio)/settings/page.tsx](../../app/seller/(studio)/settings/page.tsx) | 9 | Not started |
| `/seller/setup` | [app/seller/(studio)/setup/page.tsx](../../app/seller/(studio)/setup/page.tsx) | 9 | Not started |
| `/about` | [app/about/page.tsx](../../app/about/page.tsx) | 10 | Not started |
| `/community-guidelines` | [app/community-guidelines/page.tsx](../../app/community-guidelines/page.tsx) | 10 | Not started |
| `/help` | [app/help/page.tsx](../../app/help/page.tsx) | 10 | Not started |
| `/help/account` | [app/help/account/page.tsx](../../app/help/account/page.tsx) | 10 | Not started |
| `/help/communities` | [app/help/communities/page.tsx](../../app/help/communities/page.tsx) | 10 | Not started |
| `/help/getting-started` | [app/help/getting-started/page.tsx](../../app/help/getting-started/page.tsx) | 10 | Not started |
| `/help/insights` | [app/help/insights/page.tsx](../../app/help/insights/page.tsx) | 10 | Not started |
| `/help/interactions` | [app/help/interactions/page.tsx](../../app/help/interactions/page.tsx) | 10 | Not started |
| `/help/messaging` | [app/help/messaging/page.tsx](../../app/help/messaging/page.tsx) | 10 | Not started |
| `/help/posting` | [app/help/posting/page.tsx](../../app/help/posting/page.tsx) | 10 | Not started |
| `/help/privacy-safety` | [app/help/privacy-safety/page.tsx](../../app/help/privacy-safety/page.tsx) | 10 | Not started |
| `/help/settings` | [app/help/settings/page.tsx](../../app/help/settings/page.tsx) | 10 | Not started |
| `/login` | [app/login/page.tsx](../../app/login/page.tsx) | 10 | Not started |
| `/marketplace-guidelines` | [app/marketplace-guidelines/page.tsx](../../app/marketplace-guidelines/page.tsx) | 10 | Not started |
| `/privacy` | [app/privacy/page.tsx](../../app/privacy/page.tsx) | 10 | Not started |
| `/settings` | [app/settings/page.tsx](../../app/settings/page.tsx) | 10 | Not started |
| `/settings/account` | [app/settings/account/page.tsx](../../app/settings/account/page.tsx) | 10 | Not started |
| `/settings/appearance` | [app/settings/appearance/page.tsx](../../app/settings/appearance/page.tsx) | 10 | Not started |
| `/settings/notifications` | [app/settings/notifications/page.tsx](../../app/settings/notifications/page.tsx) | 10 | Not started |
| `/settings/privacy` | [app/settings/privacy/page.tsx](../../app/settings/privacy/page.tsx) | 10 | Not started |
| `/settings/profile` | [app/settings/profile/page.tsx](../../app/settings/profile/page.tsx) | 10 | Not started |
| `/terms` | [app/terms/page.tsx](../../app/terms/page.tsx) | 10 | Not started |

## Shared and non-page surfaces

| Surface | Main source area | Owning phase | Status |
|---|---|---|---|
| Root providers, theme/font setup, global tokens | `app/layout.tsx`, `app/globals.css`, `lib/theme/`, `components/providers/` | 2 | Not started |
| Desktop/mobile navigation, search, create/More menus | `components/layout/`, `components/search/` | 3 | Not started |
| Post detail modal, reactions, comments, sharing, reporting, media lightbox | `components/feed/`, `components/comments/`, `components/ui/` | 4; shared mechanics in 2 | Not started |
| Takes players, reactions, comments, creation controls | `components/takes/` | 4 | Redesigned in 4C (`TakeStage`, `TakeEditorPieces`, `takes.css`; `TakeComments.tsx` deleted) |
| Membership/invite/role/flair/moderation overlays | `components/communities/` | 5 | Redesigned in 5B (`ModerationSheet`, invite and permissions on `Sheet`, `FlairManager` on shared fields) |
| Notification panel, invitations, follow requests | `components/notifications/` | 5 | Redesigned in 5C (`notifications.css`, monochrome kind marks, `PersonRow` cards) |
| Studio follower dialogs and collection controls | `components/studio/`, `components/collections/` | 6 | Not started |
| Product reviews, seller cards, commission intake/request sheet | `components/reviews/`, `components/store/`, `components/commissions/` | 7 | Not started |
| Order sheets, downloads, activity, deliveries, messages, financial documents | `components/orders/`, `components/documents/`, `lib/invoice/` | 8 | Not started |
| Payout statement and seller/admin supporting controls | `components/seller/`, `components/admin/` where present | 9 | Not started |
| Auth modal/unavailable, generic errors/loading/not-found, remaining confirmations | `components/auth/`, `app/**/error.tsx`, `app/**/loading.tsx`, `app/not-found.tsx` | 10; route-local states belong to each earlier phase | Not started |
| Transactional/auth emails, metadata, social preview assets | `lib/email/`, `email-templates/`, route metadata, `public/` | 10 | Not started |

## Coverage maintenance

At each checkpoint compare this list with current page files, not with historical route counts. Preserve existing redirects and query parameters even when they have no page file. Recheck `proxy.ts`, route handlers, and any redirects in configuration when touching navigation. API endpoints are behavior contracts, not visual pages, and are deliberately excluded from this table.

For each route validate the relevant combinations of guest/owner/visitor/staff role; loading/empty/content/error state; mobile/desktop; and supported appearance. Some routes are intentionally inaccessible to a role: verify the correct gate rather than forcing entry. A phase cannot finish with unexplained omissions from its rows.
