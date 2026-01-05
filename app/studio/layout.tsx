import LeftSidebar from "@/components/layout/LeftSidebar";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LeftSidebar />
      <main className="ml-[220px] min-h-screen">{children}</main>
    </>
  );
}