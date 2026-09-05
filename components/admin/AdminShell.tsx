"use client";

import Link from "next/link";
import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useIsPlatformAdmin } from "@/lib/hooks/useAdmin";
import AppShell from "@/components/layout/AppShell";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

/**
 * The operator console frame (Phase 2f, D8). Gated on platform_admins:
 * anyone else gets a plain "not for you" page, never the data. Same shell
 * as the seller studio — app rail, a section list, a phone tab strip.
 */

export const ADMIN_NAV = [
  { label: "Overview", href: "/admin", exact: true },
  { label: "Orders", href: "/admin/orders" },
  { label: "Refunds", href: "/admin/refunds" },
  { label: "Payouts", href: "/admin/payouts" },
  { label: "Disputes", href: "/admin/disputes" },
  { label: "Settings", href: "/admin/settings" },
  { label: "System", href: "/admin/system" },
];

function isActive(pathname: string, item: { href: string; exact?: boolean }) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { user, loading, status, isAnonymous } = useAuth();
  const isAdmin = useIsPlatformAdmin(user?.id);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isAnonymous) router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
  }, [isAnonymous, router, pathname]);

  if (status === "unknown") return <AuthUnavailable />;
  if (loading || (user && isAdmin === null)) return <FullPageLoading text="Opening the console" />;
  if (!user) return null;
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-canvas flex items-center justify-center p-6">
        <div className="rounded-2xl border border-border-light bg-surface p-8 text-center max-w-sm">
          <p className="font-display text-lg font-semibold text-ink">This page is for Pinkquill operators</p>
          <p className="text-sm font-body text-muted mt-1">Your account isn&apos;t on the operator list.</p>
          <Link href="/" className="inline-block mt-4 text-sm font-ui font-semibold text-purple-primary hover:underline">Back to Quill</Link>
        </div>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-var(--pq-topbar)-var(--pq-bottom-nav))] flex flex-col md:flex-row">
        <nav className="md:hidden flex gap-1 overflow-x-auto px-3 py-2 border-b border-border-light bg-surface" aria-label="Console sections">
          {ADMIN_NAV.map((item) => (
            <Link key={item.href} href={item.href} className={`px-3 py-1.5 rounded-full text-xs font-ui font-semibold whitespace-nowrap ${isActive(pathname, item) ? "bg-purple-primary/10 text-purple-800" : "text-muted"}`}>{item.label}</Link>
          ))}
        </nav>
        <aside className="hidden md:block w-[220px] border-r border-border-light bg-surface">
          <div className="px-5 pt-6 pb-5 border-b border-border-light">
            <Link href="/" className="inline-flex items-center gap-1.5 text-muted hover:text-ink transition-colors mb-3">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M15 19l-7-7 7-7" /></svg>
              <span className="font-ui text-xs">Back to Quill</span>
            </Link>
            <h1 className="font-display text-xl font-bold text-ink">Console</h1>
            <p className="font-body text-xs text-muted mt-0.5">Operations for Pinkquill</p>
          </div>
          <div className="p-3">
            {ADMIN_NAV.map((item) => (
              <Link key={item.href} href={item.href} className={`flex items-center px-3 py-2.5 rounded-lg mb-0.5 text-sm font-ui transition-all ${isActive(pathname, item) ? "bg-purple-primary/[0.08] text-purple-primary font-semibold" : "text-ink hover:bg-subtle"}`}>{item.label}</Link>
            ))}
          </div>
        </aside>
        <div className="flex-1 bg-canvas p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </div>
    </AppShell>
  );
}
