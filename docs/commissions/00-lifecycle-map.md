# Commissions — lifecycle map (as built)

Date: 2026-09-02. Read-only audit of `main` at `744de67` plus the **live** Supabase project `loaitxbibjftsytlgddi` (function bodies, policies, grants, constraints, row counts were pulled from the database, not inferred from migration files — the two diverge, see §9).

This document describes what happens today. It passes no judgement; that is `01-findings.md`.

## 0. Ground truth

**What a commission is.** There is no commissions table. A commission is a `products` row with `listing_type = 'service'`, its packages are `product_pricing` rows with `pricing_type = 'service_package'` (`package_tier` basic/standard/premium/custom, `delivery_days`, `revisions`, `package_features`, `price`, `min_price`), and free-form fields live in `products.service_metadata` (jsonb). Orders for products and commissions share one `orders` table, distinguished by `orders.listing_type`.

**Payment architecture.** Pinkquill is merchant of record. Every buyer pays the **platform's** Stripe account through an embedded Stripe Checkout Session (`mode: payment`, card captured immediately). Sellers have Stripe Connect **Express** accounts with the `transfers` capability only. The seller is paid later by a separate `stripe.transfers.create` of `orders.seller_amount` from the platform balance. "Escrow" is simply the money sitting in the platform balance until that transfer runs. Refunds are `stripe.refunds.create` (full amount only) preceded by a transfer reversal if the seller was already paid.

**Fee.** `platform_fee = 5% × item amount` (shipping excluded), computed once in `create_marketplace_order`. `seller_amount = amount − platform_fee`. Stripe's own processing fee is not modelled anywhere; the platform absorbs it.

**Production data at audit time.**

| Table | Rows |
|---|---|
| profiles | 10 |
| products | 3 (1 service, 1 product active, 1 archived) |
| orders | 2 (both `payment_provider = placeholder`, both `completed`) |
| seller_accounts | 2 (1 with `payouts_enabled`) |
| seller_profiles | 2 |
| transactions | 6 (2 payment, 2 platform_fee, 2 seller_payout pending) |
| order_reviews | 3 |
| disputes | 0 |
| promo_codes | 2 (both 100 % off, active, unlimited) |
| processed_stripe_events | 1 |

No real Stripe payment has ever been processed. The system is effectively pre-launch.

**Background automation.** `.github/workflows/marketplace-cron.yml` calls `POST /api/orders/auto-decline` every 10 min and `POST /api/orders/auto-complete` hourly with a bearer `CRON_SECRET`, against `APP_BASE_URL` (a repo secret). Whether the secrets are set is unverifiable from the repo; the production data (a completed order with `transfer_status IS NULL` and zero `transfer_failed` events) is consistent with the cron **not** running. There is no Vercel cron (`vercel.json` has only `regions`), no `pg_cron`.

## 1. The cast

| Actor | Where they act | What they can touch |
|---|---|---|
| **Buyer** | `/studio/[username]` (Commissions tab), `/commissions/[id]`, `/cart`, `/checkout/[orderId]`, `/checkout/[orderId]/complete`, `/orders`, `/orders/[id]` | `create_marketplace_order` (via API), `update_order_as_buyer` (completed / revision_requested / cancelled), `request_refund`, `open_dispute`, promo RPCs, `order_messages` insert, `order-files` upload, `submit_order_review` |
| **Seller** | `/sell/service` (create), `/seller/*` (dashboard, orders, listings, earnings, customers, settings, onboarding, setup), `/orders/[id]` (same page as buyer, role-switched) | direct writes to `products`/`product_pricing`/`product_media`/`product_keywords`/`seller_profiles`; `accept_order`, `decline_order`, `update_order_as_seller` (in_progress / submitted / processing / shipped / delivered / cancelled), `add_order_tracking`, `/api/payments/refund` approve/decline, `open_dispute`, `order_messages`, `order-files` upload, `/api/stripe/connect/*` |
| **Pinkquill (server)** | `/api/orders/create`, `/api/orders/update-draft`, `/api/checkout`, `/api/checkout/confirm`, `/api/checkout/status`, `/api/stripe/webhooks`, `/api/payments/refund`, `/api/orders/auto-complete`, `/api/orders/auto-decline`, `/api/orders/files`, `/api/orders/download`, `/api/stripe/connect/{onboard,status,dashboard}` | service-role RPCs: `finalize_order_payment`, `mark_order_expired`, `mark_order_payment_failed` (never called), `mark_order_transfer_completed`, `auto_complete_orders`, `auto_decline_expired_orders`, `reveal_due_reviews`, `resolve_dispute` (never called); direct admin writes to `orders`, `transactions`, `notifications`, `order_events`, `order_messages`, `seller_accounts` |
| **Stripe** | Checkout Session (platform account), PaymentIntent, Charge, Refund, Transfer, Transfer Reversal, Connect Express Account, Account Link, Login Link | Sends webhooks: `checkout.session.completed`, `checkout.session.expired`, `charge.refunded`, `account.updated` are handled; everything else is ignored |
| **DB triggers** | on `orders` | `notify_order_created`, `notify_order_status_change`, `set_auto_completion_deadline`, `auto_complete_digital_order`, `ensure_digital_download_tokens_trigger`, `restore_order_stock_on_early_exit`, `update_order_updated_at`; on `order_messages`: `notify_order_message`; on `reviews` (legacy): `notify_review_submitted` |

