/**
 * Store/Marketplace type definitions for Quill
 * Products, pricing, shipping, purchases, and digital delivery
 */

// ============================================================================
// PRODUCT ENUMS & BASIC TYPES
// ============================================================================

export type ProductDelivery = 'physical' | 'digital' | 'both';
export type ListingType = 'product' | 'service';
export type ProductStatus = 'draft' | 'active' | 'sold' | 'paused' | 'archived';
export type PricingType = 'original' | 'reproduction' | 'digital_download' | 'service_package';
export type PackageTier = 'basic' | 'standard' | 'premium' | 'custom';
export type PurchaseStatus =
  | 'pending'
  | 'paid'
  | 'in_progress'
  | 'submitted'
  | 'revision_requested'
  | 'completed'
  | 'shipped'
  | 'delivered'
  | 'refunded'
  | 'cancelled';

export type OrderStatus =
  | 'pending_acceptance'
  | 'declined'
  | 'pending_payment'
  | 'expired'
  | 'paid'
  | 'in_progress'
  | 'submitted'
  | 'revision_requested'
  | 'completed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'refund_requested'
  | 'refunded'
  | 'disputed'
  | 'resolved';

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'refunded' | 'partially_refunded' | 'failed' | 'expired';
export type OrderMessageType = 'text' | 'file' | 'status_update' | 'system';
export type OrderEventType = 'status_change' | 'payment' | 'message' | 'revision' | 'dispute' | 'system' | 'amount_mismatch' | 'transfer_failed';

// ============================================================================
// PRODUCT SELLER (minimal profile for display)
// ============================================================================

export interface ProductSeller {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
}

// ============================================================================
// PRODUCT MEDIA
// ============================================================================

export interface ProductMedia {
  id: string;
  product_id: string;
  media_url: string;
  media_type: 'image' | 'video';
  is_primary: boolean;
  position: number;
  created_at: string;
}

// ============================================================================
// PRODUCT PRICING
// ============================================================================

export interface ReproductionSize {
  name: string;
  dimensions: string;
  price_modifier: number;
}

export interface ReproductionOptions {
  type: string;
  sizes?: ReproductionSize[];
}

export interface ProductPricing {
  id: string;
  product_id: string;
  pricing_type: PricingType;
  variant_name: string | null;
  price: number;
  min_price: number;
  currency: string;
  stock: number | null;
  is_available: boolean;
  reproduction_options: ReproductionOptions | null;
  package_tier: PackageTier | null;
  delivery_days: number | null;
  revisions: number | null;
  package_features: string[] | null;
  created_at: string;
}

// ============================================================================
// PRODUCT SHIPPING
// ============================================================================

export type DimensionsUnit = 'cm' | 'inches';
export type WeightUnit = 'kg' | 'lbs';

export interface ProductShipping {
  id: string;
  product_id: string;
  dimensions_unit: DimensionsUnit;
  height: number | null;
  width: number | null;
  thickness: number | null;
  weight: number | null;
  weight_unit: WeightUnit;
  shipping_services: string[];
  shipping_locations: string[];
  packaging: string | null;
  processing_days: number | null;
  shipping_cost: number;
  created_at: string;
}

// ============================================================================
// PRODUCT FILES (digital downloads)
// ============================================================================

export interface ProductFile {
  id: string;
  product_id: string;
  pricing_id: string | null;
  file_url: string;
  file_name: string;
  file_type: string | null;
  file_size: number | null;
  is_preview: boolean;
  download_limit: number | null;
  created_at: string;
}

// ============================================================================
// PRODUCT ATTRIBUTES (flexible metadata)
// ============================================================================

export interface ProductAttributes {
  // ===== Art =====
  techniques?: string[];
  styles?: string[];
  themes?: string[];
  display?: string;
  is_framed?: boolean;
  frame_type?: string;

  // ===== Music =====
  genre?: string[];
  bpm?: number;
  key?: string;
  track_count?: number;
  duration?: string;

  // ===== Books =====
  literary_genre?: string[];
  page_count?: number;
  isbn?: string;
  language?: string;
  binding?: string;
  edition?: string;
  signed?: boolean;

  // ===== Prints =====
  print_technique?: string;
  paper_type?: string;
  edition_size?: number;
  edition_number?: string;
  is_numbered?: boolean;

  // ===== Crafts =====
  materials?: string[];
  craft_technique?: string[];
  is_one_of_a_kind?: boolean;
  care_instructions?: string;

