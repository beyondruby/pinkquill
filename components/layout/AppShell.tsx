"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DesktopRail from "./DesktopRail";
import TopBar from "./TopBar";
import MobileBottomNav from "./MobileBottomNav";
import ConditionalRightSidebar from "./ConditionalRightSidebar";

interface AppShellProps {
  children: ReactNode;
  /** Render the home discovery column on wide screens (only shows on `/`). */
  rightSidebar?: boolean;
  /**
   * `full` (default): rail + top bar + phone bottom bar.
   * `rail`: rail only — for immersive surfaces that draw their own chrome
   * (Takes). Messages is treated as `rail` because it owns its header.
   */
  chrome?: "full" | "rail";
}

/**
 * The application frame every section layout renders. Offsets come from the
 * `--pq-rail`, `--pq-topbar`, `--pq-bottom-nav` and `--pq-aside` variables in
 * shell.css, so no page needs to know the rail width.
 */
export default function AppShell({ children, rightSidebar = false, chrome = "full" }: AppShellProps) {
  const pathname = usePathname();
  const railOnly = chrome === "rail" || pathname.startsWith("/messages");
  const withAside = rightSidebar && pathname === "/";

  return (
    <>
      {!railOnly && <TopBar />}
      <DesktopRail />
      <main className={["pq-main", railOnly ? "pq-main--rail-only" : "", withAside ? "pq-main--with-aside" : ""].filter(Boolean).join(" ")}>
        {children}
      </main>
      {rightSidebar && <ConditionalRightSidebar />}
      {!railOnly && <MobileBottomNav />}
    </>
  );
}
