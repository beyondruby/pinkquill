"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { useSellerSetupStatus } from "@/lib/hooks/useSellerProfile";
import AppShell from "@/components/layout/AppShell";
import SellerSidebar, { SellerMobileNav } from "@/components/seller/SellerSidebar";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

export default function SellerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, status, isAnonymous } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { setupCompleted, loading: setupLoading } = useSellerSetupStatus(user?.id);

  const isSetupPage = pathname === "/seller/setup";
  const isOnboardingPage = pathname === "/seller/onboarding";

  useEffect(() => {
    if (isAnonymous) {
      router.push("/login");
    }
  }, [isAnonymous, router]);

  // Redirect to setup if not completed (except on setup/onboarding pages)
  useEffect(() => {
    if (loading || setupLoading || !user) return;
    if (isSetupPage || isOnboardingPage) return;
    if (setupCompleted === false) {
      router.push("/seller/setup");
    }
  }, [loading, setupLoading, user, setupCompleted, isSetupPage, isOnboardingPage, router]);

  if (status === "unknown") {
    return <AuthUnavailable />;
  }

  if (loading || setupLoading) {
    return <FullPageLoading text="Opening Seller Studio" />;
  }

  if (!user) return null;

  // Setup page renders without seller sidebar
  if (isSetupPage) {
    return (
      <AppShell>
        <div className="bg-canvas p-4 md:p-8">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100dvh-var(--pq-topbar)-var(--pq-bottom-nav))] flex flex-col md:flex-row">
        <SellerMobileNav />
        <div className="relative hidden md:block">
          <SellerSidebar />
        </div>
        <div className="flex-1 bg-canvas p-4 md:p-8 overflow-y-auto">
          <div className="max-w-6xl mx-auto">
            {children}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
