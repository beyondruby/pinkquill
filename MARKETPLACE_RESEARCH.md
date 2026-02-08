# Pinkquill Marketplace: Platform Commerce Research & Analysis

> Compiled analysis of commerce patterns from major e-commerce and freelance marketplace platforms, tailored for a creative marketplace serving artists, poets, writers, and creators.

---

## Table of Contents

1. [Platform-by-Platform Analysis](#1-platform-by-platform-analysis)
   - [Fiverr](#11-fiverr)
   - [Upwork](#12-upwork)
   - [Etsy](#13-etsy)
   - [Amazon](#14-amazon)
   - [Gumroad](#15-gumroad)
   - [Stripe Connect](#16-stripe-connect)
2. [Cross-Platform Pattern Analysis](#2-cross-platform-pattern-analysis)
3. [Recommendations for Pinkquill](#3-recommendations-for-pinkquill)

---

## 1. Platform-by-Platform Analysis

---

### 1.1 Fiverr

**Model**: Service/commission marketplace (closest to Pinkquill's creative commissions use case)

#### Gig Packages (Tiered Pricing)

Sellers offer three package tiers per gig:

| Tier | Purpose | Example (for a poet/writer) |
|------|---------|----------------------------|
| **Basic** | Entry-level deliverable, minimal scope | Short poem (up to 14 lines), 3-day delivery, 1 revision |
| **Standard** | Mid-range, more features/scope | Full poem with custom theme, 5-day delivery, 2 revisions |
| **Premium** | Full-service, maximum value | Collection of 3 poems, handwritten calligraphy scan, 7-day delivery, unlimited revisions |

Each tier specifies: price, delivery time, number of revisions, and optional gig extras (add-ons).

**Key insight for Pinkquill**: Tiered packages let creators standardize their offerings while giving buyers clear expectations. This reduces pre-purchase negotiation friction.

#### Order Lifecycle

```
Browse/Discovery
    |
    v
Purchase (buyer pays upfront)
    |
    v
Requirements Submission (buyer fills out brief/specifications)
    |
    v
In Progress (seller works on deliverable)
    |                    |
    v                    v
Delivery            [Messaging available throughout]
    |
    +---> Accept (buyer approves) ---> Order Complete
    |
    +---> Request Revision ---> In Revision ---> Re-delivery ---> [loop]
    |
    +---> No response (3 days) ---> Auto-Complete
    |
    +---> Extend Review Period (up to 5 additional days)
    |
    v
Review/Rating (both parties rate each other)
    |
    v
14-day safety clearance ---> Funds released to seller
```

**Statuses**: Requirements Needed -> In Progress -> Delivered -> In Revision -> Complete

**Key details**:
- Buyer has 3 days to review delivery before auto-completion
- Revisions loop back to "In Progress" state
- 14-day grace period after completion for dispute filing (7 days for Top Rated Sellers)
- Both buyer and seller leave reviews after completion

#### Messaging & Communication

- In-order messaging available throughout the entire order lifecycle
- Pre-purchase messaging (buyer can contact seller before ordering)
- File attachment support in messages
- Quick response time tracked as a seller metric

#### Seller Levels & Verification

**Level system based on 6 performance metrics and a "Success Score"**:

| Level | Requirements | Benefits |
|-------|-------------|----------|
| **New Seller** | Just joined | Basic visibility |
| **Level 1** | Consistent quality + completion rate | Better search ranking |
| **Level 2** | Higher volume + sustained metrics | Priority support, more gig extras |
| **Top Rated** | Exceptional long-term performance | 7-day clearance (vs 14), VIP support |
| **Fiverr Pro** | Hand-vetted, best-in-class | Maximum visibility, Pro badge, premium clients |

**Verification**: Identity verification required (personal ID, sometimes video verification).

**Success Score** evaluates: client satisfaction, communication quality, delivery timeliness, completion rate, and order volume.

#### Resolution Center & Disputes

- Structured communication system between buyer and seller
- **Seller options**: Offer partial refund, request order cancellation
- **Buyer options**: Request order update, ask seller to cancel
- Fiverr Customer Support mediates if parties cannot resolve independently
- Cancellations affect seller's completion rate metric

#### Payment Flow

```
Buyer pays full amount + 5.5% service fee
    |
    v
Funds held in ESCROW by Fiverr
    |
    v
Order completed (buyer accepts or auto-complete after 3 days)
    |
    v
14-day safety clearance period
    |
    v
Funds released to seller's Fiverr balance (minus 20% commission)
    |
    v
Seller withdraws via PayPal / Payoneer / Bank Transfer / Direct Deposit (US)
```

**Fee structure**:
- Buyer: 5.5% service fee (minimum $2 for orders under $50)
- Seller: 20% commission on every order (additional 5% on orders above $500)
- Withdrawal fees: $0 (PayPal) to $3 (international bank transfer)
- Min withdrawal: $1 (PayPal) to $30 (Payoneer)
- Instant clearance option: 1% fee to skip the 14-day waiting period

#### Seller Earnings Dashboard

- **Earnings overview**: Cleared payments, pending earnings, monthly totals
- **Cashflow view**: Net amount available to withdraw (earnings minus expenses)
- **Analytics**: Revenue trends, average selling price, active orders, cancellation cost
- **Visual statistics**: Charts showing sales over time, strengths, and opportunities
- Withdrawal limit: $5,000 per transaction, once every 24 hours

---

### 1.2 Upwork

**Model**: Freelance marketplace with both fixed-price and hourly contracts

#### Contract Types

| Type | How it works | Best for |
|------|-------------|----------|
| **Fixed-Price** | Set total price, paid in milestones | Defined deliverables (write a story, design a cover) |
| **Hourly** | Track time, billed weekly | Ongoing work (editing, consulting, collaboration) |

#### Milestone-Based Payments (Fixed-Price)

```
Client creates contract with milestone breakdown
    |
    v
Client funds first milestone (deposited into "Project Funds" / escrow)
    |
    v
Freelancer sees "Funded" label and begins work
    |
    v
Freelancer clicks "Submit Work for Payment"
    |
    v
14-day review period begins
    |
    +---> Client approves ---> Payment released
    |
    +---> Client requests changes ---> Freelancer revises and resubmits
    |
    +---> No response (14 days) ---> Payment auto-released
    |
    v
Next milestone funded and process repeats
```

**Key detail**: The minimum project rate is $5.00 USD. Freelancers should always check for the "Funded" label before starting work to ensure payment protection applies.

#### Hourly Contracts

```
Freelancer logs hours (Monday-Sunday, UTC)
    |
    v
Hours billed automatically every Monday
    |
    v
Client has until Friday to review and dispute
    |
    v
Payment released
```

**Work Diary**: Hourly contracts include optional screenshot-based time tracking for verification.

#### Escrow System ("Project Funds")

- Acts as neutral holding place for client payments
- Protects freelancers: money is set aside before work begins
- Protects clients: payment only released on approval or after review period
- **Fixed-Price Payment Protection** requires: (a) milestone was funded before work began, and (b) freelancer used the "Submit Work for Payment" button

#### Connects System (Bidding Credits)

- Freelancers spend "Connects" to submit proposals/bids
- Different jobs require different amounts (e.g., 7-11 Connects per proposal)
- Free accounts get up to 10 free Connects per month (no guarantee)
- Additional Connects cost $0.15 each
- Badges (Rising Talent, Top Rated, Top Rated Plus) grant 30 bonus Connects each
- **Purpose**: Prevents spam bidding, ensures serious proposals

#### Reviews & Ratings

- Mutual review system (client and freelancer rate each other)
- Ratings on: quality, communication, expertise, professionalism, hiring experience
- Reviews visible on profiles
- Job Success Score (JSS) calculated from multiple signals beyond just reviews

#### Dispute Resolution

- Structured dispute process for both fixed-price and hourly contracts
- For fixed-price: freelancer can file dispute if client does not release funded milestone
- For hourly: client can dispute hours within the weekly review window
- Upwork mediation available as escalation path
- **Note**: "Any Hire" contracts (off-platform) do NOT include payment protection or dispute resolution

#### Fee Structure

**Freelancer fees** (as of May 2025):
- Variable fee: 0-15% (determined by supply/demand, skill category, market conditions)
- Average effective rate: 12-13%
- Replaced previous tiered model (20%/10%/5%)

**Client fees**:
- Marketplace Plan: 3-5% on all payments
- Business Plus Plan: 8-10% on all payments
- Contract Initiation Fee: $0.99-$14.99 per new contract

---

### 1.3 Etsy

**Model**: Creative product marketplace (physical + digital products)

#### Product Types

| Type | Delivery | Key Features |
|------|----------|-------------|
| **Physical products** | Shipped to buyer | Shipping labels, tracking, processing time |
| **Digital downloads** | Instant delivery | Up to 5 files per listing (20MB each), auto-delivered |
| **Custom/made-to-order** | Seller fulfills after personalization | Custom fields on listing, processing time |

#### Digital Download Delivery

```
Seller uploads files when creating listing (up to 5 files, 20MB each)
    |
    v
Buyer purchases listing
    |
    v
Files instantly available via:
    - Email receipt with download link
    - "Purchases and Reviews" section in buyer's account
    |
    v
Buyer downloads files (PDF, JPG, PNG, ZIP, etc.)
```

**Key insight for Pinkquill**: Completely automated and hands-free after listing creation. No seller action needed per sale. This is ideal for digital art, poetry PDFs, story collections, etc.

#### Shop Customization

- Custom shop banner and icon
- Shop sections for organizing products
- "About" section with seller story
- Featured listings
- Shop policies (returns, exchanges, shipping)
- Custom order requests

#### Review System

- 1-5 star rating system
- Written reviews with optional photos
- Sellers can respond to reviews publicly
- Reviews are a core ranking factor in Etsy search
- Star Seller badge heavily incentivizes 5-star ratings

#### Star Seller Program

**Qualification criteria** (evaluated monthly, based on 3-month rolling window):
- Respond to first message on a thread within 24 hours
- Ship orders within stated processing time with tracking
- Maintain high 5-star rating percentage
- Minimum 5 orders totaling $300+ in the review period

**Benefits**:
- Star Seller badge displayed on shop and listings
- Improved search visibility
- Featured in Etsy marketing to buyers
- Digital orders exempt from tracking requirement

#### Fee Structure

| Fee | Amount | When |
|-----|--------|------|
| **Listing fee** | $0.20 per listing | On publish and auto-renewal |
| **Transaction fee** | 6.5% of sale price + shipping | Per sale |
| **Payment processing** | 3% + $0.25 (US) | Per transaction |
| **Offsite Ads fee** | 12-15% | Mandatory for sellers earning $10,000+/year |

**Total effective take rate**: ~20-25% on a typical sale (all fees combined).

**Digital product specifics**: Listing auto-renews after each sale (another $0.20 fee), no shipping fees apply.

#### Payment System (Etsy Payments)

- Integrated payment processing (buyers pay via credit card, PayPal, Apple Pay, Google Pay, Etsy gift cards)
- Funds deposited to seller's bank account on a regular schedule
- Etsy handles sales tax collection and remittance in most US states
- Currency conversion available for international sales

---

### 1.4 Amazon

**Model**: General e-commerce marketplace with seller fulfillment or FBA

#### Order Lifecycle

```
Buyer browses/searches
    |
    v
Add to cart / Buy now
    |
    v
Checkout (payment processed)
    |
    v
Order Status: PENDING (payment verification)
    |
    v
Order Status: UNSHIPPED (ready for fulfillment)
    |
    v
Seller ships / Amazon fulfills (FBA)
    |
    v
Order Status: SHIPPED (tracking number provided)
    |
    v
Delivery confirmed
    |
    v
30-day return window (90 days for baby items, extended for holidays)
    |
    v
Review period (buyer can leave 1-5 star review at any time)
```

#### A-to-Z Guarantee

Amazon's buyer protection program:

- **Trigger**: Buyer files claim when they cannot resolve issue directly with seller
- **Coverage**: Full refund if item not delivered, arrives damaged, or not as described
- **Seller impact**: Claims count toward Order Defect Rate (ODR)
- **Seller response**: Must respond to claims within specific timeframe
- **Threshold**: ODR must stay below 1% for "Healthy" account status

**Key insight for Pinkquill**: A buyer guarantee program builds massive buyer trust. Even if rarely used, its existence encourages purchases.

#### Seller Dashboard Metrics

| Metric | Target | Description |
|--------|--------|-------------|
| **Order Defect Rate (ODR)** | < 1% | Negative feedback + A-to-Z claims + chargebacks |
| **Late Shipment Rate** | < 4% | Orders shipped after expected date |
| **Pre-fulfillment Cancel Rate** | < 2.5% | Orders cancelled before shipping |
| **Valid Tracking Rate** | > 95% | Orders with working tracking numbers |
| **On-time Delivery Rate** | Target varies | Orders delivered within promised window |

**Key insight for Pinkquill**: Tracking seller performance metrics creates accountability and helps surface high-quality sellers.

#### Return & Refund Policy

- 30-day standard return window
- Seller-funded return shipping labels in many cases
- Automatic refund processing for FBA items
- "Returnless refunds" for low-value items (cheaper than processing return)

---

### 1.5 Gumroad

**Model**: Simple digital product sales for creators

#### Checkout Flow

```
Creator sets up product page (title, description, pricing, files)
    |
    v
Buyer visits product page (standalone URL or embedded on creator's site)
    |
    v
Simple checkout: email + payment
    |
    v
Instant digital delivery (download link via email + in-app)
    |
    v
Creator receives revenue minus fees
```

**Key differentiator**: Extremely minimal checkout friction. No account creation required for buyers. One-page product setup for sellers.

#### Pricing Flexibility

| Model | How it works |
|-------|-------------|
| **Fixed price** | Set price, buyer pays exactly that |
| **Pay what you want** | Set a minimum (even $0), buyer chooses amount |
| **Tiered pricing** | Multiple product versions at different prices |
| **Subscription/Membership** | Recurring billing (monthly, quarterly, yearly) |
| **Bundles** | Group products together at a discount |

**Key insight for Pinkquill**: "Pay what you want" is very popular in creative communities. It builds goodwill and can actually increase average revenue vs fixed pricing for some creators.

#### Digital Delivery Features

- Instant file download after purchase
- License key generation for software
- Streaming for video/audio content
- Membership content gating (subscriber-only access)
- Up to 16GB file size per product

#### Analytics for Creators

- Sales revenue over time
- Conversion rates
- Traffic sources
- Cohort-like retention signals (for subscriptions)
- Optimal pricing insights
- Geographic breakdown of buyers

#### Payout System

- Weekly payouts (every Friday)
- Payment via direct deposit or PayPal
- Gumroad is Merchant of Record (handles VAT, GST, sales tax globally as of Jan 2025)

#### Fee Structure

| Scenario | Fee |
|----------|-----|
| **Direct sale** | 10% flat + $0.50 per transaction |
| **Gumroad Discover sale** | 30% flat (buyer found product through Gumroad's marketplace) |
| **Payment processing** | ~2.9% + $0.30 (Stripe/PayPal, additional) |
| **Total effective rate** | ~13-15% for direct sales |

**No monthly fees**. No listing fees. Only pay when you sell.

---

### 1.6 Stripe Connect

**Model**: Payment infrastructure for platforms and marketplaces

#### Platform Payment Architecture

Stripe Connect is the recommended payment infrastructure for building a marketplace. Three charge models:

| Model | Money Flow | Best For |
|-------|-----------|----------|
| **Destination Charges** | Platform charges buyer, portion auto-transferred to seller | Marketplace where platform controls pricing |
| **Direct Charges** | Charge created directly on seller's Stripe account | Seller owns the customer relationship |
| **Separate Charges & Transfers** | Platform charges buyer, transfers to seller(s) separately | Multi-seller orders, complex splits |

**Recommendation for Pinkquill**: **Destination Charges** -- the platform charges the buyer, takes a cut, and the remainder flows to the seller's connected account. This gives Pinkquill control over the checkout experience and fee structure.

#### Seller Onboarding

Three connected account types:

| Account Type | Onboarding | Control | Best For |
|-------------|-----------|---------|----------|
| **Express** | Stripe-hosted onboarding flow | Stripe handles most compliance | Fastest to implement, good for most marketplaces |
| **Standard** | Seller uses their own Stripe account | Seller manages their own Stripe | Sellers who already have Stripe accounts |
| **Custom** | Platform builds custom onboarding UI | Maximum platform control | Fully white-labeled experience |

**Recommendation for Pinkquill**: **Express accounts** -- fast onboarding (sellers fill out a Stripe-hosted form), Stripe handles identity verification and compliance, and it takes weeks instead of quarters to go live.

#### Split Payments

```
Buyer pays $100 for a commissioned poem
    |
    v
Stripe processes payment ($100)
    |
    v
Platform fee: $10 (10% commission)
Stripe processing fee: ~$3.20 (2.9% + $0.30)
    |
    v
Seller receives: $86.80
    (transferred to their connected Stripe account)
```

Platform can configure who absorbs the Stripe processing fee (platform, seller, or buyer).

#### Payouts to Sellers

| Schedule | Details |
|----------|---------|
| **Daily** | Default; rolling daily payouts |
| **Weekly** | Once per week on a set day |
| **Monthly** | Once per month on a set date |
| **Manual** | Platform or seller triggers payout on demand |
| **Instant** | Available 24/7 including weekends, funds in ~30 minutes, small fee |

- Supports 135+ currencies across dozens of countries
- International payouts in recipient's local currency
- Instant Payouts can go to debit cards

#### Refund Handling

- Platform initiates refunds via API
- Refund can be full or partial
- **Important**: Stripe processing fee is NOT refunded to the platform on refunds
- Platform decides policy: who bears the refund cost (platform, seller, or split)
- Refunds can be issued even after funds have been paid out to seller

#### Tax Reporting (1099)

- Stripe handles 1099-K generation and e-filing with IRS
- For Express/Custom accounts, Stripe collects tax identity info during onboarding
- 1099-K threshold: $600 in annual payments (US, as of recent IRS rules)
- Connected accounts can view and e-consent to tax forms via Stripe Express Dashboard
- Platform can configure tax form settings and delivery preferences

---

## 2. Cross-Platform Pattern Analysis

### 2.1 Order Lifecycle Patterns

Every platform follows a variation of this universal flow:

```
DISCOVERY --> PURCHASE --> FULFILLMENT --> REVIEW --> COMPLETION
```

| Phase | Fiverr | Upwork | Etsy | Amazon | Gumroad |
|-------|--------|--------|------|--------|---------|
| **Discovery** | Search + categories + recommendations | Job posts + search + invites | Search + categories + trending | Search + recommendations + ads | Creator's page / Discover |
| **Purchase** | Upfront payment to escrow | Milestone funding to escrow | Direct payment | Direct payment | Direct payment |
| **Fulfillment** | Requirements -> Work -> Delivery | Milestones -> Submit work | Ship or instant digital | Ship or FBA | Instant digital |
| **Review Period** | 3 days (auto-complete) | 14 days (auto-release) | N/A (instant for digital) | 30 days return window | N/A |
| **Completion** | Mutual rating | Mutual rating | Buyer review | Buyer review | Optional review |

**Key takeaway**: For **service-based** orders (commissions), an escrow + requirements + delivery + review cycle is essential. For **product-based** orders (digital downloads), instant delivery with a simple review flow is best.

### 2.2 Payment Flow Patterns

```
                    SERVICE ORDERS                      PRODUCT ORDERS
                    (Commissions)                       (Downloads/Products)

Buyer pays -----> Escrow/Hold -----> Work Done       Buyer pays -----> Instant Delivery
                      |                   |                                    |
                      v                   v                                    v
               Delivery + Review    Funds Released                    Creator gets paid
                      |                   |                           (on payout schedule)
                      v                   v
               Auto-complete        Seller withdraws
               (if no response)
```

**Universal pattern**: All platforms take payment from buyer FIRST, then manage the flow of funds to the seller after value has been delivered.

### 2.3 Trust & Safety Patterns

| Feature | Fiverr | Upwork | Etsy | Amazon | Gumroad |
|---------|--------|--------|------|--------|---------|
| **Escrow** | Yes | Yes | No (instant) | No (instant) | No (instant) |
| **Buyer guarantee** | Resolution Center | Payment Protection | Etsy Purchase Protection | A-to-Z Guarantee | Refund policy |
| **Seller verification** | ID + video | ID + profile | ID + bank | Business verification | Email + Stripe |
| **Dispute resolution** | Structured center | Mediation | Case system | A-to-Z claims | Email support |
| **Reviews** | Mutual (blind) | Mutual | Buyer only | Buyer only | Optional |
| **Seller levels** | 5 tiers | 3 badges | Star Seller | Account health | None |

**Key takeaway**: Escrow is critical for services/commissions. For digital products, a strong refund/guarantee policy substitutes for escrow.

### 2.4 Seller Experience Patterns

Every successful marketplace provides sellers with:

1. **Earnings dashboard**: Revenue over time, pending/cleared/available breakdown
2. **Order management**: Active orders, status tracking, messaging
3. **Analytics**: Views, conversion rates, top products, traffic sources
4. **Performance metrics**: Response time, completion rate, rating average
5. **Payout control**: Multiple withdrawal methods, schedule options
6. **Level/badge system**: Recognition that drives better behavior

### 2.5 Fee Structure Comparison

| Platform | Seller Fee | Buyer Fee | Payment Processing | Effective Total Take |
|----------|-----------|-----------|-------------------|---------------------|
| **Fiverr** | 20% | 5.5% | Included in seller fee | ~25.5% |
| **Upwork** | 0-15% (avg 12%) | 3-5% | Included | ~15-17% |
| **Etsy** | 6.5% + $0.20/listing | None | 3% + $0.25 | ~10-12% |
| **Amazon** | 6-45% (category) | None | Included | 6-45% |
| **Gumroad** | 10% + $0.50 | None | ~3% + $0.30 | ~13-15% |

---

## 3. Recommendations for Pinkquill

### 3.1 Two-Track Commerce Model

Pinkquill should support **two distinct commerce modes** given its creative community:

#### Track A: Digital Products (Etsy/Gumroad model)

For selling completed works: poetry collections, art prints, story PDFs, audio recordings, templates.

```
Creator uploads product + sets pricing
    |
    v
Product page on creator's studio profile
    |
    v
Buyer purchases (simple checkout)
    |
    v
Instant digital delivery (automatic)
    |
    v
Creator earns revenue (weekly payout)
```

**Pricing options to support**:
- Fixed price
- Pay what you want (with optional minimum)
- Tiered versions (e.g., "Standard PDF" vs "Deluxe with author's notes")
- Free with optional tip

#### Track B: Creative Commissions (Fiverr model)

For custom work: commissioned poems, custom illustrations, personalized stories, editing services.

```
Creator lists commission offering (with package tiers)
    |
    v
Buyer selects package and pays (funds go to escrow)
    |
    v
Buyer submits requirements/brief
    |
    v
Creator works on commission (messaging available)
    |
    v
Creator delivers work
    |
    +---> Buyer approves ---> Order complete ---> Funds released
    |
    +---> Buyer requests revision ---> Creator revises ---> Re-delivers
    |
    +---> No response (3 days) ---> Auto-complete
    |
    v
Both parties leave reviews
```

### 3.2 Recommended Payment Architecture

**Use Stripe Connect with Destination Charges**:

```
Buyer pays $50 for a commissioned poem
    |
    v
Stripe Connect processes payment
    |
    v
Pinkquill platform fee: $5.00 (10%)
Stripe processing: ~$1.75 (2.9% + $0.30)
    |
    v
Seller receives: $43.25
    |
    v
[For commissions: held until order completion]
    [For digital products: available on next payout cycle]
```

**Seller onboarding**: Use Stripe Connect Express accounts for fast, Stripe-hosted onboarding with built-in identity verification and tax form collection.

**Payout schedule**: Weekly by default, with option for daily or instant (small fee for instant).

### 3.3 Recommended Fee Structure

| Type | Seller Fee | Buyer Fee | Rationale |
|------|-----------|-----------|-----------|
| **Digital products** | 8% | None | Competitive with Gumroad (10%), lower friction for buyers |
| **Commissions** | 10% | None | Competitive with Upwork (12%), lower than Fiverr (20%) |
| **Tips/donations** | 5% | None | Lower fee encourages tipping culture |

**Justification**: Creative communities are fee-sensitive. A lower take rate than Fiverr (20%) and Etsy (~12%) would be a strong differentiator. Absorb payment processing fees into the platform fee for simplicity.

### 3.4 Trust & Safety Recommendations

| Feature | Implementation | Priority |
|---------|---------------|----------|
| **Escrow for commissions** | Hold funds via Stripe until buyer approves delivery | P0 |
| **Buyer guarantee** | "Pinkquill Promise" -- refund if commission not delivered as agreed | P0 |
| **Seller verification** | Stripe Connect identity verification + optional portfolio review | P0 |
| **Dispute resolution** | Structured resolution center (buyer/seller negotiate, Pinkquill mediates) | P1 |
| **Reviews** | Mutual reviews (blind, revealed simultaneously) | P1 |
| **Auto-complete** | 3-day auto-accept for deliveries (matches Fiverr) | P1 |
| **Seller levels** | Tiered badges based on completion rate, ratings, volume | P2 |

### 3.5 Seller Dashboard Recommendations

Based on patterns from Fiverr, Upwork, and Gumroad, the seller dashboard should include:

**Earnings tab**:
- Revenue over time (chart)
- Pending earnings (in escrow / not yet cleared)
- Available balance (ready to withdraw)
- Lifetime earnings total
- Average order value
- Payout history

**Orders tab**:
- Active orders with status (requirements needed, in progress, delivered, in revision)
- Order timeline for each commission
- Quick messaging access per order
- Completed orders history

**Analytics tab**:
- Profile/shop views over time
- Conversion rate (views to purchases)
- Top-performing products/commissions
- Traffic sources
- Buyer demographics (geography, new vs returning)

**Performance tab**:
- Response time average
- Delivery on-time rate
- Completion rate
- Average rating
- Current seller level/badge

### 3.6 Buyer Experience Recommendations

**For digital products**:
- One-click purchase (minimal checkout friction, following Gumroad's pattern)
- Instant delivery to email + in-app library
- Download history in account
- Gift purchase option

**For commissions**:
- Clear package comparison (3 tiers like Fiverr)
- Requirements form (structured brief submission)
- Real-time order status tracking
- In-order messaging with file sharing
- Delivery preview with accept/revision/extend options
- Post-completion review

### 3.7 Order Status Model

```sql
-- Proposed order statuses for Pinkquill

-- Digital product orders:
-- 'completed' (instant, upon purchase)

-- Commission orders:
-- 'pending_requirements' (buyer needs to submit brief)
-- 'in_progress' (seller working on commission)
-- 'delivered' (seller submitted work)
-- 'in_revision' (buyer requested changes)
-- 'completed' (buyer accepted or auto-completed)
-- 'cancelled' (cancelled by either party or dispute)
-- 'disputed' (in resolution process)
```

### 3.8 Key Differentiators for Pinkquill

What would make Pinkquill's marketplace stand out in the creative space:

1. **Lower fees than competitors** (8-10% vs Fiverr's 20% or Etsy's ~12%)
2. **Native to the social platform** -- buyers discover sellers through their posts, not a separate marketplace
3. **Creative-first UX** -- commission briefs designed for creative work (mood boards, reference poems, style preferences) rather than generic requirement forms
4. **Community trust signals** -- seller reputation built from social interactions (followers, admires, community standing) in addition to transaction reviews
5. **Pay what you want** -- embracing the creative community's tipping culture
6. **Integrated portfolio** -- seller's posts ARE their portfolio (no separate portfolio upload needed)
7. **Collaboration support** -- multi-creator commissions using existing collaborator system
8. **Instant voice briefs** -- buyers can record voice notes as part of commission requirements (leveraging existing voice note infrastructure)

---

## Sources

### Fiverr
- [Fiverr Order Statuses and Process](https://help.fiverr.com/hc/en-us/articles/37332473202065-The-complete-guide-to-your-Fiverr-order-Statuses-and-process)
- [Fiverr Order Management Guide](https://help.fiverr.com/hc/en-us/articles/360010639617-Managing-your-orders-A-freelancer-s-guide-to-the-Fiverr-order-process)
- [Fiverr Resolution Center](https://help.fiverr.com/hc/en-us/articles/27274045277713-How-to-use-the-Resolution-Center)
- [Fiverr Seller Levels (2025)](https://www.krevv.com/post/fiverr-seller-levels-explained-2025-update)
- [Fiverr Earnings Page](https://help.fiverr.com/hc/en-us/articles/9234443621137-Your-earnings-page)
- [Fiverr Sales Analytics](https://help.fiverr.com/hc/en-us/articles/360010750238-Viewing-sales-analytics)
- [Fiverr Withdrawal Methods](https://help.fiverr.com/hc/en-us/articles/360010530058-Withdraw-your-earnings)
- [Fiverr Pricing Guide](https://www.hireinsouth.com/post/fiverr-pricing)
- [Fiverr Payment Process](https://community.fiverr.com/public/blogs/buyers-guide-understanding-fiverrs-payment-process-2025-05-30)

### Upwork
- [Upwork Milestone Payments](https://support.upwork.com/hc/en-us/articles/211063718-How-payments-for-milestones-and-fixed-price-contracts-work)
- [Upwork Fixed-Price Protection](https://support.upwork.com/hc/en-us/articles/211063748-How-Fixed-Price-Payment-Protection-works-for-freelancers-on-Upwork)
- [Upwork Contract Types](https://support.upwork.com/hc/en-us/articles/35089553330067-Contract-types)
- [Upwork Dispute Resolution](https://support.upwork.com/hc/en-us/articles/23344415143699-How-to-resolve-issues-with-your-freelancer)
- [Upwork Freelancer Service Fee](https://support.upwork.com/hc/en-us/articles/211062538-Learn-about-the-Freelancer-Service-Fee)
- [Upwork Client Pricing](https://www.upwork.com/pricing/client)
- [Upwork Pricing (2026)](https://www.hireinsouth.com/post/how-much-does-upwork-cost)

### Etsy
- [Etsy Fees & Payments Policy](https://www.etsy.com/legal/fees/)
- [Etsy Star Seller Program](https://www.etsy.com/starseller)
- [Etsy Star Seller Badge](https://help.etsy.com/hc/en-us/articles/4403058372503-What-is-the-Star-Seller-Badge)
- [Etsy Digital Downloads Guide](https://help.etsy.com/hc/en-us/articles/115013328108-How-to-Download-a-Digital-Item)
- [Etsy Digital Listing Management](https://help.etsy.com/hc/en-us/articles/115015628347-How-to-Manage-Your-Digital-Listings)
- [Etsy Seller Fee Breakdown](https://www.printful.com/blog/how-much-does-etsy-take-per-sale)
- [Etsy Digital Products Fee Guide](https://sellermath.net/selling-digital-products-on-etsy-in-2025-a-complete-fee-breakdown-profit-guide/)

### Amazon
- [Amazon Order Management Guide](https://sell.amazon.com/blog/amazon-order-management)
- [Amazon A-to-Z Guarantee](https://www.bebolddigital.com/blog/amazon-a-to-z-guarantee)
- [Amazon Seller Metrics Guide](https://amzdudes.com/the-2025-guide-to-amazon-seller-metrics-and-reports/)
- [Amazon Order Defect Rate](https://www.sarasanalytics.com/blog/amazon-order-defect-rate)
- [Amazon Return Policy (2025)](https://www.threecolts.com/blog/amazon-return-policy/)
- [Amazon Seller Performance Metrics](https://tracefuse.ai/blog/a-guide-to-amazon-seller-performance-metrics/)

### Gumroad
- [Gumroad Pricing](https://gumroad.com/pricing)
- [Gumroad Features](https://gumroad.com/features)
- [Gumroad Pay What You Want](https://gumroad.com/help/article/133-pay-what-you-want-pricing)
- [Gumroad Memberships](https://gumroad.com/help/article/82-membership-products)
- [Gumroad License Keys](https://help.gumroad.com/article/76-license-keys)
- [Gumroad Fee Details](https://gumroad.com/help/article/66-gumroads-fees)
- [Gumroad Pricing Analysis (2026)](https://www.schoolmaker.com/blog/gumroad-pricing)
- [Gumroad 2025 Review](https://medium.com/@RiseLogan/gumroad-in-2025-fees-features-and-better-alternatives-fef48cecb31d)

### Stripe Connect
- [Stripe Connect Overview](https://docs.stripe.com/connect)
- [Stripe Connect Charge Types](https://docs.stripe.com/connect/charges)
- [Stripe Destination Charges](https://docs.stripe.com/connect/destination-charges)
- [Stripe Direct Charges](https://docs.stripe.com/connect/direct-charges)
- [Stripe Connect Account Types](https://docs.stripe.com/connect/accounts)
- [Stripe Connect Payouts](https://docs.stripe.com/connect/manage-payout-schedule)
- [Stripe Instant Payouts](https://docs.stripe.com/connect/instant-payouts)
- [Stripe Connect Tax Reporting](https://docs.stripe.com/connect/tax-reporting)
- [Stripe Connect 1099](https://stripe.com/connect/1099)
- [Stripe Connect Marketplace Guide (2026)](https://jeecart.com/what-is-stripe-connect/)

### Creative Marketplace Context
- [Best Art Commission Platforms (2025)](https://www.morgan-shae.com/post/the-best-platforms-to-buy-and-sell-art-commissions-in-2025)
- [Artists&Clients Commission Marketplace](https://artistsnclients.com/about/commissions)
- [Where to Sell Digital Art (2025)](https://litcommerce.com/blog/where-to-sell-digital-art/)
