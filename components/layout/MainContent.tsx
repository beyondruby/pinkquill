"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";

  return (
    <main
      className={`min-h-screen pt-16 pb-20 md:pt-0 md:pb-0 md:ml-[220px] ${
        isHomepage ? "lg:mr-[280px]" : "mr-0"
      }`}
    >
      {children}
    </main>
  );
}
