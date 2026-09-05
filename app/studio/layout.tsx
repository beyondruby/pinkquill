import AppShell from "@/components/layout/AppShell";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
