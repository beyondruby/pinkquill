"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMarketplace } from "@/lib/hooks";
import MarketplaceHeader from "./MarketplaceHeader";
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
    setPriceRange,
    setSortBy,
    setSearchQuery,
    clearFilters,
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
      {/* Gallery Header with Search & Filters */}
      <MarketplaceHeader
        filters={filters}
        onSearch={setSearchQuery}
        onCategoryChange={setCategory}
        onSubcategoryChange={setSubcategory}
        onDeliveryTypeChange={setDeliveryType}
        onPriceRangeChange={setPriceRange}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        totalProducts={pagination.total}
      />

      {/* Gallery Grid */}
      <div className="max-w-[1400px] mx-auto px-6 sm:px-8 lg:px-12 py-12 sm:py-16">
        {/* Initial loading state */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-pink-vivid/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-medium text-ink mb-2">Something went wrong</h3>
            <p className="text-sm font-body text-muted mb-6 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 text-sm font-ui font-medium text-pink-vivid border border-pink-vivid/30 rounded-full hover:bg-pink-50 transition-all duration-200"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-24">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-purple-primary/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="font-display text-xl font-medium text-ink mb-2">No works found</h3>
            <p className="text-sm font-body text-muted mb-6 max-w-sm mx-auto">
              {filters.keywords?.length
                ? `No results for "${filters.keywords.join(" ")}"`
                : "Try adjusting your filters to discover more pieces"}
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 text-sm font-ui font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full shadow-lg shadow-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/30 hover:scale-[1.02] transition-all duration-200"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Masonry-style Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 sm:gap-8 lg:gap-10">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Elegant load more trigger */}
            <div ref={loadMoreRef} className="h-24 flex items-center justify-center mt-12">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-3 text-muted">
                  <div className="w-5 h-5 border-2 border-purple-primary/20 border-t-purple-primary rounded-full animate-spin" />
                  <span className="text-sm font-body tracking-wide">Curating more pieces...</span>
                </div>
              )}
              {!loading && !pagination.has_more && products.length > 0 && (
                <p className="text-sm font-body text-muted tracking-wide">
                  You've explored all {pagination.total} works in this collection
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
    <div className="group">
      {/* Image skeleton */}
      <div className="aspect-[4/5] rounded-xl bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 animate-pulse mb-4" />

      {/* Content skeleton */}
      <div className="space-y-3">
        <div className="h-4 w-4/5 bg-gray-100 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-3 w-24 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-5 w-20 bg-gray-100 rounded animate-pulse" />
      </div>
    </div>
  );
}