  // ===== Digital Goods =====
  software?: string[];
  file_formats?: string[];

  // ===== Universal =====
  license_type?: string;

  // ===== Custom fields (user-defined) =====
  custom?: Record<string, string | string[]>;

  // Allow any additional attributes for extensibility
  [key: string]: unknown;
}

export interface ServiceFaqItem {
  question: string;
  answer: string;
}

export interface ServiceMetadata {
  headline?: string;
  experience_level?: 'new' | 'intermediate' | 'expert';
  response_time_hours?: number;
  requirements?: string[];
  includes?: string[];
  excludes?: string[];
  faqs?: ServiceFaqItem[];
  delivery_notes?: string;
  [key: string]: unknown;
}

// ============================================================================
// COMMISSION LISTING SETTINGS (Phase 2a — availability & slots)
// ============================================================================

export type CommissionAvailability = 'open' | 'waitlist' | 'closed' | 'scheduled';
export type CommissionTurnaroundStart = 'payment' | 'acceptance';

/** One row per service product (`commission_listings`). */
export interface CommissionListing {
  product_id: string;
  seller_id: string;
  availability: CommissionAvailability;
  opens_at: string | null;
  /** NULL = unlimited */
  slots_total: number | null;
  /** Maintained by a DB trigger from active orders. */
  slots_used: number;
  lead_time_days: number;
  turnaround_starts: CommissionTurnaroundStart;
  terms: string | null;
  accepts_custom_quotes: boolean;
  created_at: string;
  updated_at: string;
}

/** Result of `get_commission_availability(product_id)`. */
export interface CommissionAvailabilityInfo {
  can_order: boolean;
  mode: 'order' | 'waitlist' | 'closed';
  reason: string | null;
  availability: CommissionAvailability;
  opens_at: string | null;
  slots_total: number | null;
  slots_used: number;
  slots_open: number | null;
  queue_length: number;
  lead_time_days: number;
  turnaround_starts: CommissionTurnaroundStart;
  seller_accepting: boolean;
  accepts_custom_quotes: boolean;
  terms: string | null;
}

// ============================================================================
// INTAKE, ATTACHMENTS, REVISIONS, DELIVERIES (Phase 2c)
// ============================================================================

export type IntakeFieldType = 'short_text' | 'long_text' | 'number' | 'url' | 'select' | 'multi_select' | 'file';

/** A question the creator asks before work starts (`listing_intake_fields`). */
export interface ListingIntakeField {
  id: string;
  product_id: string;
  seller_id: string;
  position: number;
  label: string;
  help_text: string | null;
  field_type: IntakeFieldType;
  options: string[];
  required: boolean;
  created_at: string;
  updated_at: string;
}

/** Wizard draft of an intake field (id only when it already exists). */
export interface IntakeFieldDraft {
  id?: string;
  key: string;
  label: string;
  help_text: string;
  field_type: IntakeFieldType;
  options: string[];
  required: boolean;
}

/** Answer sent with a hire request: `requirements.answers[]`. */
export interface IntakeAnswerInput {
  field_id: string;
  value: string | string[];
}

export interface OrderIntakeAnswer {
  id: string;
  order_id: string;
  field_id: string | null;
  position: number;
  label: string;
  field_type: IntakeFieldType;
  value_text: string | null;
  value_json: unknown;
  created_at: string;
}

export type OrderAttachmentKind = 'reference' | 'revision' | 'delivery';

export interface OrderAttachment {
  id: string;
  order_id: string;
  uploader_id: string;
  kind: OrderAttachmentKind;
  /** Bare path in the private order-files bucket; resolve via useOrderFileUrls. */
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number;
  delivery_id: string | null;
  revision_id: string | null;
  created_at: string;
}

/** File descriptor passed to the delivery / revision / reference RPCs. */
export interface OrderFileInput {
  path: string;
  name: string;
  type: string;
  size: number;
}

export interface OrderRevision {
  id: string;
  order_id: string;
  number: number;
  requested_by: string;
  note: string | null;
  status: 'open' | 'addressed' | 'withdrawn';
  requested_at: string;
  addressed_at: string | null;
  addressed_by_delivery_id: string | null;
  attachments: OrderAttachment[];
}

export interface OrderDelivery {
  id: string;
  order_id: string;
  version: number;
  seller_id: string;
  note: string | null;
  is_final: boolean;
  revision_id: string | null;
  status: 'submitted' | 'revision_requested' | 'accepted' | 'superseded';
  delivered_at: string;
  accepted_at: string | null;
  attachments: OrderAttachment[];
}

