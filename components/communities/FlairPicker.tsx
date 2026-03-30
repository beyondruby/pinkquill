"use client";

import React, { useState, useRef, useEffect } from "react";
import { useCommunityFlairs } from "@/lib/hooks/useFlair";
import FlairBadge from "./FlairBadge";
import type { CommunityFlair } from "@/lib/types";

interface FlairPickerProps {
  communityId: string | null;
  selectedFlairId: string | null;
  onSelect: (flair: CommunityFlair | null) => void;
  disabled?: boolean;
}

/**
 * FlairPicker - Dropdown to select a flair for a post
 */
export default function FlairPicker({
  communityId,
  selectedFlairId,
  onSelect,
  disabled = false,
}: FlairPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { flairs, loading } = useCommunityFlairs(communityId);

  const selectedFlair = flairs.find((f) => f.id === selectedFlairId);

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

  // Don't render if no community selected or no flairs
  if (!communityId || (flairs.length === 0 && !loading)) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || loading}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
          disabled
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-white border-gray-200 hover:border-purple-primary/50 text-ink"
        }`}
      >
        {loading ? (
          <span className="text-sm text-muted">Loading flairs...</span>
        ) : selectedFlair ? (
          <FlairBadge flair={selectedFlair} size="sm" />
        ) : (
          <>
            <svg
              className="w-4 h-4 text-muted"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
              />
            </svg>
            <span className="text-sm text-muted">Add flair</span>
          </>
        )}
        <svg
          className={`w-4 h-4 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
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
        <div className="absolute z-50 mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 py-1 max-h-64 overflow-y-auto">
          {/* Clear selection option */}
          {selectedFlairId && (
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setIsOpen(false);
              }}
              className="w-full px-3 py-2 text-left text-sm text-muted hover:bg-gray-50 flex items-center gap-2"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
              Remove flair
            </button>
          )}

          {/* Flair options */}
          {flairs.map((flair) => (
            <button
              key={flair.id}
              type="button"
              onClick={() => {
                onSelect(flair);
                setIsOpen(false);
              }}
              className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 ${
                selectedFlairId === flair.id ? "bg-purple-50" : ""
              }`}
            >
              <FlairBadge flair={flair} size="sm" />
              {selectedFlairId === flair.id && (
                <svg
                  className="w-4 h-4 text-purple-primary ml-auto"
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

          {flairs.length === 0 && !loading && (
            <div className="px-3 py-2 text-sm text-muted text-center">
              No flairs available
            </div>
          )}
        </div>
      )}
    </div>
  );
}