## 2. Step-by-step lifecycle

Each step: **Buyer sees / does**, **Seller sees / does**, **Pinkquill does** (screens → code → data → Stripe).

### Step 1 — Seller becomes a seller

- **Seller.** `/seller/*` layout gates on `seller_profiles.setup_completed`; first visit shows `SellerSetupWizard` (4 steps: store name/tagline/description, specialties/skills, `require_approval` + `auto_decline_hours`, review). Separately, `/seller/onboarding` (`SellerOnboarding`) shows Stripe status and a "Connect with Stripe" button.
- **Pinkquill.** Wizard writes `seller_profiles` directly from the client (`useSellerProfile.ts`, RLS `user_id = auth.uid()`). Onboarding: `POST /api/stripe/connect/onboard` → `StripeProvider.createSellerAccount` → `stripe.accounts.create({type:'express', capabilities:{transfers}})` → `seller_accounts` insert (`stripe_account_id`) → `stripe.accountLinks.create` → browser redirected to Stripe hosted onboarding → returns to `/seller/onboarding?success=true`. Status: `GET /api/stripe/connect/status` → `stripe.accounts.retrieve` on every call (5-min client cache) → updates `seller_accounts.onboarding_complete / charges_enabled / payouts_enabled / country`. Webhook `account.updated` does the same and, when `payouts_enabled` flips to true, retries any of that seller's orders with `transfer_status = 'pending_onboarding'`.
- **Stripe.** Express account under the platform; KYC handled by Stripe hosted flow; payouts from the connected account to the seller's bank on Stripe's default schedule for that account. Seller can open the Express dashboard via `POST /api/stripe/connect/dashboard` → `accounts.createLoginLink`.
- **Not gated.** Nothing stops a seller with no Stripe account from listing and selling; transfers just queue as `pending_onboarding`.

### Step 2 — Seller creates a commission listing

- **Seller.** Sidebar "Create → Add Service" → `/sell/service` → `CreateCommissionWizard` (4 steps: positioning (category/subcategory/title/headline/description), packages (up to 3 tiers: name, price, delivery days, revisions, features), portfolio & requirements (cover + gallery upload, buyer requirements text, FAQ, tags), review & publish). Edits go through `/seller/listings` → `EditListingPage` → same wizard.
- **Pinkquill.** `useCreateCommission` (client, direct table writes under RLS): insert `products` (`listing_type='service'`, `status='active'`, `service_metadata`), upload images to public bucket `product-images`, insert `product_media`, insert one `product_pricing` per package (`pricing_type='service_package'`, `min_price = price`, i.e. fixed-price; DB CHECK enforces `price ≥ 5` for service packages), insert `product_keywords`. Trigger `product_pricing_cache_trigger` refreshes `products.min_price/max_price/min_delivery_days/max_revisions`.
- **Stripe.** Nothing. No Stripe Product/Price objects; every checkout uses ad-hoc `price_data`.
- **Data that does not exist.** Slots/capacity, open/closed toggle per listing (only `products.status` and `seller_profiles.is_accepting_commissions`, and the latter is read by nothing in the order path), turnaround start rule, terms of service, extras/add-ons, custom-quote option, intake form schema (requirements is a free-text string).

### Step 3 — Buyer discovers a commission

