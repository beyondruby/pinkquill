"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { MarketplaceFilters, MarketplaceSortOption } from "@/lib/hooks/useMarketplace";

interface MarketplaceHeaderProps {
  filters: MarketplaceFilters;
  onSearch: (query: string) => void;
  onCategoryChange: (category: string | undefined) => void;
  onSubcategoryChange: (subcategory: string | undefined) => void;
  onDeliveryTypeChange: (type: "physical" | "digital" | undefined) => void;
  onSortChange: (sort: MarketplaceSortOption) => void;
  onPriceRangeChange: (min?: number, max?: number) => void;
  onClearFilters: () => void;
  totalProducts: number;
}

const sortOptions: { value: MarketplaceSortOption; label: string }[] = [
  { value: "newest", label: "New Arrivals" },
  { value: "popular", label: "Most Popular" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

const priceRanges = [
  { label: "Under $50", min: 0, max: 50 },
  { label: "$50 - $150", min: 50, max: 150 },
  { label: "$150 - $500", min: 150, max: 500 },
  { label: "$500 - $1,000", min: 500, max: 1000 },
  { label: "$1,000+", min: 1000, max: undefined },
];

const categories = Object.values(PRODUCT_CATEGORIES);

export default function MarketplaceHeader({
  filters,
  onSearch,
  onCategoryChange,
  onSubcategoryChange,
  onDeliveryTypeChange,
  onSortChange,
  onPriceRangeChange,
  onClearFilters,
  totalProducts,
}: MarketplaceHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveFilters =
    filters.category || filters.subcategory || filters.delivery_type ||
    filters.min_price !== undefined || filters.max_price !== undefined ||
    filters.keywords?.length;

  const selectedCategory = filters.category ? PRODUCT_CATEGORIES[filters.category] : undefined;

  // Debounced search
  const handleSearch = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onSearch(value);
      }, 400);
    },
    [onSearch]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Get active price range label
  const getActivePriceLabel = () => {
    if (filters.min_price === undefined && filters.max_price === undefined) return null;
    const range = priceRanges.find(
      r => r.min === filters.min_price && r.max === filters.max_price
    );
    return range?.label || `$${filters.min_price || 0}${filters.max_price ? ` - $${filters.max_price}` : '+'}`;
  };

  return (
    <>
      {/* Top Bar - Minimal */}
      <div className="bg-white border-b border-black/[0.03]">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10">
          {/* Title Row */}
          <div className="flex items-center justify-between py-8 lg:py-12">
            <div>
              <h1 className="text-3xl lg:text-4xl font-display font-light tracking-tight text-ink">
                Gallery
              </h1>
              <p className="mt-1 text-sm text-muted font-body">
                {totalProducts.toLocaleString()} works available
              </p>
            </div>

            {/* Search */}
            <div className="hidden md:block w-full max-w-sm">
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search the gallery..."
                  className="w-full h-11 pl-11 pr-4 bg-transparent rounded-none border-b border-black/10 text-sm font-body text-ink placeholder:text-muted/50 focus:outline-none focus:border-ink transition-colors"
                />
                <svg
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between pb-6 gap-4 overflow-x-auto scrollbar-hide">
            {/* Left: Category Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  onCategoryChange(undefined);
                  onSubcategoryChange(undefined);
                }}
                className={`px-4 py-2 text-sm font-ui tracking-wide transition-all ${
                  !filters.category
                    ? "text-ink border-b-2 border-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                All Works
              </button>

              {categories.map((cat) => (
                <div key={cat.id} className="relative group">
                  <button
                    onClick={() => {
                      if (filters.category === cat.id) {
                        onCategoryChange(undefined);
                        onSubcategoryChange(undefined);
                      } else {
                        onCategoryChange(cat.id);
                        onSubcategoryChange(undefined);
                      }
                    }}
                    onMouseEnter={() => setExpandedCategory(cat.id)}
                    onMouseLeave={() => setExpandedCategory(null)}
                    className={`px-4 py-2 text-sm font-ui tracking-wide transition-all whitespace-nowrap ${
                      filters.category === cat.id
                        ? "text-ink border-b-2 border-ink"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {cat.name}
                  </button>

                  {/* Subcategory Dropdown */}
                  {expandedCategory === cat.id && cat.subcategories.length > 0 && (
                    <div
                      onMouseEnter={() => setExpandedCategory(cat.id)}
                      onMouseLeave={() => setExpandedCategory(null)}
                      className="absolute top-full left-0 mt-1 py-2 bg-white border border-black/[0.06] shadow-xl min-w-[200px] z-50"
                    >
                      {cat.subcategories.map((sub) => (
                        <button
                          key={sub.value}
                          onClick={() => {
                            onCategoryChange(cat.id);
                            onSubcategoryChange(sub.value);
                            setExpandedCategory(null);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm font-body hover:bg-pink-50/50 transition-colors ${
                            filters.subcategory === sub.value
                              ? "text-pink-vivid"
                              : "text-ink/80"
                          }`}
                        >
                          {sub.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Right: Filter Toggle & Sort */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-ui transition-all ${
                  showFilters || hasActiveFilters
                    ? "text-ink"
                    : "text-muted hover:text-ink"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                Filters
                {hasActiveFilters && (
                  <span className="w-1.5 h-1.5 bg-pink-vivid rounded-full" />
                )}
              </button>

              <div className="h-4 w-px bg-black/10" />

              <select
                value={filters.sort_by}
                onChange={(e) => onSortChange(e.target.value as MarketplaceSortOption)}
                className="text-sm font-ui text-muted hover:text-ink bg-transparent border-0 focus:outline-none focus:ring-0 cursor-pointer pr-6 appearance-none"
                style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%23777'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M19 9l-7 7-7-7'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right center', backgroundSize: '16px' }}
              >
                {sortOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div className="bg-white border-b border-black/[0.03] animate-fadeIn">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {/* Type */}
              <div>
                <h4 className="text-xs font-ui uppercase tracking-widest text-muted mb-4">Type</h4>
                <div className="space-y-2">
                  {[
                    { value: undefined, label: "All Types" },
                    { value: "physical" as const, label: "Physical Works" },
                    { value: "digital" as const, label: "Digital Works" },
                  ].map((type) => (
                    <button
                      key={type.label}
                      onClick={() => onDeliveryTypeChange(type.value)}
                      className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                        filters.delivery_type === type.value
                          ? "text-ink bg-pink-50/50"
                          : "text-muted hover:text-ink hover:bg-black/[0.02]"
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <h4 className="text-xs font-ui uppercase tracking-widest text-muted mb-4">Price</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => onPriceRangeChange(undefined, undefined)}
                    className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                      filters.min_price === undefined && filters.max_price === undefined
                        ? "text-ink bg-pink-50/50"
                        : "text-muted hover:text-ink hover:bg-black/[0.02]"
                    }`}
                  >
                    Any Price
                  </button>
                  {priceRanges.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => onPriceRangeChange(range.min, range.max)}
                      className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                        filters.min_price === range.min && filters.max_price === range.max
                          ? "text-ink bg-pink-50/50"
                          : "text-muted hover:text-ink hover:bg-black/[0.02]"
                      }`}
                    >
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subcategories (if category selected) */}
              {selectedCategory && (
                <div>
                  <h4 className="text-xs font-ui uppercase tracking-widest text-muted mb-4">
                    {selectedCategory.name}
                  </h4>
                  <div className="space-y-2">
                    <button
                      onClick={() => onSubcategoryChange(undefined)}
                      className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                        !filters.subcategory
                          ? "text-ink bg-pink-50/50"
                          : "text-muted hover:text-ink hover:bg-black/[0.02]"
                      }`}
                    >
                      All {selectedCategory.name}
                    </button>
                    {selectedCategory.subcategories.slice(0, 8).map((sub) => (
                      <button
                        key={sub.value}
                        onClick={() => onSubcategoryChange(sub.value)}
                        className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                          filters.subcategory === sub.value
                            ? "text-ink bg-pink-50/50"
                            : "text-muted hover:text-ink hover:bg-black/[0.02]"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quick Filters */}
              <div>
                <h4 className="text-xs font-ui uppercase tracking-widest text-muted mb-4">Quick Filters</h4>
                <div className="space-y-2">
                  <button
                    onClick={() => onSortChange("newest")}
                    className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                      filters.sort_by === "newest"
                        ? "text-ink bg-pink-50/50"
                        : "text-muted hover:text-ink hover:bg-black/[0.02]"
                    }`}
                  >
                    New Arrivals
                  </button>
                  <button
                    onClick={() => onSortChange("popular")}
                    className={`block w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                      filters.sort_by === "popular"
                        ? "text-ink bg-pink-50/50"
                        : "text-muted hover:text-ink hover:bg-black/[0.02]"
                    }`}
                  >
                    Trending
                  </button>
                </div>
              </div>
            </div>

            {/* Active Filters & Clear */}
            {hasActiveFilters && (
              <div className="mt-8 pt-6 border-t border-black/[0.04] flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-ui uppercase tracking-widest text-muted mr-2">Active:</span>
                  {filters.category && (
                    <span className="px-3 py-1 bg-ink text-white text-xs font-ui">
                      {selectedCategory?.name}
                    </span>
                  )}
                  {filters.subcategory && (
                    <span className="px-3 py-1 bg-pink-vivid/10 text-pink-vivid text-xs font-ui">
                      {selectedCategory?.subcategories.find(s => s.value === filters.subcategory)?.label}
                    </span>
                  )}
                  {filters.delivery_type && (
                    <span className="px-3 py-1 bg-purple-50 text-purple-primary text-xs font-ui capitalize">
                      {filters.delivery_type}
                    </span>
                  )}
                  {getActivePriceLabel() && (
                    <span className="px-3 py-1 bg-orange-50 text-orange-warm text-xs font-ui">
                      {getActivePriceLabel()}
                    </span>
                  )}
                </div>
                <button
                  onClick={onClearFilters}
                  className="text-sm font-ui text-muted hover:text-pink-vivid transition-colors"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Search */}
      <div className="md:hidden bg-white border-b border-black/[0.03] px-6 py-4">
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search..."
            className="w-full h-10 pl-10 pr-4 bg-black/[0.02] rounded-lg text-sm font-body text-ink placeholder:text-muted/50 border-0 focus:outline-none focus:ring-1 focus:ring-pink-vivid/20"
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>
    </>
  );
}
