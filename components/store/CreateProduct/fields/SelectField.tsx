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
  const [customValue, setCustomValue] = useState("");
  const [showCustomInput, setShowCustomInput] = useState(false);

  const options = field.options || [];

  const handleSelect = (optionValue: string) => {
    if (optionValue === "__custom__") {
      setShowCustomInput(true);
    } else {
      onChange(optionValue);
      setIsOpen(false);
      setShowCustomInput(false);
    }
  };

  const handleCustomSubmit = () => {
    if (customValue.trim()) {
      onChange(customValue.trim());
      setCustomValue("");
      setShowCustomInput(false);
      setIsOpen(false);
    }
  };

  const selectedLabel = options.find((o) => o.value === value)?.label || value;

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
          className={`w-full px-4 py-3.5 border rounded-xl bg-white
            transition-all text-left flex items-center justify-between font-body
            ${isOpen
              ? "border-purple-primary ring-2 ring-purple-primary/10"
              : "border-gray-200 hover:border-purple-primary/30"
            }`}
        >
          <span className={value ? "text-ink" : "text-gray-400"}>
            {value ? selectedLabel : `Select ${field.label.toLowerCase()}`}
          </span>
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
            className="absolute z-20 w-full mt-2 bg-white border border-gray-100 rounded-2xl shadow-xl
              max-h-72 overflow-auto"
          >
            <div className="p-3 grid grid-cols-2 md:grid-cols-3 gap-2">
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2.5 rounded-xl text-sm text-left transition-all duration-200
                    ${value === option.value
                      ? "bg-gradient-to-r from-purple-50 to-pink-50 text-purple-primary border border-purple-200 shadow-sm"
                      : "hover:bg-gray-50 border border-transparent hover:border-gray-100"
                    }`}
                >
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all
                        ${value === option.value
                          ? "border-purple-primary bg-gradient-to-r from-purple-primary to-pink-vivid"
                          : "border-gray-300"
                        }`}
                    >
                      {value === option.value && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </span>
                    <span className="font-medium">{option.label}</span>
                  </span>
                </button>
              ))}

              {/* Custom option */}
              {field.allowCustom && (
                <button
                  type="button"
                  onClick={() => handleSelect("__custom__")}
                  className="px-3 py-2.5 rounded-xl text-sm text-left hover:bg-gradient-to-r hover:from-purple-50/50 hover:to-pink-50/50
                    text-purple-primary flex items-center gap-2 border border-dashed border-purple-200 transition-all"
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
              <div className="p-3 border-t border-gray-100 bg-gray-50/50">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customValue}
                    onChange={(e) => setCustomValue(e.target.value)}
                    placeholder="Enter custom value"
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm
                      focus:border-purple-primary focus:ring-2 focus:ring-purple-primary/10 outline-none bg-white"
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
                    className="px-5 py-2.5 bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-sm rounded-xl
                      hover:shadow-lg hover:shadow-purple-primary/20 transition-all font-medium"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {field.helpText && (
        <p className="text-xs text-muted mt-1.5 pl-1">{field.helpText}</p>
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
