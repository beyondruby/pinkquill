# Commissions — audit findings

Date: 2026-09-02. Companion to `00-lifecycle-map.md`. Everything below was verified against the code at `744de67` and the **live** database (function bodies, policies, grants, constraints, row counts). "Verified structurally" means the code path and permissions were confirmed but the exploit was not executed against production.

Severity: **CRITICAL** = money can be lost or stolen, or a core flow cannot complete; **HIGH** = money or trust at risk under realistic conditions, or a user-facing flow is broken; **MEDIUM** = wrong but recoverable; **LOW** = hygiene.

Findings are grouped by **root cause** (RC). Each RC lists the symptoms it produces; fixing the RC fixes all of them.

---

## Summary

| # | Root cause | Area | Worst symptom | Severity |
|---|---|---|---|---|
| RC-A1 | Table-level grants were never audited; RLS policies are treated as the only gate | Payments/security | Any user can forge a `completed`+`paid` order and be paid out of the platform balance | CRITICAL |
| RC-A2 | Payout eligibility is derived from `orders.status`, not from a verified payment | Payments | Transfers for money that was never collected | CRITICAL |
| RC-A3 | Escrow is half-built: no hold, `escrow_released` never set, release/resolve functions unwired | Payments | Cancel-after-pay strands the buyer's money; refunds after payout; disputes are terminal | CRITICAL |
| RC-A4 | Webhook coverage is four events; everything else assumes the happy path | Payments | Chargebacks invisible; declined/async payments unhandled; charged buyer with no order | CRITICAL |
| RC-A5 | Schema drift: repo ≠ production; CHECK constraints reject values the code writes | Payments/data | Abandoned checkouts crash the webhook forever; auto-complete cron aborts every run | CRITICAL |
| RC-A6 | Money math lives in three places; Stripe fees, tax, cross-border and currency are unmodelled | Payments/business | Negative margin on small orders; refunds lose fees; fee shown to buyer who doesn't pay it | HIGH |
| RC-A7 | Operations: live keys in local env, 100 %-off promo codes live, cron on GitHub secrets, no ops surface | Payments/ops | Anyone who guesses `test` buys everything for $0 | CRITICAL |
| RC-A8 | No concurrency model: transition RPCs don't lock; listings have no capacity | Payments/product | Races between buyer and seller actions; unlimited simultaneous orders | HIGH |
| RC-B1 | A commission is modelled as a product with three price rows; nothing commission-specific exists in the data model | Product | No slots, quotes, extras, terms, intake, references, revision notes, milestones, receipts, admin | HIGH |
| RC-C1 | No single owner of the order page: two components render the same actions with different rules | Design/UX | Silent delivery failure; duplicate buttons; two trackers; three status colour maps | HIGH |
| RC-C2 | The commission surface is the product surface with relabelled copy | Design/UX | Checkout calls a commission a digital download; fee row buyers don't pay; three brief forms; stat-strip banner on every profile | HIGH |
| RC-C3 | Seller studio is desktop-first and Stripe-gated | Design/UX | No seller navigation on mobile; dashboard dead-ends after "Skip & Finish" | HIGH |
| RC-C4 | Design-system primitives exist but are unused in this area | Design/UX | Hand-rolled modals without a11y; dynamic Tailwind classes that never compile; light boxes in dark mode | MEDIUM |
| RC-D1 | Client-side state table diverges from the server state machine | Tech | "Mark as Shipped/Delivered" and "Submit Delivery from revision" fail before any RPC | HIGH |
| RC-D2 | Same logic implemented 2–20 times (hooks, maps, cards, formatting, forms) | Tech | Every fix must be applied in N places; they already disagree | MEDIUM |
| RC-D3 | Errors are swallowed or shown as raw Postgres text; no toast/ code mapping | Tech | Users click, nothing happens | MEDIUM |
| RC-D4 | Heavy selects, client-side tab filtering, per-order realtime channels, Stripe calls per poll | Tech/load | Wrong tab contents; O(open orders) channels; Stripe rate limits | MEDIUM |
| RC-D5 | ~Zero automated coverage of any money path | Tech | Regressions ship silently (they already have) | HIGH |
| RC-D6 | Dead objects: 15+ unused RPCs, legacy tables, redirect routes, unused types | Tech | Attack surface + confusion | LOW |

---

## A. Payments

### RC-A1 — Table grants were never audited; RLS is the only gate — CRITICAL

**What.** `authenticated` (and `anon`) hold `INSERT, UPDATE, DELETE` on `orders`, `seller_accounts`, `transactions`, `order_events`, `disputes`, `order_reviews`, `product_pricing`, `promo_codes`, `processed_stripe_events` and every other marketplace table (live `information_schema.role_table_grants`). RLS is enabled, so the policies decide — and two policies from the first marketplace migration still exist:

