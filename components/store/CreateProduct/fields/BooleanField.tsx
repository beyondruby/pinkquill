"use client";

import { useState } from "react";
import { CategoryField } from "@/lib/store/categories";

interface BooleanFieldProps {
  field: CategoryField;
  value: boolean | undefined;
  onChange: (value: boolean) => void;
}

export default function BooleanField({ field, value, onChange }: BooleanFieldProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {field.label}
        {field.required && <span className="text-red-500 ml-1">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-48 px-4 py-3 border border-orange-200 rounded-xl bg-white
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all text-left flex items-center justify-between"
        >
          <span className={value !== undefined ? "text-gray-900" : "text-gray-400"}>
            {value === undefined ? "Select" : value ? "Yes" : "No"}
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

        {/* Dropdown */}
        {isOpen && (
          <div
            className="absolute z-20 w-48 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg
              overflow-hidden"
          >
            <div className="p-2 space-y-1">
              <button
                type="button"
                onClick={() => {
                  onChange(true);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors
                  flex items-center gap-2
                  ${value === true
                    ? "bg-purple-50 text-purple-primary"
                    : "hover:bg-gray-50"
                  }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                    ${value === true
                      ? "bg-purple-primary border-purple-primary"
                      : "border-gray-300"
                    }`}
                >
                  {value === true && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                Yes
              </button>
              <button
                type="button"
                onClick={() => {
                  onChange(false);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-lg text-sm text-left transition-colors
                  flex items-center gap-2
                  ${value === false
                    ? "bg-purple-50 text-purple-primary"
                    : "hover:bg-gray-50"
                  }`}
              >
                <span
                  className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                    ${value === false
                      ? "bg-purple-primary border-purple-primary"
                      : "border-gray-300"
                    }`}
                >
                  {value === false && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
                No
              </button>
            </div>
          </div>
        )}
      </div>

      {field.helpText && (
        <p className="text-xs text-muted mt-1">{field.helpText}</p>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
