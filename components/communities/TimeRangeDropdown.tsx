"use client";

import React, { useState, useRef, useEffect, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
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

const MENU_WIDTH = 160;
const MENU_OFFSET = 6;

/**
 * TimeRangeDropdown - Select time range for filtering top posts.
 *
 * The menu renders in a React portal because the trigger lives inside a
 * horizontally-scrollable filter row (`overflow-x-auto`). Per CSS spec,
 * setting overflow-x to a non-visible value also clips overflow-y, so an
 * absolutely-positioned dropdown gets cut off vertically and disappears
 * behind whatever sibling renders next (the loading spinner). Rendering
 * in a portal escapes the clipping context entirely.
 */
export default function TimeRangeDropdown({
  value,
  onChange,
  disabled = false,
}: TimeRangeDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const selectedOption = TIME_RANGE_OPTIONS.find((opt) => opt.value === value);

  // Position the portal-rendered menu under the trigger button, and keep
  // it pinned there if the user scrolls or resizes while it's open. Stale
  // coords from the previous open are harmless — the menu doesn't render
  // when isOpen is false.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const updatePosition = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      // Clamp to viewport so the menu never overflows the right edge.
      const left = Math.min(
        rect.left,
        window.innerWidth - MENU_WIDTH - 8
      );
      setMenuPos({ top: rect.bottom + MENU_OFFSET, left });
    };
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  // Close on outside click. Both the trigger button and the portal menu
  // count as "inside" — anything else closes.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
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

      {isOpen && menuPos && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              style={{
                position: "fixed",
                top: menuPos.top,
                left: menuPos.left,
                width: MENU_WIDTH,
              }}
              className="z-[1000] rounded-xl bg-white border border-black/[0.06] shadow-lg shadow-black/[0.06] py-1 animate-fadeIn"
            >
              {TIME_RANGE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitem"
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
            </div>,
            document.body
          )
        : null}
    </>
  );
}
