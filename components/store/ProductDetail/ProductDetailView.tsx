"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProduct, useToggleSaveProduct } from "@/lib/hooks/useProducts";
import { useAuth } from "@/components/providers/AuthProvider";
import { ProductPricing } from "@/lib/types/store";
import {
  getCategoryConfig,
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
  const { toggle: toggleSave, checkIsSaved } = useToggleSaveProduct();
  const [selectedPricing, setSelectedPricing] = useState<ProductPricing | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  // Check if product is saved
  useEffect(() => {
    if (user && productId) {
      checkIsSaved(productId, user.id).then(setIsSaved);
    }
  }, [user, productId, checkIsSaved]);

  useEffect(() => {
    if (product?.listing_type === "service") {
      router.replace(`/commissions/${product.id}`);
    }
  }, [product, router]);

  const handleToggleSave = async () => {
    if (!user) return;
    const newSavedState = !isSaved;
    setIsSaved(newSavedState); // Optimistic update
    const success = await toggleSave(productId, user.id, isSaved);
    if (!success) {
      setIsSaved(isSaved); // Revert on error
    }
  };

  // Loading state
  if (loading || product?.listing_type === "service") {
    return (
      <div className="min-h-screen bg-background py-8 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
            <div className="flex gap-4">
              <div className="hidden md:flex flex-col gap-3 w-20">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="w-20 h-20 rounded-xl bg-gray-100 animate-pulse" />
                ))}
              </div>
              <div className="flex-1 aspect-square rounded-2xl bg-gradient-to-br from-pink-50 to-orange-50 animate-pulse" />
            </div>
            <div className="space-y-6">
              <div className="w-3/4 h-8 bg-gray-100 rounded-lg animate-pulse" />
              <div className="w-1/2 h-6 bg-gray-100 rounded-lg animate-pulse" />
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
          <p className="text-muted font-body mb-8">This product may have been removed or doesn&apos;t exist.</p>
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

  const formatPrice = (price: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

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
    <div className="min-h-screen bg-background pt-8">
      <div className="max-w-6xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Gallery */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            <ProductGallery
              media={product.media || []}
              title={product.title}
              isLiked={isLiked}
              onLike={() => setIsLiked(!isLiked)}
            />
          </div>

          {/* Right: Product Info */}
          <div className="space-y-4">
            {/* Row 1: Custom work available + 3-dots menu */}
            <div className="flex items-center justify-between">
              {product.delivery_type !== "digital" ? (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 21l4-6m4 6l-4-6" />
                    <rect x="4" y="3" width="16" height="12" rx="1" />
                    <rect x="6" y="5" width="12" height="8" rx="0.5" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 15h16" />
                  </svg>
                  <span className="text-sm font-ui text-pink-vivid font-medium">
                    Custom work available
                  </span>
                </div>
              ) : (
                <div />
              )}
              <MoreMenu
                onShare={() => setShowShareModal(true)}
                onSave={handleToggleSave}
                isSaved={isSaved}
                isLoggedIn={!!user}
              />
            </div>

            {/* Title & Artist */}
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-ink leading-tight mb-1">
                {product.title}
              </h1>
              {product.seller && (
                <p className="text-base text-muted font-body">
                  by{" "}
                  <Link
                    href={`/studio/${product.seller.username}`}
                    className="text-pink-vivid hover:text-orange-warm transition-colors font-medium"
                  >
                    {product.seller.display_name || product.seller.username}
                  </Link>
                </p>
              )}
            </div>

            {/* Price */}
            {activePricing && (
              <div className="flex items-baseline gap-3 pt-2">
                <span className="text-3xl font-display font-bold text-ink">
                  {formatPrice(activePricing.price, activePricing.currency)}
                </span>
                {activePricing.pricing_type === "original" && (
                  <span className="text-sm text-orange-warm font-ui font-medium">
                    Original
                  </span>
                )}
              </div>
            )}

            {/* Pricing Options (if multiple) */}
            {product.pricing && product.pricing.length > 1 && (
              <div className="space-y-1">
                {product.pricing.map((pricing) => (
                  <button
                    key={pricing.id}
                    onClick={() => setSelectedPricing(pricing)}
                    className="w-full text-left flex items-center justify-between py-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        activePricing?.id === pricing.id ? "border-pink-vivid" : "border-gray-300"
                      }`}>
                        {activePricing?.id === pricing.id && (
                          <div className="w-2 h-2 rounded-full bg-pink-vivid" />
                        )}
                      </div>
                      <span className={`font-ui ${activePricing?.id === pricing.id ? "text-ink font-medium" : "text-muted"}`}>
                        {pricing.variant_name || getPricingTypeLabel(pricing.pricing_type)}
                      </span>
                    </div>
                    <span className={`font-display font-semibold ${activePricing?.id === pricing.id ? "text-pink-vivid" : "text-muted"}`}>
                      {formatPrice(pricing.price, pricing.currency)}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Shipping info (inline) */}
            {product.delivery_type !== "digital" && product.shipping && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted">
                {product.shipping.shipping_locations?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Ships to {product.shipping.shipping_locations.slice(0, 2).join(", ")}{product.shipping.shipping_locations.length > 2 ? "..." : ""}</span>
                  </div>
                )}
                {product.shipping.processing_days && (
                  <div className="flex items-center gap-1.5">
                    <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{product.shipping.processing_days} days processing</span>
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            {product.description && (
              <div className="pt-2">
                <p className="text-muted font-body leading-relaxed text-sm line-clamp-3">
                  {product.description}
                </p>
              </div>
            )}

            {/* Ask the artist */}
            {product.seller && (
              <Link
                href="/messages"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-pink-vivid hover:text-orange-warm transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="text-sm font-ui font-medium">
                  Ask the artist a question
                </span>
              </Link>
            )}

            {/* Add to Cart */}
            <button
              disabled={!activePricing || activePricing.stock === 0}
              className="w-full py-4 bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
                text-white font-display font-bold text-lg rounded-xl
                hover:shadow-xl hover:shadow-pink-vivid/25 hover:scale-[1.02]
                transition-all duration-300 mt-6
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

        {/* Product Details Section - Below the photo */}
        <div className="mt-12 max-w-3xl">
          {/* Product Details Header - Expandable */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full py-3 flex items-center justify-between border-t border-gray-100"
          >
            <span className="font-display font-semibold text-lg text-ink">Product Details</span>
            <svg
              className={`w-5 h-5 text-muted transition-transform duration-300 ${showDetails ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expanded Content */}
          {showDetails && (
            <div className="pt-4 pb-8 space-y-6">
              {/* Specifications */}
              {displayAttributes.length > 0 && (
                <div>
                  <h3 className="font-ui font-medium text-sm uppercase tracking-wider text-muted mb-3">
                    Specifications
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3">
                    {displayAttributes.map((attr, i) => (
                      <div key={i}>
                        <p className="text-xs text-muted mb-0.5">{attr.label}</p>
                        <p className="text-sm text-ink">{attr.value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dimensions */}
              {product.delivery_type !== "digital" && product.shipping && (
                (product.shipping.height || product.shipping.width || product.shipping.thickness || product.shipping.weight) && (
                  <div>
                    <h3 className="font-ui font-medium text-sm uppercase tracking-wider text-muted mb-3">
                      Dimensions
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
                      {[
                        { label: "Height", value: product.shipping.height, unit: product.shipping.dimensions_unit },
                        { label: "Width", value: product.shipping.width, unit: product.shipping.dimensions_unit },
                        { label: "Depth", value: product.shipping.thickness, unit: product.shipping.dimensions_unit },
                        { label: "Weight", value: product.shipping.weight, unit: product.shipping.weight_unit },
                      ].filter(d => d.value).map((dim, i) => (
                        <div key={i}>
                          <span className="text-lg font-display font-semibold text-ink">{dim.value}</span>
                          <span className="text-sm text-muted ml-1">{dim.unit}</span>
                          <p className="text-xs text-muted">{dim.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              )}

              {/* Shipping Details */}
              {product.delivery_type !== "digital" && product.shipping && (
                <div>
                  <h3 className="font-ui font-medium text-sm uppercase tracking-wider text-muted mb-3">
                    Shipping & Handling
                  </h3>
                  <div className="space-y-2">
                    {product.shipping.shipping_locations?.length > 0 && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Ships to:</span>
                        <span className="text-ink">{product.shipping.shipping_locations.join(", ")}</span>
                      </div>
                    )}
                    {product.shipping.processing_days && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Processing:</span>
                        <span className="text-ink">{product.shipping.processing_days} business days</span>
                      </div>
                    )}
                    {product.shipping.packaging && (
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted">Packaging:</span>
                        <span className="text-ink capitalize">{product.shipping.packaging.replace(/_/g, " ")}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Keywords */}
              {product.keywords && product.keywords.length > 0 && (
                <div>
                  <h3 className="font-ui font-medium text-sm uppercase tracking-wider text-muted mb-3">
                    Tags
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {product.keywords.map((keyword) => (
                      <span key={keyword} className="text-sm text-muted">
                        #{keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seller Card - mobile only */}
        {product.seller && (
          <div className="mt-12 lg:hidden">
            <SellerCard seller={product.seller} />
          </div>
        )}
      </div>

      <ShareModal
        isOpen={showShareModal}
        url={typeof window !== "undefined" ? window.location.href : ""}
        title={product.title}
        onClose={() => setShowShareModal(false)}
      />
    </div>
  );
}

function getPricingTypeLabel(type: string): string {
  switch (type) {
    case "original": return "Original Piece";
    case "reproduction": return "Reproduction";
    case "digital_download": return "Digital Download";
    default: return type;
  }
}

function MoreMenu({
  onShare,
  onSave,
  isSaved,
  isLoggedIn
}: {
  onShare: () => void;
  onSave: () => void;
  isSaved: boolean;
  isLoggedIn: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-muted hover:text-ink transition-colors"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-40 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
            {isLoggedIn && (
              <button
                onClick={() => { onSave(); setIsOpen(false); }}
                className="w-full px-4 py-3 text-left text-sm font-ui text-ink
                  hover:bg-gradient-to-r hover:from-purple-primary/5 hover:via-pink-vivid/5 hover:to-orange-warm/5
                  flex items-center gap-3 transition-colors"
              >
                <svg className="w-4 h-4 text-purple-primary" fill={isSaved ? "currentColor" : "none"} stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
                {isSaved ? "Saved" : "Save"}
              </button>
            )}
            <button
              onClick={() => { onShare(); setIsOpen(false); }}
              className="w-full px-4 py-3 text-left text-sm font-ui text-ink
                hover:bg-gradient-to-r hover:from-purple-primary/5 hover:via-pink-vivid/5 hover:to-orange-warm/5
                flex items-center gap-3 transition-colors"
            >
              <svg className="w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="w-full px-4 py-3 text-left text-sm font-ui text-red-500
                hover:bg-red-50 flex items-center gap-3 transition-colors"
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
