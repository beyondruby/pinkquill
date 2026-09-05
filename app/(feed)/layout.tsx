import AppShell from "@/components/layout/AppShell";

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell rightSidebar>{children}</AppShell>;
}
