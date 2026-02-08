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
  | 'pending_payment'
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

export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'refunded' | 'partially_refunded' | 'failed';
export type OrderMessageType = 'text' | 'file' | 'status_update' | 'system';
export type OrderEventType = 'status_change' | 'payment' | 'message' | 'revision' | 'dispute' | 'system';

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

  // Computed fields
  primary_image_url?: string;
  min_price?: number;
  max_price?: number;
  total_sales?: number;
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
  purchase_id: string;
  file_id: string;
  token: string;
  downloads_used: number;
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
  platform_fee: number;
  seller_amount: number;
  currency: string;

  // Status
  status: OrderStatus;
  payment_intent_id: string | null;
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
  tracking_number: string | null;
  shipped_at: string | null;
  delivered_at: string | null;

  // Cancellation
  cancelled_by: string | null;
  cancel_reason: string | null;

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
  listing_type: ListingType;
  amount: number;
  platform_fee: number;
  seller_amount: number;
  currency?: string;
  brief?: string;
  requirements?: Record<string, string | string[]>;
  due_date?: string;
  max_revisions?: number;
  quantity?: number;
  shipping_address?: ShippingAddress;
}

export interface OrderFilters {
  status?: OrderStatus;
  listing_type?: ListingType;
  date_from?: string;
  date_to?: string;
}

export interface OrderStats {
  total_orders: number;
  active_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_revenue: number;
  pending_revenue: number;
}

// ============================================================================
// SELLER ACCOUNTS & TRANSACTIONS
// ============================================================================

export interface SellerAccount {
  id: string;
  user_id: string;
  stripe_account_id: string | null;
  onboarding_complete: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  default_currency: string;
  country: string | null;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  order_id: string;
  type: 'payment' | 'platform_fee' | 'seller_payout' | 'refund';
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

export type SellerLevel = 'new' | 'rising' | 'established' | 'top' | 'pro';

export interface Review {
  id: string;
  order_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  communication_rating: number | null;
  quality_rating: number | null;
  value_rating: number | null;
  content: string | null;
  is_public: boolean;
  is_revealed: boolean;
  seller_response: string | null;
  seller_responded_at: string | null;
  created_at: string;

  // Joined
  reviewer?: ProductSeller;
  order?: { order_number: string; product?: { title: string } };
}

export interface SellerStats {
  user_id: string;
  avg_rating: number;
  total_reviews: number;
  total_orders: number;
  completed_orders: number;
  completion_rate: number;
  avg_response_time_hours: number;
  repeat_buyer_rate: number;
  seller_level: SellerLevel;
  member_since: string | null;
  updated_at: string;
}

export const SELLER_LEVEL_LABELS: Record<SellerLevel, string> = {
  new: 'New Creator',
  rising: 'Rising Creator',
  established: 'Established Creator',
  top: 'Top Creator',
  pro: 'Pro Creator',
};

// ============================================================================
// FEE CALCULATION
// ============================================================================

export const PLATFORM_FEES = {
  product: 0.08,    // 8% for products
  service: 0.10,    // 10% for commissions
} as const;

export function calculateFees(amount: number, listingType: ListingType) {
  const feeRate = PLATFORM_FEES[listingType];
  const platformFee = Math.round(amount * feeRate * 100) / 100;
  const sellerAmount = Math.round((amount - platformFee) * 100) / 100;
  return { platformFee, sellerAmount };
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
  mediaPreviews: { file: File; url: string; isPrimary: boolean }[];
  digitalFiles: File[];

  // Step 3: Details
  title: string;
  description: string;
  yearCreated: number | null;
  attributes: ProductAttributes;

  // Pricing
  sellOriginal: boolean;
  originalPrice: number | null;
  hasReproductions: boolean;
  reproductions: {
    type: string;
    price: number;
  }[];
  hasDigitalDownload: boolean;
  digitalPrice: number | null;
  digitalFormat: string | null;

  // Shipping (physical)
  shipping: CreateShippingData;

  // Keywords
  keywords: string[];
}

export interface CommissionPackageFormState {
  id: string;
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
  mediaPreviews: { file: File; url: string; isPrimary: boolean }[];
  packages: CommissionPackageFormState[];
  requirements: string[];
  faqs: ServiceFaqItem[];
  keywords: string[];
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
  hasReproductions: false,
  reproductions: [],
  hasDigitalDownload: false,
  digitalPrice: null,
  digitalFormat: null,
  shipping: {
    dimensions_unit: 'cm',
    weight_unit: 'kg',
    shipping_locations: [],
    shipping_services: [],
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
};

// ============================================================================
// MARKETPLACE FILTER TYPES
// ============================================================================

export type MarketplaceSortOption = 'newest' | 'price_low' | 'price_high' | 'popular';

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
