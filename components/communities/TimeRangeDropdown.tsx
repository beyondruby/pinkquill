"use client";

import ActionMenu from "@/components/ui/ActionMenu";
import type { TopTimeRange } from "@/lib/types";

interface TimeRangeDropdownProps {
  value: TopTimeRange;
  onChange: (value: TopTimeRange) => void;
  disabled?: boolean;
}

const TIME_RANGE_OPTIONS: { value: TopTimeRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "year", label: "This year" },
  { value: "all", label: "All time" },
];

/** Time window for the Top sort, on the shared menu (portal, so it escapes scrolling rows). */
export default function TimeRangeDropdown({ value, onChange, disabled = false }: TimeRangeDropdownProps) {
  const selected = TIME_RANGE_OPTIONS.find((opt) => opt.value === value) ?? TIME_RANGE_OPTIONS[4];
  return (
    <ActionMenu
      label="Time range"
      items={TIME_RANGE_OPTIONS.map((option) => ({
        label: option.label,
        onSelect: () => onChange(option.value),
        tone: option.value === value ? "accent" : "default",
      }))}
      trigger={
        <>
          <span>{selected.label}</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="w-3.5 h-3.5">
            <path d="M6 9l6 6 6-6" />
          </svg>
        </>
      }
      buttonClassName="pq-chip"
      buttonAriaLabel={`Time range: ${selected.label}`}
      buttonDisabled={disabled}
      widthClassName="w-44"
      portal
    />
  );
}
