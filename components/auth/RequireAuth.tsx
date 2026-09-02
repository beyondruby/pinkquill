"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { FullPageLoading } from "@/components/ui/Loading";
import AuthUnavailable from "@/components/auth/AuthUnavailable";

interface RequireAuthProps {
  children: React.ReactNode;
  loadingText?: string;
}

export default function RequireAuth({
  children,
  loadingText = "Loading",
}: RequireAuthProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, loading, status, isAnonymous } = useAuth();

  const redirectPath = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  // Only a *resolved* signed-out state redirects. A timed-out check
  // (status "unknown") shows a retry panel instead of bouncing a user who
  // is very likely signed in.
  useEffect(() => {
    if (isAnonymous) {
      router.replace(`/login?redirect=${encodeURIComponent(redirectPath)}`);
    }
  }, [isAnonymous, redirectPath, router]);

  if (status === "unknown") {
    return <AuthUnavailable />;
  }

  if (loading || !user) {
    return <FullPageLoading text={loadingText} />;
  }

  return <>{children}</>;
}
