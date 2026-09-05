import { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Takes | PinkQuill",
  description: "Watch and share short-form video content on PinkQuill",
};

export default function TakesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Immersive: rail only on desktop, no phone chrome; Takes draws its own controls.
  return <AppShell chrome="rail">{children}</AppShell>;
}
