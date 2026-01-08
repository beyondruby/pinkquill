import { Metadata } from "next";
import LeftSidebar from "@/components/layout/LeftSidebar";

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
      {/* No mobile header/nav for immersive full-screen Takes experience */}
      <LeftSidebar />
      <main className="md:ml-[220px] min-h-screen bg-black md:bg-gradient-to-br md:from-[#fdfcfd] md:via-[#faf8fc] md:to-[#f8f5fa]">
        {children}
      </main>
    </>
  );
}
