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
    <div className="min-h-screen bg-gradient-to-b from-white to-orange-50/20">
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-pink-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display font-medium text-ink mb-1">Something went wrong</h3>
            <p className="text-sm font-body text-muted mb-4">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 text-sm font-ui font-medium text-pink-vivid border border-pink-vivid/30 rounded-xl hover:bg-pink-50 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-orange-50 to-pink-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
            </div>
            <h3 className="font-display font-medium text-ink mb-1">No products found</h3>
            <p className="text-sm font-body text-muted mb-5">
              {filters.keywords?.length
                ? `No results for "${filters.keywords.join(" ")}"`
                : "Try adjusting your filters"}
            </p>
            <button
              onClick={clearFilters}
              className="px-5 py-2.5 text-sm font-ui font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid rounded-xl shadow-lg shadow-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/30 transition-all"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-8">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-2 text-muted">
                  <div className="w-5 h-5 border-2 border-pink-vivid/30 border-t-pink-vivid rounded-full animate-spin" />
                  <span className="text-sm font-body">Loading more...</span>
                </div>
              )}
              {!loading && !pagination.has_more && products.length > 0 && (
                <p className="text-sm font-body text-muted">
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
    <div>
      <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-orange-50 to-pink-50 animate-pulse mb-3" />
      <div className="space-y-2">
        <div className="h-4 w-3/4 bg-orange-50 rounded animate-pulse" />
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-pink-50 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-pink-50 rounded animate-pulse" />
        </div>
        <div className="h-4 w-16 bg-orange-50 rounded animate-pulse" />
      </div>
    </div>
  );
}
