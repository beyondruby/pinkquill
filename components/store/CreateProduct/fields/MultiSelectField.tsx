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
      <label className="block text-sm font-ui font-medium text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`
            w-full px-5 py-4 rounded-2xl text-left
            transition-all duration-300 flex items-center justify-between font-body
            ${isOpen
              ? "bg-white ring-2 ring-purple-primary/30"
              : "bg-white/50 ring-1 ring-gray-200/50 hover:ring-purple-primary/20"
            }
          `}
        >
          <span className={value.length > 0 ? "text-ink" : "text-gray-400"}>
            {value.length > 0 ? `${value.length} selected` : "Select options"}
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
              <div className="max-h-60 overflow-auto p-2 grid grid-cols-2 gap-2">
                {options.map((option) => {
                  const isSelected = value.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => toggleOption(option.value)}
                      className={`
                        px-4 py-3 rounded-xl text-sm text-left transition-all
                        flex items-center gap-2
                        ${isSelected
                          ? "bg-purple-primary/10 text-purple-primary"
                          : "hover:bg-gray-50 text-ink"
                        }
                      `}
                    >
                      <div
                        className={`
                          w-4 h-4 rounded flex items-center justify-center transition-all flex-shrink-0
                          ${isSelected
                            ? "bg-gradient-to-r from-purple-primary to-pink-vivid"
                            : "ring-2 ring-gray-300"
                          }
                        `}
                      >
                        {isSelected && (
                          <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className="font-medium truncate">{option.label}</span>
                    </button>
                  );
                })}

                {field.allowCustom && (
                  <button
                    type="button"
                    onClick={() => setShowCustomInput(true)}
                    className="px-4 py-3 rounded-xl text-sm text-left hover:bg-gray-50
                      text-purple-primary flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    <span className="font-medium">Custom</span>
                  </button>
                )}
              </div>

              {showCustomInput && (
                <div className="p-3 border-t border-gray-100">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customValue}
                      onChange={(e) => setCustomValue(e.target.value)}
                      placeholder="Enter custom value"
                      className="flex-1 px-4 py-2 rounded-xl text-sm
                        bg-gray-50 ring-1 ring-gray-200
                        focus:ring-2 focus:ring-purple-primary/30 focus:bg-white
                        outline-none transition-all"
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
                      className="px-4 py-2 bg-gradient-to-r from-purple-primary to-pink-vivid text-white text-sm rounded-xl font-medium"
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>
            <div
              className="fixed inset-0 z-10"
              onClick={() => {
                setIsOpen(false);
                setShowCustomInput(false);
              }}
            />
          </>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {value.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-2 px-3 py-1.5
                bg-purple-primary/5 rounded-full
                text-sm font-ui text-purple-primary"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={() => toggleOption(val)}
                className="p-0.5 hover:bg-purple-primary/10 rounded-full transition-colors"
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
        <p className="text-xs text-muted mt-2">{field.helpText}</p>
      )}
    </div>
  );
}
