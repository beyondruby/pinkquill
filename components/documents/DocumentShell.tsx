"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import Button from "@/components/ui/Button";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

/**
 * A printable document (receipt, payout statement — Phase 2e). No app chrome:
 * a slim bar with a way back and "Download PDF" (a server-rendered PDF when the
 * document has one, otherwise the browser's print-to-PDF),
 * then one white sheet. Everything outside the sheet is hidden when printing.
 */

interface DocumentShellProps {
  backHref: string;
  backLabel: string;
  eyebrow: string;
  loading?: boolean;
  error?: string | null;
  /** Where to send a signed-out visitor after login. */
  returnTo: string;
  /** A server-rendered PDF for this document; without it the button prints the page. */
  downloadHref?: string;
  downloadName?: string;
  children: ReactNode;
}

export function DocumentShell({ backHref, backLabel, eyebrow, loading, error, returnTo, downloadHref, downloadName, children }: DocumentShellProps) {
  const { user, loading: authLoading, status, isAnonymous } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAnonymous) router.replace(`/login?redirect=${encodeURIComponent(returnTo)}`);
  }, [isAnonymous, router, returnTo]);

  if (status === "unknown") return <AuthUnavailable />;
  if (authLoading || (!user && !isAnonymous)) return <FullPageLoading text="Opening document" />;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-canvas print:bg-white">
      <div className="print:hidden sticky top-0 z-(--z-sticky) bg-surface/95 backdrop-blur-xl border-b border-border-light">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-ui text-muted hover:text-ink transition-colors min-w-0">
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
            <span className="truncate">{backLabel}</span>
          </Link>
          <span className="hidden sm:block font-ui text-2xs uppercase tracking-[0.14em] text-muted">{eyebrow}</span>
          {downloadHref && !loading && !error ? (
            <a href={downloadHref} download={downloadName} className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-primary to-pink-vivid text-white font-ui font-semibold text-sm px-4 py-2 hover:opacity-90 transition-opacity">Download PDF</a>
          ) : (
            <Button size="sm" onClick={() => window.print()} disabled={Boolean(loading || error)}>Download PDF</Button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 print:p-0 print:max-w-none">
        {loading ? (
          <div className="rounded-2xl border border-border-light bg-surface p-8 space-y-4">
            <div className="h-6 w-40 rounded bg-skeleton/60 animate-pulse" />
            <div className="h-4 w-72 rounded bg-skeleton/60 animate-pulse" />
            <div className="h-40 rounded bg-skeleton/40 animate-pulse" />
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-border-light bg-surface p-8 text-center">
            <p className="font-display text-lg font-semibold text-ink">This document isn&apos;t available</p>
            <p className="text-sm font-body text-muted mt-1">{error}</p>
            <Link href={backHref} className="inline-block mt-4 text-sm font-ui font-semibold text-purple-primary hover:underline">{backLabel}</Link>
          </div>
        ) : (
          <article className="rounded-2xl border border-border-light bg-surface p-6 sm:p-10 print:border-0 print:rounded-none print:p-0 text-ink">
            {children}
          </article>
        )}
      </div>
    </div>
  );
}

// ─── shared document pieces ─────────────────────────────────────────

export function DocumentHeader({ title, number, right }: { title: string; number: string; right: ReactNode }) {
  return (
    <header className="flex items-start justify-between gap-6 pb-6 border-b border-border-light">
      <div className="min-w-0">
        <p className="font-display text-lg font-bold text-purple-primary leading-none">PinkQuill</p>
        <h1 className="font-display text-2xl font-semibold text-ink mt-4">{title}</h1>
        <p className="font-ui text-sm text-muted mt-0.5 tabular-nums">{number}</p>
      </div>
      <div className="text-right shrink-0 text-sm font-body text-muted space-y-0.5">{right}</div>
    </header>
  );
}

export function DocumentParty({ label, name, sub, extra }: { label: string; name: string; sub?: string | null; extra?: string | null }) {
  return (
    <div className="min-w-0">
      <p className="font-ui text-2xs uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="font-ui text-sm font-semibold text-ink mt-1 truncate">{name}</p>
      {sub && <p className="text-sm font-body text-muted truncate">{sub}</p>}
      {extra && <p className="text-sm font-body text-muted truncate">{extra}</p>}
    </div>
  );
}

export function MoneyRow({ label, value, muted = false, strong = false, note }: { label: ReactNode; value: string; muted?: boolean; strong?: boolean; note?: string }) {
  return (
    <div className={`flex items-baseline justify-between gap-6 ${strong ? "pt-3 mt-1 border-t border-border-light" : ""}`}>
      <div className="min-w-0">
        <p className={`text-sm ${strong ? "font-ui font-semibold text-ink" : muted ? "font-body text-muted" : "font-body text-ink"}`}>{label}</p>
        {note && <p className="text-2xs font-body text-muted mt-0.5">{note}</p>}
      </div>
      <p className={`tabular-nums text-right shrink-0 ${strong ? "font-ui font-semibold text-base text-ink" : muted ? "text-sm font-body text-muted" : "text-sm font-body text-ink"}`}>{value}</p>
    </div>
  );
}

export function DocumentSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="font-ui text-2xs uppercase tracking-[0.12em] text-muted mb-3">{title}</h2>
      {children}
    </section>
  );
}

export function DocumentFooter({ children }: { children: ReactNode }) {
  return <footer className="mt-10 pt-5 border-t border-border-light text-2xs font-body text-muted space-y-1">{children}</footer>;
}
