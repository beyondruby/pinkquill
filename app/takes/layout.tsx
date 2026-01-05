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
      <LeftSidebar />
      <main className="ml-[220px] min-h-screen bg-gradient-to-br from-[#fdfcfd] via-[#faf8fc] to-[#f8f5fa]">
        {children}
      </main>
    </>
  );
}
