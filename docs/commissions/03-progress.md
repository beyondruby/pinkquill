# Commissions rebuild — progress

Read `02-plan.md` for the phase definitions and `01-findings.md` for the root causes (RC-*). Each entry below is written so a fresh session can continue from this file alone.

## Status by phase

| Phase | Status | Date |
|---|---|---|
| 0 — Stop the bleeding | **done, applied to production** | 2026-09-02 |
| 1a — Schema truth | **done, applied to production** | 2026-09-02 |
| 1b — Verified payment record + full webhook | not started | |
| 1c — Payout release, ledger, cron | not started (blocked on decisions D1, D2, D3, D4) | |
| 1d — Refunds, cancellations, disputes, chargebacks | not started (D6, D8) | |
| 1e — Test harness + go-live checklist | not started | |
| 2–4 | not started | |

Open decisions (plan §2): D2 release window, D3 fee model, D4 cron host, D6 refund policy, D7 email provider, D8 admin access. Answered: **D1** = platform Stripe account is **Canada, default currency CAD**, Standard account, `transfers` capability active, Connect enabled (verified via API + dashboard 2026-09-02; business is Canadian, owner currently in Saudi Arabia, sellers/buyers intended worldwide in any currency — 1c must use Connect cross-border payouts with the `recipient` service agreement for non-CA sellers and decide the settlement-currency model); **D5** = yes (test orders deleted in 1a).

---

## Phase 0 — what changed (2026-09-02)

**Closes:** RC-A1 (table grants + forgeable INSERT policies), RC-A7.1 (live 100 %-off promo codes) and RC-A7.2 (live keys in local env), and the theft path of RC-A2 (forged order → cron payout). Findings now moot: A1.1–A1.6, A2.2, A7.1, A7.2.

**Migration** `supabase/migrations/20260902_commissions_phase0_lock_money_tables.sql` — applied to project `loaitxbibjftsytlgddi` as `commissions_phase0_lock_money_tables` via the Supabase MCP `apply_migration` (so it is in the remote migration history). Idempotent. It:

1. Revokes `INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER` from `anon` and `authenticated` on `orders`, `seller_accounts`, `transactions`, `order_events`, `disputes`, `order_reviews`, `processed_stripe_events`, `promo_codes`, `promo_code_redemptions`, `product_purchases`, `product_download_tokens`, `seller_stats`, `reviews`. `SELECT` is kept; existing RLS SELECT policies still scope reads. SECURITY DEFINER RPCs (`create_marketplace_order`, `update_order_as_*`, `submit_order_review`, promo RPCs, …) run as the function owner and are unaffected; all service-role routes are unaffected.
2. Drops policies `orders."Buyers can create orders"`, `seller_accounts."Users can create own seller account"`, `order_reviews."Reviewers can update own review"`, `promo_codes."Anyone can read active promo codes"`.
3. Recreates `order_messages."Order participants can send messages"` with `message_type IN ('text','file')` so clients cannot post `system` (or `status_update`) rows.
4. `order-files` bucket: `file_size_limit = 100 MB`; upload policy now requires the path to be `orders/<order_id>/…` where the caller is buyer or seller of that order; delete policy requires the same plus `owner = auth.uid()`. The existing client upload path (`orders/<orderId>/delivery/<uuid>.<ext>` in `DeliverySection.tsx`) already satisfies it — no client change.
5. Sets `is_active = false`, `expires_at = now()` on promo codes `test` and `TEST100`.

**Code**
- `lib/providers/stripe-provider.ts` `transferToSeller`: throws unless `payment_provider = 'stripe'`, `payment_status = 'paid'` and `checkout_session_id` starts with `cs_` and not `cs_placeholder_`. Placeholder-paid and free orders can no longer reach `stripe.transfers.create`. (The hourly cron will now log a `transfer_failed` attempt for the one placeholder-paid `completed` product order in production instead of attempting a transfer — that write is itself rejected by a CHECK constraint until 1a, which is harmless.)
- `.env.local`: the three Stripe values replaced with `sk_test_REPLACE_ME` / `pk_test_REPLACE_ME` / `whsec_REPLACE_ME`. **Local checkout will fail until real test-mode keys are pasted in** (Stripe dashboard → Developers → API keys, toggle "Test mode"; webhook secret from `stripe listen --forward-to localhost:3000/api/stripe/webhooks`). `.env.local.example` documents this.
- `docs/commissions/00-lifecycle-map.md`, `01-findings.md`, `02-plan.md` committed alongside.