- **Buyer.** Studio profile `/studio/[username]` → "Commissions" tab (`CommissionsTab`, rendered for every profile whether or not the user sells): a glass-gradient banner at the top (tagline or "Open for work", Quill score, "Taking orders Yes/No · Delivered projects · Reply time", skills chips — no actions), then sub-tabs Services / Reviews as Seller / (owner) Reviews as Buyer, an All/Active/Inactive filter, and a grid of service cards; owner sees "Add a service". Marketplace `/shop?section=commissions` (`MarketplacePageContent`) has a Commissions section with category / delivery-days / revisions filters and `CommissionMarketplaceCard`s.
- **Pinkquill.** Reads `products` + `product_pricing` + `product_media` via `useProducts`/`useMarketplace` (RLS: active or own). `get_seller_stats(seller_id)` (public) feeds rating summary.
- **Stripe.** Nothing.

### Step 4 — Buyer views a commission

- **Buyer.** `/commissions/[id]` → `CommissionDetailView`: gallery, headline, description, package comparison cards (price, delivery days, revisions, features), requirements, FAQ, `CommissionReviewsPanel`, seller card with `SellerRating`. Primary CTA "Hire Creator" opens an inline hire form: package select, brief (textarea), timeline/due date, notes. Secondary: add to Studio Cart (`useStudioCart`, localStorage).
- **Pinkquill.** Server component `app/commissions/[id]/page.tsx` does SEO/JSON-LD `Service`, redirects product-type listings to the product page. Client hook loads the product.
- **Stripe.** Nothing. No fee or total breakdown is shown at this stage; the price shown is the package price.

### Step 5 — Buyer requests (creates the order)

- **Buyer.** Submits the hire form ("Confirm & Start Order"). Or from `/cart` (`StudioQueuePage`) "Checkout" per item.
- **Pinkquill.** `useCreateOrder` → `POST /api/orders/create {product_id, pricing_id, brief, requirements:{notes}, due_date}` (same-origin check, auth, rate limit 30/min, product active + not own listing) → service-role RPC `create_marketplace_order(...)`:
  - locks `products` and `product_pricing` rows `FOR UPDATE`;
  - services: quantity forced to 1, no stock concept; PWYW rows accept `p_chosen_amount ≥ min_price`, fixed rows ignore it;
  - computes `amount`, `platform_fee` (5 % of item), `seller_amount`, `currency` (lower-cased pricing currency), `due_date = p_due_date ?? now() + delivery_days`, `max_revisions = pricing.revisions`;
  - reads `seller_profiles.require_approval` / `auto_decline_hours`; if approval required → `status = 'pending_acceptance'`, `seller_response_deadline = now() + hours`; else `status = 'pending_payment'`;
  - inserts `orders` (`payment_status='pending'`, `payment_provider='placeholder'`), an `order_events` row, a system `order_messages` row.
  - Trigger `notify_order_created` notifies the seller only for `pending_acceptance`.
- **Client routing.** `pending_acceptance` → `/orders/[id]` ("waiting for seller"); else → `/checkout/[id]`.
- **Stripe.** Nothing yet. No authorization hold; the order can sit in `pending_payment` indefinitely.

### Step 6 — Seller accepts or declines (only if `require_approval`)

- **Seller.** `/seller/dashboard` "Pending approval" section (`PendingOrderCard`: brief, package, deadline countdown, Accept / Decline with reason) or `/orders/[id]` `OrderActions` pending branch. Realtime `postgres_changes` on `orders` filtered by `seller_id` refreshes the list.
- **Buyer.** `/orders/[id]` shows status "Awaiting seller approval"; gets `order_accepted` / `order_declined` notification (trigger `notify_order_status_change`).
- **Pinkquill.** `accept_order` (RPC, `FOR UPDATE`, seller check) → `pending_payment`, `seller_accepted=true`, event + system message. `decline_order` → `declined`, `payment_status='failed'`, reason stored. Cron `auto_decline_expired_orders` (10 min) declines past-deadline orders. Trigger `restore_order_stock_on_early_exit` restores product stock on decline (services have none).
- **Stripe.** Nothing.
- **After acceptance** the buyer must come back and pay; there is no payment deadline, reminder, or expiry for an accepted-but-unpaid order.

### Step 7 — Buyer pays

