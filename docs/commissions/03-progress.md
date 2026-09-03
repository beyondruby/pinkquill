# Commissions rebuild — progress

Read `02-plan.md` for the phase definitions and `01-findings.md` for the root causes (RC-*). Each entry below is written so a fresh session can continue from this file alone.

## Status by phase

| Phase | Status | Date |
|---|---|---|
| 0 — Stop the bleeding | **done, applied to production** | 2026-09-02 |
| 1a — Schema truth | **done, applied to production** | 2026-09-02 |
| 1b — Verified payment record + full webhook | **done, applied to production** | 2026-09-02 |
| 1c — Payout release, ledger, cron, settlement currency | **done, applied to production** | 2026-09-02 |
| 1d — Refunds, cancellations, disputes, chargebacks | **done, applied to production** | 2026-09-02 |
| 2a — Availability & slots | **done, applied to production** | 2026-09-03 |
| 2c — Intake, references, revisions, deliveries | **done, applied to production** | 2026-09-03 |
| 1e — Test harness + go-live checklist | **done, applied to production** (go-live checklist below; live keys NOT yet configured) | 2026-09-02 |
| 3a — Order page | **done, committed on main** (no migration; UI only) | 2026-09-03 |
| 3c — Listing detail & request flow | **done, committed on main** (no migration; UI only) | 2026-09-03 |
| 2b, 2d–2f, 3b, 3d–3f, 4 | not started | |

Open decisions (plan §2): D7 email provider. **D6** = buyer cancels free while the seller hasn't started (`paid`) or when the order is 3+ days overdue; after work starts a buyer cancellation is a refund request the seller decides; sellers/admins may cancel any active order (full refund); partial refunds come out of the seller's share only; nothing can be cancelled or refunded self-service after the payout was sent (dispute instead). **D8** = `platform_admins` table (`profiles.role` is a free-text bio field); `hadi` is the first admin. **D2 = 7 days** after completion (setting `release_window_hours = 168`). **D4 = Supabase pg_cron + pg_net** (GitHub workflow deleted). **Currency:** USD listings, charged in the platform's settlement currency (CAD today) at a cached ECB rate + 1.5 % buffer; switch to USD settlement later by changing `platform_settings.settlement_currency` once a USD bank account exists. **D3 = (b)** seller pays 5 % platform fee, buyer pays a visible processing fee of 3 % + $0.30 (implemented in 1b; rates live in `platform_settings`). Answered: **D1** = platform Stripe account is **Canada, default currency CAD**, Standard account, `transfers` capability active, Connect enabled (verified via API + dashboard 2026-09-02; business is Canadian, owner currently in Saudi Arabia, sellers/buyers intended worldwide in any currency — 1c must use Connect cross-border payouts with the `recipient` service agreement for non-CA sellers and decide the settlement-currency model); **D5** = yes (test orders deleted in 1a).

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

**Next (at the time):** Phase 1b. Superseded by the entry below.

---

## Phase 1b — what changed (2026-09-02)

**Closes:** RC-A4 (webhook happy-path only: items A4.1 partially — chargebacks recorded, money handling in 1d — A4.2, A4.3, A4.4, A4.6, A4.7, A4.8, A4.9, A4.10), the record half of RC-A2 (money now enters the DB only through a webhook-written `payments` row; A2.4 `payment_intent_id` persisted), RC-A6.3 and A6.4 (fee shown to the buyer is now a fee the buyer pays; one fee function), A7.5 (status route no longer calls Stripe per poll).

**Decision D3 = (b).** Seller pays the 5 % platform fee on the goods/service amount; the buyer pays a processing fee of 3 % of the order amount + $0.30, shown as its own line and charged as a second Checkout line item. Free ($0) orders carry no fee. Rates are rows in `platform_settings` (`platform_fee_rate`, `buyer_fee_rate`, `buyer_fee_fixed`, `min_service_price`), read by one SQL function `compute_order_money(item, shipping, discount)` → `amount, platform_fee, seller_amount, buyer_fee, total_amount`. `lib/payments.ts`'s `PLATFORM_FEE_RATE` is now display-only (marketplace hero); Phase 4 removes it.

