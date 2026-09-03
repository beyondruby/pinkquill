"use client";

import { useState, type ReactNode } from "react";
import Button from "@/components/ui/Button";
import { TONE_CLASSES, type StatusTone } from "@/lib/utils/orderStatus";
import { shortDateTime } from "@/lib/utils/time";

/** Small shared pieces for the admin console (Phase 2f). Same tokens and primitives as the seller studio. */

export { default as Tile } from "@/components/ui/MetricCard";

export function Panel({ title, right, children, className = "" }: { title: string; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-border-light bg-surface overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-border-light">
        <h2 className="font-display text-sm font-semibold text-ink">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Chip({ label, tone = "neutral" }: { label: string; tone?: StatusTone }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-2xs font-ui font-semibold whitespace-nowrap ${TONE_CLASSES[tone].chip}`}>{label}</span>;
}

export function Empty({ text }: { text: string }) {
  return <div className="px-4 py-8 text-center text-sm font-body text-muted">{text}</div>;
}

export function Notice({ text, tone = "amber" }: { text: string; tone?: StatusTone }) {
  return <div className={`rounded-2xl border p-4 text-sm font-body text-ink ${TONE_CLASSES[tone].box}`}>{text}</div>;
}

export function Rows({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-border-light">{children}</div>;
}

export function Skeleton({ rows = 3 }: { rows?: number }) {
  return <div className="divide-y divide-border-light">{Array.from({ length: rows }).map((_, i) => <div key={i} className="h-16 bg-skeleton/40 animate-pulse" />)}</div>;
}

export function KV({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm font-body">
      {items.map(([k, v]) => (<div key={k} className="contents"><dt className="text-muted">{k}</dt><dd className="text-ink min-w-0 break-words">{v}</dd></div>))}
    </dl>
  );
}

export function dt(value: string | null | undefined, withTime = true): string {
  if (!value) return "—";
  return withTime ? shortDateTime(value) : new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function cents(n: number | null | undefined, currency = "usd"): string {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(n / 100);
}

/**
 * A button that asks once before acting: first click arms it ("Sure?"),
 * second click runs. Irreversible actions (submit to Stripe, cancel a refund)
 * get a real confirmation sheet instead; this is for the routine ones.
 */
export function ArmedButton({ label, confirmLabel = "Confirm", onConfirm, variant = "secondary", size = "sm", disabled }: { label: string; confirmLabel?: string; onConfirm: () => Promise<void> | void; variant?: "primary" | "secondary" | "danger" | "outline"; size?: "sm" | "md"; disabled?: boolean }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5">
      {armed && <button type="button" onClick={() => setArmed(false)} className="text-2xs font-ui text-muted hover:text-ink">Cancel</button>}
      <Button
        size={size}
        variant={armed ? (variant === "secondary" ? "primary" : variant) : variant}
        disabled={disabled || busy}
        loading={busy}
        onClick={async () => {
          if (!armed) { setArmed(true); return; }
          setBusy(true);
          try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
        }}
      >
        {armed ? confirmLabel : label}
      </Button>
    </span>
  );
}
