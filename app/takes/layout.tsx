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
      <main className="md:ml-[72px] min-h-screen bg-canvas">
        {children}
      </main>
    </>
  );
}
