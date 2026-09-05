import AppShell from "@/components/layout/AppShell";

export default function CommissionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
