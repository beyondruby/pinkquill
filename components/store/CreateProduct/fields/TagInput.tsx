"use client";

import { useState } from "react";

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  helperText?: string;
  max?: number;
  /**
   * If `lowercase` is true, tags are normalized to lowercase before being
   * added — used for hashtag-like keywords. Carriers and shipping
   * locations should keep their original casing.
   */
  lowercase?: boolean;
  /**
   * Optional pretty-printer for the displayed chip. Storage value is
   * unchanged.
   */
  formatChip?: (value: string) => string;
  /** Optional `#` prefix on the chip (purely visual). */
  chipPrefix?: string;
}

export default function TagInput({
  values,
  onChange,
  placeholder,
  helperText,
  max,
  lowercase = false,
  formatChip,
  chipPrefix,
}: TagInputProps) {
  const [inputValue, setInputValue] = useState("");
  const limitReached = max !== undefined && values.length >= max;

  const addTag = () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    const normalized = lowercase ? trimmed.toLowerCase() : trimmed;
    if (values.includes(normalized)) {
      setInputValue("");
      return;
    }
    if (limitReached) return;
    onChange([...values, normalized]);
    setInputValue("");
  };

  const removeTag = (tag: string) => {
    onChange(values.filter((v) => v !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag();
      return;
    }
    if (e.key === "Backspace" && !inputValue && values.length > 0) {
      removeTag(values[values.length - 1]);
    }
  };

  return (
    <div>
      <div className="relative">
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-warm to-pink-vivid p-[2px]">
          <div className="w-full h-full rounded-xl bg-white" />
        </div>
        <div className="relative flex items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={addTag}
            placeholder={limitReached ? "Maximum reached" : placeholder}
            disabled={limitReached}
            className="w-full px-4 py-3.5 pr-12 rounded-xl
              bg-transparent
              outline-none transition-all duration-300
              font-body text-ink placeholder:text-gray-400
              disabled:opacity-60"
          />
          <div className="absolute right-4 text-orange-warm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-2">
        {helperText && <p className="text-xs text-muted">{helperText}</p>}
        {max !== undefined && (
          <p className={`text-xs font-ui ml-auto ${values.length >= max - 2 ? "text-orange-warm" : "text-muted"}`}>
            {values.length} / {max}
          </p>
        )}
      </div>

      {values.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          {values.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-2 px-3 py-1.5
                bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 rounded-full
                text-sm font-ui text-pink-vivid"
            >
              {chipPrefix}
              {formatChip ? formatChip(tag) : tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove ${tag}`}
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
    </div>
  );
}
