# Commissions — rebuild plan

Date: 2026-09-02. Built on `00-lifecycle-map.md` and `01-findings.md`. Nothing here has been started.

## 0. Principles

1. **Phase 1 is money only.** No copy, no layout, no new features. All of it in Stripe **test mode** with test cards; live keys are not touched until the go-live checklist in 1e passes.
2. **One root cause per phase, fixed everywhere it appears.** A phase is done when the RC it targets has no remaining symptom in `01-findings.md`.
3. **Every phase is one session and leaves `main` working and committed.** Each phase ends with a migration that is idempotent and applied, code that builds, and a `03-progress.md` entry. If a session dies mid-phase the migration is either fully applied or not applied; no code path depends on a half-applied one (new columns are added nullable and backfilled; old paths are removed only in the *next* phase).
4. **Server owns state; the client renders.** After Phase 1 every order transition is one SECURITY DEFINER RPC with `FOR UPDATE`, one notification source, and one ledger write. Route handlers and webhooks call RPCs; they never write `orders.status` directly.
5. **Repo is the schema of record.** Phase 1a snapshots production into the repo; from then on nothing is applied outside `supabase/migrations/`.
6. **Show before ship** for every Phase 3 screen: mockup → your approval → build (project rule).
7. Separate phases for payments (1), product (2), design/UX (3), technical cleanup (4). Never blended.

**Starting condition that makes this cheap:** production has 2 placeholder orders, 3 listings, 10 profiles and has never taken a real payment. Phase 1a proposes deleting the two test orders (with your approval) so the money tables can be rebuilt without data migration.

## 1. Target payment architecture

Keep the pattern (platform as merchant of record, Stripe Checkout on the platform account, Express connected accounts, separate transfers after completion). Rebuild the trust model around a verified payment record and a single release gate.

```
Buyer ──Stripe Checkout (card only, platform acct)──► PaymentIntent succeeded
                                                          │ webhook (checkout.session.completed + payment_status=paid)
                                                          ▼
                                         payments row  {order_id, pi_id, charge_id, amount, currency,
                                                        stripe_fee (from balance txn), status='succeeded'}
                                                          │ record_payment() RPC  → orders.status = 'paid'
                                                          ▼
                     paid → in_progress → delivered → (revision loop) → completed
                                                          │ completion_at + RELEASE_WINDOW (proposed 72 h; decision D2)
                                                          │ no open dispute, no refund, payment.status='succeeded'
                                                          ▼
                                         release_seller_payout() RPC  → payouts row {order_id, amount, status='pending'}
                                                          │ worker: stripe.transfers.create (idempotency = payout id)
                                                          ▼
                                         payouts.status='sent' + transfer_id ; ledger_entries (append-only)
Refund/cancel/dispute at any point after 'paid' → refunds row → stripe.refunds.create(amount) [+ transfers.createReversal(amount) if paid out]
Chargeback → charge.dispute.* → order frozen, payout blocked or reversed, evidence flow, ledger entries
```

New tables (all service-role-only for writes; RLS `SELECT` for participants):

| Table | Purpose | Written by |
|---|---|---|
| `payments` | one row per PaymentIntent: amounts, fee, status, ids, raw event id | webhook RPCs only |
| `payouts` | one row per intended transfer: amount, status (`pending`, `sent`, `reversed`, `blocked`), transfer id, reason | `release_seller_payout`, worker, webhook |
| `refunds` | one row per refund: amount, initiator, reason, status, refund id, reversal id | refund RPCs, webhook |
| `ledger_entries` | append-only double-entry-ish log (`account` ∈ platform_revenue, platform_fees_expense, seller:<id>, buyer:<id>; `amount`; `ref_type/ref_id`); INSERT-only trigger | every money RPC |
| `stripe_events` | replaces `processed_stripe_events`: id, type, payload hash, status, error, attempts | webhook |

Existing `transactions` is retired after 1c (kept read-only until 4c deletes it).