**Migration** `supabase/migrations/20260902_commissions_phase1b_payment_record.sql` — applied as `commissions_phase1b_payment_record` (+ one hotfix `CREATE OR REPLACE` of `record_payment_failed` for message punctuation, already in the file). Idempotent. It adds:
- `platform_settings`, `platform_setting_numeric()`, `compute_order_money()`.
- `orders.buyer_fee` and generated `orders.total_amount = amount + buyer_fee`; `transactions.type` gains `buyer_fee`; `notifications.type` gains `order_payment_failed`.
- `payments` (one row per PaymentIntent: amounts, currency, Stripe fee from the balance transaction, refunded cents, status ∈ succeeded / amount_mismatch / unexpected_status / refunded / partially_refunded / failed; participants can SELECT, nobody but service_role writes).
- `stripe_events` (event id, type, order, status processing/processed/failed/ignored, attempts, error) with `claim_stripe_event` (duplicate detection, 5-minute in-progress window, retry after failure) and `finish_stripe_event`.
- RPCs (service_role only, all `FOR UPDATE`, all side effects inside): `record_payment_succeeded` (amount + currency check against `total_amount`; only `listing_type = 'product' AND delivery_type = 'digital'` is delivered at payment — commissions start at `paid`; writes payments + 4 ledger rows + event + system message; returns `paid | already_processed | amount_mismatch | unexpected_status`), `record_payment_failed` (payment_status `failed`, `last_payment_error`, buyer notification), `record_checkout_expired` (ignores a session that is not the order's current one), `record_payment_refund` (full/partial, mismatch refunds leave the order awaiting payment).
- `seller_accounts.requirements_currently_due / disabled_reason / requirements_synced_at`.
- `create_marketplace_order`, `apply_promo_to_order`, `remove_promo_from_order` recompute all five money columns via `compute_order_money`; `finalize_order_payment` is now free-orders-only (raises if `total_amount > 0`) and writes a `payments` row too.

**Code**
- `app/api/stripe/webhooks/route.ts` rewritten: claim → handler → finish; handlers for `checkout.session.completed` (requires `payment_status = 'paid'`), `checkout.session.async_payment_succeeded / async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded` (RPC + transfer reversal if the seller had been paid), `charge.dispute.created / updated / closed / funds_withdrawn / funds_reinstated` (recorded as `order_events` `dispute` rows; money handling is 1d), `transfer.reversed`, `payout.failed` (seller notified), `account.updated` (incl. requirements), `account.application.deauthorized`. No direct notification inserts, **no transfer on payment**. Wrong-amount / unexpected payments are refunded automatically (idempotent per PaymentIntent) and recorded.
- `lib/payments-server.ts`: typed wrappers for the RPCs above; `markOrderPaymentFailed` / `markOrderExpired` removed.
- `lib/providers/stripe-provider.ts` `createCheckoutSession`: `payment_method_types: ['card']`, second line item "Processing fee", Stripe idempotency key `checkout_<order>_<totalCents>_<currency>` (concurrent calls get one session; a replayed non-open session is re-created under a timestamped key), reuses the order's open session only if its `amount_total` still matches and expires it otherwise. `OrderForCheckout.buyerFee` added.
- `app/api/checkout/route.ts` passes `buyer_fee`; `app/api/checkout/confirm/route.ts` gates on `total_amount ≤ 0` and no longer transfers; `app/api/checkout/status/route.ts` returns DB state only (`order_status`, `order_payment_status`, `last_payment_error`), accepts `order_id` or `session_id`.
- `app/(feed)/checkout/[orderId]/complete/page.tsx` decides from the order row (paid / expired / failed with the decline message) and shows "Still processing → Go to your order" after 15 polls instead of a false "Payment Failed / No charges were made".
- `components/checkout/CheckoutPage.tsx`: summary rows Subtotal / Shipping / Discount / **Processing fee** / Total (= `amount + buyer_fee`); the "Platform fee (5 %)" row buyers never paid is gone; promo apply/remove pass `buyer_fee` through; `createCheckout` has an in-flight ref and a `(order, amount, buyer_fee)` key so the effect no longer mints a session per render — the double-session bug from the earlier live run is gone (verified: exactly one session per order).
- `components/orders/OrderView.tsx`: buyer sees Processing fee + "Total paid"; seller sees "Pinkquill fee" + "You receive"; header metric uses `total_amount` for buyers. `components/queue/StudioQueuePage.tsx` copy: "Processing fee shown at checkout".
- `lib/types/store.ts`: `Order.buyer_fee`, `Order.total_amount`; `Transaction.type` gains `buyer_fee`. `lib/hooks/usePromoCode.ts` result types gain `buyer_fee`, `total_amount`.
- Sentry is **not** installed in this project (no `@sentry/nextjs` in package.json despite the config files), so failures are recorded in `stripe_events.error` and `console.error`; an alerting hook is a 1e item.

**Verified**
- Rolled-back RPC run: `compute_order_money(5)` → 5.00 / 0.25 / 4.75 / 0.45 / 5.45; `(100, 10, 20)` → 90 / 4.00 / 86 / 3.00 / 93; a $0 order has no buyer fee; claim/duplicate/processed; mismatch → refund → order still `pending_payment`; decline; stale-session expiry ignored; success → `paid` with 4 ledger rows and exactly one `order_paid` notification; replay → `already_processed`; second payment → `unexpected_status`; partial then full refund; current-session expiry → `expired`.
- Live in Stripe test mode with a real order (PQ-20260902-1052, then deleted): checkout page shows Subtotal $5.00 / Processing fee $0.45 / Total $5.45; exactly one Checkout Session for the order, `amount_total = 545`, `payment_method_types = ['card']`. Via the CLI forwarder: `checkout.session.expired` for a foreign session → `ignored:stale_session`; `payment_intent.payment_failed` → `payment_status = failed`, `last_payment_error.code = generic_decline`, buyer notified; a $5.00 fixture payment → `amount_mismatch`, auto-refunded (Stripe fee 70 ¢ captured), the resulting `charge.refunded` recognised as already processed; a $5.45 fixture payment → `paid` (not `delivered`), `payment_intent_id` stored, Stripe fee 73 ¢ captured, `transfer_status` null (no instant payout), one seller notification. Order page: status **Paid**, summary with Processing fee and Total paid $5.45. All five `stripe_events` rows `processed` with their outcome note.
- `npx tsc --noEmit` clean; ESLint clean on changed files (two pre-existing warnings remain); `npx vitest run` 138 pass; `npm run build` succeeds.

**Deferred**
- The refund route (`/api/payments/refund`) and `StripeProvider.refundPayment` still write `orders.status` directly and refund the full PaymentIntent (including the buyer fee) — 1d.
- Instant payouts on `account.updated` for `pending_onboarding` orders still go through `transferToSeller` — 1c replaces with the release gate.
- Chargebacks are recorded but do not yet freeze the order or block/reverse payouts — 1d.
- `processed_stripe_events` is no longer written; dropped in 4c.

**Next (at the time):** Phase 1c. Superseded by the entry below.

---

## Phase 1c — what changed (2026-09-02)

**Closes:** release half of RC-A2 (money leaves only through one gate, from a verified payment, after the hold), RC-A7.3 (cron on GitHub secrets), RC-A6.5 and A6.7 (cross-border and currency model decided from Stripe facts), RC-A8.5 (duplicate Express accounts), A4.5 partly (`transfer.reversed`, `payout.failed` handled; account requirements stored).

**Decisions.** D2 = 7-day hold after completion; D4 = pg_cron + pg_net inside Supabase; buyer fee raised to 3.5 % + $0.30; currency model below.

**Stripe facts established in test mode (drove the design):**
- The platform account settles in **CAD only**: a $20 USD test charge became C$25.81 immediately (Stripe converts at charge time, with its fee). Transfers must be in CAD; a USD transfer fails with "insufficient available funds" and `source_transaction` in USD is rejected because the charge's balance transaction is CAD.
- Stripe's **cross-border "recipient" agreement is not available to Canadian platforms** for any country probed (US, GB, DE, FR, AU, SA, AE, IN, BR, MX, JP, SG, NZ, TR, EG, NG). Full connected accounts in other Stripe-supported countries **can** be created (`card_payments` + `transfers` must both be requested); Saudi Arabia is not supported by Stripe at all. A CAD transfer from the platform to a US connected account succeeds.
- Stripe's exchange-rates endpoint no longer exists on this API version.

**Currency design (money-optimal for the platform, switchable):** listings and all order money columns stay USD. At checkout the order is quoted into the settlement currency (`lib/fx.ts`: ECB rate from frankfurter.dev cached in `fx_rates`, refreshed after 6 h, stale-tolerant for 3 days, otherwise checkout refuses) with a 1.5 % buffer on what the buyer pays; the seller/platform/buyer-fee split is fixed at the mid-market rate and stored on the order (`charge_currency`, `charge_amount_cents`, `seller_amount_charge_cents`, …, `fx_rate`). The buyer's card is charged in CAD (their bank converts — Pinkquill pays no conversion), the webhook verifies the CAD amount, the ledger is kept in CAD, and the seller's payout is fixed in CAD at charge time (no FX drift during the hold); Stripe converts the CAD transfer to the seller's local currency at payout. The buffer remainder lands in a `fx_reserve` ledger account. Setting `platform_settings.settlement_currency = "usd"` (after adding a USD bank account) makes every path degrade to rate 1 / no conversion.

**Migrations** `20260902_commissions_phase1c_payouts_ledger_cron.sql` and `20260902_commissions_phase1c_settlement_currency.sql` — applied (remote history). They add:
- Settings: `release_window_hours 168`, `payout_batch_size 25`, `payout_max_attempts 3`, `supported_currencies ["usd"]`, `app_base_url`, `settlement_currency "cad"`, `fx_buffer_rate 0.015`, `fx_max_age_hours 6`; `buyer_fee_rate` → 0.035.
- `ledger_entries` (append-only, trigger blocks UPDATE/DELETE; accounts stripe_balance / stripe_fees_expense / buyer_fee_revenue / platform_fee_revenue / seller_liability / seller_paid_out / refunds / fx_reserve; signed cents; every money RPC posts entries), `payouts` (one per order; pending → processing → sent | blocked | failed | reversed | cancelled; amount in charge currency + listing amount for display), `cron_runs`, `fx_rates`; `orders` charge-currency columns; `seller_accounts.service_agreement` + `UNIQUE(user_id)`; currency guard trigger on `orders` (USD only today).
- RPCs (service_role): `release_eligible_payouts` (completed + hold elapsed + succeeded unrefunded payment + no open dispute + no unresolved chargeback + no payout yet), `claim_pending_payouts` (`FOR UPDATE SKIP LOCKED`), `mark_payout_sent`, `mark_payout_failed` (block / retry with backoff / failed after 3), `mark_payout_reversed`, `unblock_payouts_for_seller`, `set_order_charge`, `run_cron_job`. `record_payment_succeeded` / `record_payment_refund` now verify against the charge currency and post ledger entries; a full refund cancels a not-yet-sent payout.
- pg_cron: `marketplace-auto-decline` (*/10), `marketplace-hourly` (:05 — auto-complete, review reveal, payout release), `marketplace-payout-worker` (*/15 — `net.http_post` to `<app_base_url>/api/payouts/run` with the bearer secret from Vault `cron_secret`, only when pending payouts exist). Every run logs to `cron_runs`.

**Code**
- `app/api/payouts/run/route.ts` (new): the only code path that moves money to sellers — release → claim → one idempotent Stripe transfer per payout (`payout_<id>`, `source_transaction` = the order's charge so it can draw on pending balance) → mark sent / blocked / retry.
- `lib/payment-provider.ts`: `transferToSeller(orderId)` replaced by `createTransfer(request)`; `TransferBlockedError`; `createSellerAccount(..., country)`. `lib/providers/stripe-provider.ts`: account creation with country, idempotency key per user, upsert on `user_id`, friendly error when Stripe can't pay out there; Checkout line items in the charge currency with the USD amount and rate in the description. Placeholder provider updated.
- `lib/fx.ts` (new): settlement quotes. `app/api/checkout/route.ts`: quote → `set_order_charge` → session; response carries `charge` so the page can show "Your card will be charged C$7.75 (CAD, at 1 USD = 1.3925 CAD)". `components/orders/OrderView.tsx`: "Charged as C$…" / "Paid out as C$… (converted at …)".
- `app/api/stripe/webhooks/route.ts`: `account.updated` unblocks payouts instead of transferring; `transfer.reversed` and full-refund reversals go through `mark_payout_reversed`. `app/api/orders/auto-complete` and `auto-decline` are thin manual triggers for `run_cron_job`. `.github/workflows/marketplace-cron.yml` deleted.
- `components/seller/SellerOnboarding.tsx` + `usePayments`: country select (list in `lib/payments.ts` `SELLER_COUNTRIES`; Stripe is the authority — unsupported countries get a clear error) and honest copy about USD pricing and payout conversion. `EarningsOverview`: buyer-fee row label.

**Verified live (test mode, then cleaned up)**
- Order PQ-20260902-1053 ($5 commission): quote stored as C$7.75 total / C$0.68 fee / seller C$6.61 / platform C$0.35 / buyer fee C$0.67 / reserve C$0.12 at 1.3925; Stripe session `775 cad`, card only. Paid via fixture → `paid`, Stripe fee C$0.59 captured; ledger sums: stripe_balance 716, seller_liability 661, platform 35, buyer fee 67, reserve 12, fees 59.
- Completed with `completed_at` 8 days back → `/api/payouts/run` #1: released 1, **blocked** (seller had no Stripe account). Seller account attached → `unblock_payouts_for_seller` → run #2: **sent** — Stripe transfer `tr_3UBJjk…` of **661 CAD** to a US test connected account, funded by the order's charge; payout row `sent` with transfer + balance-transaction ids; `orders.transfer_*` and `transactions.seller_payout` updated; ledger: seller_liability 0, seller_paid_out 661, stripe_balance 55 (= platform net); seller notified "Your payout of 6.61 CAD is on its way".
- pg_cron confirmed running on schedule (`cron_runs`: auto_decline twice, payout_worker "no pending payouts"); `run_cron_job('hourly')` returns counts.
- Cleanup: test seller account row removed, test order and all dependents deleted (ledger trigger disabled for the deletion only, re-enabled — `tgenabled = O`), production back to zero orders and zero ledger rows. The Stripe test-mode connected account `acct_1UBJbGFZheMwg36N` (US, fully verified, payouts manual) is kept for future payout tests.
- `npx tsc` clean; ESLint clean on changed files; 138 unit tests pass; `npm run build` succeeds.

**Deferred / follow-ups**
- Production must set `CRON_SECRET` in Vercel to the same value as Vault `cron_secret` (the local value was used). The payout worker URL is `platform_settings.app_base_url` + `/api/payouts/run`; the route ships with this branch, so the 15-minute job will 404 on production until the branch is deployed (harmless: it only fires when pending payouts exist).
- Partial payout reversals on partial refunds, chargeback freeze/reversal, `payouts.status = failed` operator queue — 1d.
- Existing `seller_accounts` rows for hadi and hii are **live-mode** Canadian accounts created before this phase; they keep working. New sellers pick a country; non-Canadian sellers get full connected accounts (Stripe requires card_payments + transfers).
- Sellers in countries Stripe does not serve (e.g. Saudi Arabia) cannot be paid through Stripe Connect at all; onboarding tells them so. A second payout rail (e.g. Wise/Payoneer) would be a separate phase.

**Next (at the time):** Phase 1d. Superseded by the entry below.

---

## Phase 1d — what changed (2026-09-02)

**Closes:** RC-A3 (every post-payment exit now moves money correctly: cancel-after-pay, refund window, partial refunds, dispute resolution, chargebacks), the server half of RC-D1 (`get_order_actions` replaces the client transition table, which is deleted), A4.1/A4.10-adjacent chargeback handling, A8.1 races on the exit paths.

**Decisions.** D6 and D8 as recorded above. Money rules: a full refund returns everything to the buyer (fees included) and cancels the seller's claim; the platform absorbs Stripe's processing fee. A partial refund is capped at the seller's remaining share and leaves the platform and buyer fees untouched. If the seller was already paid, the seller's share is reversed from the transfer **before** the buyer is refunded; if the reversal fails the refund parks in `needs_review` and admins are notified — the buyer is never refunded while the seller keeps the money.

**Migration** `supabase/migrations/20260902_commissions_phase1d_refunds_disputes.sql` — applied as `commissions_phase1d_refunds_disputes` (plus one hotfix `CREATE OR REPLACE` of `get_order_actions` for two NULL booleans, already in the file). It adds:
- `platform_admins` + `is_platform_admin()`; `refunds` (one row per refund attempt: initiator role, kind, charge-currency amount, listing amount, seller share, status requested → approved → processing → succeeded | declined | needs_review | failed | cancelled, Stripe refund/reversal ids); dispute columns (`kind` dispute/chargeback, `previous_status`, `evidence` jsonb, Stripe dispute fields) with one-active-dispute-per-order instead of one-ever; ledger account `chargebacks`; notification types `refund_approved`, `chargeback_opened`, `chargeback_closed`.
- RPCs (authenticated, `FOR UPDATE`): `request_order_refund` (buyer; full or partial; refused after payout), `decide_refund_request` (seller/admin; approve → full = order cancelled, partial = order resumes; decline → previous status restored), `issue_order_refund` (seller/admin, proactive), `cancel_order` (D6 policy; pre-payment = plain cancel, otherwise cancel + approved full refund, or converts to a refund request), `open_dispute` (records previous status, blocks pending payouts, folds an open refund request in, notifies admins), `add_dispute_evidence`, `get_order_actions` (role, every can_* flag, cancel_mode free|refund|request, is_late, revisions_left, payout/refund/dispute summaries, release_at). `update_order_as_buyer/seller` no longer cancel directly (they delegate to `cancel_order`).
- RPCs (service): `claim_approved_refunds`, `mark_refund_submitted`, `mark_refund_needs_review`, `resolve_dispute(…, p_admin_id)` (admin-only; full_refund / partial_refund / release_to_seller / order_cancelled / mutual_agreement; unblocks or cancels the payout), `record_chargeback` (created → order `disputed`, payouts blocked, seller + admins notified with the evidence deadline; funds_withdrawn/reinstated → ledger; closed won → order and payout restored; closed lost → order refunded, seller claim cancelled, refund row recorded). `record_payment_refund` now links `charge.refunded` to the requesting `refunds` row (or records a dashboard refund), and on partial refunds shrinks the seller's liability and any not-yet-sent payout.

**Code**
- `lib/refunds-server.ts` (new): the only code that moves refund money — claim approved refunds, reverse the seller's share first if paid out, create the Stripe refund (idempotent on refund id), record ids; failures park for review with retries for transient errors.
- `app/api/payments/refund/route.ts` rewritten: actions `request | approve | decline | issue | cancel` → RPCs as the caller → executes any approved refund inline (the worker retries anything left).
- `app/api/admin/disputes/route.ts` (new): GET open disputes with evidence; POST resolve (admin gate via `platform_admins`); executes any refund the resolution created.
- `app/api/payouts/run/route.ts`: executes approved refunds first, then payouts.
- `app/api/stripe/webhooks/route.ts`: `charge.dispute.*` → `record_chargeback`; on creation, a sent payout is reversed immediately (idempotent).
- `lib/payment-provider.ts` / providers: `refundPayment` replaced by `createRefund` + `reverseTransfer` (no DB writes in the provider).
- `lib/hooks/useDisputes.ts`: `useCancelOrder`, `useIssueRefund`, `useOrderActions` (calls `get_order_actions`). `lib/hooks/useOrders.ts`: `VALID_TRANSITIONS` deleted — the server decides. `components/orders/OrderActions.tsx`: cancel/refund/dispute buttons are shown from the server's answer; the cancel form explains the mode ("Ask the seller to cancel?" vs "Cancel and refund"); seller "Issue Refund" is a real refund of the buyer's total.

**Verified**
- Rolled-back scenario run impersonating buyer, seller and admin: (a) cancel at `paid` → cancelled + approved full refund (seller share 661), Stripe confirmation → `cancelled/refunded`, seller liability 0, balance −59 (Stripe fee absorbed); (b) after work started: buyer cancel → refund request, seller declines → `in_progress` restored, buyer requests $2 partial (279 ¢ CAD), seller approves, Stripe partial → `in_progress/partially_refunded`, seller share 661 → 382, over-refund of $4 refused; (c) 5-days-overdue order → buyer unilateral cancel; (d) completed + released payout → dispute opened → payout `blocked/dispute_open`, evidence added, seller cannot resolve, admin `release_to_seller` → order `completed`, payout `pending`; (e) chargeback created → `disputed`, funds withdrawn → ledger, closed lost → `refunded/refunded`, seller liability 0; (g) after a sent payout: cancel refused, `can_cancel = false`, `can_open_dispute = true`.
- Live in Stripe test mode: order paid C$7.75 via fixture → buyer `cancel_order` → refund row approved (full, 775 CAD, seller share 661) → `/api/payouts/run` submitted one refund → Stripe `charge.refunded` → order `cancelled/refunded`, refund row `succeeded` with Stripe id, payment `refunded 775/775`, ledger: refunds 775, seller_liability 0, platform/buyer fee revenue 0, fx_reserve 0, stripe_balance −59. Cleaned up; production back to zero orders.
- `npx tsc` clean; ESLint clean on changed files (one pre-existing warning); 138 unit tests pass; `npm run build` succeeds.

**Deferred**
- Partial-refund UI (amount field) and dispute-evidence UI — Phase 3a; the RPCs and route already accept them.
- Admin dispute desk is an API only; a page comes in 2f.
- `refundPayment`-era `order_events` for reversal failures remain as `transfer_failed` events; an operator queue view is 2f.
- Chargeback evidence submission to Stripe is manual in the dashboard for now.

**Next (at the time):** Phase 1e. Superseded by the entry below.

---

## Phase 1e — what changed (2026-09-02)

**Closes:** RC-D5 for the money paths (the payment state machine is now tested three ways and can be re-verified from a fresh session with one command), RC-A7.4–5 (status polling rate limit, seller-status cache), and gives operators a health endpoint + alert stream instead of `console.error`.

**Migration** `supabase/migrations/20260902_commissions_phase1e_selftest_ops.sql` — applied as `commissions_phase1e_selftest_ops`.
- `ops_alerts` (kind, severity info|warning|critical, message, context, order_id, resolved_at) + `alert_ops()` (service) — every place that used to only `console.error` a money problem now also writes a row.
- `get_ops_health()` (service) — one JSON snapshot: last run per cron job and whether it is overdue, Stripe events failed in the last 24 h, payouts by status (with `failed`/`blocked` counts), refunds in `needs_review`, open disputes/chargebacks, open alerts, latest fx rate age vs `fx_max_age_hours`, ledger totals and whether the ledger balances.
- `seller_accounts.status_synced_at` for the 60 s status cache.
- `run_money_selftest()` (service) — runs the whole money state machine inside a savepoint against the real schema and **always rolls back**: fee model, pay/replay/cancel/refund (a), work-started refund request + decline + partial + over-refund refused (b), overdue buyer cancel (c), release → dispute blocks payout → non-admin refused → admin release, cancel-after-payout refused (d), chargeback created/withdrawn/lost (e), stale-session expiry (f), amount-mismatch auto-refund (g). Returns `{ok, rolled_back, result}` with a token string per scenario.

**Code**
- `lib/ops.ts` (new): `reportOpsAlert()` — never throws. Wired into: webhook failures and unhonoured-payment refunds and chargeback creation (critical), payout `failed` and worker run failures, refunds parked in `needs_review`, fx feed failures.
- `app/api/admin/health/route.ts` (new, admin only): `GET` → `get_ops_health()` + the 50 newest open alerts. This is the operator's page until 2f builds a UI.
- `app/api/checkout/status/route.ts`: 60 requests/minute per user (in-memory, per instance).
- `lib/providers/stripe-provider.ts` `checkSellerStatus`: served from the DB when synced in the last 60 s; otherwise one Stripe read that also refreshes `requirements_currently_due` / `disabled_reason`.
- `lib/fx.ts`: quote maths extracted to a pure `buildSettlementQuote()`; behaviour unchanged.
- `vitest.setup.tsx`: browser-global mocks are skipped under `// @vitest-environment node`, so server route tests can run in node.

**Tests** (`npx vitest run` → 158 pass + 1 opt-in)
- `lib/__tests__/fx.test.ts` — quote maths: no-conversion, the C$7.75 live case, buffer never negative across rates/amounts, free order, invalid rate.
- `lib/__tests__/refunds-server.test.ts` — refund execution: nothing approved; idempotent Stripe refund; reversal **before** refund when the seller was paid; reversal failure → `needs_review`, buyer NOT refunded, alert raised; partial refund reverses only what is left; missing PaymentIntent → review; transient Stripe error → retry, no alert.
- `app/api/stripe/webhooks/__tests__/route.test.ts` — real Stripe signature verification (`generateTestHeaderString`): bad signature → 400 before any DB call; duplicate claim → 200 no processing; paid session → `record_payment_succeeded` with amount/currency/fee; unpaid session ignored; amount mismatch → idempotent Stripe refund + `record_payment_refund` + alert; declined payment recorded; handler throw → event `failed` + 500 (Stripe retries) + alert; chargeback → `record_chargeback` + payout reversal `reversal_chargeback_<dispute>`.
- `lib/__tests__/money-selftest.test.ts` — **database contract test**, opt-in: `RUN_DB_SELFTEST=1 npx vitest run lib/__tests__/db-selftests.test.ts` (reads the service key from `.env.local`). Calls `run_money_selftest()` and asserts every scenario token. Ran green against production on 2026-09-02 (2.0 s); production still has zero orders / ledger rows / refunds / payouts / disputes / alerts afterwards.
- `e2e/commissions-journey.spec.ts` rewritten for the current UI: publish $5 service → hire → `/checkout/<id>` shows Processing fee $0.48 and Total $5.48 → 4242 card inside the embedded Checkout iframe → `/checkout/<id>/complete` waits for the webhook ("Payment confirmed") → order page "Total paid" → seller Start Work / Submit Delivery → buyer Accept Delivery → completed, no cancel offered. Skipped unless `E2E_SELLER_EMAIL/PASSWORD` + `E2E_BUYER_EMAIL/PASSWORD` are set; it needs the app running against Stripe test keys with `stripe listen` forwarding. **Not run in this session** (no E2E accounts exist yet) — the same path was exercised by hand in 1b–1d.

**Not done from the plan line:** Sentry. The project has no Sentry DSN and adding a vendor is a decision for you; `ops_alerts` + `/api/admin/health` cover the same need without a third party. Add Sentry later by calling it inside `reportOpsAlert()` — one place.

**Verified:** `npx tsc` clean; ESLint 0 errors on changed files (pre-existing warnings only); 158 unit tests + DB self-test pass; `npm run build` succeeds.

---

## Go-live checklist (Phase 1 gate) — nothing below is done yet

Do these in order. Everything before step 6 is reversible.

1. **Deploy the branch.** Merge `fix/commissions-phase0` → `main` and deploy. Until then `/api/payouts/run`, `/api/admin/health`, the refund route and the new webhook code do not exist in production, and the 15-minute payout job 404s (harmless: it only fires with pending payouts).
2. **Vercel environment (production):**
   - `STRIPE_SECRET_KEY` = live secret key, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` = live publishable key. Live keys live **only** in Vercel; `.env.local` keeps test keys forever.
   - `STRIPE_WEBHOOK_SECRET` = the signing secret of the **live** endpoint from step 3 (not the CLI `whsec_`).
   - `CRON_SECRET` = exactly the value stored in Supabase Vault as `cron_secret` (`select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret'`). Rotate both together.
   - `PAYMENTS_PROVIDER=stripe`, `SUPABASE_SERVICE_ROLE_KEY` set, `NEXT_PUBLIC_APP_URL=https://www.pinkquill.com`.
3. **Stripe live webhook endpoint** (Developers → Webhooks → Add endpoint): URL `https://www.pinkquill.com/api/stripe/webhooks`, **listen on your account and on Connected accounts**, events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`, `charge.dispute.updated`, `charge.dispute.closed`, `charge.dispute.funds_withdrawn`, `charge.dispute.funds_reinstated`, `transfer.reversed`, `payout.failed`, `account.updated`, `account.application.deauthorized`. API version = the one pinned in `lib/stripe.ts`.
4. **Stripe live settings:** business name / support email / support URL; statement descriptor `PINKQUILL`; customer emails → "successful payments" (receipts) and "refunds" on; Connect → branding (name, icon, colour) and platform settings → **manual review off, sellers use Express dashboard**; Connect → tax forms enabled for CA (T4A) and US (1099-K) so Stripe files them; Radar rules default. Confirm the account settles in CAD only (D1) — `platform_settings.settlement_currency = 'cad'` matches.
5. **Supabase production checks:** `select * from cron.job` shows the three `marketplace-*` jobs active; `platform_settings.app_base_url = 'https://www.pinkquill.com'`; `platform_admins` contains your user; `select run_money_selftest()` returns `ok = true`; `select get_ops_health()` shows the fx rate younger than 6 h and the ledger balanced.
6. **First live dollar (the real gate).** With the site live, buy a $5 service from a second account with a real card: order → `paid` within seconds (webhook), Stripe fee recorded, ledger balanced, `/api/admin/health` clean. Complete the order, then wait for the 7-day release (or set `release_window_hours` low for one day, then back). Confirm the transfer reaches the seller's Express dashboard and the payout row is `sent`. Refund that order from the seller side and confirm `refunded` round-trips. Only then announce.
7. **Observe 24 h:** `cron_runs` has hourly + 15-minute rows; `stripe_events` has no `failed`; `ops_alerts` empty; Vercel logs show no `[Stripe Webhook] … failed`.
8. **Runbook** (check `/api/admin/health` daily, or when a seller/buyer complains):
   - `refunds.status = needs_review` → read `refunds.error`; if the seller payout could not be reversed, reverse it in the Stripe dashboard (Transfers → reverse) then `update refunds set status='approved', error=null where id=…` and hit `/api/payouts/run`; if the charge was already refunded in Stripe, `charge.refunded` will reconcile it — do nothing.
   - `payouts.status = failed` → the seller's Stripe account rejected 3 transfers; fix the account (requirements in `seller_accounts.requirements_currently_due`), then `select unblock_payouts_for_seller('<user_id>')`.
   - `payouts.status = blocked` → waiting on the seller (onboarding) or a dispute; nothing to do.
   - `stripe_events.status = failed` → replay from the Stripe dashboard (Webhooks → event → Resend); the claim table lets the retry through.
   - Chargeback alert → respond in Stripe before `disputes.evidence_due_by` using the evidence in `disputes.evidence`; the outcome flows back via `charge.dispute.closed`.
   - fx rate stale alert → `fx_rates` feed (frankfurter) is down; quotes fall back to the last rate up to `fx_max_age_hours`, after which checkout refuses with a clear error. Insert a manual row if it lasts.
9. **Later, when a USD bank account exists:** add it in Stripe (Settings → Bank accounts → USD), set `platform_settings.settlement_currency = 'usd'` — no code change; the fx buffer and reserve stop applying to new orders.

**Go-live progress (2026-09-02, after the merge to main was deployed)**
- Step 1 done: branch merged fast-forward into `main` and deployed. Every new route answers in production; the payout worker accepted the Vault `cron_secret` (200, empty run) so Vercel `CRON_SECRET` matches; the webhook route rejects unsigned posts, so `STRIPE_WEBHOOK_SECRET` is set.
- Step 3 done (live Stripe): the existing "Your account" destination (`we_1T0NhhFXksFnlAjh6nDT9nty`, secret unchanged) now listens to the full 15-event list; `payment_intent.created/succeeded` removed; the stray thin-payload `v2.core.account.*` destination deleted. A second destination **`pinkquill-connected-accounts`** (`we_1UBL0vFXksFnlAjh6B8jFNkt`, events from Connected accounts: `account.updated`, `payout.failed`, `account.application.deauthorized`) was created because Stripe only delivers connected-account events to a Connect-scoped destination. Its signing secret must be added in Vercel as **`STRIPE_CONNECT_WEBHOOK_SECRET`** (code accepts both secrets, commit `1c3dc7e`). Both destinations stay on API version 2020-08-27 (the account default; the fields the handler reads are identical there).
- Step 4 mostly done: customer emails for successful payments and refunds turned **on**; statement descriptor and shortened descriptor set to `PINKQUILL`. Connect branding / tax forms not reviewed yet.
- Step 5 done: cron jobs active and on schedule, `platform_admins` = 1, settings correct, fx rate fresh, `run_money_selftest()` ok, ledger balanced, no failed events, no open alerts.
- Steps 2 (`STRIPE_CONNECT_WEBHOOK_SECRET`), 6 (first live dollar), 7 (24 h observation) remain.

**Next:** finish the go-live steps above, then Phase 2 (product features) needs your go — start with 2a Availability & slots. D7 (email provider) is decided in 2d.

---

## Phase 2a — Availability & slots (2026-09-03)

**Closes:** the overselling half of RC-B1 (a creator can now say how many commissions they take at once, close or schedule a listing, and the database refuses the order that would break it — including the "last slot" race), plus the seller-level `is_accepting_commissions` switch that the studio displayed but nothing enforced.

**Migration** `supabase/migrations/20260903_commissions_phase2a_availability_slots.sql` — applied as `commissions_phase2a_availability_slots`.
- `commission_listings` (1:1 with service products, auto-created by trigger and backfilled): `availability` open | waitlist | closed | scheduled (+ `opens_at`), `slots_total` (NULL = unlimited), `slots_used` (trigger-maintained from active orders — an order holds a slot from creation, including `pending_payment`, until it reaches a terminal state; stale checkouts free it when they expire), `lead_time_days`, `turnaround_starts` payment | acceptance, `terms` (≤ 5000 chars), `accepts_custom_quotes`. RLS: public read for active products, sellers write their own rows; `slots_used` is not grantable to clients.
- `commission_order_gate(product_id)`: one rule set → `can_order`, `mode` (order | waitlist | closed), a buyer-facing `reason`. Order of checks: seller switch → closed → scheduled-in-future → waitlist → slots full.
- `create_marketplace_order`: for services, runs the gate **after** taking the existing `products` row lock, so two buyers racing for the last slot are serialized and the second gets "The only slot is taken right now." Waitlisted requests are always `pending_acceptance` (the seller decides), with `queued` + `queue_position` in the event metadata and the RPC result. Due date = now + lead time + package delivery days; a buyer-supplied date can only push it later. The hire form no longer lets buyers pick a shorter timeline.
- `trg_orders_rebase_due_date`: when the turnaround clock actually starts (`status → paid` for `turnaround_starts = payment`, `seller_accepted → true` for `acceptance`) the due date is recomputed from that moment.
- `get_commission_availability(product_id)` (public): live availability incl. slot counts, queue length, terms, lead time — the same gate the order path uses. `get_order_queue_position(order_id)` (buyer/seller/admin): position among active orders for the listing, before work starts.
- `run_listing_selftest()` (service role, rolled back): 1 slot → second buyer refused → waitlist forces approval at position 2 → cancel frees the slot → closed / future-scheduled / seller-off refused, past-scheduled opens → due date re-based on payment → public RPC agrees. Ran green on production; `run_money_selftest()` still green; production still has zero orders.

**Code**
- `lib/types/store.ts`: `CommissionListing`, `CommissionAvailabilityInfo`, `Product.commission_listing`, wizard state fields (`availability`, `opensAt`, `slotsTotal`, `leadTimeDays`, `turnaroundStarts`, `terms`, `acceptsCustomQuotes`).
- `lib/hooks/useProducts.ts`, `useMarketplace.ts`: product selects join `commission_listing:commission_listings(*)`.
- `lib/hooks/useCommissions.ts`: create/update upsert the listing row from the wizard state; `useCommissionAvailability(productId)` (RPC) and `useOrderQueuePosition(orderId)`.
- `CreateCommissionWizard`: step 2 gets an **Availability & slots** card (mode picker, opens-on date, slots or unlimited, lead time, when the clock starts, terms, custom-quotes toggle); review step shows availability and turnaround; scheduled requires a date.
- `CommissionDetailView`: availability box above the CTA (slots open / waitlist / not available with the reason, estimated delivery = lead + package days, clock start, custom-quote note); button becomes "Join the Waitlist" or "Not taking orders"; the hire modal shows the creator's terms and a computed delivery estimate instead of a buyer-chosen timeline; a refused order refreshes availability.
- `components/commissions/AvailabilityPill.tsx`: shared pill (Open · 2 of 5 slots open · Waitlist · Closed · Opens Sep 12 · Not taking orders) used on the marketplace commission card and the studio commission card.
- `OrderView`: "#2 of 4 in queue · 3 slots" pill for service orders before work starts.
- `lib/__tests__/db-selftests.test.ts` (the three DB suites in one sequential file; opt-in, `RUN_DB_SELFTEST=1`).

**Verified:** `npx tsc` clean; ESLint 0 errors (pre-existing warnings only); 161 tests pass incl. both DB self-tests; `npm run build` succeeds.

**Not in this phase (by design):** custom quotes are a flag only (2b builds the quote flow); terms are shown, not versioned/acknowledged per order (2c/3c); no email when a slot opens (2d); the studio header card with the availability pill is 3b.

**Next (at the time):** Phase 2c. Superseded by the entry below.

---

## Phase 2c — Intake, references, revisions, deliveries (2026-09-03)

**Closes:** the data half of the silent-failure root cause (RC-B1 / RC-C1 at the data level). A delivery, a revision request and a buyer's brief are now rows with files attached and a state of their own, instead of a status flip plus a chat message. The seller "Submit Delivery" that could fail from `paid` (the RPC only accepted `in_progress`) is gone: delivering auto-starts the order.

**Migration** `supabase/migrations/20260903_commissions_phase2c_intake_deliveries.sql` — applied as `commissions_phase2c_intake_deliveries`.
- `listing_intake_fields`: typed questions per service (short_text | long_text | number | url | select | multi_select | file), help text, options, required flag, position. Public read, seller write under RLS. Backfilled from `service_metadata.requirements` (kept as plain labels for old readers).
- `order_intake_answers`: the buyer's answers snapshotted per order (label + type copied, so later edits to the listing don't rewrite history). `create_marketplace_order` now **refuses a request that skips a required question** and records the answers; the legacy `{notes}` shape still works and becomes an "Extra notes" answer. `orders.requirements` is no longer written.
- `order_attachments`: every file on an order — `reference` (buyer), `revision` (buyer), `delivery` (seller) — as a bare path in the private `order-files` bucket. The database refuses any path outside `orders/<order_id>/`, caps 25 files per call and 100 MB per file; references cap at 20 per order.
- `order_revisions`: numbered requests with a note and files; `open → addressed` (by the next delivery) | `withdrawn`.
- `order_deliveries`: versioned (v1, v2 …) with note, files, `is_final`, the revision it addresses, and `submitted → revision_requested → accepted | superseded`. Acceptance (buyer or auto-complete cron) marks the open delivery accepted.
- RPCs (authenticated): `submit_order_delivery(order, note, files, is_final)` (seller; from paid / in_progress / revision_requested; needs a note or a file), `request_order_revision(order, note, files)` (buyer; from submitted; enforces `max_revisions`), `add_order_references(order, files)` (buyer; any open status), `get_order_workroom(order)` (participants + admins: answers, references, revisions, deliveries with attachments in one read). Every write also posts the existing system message with attachments, so the Messages tab and notifications keep working unchanged.
- `update_order_as_seller('submitted')` and `update_order_as_buyer('revision_requested')` delegate to the new RPCs, so nothing that still calls them breaks. `orders.delivery_note` / `delivery_assets` are no longer written (reads kept; dropping columns is 4c).
- `run_workroom_selftest()` (service role, rolled back): required-question refusal → answers snapshotted → bad path refused / good reference stored → empty delivery refused → v1 auto-starts the order → revision 1 marks the delivery → v2 addresses it and supersedes v1 → revision 2 refused at the cap → acceptance → one workroom read. Green on production; listing and money self-tests still green; zero orders left behind.

**Code**
- `lib/types/store.ts`: `ListingIntakeField`, `IntakeFieldDraft`, `IntakeAnswerInput`, `OrderIntakeAnswer`, `OrderAttachment`, `OrderFileInput`, `OrderRevision`, `OrderDelivery`, `OrderWorkroom`; `Product.intake_fields`; wizard `intakeFields`.
- `lib/hooks/useOrderWorkroom.ts` (new): `uploadOrderFiles(orderId, kind, files)` (uploads to `orders/<id>/<kind>/<uuid>.<ext>`), `useOrderWorkroom`, `useSubmitDelivery`, `useRequestRevision`, `useAddReferences`.
- `lib/hooks/useCommissions.ts`: create/update sync `listing_intake_fields` from the wizard (update in place by id, delete removed, insert new). `useProducts`: product reads join `intake_fields`.
- `CreateCommissionWizard` step 3: "What you'll need from them" is now a question builder (type chips, required, help text, options for pick-lists, reorder, remove); review shows the count and how many are required.
- `CommissionDetailView` hire modal: the creator's questions render by type (text, paragraph, number, link, pick one, pick many; file-type questions point at the reference picker), required ones are checked client-side too, a reference-file picker (up to 20) uploads right after the order is created.
- `DeliverySection` rewritten around the workroom: delivery history newest-first with version, Final tag, status pill, "addresses revision N", note and a signed-URL file grid; the open revision the seller must address sits on top; seller form with files + "This is the final delivery"; buyer Accept / Request Revision (note required, files optional, revisions-left counter). Exports `AttachmentGrid`.
- `OrderView`: Commission Brief card shows the intake answers and the reference files, with "+ Add files" for the buyer while the order is open; passes the workroom to `DeliverySection`.
- `OrderActions`: the duplicate Submit Delivery textarea and buyer Accept/Revision buttons for commissions are removed — one place does it now (Start Work / Start Revision stay).
- `lib/__tests__/db-selftests.test.ts` gains the workroom suite (sequential on purpose — the three suites deadlock when vitest runs them in parallel workers).

**Verified:** `npx tsc` clean; ESLint 0 errors (pre-existing warnings only); vitest incl. the three DB self-tests green; `npm run build` succeeds; hire modal renders the backfilled question in the local app.

**Deferred:** withdrawing a revision request, per-file delete, and a rich revision timeline are 3a; terms acknowledgement per order is 3c; email on delivery / revision is 2d.

**Next (at the time):** 3a. Superseded by the entry below.

---

## Phase 3a — Order page (2026-09-03)

**Closes:** RC-C1 (one owner of the order page: one action bar, one progress rail, one status map, no duplicate controls, real Activity tab, seller breadcrumb by role), the client half of RC-D1 (the page renders what `get_order_actions()` returns and never decides a transition itself), the order-page share of RC-C4 (`Button`, `Avatar`, `ActionMenu`, toasts and the new `Sheet` primitive; no hand-rolled overlays, no dynamic Tailwind class names). Also delivers the two 1d deferrals: partial-refund amount and dispute evidence upload.

**Mockup** (approved before build): https://claude.ai/code/artifact/dd472291-b56b-45c7-b420-1ba949746a0f — buyer/seller × desktop/phone × 14 states × 8 sheets. The mockup source is `order-page-mockup.html` in the session scratchpad only (not committed).

**No migration.** Everything reads existing RPCs and tables: `get_order_actions`, `get_order_workroom`, `get_order_queue_position`, `submit_order_delivery`, `request_order_revision`, `add_order_references`, `add_dispute_evidence`, `cancel_order`, `request_order_refund` / `issue_order_refund` / `decide_refund_request` (via `/api/payments/refund`), `open_dispute`, `accept_order`, `decline_order`, `add_order_tracking`, `update_order_as_*`, and a plain SELECT on `order_events` (participants already had the policy). Money, payout, refund and webhook code untouched.

**Design.** Same page for both roles. Photo-first header (listing cover, title, package · delivery days · revisions, status chip, counterparty row with Message). One card holds the progress rail and the action bar. Status vocabulary Requested → Accepted → Paid → In progress → Delivered → Approved; products use Requested → Paid → Shipped → Delivered → Approved (digital skips Shipped); "Accepted" only appears when the seller actually approves requests. Paused states (refund requested, dispute) and terminal states (cancelled, refunded, declined, expired, resolved) dim the rail and explain themselves in one full-background box (no accent-line borders anywhere). Under the rail, at most three facts both roles see: Due (with "2 days late" in amber), Auto-approves (countdown, re-rendered each minute), and the payout date ("Payout releases" for the seller, "Creator is paid" for the buyer). Four tabs: Overview (dispute / refund-request / reviews cards when relevant, Brief with intake answers and references, shipment or files for products, Summary with the same numbers under role labels — Total paid vs You receive — and one Details card), Deliveries (versions newest first with revision requests in between, large photo tiles, Final tag, "addresses revision N"), Messages (existing thread, own header removed), Activity (order events in plain words). Deliver / revise / cancel / refund / dispute / evidence / tracking / decline / edit-brief are sheets: bottom sheet on phones, centred dialog from `md`. On phones the action bar docks above the app's bottom nav.

**Code**
- New: `components/orders/OrderPage.tsx` (route shell), `OrderProgress.tsx` (rail + facts + notices; `compact` mode for order cards), `OrderActionBar.tsx` (every button from `get_order_actions`; desktop row + docked phone bar; overflow menu for cancel / refund / dispute / edit brief), `OrderSheets.tsx` (the nine forms), `OrderOverview.tsx`, `OrderDeliveries.tsx`, `OrderActivity.tsx`, `AttachmentGrid.tsx` (moved out of DeliverySection, photo-first sizes), `orderFormat.ts` (short dates, relative days, countdown, names), `components/ui/Sheet.tsx` (dialog semantics, Esc, focus trap, scroll lock).
- `lib/utils/orderStatus.ts` is now the one status map: label, tone, step, paused/terminal flags, `TONE_CLASSES` (full bg + matching border), `getOrderKind`, `getOrderSteps`, `getOrderProgress`. Dashboards, `OrderCard`, `SellerOrdersTable`, `CustomersCRM` keep reading `getOrderStatusMeta` and pick up the new labels.
- `lib/hooks/useOrders.ts`: `useOrderEvents` (new); `ORDER_SELECT` joins the order's package row (`pricing:product_pricing!orders_pricing_id_fkey`) so the header can say "Basic package · 7-day delivery". `useDisputes.ts`: `useRequestRefund` takes an optional amount; `useAddDisputeEvidence` (new). `useOrderWorkroom.ts`: upload kind `evidence` (path prefix only). `lib/types/store.ts`: `OrderEventType` gains `amount_mismatch` / `transfer_failed`.
- `components/orders/OrderCard.tsx` uses `OrderProgress compact`; `OrderMessages.tsx` lost its own heading (was a double heading inside a card). `components/seller/PendingOrderCard.tsx` is a slim link card (buyer, listing, hours to respond, amount) — Accept / Decline live on the order page only; `SellerDashboard` no longer carries accept/decline handlers.
- Deleted: `OrderView.tsx`, `OrderActions.tsx`, `DeliverySection.tsx`, `OrderTracker.tsx`, `OrderTimeline.tsx`, `DisputeModal.tsx`, `TrackingInput.tsx`. The pre-payment `DraftEditor` is gone too: shipping is collected on the checkout page already, and the brief has an "Edit brief" sheet until payment.
- `e2e/commissions-journey.spec.ts` updated to the new labels (Start work → Deliver work → Send delivery → Approve delivery). Still env-gated; not run (no E2E accounts).

**Verified**
- `npx tsc --noEmit` clean; ESLint 0 errors on changed files (two pre-existing unused-import warnings in `useOrders.ts` / `useDisputes.ts` remain); `npx vitest run` 159 pass; `RUN_DB_SELFTEST=1 npx vitest run lib/__tests__/db-selftests.test.ts` 3 pass against production; `npm run build` succeeds.
- Browser (local dev server, signed in as the buyer, Stripe test keys): hired `poet`'s $5 service → `/orders/<id>` shows the new header with package facts, chip "Awaiting payment", rail with Requested ticked, hint "Your card is charged now…", **Pay $5.48** primary, overflow menu (Cancel order / Edit brief), tabs Overview / Deliveries (empty state with due date) / Messages / Activity ("You placed the order"), Summary Basic package $5.00 / Processing fee $0.48 / Total $5.48. Edit-brief sheet opens with the brief prefilled; Cancel sheet ("Cancel this order? Nothing was charged.") → order cancelled, toast, rail dimmed with the reason, hint "Nothing was charged". No console errors. The test order and its intake answer, two events, two messages and one notification were deleted; production is back to zero orders and `slots_used = 0`.
- **Not exercised in the browser:** the seller view and the paid states (Start work, Deliver, Request revision, Approve, refund decision, dispute, tracking) — they need a paid order and a second signed-in account, and this session was told not to create paid orders in production. Those paths are type-checked and their RPCs are covered by the DB self-tests; the mockup shows every state. The Chrome extension could not shrink the window below desktop width, so the docked phone action bar and bottom sheets were checked in the mockup only.

**Deferred**
- Withdrawing a revision request: no RPC exists; add one (2b/3c) if wanted.
- The seller dashboard's pending list and `SellerOrdersTable` still use their own layouts; 3e redesigns the seller studio.
- `OrderCard`'s quick actions ("Pay Now", "Review Delivery") are unchanged; 4a consolidates order lists.
- Reviews stay on the Overview tab once an order is approved (no separate tab); the blind-reveal copy is a sentence, not a feature.

**Next (at the time):** 3c. Superseded by the entry below.

---

## Phase 3c — Listing detail & request flow (2026-09-03)

**Closes:** RC-C2 items 3, 4, 6, 8 and the detail-page half of 9 (one landing behaviour decided by an outcome screen; one brief form instead of three; no fabricated "24h average response" or canned "01 You submit… 02 I deliver…" process; guest hire returns to the listing after sign-in; category shown by label). Item 1 (checkout copy) is 3d; item 5 (studio banner) is 3b; item 7 (naming) is 4a.

**Mockup** (approved before build): https://claude.ai/code/artifact/62810df0-4e8e-4e48-a93c-3f0749a55cd4.

**No migration.** Reads `get_commission_availability`, `compute_order_money` (already granted to `authenticated`), `get_seller_stats`, `get_order_queue_position`; writes only through `/api/orders/create` and `add_order_references`. Money paths untouched.

**Design.** `/commissions/[id]` is photo first: gallery, category label, title, headline, creator row (avatar, name, completed orders and response time only when `get_seller_stats` has them, rating with review count, availability pill). Packages are selectable cards — a sticky panel on desktop, a horizontal snap row on phones with a sticky bar above the bottom nav that always shows the chosen package and price. Sections in order: About, **How it works** (built from the listing's real settings: the number of questions, when the clock starts, lead time, delivery days and revisions of the chosen package, the 3-day review, the 7-day payout; a creator-written `service_metadata.process` array replaces it when present), Includes / Not included, **What you'll be asked** (the intake questions by type), Delivery notes, **Terms** (from `commission_listings.terms`), FAQ, Reviews (inline, from completed commissions), tags. Owner sees Edit; closed listings show the reason.

The **request sheet** (`RequestSheet`, `Sheet size="tall"`) is one flow for the listing page and the Bag: package → brief plus the creator's typed questions (required ones enforced client-side and by the RPC) → references (up to 20) → review with Package · Creator receives · Pinkquill fee · Processing fee · Total from `compute_order_money`, the delivery estimate, and a terms checkbox when the creator wrote terms. After the order exists an **outcome screen** says what happens next before routing: "Request sent" (respond-by time, nothing charged, waitlist position when relevant) with View request, or "Ready to pay" (total, due date) with Pay now / Pay later. Guests are sent to `/login?redirect=` and come back to the listing.

**Code**
- New: `components/commissions/RequestSheet.tsx` (`RequestSheet`, `RequestSheetForProduct` for the Bag, `PackageCard`, `sortedPackages`, `sortedIntakeFields`, `estimatedDays`, `useMoneyPreview`).
- Rewritten: `components/commissions/CommissionDetail/CommissionDetailView.tsx` (836 → ~330 lines; the inline hire modal, `IntakeQuestion` copy and the hard-coded process are gone).
- `components/ui/Sheet.tsx`: `size="tall"` for multi-step flows.
- `components/queue/StudioQueuePage.tsx`: the per-item brief / timeline / notes form is gone; a commission's Request button opens the same sheet and the item is removed once the order exists. Guest → `/login?redirect=/cart`.
- `e2e/commissions-journey.spec.ts`: hire steps now drive the sheet (Request → Continue → brief → Continue ×2 → terms → Continue · $ → Pay $).

**Verified**
- `npx tsc --noEmit` clean; ESLint 0 errors on changed files (two pre-existing `<img>` warnings in the wizard); `npx vitest run` 159 pass; `npm run build` succeeds. DB self-tests unchanged (no migration).
- Browser (local dev server, signed in as the buyer): the listing page renders with the gallery, category label, creator row, the single Basic package selected, the availability line, "How it works" from real settings, the intake question preview, FAQ, the reviews panel (empty) and tags. Request → sheet step 1 → Continue → brief and the creator's question filled → References (empty) → Review shows Basic $5.00 / Creator receives $4.75 / Pinkquill fee $0.25 / Processing fee $0.48 / Total $5.48 → "Continue · $5.48" created order PQ-20260903-1146 → outcome "Ready to pay" with Total $5.48 and Due Sep 10 → "Pay later" landed on the new order page. Save to Bag → `/cart` shows the item without a brief form → Request opens the same sheet. No console errors. The test order and its intake answer, events, messages and notification were deleted; the Bag was cleared; production is back to zero orders, `slots_used = 0`.
- **Not exercised:** the waitlist / approval outcome (no listing with approval in production), the terms checkbox (poet's listing has no terms), file uploads from the sheet (the RPC path is the same as 2c's, which was tested), the phone layout (the Chrome extension cannot shrink the window; checked in the mockup only).

**Deferred**
- `get_commission_availability` does not expose the seller's `require_approval`, and `seller_profiles` is owner-readable only, so the listing cannot say "the creator approves requests first" before the order exists (the outcome screen covers it). A one-line addition to that RPC in 2b or 3f fixes the copy.
- Extras and custom quotes (2b): no extras step in the sheet yet; the "open to custom requests" line stays.
- `CommissionReviewsPanel` keeps its uppercase studio heading; 3b restyles it with the studio section.
- Marketplace / studio cards still show the raw category key on some cards (3b / 3e).

**Next:** 3b (studio commissions section) or 2b (quotes & extras). Needs your go. The seller-side check from 3a's note (a second account in Stripe test mode: Start work → Deliver → Request revision → Approve → refund decision) is still outstanding and would also cover this phase's approval outcome.
