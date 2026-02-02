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
      <label className="block text-sm font-ui font-semibold text-ink mb-3">
        {field.label}
        {field.required && <span className="text-pink-vivid ml-1">*</span>}
      </label>

      {/* Gradient border wrapper */}
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm p-[1px]">
          <div className="w-full h-full rounded-xl bg-white" />
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-full px-4 py-3.5 pr-12 rounded-xl text-left
            bg-transparent flex items-center justify-between
            outline-none transition-all duration-300"
        >
          <span className={value.length > 0 ? "text-ink font-body" : "text-muted/60 font-body"}>
            {value.length > 0 ? `${value.length} selected` : "Select options..."}
          </span>
          <svg
            className={`w-5 h-5 text-pink-vivid transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        <div className="mt-4 p-4 rounded-xl bg-white/50 backdrop-blur-sm">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={`
                    flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-left
                    transition-all duration-200
                    ${isSelected
                      ? "bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10"
                      : "bg-white hover:bg-pink-vivid/5"
                    }
                  `}
                  style={{
                    border: isSelected
                      ? "1px solid transparent"
                      : "1px solid rgba(255, 0, 127, 0.2)",
                    backgroundImage: isSelected
                      ? "linear-gradient(to right, rgba(142, 68, 173, 0.1), rgba(255, 0, 127, 0.1), rgba(255, 159, 67, 0.1)), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)"
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
                        : "border border-pink-vivid/30"
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

            {/* Custom option button */}
            {field.allowCustom && (
              <button
                type="button"
                onClick={() => setShowCustomInput(true)}
                className="flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm text-left
                  transition-all duration-200 border border-dashed border-pink-vivid/40
                  bg-white hover:bg-pink-vivid/5"
              >
                <svg className="w-5 h-5 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-ui text-pink-vivid">Custom</span>
              </button>
            )}
          </div>

          {/* Custom input */}
          {showCustomInput && (
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                value={customValue}
                onChange={(e) => setCustomValue(e.target.value)}
                placeholder="Custom"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm
                  border border-pink-vivid/30 bg-white
                  focus:border-pink-vivid focus:outline-none
                  transition-all font-body"
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
                className="px-4 py-2.5 bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm
                  text-white text-sm rounded-xl font-ui font-medium"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Selected tags */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {value.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-2 px-3 py-1.5
                bg-gradient-to-r from-purple-primary/10 via-pink-vivid/10 to-orange-warm/10 rounded-full
                text-sm font-ui text-pink-vivid"
            >
              {getLabel(val)}
              <button
                type="button"
                onClick={() => toggleOption(val)}
                className="p-0.5 hover:bg-pink-vivid/20 rounded-full transition-colors"
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
