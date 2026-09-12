"use client";

import type { CSSProperties } from "react";

/**
 * The creation wizards' step row: numbered gradient circles with labels and
 * the full-width gradient line beneath them.
 *
 * Each circle starts an equal-width grid column. Its center is therefore
 * (step - 1) / total of the row width plus half the circle's size. Use that
 * same position for the fill endpoint, while keeping the track full width.
 */

const CIRCLE_ON = "bg-gradient-to-r from-orange-warm to-pink-vivid text-white";
const CIRCLE_OFF = "bg-skeleton text-gray-500";
const FILL = "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm";

export default function WizardSteps({
  step,
  labels,
  onSelect,
  hideLabelsOnMobile = false,
  className = "mb-12",
}: {
  /** 1-based current step. */
  step: number;
  labels: readonly string[];
  /** When given, each step becomes a button (used by the post composer). */
  onSelect?: (step: number) => void;
  hideLabelsOnMobile?: boolean;
  className?: string;
}) {
  const total = labels.length;
  if (total === 0) return null;

  const current = Math.min(Math.max(step, 1), total);

  return (
    <div
      className={className}
      style={{ "--wizard-circle-size": "1.75rem" } as CSSProperties}
    >
      <div
        className="grid items-center mb-4"
        style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}
      >
        {labels.map((label, i) => {
          const n = i + 1;
          const reached = current >= n;
          const circle = (
            <span
              className={`w-[var(--wizard-circle-size)] h-[var(--wizard-circle-size)] shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                reached ? CIRCLE_ON : CIRCLE_OFF
              }`}
            >
              {n}
            </span>
          );
          const text = (
            <span
              className={`text-sm font-ui truncate ${hideLabelsOnMobile ? "hidden sm:inline" : ""} ${
                reached ? "text-ink font-medium" : "text-muted"
              }`}
            >
              {label}
            </span>
          );
          return onSelect ? (
            <button
              key={label}
              type="button"
              onClick={() => onSelect(n)}
              aria-current={current === n ? "step" : undefined}
              className="flex items-center gap-2 min-w-0 pr-4 text-left"
            >
              {circle}
              {text}
            </button>
          ) : (
            <div
              key={label}
              aria-current={current === n ? "step" : undefined}
              className="flex items-center gap-2 min-w-0 pr-4"
            >
              {circle}
              {text}
            </div>
          );
        })}
      </div>

      <div aria-hidden="true" className="h-1.5 bg-skeleton rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${FILL} transition-[width] duration-500 motion-reduce:transition-none`}
          style={{ width: `calc(${((current - 1) / total) * 100}% + var(--wizard-circle-size) / 2)` }}
        />
      </div>
    </div>
  );
}
