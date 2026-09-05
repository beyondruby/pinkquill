import type { Metadata } from "next";
import AppShell from "@/components/layout/AppShell";

interface Props {
  params: Promise<{ tag: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const tagName = decodeURIComponent(tag);

  return {
    title: `#${tagName} | PinkQuill`,
    description: `Explore posts tagged with #${tagName} on Pinkquill.`,
    openGraph: {
      title: `#${tagName} | PinkQuill`,
      description: `Explore posts tagged with #${tagName} on Pinkquill.`,
    },
  };
}

export default function TagLayout({ children }: Props) {
  return <AppShell>{children}</AppShell>;
}
