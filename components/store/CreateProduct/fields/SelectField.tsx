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
      <label className="block text-sm font-ui font-medium text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      <div className="relative w-64">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-5 py-4 rounded-2xl text-left
            transition-all duration-300 flex items-center justify-between
            ${isOpen
              ? "bg-white ring-2 ring-purple-primary/30"
              : "bg-white/50 ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
            }
          `}
        >
          <span className={value ? "text-ink font-body" : "text-gray-400 font-body"}>
            {selectedLabel || field.placeholder || "Select..."}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <>
            <div className="absolute z-20 w-full mt-2 bg-white rounded-2xl shadow-xl ring-1 ring-gray-100 overflow-hidden">
              <div className="max-h-60 overflow-auto p-2">
                {options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setIsOpen(false);
                    }}
                    className={`
                      w-full px-4 py-3 rounded-xl text-sm text-left transition-colors
                      ${value === option.value
                        ? "bg-purple-primary/10 text-purple-primary font-medium"
                        : "hover:bg-gray-50 text-ink"
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          </>
        )}
      </div>

      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