- **Buyer.** `/checkout/[orderId]` (`CheckoutPage`, 1,350 lines): order summary (title, package, brief for services), promo code input, order-note field, price rows (subtotal, discount, shipping for physical, "Platform fee (5 %)" line showing `order.platform_fee`, total). Turnstile widget when `requiresSecurityCheck`. Then embedded Stripe Checkout (`<EmbeddedCheckout>` from `@stripe/react-stripe-js`) renders inline. For a $0 total (100 % promo, PWYW $0) a "Confirm free order" panel appears instead.
- **Pinkquill.**
  1. Page auto-calls `POST /api/checkout {order_id, turnstile_token}` as soon as the order is `pending_payment` (and shipping is complete for physical). Server: auth, rate limit 10/min, Turnstile verify, buyer check, status check, **re-validates `order.amount` against the current `product_pricing` row** (PWYW ≥ min, fixed = exact, promo discount and shipping netted out; 409 "recreate your order" on mismatch), then `StripeProvider.createCheckoutSession`: if `orders.checkout_session_id` points at an `open` session it is reused; if `complete`, returns "Payment already completed"; otherwise creates a new session with one ad-hoc line item for `amount` in `currency`, metadata `{order_id, order_number, buyer_id, listing_type}` on both session and PaymentIntent, `statement_descriptor_suffix` from the order number, `customer_email`, `return_url = /checkout/[id]/complete?session_id={CHECKOUT_SESSION_ID}`. Persists `payment_provider='stripe'`, `payment_reference` and `checkout_session_id` = session id, `payment_status='pending'`.
  2. Promo: `validate_promo_code(code, amount, listing_type)` (preview) then `apply_promo_to_order(order_id, promo_id)` (authoritative; recomputes amount/fee/seller_amount; `remove_promo_from_order` restores amount only). Applying a promo changes `order` state → the checkout effect creates another session.
  3. Free orders: `POST /api/checkout/confirm` → server allows only `amount ≤ 0` in Stripe mode → `finalize_order_payment(provider='placeholder')` → immediately `transferToSeller` (seller_amount 0 → throws, swallowed).
- **Stripe.** Buyer enters card in the embedded Checkout. On success Stripe redirects to `return_url` and emits `checkout.session.completed` (and `payment_intent.succeeded`, `charge.succeeded`, which are ignored). On card decline, Checkout shows the error inline and emits `payment_intent.payment_failed` (ignored). If the buyer leaves, the session expires after 24 h → `checkout.session.expired`.

### Step 8 — Payment confirmation

- **Buyer.** `/checkout/[orderId]/complete` polls `GET /api/checkout/status?session_id=` every 2 s up to 10 times; shows "Payment Successful!" when the **Stripe session** reports `complete`/`paid` (not when the DB order is paid), then redirects to `/orders/[id]` after 2 s. "Payment Failed — no charges were made" if polling gives up; "Checkout Expired" on `expired`.
- **Seller.** Notification `order_paid` (twice: once from the webhook insert, once from the trigger) and the order appears under Active in `/seller/orders`.
- **Pinkquill (webhook `checkout.session.completed`).** Verify signature → claim `processed_stripe_events.event_id` (unique; duplicate → 200 `already_processed`) → load order by `metadata.order_id` → compare `session.amount_total/100` to `orders.amount` (mismatch → tries to log `order_events.event_type='amount_mismatch'`, which the CHECK constraint rejects, returns 200; order stays `pending_payment`) → `finalize_order_payment(provider='stripe', reference=session.id)`:
  - `FOR UPDATE`; if not `pending_payment` → `already_processed`;
  - physical products require `shipping_address`;
  - sets `status = 'paid'` (services, physical) or `'delivered'` (digital product), `payment_status='paid'`, `payment_provider='stripe'`, `checkout_session_id`;
  - inserts 3 `transactions`: `payment` completed, `platform_fee` completed, `seller_payout` pending;
  - inserts `order_events` (`payment_confirmed`) + system message.
  - Then the webhook inserts two `notifications` rows itself (seller + buyer `order_paid`), and for **digital products** immediately `transferToSeller`. Triggers: `notify_order_status_change` (seller `order_paid`), `set_auto_completion_deadline` (only for submitted/delivered), `ensure_digital_download_tokens_trigger` (digital).
  - Any thrown error → delete the idempotency marker → 500 → Stripe retries.
- **Stripe.** Funds land in the platform balance (available after Stripe's payout delay for the platform's country). `payment_intent_id` is **not** stored; refunds later re-fetch it from the Checkout Session.

### Step 9 — Work in progress

