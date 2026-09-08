"use client";

import { useEffect, useState } from "react";
import { useModal } from "@/components/providers/ModalProvider";
import { usePathname } from "next/navigation";
import RightSidebar from "./RightSidebar";

type IdleCallback = (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void;
type IdleWindow = Window & {
  requestIdleCallback?: (callback: IdleCallback, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

function scheduleSidebarRender(callback: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const idleWindow = window as IdleWindow;
  if (typeof idleWindow.requestIdleCallback === "function") {
    const handle = idleWindow.requestIdleCallback(callback, { timeout: 3000 });
    return () => idleWindow.cancelIdleCallback?.(handle);
  }

  const timer = window.setTimeout(callback, 2000);
  return () => window.clearTimeout(timer);
}

export default function ConditionalRightSidebar() {
  const routePathname = usePathname();
  // A post/take modal changes the URL without leaving the feed; keep the
  // sidebar mounted (and its data fetched) while one is open (V-8).
  const { modalReturnPath } = useModal();
  const pathname = modalReturnPath ? modalReturnPath.split("?")[0] : routePathname;
  const [shouldRender, setShouldRender] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect -- deliberately defers non-critical sidebar data fetches */
  useEffect(() => {
    setShouldRender(false);

    if (pathname !== "/") {
      return;
    }

    return scheduleSidebarRender(() => {
      setShouldRender(true);
    });
  }, [pathname]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // Only show on homepage
  if (pathname !== "/" || !shouldRender) {
    return null;
  }

  return <RightSidebar />;
}