- `orders` — "Buyers can create orders" `FOR INSERT WITH CHECK (buyer_id = auth.uid())` (`supabase/migrations/20260209_marketplace_orders.sql:175`). No other column is constrained.
- `seller_accounts` — "Users can create own seller account" `WITH CHECK (user_id = auth.uid())` (`20260210_marketplace_payments_disputes.sql:61`).

**Symptoms.**
1. **Forged-order payout (theft).** `POST /rest/v1/orders` with `{buyer_id: me, seller_id: me, product_id: <any>, listing_type: 'service', amount: 1000, seller_amount: 950, platform_fee: 50, status: 'completed', payment_status: 'paid', currency: 'usd'}` is accepted. The hourly cron selects `status='completed' AND transfer_status IS NULL AND payment_status='paid'` (`app/api/orders/auto-complete/route.ts:39-45`) and `StripeProvider.transferToSeller` (`lib/providers/stripe-provider.ts:333-410`) sends `seller_amount` to the seller's connected account from the platform balance. The only check is `0 < seller_amount ≤ amount`. Verified structurally.
2. **Free digital goods / forged history.** A forged `delivered` order satisfies the `product_files` read policy (status not in cancelled/refunded/pending/declined) and appears in seller dashboards, `get_seller_earnings`, `get_seller_stats`, and triggers `notify_order_created` spam to any seller.
3. **Onboarding bypass.** A user can insert their own `seller_accounts` row with `payouts_enabled = true` and any `stripe_account_id`; `transferToSeller` trusts both fields (`stripe-provider.ts:353-368`).
4. **Blind-reveal bypass.** `order_reviews` "Reviewers can update own review" is column-unrestricted (`20260214_quill_reviews.sql:67-70`): `quill_score`, `is_public`, `revealed_at`, `reveal_deadline`, `reviewee_id` are all editable after the fact.
5. **Storage.** `order-files` INSERT policy is `bucket_id = 'order-files'` with no folder check and no size limit (live `storage.objects` policies; `storage.buckets`): any authenticated user can upload anything to any order's folder; the DELETE policy keys on `folder[1] = uid` but uploads go to `orders/<id>/…`, so nothing is ever deletable.
6. `order_messages` INSERT policy lets participants post `message_type = 'system'` (`20260209_marketplace_orders.sql:192`).

**Why it matters.** Direct theft from the platform balance, with no Stripe payment behind it. Three prior security passes (June C1–C6, September phase 3) only touched function EXECUTE grants and never listed table privileges, which is why this survived.

**Files.** `20260209_marketplace_orders.sql:175`, `20260210_marketplace_payments_disputes.sql:61`, `20260214_quill_reviews.sql:67-70`, live storage policies, `app/api/orders/auto-complete/route.ts:37-57`, `lib/providers/stripe-provider.ts:333-410`.

**Fix shape.** Revoke `INSERT/UPDATE/DELETE` from `anon, authenticated` on every money/order table (keep `SELECT` where RLS reads are intended); drop the two INSERT policies; replace the `order_reviews` UPDATE policy with an RPC; scope `order-files` uploads to `orders/<order_id>/<uid>/…` with a participant check and a size limit. No app code uses any of the removed paths (verified by grep — creation goes through `create_marketplace_order` via `/api/orders/create`).

### RC-A2 — Payout eligibility comes from `orders.status`, not from a verified payment — CRITICAL

**What.** Nothing between "an order says it is paid" and "Stripe moves money" checks that a Stripe payment exists. `finalize_order_payment` is also called by `/api/checkout/confirm` for placeholder/free orders and writes the same `payment` / `platform_fee` / `seller_payout` transaction rows as a real payment. `transferToSeller` never checks `payment_provider`, `checkout_session_id`, `payment_intent_id` (never stored at all), or a `transactions.payment` row.

**Symptoms.**
1. The existing production service order (placeholder-paid, `completed`) already carries `transfer_status = 'pending_onboarding'` — a real Stripe transfer was attempted for money never collected; it only failed because the seller lacked `payouts_enabled`.
2. Forged orders (RC-A1) are payable.
3. $0 orders (100 % promo, PWYW $0) reach `transferToSeller`, throw on `seller_amount ≤ 0`, and are retried every hour forever, each time trying to insert a `transfer_failed` event and an `order_transfer_failed` notification (both rejected by CHECK constraints — RC-A5).
4. `payment_intent_id` is never persisted; refunds re-fetch it from the Checkout Session (`stripe-provider.ts:432-447`). If the session id were ever wrong or missing, the order is unrefundable.

**Files.** `supabase` live `finalize_order_payment`, `app/api/checkout/confirm/route.ts:83-99`, `app/api/orders/auto-complete/route.ts:37-45`, `lib/providers/stripe-provider.ts:333-410`.

**Fix shape.** A `payments` record written only by the webhook from the PaymentIntent/Charge (id, amount, currency, Stripe fee from the balance transaction, status), and a single `release_seller_payout(order_id)` RPC that is the only path to a transfer and requires: a `succeeded` payment record, `status = 'completed'`, refund window elapsed, no open dispute, not refunded.

