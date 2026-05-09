"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import LeftSidebar from "@/components/layout/LeftSidebar";
import InsightsSidebar from "@/components/insights/InsightsSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { FullPageLoading } from "@/components/ui/Loading";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading) {
    return <FullPageLoading text="Opening Insights" />;
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <MobileHeader />
      <LeftSidebar />
      <div className="pt-16 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen flex flex-col md:flex-row">
        <div className="relative hidden md:block">
          <InsightsSidebar />
        </div>
        <main className="flex-1 bg-canvas p-4 md:p-10 overflow-y-auto">
          <div className="max-w-5xl">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
}
