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
  // 'both' shows all categories, otherwise filter by specific type
  const availableCategories = deliveryType === 'both'
    ? getAllCategories()
    : getCategoriesByDelivery(deliveryType);
  const selectedCategoryConfig = category ? getCategoryConfig(category) : undefined;

  const handleCategorySelect = (categoryId: string) => {
    onCategoryChange(categoryId);
    setShowSubcategories(true);
  };

  return (
    <div className="py-4">
      {/* Category Selection */}
      {!showSubcategories ? (
        <>
          <h2 className="text-xl font-semibold text-center mb-2">
            What type of product are you selling?
          </h2>
          <p className="text-muted text-center mb-8">
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
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setShowSubcategories(false)}
              className="text-sm text-purple-primary hover:underline flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Change category
            </button>

            {selectedCategoryConfig && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted">Category:</span>
                <span className="font-medium text-purple-primary">
                  {selectedCategoryConfig.name}
                </span>
              </div>
            )}
          </div>

          <h2 className="text-xl font-semibold text-center mb-2">
            What kind of {selectedCategoryConfig?.name.toLowerCase()} is it?
          </h2>
          <p className="text-muted text-center mb-8">
            Choose a more specific category to help buyers find your product
          </p>

          {selectedCategoryConfig && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedCategoryConfig.subcategories.map((sub) => (
                <button
                  key={sub.value}
                  onClick={() => onSubcategoryChange(sub.value)}
                  className={`p-4 rounded-xl border-2 text-left transition-all duration-200
                    ${subcategory === sub.value
                      ? "border-purple-primary bg-purple-50 shadow-sm"
                      : "border-gray-200 hover:border-purple-primary/30 hover:bg-gray-50"
                    }`}
                >
                  <span
                    className={`font-medium ${
                      subcategory === sub.value ? "text-purple-primary" : "text-gray-700"
                    }`}
                  >
                    {sub.label}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Skip subcategory option */}
          <p className="text-center text-sm text-muted mt-6">
            Not sure?{" "}
            <button
              onClick={() => onSubcategoryChange("")}
              className="text-purple-primary hover:underline"
            >
              Skip this step
            </button>
          </p>
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
      className={`p-6 rounded-xl border-2 text-center transition-all duration-200 group
        ${isSelected
          ? "border-purple-primary bg-gradient-to-br from-purple-50 to-pink-50 shadow-md"
          : "border-gray-200 hover:border-purple-primary/30 hover:shadow-sm"
        }`}
    >
      {/* Icon */}
      <div
        className={`w-14 h-14 mx-auto mb-3 rounded-full flex items-center justify-center
          transition-colors duration-200
          ${isSelected
            ? "bg-white shadow-sm"
            : "bg-gray-100 group-hover:bg-white"
          }`}
      >
        <div
          className={`transition-transform duration-200 ${
            isSelected ? "scale-110" : "group-hover:scale-105"
          }`}
        >
          {getCategoryIcon(category.icon)}
        </div>
      </div>

      {/* Name */}
      <h3
        className={`font-semibold mb-1 transition-colors
          ${isSelected
            ? "bg-gradient-to-r from-purple-primary to-pink-vivid bg-clip-text text-transparent"
            : "text-gray-800 group-hover:text-purple-primary"
          }`}
      >
        {category.name}
      </h3>

      {/* Description */}
      <p className="text-xs text-muted line-clamp-2">{category.description}</p>

      {/* Selection indicator */}
      {isSelected && (
        <div className="mt-3 flex justify-center">
          <div className="w-5 h-5 rounded-full bg-purple-primary flex items-center justify-center">
            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
      )}
    </button>
  );
}