- **Seller.** `/orders/[id]` → `OrderActions` "Start Work" → `in_progress`. `OrderMessages` thread (text + file attachments uploaded to private `order-files` bucket at `orders/<id>/...`, read via 5-min signed URLs from `POST /api/orders/files`). `OrderTimeline` (events) and `OrderTracker` (stepper: commission 6 steps).
- **Buyer.** Same page, buyer role: status chip, tracker, messages, "Request refund" (allowed by RPC from `paid`/`completed`/`delivered` only), "Open dispute" (`DisputeModal`).
- **Pinkquill.** `update_order_as_seller('in_progress')` (no `FOR UPDATE`), event + system message, trigger notifies buyer `order_started`. Messages: direct client insert into `order_messages` (RLS participants) → trigger `notify_order_message`. Realtime: one `postgres_changes` channel per open order and per message thread.
- **Stripe.** Nothing. Money is in the platform balance; `transactions.seller_payout` is `pending`.
- **Due date.** `orders.due_date` is stored; nothing acts on it (no late warnings, no auto-extension, no cancellation right).

### Step 10 — Delivery

- **Seller.** Two delivery UIs render at once on a service order: `OrderActions` "Submit Delivery" (note textarea → `update_order_as_seller('submitted', delivery_note)`), and `DeliverySection` (file picker → uploads to `order-files` → posts a message with attachments → `update_order_as_seller('submitted')` **without** note or assets). `delivery_assets` is never populated by either UI.
- **Buyer.** Notification `order_delivered`; page shows delivered files (from the message attachments, not `delivery_assets`), "Accept Delivery" and "Request Revision" (disabled when `revision_count ≥ max_revisions`), plus `AutoCompletionNotice` countdown.
- **Pinkquill.** `submitted` → trigger `set_auto_completion_deadline` sets `auto_completion_at = now() + 3 days`. For physical products the parallel path is `add_order_tracking` → `shipped` → `delivered` → `confirm_order_delivery`; for digital products delivery happened at payment (download tokens via `consume_download_token` + `POST /api/orders/download`, 5-min signed URLs from private `product-files`).
- **Stripe.** Nothing.

### Step 11 — Revisions

- **Buyer.** "Request Revision" → `update_order_as_buyer('revision_requested')`: allowed only from `submitted`, increments `revision_count`, rejects when `≥ max_revisions`. Trigger notifies seller `revision_requested`; auto-completion deadline cleared.
- **Seller.** "Start Revision" → `in_progress` → later "Submit Delivery" again.
- **Pinkquill.** No structured revision notes (the request is just a status change + optional message); no paid extra revisions; no per-revision deadline.
- **Stripe.** Nothing.

### Step 12 — Completion

- **Buyer.** "Accept Delivery" → `update_order_as_buyer('completed')` → `completed_at`. Or nothing: cron `auto_complete_orders` completes `submitted`/`delivered` orders 3 days after delivery (live body inserts an `order_messages` row without `sender_id` → NOT NULL violation → the RPC aborts on the first due order).
- **Seller.** Notification `order_completed`; order moves to Completed tab; earnings (`get_seller_earnings`) count `seller_amount` as `total_earned` from this moment, regardless of whether the transfer happened.
- **Pinkquill.** Trigger clears `auto_completion_at`. Review window opens (`OrderReviewSection` when `status === 'completed'`).
- **Stripe.** Still nothing at this instant. The transfer happens in the next hourly cron (Step 13).

### Step 13 — Seller payout

- **Seller.** `/seller/earnings` (`EarningsOverview`: total earned, pending, transaction list from `transactions`), "Open Stripe dashboard" button. No in-app payout schedule, no statement, no per-order "paid out on" date beyond `orders.transfer_id/transfer_status`.
- **Pinkquill.** Hourly `POST /api/orders/auto-complete` (after `auto_complete_orders` and `reveal_due_reviews`): selects up to 50 `orders` with `status='completed' AND transfer_status IS NULL AND payment_status='paid'` (no check of `payment_provider`, `checkout_session_id`, or a `transactions.payment` row) → `StripeProvider.transferToSeller`:
  - already `transfer_id` → skip;
  - `seller_accounts.stripe_account_id` missing or `payouts_enabled = false` → `transfer_status = 'pending_onboarding'` (retried on `account.updated`);
  - validates `0 < seller_amount ≤ amount`;
  - `stripe.transfers.create({amount: seller_amount cents, currency: order.currency, destination, transfer_group: order id}, {idempotencyKey: transfer_<orderId>})`;
  - `mark_order_transfer_completed` (`FOR UPDATE`; sets `transfer_id/status/amount`, flips `seller_payout` transaction to completed, event).
  - Failure → tries to insert `order_events 'transfer_failed'` and `notifications 'order_transfer_failed'` (both rejected by CHECK constraints, silently) → retried every hour forever.
  - Digital products: transferred synchronously inside the `checkout.session.completed` webhook instead.