### RC-A3 — Escrow is half-built — CRITICAL

**What.** Funds do sit in the platform balance until transfer (that part is sound), but every control that should govern the hold is missing or unwired:
- `orders.escrow_released` is set by `finalize_order_escrow_release`, `release_order_escrow` and `resolve_dispute` — none of which is called by any code (grep across `app/ lib/ components/`). So `request_refund`'s guard "cannot request after funds released" never fires.
- `update_order_as_buyer` and `update_order_as_seller` (live bodies) allow `cancelled` from `paid`. No refund is issued; `payment_status` stays `paid`; `request_refund` rejects `cancelled`; the seller-approve route's `approvableStatuses` excludes `cancelled` (`app/api/payments/refund/route.ts:124-127`). The buyer's money is stranded with no self-service exit. The UI hides the button after payment (`OrderActions.tsx:192`), but the RPC is callable directly.
- `request_refund` allows `completed`, i.e. after the seller may have been paid; there is no refund window. Approve then attempts a transfer reversal, which fails once the seller has withdrawn (`stripe-provider.ts:452-466`) and halts with a console error only.
- `resolve_dispute` (service-role only) has no route and no admin UI → `disputed` is terminal in practice. `disputes.order_id` is UNIQUE, so a second dispute on an order raises a raw unique-violation.
- Partial refunds exist only via the Stripe dashboard; the `charge.refunded` webhook sets `partially_refunded` but does not adjust `seller_amount` or partially reverse the transfer (`app/api/stripe/webhooks/route.ts:239-300`) → the seller keeps the full payout, the platform eats the partial.
- Digital products are transferred the moment payment lands (`webhooks/route.ts:180-186`), so any refund needs a reversal from a seller who may already have withdrawn.

**Why it matters.** Every unhappy path after payment either strands money or costs the platform. On Fiverr/VGen the hold, the refund window and the dispute exit are the product.

**Files.** live `update_order_as_buyer`, `update_order_as_seller`, `request_refund`, `resolve_dispute`, `finalize_order_escrow_release`, `release_order_escrow`; `app/api/payments/refund/route.ts`; `lib/providers/stripe-provider.ts:417-492`; `app/api/stripe/webhooks/route.ts:239-390`.

**Fix shape.** One explicit hold model: `paid → … → completed → (refund window, e.g. 72 h) → payout_released`. Cancel-after-pay is a refund, never a status flip. Partial refunds are first-class (amount, who bears it, transfer reversal amount). Disputes have an admin resolution route. Digital-product transfers follow the same window.

### RC-A4 — Webhook coverage is four events — CRITICAL