**Verified**
- Live catalog after apply: the 13 tables show only `SELECT` for `anon`/`authenticated`; the four policies are gone; `order_messages` INSERT policy carries the type restriction; `order-files` limit 104857600 with the two new participant-scoped policies; both promo rows `active=false`.
- Client-side usage check: every `supabase.from(...)` on the locked tables in `lib/hooks`, `components`, `app` (outside `app/api`) is a SELECT (`useOrders`, `usePayments`, `useDisputes`, `useReviews`, `useDownloads`, `useSellerCustomers`, `CheckoutPage`). Writes to `products`, `product_pricing`, `product_media`, `product_keywords`, `product_shipping`, `product_files`, `seller_profiles`, `order_messages`, `product_saves`, `notifications` are untouched.
- `npx tsc --noEmit`: no errors outside a stale `.next/types` reference to the removed `/queue` route (regenerated by the build). `npx eslint lib/providers/stripe-provider.ts`: clean. `npx vitest run`: 12 files, 138 tests pass. `npm run build`: succeeds.
- Not exercised: a real end-to-end order in Stripe test mode (no test keys available in this session). The guard is a pure precondition on existing columns.

**Deferred / not in this phase**
- `orders.status` CHECK still lacks `expired`; `auto_complete_orders` still aborts; webhook side-effect writes still hit rejected CHECK values — all Phase 1a.
- GitHub Actions cron left as is (D4 in 1c).

**Next (at the time):** Phase 1a. Superseded by the entry below.

---

## Phase 1a — what changed (2026-09-02)

**Closes:** RC-A5 (repo ≠ production; CHECK constraints reject values the code writes; dead triggers/overloads; cron RPC aborts) and the lock half of RC-A8 (transition RPCs now take `FOR UPDATE`; `listing_type` enforced). Findings now moot: A5.1–A5.6, A8.1, A8.2, A8.4, A4.4's silent-drop half, A2.3's silent-drop half.

**Data (D5 = yes).** Deleted the two placeholder orders and every dependent row: 15 notifications, 3 order_reviews, 6 transactions, 14 order_events, 14 order_messages, 1 download token, 1 promo redemption. Production now has zero orders.

**Migration** `supabase/migrations/20260902_commissions_phase1a_reconcile_schema.sql` — applied as `commissions_phase1a_reconcile_schema` (in remote migration history). Idempotent. It:

1. Snapshots live-only objects so the repo builds production: `orders.checkout_session_id / transfer_id / transfer_status / transfer_amount`, `profiles.stripe_customer_id`, indexes `idx_orders_checkout_session / _transfer_status / _payment_intent`, tables `reviews` and `seller_stats` (with RLS, SELECT policies, write grants revoked), the `order-files` bucket, functions `create_order_notification`, `notify_order_created`, `notify_order_message`, `notify_review_submitted`, `set_auto_completion_deadline`, `mark_order_transfer_completed`, and the triggers `trg_order_created_notification`, `trg_order_status_notification`, `trg_set_auto_completion_deadline`, `trg_order_message_notification`, `trg_review_notification`.
2. Constraints: `orders.status` and `orders.payment_status` accept `expired`; `order_events.event_type` accepts `amount_mismatch`, `transfer_failed`; `transactions.status` accepts `reversal_failed`; `notifications.type` accepts `order_transfer_failed`, `order_expired` (rebuilt from the live list); `orders.payment_provider` default is now `'stripe'` (was `'paypal'`).
3. `auto_complete_orders` rewritten: `sender_id` on the system message (the live body violated NOT NULL and aborted every run), `FOR UPDATE SKIP LOCKED`.
4. `restore_order_stock_on_early_exit` also fires on `expired`.
5. `remove_promo_from_order` recomputes `platform_fee` / `seller_amount` on the same base as `apply_promo_to_order`.
6. `update_order_as_buyer`, `update_order_as_seller`, `open_dispute`, `submit_order_review` take `FOR UPDATE`; seller transitions are gated by `listing_type` (no `shipped` service orders, no `in_progress` products); buyer `revision_requested` requires a service order; `open_dispute` requires a paid, post-payment order (was allowed on `pending_acceptance`/`declined`). **Cancel-from-`paid` is deliberately left as-is** (commented in the migration) — Phase 1d turns it into a refund.
7. Drops dead objects: trigger `trg_auto_complete_digital` + `auto_complete_digital_order`, `update_order_payment`, `sync_seller_account`, `update_purchase_as_buyer/seller`, `submit_review`, `respond_to_review`, `reveal_expired_reviews`, `recalculate_seller_stats`, `release_order_escrow`, the 5-arg `mark_order_payment_failed` overload.

`supabase/migrations/20260331_comprehensive_fixes.sql` and `20260310_security_hardening_review.sql` now carry a header stating they were never applied and are superseded (their contents are unchanged; do not apply them).

**Code**
- `lib/types/store.ts`: `expired` added to `OrderStatus` and `PaymentStatus`; `checkout_session_id` added to `Order`.
- `lib/utils/orderStatus.ts` and `components/orders/OrderView.tsx`: `expired` → "Checkout Expired" (muted) instead of falling back to "Paid" styling.
- `app/api/orders/auto-complete/route.ts`, `app/api/stripe/webhooks/route.ts`: the `order_transfer_failed` notification inserts now pass `actor_id` and `order_id` (`notifications.actor_id` is NOT NULL — discovered during verification; without it those rows were still rejected).

