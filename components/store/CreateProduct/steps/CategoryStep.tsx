"use client";

import { useState } from "react";
import { ProductDelivery } from "@/lib/types/store";
import {
  getCategoriesByDelivery,
  getCategoryConfig,
  getCategoryIcon,
  getAllCategories,
  CategoryConfig,
} from "@/lib/store/categories";

interface CategoryStepProps {
  deliveryType: ProductDelivery;
  category: string | null;
  subcategory: string | null;
  onCategoryChange: (category: string) => void;
  onSubcategoryChange: (subcategory: string) => void;
}

export default function CategoryStep({
  deliveryType,
  category,
  subcategory,
  onCategoryChange,
  onSubcategoryChange,
}: CategoryStepProps) {
  const [showSubcategories, setShowSubcategories] = useState(!!category);

  // Get available categories based on delivery type
  const availableCategories = deliveryType === 'both'
    ? getAllCategories()
    : getCategoriesByDelivery(deliveryType);
  const selectedCategoryConfig = category ? getCategoryConfig(category) : undefined;

  const handleCategorySelect = (categoryId: string) => {
    onCategoryChange(categoryId);
    setShowSubcategories(true);
  };

  return (
    <div className="py-6">
      {/* Category Selection */}
      {!showSubcategories ? (
        <>
          <p className="text-center text-muted font-body mb-10 max-w-md mx-auto">
            Select the category that best describes your{" "}
            {deliveryType === "digital" ? "digital product" : "creation"}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {availableCategories.map((cat) => (
              <CategoryCard
                key={cat.id}
                category={cat}
                isSelected={category === cat.id}
                onClick={() => handleCategorySelect(cat.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          {/* Subcategory Selection */}
          <div className="flex items-center justify-between mb-8">
            <button
              onClick={() => setShowSubcategories(false)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl
                bg-white/50 backdrop-blur-sm border border-gray-200/50
                text-sm text-muted hover:text-purple-primary hover:border-purple-primary/20
                transition-all duration-300 group"
            >
              <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change category
            </button>

            {selectedCategoryConfig && (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5 border border-purple-primary/10">
                <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                  <div className="text-white scale-75">
                    {getCategoryIcon(selectedCategoryConfig.icon)}
                  </div>
                </div>
                <span className="text-sm font-medium text-purple-primary">
                  {selectedCategoryConfig.name}
                </span>
              </div>
            )}
          </div>

          <p className="text-center text-muted font-body mb-8 max-w-md mx-auto">
            Choose a more specific category to help buyers find your product
          </p>

          {selectedCategoryConfig && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedCategoryConfig.subcategories.map((sub) => {
                const isSelected = subcategory === sub.value;

                return (
                  <button
                    key={sub.value}
                    onClick={() => onSubcategoryChange(sub.value)}
                    className={`
                      relative p-5 rounded-2xl text-left
                      transition-all duration-300 group
                      ${isSelected
                        ? "bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-transparent border-2 border-purple-primary/30 shadow-lg shadow-purple-primary/5"
                        : "bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:border-purple-primary/20 hover:bg-white/70 hover:shadow-md"
                      }
                    `}
                  >
                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}

                    <span
                      className={`
                        font-medium font-ui transition-colors
                        ${isSelected
                          ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
                          : "text-ink group-hover:text-purple-primary"
                        }
                      `}
                    >
                      {sub.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Skip option */}
          <div className="mt-8 text-center">
            <button
              onClick={() => onSubcategoryChange("")}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full
                bg-white/50 backdrop-blur-sm border border-gray-200/50
                text-sm text-muted hover:text-purple-primary hover:border-purple-primary/20
                transition-all duration-300"
            >
              <span>Skip this step</span>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// Category Card Component
function CategoryCard({
  category,
  isSelected,
  onClick,
}: {
  category: CategoryConfig;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative p-6 rounded-2xl text-center
        transition-all duration-500 group
        ${isSelected
          ? "bg-gradient-to-br from-purple-primary/10 via-pink-vivid/5 to-orange-warm/5 border-2 border-purple-primary/30 shadow-xl shadow-purple-primary/10"
          : "bg-white/50 backdrop-blur-sm border border-gray-200/50 hover:border-purple-primary/20 hover:bg-white/70 hover:shadow-lg"
        }
      `}
    >
      {/* Selection indicator */}
      <div
        className={`
          absolute top-3 right-3 w-5 h-5 rounded-full
          flex items-center justify-center
          transition-all duration-300
          ${isSelected
            ? "bg-gradient-to-br from-purple-primary to-pink-vivid scale-100 opacity-100"
            : "bg-gray-100 scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100"
          }
        `}
      >
        {isSelected && (
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Icon */}
      <div
        className={`
          w-14 h-14 mx-auto mb-4 rounded-2xl
          flex items-center justify-center
          transition-all duration-500
          ${isSelected
            ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/20"
            : "bg-gray-50 text-gray-400 group-hover:bg-gradient-to-br group-hover:from-purple-50 group-hover:to-pink-50 group-hover:text-purple-primary"
          }
        `}
      >
        <div className={`transition-transform duration-300 ${isSelected ? "scale-110" : "group-hover:scale-105"}`}>
          {getCategoryIcon(category.icon)}
        </div>
      </div>

      {/* Name */}
      <h3
        className={`
          font-semibold font-display mb-1 transition-colors
          ${isSelected
            ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
            : "text-ink group-hover:text-purple-primary"
          }
        `}
      >
        {category.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-muted line-clamp-2 font-body">{category.description}</p>
    </button>
  );
}