/** Result of `get_order_workroom(order_id)`. */
export interface OrderWorkroom {
  intake_answers: OrderIntakeAnswer[];
  references: OrderAttachment[];
  revisions: OrderRevision[];
  deliveries: OrderDelivery[];
}

// ============================================================================
// MAIN PRODUCT INTERFACE
// ============================================================================

export interface Product {
  id: string;
  seller_id: string;
  title: string;
  slug: string;
  description: string | null;
  listing_type: ListingType;
  delivery_type: ProductDelivery;
  category: string;
  subcategory: string | null;
  attributes: ProductAttributes;
  service_metadata: ServiceMetadata;
  status: ProductStatus;
  year_created: number | null;
  created_at: string;
  updated_at: string;
  published_at: string | null;

  // Joined data
  seller?: ProductSeller;
  media?: ProductMedia[];
  pricing?: ProductPricing[];
  shipping?: ProductShipping | null;
  files?: ProductFile[];
  keywords?: string[];
  /** Availability/slots settings for services (joined from commission_listings). */
  commission_listing?: CommissionListing | null;
  /** Intake questions for services (joined from listing_intake_fields). */
  intake_fields?: ListingIntakeField[];

  // Computed fields
  primary_image_url?: string;
  min_price?: number;
  max_price?: number;
  min_delivery_days?: number;
  max_revisions?: number;
  total_sales?: number;
  /** Whether the current viewer has saved this product. Populated by
   *  hooks that batch-fetch product_saves for the viewer (e.g. useMarketplace). */
  is_saved?: boolean;
}

// ============================================================================
// PURCHASE & ORDER TYPES
// ============================================================================

export interface ShippingAddress {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postal_code: string;
  country: string;
  phone?: string;
}

export interface ProductPurchase {
  id: string;
  buyer_id: string;
  product_id: string;
  pricing_id: string | null;
  amount: number;
  currency: string;
  status: PurchaseStatus;
  shipping_address: ShippingAddress | null;
  tracking_number: string | null;
  brief: string | null;
  requirements: Record<string, unknown> | null;
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  delivery_note: string | null;
  delivery_assets: string[] | null;
  revision_count: number;
  last_status_update_at: string;
  created_at: string;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;

  // Joined data
  product?: Product;
  buyer?: ProductSeller;
  pricing?: ProductPricing;
}

export interface DownloadToken {
  id: string;
  purchase_id?: string;
  order_id?: string;
  file_id: string;
  token: string;
  downloads_used: number;
  download_limit: number | null;
  expires_at: string | null;
  created_at: string;

  // Joined data
  file?: ProductFile;
}

// ============================================================================
// ORDER TYPES (new orders system)
// ============================================================================

export interface Order {
  id: string;
  order_number: string;

  // Participants
  buyer_id: string;
  seller_id: string;

  // Product
  product_id: string;
  pricing_id: string | null;
  listing_type: ListingType;

  // Financial
  amount: number;
  original_amount: number | null;
  discount_amount: number | null;
  promo_code_id: string | null;
  platform_fee: number;
  seller_amount: number;
  currency: string;

  // Status
  status: OrderStatus;
  payment_intent_id: string | null;
  payment_provider?: "stripe" | "placeholder" | null;
  payment_reference?: string | null;
  checkout_session_id?: string | null;
  /** Buyer-side processing fee charged on top of `amount` (D3) */
  buyer_fee?: number;
  /** amount + buyer_fee in the listing currency (generated column) */
  total_amount?: number;
  /** Settlement-currency charge (Phase 1c): what Stripe actually charged */
  charge_currency?: string | null;
  charge_amount_cents?: number | null;
  charge_fee_cents?: number | null;
  seller_amount_charge_cents?: number | null;
  fx_rate?: number | null;
  fx_rate_at?: string | null;
  payment_status: PaymentStatus;
  escrow_released: boolean;
  escrow_released_at: string | null;

  // Commission fields
  brief: string | null;
  requirements: Record<string, unknown>;
  due_date: string | null;
  started_at: string | null;
  submitted_at: string | null;
  completed_at: string | null;
  delivery_note: string | null;
  delivery_assets: string[];
  revision_count: number;
  max_revisions: number | null;

  // Product fields
  quantity: number;
  shipping_address: ShippingAddress | null;
  shipping_cost: number;
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  delivered_at: string | null;

