# Commissions UX Journey (PinkQuill)

## Why This Fits PinkQuill
PinkQuill already has a strong creator profile, marketplace, and product data model. Commissions are implemented as a first-class listing type (`listing_type = service`) so creators can sell services alongside products using familiar UX patterns.

## Creator Journey
1. **Entry point**
- Creator opens sidebar `Create` menu.
- New action: `Add Service`.
- Route: `/sell/service`.

2. **Service setup (wizard)**
- Step 1: Positioning
  - Category + specialization
  - Title, headline, detailed description
- Step 2: Packages
  - Basic/Standard/Premium package strategy
  - Price, delivery days, revisions, feature list per package
- Step 3: Portfolio & Requirements
  - Media upload (cover + gallery)
  - Buyer intake requirements
  - FAQ block
  - Search tags
- Step 4: Review & Publish
  - Quality summary + publish

3. **Publishing result**
- Service listing is stored in `products` with `listing_type = service`.
- Packages are stored in `product_pricing` with tier + delivery + revisions.
- Creator is redirected to Studio `?tab=commissions`.

## Studio Experience
1. **New tab: Commissions**
- Appears beside Store and Collections.
- Shows service cards in grid layout.
- Includes `All / Active / Inactive` filters.
- Own profile has `Add Service` CTA.

2. **Card behavior**
- Cover media + category context
- Starting price
- Link to full commission detail page

## Buyer Journey
1. **Discovery**
- Marketplace now supports two sections:
  - Products
  - Commissions
- Commissions have dedicated category/subcategory taxonomy and filters.

2. **Commission detail page** (`/commissions/[id]`)
- Service story + headline
- Package comparison block
- Timeline/revision hints
- Requirements and FAQ sections
- Primary CTA: `Hire Creator`

3. **Hire flow**
- Buyer selects package.
- Buyer submits brief + timeline + notes.
- System creates order in `product_purchases` with service-specific fields.
- Buyer is redirected to order tracking page.

4. **Order lifecycle** (`/commissions/orders/[id]`)
- Status pipeline:
  - `paid` -> `in_progress` -> `submitted` -> `completed`
  - Revision loop: `submitted` -> `revision_requested` -> `in_progress`
- Seller actions:
  - Start work
  - Submit delivery with note
- Buyer actions:
  - Request revision
  - Mark complete

## Marketplace Filtering Model
- Shared filters: category, subcategory, price, search, sort
- Product-only filters: delivery type (physical/digital)
- Commission-only filters:
  - Max delivery days
  - Minimum revisions

## PinkQuill Differentiator
**Transparent Scope + Story-led Commerce**
- Scope clarity from package cards and requirements checklist
- Creative context preserved via rich media + FAQ + studio identity
- Buyer confidence improves with explicit timeline/revision visibility before hire

## Data Model Summary
- `products`
  - New: `listing_type`, `service_metadata`
- `product_pricing`
  - New: `package_tier`, `delivery_days`, `revisions`, `package_features`
- `product_purchases`
  - New: `brief`, `requirements`, due/status timestamps, delivery notes/assets, revision count

## Safety + Access
- Existing RLS retained for seller ownership and buyer visibility.
- Buyer update policy added for commission status actions on own orders.

## Future Enhancements
- Milestone splitting per package
- Escrow release logic via payment provider webhooks
- Structured file delivery storage (`delivery_assets` signed upload flow)
- SLA and late-delivery nudges
