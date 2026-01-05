"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const settingsItems = [
  {
    label: "Edit Profile",
    href: "/settings/profile",
    description: "Photo, name, bio",
  },
  {
    label: "Account",
    href: "/settings/account",
    description: "Email, password",
  },
  {
    label: "Notifications",
    href: "/settings/notifications",
    description: "Push, email alerts",
  },
  {
    label: "Privacy",
    href: "/settings/privacy",
    description: "Visibility, blocking",
  },
];

export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[280px] border-r border-black/[0.04] min-h-full bg-white/50">
      {/* Header */}
      <div className="px-6 py-8 border-b border-black/[0.04]">
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
              className={`block p-4 rounded-2xl mb-2 transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/20"
                  : "hover:bg-black/[0.02]"
              }`}
            >
              <span className={`font-ui text-[0.95rem] font-medium block ${
                isActive ? "text-white" : "text-ink"
              }`}>
                {item.label}
              </span>
              <span className={`font-body text-[0.8rem] mt-0.5 block ${
                isActive ? "text-white/70" : "text-muted"
              }`}>
                {item.description}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="absolute bottom-0 left-0 right-0 p-6 border-t border-black/[0.04]">
        <p className="font-body text-xs text-muted/60 text-center">
          PinkQuill v1.0
        </p>
      </div>
    </aside>
  );
}