- **Stripe.** Transfer moves `seller_amount` from platform balance to the connected account balance; Stripe pays the connected account out to the seller's bank on that account's payout schedule. Platform keeps `amount − seller_amount` minus Stripe's processing fee. `escrow_released` is never set by any path.

### Step 14 — Reviews

- **Buyer / Seller.** Both can review after `completed` (`ReviewForm` → `submit_order_review`: quill score 1–5, title, content, highlights). Blind reveal: hidden until both reviewed or `reveal_deadline` passes (`reveal_due_reviews` in the hourly cron). Shown on the listing (`CommissionReviewsPanel`) and seller card (`get_seller_stats`).
- **Pinkquill.** `order_reviews` table; the legacy `reviews` table + `submit_review` RPC still exist and are callable but unused.

### Step 15 — Cancellation

- **Before payment.** Buyer or seller "Cancel" in `OrderActions` (only shown for `pending_payment`) → `update_order_as_buyer/seller('cancelled')`. Stock restored for products. Stripe: nothing (session left open until expiry).
- **After payment.** The UI hides the button, but both RPCs accept `'cancelled'` from `paid`: status becomes `cancelled`, `payment_status` stays `paid`, no refund is issued, and neither `request_refund` (rejects `cancelled`) nor the seller approve path (approvable list excludes `cancelled`) can return the money.
- **Abandoned checkout.** `checkout.session.expired` → `mark_order_expired` writes `status='expired'`/`payment_status='expired'`, both rejected by the live CHECK constraints → RPC throws → webhook 500 → Stripe retries for 3 days; order stays `pending_payment`.

### Step 16 — Refunds

- **Buyer.** "Request Refund" (+ reason) on `paid`/`completed`/`delivered` → `POST /api/payments/refund {action:'request'}` → user-context RPC `request_refund` → `refund_requested`; seller notified; auto-completion cleared. The escrow guard in the RPC (`escrow_released`) never fires because the column is never set, so a refund can be requested after the seller has been transferred.
- **Seller.** `OrderActions` refund-requested branch: Approve → `POST /api/payments/refund {action:'approve'}` → `StripeProvider.refundPayment`: fetch PaymentIntent from the Checkout Session → if `transfer_id`, `transfers.createReversal` (failure halts with "needs manual review") → `refunds.create` (full, `idempotencyKey: refund_<orderId>`) → admin write `status='refunded'`, `payment_status='refunded'`. Decline → restores the previous status from `order_events`. Seller can also approve a refund proactively on `paid/in_progress/submitted/shipped/completed/delivered`.
- **Pinkquill (webhook `charge.refunded`).** Finds the order via PaymentIntent metadata, reverses the transfer if not yet reversed, writes `payment_status = refunded | partially_refunded` (status → `refunded` only when full), updates/creates the `refund` transaction row, event, system message, notifications to both. Partial refunds (only possible from the Stripe dashboard) do not adjust `seller_amount` or reverse part of the transfer.
- **Stripe.** Refund returns the buyer's money in 5–10 days; Stripe keeps its processing fee; a reversal pulls `seller_amount` back from the connected account (fails if already paid out and balance is insufficient).

### Step 17 — Disputes

- **Either party.** `DisputeModal` → `open_dispute(reason, description)` from any status except `pending_payment/cancelled/refunded/disputed/resolved` (so also from `pending_acceptance`/`declined`) → `disputes` row, `status = 'disputed'`, auto-completion cleared, other party notified. `DisputeBanner` on the order page polls on focus.
- **Pinkquill.** `resolve_dispute` (full_refund / partial_refund / release_to_seller / order_cancelled / mutual_agreement) exists, is service-role only, and **has no caller** — no admin page, no API route. `disputed` is therefore terminal. `disputes.order_id` is UNIQUE (one dispute per order ever).
- **Stripe chargebacks.** `charge.dispute.created/closed` are not handled. A bank dispute is invisible to the app; the order stays in whatever status it had; the seller's transfer is not reversed; the platform pays the dispute fee.

## 3. Order status machine (live)

```
create ──► pending_acceptance ──accept──► pending_payment ──finalize (webhook/confirm)──► paid ──► in_progress ──► submitted ──► completed
              │                              │                                             │            ▲              │  ▲
              └─decline/auto_decline──► declined                                           │            └─revision──────┘  │
                                             ├─cancel──► cancelled                         ├─cancel──► cancelled (paid, no refund)
                                             └─expire──► ✗ (CHECK violation)               ├─processing ─► shipped ─► delivered ─► completed
                                                                                            └─request_refund ──► refund_requested ──approve──► refunded
                                                                                                                                  └──decline──► (restored)
any post-payment ──open_dispute──► disputed ──(resolve_dispute, no caller)──► resolved | refunded | cancelled
completed ──cron transfer──► (transfer_status = completed; status unchanged)
digital product: pending_payment ──finalize──► delivered ──accept/auto──► completed
```

