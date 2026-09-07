import LeftSidebar from "@/components/layout/LeftSidebar";
import MainContent from "@/components/layout/MainContent";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function ProductLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {/* Mobile Header - visible only on mobile */}
      <MobileHeader />

      {/* Desktop Left Sidebar - hidden on mobile */}
      <LeftSidebar />

      {/* Main Content - no right sidebar for product pages */}
      <MainContent>{children}</MainContent>

      {/* Mobile Bottom Nav - visible only on mobile */}
      <MobileBottomNav />
    </>
  );
}
