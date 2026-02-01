"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProduct } from "@/lib/hooks/useProducts";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductPricing } from "@/lib/types/store";
import {
  getCategoryConfig,
  getSubcategoryLabel,
  formatAttributeValue,
  getFieldsForDelivery,
} from "@/lib/store/categories";
import ProductGallery from "./ProductGallery";
import SellerCard from "./SellerCard";
import ShareModal from "@/components/ui/ShareModal";

interface ProductDetailViewProps {
  productId: string;
}

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { product, loading, error } = useProduct(productId);
  const [selectedPricing, setSelectedPricing] = useState<ProductPricing | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  // Loading state - elegant skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Back button skeleton */}
          <div className="w-20 h-8 bg-gray-100 rounded-lg animate-pulse mb-8" />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Gallery skeleton */}
            <div className="aspect-square rounded-2xl bg-gradient-to-br from-purple-50 to-pink-50 animate-pulse" />

            {/* Info skeleton */}
            <div className="space-y-6">
              <div className="flex gap-2">
                <div className="w-24 h-7 bg-purple-100 rounded-full animate-pulse" />
                <div className="w-20 h-7 bg-gray-100 rounded-full animate-pulse" />
              </div>
              <div className="w-3/4 h-10 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-full h-24 bg-gray-50 rounded-xl animate-pulse" />
              <div className="w-full h-48 bg-gray-50 rounded-2xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="relative w-24 h-24 mx-auto mb-8">
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-100 to-pink-100" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-purple-primary/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-display text-ink mb-3">Product Not Found</h2>
          <p className="text-muted font-body mb-8">This product may have been removed or doesn't exist.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid
              text-white font-ui font-medium rounded-xl hover:shadow-lg hover:shadow-purple-primary/20
              transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const categoryConfig = getCategoryConfig(product.category);
  const isOwnProduct = user?.id === product.seller_id;
  const activePricing = selectedPricing || product.pricing?.[0];

  // Format price
  const formatPrice = (price: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(price);
  };

  // Get displayable attributes
  const getDisplayAttributes = () => {
    if (!categoryConfig || !product.attributes) return [];

    const effectiveDelivery = product.delivery_type === "both" ? "physical" : product.delivery_type;
    const fields = getFieldsForDelivery(product.category, effectiveDelivery);

    return fields
      .filter((field) => {
        const value = product.attributes[field.key];
        return value !== undefined && value !== null && value !== "" &&
          !(Array.isArray(value) && value.length === 0);
      })
      .map((field) => ({
        label: field.label,
        value: formatAttributeValue(field, product.attributes[field.key]),
        group: field.group,
      }));
  };

  const displayAttributes = getDisplayAttributes();

  return (
    <div className="min-h-screen bg-background">
      {/* Back button - elegant */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <button
          onClick={() => router.back()}
          className="group flex items-center gap-2 text-muted hover:text-purple-primary transition-colors"
        >
          <div className="w-8 h-8 rounded-lg bg-gray-50 group-hover:bg-purple-50 flex items-center justify-center transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </div>
          <span className="font-ui text-sm">Back</span>
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Gallery */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ProductGallery media={product.media || []} title={product.title} />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Category badges */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-4 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50
                text-purple-primary text-sm font-ui font-medium rounded-full
                border border-purple-100/50">
                {categoryConfig?.name || product.category}
              </span>
              {product.subcategory && (
                <span className="px-4 py-1.5 bg-gray-50 text-gray-600 text-sm font-ui rounded-full">
                  {getSubcategoryLabel(product.category, product.subcategory)}
                </span>
              )}
              {product.delivery_type === "digital" && (
                <span className="px-4 py-1.5 bg-gradient-to-r from-purple-primary to-pink-vivid
                  text-white text-sm font-ui font-medium rounded-full
                  flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Digital Download
                </span>
              )}
            </div>

            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-semibold text-ink leading-tight">
                {product.title}
              </h1>
              {product.year_created && (
                <p className="mt-2 text-muted font-body">{product.year_created}</p>
              )}
            </div>

            {/* Seller */}
            {product.seller && (
              <SellerCard seller={product.seller} />
            )}

            {/* Price Section - Beautiful card */}
            {product.pricing && product.pricing.length > 0 && (
              <div className="relative overflow-hidden bg-white rounded-2xl border border-gray-100 shadow-sm">
                {/* Decorative gradient */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm" />

                <div className="p-6">
                  <h3 className="font-display font-semibold text-ink mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Purchase Options
                  </h3>

                  <div className="space-y-3">
                    {product.pricing.map((pricing) => (
                      <button
                        key={pricing.id}
                        onClick={() => setSelectedPricing(pricing)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                          activePricing?.id === pricing.id
                            ? "border-purple-primary bg-gradient-to-r from-purple-50/50 to-pink-50/50 shadow-sm"
                            : "border-gray-100 hover:border-purple-200 hover:bg-gray-50/50"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {/* Radio indicator */}
                            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                              activePricing?.id === pricing.id
                                ? "border-purple-primary"
                                : "border-gray-300"
                            }`}>
                              {activePricing?.id === pricing.id && (
                                <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid" />
                              )}
                            </div>
                            <div>
                              <span className="font-ui font-medium text-ink">
                                {pricing.variant_name || getPricingTypeLabel(pricing.pricing_type)}
                              </span>
                              {pricing.pricing_type === "original" && (
                                <span className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wider
                                  bg-gradient-to-r from-orange-warm/10 to-orange-warm/5 text-orange-warm
                                  rounded-md font-ui font-medium">
                                  Original
                                </span>
                              )}
                              {pricing.pricing_type === "digital_download" && (
                                <span className="ml-2 px-2 py-0.5 text-[10px] uppercase tracking-wider
                                  bg-gradient-to-r from-purple-primary/10 to-pink-vivid/10 text-purple-primary
                                  rounded-md font-ui font-medium">
                                  Instant Download
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xl font-display font-bold bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                            {formatPrice(pricing.price, pricing.currency)}
                          </span>
                        </div>
                        {pricing.stock !== null && pricing.stock <= 5 && pricing.stock > 0 && (
                          <p className="text-xs text-orange-warm mt-2 ml-8 font-ui">
                            Only {pricing.stock} left in stock
                          </p>
                        )}
                        {pricing.stock === 0 && (
                          <p className="text-xs text-red-500 mt-2 ml-8 font-ui">Out of stock</p>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* Buy Button */}
                  <button
                    disabled={!activePricing || activePricing.stock === 0}
                    className="w-full mt-6 py-4 bg-gradient-to-r from-purple-primary to-pink-vivid
                      text-white font-display font-semibold text-lg rounded-xl
                      hover:shadow-xl hover:shadow-purple-primary/25 hover:scale-[1.01]
                      transition-all duration-200
                      disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
                      flex items-center justify-center gap-2"
                  >
                    {activePricing?.pricing_type === "digital_download" ? (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Buy & Download
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                        Buy Now
                      </>
                    )}
                  </button>

                  {/* Edit button for owner */}
                  {isOwnProduct && (
                    <Link
                      href={`/product/${product.id}/edit`}
                      className="block w-full mt-3 py-3 text-center border-2 border-gray-100
                        text-muted font-ui font-medium rounded-xl
                        hover:border-purple-200 hover:text-purple-primary hover:bg-purple-50/30
                        transition-all duration-200"
                    >
                      Edit Product
                    </Link>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex-1 py-3.5 bg-gray-50 rounded-xl text-ink font-ui font-medium
                  hover:bg-purple-50 hover:text-purple-primary
                  transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                className="flex-1 py-3.5 bg-gray-50 rounded-xl text-ink font-ui font-medium
                  hover:bg-pink-50 hover:text-pink-vivid
                  transition-all duration-200 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Save
              </button>
            </div>

            {/* Shipping Info */}
            {product.delivery_type !== "digital" && product.shipping && (
              <div className="bg-gradient-to-br from-gray-50 to-white rounded-xl p-5 border border-gray-100/50">
                <h4 className="font-ui font-medium text-ink mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Shipping & Handling
                </h4>
                <div className="text-sm text-muted font-body space-y-2">
                  {product.shipping.shipping_locations?.length > 0 && (
                    <p className="flex items-start gap-2">
                      <span className="text-purple-primary/50">Ships to:</span>
                      <span className="text-ink">{product.shipping.shipping_locations.join(", ")}</span>
                    </p>
                  )}
                  {product.shipping.processing_days && (
                    <p className="flex items-start gap-2">
                      <span className="text-purple-primary/50">Processing:</span>
                      <span className="text-ink">{product.shipping.processing_days} business days</span>
                    </p>
                  )}
                  {product.shipping.packaging && (
                    <p className="flex items-start gap-2">
                      <span className="text-purple-primary/50">Packaging:</span>
                      <span className="text-ink capitalize">{product.shipping.packaging.replace(/_/g, ' ')}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description & Details Section */}
        <div className="mt-16 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Description - Full width on mobile, 2 cols on desktop */}
          <div className="lg:col-span-2 space-y-8">
            {product.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
                <h3 className="font-display font-semibold text-xl text-ink mb-4 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-purple-primary to-pink-vivid rounded-full" />
                  About This Work
                </h3>
                <div className="prose prose-gray max-w-none text-muted font-body leading-relaxed">
                  {product.description.split("\n").map((paragraph, i) => (
                    <p key={i} className="mb-4 last:mb-0">{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Attributes/Details */}
            {displayAttributes.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
                <h3 className="font-display font-semibold text-xl text-ink mb-6 flex items-center gap-2">
                  <span className="w-1 h-6 bg-gradient-to-b from-pink-vivid to-orange-warm rounded-full" />
                  Details & Specifications
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {displayAttributes.map((attr, i) => (
                    <div key={i} className="p-4 rounded-xl bg-gradient-to-br from-gray-50 to-white">
                      <dt className="text-xs text-muted uppercase tracking-wider font-ui mb-1">
                        {attr.label}
                      </dt>
                      <dd className="text-sm text-ink font-body font-medium">{attr.value}</dd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar - Dimensions & Keywords */}
          <div className="space-y-6">
            {/* Dimensions (for physical) */}
            {product.delivery_type !== "digital" && product.shipping && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-display font-semibold text-ink mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  Dimensions
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Height", value: product.shipping.height },
                    { label: "Width", value: product.shipping.width },
                    { label: "Thickness", value: product.shipping.thickness },
                    { label: "Weight", value: product.shipping.weight, unit: product.shipping.weight_unit },
                  ].filter(d => d.value).map((dim, i) => (
                    <div key={i} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-muted font-body">{dim.label}</span>
                      <span className="text-sm text-ink font-ui font-medium">
                        {dim.value} {dim.unit || product.shipping?.dimensions_unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keywords */}
            {product.keywords && product.keywords.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h4 className="font-display font-semibold text-ink mb-4">Keywords</h4>
                <div className="flex flex-wrap gap-2">
                  {product.keywords.map((keyword) => (
                    <span
                      key={keyword}
                      className="px-3 py-1.5 bg-gradient-to-r from-purple-50 to-pink-50
                        text-purple-primary/80 text-sm font-ui rounded-lg
                        border border-purple-100/30"
                    >
                      {keyword}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Modal */}
      <ShareModal
        isOpen={showShareModal}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={product.title}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}

// Helper function to get pricing type label
function getPricingTypeLabel(type: string): string {
  switch (type) {
    case "original":
      return "Original Piece";
    case "reproduction":
      return "Reproduction";
    case "digital_download":
      return "Digital Download";
    default:
      return type;
  }
}
