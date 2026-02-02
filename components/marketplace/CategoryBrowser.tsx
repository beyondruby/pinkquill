"use client";

import React from "react";
import { PRODUCT_CATEGORIES, CATEGORY_ICONS } from "@/lib/store/categories";

interface CategoryBrowserProps {
  onCategorySelect: (category: string | undefined) => void;
  selectedCategory?: string;
  categoryCounts: Record<string, number>;
}

export default function CategoryBrowser({
  onCategorySelect,
  selectedCategory,
  categoryCounts,
}: CategoryBrowserProps) {
  const categories = Object.values(PRODUCT_CATEGORIES);

  return (
    <div className="py-8 bg-white border-b border-black/[0.04]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-lg font-semibold text-ink mb-5">Browse by Category</h2>

        {/* Scrollable container for mobile */}
        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap sm:overflow-visible">
          {/* All category */}
          <button
            onClick={() => onCategorySelect(undefined)}
            className={`flex-shrink-0 group relative flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 ${
              !selectedCategory
                ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white border-transparent shadow-lg shadow-pink-vivid/20"
                : "bg-white border-black/[0.06] hover:border-pink-vivid/30 hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-pink-50/50"
            }`}
          >
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                !selectedCategory
                  ? "bg-white/20"
                  : "bg-gradient-to-br from-orange-100 to-pink-100 group-hover:from-orange-200 group-hover:to-pink-200"
              }`}
            >
              <svg
                className={`w-5 h-5 ${!selectedCategory ? "text-white" : "text-pink-vivid"}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <div className="text-left">
              <span
                className={`font-ui text-sm font-medium block ${
                  !selectedCategory ? "text-white" : "text-ink"
                }`}
              >
                All
              </span>
              <span
                className={`font-body text-xs ${
                  !selectedCategory ? "text-white/70" : "text-muted"
                }`}
              >
                {Object.values(categoryCounts).reduce((a, b) => a + b, 0)} items
              </span>
            </div>
          </button>

          {categories.map((category) => {
            const isSelected = selectedCategory === category.id;
            const count = categoryCounts[category.id] || 0;
            const Icon = CATEGORY_ICONS[category.icon];

            return (
              <button
                key={category.id}
                onClick={() => onCategorySelect(isSelected ? undefined : category.id)}
                className={`flex-shrink-0 group relative flex items-center gap-3 px-5 py-4 rounded-2xl border transition-all duration-300 ${
                  isSelected
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white border-transparent shadow-lg shadow-pink-vivid/20"
                    : "bg-white border-black/[0.06] hover:border-pink-vivid/30 hover:bg-gradient-to-br hover:from-orange-50/50 hover:to-pink-50/50"
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-white/20"
                      : "bg-gradient-to-br from-orange-100 to-pink-100 group-hover:from-orange-200 group-hover:to-pink-200"
                  }`}
                >
                  <div className={isSelected ? "text-white" : "text-pink-vivid"}>{Icon}</div>
                </div>
                <div className="text-left">
                  <span
                    className={`font-ui text-sm font-medium block whitespace-nowrap ${
                      isSelected ? "text-white" : "text-ink"
                    }`}
                  >
                    {category.name}
                  </span>
                  <span
                    className={`font-body text-xs ${isSelected ? "text-white/70" : "text-muted"}`}
                  >
                    {count} {count === 1 ? "item" : "items"}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
