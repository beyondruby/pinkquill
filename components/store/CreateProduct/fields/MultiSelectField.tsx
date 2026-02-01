"use client";

import { useState } from "react";
import { CategoryField } from "@/lib/store/categories";

interface MultiSelectFieldProps {
  field: CategoryField;
  value: string[];
  onChange: (value: string[]) => void;
}

export default function MultiSelectField({ field, value, onChange }: MultiSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customValue, setCustomValue] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const options = field.options || [];

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const handleCustomSubmit = () => {
    if (customValue.trim() && !value.includes(customValue.trim())) {
      onChange([...value, customValue.trim()]);
      setCustomValue("");
      setShowCustomInput(false);
    }
  };

  const getLabel = (val: string): string => {
    const option = options.find((o) => o.value === val);
    return option?.label || val;
  };

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
          className="w-full px-4 py-3 border border-orange-200 rounded-xl bg-white
            focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none
            transition-all text-left flex items-center justify-between"
        >
          <span className={value.length > 0 ? "text-gray-900" : "text-gray-400"}>
            {value.length > 0
              ? `${value.length} selected`
              : `Select from the multiple categories below`}
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
            className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg
              max-h-80 overflow-auto"
          >
            <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-2">
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors
                      ${isSelected
                        ? "bg-purple-50 text-purple-primary border border-purple-200"
                        : "hover:bg-gray-50 border border-transparent"
                      }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center
                          ${isSelected
                            ? "bg-purple-primary border-purple-primary"
                            : "border-gray-300"
                          }`}
                      >
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      {option.label}
                    </span>
                  </button>
                );
              })}

              {/* Custom option */}
              {field.allowCustom && (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="px-3 py-2 rounded-lg text-sm text-left hover:bg-gray-50
                    text-purple-primary flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Custom
                </button>
              )}
            </div>

            {/* Custom input */}
            {showCustomInput && (
              <div className="p-3 border-t border-gray-100">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Enter custom value"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm
                      focus:border-purple-primary focus:ring-1 focus:ring-purple-primary/10 outline-none"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleCustomSubmit();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCustomSubmit}
                    className="px-4 py-2 bg-purple-primary text-white text-sm rounded-lg
                      hover:bg-purple-700 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {value.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-primary
                rounded-md text-xs"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={() => toggleOption(val)}
                className="p-0.5 hover:bg-purple-100 rounded transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {field.helpText && (
        <p className="text-xs text-muted mt-1">{field.helpText}</p>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => {
            setIsOpen(false);
            setShowCustomInput(false);
          }}
        />
      )}
    </div>
  );
}
