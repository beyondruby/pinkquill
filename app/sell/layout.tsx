import AppShell from "@/components/layout/AppShell";

export default function SellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
