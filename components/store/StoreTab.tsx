"use client";

import { useState } from "react";
import Link from "next/link";
import { useSellerProducts } from "@/lib/hooks/useProducts";
import { Product } from "@/lib/types/store";
import { getCategoryConfig } from "@/lib/store/categories";
import Loading from "@/components/ui/Loading";

interface StoreTabProps {
  userId: string;
  isOwnProfile: boolean;
  pageLoaded: boolean;
}

export default function StoreTab({ userId, isOwnProfile, pageLoaded }: StoreTabProps) {
  const { products, loading, error } = useSellerProducts(userId);
  const [filter, setFilter] = useState<"all" | "active" | "draft">("all");

  // Filter products based on status
  const filteredProducts = products.filter((product) => {
    if (filter === "all") return true;
    if (filter === "active") return product.status === "active";
    if (filter === "draft") return product.status === "draft";
    return true;
  });

  // Only show filter controls for own profile
  const showFilters = isOwnProfile && products.length > 0;

  if (loading) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="flex items-center justify-center py-16">
          <Loading text="Loading products" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="text-center py-12 text-red-500">
          Failed to load products. Please try again.
        </div>
      </div>
    );
  }

  // Empty state
  if (products.length === 0) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="relative rounded-2xl md:rounded-3xl bg-gradient-to-br from-purple-50/90 via-white to-pink-50/80 p-8 md:p-12 lg:p-16 border border-purple-200/50 shadow-[0_8px_40px_-12px_rgba(142,68,173,0.15)] text-center">
          {/* Store Icon */}
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-purple-primary/60"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
              />
            </svg>
          </div>

          <h3 className="font-display text-xl md:text-2xl text-ink mb-3">
            {isOwnProfile ? "Start Selling" : "No Products Yet"}
          </h3>
          <p className="font-body text-muted text-[0.95rem] max-w-md mx-auto mb-6">
            {isOwnProfile
              ? "Share your creative work with the world. List your first product and start earning."
              : "This creator hasn't listed any products yet. Check back later!"}
          </p>

          {isOwnProfile && (
            <Link
              href="/sell"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid
                text-white font-medium rounded-full hover:opacity-90 transition-all shadow-md hover:shadow-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Product
            </Link>
          )}

          {/* Decorative dots */}
          <div className="mt-8 flex justify-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-primary/20" />
            <span className="w-1.5 h-1.5 rounded-full bg-pink-vivid/30" />
            <span className="w-1.5 h-1.5 rounded-full bg-orange-warm/20" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      {/* Header with filters and add button */}
      <div className="flex items-center justify-between mb-6">
        {showFilters ? (
          <div className="flex items-center gap-1 p-1 bg-black/[0.03] rounded-xl">
            <button
              onClick={() => setFilter("all")}
              className={`px-4 py-2 rounded-lg font-ui text-sm transition-all ${
                filter === "all"
                  ? "bg-white text-purple-primary shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              All ({products.length})
            </button>
            <button
              onClick={() => setFilter("active")}
              className={`px-4 py-2 rounded-lg font-ui text-sm transition-all ${
                filter === "active"
                  ? "bg-white text-purple-primary shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Active ({products.filter((p) => p.status === "active").length})
            </button>
            <button
              onClick={() => setFilter("draft")}
              className={`px-4 py-2 rounded-lg font-ui text-sm transition-all ${
                filter === "draft"
                  ? "bg-white text-purple-primary shadow-sm"
                  : "text-muted hover:text-ink"
              }`}
            >
              Drafts ({products.filter((p) => p.status === "draft").length})
            </button>
          </div>
        ) : (
          <div />
        )}

        {isOwnProfile && (
          <Link
            href="/sell"
            className="flex items-center gap-2 px-4 py-2 bg-purple-primary text-white
              font-medium text-sm rounded-xl hover:bg-purple-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
        )}
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
        {filteredProducts.map((product) => (
          <ProductCard key={product.id} product={product} isOwnProfile={isOwnProfile} />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredProducts.length === 0 && products.length > 0 && (
        <div className="text-center py-12 text-muted">
          No {filter} products found.
        </div>
      )}
    </div>
  );
}

// Product Card Component
function ProductCard({
  product,
  isOwnProfile,
}: {
  product: Product;
  isOwnProfile: boolean;
}) {
  const categoryConfig = getCategoryConfig(product.category);

  // Format price display
  const formatPrice = (price?: number) => {
    if (price === undefined) return "Price TBD";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(price);
  };

  const priceDisplay =
    product.min_price !== undefined
      ? product.min_price === product.max_price
        ? formatPrice(product.min_price)
        : `From ${formatPrice(product.min_price)}`
      : "Price TBD";

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block bg-white rounded-xl overflow-hidden border border-gray-100
        hover:border-purple-200 hover:shadow-lg transition-all duration-300"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-100">
        {product.primary_image_url ? (
          <img
            src={product.primary_image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Status badge (only for own profile) */}
        {isOwnProfile && product.status !== "active" && (
          <div
            className={`absolute top-2 left-2 px-2 py-1 rounded-md text-xs font-medium
              ${product.status === "draft"
                ? "bg-yellow-100 text-yellow-700"
                : product.status === "paused"
                ? "bg-gray-100 text-gray-600"
                : product.status === "sold"
                ? "bg-green-100 text-green-700"
                : "bg-gray-100 text-gray-600"
              }`}
          >
            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
          </div>
        )}

        {/* Category badge */}
        <div className="absolute bottom-2 left-2 px-2 py-1 rounded-md text-xs font-medium
          bg-white/90 backdrop-blur-sm text-gray-700 flex items-center gap-1">
          {categoryConfig?.name || product.category}
        </div>

        {/* Digital badge */}
        {product.delivery_type === "digital" && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md text-xs font-medium
            bg-purple-500 text-white flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Digital
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3">
        <h3 className="font-medium text-sm text-ink line-clamp-1 group-hover:text-purple-primary transition-colors">
          {product.title}
        </h3>

        <div className="flex items-center justify-between mt-1">
          <span className="text-sm font-semibold text-purple-primary">
            {priceDisplay}
          </span>
          {product.year_created && (
            <span className="text-xs text-muted">{product.year_created}</span>
          )}
        </div>
      </div>
    </Link>
  );
}
