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

export interface MarketplaceFilters {
  listing_type?: ListingType;
  category?: string;
  subcategory?: string;
  delivery_type?: ProductDelivery;
  min_price?: number;
  max_price?: number;
  max_delivery_days?: number;
  min_revisions?: number;
  keywords?: string[];
  seller_id?: string;
  sort_by?: 'newest' | 'price_low' | 'price_high' | 'popular';
}

export interface MarketplacePagination {
  page: number;
  per_page: number;
  total: number;
  has_more: boolean;
}
