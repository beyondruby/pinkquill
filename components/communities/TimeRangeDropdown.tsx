"use client";

import React, { useState, useRef, useEffect } from "react";
import type { TopTimeRange } from "@/lib/types";

interface TimeRangeDropdownProps {
  value: TopTimeRange;
  onChange: (value: TopTimeRange) => void;
  disabled?: boolean;
}

const TIME_RANGE_OPTIONS: { value: TopTimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "year", label: "This Year" },
  { value: "all", label: "All Time" },
];

/**
 * TimeRangeDropdown - Select time range for filtering top posts
 */
export default function TimeRangeDropdown({
  value,
  onChange,
  disabled = false,
}: TimeRangeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = TIME_RANGE_OPTIONS.find((opt) => opt.value === value);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-ui text-sm font-medium transition-all ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-purple-primary/10 text-purple-primary hover:bg-purple-primary/20"
        }`}
      >
        <span>{selectedOption?.label || "All Time"}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm font-ui hover:bg-gray-50 transition-colors ${
                value === option.value
                  ? "text-purple-primary font-medium bg-purple-50"
                  : "text-ink"
              }`}
            >
              {option.label}
              {value === option.value && (
                <svg
                  className="w-4 h-4 inline ml-2 text-purple-primary"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
