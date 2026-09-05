"use client";

import type { ReactNode } from "react";

/* Small presentational pieces for the composer. No data, no side effects. */

export function ComposerSteps({
  steps,
  current,
  onSelect,
}: {
  steps: { n: number; label: string }[];
  current: number;
  onSelect: (n: number) => void;
}) {
  const pct = Math.round((current / steps.length) * 100);
  return (
    <nav className="pq-steps" aria-label="Steps">
      <ol className="pq-steps__list">
        {steps.map((s) => (
          <li key={s.n}>
            <button
              type="button"
              className={`pq-steps__item ${s.n < current ? "pq-steps__item--done" : ""}`}
              aria-current={s.n === current ? "step" : undefined}
              onClick={() => onSelect(s.n)}
            >
              <span className="pq-steps__num" aria-hidden="true">{s.n}</span>
              <span>{s.label}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="pq-steps__track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress">
        <div className="pq-steps__bar" style={{ inlineSize: `${pct}%` }} />
      </div>
    </nav>
  );
}

export function Disclosure({
  id,
  icon,
  label,
  state,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon?: ReactNode;
  label: string;
  /** Short status shown when the section has a value, e.g. "1 song" or "On". */
  state?: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const panelId = `${id}-panel`;
  return (
    <div className="pq-disclosure">
      <button type="button" className="pq-disclosure__button" aria-expanded={open} aria-controls={panelId} onClick={onToggle}>
        {icon}
        <span className="pq-disclosure__label">{label}</span>
        {state && <span className="pq-disclosure__state">{state}</span>}
        <svg className="pq-disclosure__chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && <div id={panelId} className="pq-disclosure__body">{children}</div>}
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} className="pq-switch" onClick={() => onChange(!checked)} />
  );
}

export function FieldLabel({ htmlFor, children, hint, id }: { htmlFor?: string; id?: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="pq-label" htmlFor={htmlFor} id={id}>
      {children}
      {hint && <span className="pq-label__hint"> {hint}</span>}
    </label>
  );
}
