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
      <label className="block text-sm font-ui font-medium text-ink mb-2">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full px-5 py-4 rounded-2xl
            bg-white/60 backdrop-blur-sm border
            transition-all duration-300 text-left flex items-center justify-between font-body
            ${isOpen
              ? "border-purple-primary/40 bg-white shadow-lg shadow-purple-primary/5"
              : "border-gray-200/50 hover:border-purple-primary/30 hover:bg-white/80"
            }`}
        >
          <span className={value.length > 0 ? "text-ink" : "text-gray-400"}>
            {value.length > 0
              ? `${value.length} selected`
              : `Select multiple options`}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}
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
            className="absolute z-20 w-full mt-2 bg-white/95 backdrop-blur-xl border border-gray-100/50 rounded-2xl shadow-xl
              max-h-80 overflow-auto"
          >
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {options.map((option) => {
                const isSelected = value.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(option.value)}
                    className={`px-4 py-3 rounded-xl text-sm text-left transition-all duration-300
                      ${isSelected
                        ? "bg-gradient-to-br from-purple-primary/10 to-pink-vivid/5 text-purple-primary border border-purple-primary/20 shadow-sm"
                        : "hover:bg-gray-50 border border-transparent hover:border-gray-100"
                      }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`w-4 h-4 rounded border-2 flex-shrink-0 flex items-center justify-center transition-all
                          ${isSelected
                            ? "border-purple-primary bg-gradient-to-r from-purple-primary to-pink-vivid"
                            : "border-gray-300"
                          }`}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </span>
                      <span className="font-medium">{option.label}</span>
                    </span>
                  </button>
                );
              })}

              {/* Custom option */}
              {field.allowCustom && (
                <button
                  type="button"
                  onClick={() => setShowCustomInput(true)}
                  className="px-4 py-3 rounded-xl text-sm text-left hover:bg-gradient-to-br hover:from-purple-50/50 hover:to-pink-50/50
                    text-purple-primary flex items-center gap-2 border border-dashed border-purple-200/50 transition-all duration-300"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  <span className="font-medium">Custom</span>
                </button>
              )}
            </div>

            {/* Custom input */}
            {showCustomInput && (
              <div className="p-3 border-t border-gray-100/50 bg-gray-50/30 backdrop-blur-sm">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Enter custom value"
                    className="flex-1 px-4 py-3 rounded-xl text-sm
                      bg-white/80 border border-gray-200/50
                      focus:border-purple-primary/40 focus:bg-white
                      outline-none transition-all duration-300"
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
                    className="px-5 py-3 bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-sm rounded-xl
                      hover:shadow-lg hover:shadow-purple-primary/20 transition-all duration-300 font-medium"
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
        <div className="flex flex-wrap gap-2 mt-4">
          {value.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-2 px-4 py-2
                bg-gradient-to-r from-purple-primary/5 to-pink-vivid/5
                border border-purple-primary/15 rounded-full
                text-sm font-ui font-medium text-purple-primary
                hover:shadow-md hover:border-purple-primary/25
                transition-all duration-300"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={() => toggleOption(val)}
                className="p-0.5 hover:bg-purple-primary/10 rounded-full transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}

      {field.helpText && (
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
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
