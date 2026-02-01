"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useProduct } from "@/lib/hooks/useProducts";
import { useAuth } from "@/components/providers/AuthProvider";
import { Product, ProductPricing } from "@/lib/types/store";
import {
  getCategoryConfig,
  getSubcategoryLabel,
  formatAttributeValue,
  getFieldsForDelivery,
  CategoryField,
} from "@/lib/store/categories";
import Loading from "@/components/ui/Loading";
import ProductGallery from "./ProductGallery";
import SellerCard from "./SellerCard";
import ShareModal from "@/components/ui/ShareModal";

interface ProductDetailViewProps {
  productId: string;
}

export default function ProductDetailView({ productId }: ProductDetailViewProps) {
  const router = useRouter();
  const { user, profile } = useAuth();
  const { product, loading, error } = useProduct(productId);
  const [selectedPricing, setSelectedPricing] = useState<ProductPricing | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loading text="Loading product" size="large" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-ink mb-2">Product Not Found</h2>
          <p className="text-muted mb-6">This product may have been removed or doesn't exist.</p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-purple-primary text-white
              rounded-full hover:bg-purple-700 transition-colors"
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

  // Get the first available pricing if none selected
  const activePricing = selectedPricing || product.pricing?.[0];

  // Format price
  const formatPrice = (price: number, currency = "USD") => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
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
      {/* Back button */}
      <div className="max-w-7xl mx-auto px-4 py-4">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-muted hover:text-ink transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-ui text-sm">Back</span>
        </button>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Gallery */}
          <div>
            <ProductGallery media={product.media || []} title={product.title} />
          </div>

          {/* Right: Product Info */}
          <div className="lg:sticky lg:top-8 lg:self-start">
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-4">
              <span className="px-3 py-1 bg-purple-50 text-purple-primary text-sm font-medium rounded-full">
                {categoryConfig?.name || product.category}
              </span>
              {product.subcategory && (
                <span className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full">
                  {getSubcategoryLabel(product.category, product.subcategory)}
                </span>
              )}
              {product.delivery_type === "digital" && (
                <span className="px-3 py-1 bg-blue-50 text-blue-600 text-sm font-medium rounded-full flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Digital
                </span>
              )}
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-display text-ink mb-2">
              {product.title}
            </h1>

            {/* Year */}
            {product.year_created && (
              <p className="text-muted text-sm mb-4">{product.year_created}</p>
            )}

            {/* Seller */}
            {product.seller && (
              <SellerCard seller={product.seller} className="mb-6" />
            )}

            {/* Price Section */}
            {product.pricing && product.pricing.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-ink mb-4">Purchase Options</h3>

                <div className="space-y-3">
                  {product.pricing.map((pricing) => (
                    <button
                      key={pricing.id}
                      onClick={() => setSelectedPricing(pricing)}
                      className={`w-full p-4 rounded-xl border-2 text-left transition-all ${
                        activePricing?.id === pricing.id
                          ? "border-purple-primary bg-purple-50"
                          : "border-gray-200 hover:border-purple-200"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium text-ink">
                            {pricing.variant_name || getPricingTypeLabel(pricing.pricing_type)}
                          </span>
                          {pricing.pricing_type === "original" && (
                            <span className="ml-2 text-xs text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full">
                              Original
                            </span>
                          )}
                          {pricing.pricing_type === "digital_download" && (
                            <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                              Instant Download
                            </span>
                          )}
                        </div>
                        <span className="text-lg font-bold text-purple-primary">
                          {formatPrice(pricing.price, pricing.currency)}
                        </span>
                      </div>
                      {pricing.stock !== null && pricing.stock <= 5 && pricing.stock > 0 && (
                        <p className="text-xs text-orange-600 mt-1">
                          Only {pricing.stock} left
                        </p>
                      )}
                      {pricing.stock === 0 && (
                        <p className="text-xs text-red-500 mt-1">Out of stock</p>
                      )}
                    </button>
                  ))}
                </div>

                {/* Buy Button */}
                <button
                  disabled={!activePricing || activePricing.stock === 0}
                  className="w-full mt-4 py-4 bg-gradient-to-r from-purple-primary to-pink-vivid
                    text-white font-semibold rounded-xl hover:opacity-90 transition-all
                    disabled:opacity-50 disabled:cursor-not-allowed
                    shadow-lg shadow-purple-primary/20 hover:shadow-xl hover:shadow-purple-primary/30"
                >
                  {activePricing?.pricing_type === "digital_download"
                    ? "Buy & Download"
                    : "Buy Now"}
                </button>

                {/* Edit button for owner */}
                {isOwnProduct && (
                  <Link
                    href={`/product/${product.id}/edit`}
                    className="block w-full mt-3 py-3 text-center border-2 border-gray-200
                      text-gray-700 font-medium rounded-xl hover:border-purple-200 hover:text-purple-primary
                      transition-colors"
                  >
                    Edit Product
                  </Link>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setShowShareModal(true)}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700
                  hover:border-purple-200 hover:text-purple-primary transition-colors
                  flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share
              </button>
              <button
                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-700
                  hover:border-purple-200 hover:text-purple-primary transition-colors
                  flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                </svg>
                Save
              </button>
            </div>

            {/* Shipping Info */}
            {product.delivery_type !== "digital" && product.shipping && (
              <div className="bg-gray-50 rounded-xl p-4 mb-6">
                <h4 className="font-medium text-ink mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                  </svg>
                  Shipping
                </h4>
                <div className="text-sm text-muted space-y-1">
                  {product.shipping.shipping_locations?.length > 0 && (
                    <p>Ships to: {product.shipping.shipping_locations.join(", ")}</p>
                  )}
                  {product.shipping.processing_days && (
                    <p>Processing: {product.shipping.processing_days} days</p>
                  )}
                  {product.shipping.packaging && (
                    <p>Packaging: {product.shipping.packaging}</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Description & Details */}
        <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Description */}
          <div className="lg:col-span-2">
            {product.description && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
                <h3 className="font-semibold text-ink mb-4">Description</h3>
                <div className="prose prose-sm max-w-none text-muted">
                  {product.description.split("\n").map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Attributes/Details */}
            {displayAttributes.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-ink mb-4">Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {displayAttributes.map((attr, i) => (
                    <div key={i} className="border-b border-gray-100 pb-3 last:border-0">
                      <dt className="text-xs text-muted uppercase tracking-wider mb-1">
                        {attr.label}
                      </dt>
                      <dd className="text-sm text-ink font-medium">{attr.value}</dd>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Dimensions (for physical) */}
          {product.delivery_type !== "digital" && product.shipping && (
            <div>
              <div className="bg-white rounded-2xl border border-gray-100 p-6">
                <h3 className="font-semibold text-ink mb-4">Dimensions</h3>
                <div className="space-y-3">
                  {product.shipping.height && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Height</span>
                      <span className="text-ink">
                        {product.shipping.height} {product.shipping.dimensions_unit}
                      </span>
                    </div>
                  )}
                  {product.shipping.width && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Width</span>
                      <span className="text-ink">
                        {product.shipping.width} {product.shipping.dimensions_unit}
                      </span>
                    </div>
                  )}
                  {product.shipping.thickness && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Thickness</span>
                      <span className="text-ink">
                        {product.shipping.thickness} {product.shipping.dimensions_unit}
                      </span>
                    </div>
                  )}
                  {product.shipping.weight && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted">Weight</span>
                      <span className="text-ink">
                        {product.shipping.weight} {product.shipping.weight_unit}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Keywords */}
              {product.keywords && product.keywords.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium text-muted mb-3">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {product.keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="px-3 py-1 bg-gray-100 text-gray-600 text-sm rounded-full"
                      >
                        {keyword}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
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