One fee function `compute_order_money(item_amount, shipping, discount)` in SQL, called from create/promo/quote paths; `lib/payments.ts` reads the same constants from a `platform_settings` row, never from a literal.

## 2. Decisions I need from you (block the noted phases)

| # | Decision | Options | My recommendation | Blocks |
|---|---|---|---|---|
| D1 | Platform Stripe account country and target seller countries | — | **Answered:** Canada / CAD. Cross-border "recipient" accounts are unavailable to CA platforms; sellers get full connected accounts in Stripe-supported countries; CAD settlement with USD listings (see 03-progress Phase 1c). | done |
| D2 | Release window after completion | 0 h / 72 h / 7 d / 14 d | **Answered: 7 days** (`release_window_hours`), same for digital products. | done |
| D3 | Fee model (**answered: (b), buyer fee 3.5 % + $0.30**) | (a) seller pays 5 % (status quo, platform margin negative < $15); (b) seller 5 % + buyer "processing fee" line ≈ 3 % + $0.30; (c) seller 10 %, no buyer fee; (d) seller 5 % + raise minimum price to $15 | **(b)** — transparent, mirrors real costs, keeps $5 minimum viable; every screen shows "Seller receives X · Pinkquill fee Y · Processing Z". | 1b (display), 1c (ledger) |
| D4 | Cron host | GitHub Actions / Vercel Cron / Supabase `pg_cron` + `pg_net` | **Answered: pg_cron + pg_net** (no Pro plan). Runs logged in `cron_runs`. | done |
| D5 | Delete the two placeholder test orders and their transactions before 1a | yes / no | **Answered: yes** (done in 1a) | done |
| D6 | Refund policy defaults | who can cancel when; partial-refund permissions; whether buyer can cancel a `paid` order before `in_progress` without seller consent | Proposed in 1d: buyer may cancel free before `in_progress`; after that cancellation is a request the seller approves (partial allowed); late-by-N-days gives the buyer a unilateral cancel. | 1d |
| D7 | Email provider for order notifications (Phase 2d) | Resend / Supabase SMTP / none | Resend (templates already exist in `email-templates/`). | 2d |
| D8 | Admin/operator access | env allow-list of user ids / `profiles.role = 'admin'` | `profiles.role` with a `/admin/orders` route gated server-side | 1d, 2f |

## 3. Phases

Ordering rule applied: money and user risk first, then breakage that misleads users, then everything else. Within Phase 1 the order is dictated by dependencies.

### Phase 0 — Stop the bleeding (½ session, payments)

Closes: RC-A1 (grants), RC-A7.1–2 (promo codes, live keys), the theft path of RC-A2.

