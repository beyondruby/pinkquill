"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFeatherPointed,
  faArrowLeft,
  faRocket,
  faUser,
  faPenNib,
  faUsers,
  faEnvelope,
  faHeart,
  faShield,
  faGear,
  faChartLine,
  faSearch,
  faChevronRight
} from "@fortawesome/free-solid-svg-icons";

const helpCategories = [
  { href: "/help/getting-started", label: "Getting Started", icon: faRocket, description: "New to PinkQuill? Start here" },
  { href: "/help/account", label: "Account & Profile", icon: faUser, description: "Manage your profile" },
  { href: "/help/posting", label: "Creating & Sharing", icon: faPenNib, description: "Posts, takes & content" },
  { href: "/help/communities", label: "Communities", icon: faUsers, description: "Join and create spaces" },
  { href: "/help/messaging", label: "Messaging", icon: faEnvelope, description: "Direct conversations" },
  { href: "/help/interactions", label: "Interactions", icon: faHeart, description: "Engage with others" },
  { href: "/help/privacy-safety", label: "Privacy & Safety", icon: faShield, description: "Stay safe on PinkQuill" },
  { href: "/help/settings", label: "Settings", icon: faGear, description: "Customize your experience" },
  { href: "/help/insights", label: "Insights & Analytics", icon: faChartLine, description: "Understand your reach" },
];

export default function HelpLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isIndex = pathname === "/help";
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <div className="min-h-screen bg-[#FDFCFB]">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFCFB]/90 backdrop-blur-md border-b border-black/[0.04]">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-muted hover:text-ink transition-colors group"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-ui text-sm">Back to PinkQuill</span>
          </Link>
          <Link href="/help" className="flex items-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <FontAwesomeIcon icon={faFeatherPointed} className="w-4 h-4 text-purple-primary" />
            <span className="font-ui text-sm font-medium text-ink">Help Center</span>
          </Link>
        </div>
      </header>

      <div className="pt-14 flex">
        {/* Sidebar - hidden on index page */}
        {!isIndex && (
          <aside className="hidden lg:block w-[260px] flex-shrink-0 border-r border-black/[0.04] bg-white/50">
            <nav className="sticky top-14 p-6 max-h-[calc(100vh-3.5rem)] overflow-y-auto">
              <Link
                href="/help"
                className="flex items-center gap-2 text-muted hover:text-ink transition-colors mb-6"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="w-3 h-3" />
                <span className="font-ui text-sm">All topics</span>
              </Link>

              <div className="space-y-1">
                {helpCategories.map((cat) => {
                  const isActive = pathname === cat.href;
                  return (
                    <Link
                      key={cat.href}
                      href={cat.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                        isActive
                          ? "bg-purple-primary/10 text-purple-primary"
                          : "text-ink/70 hover:bg-black/[0.03] hover:text-ink"
                      }`}
                    >
                      <FontAwesomeIcon icon={cat.icon} className="w-4 h-4 opacity-70" />
                      <span className="font-ui text-sm font-medium">{cat.label}</span>
                    </Link>
                  );
                })}
              </div>
            </nav>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 min-h-screen">
          {children}
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] py-8 px-6 bg-white/50">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="font-ui text-xs text-muted/60">
            Need more help? Contact us at{" "}
            <a href="mailto:support@pinkquill.com" className="text-purple-primary hover:underline">
              support@pinkquill.com
            </a>
          </p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="font-ui text-xs text-muted/60 hover:text-purple-primary transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
