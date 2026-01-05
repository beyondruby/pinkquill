"use client";

import { useState, useRef, useEffect } from "react";
import { TimeRange, DateRange } from "@/lib/hooks/useInsights";

interface DateRangePickerProps {
  value: TimeRange;
  customRange?: DateRange;
  onChange: (range: TimeRange, customRange?: DateRange) => void;
}

const timeRangeLabels: Record<TimeRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 3 months",
  "1y": "Past year",
  all: "All time",
  custom: "Custom",
};

export default function DateRangePicker({
  value,
  customRange,
  onChange,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [tempStart, setTempStart] = useState<string>("");
  const [tempEnd, setTempEnd] = useState<string>("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowCustom(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const handleSelect = (range: TimeRange) => {
    if (range === "custom") {
      setShowCustom(true);
      setTempStart(customRange?.start.toISOString().split("T")[0] || "");
      setTempEnd(customRange?.end.toISOString().split("T")[0] || "");
    } else {
      onChange(range);
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  const handleApplyCustom = () => {
    if (tempStart && tempEnd) {
      onChange("custom", {
        start: new Date(tempStart),
        end: new Date(tempEnd),
      });
      setIsOpen(false);
      setShowCustom(false);
    }
  };

  const getDisplayLabel = () => {
    if (value === "custom" && customRange) {
      return `${customRange.start.toLocaleDateString()} - ${customRange.end.toLocaleDateString()}`;
    }
    return timeRangeLabels[value];
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2.5 bg-white border border-black/10 rounded-xl hover:border-purple-primary/30 transition-all font-ui text-sm text-ink"
      >
        <svg className="w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span>{getDisplayLabel()}</span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-black/10 overflow-hidden z-50 animate-fadeIn">
          {!showCustom ? (
            <div className="py-2">
              {(Object.keys(timeRangeLabels) as TimeRange[]).map((range) => (
                <button
                  key={range}
                  onClick={() => handleSelect(range)}
                  className={`w-full px-4 py-2.5 text-left font-ui text-sm transition-colors flex items-center justify-between ${
                    value === range
                      ? "bg-purple-primary/5 text-purple-primary"
                      : "text-ink hover:bg-black/[0.02]"
                  }`}
                >
                  <span>{timeRangeLabels[range]}</span>
                  {value === range && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="p-4">
              <h4 className="font-ui text-sm font-medium text-ink mb-3">Custom Range</h4>
              <div className="space-y-3">
                <div>
                  <label className="font-body text-xs text-muted block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={tempStart}
                    onChange={(e) => setTempStart(e.target.value)}
                    className="w-full px-3 py-2 border border-black/10 rounded-lg font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
                  />
                </div>
                <div>
                  <label className="font-body text-xs text-muted block mb-1">End Date</label>
                  <input
                    type="date"
                    value={tempEnd}
                    onChange={(e) => setTempEnd(e.target.value)}
                    className="w-full px-3 py-2 border border-black/10 rounded-lg font-ui text-sm focus:outline-none focus:ring-2 focus:ring-purple-primary/20"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowCustom(false)}
                    className="flex-1 px-3 py-2 border border-black/10 rounded-lg font-ui text-sm text-muted hover:bg-black/[0.02] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApplyCustom}
                    disabled={!tempStart || !tempEnd}
                    className="flex-1 px-3 py-2 bg-gradient-to-r from-purple-primary to-pink-vivid text-white rounded-lg font-ui text-sm hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
