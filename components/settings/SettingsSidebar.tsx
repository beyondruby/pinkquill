"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsItems = [
  { label: "Edit Profile", href: "/settings/profile" },
  { label: "Account", href: "/settings/account" },
  { label: "Appearance", href: "/settings/appearance" },
  { label: "Notifications", href: "/settings/notifications" },
  { label: "Privacy", href: "/settings/privacy" },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] border-r border-border-light min-h-full bg-surface/50">
      {/* Header */}
      <div className="px-6 py-8 border-b border-border-light">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-muted hover:text-ink transition-colors mb-4"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-ui text-sm">Back</span>
        </Link>
        <h1 className="font-display text-2xl text-ink">Settings</h1>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        {settingsItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block px-4 py-3 rounded-2xl mb-1 transition-all ${
                isActive
                  ? "bg-gradient-to-r from-accent to-accent-2 text-on-accent shadow-lg shadow-accent/20"
                  : "hover:bg-subtle"
              }`}
            >
              <span className={`font-ui text-[0.95rem] font-medium block ${
                isActive ? "text-on-accent" : "text-ink"
              }`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-border-light">
        <p className="font-body text-xs text-muted/60 text-center">
          PinkQuill v1.0
        </p>
      </div>
    </aside>
  );
}
