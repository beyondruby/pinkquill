"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";

/**
 * The commission wizard's building blocks, copied from the product wizard so
 * both flows look the same: the STEP header with two-tone gradient words,
 * gradient-ringed circles for reached steps, gradient-bordered inputs with
 * the pencil icon, gradient checkbox squares, glass option boxes, colon
 * section headers, and the purple pill navigation.
 */

const TRI = "bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm";
const WARM = "bg-gradient-to-r from-orange-warm to-pink-vivid";
const GRADIENT_RING = "linear-gradient(white, white), linear-gradient(to right, #8e44ad, #ff007f, #ff9f43)";

export const FIELD = "w-full px-4 py-3.5 rounded-xl bg-transparent outline-none transition-all duration-300 font-body text-ink placeholder:text-gray-400";

export function StepHeader({ step, total, labels, prefix, highlight1, highlight2 }: { step: number; total: number; labels: readonly string[]; prefix: string; highlight1: string; highlight2: string }) {
  return (
    <>
      <p className="text-center text-sm font-ui text-muted mb-4">STEP {step}</p>
      <h1 className="text-center text-3xl md:text-4xl font-display font-bold text-ink mb-8">
        {prefix}{" "}
        <span className={`${WARM} bg-clip-text text-transparent`}>{highlight1}</span>{" "}
        <span className="bg-gradient-to-r from-pink-vivid to-purple-primary bg-clip-text text-transparent">{highlight2}</span>
      </h1>
      <div className="mb-12">
        <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 mb-4">
          {labels.map((label, i) => {
            const n = i + 1;
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${step >= n ? `${WARM} text-white` : "bg-skeleton text-gray-500"}`}>{n}</div>
                <span className={`text-sm font-ui ${step >= n ? "text-ink font-medium" : "text-muted"}`}>{label}</span>
              </div>
            );
          })}
        </div>
        <div className="h-1.5 bg-skeleton rounded-full overflow-hidden">
          <div className={`h-full ${TRI} transition-all duration-500`} style={{ width: `${Math.round((step / total) * 100)}%` }} />
        </div>
      </div>
    </>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl text-center" role="alert">
      <p className="text-sm text-red-600 font-body">{message}</p>
    </div>
  );
}

const PILL = "flex items-center gap-2 px-6 py-3 rounded-full bg-purple-primary text-white font-ui font-semibold hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function WizardNav({ onBack, onNext, onPublish, onSaveDraft, canSaveDraft, savingDraft, busy, isFirst, isLast, isLive }: { onBack: () => void; onNext: () => void; onPublish: () => void; onSaveDraft: () => void; canSaveDraft: boolean; savingDraft: boolean; busy: boolean; isFirst: boolean; isLast: boolean; isLive: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      {!isFirst ? (
        <button type="button" onClick={onBack} disabled={busy} className={PILL}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Previous Step
        </button>
      ) : <div />}
      <div className="flex items-center gap-3">
        {!isLive && (
          <button type="button" onClick={onSaveDraft} disabled={busy || !canSaveDraft} className="px-4 py-3 text-sm font-ui font-semibold text-muted hover:text-pink-vivid transition-colors disabled:opacity-50 disabled:hover:text-muted">
            {savingDraft ? "Saving…" : "Save draft"}
          </button>
        )}
        {!isLast ? (
          <button type="button" onClick={onNext} disabled={busy} className={`${PILL} px-8`}>
            Next Step
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        ) : (
          <button
            type="button"
            onClick={onPublish}
            disabled={busy}
            className="flex items-center gap-2 px-10 py-3 rounded-full border-2 border-transparent font-ui font-semibold text-orange-warm hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "linear-gradient(white, white) padding-box, linear-gradient(to right, #ff9f43, #ff007f) border-box" }}
          >
            {busy ? (isLive ? "Saving..." : "Publishing...") : (isLive ? "Save Changes" : "Publish")}
          </button>
        )}
      </div>
    </div>
  );
}

export function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-display font-bold text-ink mb-6">{children}</h3>;
}

/** A section after the first: top hairline and air, like the product details step. */
export function Section({ first = false, children }: { first?: boolean; children: ReactNode }) {
  return <div className={first ? "" : "pt-6 border-t border-gray-100"}>{children}</div>;
}

export function FieldLabel({ children, required = false, right, htmlFor, muted = false }: { children: ReactNode; required?: boolean; right?: ReactNode; htmlFor?: string; muted?: boolean }) {
  return (
    <label htmlFor={htmlFor} className={`flex items-center justify-between gap-3 text-sm font-ui mb-3 ${muted ? "text-muted" : "font-semibold text-ink"}`}>
      <span>{children}{required && <span className="text-pink-vivid ml-1">*</span>}</span>
      {right && <span className="text-xs font-normal text-muted">{right}</span>}
    </label>
  );
}

export function Hint({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted mt-2">{children}</p>;
}

/** The gradient border box every field sits in. `strong` is the 2px warm ring used on the title and description. */
export function Ring({ strong = false, children, className = "" }: { strong?: boolean; children: ReactNode; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <div className={`absolute inset-0 rounded-xl ${strong ? `${WARM} p-[2px]` : `${TRI} p-[1px]`}`}>
        <div className="w-full h-full rounded-xl bg-surface" />
      </div>
      <div className="relative">{children}</div>
    </div>
  );
}

const PENCIL = (
  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-warm pointer-events-none">
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
  </div>
);

export function GInput({ id, value, onChange, placeholder, maxLength, strong = false, pencil = false, type = "text", min, className = "" }: { id?: string; value: string | number; onChange: (v: string) => void; placeholder?: string; maxLength?: number; strong?: boolean; pencil?: boolean; type?: string; min?: number | string; className?: string }) {
  return (
    <Ring strong={strong} className={className}>
      <input id={id} type={type} min={min} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${FIELD} ${pencil ? "pr-12" : ""} ${type === "number" ? "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" : ""}`} />
      {pencil && PENCIL}
    </Ring>
  );
}

export function GTextarea({ id, value, onChange, placeholder, maxLength, rows = 4, strong = false }: { id?: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number; rows?: number; strong?: boolean }) {
  return (
    <Ring strong={strong}>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${FIELD} pr-12 resize-none`} />
      <div className="absolute right-4 top-4 text-orange-warm pointer-events-none">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
      </div>
    </Ring>
  );
}

/** A number in the gradient box with a $ or unit, w-48 like the product wizard's price fields. */
export function GNumber({ id, value, onChange, prefix, suffix, placeholder = "0", min = 0, step = 1, className = "w-48" }: { id?: string; value: number | null | undefined; onChange: (v: number | null) => void; prefix?: string; suffix?: string; placeholder?: string; min?: number; step?: number; className?: string }) {
  return (
    <Ring className={className}>
      <div className="flex items-center">
        {prefix && <span className="absolute left-4 text-pink-vivid font-medium">{prefix}</span>}
        <input id={id} type="number" min={min} step={step} inputMode="decimal" value={value ?? ""} placeholder={placeholder}
          onChange={(e) => { const raw = e.target.value; if (raw === "") { onChange(null); return; } const n = parseFloat(raw); if (Number.isFinite(n)) onChange(n); }}
          className={`w-full ${prefix ? "pl-10" : "px-4"} ${suffix ? "pr-14" : "pr-4"} py-3 rounded-xl bg-transparent outline-none font-body text-ink placeholder:text-gray-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`} />
        {suffix && <span className="absolute right-4 text-pink-vivid text-sm font-ui">{suffix}</span>}
      </div>
    </Ring>
  );
}

export function GSelect({ className = "w-48", children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Ring className={className}>
      <select {...rest} className={`${FIELD} pr-10 appearance-none cursor-pointer`}>{children}</select>
      <svg className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-orange-warm pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
    </Ring>
  );
}

/** The gradient checkbox square. */
export function GCheck({ checked, onChange, label, hint, small = false }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: string; small?: boolean }) {
  const box = small ? "w-4 h-4" : "w-5 h-5";
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="sr-only peer" />
      <div className={`mt-0.5 ${box} rounded flex items-center justify-center flex-shrink-0 transition-all border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-pink-vivid/40 ${checked ? `${WARM} border-transparent` : "border-gray-300 group-hover:border-pink-vivid/50"}`}>
        {checked && <svg className={small ? "w-2.5 h-2.5 text-white" : "w-3 h-3 text-white"} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span>
        <span className={`block font-ui ${small ? "text-xs text-muted" : "text-sm text-ink"}`}>{label}</span>
        {hint && <span className="block text-xs font-body text-muted mt-0.5">{hint}</span>}
      </span>
    </label>
  );
}

/** The glass option box with the gradient ring and check square, from the product's specialization step. */
export function OptionBox({ selected, onClick, label, hint }: { selected: boolean; onClick: () => void; label: string; hint?: string }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`relative px-5 py-4 rounded-xl text-left transition-all duration-300 flex items-center gap-3 bg-surface ${selected ? "shadow-lg shadow-pink-vivid/10" : "shadow-sm hover:shadow-md"}`}
      style={{
        border: selected ? "1px solid transparent" : "1px solid rgba(0, 0, 0, 0.05)",
        backgroundImage: selected ? GRADIENT_RING : undefined,
        backgroundOrigin: "border-box",
        backgroundClip: selected ? "padding-box, border-box" : undefined,
      }}
    >
      <div className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 transition-all ${selected ? TRI : "border border-muted/30"}`}>
        {selected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
      </div>
      <span className="min-w-0">
        <span className={`block font-medium font-ui text-sm ${selected ? "text-pink-vivid" : "text-ink"}`}>{label}</span>
        {hint && <span className="block text-xs font-body text-muted mt-0.5">{hint}</span>}
      </span>
    </button>
  );
}

export function TextLink({ onClick, children, className = "" }: { onClick: () => void; children: ReactNode; className?: string }) {
  return <button type="button" onClick={onClick} className={`text-sm font-ui font-medium text-pink-vivid hover:text-purple-primary transition-colors ${className}`}>{children}</button>;
}

export function RemoveButton({ onClick, label = "Remove" }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
    </button>
  );
}

export function LineList({ values, placeholder, onChange, addLabel = "Add line" }: { values: string[]; placeholder: string; onChange: (v: string[]) => void; addLabel?: string }) {
  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        // Items are only appended or removed, never reordered, so the index key is stable enough.
        <div key={index} className="flex items-center gap-2">
          <GInput value={value} placeholder={placeholder} onChange={(v) => onChange(values.map((x, i) => (i === index ? v : x)))} className="flex-1" />
          <RemoveButton onClick={() => onChange(values.filter((_, i) => i !== index))} />
        </div>
      ))}
      <TextLink onClick={() => onChange([...values, ""])}>+ {addLabel}</TextLink>
    </div>
  );
}
