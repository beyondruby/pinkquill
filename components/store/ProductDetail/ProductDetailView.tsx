"use client";

import { useState } from "react";
import Link from "next/link";
import { useProduct } from "@/lib/hooks/useProducts";
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
  const { product, loading, error } = useProduct(productId);
  const [selectedPricing, setSelectedPricing] = useState<ProductPricing | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    about: true,
    shipping: false,
    details: false,
  });

  // Loading state - elegant skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Breadcrumb skeleton */}
          <div className="flex gap-2 mb-8">
            <div className="w-24 h-5 bg-gray-100 rounded animate-pulse" />
            <div className="w-4 h-5 bg-gray-100 rounded animate-pulse" />
            <div className="w-32 h-5 bg-gray-100 rounded animate-pulse" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            {/* Gallery skeleton */}
            <div className="flex gap-4">
              <div className="hidden md:flex flex-col gap-3 w-20">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-20 h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
              <div className="flex-1 aspect-square rounded-2xl bg-gradient-to-br from-pink-50 to-orange-50 animate-pulse" />
            </div>

            {/* Info skeleton */}
            <div className="space-y-6">
              <div className="w-3/4 h-8 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-1/2 h-6 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-full h-16 bg-gray-50 rounded-xl animate-pulse" />
              <div className="w-full h-14 bg-gradient-to-r from-orange-100 to-pink-100 rounded-xl animate-pulse" />
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
            <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-pink-100 to-orange-100" />
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-12 h-12 text-pink-vivid/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-display text-ink mb-3">Product Not Found</h2>
          <p className="text-muted font-body mb-8">This product may have been removed or doesn't exist.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-warm to-pink-vivid
              text-white font-ui font-medium rounded-xl hover:shadow-lg hover:shadow-pink-vivid/20
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
  const activePricing = selectedPricing || product.pricing?.[0];

  // Format price
  const formatPrice = (price: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
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

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  return (
    <div className="min-h-screen bg-background pt-8">
      {/* Main content */}
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Gallery with vertical thumbnails */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ProductGallery
              media={product.media || []}
              title={product.title}
              likeCount={264}
              isLiked={isLiked}
              onLike={() => setIsLiked(!isLiked)}
            />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-6">
            {/* Custom work notice */}
            {product.delivery_type !== "digital" && (
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-50 to-pink-50
                rounded-full border border-pink-100/50">
                <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
                <span className="text-sm font-ui text-pink-vivid font-medium">
                  Custom work available
                </span>
              </div>
            )}

            {/* Title */}
            <div>
              <h1 className="text-3xl md:text-4xl font-display font-bold text-ink leading-tight">
                {product.title}
              </h1>

              {/* Artist attribution */}
              {product.seller && (
                <p className="mt-3 text-lg text-muted font-body">
                  by{" "}
                  <Link
                    href={`/studio/${product.seller.username}`}
                    className="text-pink-vivid hover:underline font-medium"
                  >
                    {product.seller.display_name || product.seller.username}
                  </Link>
                </p>
              )}
            </div>

            {/* Price Display */}
            {activePricing && (
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-display font-bold text-ink">
                  {formatPrice(activePricing.price, activePricing.currency)}
                </span>
                {activePricing.pricing_type === "original" && (
                  <span className="px-3 py-1 text-xs uppercase tracking-wider
                    bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10
                    text-orange-warm font-ui font-medium rounded-full">
                    Original
                  </span>
                )}
              </div>
            )}

            {/* Pricing Options (if multiple) */}
            {product.pricing && product.pricing.length > 1 && (
              <div className="space-y-2">
                {product.pricing.map((pricing) => (
                  <button
                    key={pricing.id}
                    onClick={() => setSelectedPricing(pricing)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${
                      activePricing?.id === pricing.id
                        ? "border-pink-vivid bg-gradient-to-r from-pink-50/50 to-orange-50/50"
                        : "border-gray-100 hover:border-pink-200"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          activePricing?.id === pricing.id
                            ? "border-pink-vivid"
                            : "border-gray-300"
                        }`}>
                          {activePricing?.id === pricing.id && (
                            <div className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-orange-warm to-pink-vivid" />
                          )}
                        </div>
                        <span className="font-ui font-medium text-ink">
                          {pricing.variant_name || getPricingTypeLabel(pricing.pricing_type)}
                        </span>
                      </div>
                      <span className="font-display font-bold text-ink">
                        {formatPrice(pricing.price, pricing.currency)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Ask the artist link + More menu */}
            <div className="flex items-center justify-between">
              <button className="flex items-center gap-2 text-pink-vivid hover:text-orange-warm transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm font-ui font-medium underline">
                  Ask the artist a question
                </span>
              </button>

              {/* Horizontal 3-dots menu */}
              <MoreMenu
                onShare={() => setShowShareModal(true)}
              />
            </div>

            {/* Add to Cart Button - Orange Gradient */}
            <button
              disabled={!activePricing || activePricing.stock === 0}
              className="w-full py-4 bg-gradient-to-r from-orange-warm to-pink-vivid
                text-white font-display font-bold text-lg rounded-xl
                hover:shadow-xl hover:shadow-orange-warm/25 hover:scale-[1.02]
                transition-all duration-300
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none
                flex items-center justify-center gap-3"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Add to Cart
            </button>
          </div>
        </div>

        {/* Learn More Section - Below the photo/info grid */}
        <div className="mt-12 max-w-3xl">
          <div className="space-y-4">
              {/* About this artwork */}
              {product.description && (
                <div className="border-b border-gray-100">
                  <button
                    onClick={() => toggleSection("about")}
                    className="w-full py-4 flex items-center justify-between"
                  >
                    <span className="font-display font-semibold text-ink">About this artwork</span>
                    <svg
                      className={`w-5 h-5 text-muted transition-transform duration-300 ${
                        expandedSections.about ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.about && (
                    <div className="pb-6 text-muted font-body leading-relaxed">
                      {product.description.split("\n").map((paragraph, i) => (
                        <p key={i} className="mb-3 last:mb-0">{paragraph}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Shipping */}
              {product.delivery_type !== "digital" && product.shipping && (
                <div className="border-b border-gray-100">
                  <button
                    onClick={() => toggleSection("shipping")}
                    className="w-full py-4 flex items-center justify-between"
                  >
                    <span className="font-display font-semibold text-ink">Shipping</span>
                    <svg
                      className={`w-5 h-5 text-muted transition-transform duration-300 ${
                        expandedSections.shipping ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.shipping && (
                    <div className="pb-6 space-y-3 text-sm">
                      {product.shipping.shipping_locations?.length > 0 && (
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-pink-vivid/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-muted/60 font-ui text-xs uppercase tracking-wider mb-1">Ships to</p>
                            <p className="text-ink font-body">{product.shipping.shipping_locations.join(", ")}</p>
                          </div>
                        </div>
                      )}
                      {product.shipping.processing_days && (
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-pink-vivid/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div>
                            <p className="text-muted/60 font-ui text-xs uppercase tracking-wider mb-1">Processing time</p>
                            <p className="text-ink font-body">{product.shipping.processing_days} business days</p>
                          </div>
                        </div>
                      )}
                      {product.shipping.packaging && (
                        <div className="flex items-start gap-3">
                          <svg className="w-5 h-5 text-pink-vivid/60 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                          <div>
                            <p className="text-muted/60 font-ui text-xs uppercase tracking-wider mb-1">Packaging</p>
                            <p className="text-ink font-body capitalize">{product.shipping.packaging.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Details & Specifications */}
              {displayAttributes.length > 0 && (
                <div className="border-b border-gray-100">
                  <button
                    onClick={() => toggleSection("details")}
                    className="w-full py-4 flex items-center justify-between"
                  >
                    <span className="font-display font-semibold text-ink">Details</span>
                    <svg
                      className={`w-5 h-5 text-muted transition-transform duration-300 ${
                        expandedSections.details ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedSections.details && (
                    <div className="pb-6">
                      <div className="grid grid-cols-2 gap-4">
                        {displayAttributes.map((attr, i) => (
                          <div key={i} className="p-3 rounded-xl bg-gray-50">
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
              )}

              {/* Dimensions (for physical) */}
              {product.delivery_type !== "digital" && product.shipping && (
                (product.shipping.height || product.shipping.width || product.shipping.thickness || product.shipping.weight) && (
                  <div className="pt-4">
                    <h4 className="font-display font-semibold text-ink mb-4">Dimensions</h4>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Height", value: product.shipping.height, unit: product.shipping.dimensions_unit },
                        { label: "Width", value: product.shipping.width, unit: product.shipping.dimensions_unit },
                        { label: "Thickness", value: product.shipping.thickness, unit: product.shipping.dimensions_unit },
                        { label: "Weight", value: product.shipping.weight, unit: product.shipping.weight_unit },
                      ].filter(d => d.value).map((dim, i) => (
                        <div key={i} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                          <span className="text-sm text-muted font-body">{dim.label}</span>
                          <span className="text-sm text-ink font-ui font-medium">
                            {dim.value} {dim.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Keywords */}
              {product.keywords && product.keywords.length > 0 && (
                <div className="pt-6">
                  <h4 className="font-display font-semibold text-ink mb-4">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1.5 bg-gradient-to-r from-pink-50 to-orange-50
                          text-pink-vivid/80 text-sm font-ui rounded-lg
                          border border-pink-100/30"
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

        {/* Seller Card - below on mobile, sticky sidebar concept */}
        {product.seller && (
          <div className="mt-12 lg:hidden">
            <SellerCard seller={product.seller} />
          </div>
        )}
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

// More menu component with horizontal dots
function MoreMenu({ onShare }: { onShare: () => void }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted hover:text-ink transition-colors"
      >
        {/* Horizontal 3 dots - no circle */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
            <button
              onClick={() => {
                onShare();
                setIsOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm font-ui text-ink
                hover:bg-gradient-to-r hover:from-orange-50 hover:to-pink-50
                flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-3 text-left text-sm font-ui text-red-500
                hover:bg-red-50
                flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
              Report
            </button>
          </div>
        </>
      )}
    </div>
  );
}
