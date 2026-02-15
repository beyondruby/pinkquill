"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { MarketplaceFilters, MarketplaceSortOption } from "@/lib/hooks/useMarketplace";
import {
  COMMISSION_DELIVERY_FILTERS,
  COMMISSION_REVISION_FILTERS,
  getAllCommissionCategories,
} from "@/lib/commissions/categories";

interface MarketplaceHeaderProps {
  filters: MarketplaceFilters;
  onSearch: (query: string) => void;
  onListingTypeChange: (type: "product" | "service" | undefined) => void;
  onCategoryChange: (category: string | undefined) => void;
  onSubcategoryChange: (subcategory: string | undefined) => void;
  onDeliveryTypeChange: (type: "physical" | "digital" | undefined) => void;
  onSortChange: (sort: MarketplaceSortOption) => void;
  onPriceRangeChange: (min?: number, max?: number) => void;
  onMaxDeliveryDaysChange: (days: number | undefined) => void;
  onMinRevisionsChange: (count: number | undefined) => void;
  onClearFilters: () => void;
  totalProducts: number;
}

const sortOptions: { value: MarketplaceSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "popular", label: "Popular" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

const priceRanges = [
  { label: "Under $25", min: 0, max: 25 },
  { label: "$25 - $50", min: 25, max: 50 },
  { label: "$50 - $100", min: 50, max: 100 },
  { label: "$100 - $250", min: 100, max: 250 },
  { label: "$250+", min: 250, max: undefined },
];

const categories = Object.values(PRODUCT_CATEGORIES);
const commissionCategories = getAllCommissionCategories();

export default function MarketplaceHeader({
  filters,
  onSearch,
  onListingTypeChange,
  onCategoryChange,
  onSubcategoryChange,
  onDeliveryTypeChange,
  onSortChange,
  onPriceRangeChange,
  onMaxDeliveryDaysChange,
  onMinRevisionsChange,
  onClearFilters,
  totalProducts,
}: MarketplaceHeaderProps) {
  const { cartCount } = useBadgeCounts();
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveFilters =
    filters.category || filters.subcategory || filters.delivery_type ||
    filters.min_price !== undefined || filters.max_price !== undefined ||
    filters.max_delivery_days !== undefined || filters.min_revisions !== undefined ||
    filters.keywords?.length;

  const catalogType = filters.listing_type || "product";
  const categoryOptions = catalogType === "service" ? commissionCategories : categories;
  const selectedCategory = filters.category
    ? catalogType === "service"
      ? commissionCategories.find((item) => item.id === filters.category)
      : PRODUCT_CATEGORIES[filters.category]
    : undefined;
  const activeTabClass = catalogType === "service"
    ? "bg-gradient-to-r from-pink-vivid to-orange-warm text-white shadow-md shadow-pink-vivid/25"
    : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md shadow-purple-primary/20";
  const activeCategoryClass = catalogType === "service"
    ? "bg-gradient-to-r from-pink-vivid to-orange-warm text-white shadow-md shadow-pink-vivid/20"
    : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md shadow-purple-primary/20";

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

  const getActivePriceLabel = () => {
    if (filters.min_price === undefined && filters.max_price === undefined) return null;
    const range = priceRanges.find(
      r => r.min === filters.min_price && r.max === filters.max_price
    );
    return range?.label || `$${filters.min_price || 0}${filters.max_price ? ` - $${filters.max_price}` : '+'}`;
  };

  return (
    <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-black/[0.06] shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Main Bar */}
        <div className="flex items-center justify-between gap-3 h-16 sm:h-[72px]">
          <div className="hidden sm:flex items-center p-1.5 bg-gradient-to-r from-orange-50 via-pink-50 to-purple-50 rounded-full border border-black/[0.05] shadow-sm">
            <button
              onClick={() => onListingTypeChange("product")}
              className={`px-3 py-1.5 rounded-full text-xs font-ui font-semibold transition-all ${
                catalogType === "product"
                  ? activeTabClass
                  : "text-muted hover:text-ink"
              }`}
            >
              Products
            </button>
            <button
              onClick={() => onListingTypeChange("service")}
              className={`px-3 py-1.5 rounded-full text-xs font-ui font-semibold transition-all ${
                catalogType === "service"
                  ? activeTabClass
                  : "text-muted hover:text-ink"
              }`}
            >
              Commissions
            </button>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xl">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={catalogType === "service" ? "Search commissions..." : "Search products..."}
                className="w-full h-10 pl-10 pr-4 bg-white rounded-full text-sm font-body text-ink placeholder:text-muted/60 border border-black/[0.08] shadow-sm focus:border-pink-vivid/30 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-vivid/10 transition-all"
              />
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          {/* Right: Filter & Sort */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-ui transition-all ${
                showFilters
                  ? catalogType === "service"
                    ? "bg-gradient-to-r from-pink-vivid to-orange-warm text-white"
                    : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                  : hasActiveFilters
                  ? "bg-pink-50 text-pink-vivid border border-pink-vivid/20"
                  : "bg-white text-ink border border-black/[0.08] hover:bg-gray-50"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && !showFilters && (
                <span className="w-5 h-5 flex items-center justify-center bg-pink-vivid text-white text-xs rounded-full">
                  {[
                    filters.category,
                    filters.subcategory,
                    filters.delivery_type,
                    filters.min_price !== undefined,
                    filters.max_delivery_days !== undefined,
                    filters.min_revisions !== undefined,
                  ].filter(Boolean).length}
                </span>
              )}
            </button>

            <select
              value={filters.sort_by}
              onChange={(e) => onSortChange(e.target.value as MarketplaceSortOption)}
              className="h-10 px-4 bg-white rounded-full text-sm font-ui text-ink border border-black/[0.08] focus:outline-none focus:ring-2 focus:ring-pink-vivid/10 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Link
              href="/cart"
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-white border border-black/[0.08] text-muted hover:text-purple-primary hover:bg-purple-primary/[0.04] transition-all"
              title="Studio Cart"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
              </svg>
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-pink-vivid text-white font-ui text-[0.55rem] font-semibold rounded-full flex items-center justify-center px-0.5">
                  {cartCount > 99 ? "99+" : cartCount}
                </span>
              )}
            </Link>

            <span className="hidden lg:inline text-xs font-ui text-muted px-1">
              {totalProducts.toLocaleString()} results
            </span>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-2 py-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
          <button
            onClick={() => {
              onCategoryChange(undefined);
              onSubcategoryChange(undefined);
            }}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-ui transition-all ${
              !filters.category
                ? activeCategoryClass
                : "bg-white border border-black/[0.08] text-muted hover:text-ink hover:bg-gray-50"
            }`}
          >
            All
          </button>

          {categoryOptions.map((cat) => (
            <div key={cat.id} className="relative flex-shrink-0">
              <button
                onClick={() => {
                  if (filters.category === cat.id) {
                    onCategoryChange(undefined);
                    onSubcategoryChange(undefined);
                  } else {
                    onCategoryChange(cat.id);
                    onSubcategoryChange(undefined);
                  }
                  setActiveDropdown(null);
                }}
                onMouseEnter={() => setActiveDropdown(cat.id)}
                onMouseLeave={() => setActiveDropdown(null)}
                className={`px-4 py-2 rounded-full text-sm font-ui transition-all ${
                  filters.category === cat.id
                    ? activeCategoryClass
                    : "bg-white border border-black/[0.08] text-muted hover:text-ink hover:bg-gray-50"
                }`}
              >
                {cat.name}
              </button>

              {/* Subcategory Dropdown */}
              {activeDropdown === cat.id && cat.subcategories.length > 0 && (
                <div
                  onMouseEnter={() => setActiveDropdown(cat.id)}
                  onMouseLeave={() => setActiveDropdown(null)}
                  className="absolute top-full left-0 mt-2 py-2 bg-white rounded-xl border border-black/[0.06] shadow-xl min-w-[190px] z-50 animate-fadeIn"
                >
                  {cat.subcategories.map((sub) => (
                    <button
                      key={sub.value}
                      onClick={() => {
                        onCategoryChange(cat.id);
                        onSubcategoryChange(sub.value);
                        setActiveDropdown(null);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-sm font-body transition-colors ${
                        filters.subcategory === sub.value
                          ? "bg-pink-50 text-pink-vivid"
                          : "text-ink hover:bg-gray-50"
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
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div className="border-t border-black/[0.04] bg-gradient-to-b from-orange-50/40 via-white to-white animate-fadeIn">
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-white/90 border border-black/[0.05] rounded-2xl p-5 shadow-sm">
              <div>
                <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">Section</h4>
                <div className="space-y-1">
                  {[
                    { value: "product" as const, label: "Products" },
                    { value: "service" as const, label: "Commissions" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onListingTypeChange(option.value)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                        catalogType === option.value
                          ? "bg-pink-50 text-pink-vivid"
                          : "text-ink hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        catalogType === option.value ? "border-pink-vivid" : "border-gray-300"
                      }`}>
                        {catalogType === option.value && <span className="w-2 h-2 rounded-full bg-pink-vivid" />}
                      </span>
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {catalogType === "product" ? (
                <div>
                  <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">Type</h4>
                  <div className="space-y-1">
                    {[
                      { value: undefined, label: "All" },
                      { value: "physical" as const, label: "Physical" },
                      { value: "digital" as const, label: "Digital" },
                    ].map((type) => (
                      <button
                        key={type.label}
                        onClick={() => onDeliveryTypeChange(type.value)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                          filters.delivery_type === type.value
                            ? "bg-purple-50 text-purple-primary"
                            : "text-ink hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          filters.delivery_type === type.value
                            ? "border-purple-primary"
                            : "border-gray-300"
                        }`}>
                          {filters.delivery_type === type.value && (
                            <span className="w-2 h-2 rounded-full bg-purple-primary" />
                          )}
                        </span>
                        {type.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">Delivery</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => onMaxDeliveryDaysChange(undefined)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                        filters.max_delivery_days === undefined
                          ? "bg-purple-50 text-purple-primary"
                          : "text-ink hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        filters.max_delivery_days === undefined ? "border-purple-primary" : "border-gray-300"
                      }`}>
                        {filters.max_delivery_days === undefined && <span className="w-2 h-2 rounded-full bg-purple-primary" />}
                      </span>
                      Any timeline
                    </button>
                    {COMMISSION_DELIVERY_FILTERS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onMaxDeliveryDaysChange(option.value)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                          filters.max_delivery_days === option.value
                            ? "bg-purple-50 text-purple-primary"
                            : "text-ink hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          filters.max_delivery_days === option.value ? "border-purple-primary" : "border-gray-300"
                        }`}>
                          {filters.max_delivery_days === option.value && <span className="w-2 h-2 rounded-full bg-purple-primary" />}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Price Range */}
              <div>
                <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">Price</h4>
                <div className="space-y-1">
                  <button
                    onClick={() => onPriceRangeChange(undefined, undefined)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                      filters.min_price === undefined && filters.max_price === undefined
                        ? "bg-orange-50 text-orange-warm"
                        : "text-ink hover:bg-gray-50"
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      filters.min_price === undefined && filters.max_price === undefined
                        ? "border-orange-warm"
                        : "border-gray-300"
                    }`}>
                      {filters.min_price === undefined && filters.max_price === undefined && (
                        <span className="w-2 h-2 rounded-full bg-orange-warm" />
                      )}
                    </span>
                    Any Price
                  </button>
                  {priceRanges.map((range) => (
                    <button
                      key={range.label}
                      onClick={() => onPriceRangeChange(range.min, range.max)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                        filters.min_price === range.min && filters.max_price === range.max
                          ? "bg-orange-50 text-orange-warm"
                          : "text-ink hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        filters.min_price === range.min && filters.max_price === range.max
                          ? "border-orange-warm"
                          : "border-gray-300"
                      }`}>
                        {filters.min_price === range.min && filters.max_price === range.max && (
                          <span className="w-2 h-2 rounded-full bg-orange-warm" />
                        )}
                      </span>
                      {range.label}
                    </button>
                  ))}
                </div>
              </div>

              {catalogType === "service" && (
                <div>
                  <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">Revisions</h4>
                  <div className="space-y-1">
                    <button
                      onClick={() => onMinRevisionsChange(undefined)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                        filters.min_revisions === undefined
                          ? "bg-orange-50 text-orange-warm"
                          : "text-ink hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        filters.min_revisions === undefined ? "border-orange-warm" : "border-gray-300"
                      }`}>
                        {filters.min_revisions === undefined && <span className="w-2 h-2 rounded-full bg-orange-warm" />}
                      </span>
                      Any revision count
                    </button>
                    {COMMISSION_REVISION_FILTERS.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => onMinRevisionsChange(option.value)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                          filters.min_revisions === option.value
                            ? "bg-orange-50 text-orange-warm"
                            : "text-ink hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          filters.min_revisions === option.value ? "border-orange-warm" : "border-gray-300"
                        }`}>
                          {filters.min_revisions === option.value && <span className="w-2 h-2 rounded-full bg-orange-warm" />}
                        </span>
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Subcategories (if category selected) */}
              {selectedCategory && (
                <div>
                  <h4 className="text-xs font-ui font-semibold uppercase tracking-wider text-muted mb-3">
                    {selectedCategory.name}
                  </h4>
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    <button
                      onClick={() => onSubcategoryChange(undefined)}
                      className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                        !filters.subcategory
                          ? "bg-pink-50 text-pink-vivid"
                          : "text-ink hover:bg-gray-50"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        !filters.subcategory ? "border-pink-vivid" : "border-gray-300"
                      }`}>
                        {!filters.subcategory && (
                          <span className="w-2 h-2 rounded-full bg-pink-vivid" />
                        )}
                      </span>
                      All
                    </button>
                    {selectedCategory.subcategories.map((sub) => (
                      <button
                        key={sub.value}
                        onClick={() => onSubcategoryChange(sub.value)}
                        className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm font-body transition-all ${
                          filters.subcategory === sub.value
                            ? "bg-pink-50 text-pink-vivid"
                            : "text-ink hover:bg-gray-50"
                        }`}
                      >
                        <span className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          filters.subcategory === sub.value ? "border-pink-vivid" : "border-gray-300"
                        }`}>
                          {filters.subcategory === sub.value && (
                            <span className="w-2 h-2 rounded-full bg-pink-vivid" />
                          )}
                        </span>
                        {sub.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col justify-end">
                {hasActiveFilters && (
                  <button
                    onClick={onClearFilters}
                    className="px-4 py-2.5 text-sm font-ui font-medium text-pink-vivid hover:bg-pink-50 rounded-lg transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Active Filters Tags */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap mt-6 pt-4 border-t border-black/[0.04]">
                <span className="text-xs font-ui text-muted">Active:</span>
                {filters.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary text-white text-xs font-ui rounded-full">
                    {selectedCategory?.name}
                    <button onClick={() => { onCategoryChange(undefined); onSubcategoryChange(undefined); }} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.subcategory && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-vivid text-white text-xs font-ui rounded-full">
                    {selectedCategory?.subcategories.find(s => s.value === filters.subcategory)?.label}
                    <button onClick={() => onSubcategoryChange(undefined)} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.delivery_type && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary/80 text-white text-xs font-ui rounded-full capitalize">
                    {filters.delivery_type}
                    <button onClick={() => onDeliveryTypeChange(undefined)} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.max_delivery_days !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary/80 text-white text-xs font-ui rounded-full">
                    {`Up to ${filters.max_delivery_days} days`}
                    <button onClick={() => onMaxDeliveryDaysChange(undefined)} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.min_revisions !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-warm text-white text-xs font-ui rounded-full">
                    {`${filters.min_revisions}+ revisions`}
                    <button onClick={() => onMinRevisionsChange(undefined)} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {getActivePriceLabel() && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-warm text-white text-xs font-ui rounded-full">
                    {getActivePriceLabel()}
                    <button onClick={() => onPriceRangeChange(undefined, undefined)} className="hover:bg-white/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
