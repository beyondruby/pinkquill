"use client";

import React, { useState, useRef, useEffect } from "react";
import { PRODUCT_CATEGORIES } from "@/lib/store/categories";
import type { MarketplaceFilters as Filters, MarketplaceSortOption } from "@/lib/hooks/useMarketplace";

interface MarketplaceFiltersProps {
  filters: Filters;
  onCategoryChange: (category: string | undefined) => void;
  onSubcategoryChange: (subcategory: string | undefined) => void;
  onDeliveryTypeChange: (type: "physical" | "digital" | undefined) => void;
  onSortChange: (sort: MarketplaceSortOption) => void;
  onClearFilters: () => void;
  totalProducts: number;
}

const sortOptions: { value: MarketplaceSortOption; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "price_low", label: "Price: Low to High" },
  { value: "price_high", label: "Price: High to Low" },
  { value: "popular", label: "Most Popular" },
];

export default function MarketplaceFilters({
  filters,
  onCategoryChange,
  onSubcategoryChange,
  onDeliveryTypeChange,
  onSortChange,
  onClearFilters,
  totalProducts,
}: MarketplaceFiltersProps) {
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const categoryRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  const categories = Object.values(PRODUCT_CATEGORIES);
  const selectedCategory = filters.category
    ? PRODUCT_CATEGORIES[filters.category]
    : undefined;

  const hasActiveFilters =
    filters.category ||
    filters.subcategory ||
    filters.delivery_type ||
    filters.keywords?.length;

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <>
      <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-lg border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left side - Filters */}
            <div className="flex items-center gap-3">
              {/* Mobile filter button */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="md:hidden flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl border border-black/[0.06] text-ink"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                  />
                </svg>
                <span className="font-ui text-sm font-medium">Filters</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 bg-pink-vivid rounded-full" />
                )}
              </button>

              {/* Desktop Category dropdown */}
              <div className="hidden md:block relative" ref={categoryRef}>
                <button
                  onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all duration-200 ${
                    filters.category
                      ? "bg-pink-vivid/10 border-pink-vivid/30 text-pink-vivid"
                      : "bg-white border-black/[0.08] text-ink hover:border-pink-vivid/30"
                  }`}
                >
                  <span className="font-ui text-sm">
                    {selectedCategory ? selectedCategory.name : "Category"}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showCategoryDropdown ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showCategoryDropdown && (
                  <div className="absolute top-full left-0 mt-2 w-56 bg-white rounded-2xl border border-black/[0.06] shadow-xl shadow-black/[0.08] py-2 z-50 animate-fadeIn">
                    <button
                      onClick={() => {
                        onCategoryChange(undefined);
                        setShowCategoryDropdown(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left font-ui text-sm hover:bg-pink-50 transition-colors ${
                        !filters.category ? "text-pink-vivid font-medium" : "text-ink"
                      }`}
                    >
                      All Categories
                    </button>
                    <div className="my-1 mx-3 h-px bg-black/[0.06]" />
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => {
                          onCategoryChange(cat.id);
                          setShowCategoryDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left font-ui text-sm hover:bg-pink-50 transition-colors ${
                          filters.category === cat.id
                            ? "text-pink-vivid font-medium"
                            : "text-ink"
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Delivery Type Tabs - Desktop */}
              <div className="hidden md:flex items-center p-1 bg-gradient-to-r from-orange-50 to-pink-50 rounded-xl">
                <button
                  onClick={() => onDeliveryTypeChange(undefined)}
                  className={`px-4 py-2 rounded-lg font-ui text-sm transition-all duration-200 ${
                    !filters.delivery_type
                      ? "bg-white text-pink-vivid shadow-sm font-medium"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() =>
                    onDeliveryTypeChange(
                      filters.delivery_type === "physical" ? undefined : "physical"
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-ui text-sm transition-all duration-200 ${
                    filters.delivery_type === "physical"
                      ? "bg-white text-pink-vivid shadow-sm font-medium"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Physical
                </button>
                <button
                  onClick={() =>
                    onDeliveryTypeChange(
                      filters.delivery_type === "digital" ? undefined : "digital"
                    )
                  }
                  className={`px-4 py-2 rounded-lg font-ui text-sm transition-all duration-200 ${
                    filters.delivery_type === "digital"
                      ? "bg-white text-pink-vivid shadow-sm font-medium"
                      : "text-muted hover:text-ink"
                  }`}
                >
                  Digital
                </button>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <button
                  onClick={onClearFilters}
                  className="hidden md:flex items-center gap-1.5 px-3 py-2 text-muted hover:text-pink-vivid transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  <span className="font-ui text-sm">Clear</span>
                </button>
              )}
            </div>

            {/* Right side - Results count & Sort */}
            <div className="flex items-center gap-4">
              <span className="hidden sm:block font-body text-sm text-muted">
                {totalProducts} {totalProducts === 1 ? "product" : "products"}
              </span>

              {/* Sort dropdown */}
              <div className="relative" ref={sortRef}>
                <button
                  onClick={() => setShowSortDropdown(!showSortDropdown)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-white rounded-xl border border-black/[0.08] text-ink hover:border-pink-vivid/30 transition-all duration-200"
                >
                  <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
                    />
                  </svg>
                  <span className="font-ui text-sm">
                    {sortOptions.find((o) => o.value === filters.sort_by)?.label}
                  </span>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showSortDropdown ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {showSortDropdown && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-2xl border border-black/[0.06] shadow-xl shadow-black/[0.08] py-2 z-50 animate-fadeIn">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          onSortChange(option.value);
                          setShowSortDropdown(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left font-ui text-sm hover:bg-pink-50 transition-colors ${
                          filters.sort_by === option.value
                            ? "text-pink-vivid font-medium"
                            : "text-ink"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Active filter pills */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-black/[0.04]">
              {filters.category && (
                <button
                  onClick={() => onCategoryChange(undefined)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-vivid rounded-full font-ui text-xs"
                >
                  {selectedCategory?.name}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {filters.delivery_type && (
                <button
                  onClick={() => onDeliveryTypeChange(undefined)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-pink-50 text-pink-vivid rounded-full font-ui text-xs capitalize"
                >
                  {filters.delivery_type}
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
              {filters.keywords?.map((keyword) => (
                <span
                  key={keyword}
                  className="px-3 py-1.5 bg-purple-50 text-purple-primary rounded-full font-ui text-xs"
                >
                  "{keyword}"
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Sheet */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl p-6 animate-slideUp max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-display text-lg font-semibold text-ink">Filters</h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 -m-2 text-muted hover:text-ink"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Category */}
            <div className="mb-6">
              <h4 className="font-ui text-sm font-medium text-ink mb-3">Category</h4>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onCategoryChange(undefined)}
                  className={`px-4 py-2 rounded-xl font-ui text-sm transition-all ${
                    !filters.category
                      ? "bg-pink-vivid text-white"
                      : "bg-gray-100 text-ink hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => onCategoryChange(cat.id)}
                    className={`px-4 py-2 rounded-xl font-ui text-sm transition-all ${
                      filters.category === cat.id
                        ? "bg-pink-vivid text-white"
                        : "bg-gray-100 text-ink hover:bg-gray-200"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Delivery Type */}
            <div className="mb-6">
              <h4 className="font-ui text-sm font-medium text-ink mb-3">Delivery Type</h4>
              <div className="flex gap-2">
                <button
                  onClick={() => onDeliveryTypeChange(undefined)}
                  className={`flex-1 px-4 py-3 rounded-xl font-ui text-sm transition-all ${
                    !filters.delivery_type
                      ? "bg-pink-vivid text-white"
                      : "bg-gray-100 text-ink hover:bg-gray-200"
                  }`}
                >
                  All
                </button>
                <button
                  onClick={() => onDeliveryTypeChange("physical")}
                  className={`flex-1 px-4 py-3 rounded-xl font-ui text-sm transition-all ${
                    filters.delivery_type === "physical"
                      ? "bg-pink-vivid text-white"
                      : "bg-gray-100 text-ink hover:bg-gray-200"
                  }`}
                >
                  Physical
                </button>
                <button
                  onClick={() => onDeliveryTypeChange("digital")}
                  className={`flex-1 px-4 py-3 rounded-xl font-ui text-sm transition-all ${
                    filters.delivery_type === "digital"
                      ? "bg-pink-vivid text-white"
                      : "bg-gray-100 text-ink hover:bg-gray-200"
                  }`}
                >
                  Digital
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              {hasActiveFilters && (
                <button
                  onClick={() => {
                    onClearFilters();
                    setShowMobileFilters(false);
                  }}
                  className="flex-1 px-4 py-3 rounded-xl border border-black/[0.08] font-ui text-sm text-muted"
                >
                  Clear All
                </button>
              )}
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui text-sm font-medium"
              >
                Show Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