**What.** `app/api/stripe/webhooks/route.ts` handles `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `account.updated`. Signature verification and the `processed_stripe_events` idempotency claim are correct.

**Symptoms.**
1. **Chargebacks are invisible.** No `charge.dispute.created / closed / funds_withdrawn / funds_reinstated`. A cardholder dispute after payout: platform loses the payout plus the $15 dispute fee, the order stays `completed`, the seller is never told, no evidence is ever submitted.
2. **`checkout.session.completed` finalizes without checking `session.payment_status === 'paid'`** (`:105-140`). For any delayed payment method enabled in the Stripe dashboard, `completed` arrives with `payment_status = 'unpaid'` and the order is marked paid before money exists; `checkout.session.async_payment_succeeded / failed` are not handled. Whether delayed methods are enabled is a dashboard setting — unverified.
3. **Card declines are silent server-side.** `payment_intent.payment_failed` is ignored; `mark_order_payment_failed` (and the `last_payment_error` column from `20260215_payment_decline_telemetry.sql`) has no caller.
4. **Amount mismatch strands a charged buyer.** On mismatch the handler returns 200 with `warning`, tries to write an `order_events.event_type = 'amount_mismatch'` row (rejected by CHECK — RC-A5), and leaves the order `pending_payment` while the buyer's card has been charged (`:121-135`). No refund, no alert.
5. **`transfer.reversed`, `payout.failed`, `account.application.deauthorized`, `account.updated` requirements** (`requirements.currently_due`, `disabled_reason`) are ignored; a seller whose account becomes restricted after a transfer is never handled.
6. **Side effects are not transactional.** Notifications, the digital transfer and status writes happen after `finalize_order_payment`; on any throw the idempotency marker is deleted (`:437-443`) and Stripe's retry re-runs every side effect except finalize → duplicate notifications (transfers are protected by their idempotency key).
7. **Duplicate notifications by design.** The webhook inserts `order_paid` for seller and buyer (`:143-160`) and the `notify_order_status_change` trigger inserts `order_paid` for the seller again; `charge.refunded` inserts `order_refunded` and the trigger does too.
8. **The success page trusts Stripe, not the database.** `/checkout/[orderId]/complete` shows "Payment Successful!" when the Stripe session is `complete` (`complete/page.tsx:54-57`), then redirects to `/orders/[id]`, which may still show "Complete Your Payment" if the webhook is slow or failed. The failure branch says "No charges were made" after ten polls or a 401 loop, which can be false.
9. **Session churn.** `CheckoutPage` re-runs `createCheckout` on every `order` object change with no in-flight guard (`CheckoutPage.tsx:451-466`); saving a note or applying a promo mints another Stripe session (the previous `open` one is reused only if the DB pointer still matches).

**Files.** `app/api/stripe/webhooks/route.ts`, `lib/payments-server.ts`, `app/(feed)/checkout/[orderId]/complete/page.tsx`, `components/checkout/CheckoutPage.tsx:401-466`.

**Fix shape.** Restrict Checkout to `payment_method_types: ['card']` (or handle async events), handle the full event set, make the webhook write a payment record and *only* call transition RPCs (no direct admin status writes), move notifications into the RPCs (single source), and make the success page poll the order row.

### RC-A5 — Schema drift; constraints reject what the code writes — CRITICAL

**What.** The repo and production disagree, and several live constraints contradict live code.

1. **`mark_order_expired` can never succeed.** It writes `status = 'expired'` and `payment_status = 'expired'` (`20260621_phase1b_mark_order_expired_rpc_and_webhook_idempotency.sql:22`); live `orders_status_check` and `orders_payment_status_check` do not include `expired`. Every `checkout.session.expired` webhook → RPC exception → 500 → marker deleted → Stripe retries for three days. Every abandoned checkout is permanent webhook noise; the order stays `pending_payment`; product stock decremented at creation is never restored (`restore_order_stock_on_early_exit` fires only on declined/cancelled).
2. **`auto_complete_orders` (live body) inserts `order_messages` without `sender_id`** (NOT NULL) → the RPC aborts on the first due order → `/api/orders/auto-complete` returns 500 before it reaches the transfer loop. No order will ever auto-complete and, once one becomes due, no transfer will ever run from the cron.
3. **Silently dropped audit rows.** `order_events.event_type` CHECK rejects `'amount_mismatch'` and `'transfer_failed'`; `notifications.type` rejects `'order_transfer_failed'`; `transactions.status` rejects `'reversal_failed'`. The writers (`webhooks/route.ts:129,194,337`, `auto-complete/route.ts:67,83`) ignore the returned error. The riskiest events leave no trace.
4. **Never-applied migrations.** `20260331_comprehensive_fixes.sql` (amount constraints, promo audit, FK cascade) and the money half of `20260310_security_hardening_review.sql` are not live. Live bodies of `update_order_as_buyer/seller`, `open_dispute`, `auto_complete_orders`, `get_seller_earnings`, `finalize_order_payment` differ from the repo's latest files (e.g. repo forbids cancel-from-paid; live allows it). ~15 live functions, `reviews`, `seller_stats`, the `order-files` bucket, and `orders.checkout_session_id / transfer_*` columns have no repo source.
5. **Dead or wrong triggers.** `auto_complete_digital_order` (BEFORE UPDATE) would call `generate_order_download_tokens` under service role (it requires `auth.uid()`) and is only unreachable because `finalize_order_payment` jumps digital orders straight to `delivered`. `payment_provider` defaults to `'paypal'`. Two overloads of `mark_order_payment_failed`.
6. **`remove_promo_from_order` restores `amount` but not `platform_fee`/`seller_amount`** (live = `20260212_marketplace_alignment.sql:1275-1281`) → after apply→remove the seller payout stays at the discounted figure.

**Files.** live `pg_constraint` on `orders`, `order_events`, `notifications`, `transactions`; `supabase/migrations/20260621_phase1b_*`, `20260331_*`, `20260310_*`; `app/api/orders/auto-complete/route.ts`; `app/api/stripe/webhooks/route.ts`.

**Fix shape.** One reconciliation migration that (a) snapshots every live-only object into the repo, (b) aligns constraints with the status vocabulary, (c) fixes the cron RPC, (d) deletes the dead triggers/overloads. Then a rule: the repo is the source of truth and every migration is applied through the same path.

### RC-A6 — Money math in three places; fees, tax, currency, borders unmodelled — HIGH

1. **Platform margin can be negative.** Fee = 5 % of the item (`create_marketplace_order`; `lib/payments.ts:21`). Stripe's processing fee (≈2.9 % + $0.30 domestic, more for international cards and currency conversion) is paid by the platform and modelled nowhere. On the enforced $5 minimum the platform earns $0.25 and pays ≈$0.45. Break-even is ≈$15; the platform's real take is ≈2 % above that.
2. **Refunds cost the platform twice.** Stripe keeps its processing fee on refund; the buyer is refunded 100 %; the seller reversal recovers only `seller_amount`.
3. **The buyer is told they pay a fee they don't.** Checkout shows a "Platform fee (5 %)" row not added to the total (`CheckoutPage.tsx:1312-1322`); the Bag says "Platform fees calculated at checkout" (`StudioQueuePage.tsx:223-225`); `OrderView` shows "Platform Fee" to the buyer only (`OrderView.tsx:497-499`). The fee is deducted from the seller.
4. **Fee computed in three places** with two bases: `create_marketplace_order` (item), `apply_promo_to_order` (discounted amount − shipping), `lib/payments.ts` constant; `remove_promo` recomputes neither (RC-A5.6).
5. **Cross-border payouts unverified.** Express accounts with `transfers` only can receive separate-charge transfers only when platform and seller are in the same region, or from a US platform with the recipient service agreement. The platform Stripe account's country is not recorded anywhere in the repo (Supabase is in Singapore). If the platform is not US, sellers outside its region cannot be paid with this architecture at all.
6. **Merchant of record obligations.** As MoR the platform owns sales tax / VAT / GST collection and remittance and buyer receipts; no Stripe Tax, no invoice, no in-app receipt on either side (`transactions` is not user-facing as a statement). Seller tax forms (1099-K etc.) are a Connect configuration that has not been made.
7. **Currency.** `orders.currency` is the pricing row's currency (default USD); transfers use it; if the seller's account default currency differs Stripe converts silently at its rate; every UI hard-codes `$`.

**Files.** `lib/payments.ts`, live `create_marketplace_order`, `apply_promo_to_order`, `remove_promo_from_order`, `lib/providers/stripe-provider.ts:372-380`, `components/checkout/CheckoutPage.tsx:1312-1322`, `components/queue/StudioQueuePage.tsx:223-225`, `components/orders/OrderView.tsx:497-503`, `components/seller/EarningsOverview.tsx:213-223`.

**Fix shape.** One fee function (DB) with one base; record Stripe's actual fee per payment; decide the fee model explicitly (seller-side %, buyer-side service fee, or both — see plan); minimum price that keeps margin ≥ 0; verify platform country and pick the Connect model accordingly; Stripe receipts on; seller statements.

### RC-A7 — Operational safety — CRITICAL

1. **Two active 100 %-off promo codes in production** (`test`, `TEST100`), unlimited uses, no expiry; `validate_promo_code` / `apply_promo_to_order` are executable by `authenticated`; the live SELECT policy "Anyone can read active promo codes" exposes every active code to the anon key (the repo migration dropped a policy of a different name). Anyone who guesses the code buys anything for $0 and `/api/checkout/confirm` finalizes it.
2. **`.env.local` holds live Stripe keys** (`sk_live…`, `pk_live…`, `whsec…`) with `PAYMENTS_PROVIDER=stripe`. Local development runs against the live account.
3. **Payouts depend on a GitHub Actions cron** (`.github/workflows/marketplace-cron.yml`) hitting production with repo secrets `APP_BASE_URL` / `CRON_SECRET`. Production data is consistent with it not running (see map §0). Even when it runs, `auto_complete_orders` aborts (RC-A5.2).
4. **No operator surface or alerting.** Halted refunds, failed transfers, amount mismatches, disputes and chargebacks all end in `console.error`. There is no admin route, no queue, no Sentry capture on these paths (Sentry is configured for the app but none of the payment routes call it).
5. `GET /api/checkout/status` and `GET /api/stripe/connect/status` call Stripe on every poll with no rate limit / caching server-side.

**Files.** live `promo_codes` rows and policy; `.env.local`; `.github/workflows/marketplace-cron.yml`; `app/api/checkout/status/route.ts`; `app/api/stripe/connect/status/route.ts`.

### RC-A8 — No concurrency model — HIGH

1. `update_order_as_buyer`, `update_order_as_seller`, `open_dispute`, `release_order_escrow`, `generate_order_download_tokens`, `submit_order_review` read the order without `FOR UPDATE`; guards are TOCTOU. Buyer "complete" racing seller "cancel", or two concurrent revision requests both passing the `max_revisions` check, interleave.
2. `update_order_as_seller` has no `listing_type` check → a service order can be moved to `processing` / `shipped`.
3. **Listings have no capacity.** Services have no slot count, no queue, no per-listing open/closed; `seller_profiles.is_accepting_commissions` is read by the banner only — `create_marketplace_order` and the hire flow never check it. Two buyers "grabbing the last slot" is not a race; there is no slot.
4. Product stock is decremented at order creation (`pending_payment`) and only restored on declined/cancelled, never on expiry (RC-A5.1) → stock leaks on every abandoned checkout.
5. `createSellerAccount` reads-then-inserts `seller_accounts` without a lock → duplicate Express accounts on double-click (`stripe-provider.ts:86-123`).
6. Rate limiting fails closed on any DB error (`lib/api-security.ts:196-210`) → checkout unavailable during a DB hiccup.

**Files.** live RPC bodies; `lib/providers/stripe-provider.ts:86-123`; `lib/api-security.ts`.

---

## B. Product gaps

### RC-B1 — A commission is a product with three price rows — HIGH

Everything a seller needs to run a commission business, and a buyer needs to feel safe, is absent because the data model has nowhere to put it. What the seller cannot do today (verified in wizard, settings and RPCs):

| Missing | Fiverr / VGen / Artistree equivalent | Where it would live |
|---|---|---|
| Slots / capacity / queue position / waitlist | VGen slots, Artistree queue | none — `is_accepting_commissions` boolean only, unenforced |
| Per-listing open/closed and "opens on" | all | `products.status` pause only |
| Custom quotes / counter-offer / price adjustment before accept | Fiverr custom offers, VGen quotes | none — accept/decline only |
| Extras / add-ons / rush fee / commercial-use upgrade | Fiverr gig extras | none |
| Terms of service, usage rights, cancellation / kill-fee policy | Artistree TOS | none |
| Structured intake (questions, required fields, file uploads for references) | Fiverr requirements, VGen forms | `brief` text + `requirements` free strings; no upload |
| Revision notes attached to a revision request | all | status flip only |
| Delivery assets on the order (`delivery_assets` is never populated by either UI) | all | column exists, unused |
| Milestones / deposits / split payments | VGen milestones | none |
| Due-date enforcement, late warnings, buyer cancel-if-late | Fiverr late badge + cancel right | `due_date` stored, never read |
| Email notifications for any order event | all | in-app only |
| Receipts / invoices for buyers; statements for sellers | all | none |
| Seller analytics (conversion, response time, on-time rate, revenue over time) | Fiverr analytics | four counters; `response_time_hours` never written by the wizard so "24h average response" is always the default (`CommissionDetailView.tsx:266`) |
| Dispute resolution with evidence and an operator | all | `resolve_dispute` unwired |
| Draft listings | all | published `active` instantly (`useCommissions.ts:90`) |
| Custom tier names / more than 3 tiers / no tiers (single price) | VGen | `package_tier` enum of 4 |
| Seller cancellation of a paid order with refund | all | impossible (RC-A3) |
| Partial refund | all | impossible (RC-A3) |
| Buyer reference uploads in chat | all | composer has no attachment control (`OrderMessages.tsx:83-99`) |
| Seller sees the auto-complete deadline | Fiverr | buyer-only (`OrderActions.tsx:270-272`) |
| Per-order fee breakdown and payout date for the seller | all | `EarningsOverview` shows totals only |

**Root cause.** `listing_type = 'service'` was bolted onto `products`; packages onto `product_pricing`; commission behaviour onto `orders` columns. There is no `commission_listing`, `commission_slot`, `quote`, `order_extra`, `order_revision`, `order_delivery` or `payout` entity. Every feature above needs one.

---

## C. Design, UI, UX

### RC-C1 — Nobody owns the order page — HIGH

`OrderView` (910 lines) composes `OrderActions` (478) and `DeliverySection` (261), each with its own idea of what is allowed.

1. **Silent failure.** `DeliverySection` shows "Submit Delivery" from `revision_requested` (`:42`), uploads the files, posts a chat message, then calls `updateStatus('submitted')`, which the client transition table rejects (`useOrders.ts:510`); the return value is ignored (`DeliverySection.tsx:92-96`). Files and message go out; the order does not move; no error is shown. Meanwhile `OrderActions` shows "Start Revision" beside it.
2. **Duplicate controls.** Buyer "Accept Delivery" / "Request Revision" render twice (`OrderActions.tsx:250-261`, `DeliverySection.tsx:220-246`); seller "Submit Delivery" renders twice with different capabilities (note-only vs files). Seller accept/decline is implemented in `PendingOrderCard` and again in `OrderActions`.
3. **Two trackers, three colour maps.** `OrderTracker` "Placed · Accepted · Paid · In Progress · Delivered · Completed" vs `OrderTimeline` "Hired · In Progress · Delivered · Completed"; the badge says "Submitted" while both trackers say "Delivered"; "Accepted" shows for sellers who never approve. Colours differ between `OrderView.tsx:35-52`, `lib/utils/orderStatus.ts:16-33` and `OrderTracker.tsx:53-60`.
4. **Nested cards / double headings** everywhere `OrderView` wraps a child that renders its own section (`:386-389`, `:392-397`, `:401-404`, `:574-577`); `DigitalDownloadSection` returns `null` inside a card that still shows "Your purchased files are ready".
5. "Activity" tab is only chat; no event history although `order_events` exists. Seller breadcrumb points at the buyer dashboard (`:258-262`). No revision-feedback field; exhausted revisions just hide the button.
6. `InlineForm` builds `text-${color}-600` (`OrderActions.tsx:412-415`) — Tailwind v4 never generates these, so titles and focus rings silently lose colour.

### RC-C2 — The commission surface is the product surface with relabelled copy — HIGH

1. **Checkout describes a commission as a digital download**: "Digital delivery is instant after payment", "Digital delivery" pill, "Your files will be available after payment confirmation" (`CheckoutPage.tsx:668-673, 700-702, 1079-1089`). No package, delivery days, revisions or due date appear in the summary.
2. **Fee row buyers don't pay** (RC-A6.3).
3. **Two landing behaviours for the same action.** Detail page → `/checkout/[id]` for pay-now sellers, `/orders/[id]` for approval sellers (`CommissionDetailView.tsx:164-168`); Bag → always `/orders/[id]` (`StudioQueuePage.tsx:296-299`), so pay-now buyers land on a "Complete Your Payment" banner instead of checkout. The destination depends on a seller setting the buyer cannot see.
4. **Three-plus free-text brief forms** with different rules: hire modal (`CommissionDetailView.tsx:566-600`), Bag card (`StudioQueuePage.tsx:134-171`, timeline min 1 vs package days), OrderView `DraftEditor` (`:716-726`), checkout "Note to Seller" (`CheckoutPage.tsx:773-878`).
5. **The studio banner** (`CommissionsTab.tsx:203-297`): a glass-gradient stat strip — eyebrow "Commissions", headline = seller tagline or fallback "Open for work", a Quill score, a 3-column `dl` "Taking orders Yes/No · Delivered projects · Reply time", skills/services chips. It renders for **every** profile (the tab is unconditional, `StudioProfile.tsx:1469-1474`), so non-sellers show "Open for work" + "Taking orders **No**" + "0" + "--". It has no action at all (no Hire, no Message, no View services). "Taking orders" is unenforced; "Reply time" reads `service_metadata.response_time_hours`, which the wizard never writes, instead of `seller_profiles.response_time_hours`, which Settings does write; store name is promised on the banner by Settings copy and never rendered; the headline field is labelled "Title" / "Tagline" / banner across three screens; 9–10 px labels on a forced 3-column grid on mobile.
6. **Fabricated defaults**: "24h average response" on every listing; hard-coded first-person "Process" section ("01 You submit your brief… 02 I deliver…") that the seller did not write (`CommissionDetailView.tsx:332-348`).
7. **Naming**: `/cart` = "Bag" = `StudioQueuePage`/`StudioCartPage` = `useStudioQueue`/`useStudioCart`; "Marketplace" / `/shop` / studio "Store"; "Seller Studio" / "Commissions Studio" / profile "Studio"; "Services" / "Commissions" / "Commission Service".
8. Guest hire → `/login` without a return path (`CommissionDetailView.tsx:116`); wizard sign-in wall has no sign-in control (`CreateCommissionWizard.tsx:459-475`).
9. Marketplace/studio cards show the category as its raw key and a filler headline "Outcome-focused service with clear package scope…" when the seller left it blank.

### RC-C3 — Seller studio is desktop-first and Stripe-gated — HIGH

1. `SellerSidebar` is `hidden md:block` with no mobile equivalent (`app/seller/layout.tsx:75`) — sellers on phones have no navigation at all. Studio profile tab labels are hidden below `md` so "Commissions" is an unlabeled icon among six.
2. Dashboard renders **only** "Set Up Your Seller Account → Complete Setup" until `charges_enabled` (`SellerDashboard.tsx:143-165`) although the setup wizard offers "Skip & Finish" (`SellerSetupWizard.tsx:530-538`) — and `charges_enabled` is the wrong flag for a transfers-only account anyway (`payouts_enabled` is what gates payouts).
3. `/seller/onboarding` duplicates the wizard's Payment step; `/seller/settings` "Commissions Studio" duplicates wizard fields with different labels; two `TagInput` implementations with duplicated suggestion lists.
4. Orders table: no search, sort, due-date or overdue column; fixed-width columns collapse on small screens; owner card menus are `opacity-0` until hover (unreachable on touch, `CommissionsTab.tsx:586`).
5. Earnings: totals only, no payout schedule, no per-order fee line, no statement.

### RC-C4 — Design-system primitives unused — MEDIUM

`components/ui/Button`, `Modal`, `Avatar`, `Skeleton` are imported by **no** commission / order / seller / checkout / bag / review file (verified by grep). Consequences: hand-rolled overlays without `role="dialog"`, focus trap or Esc (`CommissionDetailView.tsx:545-614`, `DisputeModal.tsx:27-32`); toggles without `role="switch"`; avatar-with-initial fallback re-implemented in ≥8 files; four `MetricCard` copies; hard-coded `gray/rose/pink/violet` utilities and `rgba(255,255,255…)` gradient panels that render as white boxes in dark mode (`CheckoutPage.tsx:681,737,774,882,1073,1226`; `orderStatus.ts:16-33`; `OrderTimeline.tsx:68-102`); FontAwesome in six files and inline SVG in the rest; three tab idioms on one page. Accent-border rule: compliant.

---

## D. Technical quality

### RC-D1 — Client transition table diverges from the server — HIGH

`VALID_TRANSITIONS` (`lib/hooks/useOrders.ts:504-514`) lacks `paid→processing`, `paid→shipped`, `processing→shipped`, `paid→delivered`, `shipped→delivered`; "Mark as Shipped" / "Mark as Delivered" in `OrderActions.tsx:224,232` throw "Invalid status transition" before any RPC. `revision_requested→submitted` is (correctly) absent but `DeliverySection` offers it (RC-C1.1). `OrderStatus` / `PaymentStatus` unions omit `expired`, which the DB tries to write; `Order` lacks `checkout_session_id`. The client duplicates the state machine and is wrong.

### RC-D2 — Duplication — MEDIUM

`useBuyerOrders` ≡ `useSellerOrders`; `useProductReviews` ≡ `useCommissionReviews`; `CheckoutPage.useOrderData` vs `useOrder`; slug loop and media upload duplicated between `useCommissions` and `useProducts`; `MetricCard` ×4; price formatting hand-rolled 20+ times despite `formatCurrency`; status maps ×5; step definitions ×2; accept/decline ×2; deliver/accept/revise ×2; brief form ×3; shipping form ×2; tag input ×2; review list ×2; delete-listing handler ×4; date formatting ×9; avatar fallback ×8; three auth-header styles and two JSON-parsing styles across hooks; `PLATFORM_FEE_RATE` duplicated as SQL literals.

### RC-D3 — Error handling — MEDIUM

Every mutation hook `setError` + returns null; no hook calls a toast; eight read hooks swallow errors entirely; `DeliverySection`, `ConfirmDeliveryCard`, `SellerDashboard` accept/decline and the pending branch of `OrderActions` never surface failures; raw Postgres text ("Cannot submit from status: paid") is what users see; `useDisputes` and `CheckoutPage` parse HTML error pages as JSON. No `actionToast.*` mapping exists for orders (contrast `actionToast.membershipError`).

### RC-D4 — Load behaviour — MEDIUM

`ORDER_SELECT` pulls `products.*`, all media, all pricing, keywords and two profiles per order row with `count: 'exact'` on every list; dashboard tabs client-filter one 20-row page (`BuyerDashboard.tsx:143-153`, `SellerOrdersTable.tsx:120-127`) so multi-status tabs show wrong contents; `hasMore` starts `true`; one `postgres_changes` channel per open order, per thread, and per seller dashboard with a full refetch on any change (contrary to the project rule of one `user-events` channel); `useSellerCustomers` aggregates all orders client-side; `checkSellerStatus` hits Stripe on every poll; `useUpdateOrderStatus` = 4 round trips; `useUpdateCommission` = ~12 serial writes, no transaction.

### RC-D5 — Tests — HIGH

One unit test (`useDeleteProduct`). The commissions e2e is env-gated and stale (targets `/commissions/orders/…`, "Mark Complete", "Status:" — none exist). Zero coverage for checkout, webhooks, promo, accept/decline, refunds, disputes, reviews, downloads, tracking, PWYW, the transition table, or any RPC. The RC-D1 breakage would have been caught by a 10-line test.

### RC-D6 — Dead code and objects — LOW

RPCs with no caller: `resolve_dispute`, `finalize_order_escrow_release`, `release_order_escrow`, `mark_order_payment_failed` (×2 overloads), `update_order_payment`, `update_purchase_as_seller/buyer`, `sync_seller_account`, `generate_order_download_tokens`, `submit_review`, `respond_to_review`, `reveal_expired_reviews`, `recalculate_seller_stats`, `auto_complete_digital_order` trigger. Tables: `product_purchases`, `reviews`, `seller_stats` (legacy). Routes: `/commissions/orders/[id]` redirect. Types: `ProductPurchase`, `PurchaseStatus`, `CreateCommissionOrderData` (carries `amount`, contradicting the server-computed model), `PromoCode`, three orphan return interfaces. `isPlaceholderPayments`, `useStudioQueue` alias, `OrderTracker.compact`, no-op `from-emerald-500 to-emerald-500` gradients. Memory/docs drift (PayPal files, `useGenerateDownloads`, `/commissions/orders`).

---

## Verdict on the payment architecture

The **pattern** — platform as merchant of record, Stripe Checkout on the platform account, Express accounts with `transfers`, separate transfers after completion — is the right pattern for a commission marketplace where work takes weeks and revisions and disputes are normal (it is what Fiverr-style escrow needs; manual capture's 7-day authorization window rules out the alternative). Keep it, subject to one check: the platform's Stripe account country must support transfers to the seller countries you intend to serve (RC-A6.5).

The **implementation** is fundamentally wrong in its trust model and should be rebuilt rather than patched:
- money moves on the strength of a mutable status column instead of a verified payment record (RC-A1, RC-A2);
- the hold, the release, the refund window and the dispute exit — the entire reason for the pattern — are missing or unwired (RC-A3);
- the webhook handles the happy path only (RC-A4);
- the schema the code runs against is not the schema in the repo and rejects the code's own writes (RC-A5).

`02-plan.md` proposes the rebuild.
