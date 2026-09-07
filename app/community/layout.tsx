import LeftSidebar from "@/components/layout/LeftSidebar";
import ConditionalRightSidebar from "@/components/layout/ConditionalRightSidebar";
import MainContent from "@/components/layout/MainContent";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function CommunityLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <MobileHeader />
      <LeftSidebar />
      <MainContent>{children}</MainContent>
      <ConditionalRightSidebar />
      <MobileBottomNav />
    </>
  );
}