`payment_status`: `pending → paid → refunded | partially_refunded`; `failed` on decline; `authorized` exists in the CHECK but is never written; `expired` is written but not allowed.

## 4. Money flow

```
Buyer card ──Stripe Checkout (platform acct)──► Platform Stripe balance            [amount]
                                                   │  − Stripe processing fee      (not modelled)
                                                   ├──transfers.create────────────► Seller Connect balance ──payout──► Seller bank   [seller_amount = amount − 5% item]
                                                   └──(remainder)                  Platform keeps platform_fee − Stripe fee
Refund: transfers.createReversal (seller_amount back) then refunds.create (amount to buyer). Stripe fee not returned.
```

Ledger: `transactions` rows per order — `payment` (completed at finalize), `platform_fee` (completed at finalize), `seller_payout` (pending → completed at transfer), `refund` (completed by webhook). Rows are updated in place.

## 5. Notifications emitted (order types)

| Trigger point | Type | Recipient | Source |
|---|---|---|---|
| order created needing approval | order_pending_acceptance | seller | trigger `notify_order_created` |
| accept / decline | order_accepted / order_declined | buyer | trigger `notify_order_status_change` |
| payment finalized | order_paid | seller (×2), buyer | trigger + webhook direct inserts |
| in_progress | order_started | buyer | trigger |
| submitted / shipped / delivered | order_delivered | buyer | trigger |
| revision_requested | revision_requested | seller | trigger |
| completed | order_completed | seller (+ both on auto-complete) | trigger / RPC |
| cancelled | order_cancelled | other party | trigger |
| refund_requested | refund_requested | seller | RPC + trigger |
| refunded | order_refunded | buyer (×2), seller | webhook + trigger |
| refund declined | refund_declined | buyer | route |
| disputed / resolved | order_disputed / dispute_resolved | other party / both | RPC + trigger |
| new message | order_message | other party | trigger `notify_order_message` |
| transfer failed | order_transfer_failed | seller | **rejected by CHECK** |

