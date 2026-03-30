"use client";

import { usePathname } from "next/navigation";
import RightSidebar from "./RightSidebar";

export default function ConditionalRightSidebar() {
  const pathname = usePathname();

  // Only show on homepage
  if (pathname !== "/") {
    return null;
  }

  return <RightSidebar />;
}
