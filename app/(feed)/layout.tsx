import LeftSidebar from "@/components/layout/LeftSidebar";
import ConditionalRightSidebar from "@/components/layout/ConditionalRightSidebar";
import MainContent from "@/components/layout/MainContent";

export default function FeedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <LeftSidebar />
      <MainContent>{children}</MainContent>
      <ConditionalRightSidebar />
    </>
  );
}