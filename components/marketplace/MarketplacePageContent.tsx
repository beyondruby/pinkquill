"use client";

import React, { useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMarketplace } from "@/lib/hooks";
import MarketplaceHero from "./MarketplaceHero";
import MarketplaceHeader from "./MarketplaceHeader";
import MarketplaceProductCard from "./MarketplaceProductCard";

export default function MarketplacePageContent() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const {
    products,
    loading,
    error,
    pagination,
    loadMore,
    filters,
    setListingType,
    setCategory,
    setSubcategory,
    setDeliveryType,
    setPriceRange,
    setMaxDeliveryDays,
    setMinRevisions,
    setSortBy,
    setSearchQuery,
    clearFilters,
  } = useMarketplace(user?.id, { initialListingType: "product" });

  useEffect(() => {
    const section = searchParams?.get("section");
    if (section === "commissions" && filters.listing_type !== "service") {
      setListingType("service");
    } else if (section === "products" && filters.listing_type !== "product") {
      setListingType("product");
    }
  }, [searchParams, setListingType, filters.listing_type]);

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
    <div className="min-h-screen bg-gradient-to-b from-white via-white to-orange-50/30">
      {/* Hero Section */}
      <MarketplaceHero listingType={filters.listing_type || "product"} />

      {/* Sticky Header with Search & Filters */}
      <MarketplaceHeader
        filters={filters}
        onSearch={setSearchQuery}
        onListingTypeChange={setListingType}
        onCategoryChange={setCategory}
        onSubcategoryChange={setSubcategory}
        onDeliveryTypeChange={setDeliveryType}
        onPriceRangeChange={setPriceRange}
        onMaxDeliveryDaysChange={setMaxDeliveryDays}
        onMinRevisionsChange={setMinRevisions}
        onSortChange={setSortBy}
        onClearFilters={clearFilters}
        totalProducts={pagination.total}
      />

      {/* Product Grid */}
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
        {/* Initial loading state */}
        {loading && products.length === 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">Something went wrong</h3>
            <p className="text-sm font-body text-muted mb-5 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-sm font-ui font-medium text-pink-vivid border border-pink-vivid/30 rounded-full hover:bg-pink-50 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-orange-50 via-pink-50 to-purple-50 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              {filters.listing_type === "service" ? "No commissions found" : "No products found"}
            </h3>
            <p className="text-sm font-body text-muted mb-5 max-w-sm mx-auto">
              {filters.keywords?.length
                ? `No results for "${filters.keywords.join(" ")}"`
                : filters.listing_type === "service"
                ? "Try widening your timeline, revision, or category filters."
                : "Try adjusting your filters to find what you're looking for"}
            </p>
            <button
              onClick={clearFilters}
              className="px-6 py-2.5 text-sm font-ui font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full shadow-lg shadow-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/30 transition-all"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <>
            {/* Product Grid */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            {/* Load more trigger */}
            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-10">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-3 text-muted">
                  <div className="w-5 h-5 border-2 border-pink-vivid/30 border-t-pink-vivid rounded-full animate-spin" />
                  <span className="text-sm font-body">Loading more products...</span>
                </div>
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
    <div className="bg-white rounded-2xl overflow-hidden border border-black/[0.04] shadow-sm">
      {/* Image skeleton */}
      <div className="aspect-square bg-gradient-to-br from-orange-50 to-pink-50 animate-pulse" />

      {/* Content skeleton */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-gray-100 rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-gray-100 rounded animate-pulse" />
        <div className="h-6 w-16 bg-gradient-to-r from-purple-50 to-pink-50 rounded animate-pulse" />
      </div>
    </div>
  );
}
