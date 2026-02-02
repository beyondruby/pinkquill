"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMarketplace } from "@/lib/hooks";
import MarketplaceHero from "./MarketplaceHero";
import CategoryBrowser from "./CategoryBrowser";
import MarketplaceFilters from "./MarketplaceFilters";
import MarketplaceProductCard from "./MarketplaceProductCard";

export default function MarketplacePageContent() {
  const { user } = useAuth();
  const {
    products,
    loading,
    error,
    pagination,
    loadMore,
    filters,
    setCategory,
    setSubcategory,
    setDeliveryType,
    setSortBy,
    setSearchQuery,
    clearFilters,
    categoryCounts,
  } = useMarketplace(user?.id);

  const loadMoreRef = useRef<HTMLDivElement>(null);
  const isLoadingMore = useRef(false);

  // Infinite scroll observer
  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const target = entries[0];
      if (target.isIntersecting && pagination.has_more && !loading && !isLoadingMore.current) {
        isLoadingMore.current = true;
        loadMore().finally(() => {
          isLoadingMore.current = false;
        });
      }
    },
    [pagination.has_more, loading, loadMore]
  );

  useEffect(() => {
    const observer = new IntersectionObserver(handleObserver, {
      root: null,
      rootMargin: "100px",
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-gray-50/50">
      {/* Hero Section */}
      <MarketplaceHero onSearch={setSearchQuery} />

      {/* Category Browser */}
      <CategoryBrowser
        onCategorySelect={setCategory}
        selectedCategory={filters.category}
        categoryCounts={categoryCounts}
      />

      {/* Filters Bar */}
      <MarketplaceFilters
        filters={filters}
        onCategoryChange={setCategory}
        onSubcategoryChange={setSubcategory}
        onDeliveryTypeChange={setDeliveryType}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        totalProducts={pagination.total}
      />

      {/* Product Grid */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Initial loading state */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <h3 className="font-display text-lg font-medium text-ink mb-2">
              Something went wrong
            </h3>
            <p className="font-body text-muted text-sm mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-pink-vivid text-white rounded-xl font-ui text-sm"
            >
              Try Again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-pink-vivid/60"
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
            <h3 className="font-display text-xl font-semibold text-ink mb-2">
              No products found
            </h3>
            <p className="font-body text-muted mb-6 max-w-md mx-auto">
              {filters.keywords?.length
                ? `No products match your search for "${filters.keywords.join(" ")}"`
                : "No products match your current filters. Try adjusting or clearing them."}
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-xl font-ui text-sm font-medium shadow-lg shadow-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/30 transition-all duration-200"
            >
              Clear All Filters
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-5 lg:gap-6">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-pink-vivid/30 border-t-pink-vivid rounded-full animate-spin" />
                  <span className="font-ui text-sm text-muted">Loading more...</span>
                </div>
              )}
              {!loading && !pagination.has_more && products.length > 0 && (
                <p className="font-body text-sm text-muted">
                  You've seen all {pagination.total} products
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.04]">
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-50 animate-pulse" />
      <div className="p-4">
        <div className="h-3 w-16 bg-gray-100 rounded animate-pulse mb-2" />
        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse mb-3" />
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="pt-3 border-t border-black/[0.04]">
          <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
        </div>
      </div>
    </div>
  );
}
