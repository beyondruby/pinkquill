"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import AppShell from "@/components/layout/AppShell";
import InsightsSidebar, { InsightsMobileTabs } from "@/components/insights/InsightsSidebar";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

export default function InsightsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, status, isAnonymous } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isAnonymous) {
      router.push("/login");
    }
  }, [isAnonymous, router]);

  if (status === "unknown") {
    return <AuthUnavailable />;
  }

  if (loading) {
    return <FullPageLoading text="Opening Insights" />;
  }

  if (!user) {
    return null;
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-var(--pq-topbar)-var(--pq-bottom-nav))] flex flex-col md:flex-row">
        <div className="relative hidden md:block">
          <InsightsSidebar />
        </div>
        <InsightsMobileTabs />
        <div className="flex-1 bg-canvas p-4 md:p-10 overflow-y-auto">
          <div className="max-w-5xl">
            {children}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
