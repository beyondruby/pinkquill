import { Metadata } from "next";
import LeftSidebar from "@/components/layout/LeftSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export const metadata: Metadata = {
  title: "Takes | PinkQuill",
  description: "Watch and share short-form video content on PinkQuill",
};

export default function TakesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileHeader />
      <LeftSidebar />
      <main className="pt-14 pb-20 md:pt-0 md:pb-0 md:ml-[220px] min-h-screen bg-gradient-to-br from-[#fdfcfd] via-[#faf8fc] to-[#f8f5fa]">
        {children}
      </main>
      <MobileBottomNav />
    </>
  );
}
