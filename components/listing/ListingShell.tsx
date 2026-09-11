"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import Button from "@/components/ui/Button";
import "./listing.css";

/**
 * One shell for every listing wizard (products and commissions).
 *
 * Header: a "Step n of N" line, a display headline with one gradient
 * highlight, a clickable step rail, and a gradient progress bar. Body: the
 * step's cards. Footer: Back · Save draft · Continue/Publish, inline on
 * desktop and docked above the bottom nav on phones.
 */

export interface ListingHeadline {
  prefix: string;
  highlight: string;
  suffix?: string;
}

interface ListingShellProps {
  eyebrow: string;
  steps: readonly string[];
  step: number;
  furthest: number;
  onJump: (step: number) => void;
  headline: ListingHeadline;
  error?: string | null;
  children: ReactNode;
  onBack: () => void;
  onNext: () => void;
  onPublish: () => void;
  onSaveDraft?: () => void;
  canSaveDraft?: boolean;
  savingDraft?: boolean;
  publishing?: boolean;
  busy?: boolean;
  isLive?: boolean;
}

export default function ListingShell({
  eyebrow, steps, step, furthest, onJump, headline, error, children,
  onBack, onNext, onPublish, onSaveDraft, canSaveDraft = false, savingDraft = false, publishing = false, busy = false, isLive = false,
}: ListingShellProps) {
  const isLast = step === steps.length;
  const progress = Math.round((step / steps.length) * 100);
  const showDraft = Boolean(onSaveDraft) && !isLive;

  const primary = isLast
    ? <Button onClick={onPublish} loading={publishing} loadingText={isLive ? "Saving…" : "Publishing…"} disabled={busy}>{isLive ? "Save changes" : "Publish"}</Button>
    : <Button onClick={onNext} disabled={busy}>Continue</Button>;
  const primarySm = isLast
    ? <Button size="sm" onClick={onPublish} loading={publishing} loadingText={isLive ? "Saving…" : "Publishing…"} disabled={busy}>{isLive ? "Save changes" : "Publish"}</Button>
    : <Button size="sm" onClick={onNext} disabled={busy}>Continue</Button>;

  return (
    <div className="min-h-screen bg-surface pb-28 md:pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12">
        <p className="text-center text-sm font-ui text-muted">{eyebrow} · Step {step} of {steps.length}</p>
        <h1 className="mt-3 text-center font-display text-3xl md:text-4xl font-bold text-ink leading-tight">
          {headline.prefix}{" "}
          <span className="bg-gradient-to-r from-orange-warm via-pink-vivid to-purple-primary bg-clip-text text-transparent">{headline.highlight}</span>
          {headline.suffix ? ` ${headline.suffix}` : ""}
        </h1>

        <div className="mt-8">
          <StepRail steps={steps} current={step} furthest={furthest} onJump={onJump} />
          <div className="mt-4 h-1.5 rounded-full bg-skeleton overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-purple-primary via-pink-vivid to-orange-warm transition-[width] duration-500" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {error && (
          <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50/60 px-4 py-3 text-sm font-body text-red-700">{error}</div>
        )}

        <div className="mt-10 space-y-12">{children}</div>

        <div className="hidden md:flex items-center justify-between gap-2 mt-12">
          <Button variant="secondary" onClick={onBack} disabled={step === 1 || busy}>Back</Button>
          <div className="flex gap-2">
            {showDraft && <Button variant="ghost" onClick={onSaveDraft} disabled={busy || !canSaveDraft} loading={savingDraft} loadingText="Saving…">Save draft</Button>}
            {primary}
          </div>
        </div>
        <div className="md:hidden fixed inset-x-0 bottom-16 z-(--z-sticky) bg-surface/95 backdrop-blur-xl border-t border-border-light px-4 pt-3 pb-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onBack} disabled={step === 1 || busy}>Back</Button>
          <div className="ml-auto flex gap-2">
            {showDraft && <Button variant="ghost" size="sm" onClick={onSaveDraft} disabled={busy || !canSaveDraft} loading={savingDraft} loadingText="Saving…">Save draft</Button>}
            {primarySm}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepRail({ steps, current, furthest, onJump }: { steps: readonly string[]; current: number; furthest: number; onJump: (s: number) => void }) {
  return (
    <ol className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]" aria-label="Steps">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        const reachable = n <= furthest;
        return (
          <li key={label} className={`flex items-center gap-2 shrink-0 ${i < steps.length - 1 ? "sm:flex-1" : ""}`}>
            <button type="button" onClick={() => reachable && onJump(n)} disabled={!reachable} aria-current={active ? "step" : undefined} className="flex items-center gap-2 disabled:cursor-default rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-vivid/40">
              <span className={`w-7 h-7 rounded-full text-xs font-ui font-bold inline-flex items-center justify-center shrink-0 transition-all ${done || active ? "pq-dot" : "bg-skeleton text-muted"} ${active ? "ring-4 ring-pink-vivid/15 scale-110" : ""}`}>
                {done ? "✓" : n}
              </span>
              <span className={`text-sm font-ui whitespace-nowrap ${active ? "text-ink font-semibold" : done ? "text-ink" : "text-muted"}`}>{label}</span>
            </button>
            {i < steps.length - 1 && <span className={`hidden sm:block h-px flex-1 ${done ? "bg-gradient-to-r from-orange-warm/60 to-pink-vivid/60" : "bg-skeleton"}`} />}
          </li>
        );
      })}
    </ol>
  );
}

/** The signed-out state, shared by both wizards. */
export function SignInGate({ title, description, redirect }: { title: string; description: string; redirect: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-orange-warm/15 to-pink-vivid/15 flex items-center justify-center">
          <svg className="w-8 h-8 text-pink-vivid" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">{title}</h1>
        <p className="text-sm font-body text-muted mt-2">{description}</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href={`/login?redirect=${encodeURIComponent(redirect)}`}><Button>Sign in</Button></Link>
          <Link href={`/signup?redirect=${encodeURIComponent(redirect)}`}><Button variant="secondary">Create an account</Button></Link>
        </div>
      </div>
    </div>
  );
}
