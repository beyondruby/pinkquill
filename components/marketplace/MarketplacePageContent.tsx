"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMarketplace } from "@/lib/hooks";
import MarketplaceHeader from "./MarketplaceHeader";
import FeaturedSpotlight from "./FeaturedSpotlight";
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
    setDeliveryType,
    setSortBy,
    setSearchQuery,
    clearFilters,
    featuredProducts,
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
      rootMargin: "200px",
      threshold: 0.1,
    });

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current);
    }

    return () => observer.disconnect();
  }, [handleObserver]);

  return (
    <div className="min-h-screen bg-white">
      {/* Clean Header with Search & Filters */}
      <MarketplaceHeader
        filters={filters}
        onSearch={setSearchQuery}
        onCategoryChange={setCategory}
        onDeliveryTypeChange={setDeliveryType}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        totalProducts={pagination.total}
      />

      {/* Featured Creator Spotlight - only show when no filters active */}
      {!filters.category && !filters.delivery_type && !filters.keywords?.length && (
        <FeaturedSpotlight products={featuredProducts} />
      )}

      {/* Product Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Initial loading state */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-medium text-ink mb-1">Something went wrong</h3>
            <p className="text-sm text-gray-500 mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 text-sm font-medium text-ink border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="font-medium text-ink mb-1">No products found</h3>
            <p className="text-sm text-gray-500 mb-4">
              {filters.keywords?.length
                ? `No results for "${filters.keywords.join(" ")}"`
                : "Try adjusting your filters"}
            </p>
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-white bg-ink rounded-lg hover:bg-gray-800 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Product Grid - Gallery layout */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-2 text-gray-400">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  <span className="text-sm">Loading...</span>
                </div>
              )}
              {!loading && !pagination.has_more && products.length > 0 && (
                <p className="text-sm text-gray-400">
                  That's everything
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
    <div>
      <div className="aspect-[4/5] rounded-lg bg-gray-100 animate-pulse mb-4" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-5 w-16 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
