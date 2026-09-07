"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import LeftSidebar from "@/components/layout/LeftSidebar";
import SettingsSidebar, { SettingsMobileTabs } from "@/components/settings/SettingsSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

export default function SettingsLayout({
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
    return <FullPageLoading text="Opening Settings" />;
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
          <SettingsSidebar />
        </div>
        <SettingsMobileTabs />
        <main className="flex-1 bg-canvas p-4 md:p-10 overflow-y-auto">
          <div className="max-w-3xl">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
}