  // Cancellation
  cancelled_by: string | null;
  cancel_reason: string | null;

  // Seller acceptance
  seller_accepted: boolean | null;
  seller_accepted_at: string | null;
  seller_declined_at: string | null;
  seller_decline_reason: string | null;
  seller_response_deadline: string | null;

  // Buyer checkout fields
  buyer_phone: string | null;
  buyer_note: string | null;

  // Auto-completion
  auto_completion_at: string | null;

  // Timestamps
  created_at: string;
  updated_at: string;

  // Joined data
  product?: Product;
  buyer?: ProductSeller;
  seller?: ProductSeller;
  pricing?: ProductPricing;
  messages?: OrderMessage[];
  events?: OrderEvent[];
}

export interface OrderMessage {
  id: string;
  order_id: string;
  sender_id: string;
  content: string | null;
  message_type: OrderMessageType;
  attachments: OrderAttachment[];
  created_at: string;

  // Joined
  sender?: ProductSeller;
}

export interface OrderAttachment {
  url: string;
  name: string;
  type: string;
  size: number;
}

export interface OrderEvent {
  id: string;
  order_id: string;
  actor_id: string | null;
  event_type: OrderEventType;
  from_status: string | null;
  to_status: string | null;
  metadata: Record<string, unknown>;
  created_at: string;

  // Joined
  actor?: ProductSeller;
}

export interface CreateOrderData {
  product_id: string;
  pricing_id: string;
  // Amounts, fees, currency and listing type are computed by the server
  // (create_marketplace_order) from the product/pricing rows. The client
  // never sends money figures.
  brief?: string;
  /** `{ answers: IntakeAnswerInput[], notes?: string }` — validated server-side. */
  requirements?: { answers?: IntakeAnswerInput[]; notes?: string } | Record<string, string | string[]>;
  due_date?: string;
  quantity?: number;
  shipping_address?: ShippingAddress;
  chosen_amount?: number | null;
}

export interface OrderFilters {
  /** One status or a list (server-side `in`). */
  status?: OrderStatus | OrderStatus[];
  listing_type?: ListingType;
  date_from?: string;
  date_to?: string;
  /** Matches order number, listing title or buyer name (seller lists). */
  search?: string;
  /** Only orders whose due date is before this instant (late orders). */
  due_before?: string;
  sort?: 'newest' | 'due';
}

export interface OrderStats {
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  pending_revenue: number;
}

export interface BuyerOrderStats {
  total_orders: number;
  active_orders: number;
  pending_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spent: number;
}

// ============================================================================
// SELLER ACCOUNTS & TRANSACTIONS
// ============================================================================

export interface SellerAccount {
  id: string;
  user_id: string;
  stripe_account_id: string | null;
  provider?: "stripe" | "placeholder";
  placeholder_mode?: boolean;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  card_payments_enabled?: boolean;
  transfers_enabled?: boolean;
  default_currency: string;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  order_id: string;
  type: 'payment' | 'buyer_fee' | 'platform_fee' | 'seller_payout' | 'refund';
  amount: number;
  currency: string;
  stripe_payment_intent_id: string | null;
  stripe_transfer_id: string | null;
  stripe_charge_id: string | null;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SellerEarnings {
  total_earned: number;
  pending_earnings: number;
  total_orders: number;
  completed_orders: number;
  active_orders: number;
  cancelled_orders: number;
  avg_order_value: number;
}

// ============================================================================
// REVIEWS & SELLER TRUST
// ============================================================================

export type ReviewRole = 'buyer' | 'seller';

export interface Review {
  id: string;
  order_id: string;
  product_id: string;
  listing_type: ListingType;
  reviewer_id: string;
  reviewee_id: string;
  reviewer_role: ReviewRole;
  reviewee_role: ReviewRole;
  quill_score: number;
  title: string | null;
  content: string;
  highlights: string[];
  is_public: boolean;
  /** Set once the review is revealed (mutual review submitted, or deadline passed). */
  revealed_at: string | null;
  /** Blind-window deadline for a first, still-unmatched service review. */
  reveal_deadline: string | null;
  created_at: string;
  updated_at: string;