**Verified**
- Rolled-back live test (a `DO` block ending in `RAISE`, so nothing persisted; row counts confirmed 0 afterwards): a seeded `pending_payment` service order → `mark_order_expired` → `expired/expired`; a seeded `submitted` order with a past `auto_completion_at` → `auto_complete_orders()` returns 1, order `completed`, one system message written; inserts of `order_events` `transfer_failed` / `amount_mismatch`, a `notifications` row of type `order_transfer_failed`, and `transactions.status = 'reversal_failed'` all succeed.
- Catalog after apply: all ten dropped functions absent; one `mark_order_payment_failed` overload; six triggers on `orders` (digital auto-complete gone); `payment_provider` default `'stripe'`; `notifications_type_check` includes `order_transfer_failed`.
- `npx tsc --noEmit`: clean (outside the stale `.next/types` file). ESLint on changed files: one pre-existing unused-import warning in `OrderView.tsx` (RC-D6, left for Phase 4). `npx vitest run`: 138 tests pass. `npm run build`: succeeds.
- Not exercised: a Stripe-CLI replay of `checkout.session.expired` (no test keys in this session); the RPC it calls was exercised directly above.

**Deferred**
- `supabase db diff` was not run (project is not linked locally); parity was checked by catalog queries instead. Linking the CLI and running `supabase db diff --linked` once is a cheap follow-up before 1b.
- The `.next/types/validator.ts` reference to the removed `/queue` route is a stale generated file; `npm run build` regenerates it.

**Next:** Phase 1b — verified payment record + full webhook (`02-plan.md` §3). Needs Stripe **test** keys in `.env.local` and `stripe listen` for local webhook delivery. D3 (fee model) is needed for the checkout display numbers in 1b; D1/D2/D4 for 1c.

---

## Local Stripe test setup — done (2026-09-02, between 1a and 1b)

**What is in place**
- `.env.local` now holds the account's **test-mode** keys (`pk_test_…`, `sk_test_…`) taken from the Stripe dashboard sandbox, and the Stripe CLI webhook signing secret (`whsec_…`). `NEXT_PUBLIC_SITE_URL` is `http://localhost:3000` locally so Stripe's return URL lands on the dev server. This file is gitignored; live keys exist only in the production host env.
- Stripe CLI installed via Homebrew (`stripe` on PATH). The CLI is **not** persistently logged in; every command needs `--api-key "$(grep ^STRIPE_SECRET_KEY= .env.local | cut -d= -f2)"`.
- To forward webhooks to the dev server (must be running while testing payments):
  ```
  SK=$(grep ^STRIPE_SECRET_KEY= .env.local | cut -d= -f2)
  stripe listen --api-key "$SK" --forward-to localhost:3000/api/stripe/webhooks
  ```
  The signing secret it prints must equal `STRIPE_WEBHOOK_SECRET` in `.env.local` (it is stable per machine).
- The Chrome extension cannot type into Stripe's cross-origin card iframe. To complete a checkout without a human, use a fixture that mirrors the CLI's built-in `checkout.session.completed` fixture with the order's real amount and metadata (kept in the session scratchpad as `fixture-checkout-500.json`; recreate from the CLI binary's fixture if needed — the confirm step is `POST /v1/payment_pages/${checkout_session:id}/confirm` with `expected_amount` as a number). Run with `stripe fixtures <file> --api-key "$SK"`.

**Verified live in test mode** (order PQ-20260902-1049, $5 commission from `poet`, bought by the signed-in local user, then deleted):
- Hire → `/checkout/[id]` → embedded Stripe Checkout rendered with the new keys.
- `checkout.session.completed` delivered by the CLI forwarder → signature verified → `processed_stripe_events` claimed → `finalize_order_payment` → `payment_status = paid`, three `transactions` rows, `payment_confirmed` event, system message, seller + buyer notifications.
- A first fixture run with the wrong amount ($30) took the **amount-mismatch** path and the `order_events.event_type = 'amount_mismatch'` row was written (rejected by CHECK before 1a).

**New bugs confirmed by the run (all Phase 1b)**
- **A4.10 (added to `01-findings.md`)** — the webhook's instant-delivery branch keys on `products.delivery_type = 'digital'` alone; the service listing has `delivery_type = 'digital'`, so a just-paid commission was set to `delivered`, `transferToSeller` ran (recorded `pending_onboarding` because `poet` is not onboarded — with an onboarded seller it would have paid out $4.75 at payment time), and the buyer's order page showed "Delivered · Confirm Receipt · Auto-completes in 2d 23h" with the seller having done nothing. Fix in 1b: branch on `listing_type = 'product' AND delivery_type = 'digital'`, and no instant transfer for anything until 1c's release gate.
- Duplicate `order_paid` notification to the seller (webhook insert + trigger) — confirmed, two rows.
- Two Checkout Sessions created in the same second for one order (`CheckoutPage` effect + unlock) — confirmed via the Stripe API; the embedded form remounted and cleared mid-entry.

**Cleanup.** The test order and its notifications, transactions, events and messages were deleted; production is back to zero orders. Two `open` test sessions remain in Stripe test mode and expire on their own.

**Next:** Phase 1b. D3 (fee model) still needed for the checkout display.
