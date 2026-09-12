"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

/**
 * The creation wizards' step row: numbered gradient circles with labels and
 * the gradient line beneath them.
 *
 * The line is measured against the circles rather than drawn as a percentage
 * of the container, so it starts at the left edge of the first circle, ends at
 * the right edge of the last one, and the filled part stops exactly under the
 * current step's circle no matter how wide the labels are.
 */

const CIRCLE_ON = "bg-gradient-to-r from-orange-warm to-pink-vivid text-white";
const CIRCLE_OFF = "bg-skeleton text-gray-500";
const FILL = "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm";

type Geometry = { left: number; width: number; fill: number };

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
  const rowRef = useRef<HTMLDivElement>(null);
  const circleRefs = useRef<(HTMLElement | null)[]>([]);
  const [geo, setGeo] = useState<Geometry | null>(null);

  const total = labels.length;
  const current = Math.min(Math.max(step, 1), total);

  const measure = useCallback(() => {
    const row = rowRef.current;
    const circles = circleRefs.current.slice(0, total);
    if (!row || circles.length !== total || circles.some((c) => !c)) return;

    const rowRect = row.getBoundingClientRect();
    const rects = circles.map((c) => (c as HTMLElement).getBoundingClientRect());

    // If the row wrapped onto several lines the circles no longer sit on one
    // axis, so a single line under them cannot line up. Fall back to a plain
    // full-width bar in that case.
    const wrapped = rects.some((r) => Math.abs(r.top - rects[0].top) > 4);
    if (wrapped) {
      setGeo({ left: 0, width: rowRect.width, fill: (rowRect.width * current) / total });
      return;
    }

    const first = rects[0];
    const last = rects[total - 1];
    const cur = rects[current - 1];
    const left = first.left - rowRect.left;
    setGeo({
      left,
      width: last.right - first.left,
      fill: cur.right - first.left,
    });
  }, [total, current]);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => measure());
    ro.observe(row);
    // Label widths change when web fonts finish loading; observe each item too.
    Array.from(row.children).forEach((child) => ro.observe(child));
    return () => ro.disconnect();
  }, [measure]);

  return (
    <div className={className}>
      <div ref={rowRef} className="relative flex items-center justify-center gap-8 mb-4">
        {labels.map((label, i) => {
          const n = i + 1;
          const reached = current >= n;
          const circle = (
            <span
              ref={(el) => {
                circleRefs.current[i] = el;
              }}
              className={`w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                reached ? CIRCLE_ON : CIRCLE_OFF
              }`}
            >
              {n}
            </span>
          );
          const text = (
            <span
              className={`text-sm font-ui ${hideLabelsOnMobile ? "hidden sm:inline" : ""} ${
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
              className="flex items-center gap-2"
            >
              {circle}
              {text}
            </button>
          ) : (
            <div key={label} aria-current={current === n ? "step" : undefined} className="flex items-center gap-2">
              {circle}
              {text}
            </div>
          );
        })}
      </div>

      {/* The line. Positioned from the measured circles; before the first
          measurement it is drawn full width so nothing jumps on hydration. */}
      <div
        className="h-1.5 bg-skeleton rounded-full overflow-hidden"
        style={geo ? { marginLeft: geo.left, width: geo.width } : undefined}
      >
        <div
          className={`h-full rounded-full ${FILL} transition-[width] duration-500`}
          style={{ width: geo ? geo.fill : `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}
