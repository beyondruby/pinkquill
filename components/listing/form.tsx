"use client";

import { useState, type ReactNode, type SelectHTMLAttributes } from "react";
import "./listing.css";

/**
 * Form primitives shared by the product and commission wizards. Open
 * sections on white, every field wearing the gradient ring, chips that light
 * up in the brand gradient, and the warm gradient check. The wizards differ
 * in what they ask, not in how a field looks.
 */

export const INPUT =
  "pq-field w-full px-4 py-3 text-sm font-body text-ink placeholder:text-muted/60 focus:outline-none";

export const NUMBER_INPUT = `${INPUT} tabular-nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`;

const LINK = "text-sm font-ui font-semibold text-pink-vivid hover:text-purple-primary transition-colors";

/** An open section: a display title, an optional line under it, and air. */
export function Section({ title, description, children, right }: { title: string; description?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section>
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-ink">{title}</h2>
          {description && <p className="text-sm font-body text-muted mt-0.5">{description}</p>}
        </div>
        {right}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Label({ text, required = false, right, htmlFor }: { text: string; required?: boolean; right?: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="flex items-center justify-between gap-3 text-sm font-ui font-semibold text-ink mb-2">
      <span>{text}{required && <span className="text-pink-vivid"> *</span>}</span>
      {right && <span className="text-xs font-normal text-muted">{right}</span>}
    </label>
  );
}

export function Help({ children }: { children: ReactNode }) {
  return <p className="text-xs font-body text-muted mt-1.5">{children}</p>;
}

export function ChipChoice<T extends string>({ options, value, onChange }: { options: Array<{ value: T; label: string }>; value: T | null; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)} className="pq-chip px-3.5 py-2 text-sm font-ui">
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ChipMulti({ options, value, onChange }: { options: Array<{ value: string; label: string }>; value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value.includes(o.value)} onClick={() => toggle(o.value)} className="pq-chip px-3.5 py-2 text-sm font-ui">
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Native select in the ring, with a chevron. */
export function Select({ className = "", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...rest} className={`${INPUT} appearance-none pr-10 cursor-pointer ${className}`}>{children}</select>
      <svg className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  );
}

/** The gradient check: a square that fills orange→pink when on. */
export function Check({ checked, onChange, label, hint, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string; size?: "sm" | "md" }) {
  const box = size === "sm" ? "w-4 h-4 rounded" : "w-5 h-5 rounded-md";
  return (
    <label className="group inline-flex items-start gap-3 cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className={`mt-0.5 ${box} shrink-0 flex items-center justify-center border-2 transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-pink-vivid/40 peer-focus-visible:ring-offset-2 ${checked ? "pq-dot border-transparent" : "border-border-strong group-hover:border-pink-vivid/60"}`}>
        {checked && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        )}
      </span>
      <span>
        <span className={`block ${size === "sm" ? "text-xs" : "text-sm"} font-ui font-medium text-ink`}>{label}</span>
        {hint && <span className="block text-xs font-body text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/** A check with a title and hint, on its own line. */
export function CheckRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return <div className="py-2"><Check checked={checked} onChange={onChange} label={label} hint={hint} /></div>;
}

/** Money input with a leading $. */
export function PriceInput({ id, value, onChange, placeholder = "0.00", min = 0, step = 0.01, className = "" }: { id?: string; value: number | null | undefined; onChange: (v: number | null) => void; placeholder?: string; min?: number; step?: number; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-ui font-medium text-pink-vivid">$</span>
      <input id={id} type="number" min={min} step={step} inputMode="decimal" value={value ?? ""} placeholder={placeholder}
        onChange={(e) => { const raw = e.target.value; if (raw === "") { onChange(null); return; } const n = parseFloat(raw); if (Number.isFinite(n)) onChange(n); }}
        className={`${NUMBER_INPUT} pl-8`} />
    </div>
  );
}

/** Number input with a unit suffix (cm, kg, days). */
export function UnitInput({ id, value, onChange, unit, placeholder = "0", step = 0.1 }: { id?: string; value: number | undefined; onChange: (v: number | undefined) => void; unit: string; placeholder?: string; step?: number }) {
  return (
    <div className="relative">
      <input id={id} type="number" min={0} step={step} inputMode="decimal" value={value ?? ""} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
        className={`${NUMBER_INPUT} pr-14`} />
      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-ui text-pink-vivid">{unit}</span>
    </div>
  );
}

export function LineList({ values, placeholder, onChange, addLabel = "Add line" }: { values: string[]; placeholder: string; onChange: (v: string[]) => void; addLabel?: string }) {
  return (
    <div className="space-y-2">
      {values.map((value, index) => (
        // Items are only appended or removed, never reordered, so the index key is stable enough.
        <div key={index} className="flex items-center gap-2">
          <input value={value} placeholder={placeholder} onChange={(e) => onChange(values.map((v, i) => (i === index ? e.target.value : v)))} className={INPUT} />
          <button type="button" onClick={() => onChange(values.filter((_, i) => i !== index))} aria-label="Remove" className="w-8 h-8 rounded-full text-muted hover:text-red-600 hover:bg-red-50 shrink-0">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...values, ""])} className={LINK}>+ {addLabel}</button>
    </div>
  );
}

interface TagListProps {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  max?: number;
  /** Lowercase and strip a leading # (hashtag-style keywords). */
  normalize?: boolean;
  chipPrefix?: string;
  helperText?: string;
}

export function TagList({ values, onChange, placeholder, max, normalize = false, chipPrefix, helperText }: TagListProps) {
  const [draft, setDraft] = useState("");
  const full = max !== undefined && values.length >= max;
  const commit = () => {
    let tag = draft.trim();
    if (normalize) tag = tag.toLowerCase().replace(/^#/, "");
    if (!tag) return;
    if (!values.includes(tag) && !full) onChange([...values, tag]);
    setDraft("");
  };
  return (
    <div>
      <div className="pq-field px-2.5 py-2 flex flex-wrap gap-1.5 items-center">
        {values.map((t) => (
          <span key={t} className="px-3 py-1 rounded-full bg-gradient-to-r from-orange-warm/10 to-pink-vivid/10 text-sm font-ui text-pink-vivid inline-flex items-center gap-1.5">
            {chipPrefix}{t}
            <button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(values.filter((v) => v !== t))} className="rounded-full hover:bg-pink-vivid/15 p-0.5">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </span>
        ))}
        <input value={draft} disabled={full} placeholder={full ? "Maximum reached" : values.length ? "Add…" : placeholder} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); commit(); } else if (e.key === "Backspace" && !draft && values.length) onChange(values.slice(0, -1)); }}
          onBlur={commit} className="flex-1 min-w-[8rem] px-1.5 py-1 text-sm font-body text-ink placeholder:text-muted/60 bg-transparent focus:outline-none disabled:opacity-60" />
      </div>
      {(helperText || max !== undefined) && (
        <div className="flex justify-between gap-3 mt-1.5">
          <span className="text-xs font-body text-muted">{helperText ?? "Press Enter or comma to add"}</span>
          {max !== undefined && <span className={`text-xs font-ui tabular-nums ${full ? "text-orange-warm" : "text-muted"}`}>{values.length} / {max}</span>}
        </div>
      )}
    </div>
  );
}

