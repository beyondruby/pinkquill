"use client";

import { usePathname } from "next/navigation";

export default function MainContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHomepage = pathname === "/";
  const isMessagesPage = pathname.startsWith("/messages");

  // Messages page handles its own full-screen layout on mobile
  const mobileClasses = isMessagesPage
    ? "pt-0 pb-0"
    : "pt-16 pb-20";

  return (
    <main
      className={`min-h-screen ${mobileClasses} md:pt-0 md:pb-0 md:ml-[220px] ${
        isHomepage ? "lg:mr-[280px]" : "mr-0"
      }`}
    >
      {children}
    </main>
  );
}
