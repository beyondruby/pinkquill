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
      {!showSubcategories ? (
        // Main categories
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
      ) : (
        // Subcategories
        <div>
          {/* Back button with selected category */}
          <button
            onClick={() => setShowSubcategories(false)}
            className="flex items-center gap-3 mb-8 group"
          >
            <div className="w-8 h-8 rounded-xl bg-gray-100/80 flex items-center justify-center group-hover:bg-purple-primary/10 transition-colors">
              <svg className="w-4 h-4 text-gray-400 group-hover:text-purple-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            {selectedCategoryConfig && (
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center text-white">
                  <div className="scale-75">{getCategoryIcon(selectedCategoryConfig.icon)}</div>
                </div>
                <span className="text-sm font-medium text-ink">{selectedCategoryConfig.name}</span>
              </div>
            )}
          </button>

          {/* Subcategory description */}
          <p className="text-muted font-body text-sm mb-6">
            Select a more specific type
          </p>

          {/* Subcategories grid */}
          {selectedCategoryConfig && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {selectedCategoryConfig.subcategories.map((sub) => {
                const isSelected = subcategory === sub.value;

                return (
                  <button
                    key={sub.value}
                    onClick={() => onSubcategoryChange(sub.value)}
                    className={`
                      relative px-5 py-4 rounded-2xl text-left
                      transition-all duration-300
                      ${isSelected
                        ? "bg-gradient-to-br from-purple-primary/8 to-pink-vivid/5 ring-2 ring-purple-primary/30"
                        : "bg-white/40 ring-1 ring-gray-200/50 hover:ring-purple-primary/20 hover:bg-white/60"
                      }
                    `}
                  >
                    <span
                      className={`
                        font-medium font-ui text-sm
                        ${isSelected ? "text-purple-primary" : "text-ink"}
                      `}
                    >
                      {sub.label}
                    </span>

                    {isSelected && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Skip option */}
          <div className="mt-8 text-center">
            <button
              onClick={() => onSubcategoryChange("")}
              className="text-sm text-muted hover:text-purple-primary transition-colors font-body"
            >
              Skip this step →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Simple category card
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
        group relative p-5 rounded-2xl text-center
        transition-all duration-300
        ${isSelected
          ? "bg-gradient-to-br from-purple-primary/8 to-pink-vivid/5 ring-2 ring-purple-primary/30"
          : "bg-white/40 ring-1 ring-gray-200/50 hover:ring-purple-primary/20 hover:bg-white/60"
        }
      `}
    >
      {/* Check */}
      {isSelected && (
        <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-gradient-to-br from-purple-primary to-pink-vivid flex items-center justify-center">
          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      )}

      {/* Icon */}
      <div
        className={`
          w-12 h-12 mx-auto mb-3 rounded-xl
          flex items-center justify-center
          transition-all duration-300
          ${isSelected
            ? "bg-gradient-to-br from-purple-primary to-pink-vivid text-white"
            : "bg-gray-100/80 text-gray-400 group-hover:text-purple-primary group-hover:bg-purple-primary/10"
          }
        `}
      >
        {getCategoryIcon(category.icon)}
      </div>

      {/* Name */}
      <h3
        className={`
          font-semibold font-ui text-sm
          ${isSelected ? "text-purple-primary" : "text-ink group-hover:text-purple-primary"}
        `}
      >
        {category.name}
      </h3>
    </button>
  );
}
