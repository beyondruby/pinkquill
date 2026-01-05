"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  return (
    <main
      className={`ml-[220px] min-h-screen ${
        isHomepage ? "mr-[280px]" : "mr-0"
      }`}
    >
      {children}
    </main>
  );
}
