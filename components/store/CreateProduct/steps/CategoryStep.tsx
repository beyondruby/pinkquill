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
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
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
            <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center group-hover:shadow-lg transition-shadow">
              <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </div>
            {selectedCategoryConfig && (
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-white shadow-md flex items-center justify-center text-pink-vivid">
                  <div className="scale-90">{getCategoryIcon(selectedCategoryConfig.icon)}</div>
                </div>
                <span className="text-sm font-medium text-ink">{selectedCategoryConfig.name}</span>
              </div>
            )}
          </button>

          {/* Subcategory description */}
          <p className="text-muted font-body text-sm mb-6 text-center">
            Select a more specific type
          </p>

          {/* Subcategories grid */}
          {selectedCategoryConfig && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {selectedCategoryConfig.subcategories.map((sub) => {
                const isSelected = subcategory === sub.value;

                return (
                  <button
                    key={sub.value}
                    onClick={() => onSubcategoryChange(sub.value)}
                    className={`
                      relative px-5 py-4 rounded-xl text-left
                      transition-all duration-300 flex items-center gap-3
                      bg-white
                      ${isSelected
                        ? "shadow-lg shadow-pink-vivid/10"
                        : "shadow-sm hover:shadow-md"
                      }
                    `}
                    style={{
                      border: isSelected
                        ? "1px solid transparent"
                        : "1px solid rgba(0, 0, 0, 0.05)",
                      backgroundImage: isSelected
                        ? "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
                        : undefined,
                      backgroundOrigin: "border-box",
                      backgroundClip: isSelected ? "padding-box, border-box" : undefined,
                    }}
                  >
                    {/* Checkbox indicator */}
                    <div
                      className={`
                        w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all
                        ${isSelected
                          ? "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm"
                          : "border border-muted/30"
                        }
                      `}
                    >
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span
                      className={`
                        font-medium font-ui text-sm
                        ${isSelected ? "text-pink-vivid" : "text-ink"}
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
              className="text-sm text-muted hover:text-pink-vivid transition-colors font-body"
            >
              Skip this step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Category card with glass circle
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
      className="group flex flex-col items-center text-center"
    >
      {/* Glass circular icon container - subtle selection */}
      <div
        className={`
          relative w-24 h-24 rounded-full flex items-center justify-center
          transition-all duration-300 mb-4
          backdrop-blur-sm bg-white/80
          ${isSelected
            ? "shadow-xl shadow-pink-vivid/20"
            : "shadow-lg shadow-black/5 group-hover:shadow-xl group-hover:shadow-pink-vivid/10"
          }
        `}
        style={{
          border: isSelected
            ? "2px solid transparent"
            : "1px solid rgba(0, 0, 0, 0.05)",
          backgroundImage: isSelected
            ? "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
            : undefined,
          backgroundOrigin: "border-box",
          backgroundClip: isSelected ? "padding-box, border-box" : undefined,
        }}
      >
        <span className={`
          transition-colors duration-300 scale-110
          ${isSelected
            ? "text-pink-vivid"
            : "text-pink-vivid/40 group-hover:text-pink-vivid/70"
          }
        `}>
          {getCategoryIcon(category.icon)}
        </span>
      </div>

      {/* Name */}
      <h3
        className={`
          font-semibold font-ui text-sm
          transition-colors duration-300
          ${isSelected
            ? "text-pink-vivid"
            : "text-ink group-hover:text-pink-vivid/80"
          }
        `}
      >
        {category.name}
      </h3>
    </button>
  );
}
