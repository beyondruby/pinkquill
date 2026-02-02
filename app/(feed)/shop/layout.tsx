import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop | PinkQuill",
  description: "Discover art, music, books, and more from talented creators around the world.",
  openGraph: {
    title: "Shop | PinkQuill",
    description: "Discover art, music, books, and more from talented creators around the world.",
    type: "website",
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
