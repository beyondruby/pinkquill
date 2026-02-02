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
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100">
        {/* Main Header Row */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            {/* Left: Title & Count */}
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-semibold text-ink">Shop</h1>
              <span className="hidden sm:block text-sm text-gray-400">
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
                  className="w-full h-10 pl-10 pr-4 bg-gray-50 rounded-full text-sm text-ink placeholder:text-gray-400 border-0 focus:outline-none focus:ring-1 focus:ring-gray-200 transition-all"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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
                className="md:hidden p-2 text-gray-500 hover:text-ink rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>

              {/* Sort dropdown */}
              <div className="relative hidden sm:block" ref={sortRef}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-ink rounded-lg hover:bg-gray-50 transition-colors"
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
                  <div className="absolute top-full right-0 mt-1 w-44 bg-white rounded-xl border border-gray-100 shadow-lg py-1 z-50">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-50 transition-colors ${
                          filters.sort_by === option.value ? "text-ink font-medium" : "text-gray-600"
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
                className="sm:hidden flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-50"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                </svg>
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 bg-ink rounded-full" />}
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
                  className="w-full h-10 pl-10 pr-4 bg-gray-50 rounded-full text-sm text-ink placeholder:text-gray-400 border-0 focus:outline-none focus:ring-1 focus:ring-gray-200"
                />
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
        <div className="border-t border-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-1 py-3 overflow-x-auto scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0">
              {/* All */}
              <button
                onClick={() => onCategoryChange(undefined)}
                className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full transition-colors ${
                  !filters.category
                    ? "bg-ink text-white"
                    : "text-gray-600 hover:text-ink hover:bg-gray-50"
                }`}
              >
                All
              </button>

              {/* Category pills */}
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => onCategoryChange(filters.category === cat.id ? undefined : cat.id)}
                  className={`flex-shrink-0 px-4 py-1.5 text-sm rounded-full transition-colors ${
                    filters.category === cat.id
                      ? "bg-ink text-white"
                      : "text-gray-600 hover:text-ink hover:bg-gray-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}

              {/* Delivery type filters - desktop */}
              <div className="hidden sm:flex items-center gap-1 ml-4 pl-4 border-l border-gray-200">
                <button
                  onClick={() => onDeliveryTypeChange(filters.delivery_type === "physical" ? undefined : "physical")}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-full transition-colors ${
                    filters.delivery_type === "physical"
                      ? "bg-gray-100 text-ink"
                      : "text-gray-500 hover:text-ink"
                  }`}
                >
                  Physical
                </button>
                <button
                  onClick={() => onDeliveryTypeChange(filters.delivery_type === "digital" ? undefined : "digital")}
                  className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-full transition-colors ${
                    filters.delivery_type === "digital"
                      ? "bg-gray-100 text-ink"
                      : "text-gray-500 hover:text-ink"
                  }`}
                >
                  Digital
                </button>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  className="flex-shrink-0 ml-2 px-3 py-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="absolute inset-0 bg-black/20" onClick={() => setShowMobileFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl max-h-[70vh] overflow-y-auto animate-slideUp">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-ink">Filters</h3>
                <button onClick={() => setShowMobileFilters(false)} className="p-1 text-gray-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sort */}
              <div className="mb-6">
                <h4 className="text-sm font-medium text-gray-500 mb-3">Sort by</h4>
                <div className="space-y-2">
                  {sortOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onSortChange(option.value)}
                      className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-colors ${
                        filters.sort_by === option.value
                          ? "bg-gray-100 text-ink font-medium"
                          : "text-gray-600 hover:bg-gray-50"
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
                <h4 className="text-sm font-medium text-gray-500 mb-3">Type</h4>
                <div className="flex gap-2">
                  <button
                    onClick={() => onDeliveryTypeChange(undefined)}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm transition-colors ${
                      !filters.delivery_type ? "bg-gray-100 text-ink font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => onDeliveryTypeChange("physical")}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm transition-colors ${
                      filters.delivery_type === "physical" ? "bg-gray-100 text-ink font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Physical
                  </button>
                  <button
                    onClick={() => onDeliveryTypeChange("digital")}
                    className={`flex-1 px-4 py-3 rounded-xl text-sm transition-colors ${
                      filters.delivery_type === "digital" ? "bg-gray-100 text-ink font-medium" : "text-gray-600 hover:bg-gray-50"
                    }`}
                  >
                    Digital
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4 border-t border-gray-100">
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      onClearFilters();
                      setShowMobileFilters(false);
                    }}
                    className="flex-1 px-4 py-3 rounded-xl text-sm text-gray-600 border border-gray-200"
                  >
                    Clear All
                  </button>
                )}
                <button
                  onClick={() => setShowMobileFilters(false)}
                  className="flex-1 px-4 py-3 rounded-xl text-sm text-white bg-ink font-medium"
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