Delivery channel: in-app only (`notifications` table + the per-user realtime broadcast). No email for any order event (Stripe's own receipt email only if enabled in the Stripe dashboard).

## 6. Stripe objects and events, end to end

| Stripe object / event | Created / handled by | Notes |
|---|---|---|
| Account (Express, transfers) | `createSellerAccount` | one per seller; duplicate creation possible if `seller_accounts` insert races |
| AccountLink | `createSellerAccount` | refresh/return to `/seller/onboarding` |
| LoginLink | `getSellerDashboardUrl` | |
| Checkout Session (embedded, payment) | `createCheckoutSession` | reused while `open`; new one per checkout page effect run |
| PaymentIntent / Charge | Stripe | id not persisted; metadata `order_id` used by `charge.refunded` |
| Transfer | `transferToSeller` | idempotency `transfer_<orderId>`; `transfer_group = orderId` |
| Transfer Reversal | `refundPayment`, webhook | idempotency `reversal_<orderId>` |
| Refund | `refundPayment` | full only; idempotency `refund_<orderId>` |
| `checkout.session.completed` | webhook | finalize + notify + (digital) transfer; does not check `payment_status === 'paid'` |
| `checkout.session.expired` | webhook | `mark_order_expired` (fails on CHECK) |
| `charge.refunded` | webhook | ledger + status + notifications |
| `account.updated` | webhook | sync flags; retry `pending_onboarding` transfers |
| `payment_intent.payment_failed`, `checkout.session.async_payment_*`, `charge.dispute.*`, `transfer.reversed`, `payout.failed`, `account.application.deauthorized` | **not handled** | |

Webhook idempotency: `processed_stripe_events` unique claim before processing; marker deleted on thrown error so Stripe's retry reprocesses.

## 7. Where each piece of code lives

| Concern | Files |
|---|---|
| Provider abstraction | `lib/payment-provider.ts`, `lib/payments.ts` (`PLATFORM_FEE_RATE`), `lib/payments-server.ts` (RPC wrappers), `lib/stripe.ts`, `lib/stripe-client.ts` |
| Stripe implementation | `lib/providers/stripe-provider.ts` (491 lines); `lib/providers/placeholder-provider.ts` (dev/free) |
| API routes | `app/api/orders/{create,update-draft,auto-complete,auto-decline,files,download}/route.ts`, `app/api/checkout/{route,confirm,status}.ts`, `app/api/payments/refund/route.ts`, `app/api/stripe/webhooks/route.ts`, `app/api/stripe/connect/{onboard,status,dashboard}/route.ts`, `app/api/listings/delete/route.ts` |
| Security helpers | `lib/api-security.ts` (same-origin, DB-backed rate limit, cron secret), `lib/turnstile-server.ts` |
| Hooks | `lib/hooks/useOrders.ts` (995), `useCommissions.ts` (541), `usePayments.ts`, `useDisputes.ts`, `useReviews.ts`, `useSellerProfile.ts`, `useSellerCustomers.ts`, `useStudioQueue.ts`, `usePromoCode.ts`, `useShipping.ts`, `useDownloads.ts`, `useOrderFiles.ts`, `useProducts.ts` (service parts) |
| Types | `lib/types/store.ts` (912), `lib/commissions/categories.ts` |
| Buyer screens | `components/commissions/CommissionsTab.tsx`, `CommissionDetail/CommissionDetailView.tsx`, `CommissionReviewsPanel.tsx`, `components/checkout/CheckoutPage.tsx` (1,350), `app/(feed)/checkout/[orderId]/complete/page.tsx`, `components/orders/*` (OrderView 910, OrderActions 478, BuyerDashboard, OrderCard, OrderTracker, OrderTimeline, OrderMessages, DeliverySection, DisputeModal, DigitalDownload*, ShippingTracker, TrackingInput), `components/queue/StudioQueuePage.tsx` |
| Seller screens | `components/commissions/CreateCommission/CreateCommissionWizard.tsx` (1,285), `components/seller/*` (SellerDashboard, SellerOrdersTable, PendingOrderCard, SellerListingsGrid, EditListingPage, SellerSettings, SellerSetupWizard, SellerOnboarding, EarningsOverview, CustomersCRM, SellerSidebar), `app/seller/*` |
| Profile surface | `components/studio/StudioProfile.tsx` (2,888; commissions banner + tab wiring), `components/store/StoreTab.tsx` |
| DB | `supabase/migrations/2026020{2,8,9}_*`, `20260210_*`, `20260212_marketplace_alignment.sql`, `20260214_quill_reviews.sql`, `20260215_*`, `20260310_*`, `20260511_*`, `20260621_phase0/1/1b/4_*`, `20260902_phase3/4/5/6_*` — plus ~15 live-only functions and 2 live-only tables with no repo source |
| Automation | `.github/workflows/marketplace-cron.yml` |
| Tests | `lib/hooks/__tests__/useProducts.test.ts` (delete only), `e2e/commissions-journey.spec.ts` (env-gated, stale) |

## 8. Environment

`PAYMENTS_PROVIDER` / `NEXT_PUBLIC_PAYMENTS_PROVIDER` (`stripe` | `placeholder`; placeholder refused in production), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `CRON_SECRET`, `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL` (Stripe return URLs; falls back to localhost outside production). The local `.env.local` currently holds **live** Stripe keys (`sk_live…`, `pk_live…`) with `PAYMENTS_PROVIDER=stripe`.

## 9. Repo vs. production drift (why the map was built from the live DB)

- ~15 live functions (`create_order_notification`, `notify_order_status_change`, `set_auto_completion_deadline`, `auto_complete_digital_order`, `release_order_escrow`, `mark_order_transfer_completed`, `sync_seller_account`, `update_order_payment`, `recalculate_seller_stats`, `submit_review`, `respond_to_review`, `reveal_expired_reviews`, …), 2 tables (`reviews`, `seller_stats`), and the `order-files` bucket have no migration file in the repo.
- `20260331_comprehensive_fixes.sql` and the money half of `20260310_security_hardening_review.sql` were never applied.
- Live bodies of `update_order_as_buyer/seller`, `open_dispute`, `auto_complete_orders`, `get_seller_earnings`, `finalize_order_payment` differ from the repo's latest versions (e.g. live allows cancel from `paid`; repo does not).
- `orders.payment_provider` defaults to `'paypal'` live; PayPal code no longer exists.

Full table/policy/function/grant inventory: see the audit scratch notes summarised in `01-findings.md` §D and the live catalog queries recorded there.
