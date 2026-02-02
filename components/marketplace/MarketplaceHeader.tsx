"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { MarketplaceFilters, MarketplaceSortOption } from "@/lib/hooks/useMarketplace";

interface MarketplaceHeaderProps {
  filters: MarketplaceFilters;
  onSearch: (query: string) => void;
  onCategoryChange: (category: string | undefined) => void;
  onDeliveryTypeChange: (type: "physical" | "digital" | undefined) => void;
  onSortChange: (sort: MarketplaceSortOption) => void;
  onClearFilters: () => void;
  totalProducts: number;
}

const sortOptions: { value: MarketplaceSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "popular", label: "Popular" },
];

const categories = Object.values(PRODUCT_CATEGORIES);

export default function MarketplaceHeader({
  filters,
  onSearch,
  onCategoryChange,
  onDeliveryTypeChange,
  onSortChange,
  onClearFilters,
  totalProducts,
}: MarketplaceHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const hasActiveFilters =
    filters.category || filters.delivery_type || filters.keywords?.length;

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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search when expanded
  useEffect(() => {
    if (searchExpanded && searchRef.current) {
      searchRef.current.focus();
    }
  }, [searchExpanded]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-black/[0.04]">
        {/* Main Header Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Title & Count */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-display font-semibold text-ink">Shop</h1>
              <span className="hidden sm:block text-sm text-muted font-body">
                {totalProducts.toLocaleString()} products
              </span>
            </div>

            {/* Center: Search (desktop) */}
            <div className="hidden md:flex flex-1 max-w-md mx-8">
              <div className="relative w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full h-10 pl-10 pr-4 bg-orange-50/50 rounded-full text-sm font-body text-ink placeholder:text-muted/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid/30 transition-all"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => handleSearch("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-pink-vivid transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            {/* Right: Sort & Filter */}
            <div className="flex items-center gap-2">
              {/* Mobile search toggle */}
              <button
                onClick={() => setSearchExpanded(!searchExpanded)}
                className="md:hidden p-2 text-muted hover:text-pink-vivid rounded-xl hover:bg-pink-50 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Sort dropdown */}
              <div className="relative hidden sm:block" ref={sortRef}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-3 py-2 text-sm font-ui text-muted hover:text-pink-vivid rounded-xl hover:bg-pink-50 transition-colors"
                >
                  <span>{sortOptions.find((o) => o.value === filters.sort_by)?.label}</span>
                  <svg
                    className={`w-4 h-4 transition-transform ${showSortDropdown ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showSortDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white/95 backdrop-blur-xl rounded-2xl border border-black/[0.06] shadow-xl shadow-black/[0.08] py-1.5 z-50 animate-fadeIn">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm font-ui hover:bg-pink-50 transition-colors ${
                          filters.sort_by === option.value ? "text-pink-vivid font-medium" : "text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile filter button */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="sm:hidden flex items-center gap-1.5 px-3 py-2 text-sm font-ui text-muted rounded-xl hover:bg-pink-50 hover:text-pink-vivid transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 bg-pink-vivid rounded-full" />}
              </button>
            </div>
          </div>

          {/* Mobile Search (expanded) */}
          {searchExpanded && (
            <div className="md:hidden pb-3">
              <div className="relative">
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search products..."
                  className="w-full h-10 pl-10 pr-4 bg-orange-50/50 rounded-full text-sm font-body text-ink placeholder:text-muted/60 border border-black/[0.04] focus:outline-none focus:ring-2 focus:ring-pink-vivid/20 focus:border-pink-vivid/30"
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
          )}
        </div>

        {/* Category Pills Row */}
        <div className="border-t border-black/[0.03]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1.5 py-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* All */}
              <button
                onClick={() => onCategoryChange(undefined)}
                className={`flex-shrink-0 px-4 py-2 text-sm font-ui rounded-xl transition-all duration-200 ${
                  !filters.category
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-sm"
                    : "text-muted hover:text-pink-vivid hover:bg-pink-50"
                }`}
              >
                All
              </button>

              {/* Category pills */}
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(filters.category === cat.id ? undefined : cat.id)}
                  className={`flex-shrink-0 px-4 py-2 text-sm font-ui rounded-xl transition-all duration-200 ${
                    filters.category === cat.id
                      ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-sm"
                      : "text-muted hover:text-pink-vivid hover:bg-pink-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}

              {/* Delivery type filters - desktop */}
              <div className="hidden sm:flex items-center gap-1.5 ml-3 pl-3 border-l border-black/[0.06]">
                <button
                  onClick={() => onDeliveryTypeChange(filters.delivery_type === "physical" ? undefined : "physical")}
                  className={`flex-shrink-0 px-3 py-2 text-sm font-ui rounded-xl transition-all duration-200 ${
                    filters.delivery_type === "physical"
                      ? "bg-orange-100 text-orange-warm"
                      : "text-muted hover:text-orange-warm hover:bg-orange-50"
                  }`}
                >
                  Physical
                </button>
                <button
                  onClick={() => onDeliveryTypeChange(filters.delivery_type === "digital" ? undefined : "digital")}
                  className={`flex-shrink-0 px-3 py-2 text-sm font-ui rounded-xl transition-all duration-200 ${
                    filters.delivery_type === "digital"
                      ? "bg-purple-100 text-purple-primary"
                      : "text-muted hover:text-purple-primary hover:bg-purple-50"
                  }`}
                >
                  Digital
                </button>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  className="flex-shrink-0 ml-2 px-3 py-2 text-sm font-ui text-muted hover:text-pink-vivid transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl max-h-[70vh] overflow-y-auto animate-slideUp">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-display font-semibold text-ink">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-1 text-muted hover:text-pink-vivid">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sort */}
              <div className="mb-6">
                <h4 className="text-sm font-ui font-medium text-muted mb-3">Sort by</h4>
                <div className="space-y-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onSortChange(option.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-ui transition-colors ${
                        filters.sort_by === option.value
                          ? "bg-pink-50 text-pink-vivid font-medium"
                          : "text-ink hover:bg-pink-50/50"
                      }`}
                    >
                      {option.label}
                      {filters.sort_by === option.value && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Delivery Type */}
              <div className="mb-6">
                <h4 className="text-sm font-ui font-medium text-muted mb-3">Type</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDeliveryTypeChange(undefined)}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-ui transition-colors ${
                      !filters.delivery_type ? "bg-pink-vivid text-white" : "bg-pink-50 text-ink hover:bg-pink-100"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => onDeliveryTypeChange("physical")}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-ui transition-colors ${
                      filters.delivery_type === "physical" ? "bg-orange-warm text-white" : "bg-orange-50 text-ink hover:bg-orange-100"
                    }`}
                  >
                    Physical
                  </button>
                  <button
                    onClick={() => onDeliveryTypeChange("digital")}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm font-ui transition-colors ${
                      filters.delivery_type === "digital" ? "bg-purple-primary text-white" : "bg-purple-50 text-ink hover:bg-purple-100"
                    }`}
                  >
                    Digital
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-black/[0.04]">
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      onClearFilters();
                      setShowMobileFilters(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl text-sm font-ui text-muted border border-black/[0.08]"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm font-ui text-white bg-gradient-to-r from-purple-primary to-pink-vivid font-medium shadow-lg shadow-pink-vivid/20"
                >
                  Show Results
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
