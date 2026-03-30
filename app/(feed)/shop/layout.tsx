import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop | PinkQuill",
  description: "Discover creator products and hire commissions from talented creatives around the world.",
  openGraph: {
    title: "Shop | PinkQuill",
    description: "Discover creator products and hire commissions from talented creatives around the world.",
    type: "website",
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}
