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
        className={`shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full font-ui text-xs font-medium transition-all duration-200 whitespace-nowrap ${
          disabled
            ? "bg-black/[0.03] text-muted/50 cursor-not-allowed"
            : "bg-purple-primary/[0.08] text-purple-primary hover:bg-purple-primary/[0.12]"
        }`}
      >
        <span>{selectedOption?.label || "All Time"}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-50 mt-1.5 w-40 rounded-xl bg-white border border-black/[0.06] shadow-lg shadow-black/[0.06] py-1 animate-fadeIn">
          {TIME_RANGE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
              className={`w-full px-4 py-2 text-left text-sm font-ui transition-colors ${
                value === option.value
                  ? "text-pink-vivid bg-pink-vivid/[0.06] font-medium"
                  : "text-ink hover:bg-black/[0.03]"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
