"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useBadgeCounts } from "@/components/providers/BadgeCountProvider";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { MarketplaceFilters, MarketplaceSortOption } from "@/lib/hooks/useMarketplace";
import {
  countActiveMarketplaceFilters,
  hasActiveMarketplaceFilters,
} from "@/lib/hooks/useMarketplace";
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
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
];

const priceRanges = [
  { label: "Free", min: 0, max: 0 },
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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasActiveFilters = hasActiveMarketplaceFilters(filters);
  const activeFilterCount = countActiveMarketplaceFilters(filters);

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

  // Close any open subcategory dropdown when the user clicks outside or
  // hits Escape — keyboard + touch friendly replacement for the prior
  // hover-only behaviour.
  useEffect(() => {
    if (!activeDropdown) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-marketplace-category-menu]")) return;
      setActiveDropdown(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActiveDropdown(null);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [activeDropdown]);

  const getActivePriceLabel = () => {
    if (filters.min_price === undefined && filters.max_price === undefined) return null;
    const range = priceRanges.find(
      r => r.min === filters.min_price && r.max === filters.max_price
    );
    return range?.label || `$${filters.min_price || 0}${filters.max_price ? ` - $${filters.max_price}` : '+'}`;
  };

  return (
    <div className="sticky top-0 z-40 bg-surface/90 backdrop-blur-md border-b border-border-light shadow-sm">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12">
        {/* Main Bar */}
        <div className="flex items-center justify-between gap-3 h-16 sm:h-[72px]">
          <div className="hidden sm:flex items-center p-1.5 bg-gradient-to-r from-orange-warm/[0.08] via-pink-vivid/[0.08] to-purple-primary/[0.08] rounded-full border border-border-light shadow-sm">
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
                className="w-full h-10 pl-10 pr-4 bg-surface rounded-full text-sm font-body text-ink placeholder:text-muted/60 border border-border-light shadow-sm focus:border-pink-vivid/40 focus:bg-surface focus:outline-none focus:ring-2 focus:ring-pink-vivid/10 transition-all"
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
              aria-expanded={showFilters}
              aria-controls="marketplace-filters-panel"
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-ui transition-all ${
                showFilters
                  ? catalogType === "service"
                    ? "bg-gradient-to-r from-pink-vivid to-orange-warm text-white"
                    : "bg-gradient-to-r from-purple-primary to-pink-vivid text-white"
                  : hasActiveFilters
                  ? "bg-pink-vivid/10 text-pink-vivid border border-pink-vivid/20"
                  : "bg-surface text-ink border border-border-light hover:bg-subtle"
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
              </svg>
              <span className="hidden sm:inline">Filters</span>
              {hasActiveFilters && !showFilters && (
                <span className="w-5 h-5 flex items-center justify-center bg-pink-vivid text-white text-xs rounded-full">
                  {activeFilterCount}
                </span>
              )}
            </button>

            <select
              value={filters.sort_by}
              onChange={(e) => onSortChange(e.target.value as MarketplaceSortOption)}
              className="h-10 px-4 bg-surface rounded-full text-sm font-ui text-ink border border-border-light focus:outline-none focus:ring-2 focus:ring-pink-vivid/10 cursor-pointer"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <Link
              href="/cart"
              className="relative flex items-center justify-center w-10 h-10 rounded-full bg-surface border border-border-light text-muted hover:text-accent hover:bg-accent/[0.04] transition-all"
              title="Bag"
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
                : "bg-surface border border-border-light text-muted hover:text-ink hover:bg-subtle"
            }`}
          >
            All
          </button>

          {categoryOptions.map((cat) => {
            const hasSubcategories = cat.subcategories.length > 0;
            const isOpen = activeDropdown === cat.id;
            return (
              <div
                key={cat.id}
                className="relative flex-shrink-0"
                data-marketplace-category-menu
              >
                <button
                  onClick={() => {
                    if (hasSubcategories) {
                      // First click: open the menu so users can pick a
                      // subcategory. Second click on the open category:
                      // collapse it without changing the filter.
                      if (filters.category === cat.id && isOpen) {
                        setActiveDropdown(null);
                        onCategoryChange(undefined);
                        onSubcategoryChange(undefined);
                        return;
                      }
                      onCategoryChange(cat.id);
                      onSubcategoryChange(undefined);
                      setActiveDropdown(isOpen ? null : cat.id);
                      return;
                    }

                    if (filters.category === cat.id) {
                      onCategoryChange(undefined);
                      onSubcategoryChange(undefined);
                    } else {
                      onCategoryChange(cat.id);
                      onSubcategoryChange(undefined);
                    }
                    setActiveDropdown(null);
                  }}
                  aria-haspopup={hasSubcategories ? "menu" : undefined}
                  aria-expanded={hasSubcategories ? isOpen : undefined}
                  className={`px-4 py-2 rounded-full text-sm font-ui transition-all ${
                    filters.category === cat.id
                      ? activeCategoryClass
                      : "bg-surface border border-border-light text-muted hover:text-ink hover:bg-subtle"
                  }`}
                >
                  {cat.name}
                </button>

                {/* Subcategory Dropdown */}
                {isOpen && hasSubcategories && (
                  <div
                    role="menu"
                    className="absolute top-full left-0 mt-2 py-2 bg-surface rounded-xl border border-border-light shadow-xl min-w-[190px] z-50 animate-fadeIn"
                  >
                    {cat.subcategories.map((sub) => (
                      <button
                        key={sub.value}
                        role="menuitem"
                        onClick={() => {
                          onCategoryChange(cat.id);
                          onSubcategoryChange(sub.value);
                          setActiveDropdown(null);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-body transition-colors ${
                          filters.subcategory === sub.value
                            ? "bg-pink-vivid/10 text-pink-vivid"
                            : "text-ink hover:bg-subtle"
                        }`}
                      >
                        {sub.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Expanded Filter Panel */}
      {showFilters && (
        <div
          id="marketplace-filters-panel"
          className="border-t border-border-light bg-gradient-to-b from-orange-warm/[0.04] via-surface to-surface animate-fadeIn"
        >
          <div className="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-12 py-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 bg-surface/90 border border-border-light rounded-2xl p-5 shadow-sm">
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
                          ? "bg-pink-vivid/10 text-pink-vivid"
                          : "text-ink hover:bg-subtle"
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
                            ? "bg-purple-primary/10 text-purple-primary"
                            : "text-ink hover:bg-subtle"
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
                          ? "bg-purple-primary/10 text-purple-primary"
                          : "text-ink hover:bg-subtle"
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
                            ? "bg-purple-primary/10 text-purple-primary"
                            : "text-ink hover:bg-subtle"
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
                        ? "bg-orange-warm/10 text-orange-warm"
                        : "text-ink hover:bg-subtle"
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
                          ? "bg-orange-warm/10 text-orange-warm"
                          : "text-ink hover:bg-subtle"
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
                          ? "bg-orange-warm/10 text-orange-warm"
                          : "text-ink hover:bg-subtle"
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
                            ? "bg-orange-warm/10 text-orange-warm"
                            : "text-ink hover:bg-subtle"
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
                          ? "bg-pink-vivid/10 text-pink-vivid"
                          : "text-ink hover:bg-subtle"
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
                            ? "bg-pink-vivid/10 text-pink-vivid"
                            : "text-ink hover:bg-subtle"
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
                    className="px-4 py-2.5 text-sm font-ui font-medium text-pink-vivid hover:bg-pink-vivid/10 rounded-lg transition-colors"
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            </div>

            {/* Active Filters Tags */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 flex-wrap mt-6 pt-4 border-t border-border-light">
                <span className="text-xs font-ui text-muted">Active:</span>
                {filters.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary text-white text-xs font-ui rounded-full">
                    {selectedCategory?.name}
                    <button onClick={() => { onCategoryChange(undefined); onSubcategoryChange(undefined); }} className="hover:bg-surface/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.subcategory && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-pink-vivid text-white text-xs font-ui rounded-full">
                    {selectedCategory?.subcategories.find(s => s.value === filters.subcategory)?.label}
                    <button onClick={() => onSubcategoryChange(undefined)} className="hover:bg-surface/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.delivery_type && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary/80 text-white text-xs font-ui rounded-full capitalize">
                    {filters.delivery_type}
                    <button onClick={() => onDeliveryTypeChange(undefined)} className="hover:bg-surface/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.max_delivery_days !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-primary/80 text-white text-xs font-ui rounded-full">
                    {`Up to ${filters.max_delivery_days} days`}
                    <button onClick={() => onMaxDeliveryDaysChange(undefined)} className="hover:bg-surface/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {filters.min_revisions !== undefined && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-warm text-white text-xs font-ui rounded-full">
                    {`${filters.min_revisions}+ revisions`}
                    <button onClick={() => onMinRevisionsChange(undefined)} className="hover:bg-surface/20 rounded-full p-0.5">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                )}
                {getActivePriceLabel() && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-warm text-white text-xs font-ui rounded-full">
                    {getActivePriceLabel()}
                    <button onClick={() => onPriceRangeChange(undefined, undefined)} className="hover:bg-surface/20 rounded-full p-0.5">
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
