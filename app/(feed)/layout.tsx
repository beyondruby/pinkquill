import LeftSidebar from "@/components/layout/LeftSidebar";
import ConditionalRightSidebar from "@/components/layout/ConditionalRightSidebar";
import MainContent from "@/components/layout/MainContent";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function FeedLayout({
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

      {/* Main Content */}
      <MainContent>{children}</MainContent>

      {/* Desktop Right Sidebar - hidden on mobile/tablet */}
      <ConditionalRightSidebar />

      {/* Mobile Bottom Nav - visible only on mobile */}
      <MobileBottomNav />
    </>
  );
}