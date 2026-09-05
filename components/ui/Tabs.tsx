"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";

export interface TabItem<T extends string> {
  id: T;
  label: ReactNode;
  count?: number;
}

interface TabRowProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel: string;
  className?: string;
}

/**
 * Sentence-case tab row with an underline for the selected tab (the proof's
 * `.tab-row`). Real tablist semantics: arrow keys and Home/End move between
 * tabs, only the selected tab is in the Tab order. The panel it controls
 * should carry `role="tabpanel"`.
 */
export function TabRow<T extends string>({ items, value, onChange, ariaLabel, className = "" }: TabRowProps<T>) {
  const ref = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = items.findIndex((item) => item.id === value);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % items.length;
    if (event.key === "ArrowLeft") next = (index - 1 + items.length) % items.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = items.length - 1;
    if (next === null) return;
    event.preventDefault();
    onChange(items[next].id);
    ref.current?.querySelectorAll<HTMLButtonElement>("[role='tab']")[next]?.focus();
  };

  return (
    <div ref={ref} role="tablist" aria-label={ariaLabel} className={`pq-tabs ${className}`.trim()} onKeyDown={onKeyDown}>
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className="pq-tab"
          >
            {item.label}
            {typeof item.count === "number" && <span className="pq-tab__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export default TabRow;
