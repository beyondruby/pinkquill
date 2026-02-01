"use client";

import { useState } from "react";
import Link from "next/link";
import { useSellerProducts } from "@/lib/hooks/useProducts";
import { Product } from "@/lib/types/store";
import { getCategoryConfig, CATEGORY_ICONS } from "@/lib/store/categories";

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
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-2 border-purple-primary/20 border-t-purple-primary animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-5 h-5 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
            </div>
            <p className="text-sm text-muted font-body">Loading store...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="text-center py-12">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-red-500 font-medium mb-2">Failed to load products</p>
          <p className="text-sm text-muted">Please try refreshing the page</p>
        </div>
      </div>
    );
  }

  // Empty state - beautiful and inviting
  if (products.length === 0) {
    return (
      <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
        <div className="relative overflow-hidden rounded-2xl md:rounded-3xl bg-gradient-to-br from-purple-50/80 via-white to-pink-50/60 p-8 md:p-12 lg:p-16 border border-purple-100/50">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-primary/5 to-pink-vivid/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-orange-warm/5 to-pink-vivid/5 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />

          <div className="relative text-center">
            {/* Animated store icon */}
            <div className="relative w-24 h-24 mx-auto mb-8">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-purple-primary/10 to-pink-vivid/10 animate-pulse" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-12 h-12 text-purple-primary/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
              </div>
              {/* Floating sparkles */}
              <div className="absolute -top-2 -right-2 w-4 h-4 text-orange-warm animate-bounce" style={{ animationDelay: '0.1s' }}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8l-6.4 4.4 2.4-7.2-6-4.8h7.6L12 2z"/></svg>
              </div>
              <div className="absolute -bottom-1 -left-1 w-3 h-3 text-pink-vivid animate-bounce" style={{ animationDelay: '0.3s' }}>
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.4 7.2H22l-6 4.8 2.4 7.2L12 16.8l-6.4 4.4 2.4-7.2-6-4.8h7.6L12 2z"/></svg>
              </div>
            </div>

            <h3 className="font-display text-2xl md:text-3xl text-ink mb-4">
              {isOwnProfile ? (
                <>
                  Open Your{" "}
                  <span className="bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent">
                    Creative Store
                  </span>
                </>
              ) : (
                "No Products Yet"
              )}
            </h3>

            <p className="font-body text-muted text-base md:text-lg max-w-md mx-auto mb-8 leading-relaxed">
              {isOwnProfile
                ? "Transform your creativity into opportunity. Share your art, music, writings, and handcrafted treasures with the world."
                : "This creator hasn't listed any products yet. Check back later to discover their unique creations!"}
            </p>

            {isOwnProfile && (
              <Link
                href="/sell"
                className="group inline-flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-purple-primary to-pink-vivid
                  text-white font-display font-medium text-lg rounded-2xl
                  hover:shadow-xl hover:shadow-purple-primary/25 hover:scale-[1.02]
                  transition-all duration-300"
              >
                <svg className="w-5 h-5 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                List Your First Product
              </Link>
            )}

            {/* Feature highlights for own profile */}
            {isOwnProfile && (
              <div className="mt-12 grid grid-cols-3 gap-4 max-w-lg mx-auto">
                {[
                  { icon: "🎨", label: "Art & Prints" },
                  { icon: "📚", label: "Books & Zines" },
                  { icon: "🎵", label: "Music & Audio" },
                ].map((item, i) => (
                  <div key={i} className="p-3 rounded-xl bg-white/60 border border-purple-100/50">
                    <span className="text-2xl mb-1 block">{item.icon}</span>
                    <span className="text-xs text-muted font-ui">{item.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`studio-works-section studio-section-animated ${pageLoaded ? "loaded delay-5" : ""}`}>
      {/* Header with filters and add button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        {showFilters ? (
          <div className="flex items-center gap-1 p-1.5 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl">
            {[
              { id: "all", label: "All", count: products.length },
              { id: "active", label: "Active", count: products.filter((p) => p.status === "active").length },
              { id: "draft", label: "Drafts", count: products.filter((p) => p.status === "draft").length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id as typeof filter)}
                className={`px-5 py-2.5 rounded-xl font-ui text-sm transition-all duration-200 ${
                  filter === tab.id
                    ? "bg-white text-purple-primary shadow-sm font-medium"
                    : "text-muted hover:text-ink"
                }`}
              >
                {tab.label}
                <span className={`ml-1.5 ${filter === tab.id ? "text-pink-vivid" : "text-muted/60"}`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div />
        )}

        {isOwnProfile && (
          <Link
            href="/sell"
            className="group flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid
              text-white font-ui font-medium text-sm rounded-xl
              hover:shadow-lg hover:shadow-purple-primary/20 hover:scale-[1.02]
              transition-all duration-200"
          >
            <svg className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Product
          </Link>
        )}
      </div>

      {/* Products Grid - Masonry-style */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-5 md:gap-6">
        {filteredProducts.map((product, index) => (
          <ProductCard
            key={product.id}
            product={product}
            isOwnProfile={isOwnProfile}
            index={index}
          />
        ))}
      </div>

      {/* Empty filtered state */}
      {filteredProducts.length === 0 && products.length > 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <p className="text-muted font-body">No {filter} products found</p>
        </div>
      )}
    </div>
  );
}

// Product Card Component - Elegant and creative
function ProductCard({
  product,
  isOwnProfile,
  index,
}: {
  product: Product;
  isOwnProfile: boolean;
  index: number;
}) {
  const categoryConfig = getCategoryConfig(product.category);

  // Format price display
  const formatPrice = (price?: number) => {
    if (price === undefined) return null;
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const priceDisplay =
    product.min_price !== undefined
      ? product.min_price === product.max_price
        ? formatPrice(product.min_price)
        : `From ${formatPrice(product.min_price)}`
      : null;

  return (
    <Link
      href={`/product/${product.id}`}
      className="group block bg-white rounded-2xl overflow-hidden border border-gray-100/80
        hover:border-purple-200/60 hover:shadow-xl hover:shadow-purple-primary/5
        transition-all duration-300 hover:-translate-y-1"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Image Container */}
      <div className="relative aspect-[4/5] overflow-hidden bg-gradient-to-br from-gray-50 to-gray-100">
        {product.primary_image_url ? (
          <img
            src={product.primary_image_url}
            alt={product.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-gray-200">
              {CATEGORY_ICONS[categoryConfig?.icon || 'palette'] || (
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              )}
            </div>
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Status badge (only for own profile) */}
        {isOwnProfile && product.status !== "active" && (
          <div
            className={`absolute top-3 left-3 px-2.5 py-1 rounded-lg text-xs font-ui font-medium backdrop-blur-sm
              ${product.status === "draft"
                ? "bg-amber-500/90 text-white"
                : product.status === "paused"
                ? "bg-gray-500/90 text-white"
                : product.status === "sold"
                ? "bg-emerald-500/90 text-white"
                : "bg-gray-500/90 text-white"
              }`}
          >
            {product.status.charAt(0).toUpperCase() + product.status.slice(1)}
          </div>
        )}

        {/* Digital badge */}
        {product.delivery_type === "digital" && (
          <div className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs font-ui font-medium
            bg-gradient-to-r from-purple-primary/90 to-pink-vivid/90 text-white backdrop-blur-sm
            flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Digital
          </div>
        )}

        {/* Price tag on hover */}
        {priceDisplay && (
          <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-lg text-sm font-display font-semibold
            bg-white/95 backdrop-blur-sm text-purple-primary
            opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0
            transition-all duration-300">
            {priceDisplay}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Category pill */}
        <div className="flex items-center gap-2 mb-2">
          <span className="px-2 py-0.5 text-[10px] font-ui font-medium uppercase tracking-wider
            bg-gradient-to-r from-purple-50 to-pink-50 text-purple-primary/80 rounded-md">
            {categoryConfig?.name || product.category}
          </span>
          {product.year_created && (
            <span className="text-[10px] text-muted font-ui">{product.year_created}</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-display font-medium text-ink text-sm leading-snug line-clamp-2
          group-hover:text-purple-primary transition-colors duration-200">
          {product.title}
        </h3>

        {/* Mobile price (visible on non-hover) */}
        {priceDisplay && (
          <p className="mt-2 text-sm font-display font-semibold text-purple-primary md:hidden">
            {priceDisplay}
          </p>
        )}
      </div>
    </Link>
  );
}
