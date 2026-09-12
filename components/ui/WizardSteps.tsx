"use client";

import type { CSSProperties } from "react";

/**
 * The creation wizards' step row: numbered gradient circles with labels and
 * the full-width gradient line beneath them.
 *
 * Circle centers divide the full track into total - 1 equal intervals.
 * End labels get half an interval; interior labels get a whole interval.
 * The track and captions share the form's edges. Endpoint circles extend
 * half their width into the page gutter so their centers stay on the track.
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
  const progress = total > 1 ? ((current - 1) / (total - 1)) * 100 : 0;

  return (
    <div
      className={`relative transition-none ${className}`}
      style={{
        "--wizard-circle-size": "1.75rem",
        minHeight: "calc(var(--wizard-circle-size) + 0.875rem)",
      } as CSSProperties}
    >
      <div className="flex items-start transition-none">
        {labels.map((label, i) => {
          const n = i + 1;
          const reached = current >= n;
          const first = i === 0;
          const last = i === total - 1;
          const itemClassName = `flex flex-col gap-6 min-w-0 rounded-sm transition-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-purple-primary ${
            first ? "items-start text-left" : last ? "items-end text-right" : "items-center text-center"
          }`;
          const itemStyle = { flex: first || last ? "0.5 1 0%" : "1 1 0%" };
          const circle = (
            <span
              className={`w-[var(--wizard-circle-size)] h-[var(--wizard-circle-size)] shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                reached ? CIRCLE_ON : CIRCLE_OFF
              } ${
                first ? "-translate-x-1/2" : last ? "translate-x-1/2" : ""
              }`}
            >
              {n}
            </span>
          );
          const text = (
            <span
              className={`w-max max-w-full [overflow-wrap:anywhere] text-xs sm:text-sm leading-5 font-ui tracking-[0.01em] transition-colors ${hideLabelsOnMobile ? "hidden sm:inline" : ""} ${
                current === n ? "text-ink font-semibold" : reached ? "text-subdued font-medium" : "text-muted font-medium"
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
              className={itemClassName}
              style={itemStyle}
            >
              {circle}
              {text}
            </button>
          ) : (
            <div
              key={label}
              aria-current={current === n ? "step" : undefined}
              className={itemClassName}
              style={itemStyle}
            >
              {circle}
              {text}
            </div>
          );
        })}
      </div>

      <div
        aria-hidden="true"
        className="absolute h-1.5 bg-skeleton rounded-full overflow-hidden transition-none"
        style={{
          top: "calc(var(--wizard-circle-size) + 0.5rem)",
          insetInline: 0,
        }}
      >
        <div
          className={`h-full rounded-full ${FILL} transition-[width] duration-500 motion-reduce:transition-none`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
