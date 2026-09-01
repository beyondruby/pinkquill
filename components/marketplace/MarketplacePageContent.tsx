"use client";

import React, { useEffect, useRef, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useMarketplace } from "@/lib/hooks";
import {
  countActiveMarketplaceFilters,
  hasActiveMarketplaceFilters,
} from "@/lib/hooks/useMarketplace";
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
  const isService = filters.listing_type === "service";

  const hasActiveFilters = useMemo(() => hasActiveMarketplaceFilters(filters), [filters]);
  const activeFilterCount = useMemo(() => countActiveMarketplaceFilters(filters), [filters]);

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
    <div className="min-h-screen bg-gradient-to-b from-surface via-surface to-orange-warm/[0.04]">
      <MarketplaceHero listingType={filters.listing_type || "product"} />

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

      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-8 sm:py-12">
        <DiscoveryStrip
          isService={isService}
          total={pagination.total}
          hasActiveFilters={hasActiveFilters}
          activeFilterCount={activeFilterCount}
          keyword={filters.keywords?.join(" ")}
        />

        {loading && products.length === 0 ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-pink-vivid/10 to-purple-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-pink-vivid/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">Something went wrong</h3>
            <p className="text-sm font-body text-muted mb-5 max-w-sm mx-auto">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 text-sm font-ui font-medium text-pink-vivid border border-pink-vivid/30 rounded-full hover:bg-pink-vivid/10 transition-colors"
            >
              Try again
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-gradient-to-br from-orange-warm/10 via-pink-vivid/10 to-purple-primary/10 flex items-center justify-center">
              <svg className="w-8 h-8 text-purple-primary/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h3 className="font-display text-lg font-semibold text-ink mb-2">
              {hasActiveFilters
                ? isService
                  ? "No commissions found"
                  : "No products found"
                : isService
                ? "No commissions yet"
                : "No products yet"}
            </h3>
            <p className="text-sm font-body text-muted mb-5 max-w-sm mx-auto">
              {filters.keywords?.length
                ? `No results for "${filters.keywords.join(" ")}"`
                : hasActiveFilters
                ? isService
                  ? "Try widening your timeline, revision, or category filters."
                  : "Try adjusting your filters to find what you're looking for"
                : isService
                ? "Check back soon — creators add new commission listings regularly."
                : "Check back soon — creators add new products regularly."}
            </p>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="px-6 py-2.5 text-sm font-ui font-medium text-white bg-gradient-to-r from-purple-primary to-pink-vivid rounded-full shadow-lg shadow-pink-vivid/20 hover:shadow-xl hover:shadow-pink-vivid/30 transition-all"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {products.map((product) => (
                <MarketplaceProductCard key={product.id} product={product} />
              ))}
            </div>

            <div ref={loadMoreRef} className="h-20 flex items-center justify-center mt-10">
              {loading && products.length > 0 && (
                <div className="flex items-center gap-3 text-muted">
                  <div className="w-5 h-5 border-2 border-pink-vivid/30 border-t-pink-vivid rounded-full animate-spin" />
                  <span className="text-sm font-body">
                    Loading more {isService ? "commissions" : "products"}...
                  </span>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function DiscoveryStrip({
  isService,
  total,
  hasActiveFilters,
  activeFilterCount,
  keyword,
}: {
  isService: boolean;
  total: number;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  keyword?: string;
}) {
  return (
    <div className="relative rounded-[24px] border border-border-light bg-surface/95 px-4 sm:px-6 py-5 shadow-sm overflow-hidden">
      <div className="absolute -top-14 -right-12 w-40 h-40 rounded-full bg-pink-vivid/10 blur-2xl" />
      <div className="absolute -bottom-16 -left-12 w-40 h-40 rounded-full bg-purple-primary/10 blur-2xl" />

      <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <p className="text-xs font-ui font-semibold uppercase tracking-[0.18em] text-muted">
            {isService ? "Commissions Marketplace" : "Products Marketplace"}
          </p>
          <h2 className="font-display text-2xl text-ink mt-1">
            {isService ? "Hire creative services" : "Discover original goods"}
          </h2>
          <p className="text-sm font-body text-muted mt-1">
            {isService
              ? "Explore outcome-driven service packages with clear timelines and revisions."
              : "Find unique physical and digital creations directly from independent artists."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Badge label={`${total.toLocaleString()} result${total === 1 ? "" : "s"}`} tone="purple" />
          {hasActiveFilters && <Badge label={`${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active`} tone="pink" />}
          {keyword && <Badge label={`“${keyword}”`} tone="neutral" />}
        </div>
      </div>
    </div>
  );
}

function Badge({ label, tone }: { label: string; tone: "purple" | "pink" | "neutral" }) {
  const toneClasses = {
    purple: "bg-purple-primary/10 text-purple-primary",
    pink: "bg-pink-vivid/10 text-pink-vivid",
    neutral: "bg-subtle text-muted",
  } as const;

  return (
    <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-ui font-semibold ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}

function ProductSkeleton() {
  return (
    <div className="bg-surface rounded-2xl overflow-hidden border border-border-light shadow-sm">
      <div className="aspect-[4/3] bg-skeleton animate-pulse" />
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-skeleton rounded-full animate-pulse" />
          <div className="h-3 w-20 bg-skeleton rounded animate-pulse" />
        </div>
        <div className="h-4 w-3/4 bg-skeleton rounded animate-pulse" />
        <div className="h-4 w-1/2 bg-skeleton rounded animate-pulse" />
        <div className="h-6 w-16 bg-skeleton rounded animate-pulse" />
      </div>
    </div>
  );
}
