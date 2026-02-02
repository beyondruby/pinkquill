"use client";

import { useState } from "react";
import { CategoryField } from "@/lib/store/categories";

interface SelectFieldProps {
  field: CategoryField;
  value: string;
  onChange: (value: string) => void;
}

export default function SelectField({ field, value, onChange }: SelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const options = field.options || [];
  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  return (
    <div>
      <label className="block text-sm font-ui font-semibold text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      {/* Gradient border wrapper */}
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
          <div className="w-full h-full rounded-xl bg-white" />
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full px-4 py-3.5 pr-12 rounded-xl text-left
            bg-transparent flex items-center justify-between
            outline-none transition-all duration-300"
        >
          <span className={value ? "text-ink font-body" : "text-gray-400 font-body"}>
            {selectedLabel || field.placeholder || "Select..."}
          </span>
          <svg
            className={`w-5 h-5 text-orange-warm transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Expandable options grid */}
      {isOpen && (
        <div className="mt-4 p-4 bg-gray-50/50 rounded-xl">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {options.map((option) => {
              const isSelected = value === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`
                    flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-left
                    transition-all duration-200 border-2
                    ${isSelected
                      ? "border-pink-vivid bg-pink-vivid/5"
                      : "border-gray-200 bg-white hover:border-pink-vivid/30"
                    }
                  `}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={`
                      w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all
                      ${isSelected
                        ? "bg-gradient-to-r from-orange-warm to-pink-vivid"
                        : "border-2 border-gray-300"
                      }
                    `}
                  >
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <span className={`font-ui ${isSelected ? "text-pink-vivid font-medium" : "text-ink"}`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
