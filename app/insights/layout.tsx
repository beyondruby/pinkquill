"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import LeftSidebar from "@/components/layout/LeftSidebar";
import InsightsSidebar from "@/components/insights/InsightsSidebar";

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
    return (
      <>
        <LeftSidebar />
        <div className="ml-[220px] min-h-screen flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <LeftSidebar />
      <div className="ml-[220px] min-h-screen flex">
        <div className="relative">
          <InsightsSidebar />
        </div>
        <main className="flex-1 bg-[#fafafa] p-10 overflow-y-auto">
          <div className="max-w-5xl">
            {children}
          </div>
        </main>
      </div>
    </>
  );
}
