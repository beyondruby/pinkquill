"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartLine,
  faClipboardList,
  faStore,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

const navItems: { label: string; href: string; description: string; icon: IconDefinition }[] = [
  {
    label: "Dashboard",
    href: "/seller/dashboard",
    description: "Overview & metrics",
    icon: faChartLine,
  },
  {
    label: "Orders",
    href: "/seller/orders",
    description: "Manage incoming orders",
    icon: faClipboardList,
  },
  {
    label: "Listings",
    href: "/seller/listings",
    description: "Products & services",
    icon: faStore,
  },
  {
    label: "Earnings",
    href: "/seller/earnings",
    description: "Revenue & payouts",
    icon: faWallet,
  },
];

export default function SellerSidebar() {
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
        <h1 className="font-display text-2xl text-ink">Seller Studio</h1>
        <p className="font-body text-sm text-muted mt-1">Manage your creative business</p>
      </div>

      {/* Navigation */}
      <nav className="p-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-start gap-3 p-4 rounded-2xl mb-2 transition-all ${
                isActive
                  ? "bg-gradient-to-r from-purple-primary to-pink-vivid text-white shadow-lg shadow-purple-primary/20"
                  : "hover:bg-black/[0.02]"
              }`}
            >
              <FontAwesomeIcon
                icon={item.icon}
                className={`mt-0.5 text-sm ${isActive ? "text-white" : "text-muted"}`}
              />
              <div>
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
              </div>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