/**
 * The round glass tile: a soft circle with an icon and a gradient ring when
 * chosen. Used for "physical or digital" and the product categories.
 */
export function ChoiceTile({ icon, label, hint, selected, onClick, size = "md" }: { icon: ReactNode; label: string; hint?: string; selected: boolean; onClick: () => void; size?: "md" | "lg" }) {
  const circle = size === "lg" ? "w-28 h-28 sm:w-32 sm:h-32" : "w-20 h-20 sm:w-24 sm:h-24";
  return (
    <button type="button" aria-pressed={selected} onClick={onClick} className="group flex flex-col items-center text-center rounded-2xl p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-vivid/40">
      <span
        className={`relative ${circle} rounded-full flex items-center justify-center bg-surface transition-all duration-300 mb-3 ${selected ? "shadow-xl shadow-pink-vivid/20" : "shadow-lg shadow-black/5 group-hover:shadow-xl group-hover:shadow-pink-vivid/10"}`}
        style={{
          border: selected ? "2px solid transparent" : "1px solid rgba(0, 0, 0, 0.05)",
          backgroundImage: selected ? "linear-gradient(var(--color-surface), var(--color-surface)), linear-gradient(to right, var(--color-purple-primary), var(--color-pink-vivid), var(--color-orange-warm))" : undefined,
          backgroundOrigin: "border-box",
          backgroundClip: selected ? "padding-box, border-box" : undefined,
        }}
      >
        <span className={`transition-colors duration-300 ${selected ? "text-pink-vivid" : "text-pink-vivid/40 group-hover:text-pink-vivid/70"}`}>{icon}</span>
      </span>
      <span className={`text-sm font-ui font-semibold transition-colors ${selected ? "text-pink-vivid" : "text-ink"}`}>{label}</span>
      {hint && <span className="text-xs font-body text-muted mt-0.5">{hint}</span>}
    </button>
  );
}
