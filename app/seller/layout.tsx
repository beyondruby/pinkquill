"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerSetupStatus } from "@/lib/hooks/useSellerProfile";
import LeftSidebar from "@/components/layout/LeftSidebar";
import SellerSidebar from "@/components/seller/SellerSidebar";
import MobileHeader from "@/components/layout/MobileHeader";
import MobileBottomNav from "@/components/layout/MobileBottomNav";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setupCompleted, loading: setupLoading } = useSellerSetupStatus(user?.id);

  const isSetupPage = pathname === "/seller/setup";
  const isOnboardingPage = pathname === "/seller/onboarding";

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  // Redirect to setup if not completed (except on setup/onboarding pages)
  useEffect(() => {
    if (loading || setupLoading || !user) return;
    if (isSetupPage || isOnboardingPage) return;
    if (setupCompleted === false) {
      router.push("/seller/setup");
    }
  }, [loading, setupLoading, user, setupCompleted, isSetupPage, isOnboardingPage, router]);

  if (loading || setupLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-canvas">
        <div className="w-8 h-8 border-2 border-purple-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  // Setup page renders without seller sidebar
  if (isSetupPage) {
    return (
      <>
        <MobileHeader />
        <LeftSidebar />
        <div className="pt-16 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen">
          <main className="bg-canvas p-4 md:p-8 overflow-y-auto">
            <div className="max-w-6xl mx-auto">
              {children}
            </div>
          </main>
        </div>
        <MobileBottomNav />
      </>
    );
  }

  return (
    <>
      <MobileHeader />
      <LeftSidebar />
      <div className="pt-16 pb-20 md:pt-0 md:pb-0 md:ml-[72px] min-h-screen flex flex-col md:flex-row">
        <div className="relative hidden md:block">
          <SellerSidebar />
        </div>
        <main className="flex-1 bg-canvas p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </main>
      </div>
      <MobileBottomNav />
    </>
  );
}