  // Joined
  reviewer?: ProductSeller;
  reviewee?: ProductSeller;
  order?: { order_number: string; product?: { id: string; title: string } };
}

export interface SellerStats {
  user_id: string;
  avg_quill_score: number;
  total_reviews: number;
  total_orders: number;
  completed_orders: number;
  completion_rate: number;
  avg_response_time_hours: number;
  repeat_buyer_rate: number;
  updated_at: string;
}

// ============================================================================
// DISPUTES & REFUNDS
// ============================================================================

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'cancelled';

export type DisputeReason =
  | 'item_not_as_described'
  | 'item_not_received'
  | 'quality_issue'
  | 'seller_unresponsive'
  | 'buyer_unresponsive'
  | 'late_delivery'
  | 'unauthorized_charge'
  | 'other';

export type DisputeResolution =
  | 'full_refund'
  | 'partial_refund'
  | 'release_to_seller'
  | 'order_cancelled'
  | 'mutual_agreement';

export const DISPUTE_REASON_LABELS: Record<DisputeReason, string> = {
  item_not_as_described: 'Item not as described',
  item_not_received: 'Item not received',
  quality_issue: 'Quality issue',
  seller_unresponsive: 'Seller unresponsive',
  buyer_unresponsive: 'Buyer unresponsive',
  late_delivery: 'Late delivery',
  unauthorized_charge: 'Unauthorized charge',
  other: 'Other',
};

export const DISPUTE_RESOLUTION_LABELS: Record<DisputeResolution, string> = {
  full_refund: 'Full refund',
  partial_refund: 'Partial refund',
  release_to_seller: 'Funds released to seller',
  order_cancelled: 'Order cancelled',
  mutual_agreement: 'Mutual agreement',
};

export interface Dispute {
  id: string;
  order_id: string;
  initiated_by: string;
  reason: DisputeReason;
  description: string;
  status: DisputeStatus;
  resolution: DisputeResolution | null;
  resolution_notes: string | null;
  resolved_by: string | null;
  refund_amount: number | null;
  created_at: string;
  resolved_at: string | null;
  updated_at: string;

  // Joined
  initiator?: ProductSeller;
  order?: Order;
}

// ============================================================================
// CREATE/UPDATE FORM TYPES
// ============================================================================

export interface CreateProductData {
  title: string;
  description?: string;
  listing_type?: ListingType;
  delivery_type: ProductDelivery;
  category: string;
  subcategory?: string;
  attributes: ProductAttributes;
  service_metadata?: ServiceMetadata;
  year_created?: number;
  keywords?: string[];
}

export interface CreatePricingData {
  pricing_type: PricingType;
  variant_name?: string;
  price: number;
  min_price?: number;
  currency?: string;
  stock?: number;
  reproduction_options?: ReproductionOptions;
  package_tier?: PackageTier;
  delivery_days?: number;
  revisions?: number;
  package_features?: string[];
}

export interface CreateShippingData {
  dimensions_unit?: DimensionsUnit;
  height?: number;
  width?: number;
  thickness?: number;
  weight?: number;
  weight_unit?: WeightUnit;
  shipping_services?: string[];
  shipping_locations?: string[];
  packaging?: string;
  processing_days?: number;
  shipping_cost?: number;
}

export interface UpdateProductData extends Partial<CreateProductData> {
  status?: ProductStatus;
}

export interface CreateCommissionPackageData {
  tier: PackageTier;
  name: string;
  description: string;
  price: number;
  delivery_days: number;
  revisions: number;
  features: string[];
}

export interface CreateCommissionData {
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  headline?: string;
  media: File[];
  requirements: string[];
  faqs: ServiceFaqItem[];
  keywords: string[];
  packages: CreateCommissionPackageData[];
}

export interface CreateCommissionOrderData {
  product_id: string;
  pricing_id: string;
  amount: number;
  currency: string;
  brief: string;
  requirements?: Record<string, string | string[]>;
  due_date?: string;
}

// ============================================================================
// WIZARD STATE TYPES
// ============================================================================

export interface ProductWizardState {
  // Step 1: Delivery & Category
  deliveryType: ProductDelivery | null;
  category: string | null;
  subcategory: string | null;

  // Step 2: Media
  mediaFiles: File[];
  mediaPreviews: {
    id?: string;
    file?: File | null;
    url: string;
    isPrimary: boolean;
    mediaType?: 'image' | 'video';
  }[];
  digitalFiles: {
    id?: string;
    file?: File | null;
    name: string;
    type?: string;
    size: number;
    url?: string;
  }[];

  // Step 3: Details
  title: string;
  description: string;
  yearCreated: number | null;
  attributes: ProductAttributes;

