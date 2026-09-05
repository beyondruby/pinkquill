"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const insightsItems = [
  {
    label: "Overview",
    href: "/insights",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    label: "Content",
    href: "/insights/content",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    label: "Audience",
    href: "/insights/audience",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    label: "Communities",
    href: "/insights/communities",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
];

export default function InsightsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] border-r border-border-light min-h-full bg-surface/50 flex flex-col">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border-light">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-ui text-sm">Back to feed</span>
        </Link>
        <h1 className="font-display text-2xl text-ink flex items-center gap-2">
          <svg className="w-6 h-6 text-purple-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Insights
        </h1>
        <p className="font-body text-sm text-muted mt-1">
          Analyze your performance
        </p>
      </div>

      {/* Navigation */}
      <nav className="p-4 flex-1">
        {insightsItems.map((item) => {
          const isActive = pathname === item.href ||
            (item.href !== "/insights" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl mb-1 transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/20"
                  : "hover:bg-subtle"
              }`}
            >
              <span className={isActive ? "text-white" : "text-purple-primary"}>
                {item.icon}
              </span>
              <span className={`font-ui text-[0.95rem] font-medium ${
                isActive ? "text-white" : "text-ink"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-6 border-t border-border-light">
        <p className="font-body text-xs text-muted/60 text-center">
          Data updated in real-time
        </p>
      </div>
    </aside>
  );
}

// Mobile-only horizontal tabs for switching insights sub-pages on small screens.
// Renders nothing on md+ (the full InsightsSidebar takes over).
// Stays inside content sub-pages too (e.g., /insights/content/post/[id]) so
// users always have a way back to the top-level insights tabs without hunting.
export function InsightsMobileTabs() {
  const pathname = usePathname();
  const onContentDetail =
    pathname.startsWith("/insights/content/post/") ||
    pathname.startsWith("/insights/content/take/");

  return (
    <div className="md:hidden border-b border-border-light bg-surface/95 backdrop-blur-sm sticky top-(--pq-topbar) z-(--z-sticky)">
      <nav className="overflow-x-auto scrollbar-hide -mx-px">
        <div className="flex gap-2 px-4 py-2.5 min-w-max">
          {insightsItems.map((item) => {
            const isActive = onContentDetail
              ? item.href === "/insights/content"
              : pathname === item.href ||
                (item.href !== "/insights" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex-shrink-0 px-4 py-1.5 rounded-full font-ui text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-md shadow-purple-primary/20"
                    : "bg-subtle/60 text-muted hover:text-ink"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
