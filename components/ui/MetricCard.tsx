"use client";

import Link from "next/link";
import { TONE_CLASSES, type StatusTone } from "@/lib/utils/orderStatus";

/**
 * The one metric tile (Phase 4a): an uppercase label, a number, an optional
 * line under it. Used by the buyer and seller dashboards, earnings,
 * analytics, customers and the admin console. `tone` colours the value;
 * `subTone` colours the line under it (deltas: up = good, down = watch).
 */
export interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string | null;
  tone?: StatusTone;
  subTone?: "up" | "down" | "flat";
  href?: string;
}

export default function MetricCard({ label, value, sub, tone, subTone, href }: MetricCardProps) {
  const inner = (
    <>
      <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className={`font-display text-xl font-semibold mt-1 tabular-nums ${tone ? TONE_CLASSES[tone].text : "text-ink"}`}>{value}</p>
      {sub && <p className={`text-2xs font-body mt-0.5 truncate ${subTone === "up" ? "text-emerald-700" : subTone === "down" ? "text-amber-700" : "text-muted"}`}>{sub}</p>}
    </>
  );
  const cls = "rounded-2xl border border-border-light bg-surface p-4 min-w-0 block";
  return href ? <Link href={href} className={`${cls} hover:border-border-strong transition-colors`}>{inner}</Link> : <div className={cls}>{inner}</div>;
}