  // Pricing — for PWYW rows, `*Min` is the floor and `*Price` is the suggested
  // price. When `*Min === null` (or equal to price), the row is fixed-price.
  sellOriginal: boolean;
  originalPrice: number | null;
  originalMin: number | null;
  hasReproductions: boolean;
  reproductions: {
    type: string;
    price: number;
    min: number | null;
  }[];
  hasDigitalDownload: boolean;
  digitalPrice: number | null;
  digitalMin: number | null;
  digitalFormat: string | null;

  // Shipping (physical)
  shipping: CreateShippingData;

  // Keywords
  keywords: string[];
}

export interface CommissionPackageFormState {
  id: string;
  pricing_id?: string;
  tier: PackageTier;
  name: string;
  description: string;
  price: number | null;
  deliveryDays: number;
  revisions: number;
  features: string[];
}

export interface CommissionWizardState {
  category: string | null;
  subcategory: string | null;
  title: string;
  headline: string;
  description: string;
  mediaPreviews: {
    id?: string;
    file?: File | null;
    url: string;
    isPrimary: boolean;
    mediaType?: 'image' | 'video';
  }[];
  packages: CommissionPackageFormState[];
  requirements: string[];
  faqs: ServiceFaqItem[];
  keywords: string[];
  /** Phase 3f — "Includes" / "Not included" lists shown on the listing */
  includes: string[];
  excludes: string[];
  /** Phase 2c — intake questions (replaces the free-text requirements list) */
  intakeFields: IntakeFieldDraft[];
  /** Phase 2a — availability & slots */
  availability: CommissionAvailability;
  /** ISO date (yyyy-mm-dd) when availability === 'scheduled' */
  opensAt: string;
  /** null = unlimited */
  slotsTotal: number | null;
  leadTimeDays: number;
  turnaroundStarts: CommissionTurnaroundStart;
  terms: string;
  acceptsCustomQuotes: boolean;
}

export const initialWizardState: ProductWizardState = {
  deliveryType: null,
  category: null,
  subcategory: null,
  mediaFiles: [],
  mediaPreviews: [],
  digitalFiles: [],
  title: '',
  description: '',
  yearCreated: null,
  attributes: {},
  sellOriginal: false,
  originalPrice: null,
  originalMin: null,
  hasReproductions: false,
  reproductions: [],
  hasDigitalDownload: false,
  digitalPrice: null,
  digitalMin: null,
  digitalFormat: null,
  shipping: {
    dimensions_unit: 'cm',
    weight_unit: 'kg',
    shipping_locations: [],
    shipping_services: [],
    shipping_cost: 0,
  },
  keywords: [],
};

export const initialCommissionWizardState: CommissionWizardState = {
  category: null,
  subcategory: null,
  title: "",
  headline: "",
  description: "",
  mediaPreviews: [],
  packages: [
    {
      id: "basic",
      tier: "basic",
      name: "Basic",
      description: "",
      price: null,
      deliveryDays: 7,
      revisions: 1,
      features: [],
    },
  ],
  requirements: [],
  faqs: [],
  keywords: [],
  includes: [],
  excludes: [],
  intakeFields: [],
  availability: "open",
  opensAt: "",
  slotsTotal: null,
  leadTimeDays: 0,
  turnaroundStarts: "payment",
  terms: "",
  acceptsCustomQuotes: false,
};

// ============================================================================
// MARKETPLACE FILTER TYPES
// ============================================================================

export type MarketplaceSortOption = 'newest' | 'price_low' | 'price_high' | 'popular';

// ============================================================================
// PROMO CODES
// ============================================================================

export type PromoDiscountType = 'percentage' | 'fixed';

export interface PromoCode {
  id: string;
  code: string;
  discount_type: PromoDiscountType;
  discount_value: number;
  max_uses: number | null;
  current_uses: number;
  min_order_amount: number | null;
  max_discount: number | null;
  valid_from: string;
  valid_until: string | null;
  listing_type: string | null;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// MARKETPLACE FILTER TYPES
// ============================================================================

export interface MarketplaceFilters {
  listing_type?: ListingType;
  category?: string;
  subcategory?: string;
  delivery_type?: ProductDelivery | 'physical' | 'digital';
  min_price?: number;
  max_price?: number;
  max_delivery_days?: number;
  min_revisions?: number;
  keywords?: string[];
  seller_id?: string;
  sort_by: MarketplaceSortOption;
}

export interface MarketplacePagination {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}