- Migration `phase0_lock_money_tables`: `REVOKE INSERT, UPDATE, DELETE ON orders, seller_accounts, transactions, order_events, disputes, order_reviews, processed_stripe_events, promo_codes, promo_code_redemptions, product_purchases, product_download_tokens, seller_stats, reviews FROM anon, authenticated` (SELECT kept); `DROP POLICY "Buyers can create orders"`, `"Users can create own seller account"`, `"Reviewers can update own review"`, `"Anyone can read active promo codes"`; `order-files` upload policy scoped to `orders/<order_id>/<auth.uid()>/…` with a participant check and a 100 MB limit; `order_messages` INSERT policy forbids `message_type = 'system'`. Client code keeps writing `products`, `product_pricing`, `product_media`, `product_keywords`, `product_shipping`, `product_files`, `seller_profiles`, `order_messages`, `product_saves` — untouched.
- Deactivate `test` and `TEST100` (`is_active = false`, `expires_at = now()`).
- `.env.local` → Stripe **test** keys; `.env.local.example` documents it; add `STRIPE_ACCOUNT_COUNTRY` placeholder for D1.
- `transferToSeller`: refuse unless `payment_provider = 'stripe'` and `checkout_session_id LIKE 'cs_%'` (temporary guard until 1c's payment record exists).
- Verify: grep proves no client path used the dropped policies; `npm run build`; manual smoke of create listing / hire / message.

### Phase 1a — Schema truth (1 session, payments)

Closes: RC-A5.

- With D5: delete the two placeholder orders, their `transactions`, `order_events`, `order_messages`, `order_reviews`.
- Migration `phase1a_reconcile_schema`: snapshot every live-only function/table/column/bucket into the repo (`create_order_notification`, `notify_*`, `set_auto_completion_deadline`, `mark_order_transfer_completed`, `orders.checkout_session_id/transfer_*`, `order-files`, …); add `expired` to both `orders` CHECKs; extend `order_events.event_type`, `notifications.type`, `transactions.status` CHECKs to the values the code writes; fix `auto_complete_orders` (`sender_id`); drop `auto_complete_digital_order` trigger, the 5-arg `mark_order_payment_failed`, `update_order_payment`, `sync_seller_account`, `update_purchase_as_*`, `submit_review`, `respond_to_review`, `reveal_expired_reviews`, `recalculate_seller_stats`, `release_order_escrow`; `payment_provider` default `'stripe'`; `remove_promo_from_order` recomputes fee; `FOR UPDATE` + `listing_type` checks in `update_order_as_buyer/seller`, `open_dispute`, `submit_order_review`; mark the never-applied `20260331` / `20260310` files as superseded (header comment) rather than applying them.
- Add `expired` to `OrderStatus`/`PaymentStatus`, `checkout_session_id` to `Order`.
- Verify: `supabase db diff` against live is empty; a Stripe-CLI `checkout.session.expired` replay returns 200; `auto_complete_orders()` runs to completion on a seeded due order.

### Phase 1b — Verified payment record + full webhook (1 session, payments)

Closes: RC-A4, RC-A2 (record half).

- Tables `payments`, `stripe_events`; RPCs `record_payment_succeeded(order_id, pi, charge, amount, currency, fee, event_id)` (→ `paid`, notifications inside), `record_payment_failed(...)` (→ `last_payment_error`, notification), `record_checkout_expired(...)` (→ `expired`, stock restore), `record_amount_mismatch(...)` (auto-refund via Stripe + event + admin notification).
- Checkout Session: `payment_method_types: ['card']`, `payment_intent_data.capture_method: 'automatic'`, store `payment_intent_id` on session creation; one session per order guaranteed by `SELECT … FOR UPDATE` on the order in `/api/checkout` and an in-flight guard in `CheckoutPage`.
- Webhook: verify `session.payment_status === 'paid'`; handle `checkout.session.async_payment_succeeded/failed`, `payment_intent.payment_failed`, `charge.refunded` (→ 1d RPC), `charge.dispute.created/closed/funds_withdrawn/funds_reinstated` (→ 1d RPC), `transfer.reversed`, `payout.failed`, `account.updated` (incl. `requirements`), `account.application.deauthorized`; every handler = one RPC call; side effects inside RPCs; `stripe_events` row records outcome; Sentry capture on any error.
- Remove the webhook's direct `notifications` inserts (trigger is the single source).
- `/checkout/[orderId]/complete` polls `orders.status` (own row via RLS), not the Stripe session; copy: "Payment received, confirming…" / "Confirmed" / "Still processing — you'll get a notification" (never "no charges were made").
- Fee display per D3 on checkout summary (numbers only; layout untouched).
- Verify (Stripe CLI, test cards): 4242 success; 4000 0000 0000 0002 decline; 4000 0025 0000 3155 3DS; expired session replay; duplicate event replay; amount tampered via Stripe dashboard test → auto-refund.

### Phase 1c — Payout release, ledger, cron (1 session, payments)

Closes: RC-A2 (release half), RC-A6.1–2/4, RC-A7.3, RC-A8.5–6.

- Tables `payouts`, `ledger_entries` (INSERT-only trigger), `platform_settings` (fee rates, release window, minimum price).
- RPC `release_seller_payout(order_id)`: the only path to a transfer; preconditions listed in §1; writes `payouts.pending` + ledger. RPC `mark_payout_sent / _failed / _blocked`.
- Worker route `/api/payouts/run` (cron, D4): claims `payouts.pending` rows `FOR UPDATE SKIP LOCKED`, calls `stripe.transfers.create` with idempotency key = payout id, records `transfer_id` and the balance transaction; failures → `failed` with reason, retry with backoff, admin notification after 3 failures; `pending_onboarding` becomes a `blocked` payout released by `account.updated`.
- Cron reliability: Vercel Cron or `pg_cron` per D4; `cron_runs` table (job, started, finished, counts, error); the auto-complete route only completes orders and enqueues releases — it never talks to Stripe.
- `seller_accounts` upsert uses `ON CONFLICT (user_id)`; duplicate Express accounts impossible.
- Fee: `compute_order_money()` SQL function; `create_marketplace_order`, `apply_promo_to_order`, `remove_promo_from_order` all call it; `lib/payments.ts` constants deleted. Minimum price from `platform_settings`.
- D1 outcome applied here (destination-charge variant if required).
- Verify: seeded completed order → release after window → transfer in test Connect account; payout blocked while dispute open; ledger sums to zero per order; cron run row written; `transactions` no longer written.

### Phase 1d — Refunds, cancellations, disputes, chargebacks (1 session, payments)

Closes: RC-A3, RC-A8.1–3 (locks), RC-D1 (server half).

- Table `refunds`. RPCs: `cancel_order(order_id, reason)` (pre-payment: status; post-payment: creates a refund — policy per D6), `request_refund`, `approve_refund(amount)`, `decline_refund`, `issue_refund(amount, reason)` (seller/admin, partial allowed), `record_refund_from_stripe(...)` (webhook), `open_dispute`, `add_dispute_evidence`, `resolve_dispute(resolution, refund_amount)` (admin, wired to `/api/admin/disputes`), `record_chargeback_opened/closed(...)` (freeze order, block/reverse payout, ledger, notify seller with evidence deadline).
- Every transition RPC: `FOR UPDATE`, explicit from-status set, `listing_type` check, one event, one system message, one notification.
- New RPC `get_order_actions(order_id)` returns the allowed actions for the caller (`can_cancel`, `can_deliver`, `can_request_revision`, `revisions_left`, `can_request_refund`, `refund_window_ends_at`, `auto_complete_at`, …). The client transition table is deleted; `useUpdateOrderStatus` calls the specific RPCs. (UI stays as is; it just stops lying.)
- `refundPayment` supports `amount`; reversal amount = min(amount, payout amount); halted reversals create a `refunds.status='needs_review'` row visible in admin.
- `/api/payments/refund` route becomes a thin RPC caller; the direct admin `orders.update` calls in `stripe-provider.ts`, `webhooks/route.ts`, `refund/route.ts` are deleted.
- Verify: cancel-after-pay refunds; partial refund adjusts ledger and payout; refund after payout reverses; chargeback test card 4000 0000 0000 0259 freezes the order and blocks the payout; dispute resolve from admin route; race test (two concurrent `deliver`/`cancel` calls, one wins).

### Phase 1e — Test harness and go-live checklist (1 session, payments)

Closes: RC-D5 for money paths; RC-A7.4–5.

- Vitest: state-machine table test against a local Postgres (or `pg-mem` shim) for every RPC from every status; fee function property tests; webhook handler tests with recorded Stripe fixtures.
- Playwright (test mode): hire → checkout (4242) → deliver → revise → complete → release → transfer visible in test Connect; decline card; refund; dispute.
- Rate-limit `/api/checkout/status`; cache `checkSellerStatus` 60 s server-side; Sentry on all payment routes.
- **Go-live checklist** (written into `03-progress.md`): D1 confirmed; webhook endpoint registered for the full event list with the live secret in Vercel only; Stripe receipts emailed on; statement descriptor set; Connect branding + tax forms configured; cron observed running for 24 h in test; `.env.local` never contains live keys; a manual runbook for `refunds.needs_review` and `payouts.failed`.

### Phase 2 — Product features (6 sessions)

Closes: RC-B1. Each session adds the entity + RPC + minimal wiring into the *existing* screens (no redesign — Phase 3 does that).

- **2a Availability & slots.** `commission_listings` (1:1 with `products` for services): `availability` (`open`, `closed`, `waitlist`, `opens_at`), `slots_total`, `slots_open` (maintained by trigger from active orders), `lead_time_days`, `turnaround_starts` (on payment / on acceptance), `terms` (usage rights, cancellation, kill fee — markdown), `accepts_custom_quotes`. `create_marketplace_order` checks availability and slots under lock (the "last slot" race is now a real, correctly-serialized race). Seller-level `is_accepting_commissions` enforced. Queue position exposed to buyers.
- **2b Quotes & extras.** `quotes` (buyer request → seller offer with line items, price, delivery, revisions, expiry → buyer accepts → order created from the quote at the quoted money). `listing_extras` + `order_extras` (add-ons, rush, commercial use). `package_tier` enum replaced by free tier names, 1–5 tiers.
- **2c Intake, references, revisions, deliveries.** `listing_intake_fields` (typed questions, required flags, file upload allowed); `order_intake_answers`; `order_attachments` (references, size limits, private bucket paths); `order_revisions` (request note, attachments, response); `order_deliveries` (versioned files + note, "final" flag). `delivery_assets`, `delivery_note`, `brief`, `requirements` columns retired.
- **2d Timelines & notifications.** Due-date engine (late warnings at −24 h / 0 / +48 h, buyer late-cancel right per D6, extension requests); email per D7 for every order event with one template system; in-app notifications carry title + amount + CTA; per-user notification preferences honoured.
- **2e Money visibility.** Buyer receipt page + PDF (`/orders/[id]/receipt`), seller statement per payout (`/seller/payouts/[id]`), per-order breakdown (gross, fees, net, payout date), `seller_analytics` RPC (revenue over time, conversion, on-time rate, response time measured from real message timestamps, repeat buyers).
- **2f Operations.** `/admin` (D8): orders search, refunds needing review, failed payouts, disputes with evidence and resolution, chargeback evidence submission to Stripe, platform settings editor, cron health.

### Phase 3 — Design & UX (6 sessions, mockup → approval → build each)

Closes: RC-C1–C4. Uses only existing tokens (`app/globals.css` palette, Poppins/Open Sans, `Button`, `Modal`, `Avatar`, `Skeleton`, `ActionMenu`, `ConfirmationModal`, toasts). Instagram-with-a-marketplace tone: photo-first cards, sheet-style modals, sticky action bars on mobile, no editorial/paper metaphors, no accent-line boxes.

- **3a Order page** (highest risk: silent failures). One `OrderPage` with a single `OrderActionBar` driven by `get_order_actions`, one `OrderProgress` (status vocabulary: Requested → Accepted → Paid → In progress → Delivered → Approved, with terminal pills), one status map, sticky mobile bar, tabs Overview / Deliveries / Messages / Activity (events), revision sheet with notes + attachments, seller sees the same deadlines the buyer sees, breadcrumbs by role. Deletes `OrderActions`, `DeliverySection`, `OrderTracker`, `OrderTimeline`, `PendingOrderCard` duplication.
- **3b Studio commissions section.** Replace the banner with a **Commission header card** that exists only when the profile sells: availability pill (Open · 2 of 5 slots · Waitlist · Closed until …), starting price, turnaround, rating with count, response time from real data, and two actions (Request a commission / Message). Owner variant: same card plus "Edit availability" and "Add a service". Tab hidden for non-sellers. Service cards: cover, name, from-price, turnaround, availability; category by label.
- **3c Listing detail & request flow.** Photo-first detail (gallery, tiers as horizontal cards on mobile), terms and process authored by the seller, real reviews inline, availability and queue; "Request" opens a full-height sheet: tier → extras → intake questions → references upload → summary with **Seller receives / Pinkquill fee / Processing / Total** → submit. One flow for detail, Bag and quotes; outcome screen explains what happens next (awaiting acceptance vs pay now) before routing.
- **3d Checkout.** Commission-specific summary (tier, extras, turnaround, revisions, due date, terms acknowledgement), the same money breakdown, Stripe embed, then a confirmation page that reads the order row. Bag becomes "Saved requests" or is removed for commissions (decision in the mockup review).
- **3e Seller studio.** Mobile nav (bottom tabs on `< md`), dashboard that works without Stripe (banner "Connect payouts to get paid" instead of a dead end), orders list with due-date/overdue column, search and server-side status filters, earnings with payouts and statements, settings without duplicated fields, one `TagInput`.
- **3f Listing wizard.** Drafts, tiers with custom names, extras, intake builder, terms, availability/slots, preview; `Button`/`Modal` primitives; publish toast.

### Phase 4 — Technical cleanup (3 sessions)

Closes: RC-D2, RC-D3, RC-D4, RC-D6, remainder of RC-D5.

- **4a Consolidation.** One `useOrders` module (`useOrderList({role, status, page})` server-filtered), one `useReviews`, one order loader; `formatCurrency` everywhere; one `MetricCard`; one status map; one date util; one auth-header + `safeResponseJson` helper; `actionToast.orderError(code)` mapping from RPC error codes; delete `hooks.legacy` references, `useStudioQueue` alias, `CreateCommissionOrderData`, `ProductPurchase`, `PromoCode` types, `/commissions/orders/[id]`.
- **4b Load & realtime.** Lean `ORDER_SELECT` per screen; drop `count: 'exact'` on lists; order events fan out over the existing `user-events:<userId>` broadcast channel (DB trigger) — remove the three `postgres_changes` subscriptions; `useSellerCustomers` → RPC aggregate; `useUpdateCommission` → single RPC transaction.
- **4c Dead objects & tests.** Drop `product_purchases`, `reviews`, `seller_stats`, `transactions` (after ledger backfill check), unused RPCs; unit tests for hooks and utils; e2e rewritten against the Phase 3 screens; update `MEMORY.md`/docs drift.

## 4. Recommended execution order

```
0 → 1a → 1b → 1c → 1d → 1e   (money; ~5½ sessions; test mode throughout; go-live gate at 1e)
2a (slots — overselling risk) → 2c (deliveries/revisions — the silent-failure root at data level)
3a (order page) → 3c (request flow) → 3b (studio section) → 3d (checkout)
2b (quotes/extras) → 2d (timelines/email) → 3e (seller studio) → 3f (wizard)
2e (receipts/analytics) → 2f (admin)
4a → 4b → 4c
```

Anything in 2/3/4 can be reordered at your call; Phase 0 and 1a–1e cannot.

## 5. What "done" means for a phase

Each phase ends with a `03-progress.md` entry containing: the RC(s) closed and the findings numbers now moot; migrations applied (names) and confirmation that `supabase db diff` is clean; files changed; what was tested and how (Stripe CLI commands, test cards, Playwright specs), with outcomes; anything deferred and why; the exact next phase and any decision still open. A fresh session must be able to continue from that file alone.

## 6. Not doing

- No PayPal or second provider (removed already; the abstraction stays only as a seam for the D1 variant).
- No milestone/deposit payments in this plan (VGen-style); noted for after 2b if wanted.
- No rebrand; no new colours, fonts or iconography beyond consolidating on the existing inline-SVG set.
